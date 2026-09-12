import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// ---------------------------------------------------------------------
// Timezone handling.
//
// lesson_sessions stores session_date ("YYYY-MM-DD") and session_time
// ("HH:MM") as plain wall-clock values with no timezone attached — same as
// every other date math in this codebase (see LessonRoom/TeacherLessonRoom's
// `new Date(s.date + "T" + s.time)`, which lets the *browser's* local
// timezone decide). A server has no "local" timezone to fall back on, and
// this is a conservatory platform whose lessons are, in practice, on Paris
// time, so that's the zone this function commits to explicitly.
//
// Europe/Paris is UTC+1 in winter (CET) and UTC+2 in summer (CEST) — a fixed
// offset would be wrong for roughly half the year. Instead: ask the
// platform's Intl implementation what Europe/Paris's UTC offset is *at the
// instant closest to the wall-clock time in question* (by first treating the
// wall-clock string as if it were UTC, which is at most a couple of hours off
// from the real instant — nowhere near a DST transition boundary in the vast
// majority of cases, and even exactly on one, being off by an hour only
// shifts the cutoff by an hour on the two days a year that happens).
function parisOffsetMinutesNear(approxUtc: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    timeZoneName: "longOffset",
    hour: "2-digit",
  });
  const part = dtf.formatToParts(approxUtc).find((p) => p.type === "timeZoneName")?.value || "GMT+1";
  const m = part.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!m) return 60;
  const h = parseInt(m[1], 10);
  const mm = m[2] ? parseInt(m[2], 10) : 0;
  return h * 60 + (h < 0 ? -mm : mm);
}

// Converts a lesson_sessions (session_date, session_time) pair — wall-clock
// Europe/Paris — into the real UTC instant it refers to.
function parisWallClockToUtc(dateStr: string, timeStr: string): Date {
  const approxUtc = new Date(`${dateStr}T${timeStr}:00Z`);
  const offsetMin = parisOffsetMinutesNear(approxUtc);
  return new Date(approxUtc.getTime() - offsetMin * 60 * 1000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: userError } = await anonClient.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { sessionId } = await req.json();
    if (typeof sessionId !== "string" || !UUID_RE.test(sessionId)) {
      return json({ error: "Invalid sessionId" }, 400);
    }

    const { data: lessonSession, error: lessonSessionError } = await adminClient
      .from("lesson_sessions")
      .select("id, teacher_id, learner_id, session_date, session_time, status, paid")
      .eq("id", sessionId)
      .maybeSingle();
    if (lessonSessionError || !lessonSession) return json({ error: "Session not found" }, 404);

    const isTeacher = user.id === lessonSession.teacher_id;
    const isLearner = user.id === lessonSession.learner_id;
    if (!isTeacher && !isLearner) return json({ error: "Forbidden" }, 403);

    if (lessonSession.status !== "confirmed" || !lessonSession.paid) {
      return json({ error: "Only a confirmed, paid session can be cancelled this way." }, 400);
    }

    const { data: payment, error: paymentError } = await adminClient
      .from("payments")
      .select("id, status, payment_intent_id, gross_amount_cents, commission_cents, teacher_amount_cents, refunded_cents")
      .eq("lesson_session_id", sessionId)
      .eq("kind", "lesson")
      .maybeSingle();
    if (paymentError || !payment) return json({ error: "Payment record not found for this session." }, 404);
    if (payment.status !== "paid") {
      return json({ error: "This session's payment has already been refunded." }, 409);
    }
    if (!payment.payment_intent_id) {
      return json({ error: "No payment intent on record for this session." }, 400);
    }

    // late_fee_pct is the only teacher-editable knob left in this table —
    // cancel_lock_hours and modify_lock_hours still exist as columns but are
    // no longer read here; the ladder's boundaries are platform-fixed (see
    // CANCEL_FULL_H / CANCEL_ZERO_H just below).
    const { data: rules } = await adminClient
      .from("teacher_rules")
      .select("late_fee_pct")
      .eq("profile_id", lessonSession.teacher_id)
      .maybeSingle();
    const lateFeePct = rules?.late_fee_pct ?? 50;

    // Platform-fixed three-tier cancellation ladder (mirrors CANCEL_FULL_H /
    // CANCEL_ZERO_H in src/App.jsx — keep the two in sync by hand, there's
    // no shared import between the client and an edge function).
    //   >= CANCEL_FULL_H hours before start → 100% refund
    //   CANCEL_ZERO_H .. CANCEL_FULL_H      → (100 − teacher's late_fee_pct)%
    //   < CANCEL_ZERO_H hours before start  → 0% refund, no Stripe call
    const CANCEL_FULL_H = 24;
    const CANCEL_ZERO_H = 12;

    const grossCents = payment.gross_amount_cents;
    let refundCents: number;
    // "full" | "late" | "zero" | "teacher" — teacher's own cancellation is
    // always a full refund and never counts as a late cancellation against
    // the learner (there's no learner fault to log).
    let tier: "full" | "late" | "zero" | "teacher";

    if (isTeacher) {
      // Rule: teacher cancels a paid session anytime → full refund,
      // everything returned. No lock, no fee, regardless of timing.
      refundCents = grossCents;
      tier = "teacher";
    } else {
      const sessionInstantUtc = parisWallClockToUtc(lessonSession.session_date, lessonSession.session_time);
      const hoursUntil = (sessionInstantUtc.getTime() - Date.now()) / (60 * 60 * 1000);
      if (hoursUntil >= CANCEL_FULL_H) {
        refundCents = grossCents;
        tier = "full";
      } else if (hoursUntil >= CANCEL_ZERO_H) {
        // Stripe itself prorates the teacher/platform split on a partial
        // refund via reverse_transfer + refund_application_fee.
        refundCents = Math.round(grossCents * (100 - lateFeePct) / 100);
        tier = "late";
      } else {
        refundCents = 0;
        tier = "zero";
      }
    }
    const late = tier === "late" || tier === "zero";

    if (refundCents > 0) {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: payment.payment_intent_id,
        reverse_transfer: true,
        refund_application_fee: true,
      };
      // Omit `amount` entirely for a full refund — passing the full gross
      // amount explicitly is equivalent, but Stripe treats a genuinely
      // absent `amount` as "refund everything remaining", which is the
      // safer of the two if grossCents and the charge ever drifted apart.
      if (refundCents < grossCents) refundParams.amount = refundCents;
      await stripe.refunds.create(refundParams);
    }

    const fullyRefunded = refundCents === grossCents;
    const nowIso = new Date().toISOString();

    // The zero tier moves no money at all — leave the payment row exactly
    // as "paid" rather than writing a no-op "partially_refunded" with
    // refunded_cents unchanged; there's nothing to reconcile.
    if (refundCents > 0) {
      await adminClient
        .from("payments")
        .update({
          refunded_cents: payment.refunded_cents + refundCents,
          status: fullyRefunded ? "refunded" : "partially_refunded",
          updated_at: nowIso,
        })
        .eq("id", payment.id).eq("status", "paid");
    }

    // paid stays true — it's the historical record of "this session was
    // paid for"; status carries the fact that it's since been cancelled.
    await adminClient
      .from("lesson_sessions")
      .update({ status: "cancelled", updated_at: nowIso })
      .eq("id", sessionId);

    // Abuse guard (cancellation_events): every learner-caused late tier —
    // whether a partial or a zero refund — logs one row. stripe-checkout
    // reads this table to temporarily restrict a serial late-canceller's
    // future bookings; report-no-show logs the sibling 'no_show_report'
    // kind into the same table.
    if (isLearner && late) {
      await adminClient.from("cancellation_events").insert({
        learner_id: user.id,
        session_id: sessionId,
        kind: "late_cancel",
      });
    }

    // Hand back this learner's trailing-30-day late-cancel count so the
    // frontend can show a heads-up warning before the count reaches the
    // threshold stripe-checkout actually enforces (see there).
    let lateCancelCount: number | undefined;
    if (isLearner) {
      const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await adminClient
        .from("cancellation_events")
        .select("id", { count: "exact", head: true })
        .eq("learner_id", user.id)
        .eq("kind", "late_cancel")
        .gte("created_at", thirtyDaysAgoIso);
      lateCancelCount = count ?? 0;
    }

    const otherPartyId = isTeacher ? lessonSession.learner_id : lessonSession.teacher_id;
    const refundEuros = (refundCents / 100).toFixed(2);
    const dateLabel = lessonSession.session_date;
    let body: string;
    if (isTeacher) {
      body = `This session on ${dateLabel} was cancelled by your teacher. €${refundEuros} has been refunded to you.`;
    } else if (tier === "full") {
      body = `This session on ${dateLabel} was cancelled. €${refundEuros} has been refunded.`;
    } else if (tier === "late") {
      body = `This session on ${dateLabel} was cancelled inside the 24h window, so a ${lateFeePct}% late fee was kept. €${refundEuros} has been refunded.`;
    } else {
      body = `This session on ${dateLabel} was cancelled late; per policy no refund was due.`;
    }
    await adminClient.from("direct_messages").insert({
      sender_id: user.id,
      recipient_id: otherPartyId,
      body,
    });

    return json({
      refundedCents: refundCents,
      status: refundCents === 0 ? "paid" : fullyRefunded ? "refunded" : "partially_refunded",
      lateCancelCount,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
