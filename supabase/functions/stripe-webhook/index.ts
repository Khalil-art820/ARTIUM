// Called directly by Stripe, never by the app, so there is no user JWT to
// verify — this function must be deployed with:
//   supabase functions deploy stripe-webhook --no-verify-jwt
// (or with `verify_jwt = false` for this function in supabase/config.toml,
// depending on which the project uses). Signature verification below is
// what actually authenticates the caller.
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const adminClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function markPayment(sessionOrPaymentId: { sessionId?: string; paymentId?: string }, update: Record<string, unknown>) {
  const query = adminClient.from("payments").update({ ...update, updated_at: new Date().toISOString() });
  if (sessionOrPaymentId.paymentId) {
    return query.eq("id", sessionOrPaymentId.paymentId);
  }
  return query.eq("checkout_session_id", sessionOrPaymentId.sessionId);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    // constructEventAsync, not constructEvent: Deno's SubtleCrypto is async,
    // and the sync verifier in stripe-node doesn't work in this runtime.
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentId = session.metadata?.payment_id;
        const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

        await markPayment(
          { paymentId, sessionId: session.id },
          { status: "paid", payment_intent_id: paymentIntentId || null }
        );

        // Backfill the actual processing fee from the balance transaction —
        // this is never estimated or hard-coded elsewhere in the codebase.
        if (paymentIntentId) {
          // The balance transaction can lag the completed event by a moment
          // (observed on a destination charge: a one-shot lookup found
          // nothing, the same lookup seconds later returned the fee) — so
          // try a few times before giving up.
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge.balance_transaction"] });
              const charge = intent.latest_charge as Stripe.Charge | null;
              const balanceTxn = charge?.balance_transaction as Stripe.BalanceTransaction | null;
              if (balanceTxn && typeof balanceTxn === "object") {
                await markPayment({ paymentId, sessionId: session.id }, { stripe_fee_cents: balanceTxn.fee });
                break;
              }
            } catch (feeErr) {
              console.error("fee lookup attempt", attempt + 1, "failed for", session.id, feeErr.message);
            }
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        // payment_intent.payment_failed doesn't carry the checkout session id
        // directly; the payments row is keyed on payment_intent_id once
        // checkout.session.completed has run, but a failure can happen
        // before that — fall back to matching on payment_intent_id, and if
        // nothing matches yet there's nothing to mark (the pending row will
        // simply never be completed).
        await adminClient
          .from("payments")
          .update({ status: "failed", payment_intent_id: intent.id, updated_at: new Date().toISOString() })
          .eq("payment_intent_id", intent.id);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (paymentIntentId) {
          await adminClient
            .from("payments")
            .update({ status: "refunded", updated_at: new Date().toISOString() })
            .eq("payment_intent_id", paymentIntentId);
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const onboarding = account.details_submitted ? "complete" : "in_progress";
        const payout = account.charges_enabled && account.payouts_enabled ? "ready"
          : account.requirements?.disabled_reason ? "disabled"
          : account.details_submitted ? "pending"
          : "none";
        await adminClient
          .from("teacher_payout_accounts")
          .update({
            stripe_onboarding_status: onboarding,
            payout_status: payout,
            country: account.country || null,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_account_id", account.id);
        break;
      }

      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("stripe-webhook handler error", err.message);
    // Stripe retries on non-2xx, and every handler above is idempotent
    // (keyed on unique ids), so it's safe to ask for a retry here.
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
