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
// Timezone handling — copied verbatim from cancel-session/index.ts. Same
// reasoning applies here: lesson_sessions stores plain Europe/Paris
// wall-clock values, and a "did the session's start time already pass"
// check needs the same real-instant conversion the refund-tier check does.
// Keep this block identical to cancel-session's if either ever changes.
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

function parisWallClockToUtc(dateStr: string, timeStr: string): Date {
  const approxUtc = new Date(`${dateStr}T${timeStr}:00Z`);
  const offsetMin = parisOffsetMinutesNear(approxUtc);
  return new Date(approxUtc.getTime() - offsetMin * 60 * 1000);
}

// A learner can report a no-show only in a 7-day window that opens the
// instant the session was due to start — before that, the lesson simply
// hasn't happened yet; indefinitely after, the report stops being credible.
const NO_SHOW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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

    // Only the learner who booked it may report a no-show — a teacher
    // reporting their own no-show makes no sense, and isn't what this
    // endpoint is for (a teacher can just cancel via cancel-session, always
    // a full refund anyway).
    if (user.id !== lessonSession.learner_id) return json({ error: "Forbidden" }, 403);

    if (lessonSession.status !== "confirmed" || !lessonSession.paid) {
      return json({ error: "Only a confirmed, paid session can be reported this way." }, 400);
    }

    const sessionInstantUtc = parisWallClockToUtc(lessonSession.session_date, lessonSession.session_time);
    const msSinceStart = Date.now() - sessionInstantUtc.getTime();
    if (msSinceStart < 0) {
      return json({ error: "This session hasn't started yet." }, 400);
    }
    if (msSinceStart > NO_SHOW_WINDOW_MS) {
      return json({ error: "This session is too old to report — no-shows must be reported within 7 days." }, 400);
    }

    // Abuse cap: three no-show reports in 90 days and further reports are
    // refused (stripe-checkout also counts these toward its booking guard).
    const ninetyDaysAgoIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentReports } = await adminClient
      .from("cancellation_events")
      .select("id", { count: "exact", head: true })
      .eq("learner_id", user.id)
      .eq("kind", "no_show_report")
      .gte("created_at", ninetyDaysAgoIso);
    if ((recentReports ?? 0) >= 3) return json({ error: "booking_restricted" }, 403);

    const { data: payment, error: paymentError } = await adminClient
      .from("payments")
      .select("id, status, payment_intent_id, gross_amount_cents, refunded_cents")
      .eq("lesson_session_id", sessionId)
      .eq("kind", "lesson")
      // Only the live charge: a stale pending/expired/failed checkout row
      // for the same session must not shadow (or break) the paid one.
      .in("status", ["paid", "partially_refunded"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (paymentError || !payment) return json({ error: "Payment record not found for this session." }, 404);
    if (payment.status !== "paid") {
      return json({ error: "This session's payment has already been refunded." }, 409);
    }
    if (!payment.payment_intent_id) {
      return json({ error: "No payment intent on record for this session." }, 400);
    }

    // A lesson paid for at or after its start time can't have been "missed"
    // by the teacher: that is the learner booking a past slot, paying, and
    // claiming a refund. Payment time is the Stripe charge's creation time
    // — payments.updated_at is also touched later by the fee backfill, and
    // created_at is when the checkout was opened, so neither is reliable.
    const intent = await stripe.paymentIntents.retrieve(payment.payment_intent_id, { expand: ["latest_charge"] });
    const charge = intent.latest_charge as Stripe.Charge | null;
    const paidAtMs = (charge?.created ?? intent.created) * 1000;
    if (paidAtMs >= sessionInstantUtc.getTime()) return json({ error: "not_eligible_no_show" }, 409);

    // Always a full refund — no tier math, unlike a learner-initiated
    // cancellation. The teacher didn't show, so there is no fee to keep.
    await stripe.refunds.create({
      payment_intent: payment.payment_intent_id,
      reverse_transfer: true,
      refund_application_fee: true,
    });

    const nowIso = new Date().toISOString();
    const grossCents = payment.gross_amount_cents;

    await adminClient
      .from("payments")
      .update({
        refunded_cents: payment.refunded_cents + grossCents,
        status: "refunded",
        updated_at: nowIso,
      })
      .eq("id", payment.id).eq("status", "paid");

    await adminClient
      .from("lesson_sessions")
      .update({ status: "no_show", updated_at: nowIso })
      .eq("id", sessionId)
      // Only a live confirmed row: never overwrite another outcome.
      .eq("status", "confirmed");

    await adminClient.from("cancellation_events").insert({
      learner_id: user.id,
      session_id: sessionId,
      kind: "no_show_report",
    });

    const { data: learnerProfile } = await adminClient
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();
    const learnerName = learnerProfile?.name || "Your student";

    await adminClient.from("direct_messages").insert({
      sender_id: user.id,
      recipient_id: lessonSession.teacher_id,
      body: `${learnerName} reported that the ${lessonSession.session_date} session didn't take place; the payment was refunded in full. If this is wrong, contact the Artium team.`,
    });

    return json({ refundedCents: grossCents, status: "refunded" });
  } catch (err) {
    // Never hand Stripe / Postgres text to the client.
    console.error("report-no-show failed", err?.message);
    return json({ error: "server_error", message: "Something went wrong. Please try again." }, 500);
  }
});
