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

// Exact-origin allowlist. Never prefix-match a URL string: "https://art-ium.com.evil.com"
// and "https://art-ium.com@evil.com" both begin with the production origin.
const ALLOWED_ORIGINS = new Set([
  "https://art-ium.com",
  "http://localhost:5173",
  "http://localhost:4173",
]);
function isAllowedUrl(url: string) {
  try {
    return ALLOWED_ORIGINS.has(new URL(url).origin);
  } catch {
    return false;
  }
}

// Same figure PROMO_RATE * 5 works out to in src/App.jsx (€13 * 5). Fixed
// here, server-side, rather than trusted from the client.
const PROMO_TOTAL_CENTS = 65 * 100;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function commissionRateFor(adminClient: ReturnType<typeof createClient>, teacherId: string | null, category: string) {
  if (teacherId) {
    const { data: teacherAndCategory } = await adminClient
      .from("commission_overrides")
      .select("rate")
      .eq("teacher_id", teacherId)
      .eq("category", category)
      .maybeSingle();
    if (teacherAndCategory) return teacherAndCategory.rate as number;

    const { data: teacherOnly } = await adminClient
      .from("commission_overrides")
      .select("rate")
      .eq("teacher_id", teacherId)
      .is("category", null)
      .maybeSingle();
    if (teacherOnly) return teacherOnly.rate as number;
  }

  const { data: categoryOnly } = await adminClient
    .from("commission_overrides")
    .select("rate")
    .is("teacher_id", null)
    .eq("category", category)
    .maybeSingle();
  if (categoryOnly) return categoryOnly.rate as number;

  const { data: platform } = await adminClient
    .from("platform_settings")
    .select("value")
    .eq("key", "artium_commission_rate")
    .single();
  return (platform?.value as { rate?: number })?.rate ?? 0.10;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: userError } = await anonClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { kind, teacherId, sessionId, successUrl, cancelUrl } = await req.json();

    if (!isAllowedUrl(successUrl) || !isAllowedUrl(cancelUrl)) {
      return new Response(JSON.stringify({ error: "Invalid redirect URL" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    if (kind !== "lesson" && kind !== "promotion") {
      return new Response(JSON.stringify({ error: "Invalid kind" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const currency = "eur";
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
    };

    let grossCents: number;
    let commissionCents: number;
    let teacherProfileId: string | null = null;
    let productName: string;

    if (kind === "lesson") {
      if (!teacherId) {
        return new Response(JSON.stringify({ error: "Missing teacherId" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
      }

      const { data: teacher, error: teacherError } = await adminClient
        .from("profiles")
        .select("id, name, teaching_open, teaching_price")
        .eq("id", teacherId)
        .single();
      if (teacherError || !teacher) {
        return new Response(JSON.stringify({ error: "Teacher not found" }), { status: 404, headers: { ...CORS, "Content-Type": "application/json" } });
      }
      const price = parseFloat(String(teacher.teaching_price ?? "").replace(/[^0-9.]/g, ""));
      if (!teacher.teaching_open || !price) {
        return new Response(JSON.stringify({ error: "This teacher hasn't set a lesson price yet." }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
      }

      const { data: payout } = await adminClient
        .from("teacher_payout_accounts")
        .select("stripe_account_id, payout_status")
        .eq("profile_id", teacherId)
        .maybeSingle();
      if (!payout || payout.payout_status !== "ready" || !payout.stripe_account_id) {
        return new Response(JSON.stringify({ error: "This teacher can't accept paid bookings yet." }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
      }

      // Optional: pay for a specific lesson_sessions row rather than an
      // untracked one-off charge. If a sessionId is given it must be a real
      // uuid, belong to this teacher/learner pair, and not already be paid —
      // otherwise the webhook has nothing legitimate to flip paid=true on,
      // or would be double-charging an already-paid session.
      if (sessionId !== undefined && sessionId !== null) {
        if (typeof sessionId !== "string" || !UUID_RE.test(sessionId)) {
          return new Response(JSON.stringify({ error: "Invalid sessionId" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
        }
        const { data: lessonSession, error: lessonSessionError } = await adminClient
          .from("lesson_sessions")
          .select("id, paid")
          .eq("id", sessionId)
          .eq("teacher_id", teacherId)
          .eq("learner_id", user.id)
          .maybeSingle();
        if (lessonSessionError || !lessonSession) {
          return new Response(JSON.stringify({ error: "Session not found" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
        }
        if (lessonSession.paid) {
          return new Response(JSON.stringify({ error: "This session is already paid." }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
        }
      }

      grossCents = Math.round(price * 100);
      const rate = await commissionRateFor(adminClient, teacherId, "lesson");
      commissionCents = Math.round(grossCents * rate);
      teacherProfileId = teacherId;
      productName = `Lesson with ${teacher.name}`;

      sessionParams.line_items = [{
        price_data: { currency, product_data: { name: productName }, unit_amount: grossCents },
        quantity: 1,
      }];
      sessionParams.payment_intent_data = {
        application_fee_amount: commissionCents,
        transfer_data: { destination: payout.stripe_account_id },
      };
    } else {
      // One paid promotion per account. The UI hides the button once paid,
      // but the ledger is the enforcement: a crafted request gets refused too.
      const { data: alreadyPaid } = await adminClient
        .from("payments")
        .select("id")
        .eq("payer_user_id", user.id)
        .eq("kind", "promotion")
        .eq("status", "paid")
        .limit(1);
      if (alreadyPaid && alreadyPaid.length) {
        return new Response(JSON.stringify({ error: "This promotion is already paid." }), { status: 409, headers: { ...CORS, "Content-Type": "application/json" } });
      }
      grossCents = PROMO_TOTAL_CENTS;
      const rate = await commissionRateFor(adminClient, null, "promotion");
      commissionCents = Math.round(grossCents * rate);
      productName = "aclassicaltone promotion";

      sessionParams.line_items = [{
        price_data: { currency, product_data: { name: productName }, unit_amount: grossCents },
        quantity: 1,
      }];
      // Promotion is a pure platform charge — no transfer_data, the whole
      // amount belongs to Artium. commissionCents equals grossCents unless a
      // (currently empty) "promotion" category override says otherwise.
    }

    const teacherAmountCents = grossCents - commissionCents;

    const { data: payment, error: paymentError } = await adminClient
      .from("payments")
      .insert({
        payer_user_id: user.id,
        teacher_profile_id: teacherProfileId,
        kind,
        currency,
        gross_amount_cents: grossCents,
        commission_cents: commissionCents,
        teacher_amount_cents: teacherAmountCents,
        lesson_session_id: kind === "lesson" ? (sessionId || null) : null,
        status: "pending",
      })
      .select()
      .single();
    if (paymentError || !payment) {
      return new Response(JSON.stringify({ error: paymentError?.message || "Could not record payment" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    sessionParams.metadata = { payment_id: payment.id, kind, teacherId: teacherId || "" };

    const session = await stripe.checkout.sessions.create(sessionParams);

    await adminClient
      .from("payments")
      .update({ checkout_session_id: session.id, updated_at: new Date().toISOString() })
      .eq("id", payment.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
