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

// Cancels the linked lesson when its money is gone. Only a 'confirmed' row is
// touched (never overwrite cancelled / no_show), and not while another live
// payment still covers the session (e.g. the duplicate-payment refund below
// must not cancel the lesson the first payment legitimately bought).
async function cancelSessionIfUnfunded(lessonSessionId: string | null | undefined) {
  if (!lessonSessionId) return;
  const { data: live } = await adminClient
    .from("payments")
    .select("id")
    .eq("lesson_session_id", lessonSessionId)
    .in("status", ["paid", "partially_refunded", "disputed"])
    .limit(1);
  if (live && live.length) return;
  await adminClient
    .from("lesson_sessions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", lessonSessionId)
    .eq("status", "confirmed");
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
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Delayed methods (SEPA debit, etc.) complete the Checkout while the
        // money is still 'unpaid'; the row stays pending until
        // async_payment_succeeded (same handler) or async_payment_failed.
        if (session.payment_status !== "paid") break;
        const paymentId = session.metadata?.payment_id;
        const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

        // Mark paid only from a not-yet-settled state, so a replayed or late
        // event can never resurrect a refunded / disputed payment. Matched by
        // metadata.payment_id, falling back to the Checkout id for older rows.
        const paidQuery = adminClient
          .from("payments")
          .update({ status: "paid", payment_intent_id: paymentIntentId || null, updated_at: new Date().toISOString() })
          .in("status", ["pending", "failed", "expired"]);
        const { data: updatedRows, error: paidError } = await (paymentId
          ? paidQuery.eq("id", paymentId)
          : paidQuery.eq("checkout_session_id", session.id)
        ).select("id, lesson_session_id");

        if (paidError) {
          if (paidError.code === "23505") {
            // A second payment for a session that is already paid (two
            // Checkouts completed). The money is real, so give it back, and
            // do NOT touch lesson_sessions.paid on its behalf.
            console.error("DUPLICATE PAYMENT for a session already paid — refunding", { paymentId, checkout: session.id, paymentIntentId });
            if (paymentIntentId) {
              await stripe.refunds.create({
                payment_intent: paymentIntentId,
                reverse_transfer: true,
                refund_application_fee: true,
              });
            }
            await adminClient
              .from("payments")
              .update({ status: "refunded", payment_intent_id: paymentIntentId || null, refunded_cents: session.amount_total ?? 0, updated_at: new Date().toISOString() })
              .match(paymentId ? { id: paymentId } : { checkout_session_id: session.id });
            break;
          }
          throw new Error(paidError.message);
        }

        // Flip the lesson_sessions row itself — this is the only place
        // lesson_sessions.paid is ever set (the client's UPDATE grant on
        // that column was revoked; see 20260902400000_payments_link_session).
        // Idempotent across Stripe retries: a replay updates no payment row
        // above, so look the row up again and only flip when it is this
        // payment's own, still-'paid' row.
        {
          let lessonSessionId: string | null | undefined = updatedRows?.[0]?.lesson_session_id;
          if (!updatedRows || updatedRows.length === 0) {
            const { data: existingRow } = await adminClient
              .from("payments")
              .select("lesson_session_id, status, payment_intent_id")
              .match(paymentId ? { id: paymentId } : { checkout_session_id: session.id })
              .maybeSingle();
            lessonSessionId = existingRow && existingRow.status === "paid" && existingRow.payment_intent_id === (paymentIntentId || null)
              ? existingRow.lesson_session_id : null;
          }
          if (lessonSessionId) {
            await adminClient
              .from("lesson_sessions")
              .update({ paid: true, updated_at: new Date().toISOString() })
              .eq("id", lessonSessionId)
              .eq("paid", false);
          }
        }

        // Backfill the actual processing fee from the balance transaction —
        // this is never estimated or hard-coded elsewhere in the codebase.
        if (paymentIntentId) {
          // The balance transaction lags the completed event — on destination
          // charges by more than the few seconds a webhook can afford to
          // block (Stripe times the delivery out). So: answer Stripe now,
          // keep hunting the fee in the background. EdgeRuntime.waitUntil
          // keeps the isolate alive after the response is returned.
          const huntFee = async () => {
            for (let attempt = 0; attempt < 8; attempt++) {
              try {
                const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge.balance_transaction"] });
                const charge = intent.latest_charge as Stripe.Charge | null;
                const balanceTxn = charge?.balance_transaction as Stripe.BalanceTransaction | null;
                if (balanceTxn && typeof balanceTxn === "object") {
                  await markPayment({ paymentId, sessionId: session.id }, { stripe_fee_cents: balanceTxn.fee });
                  return;
                }
              } catch (feeErr) {
                console.error("fee lookup attempt", attempt + 1, "failed for", session.id, feeErr.message);
              }
              await new Promise((r) => setTimeout(r, 8000));
            }
            console.error("fee never resolved for", session.id);
          };
          try {
            // deno-lint-ignore no-explicit-any
            (globalThis as any).EdgeRuntime?.waitUntil ? (globalThis as any).EdgeRuntime.waitUntil(huntFee()) : await huntFee();
          } catch { await huntFee(); }
        }
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markPayment({ paymentId: session.metadata?.payment_id, sessionId: session.id }, { status: "failed" });
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Only a row still waiting: never downgrade a paid/refunded one.
        await adminClient
          .from("payments")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("checkout_session_id", session.id)
          .in("status", ["pending", "failed"]);
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
        // Checkout stamps metadata.payment_id on the PaymentIntent, so a
        // failure before checkout.session.completed can still find its row.
        const failedPaymentId = intent.metadata?.payment_id;
        await adminClient
          .from("payments")
          .update({ status: "failed", payment_intent_id: intent.id, updated_at: new Date().toISOString() })
          .or(failedPaymentId ? `id.eq.${failedPaymentId},payment_intent_id.eq.${intent.id}` : `payment_intent_id.eq.${intent.id}`)
          // A failed attempt must never overwrite a settled payment.
          .in("status", ["pending", "failed"]);
        break;
      }

      case "charge.refunded": {
        // Fires on every refund, full or partial, and cancel-session already
        // wrote its own definitive status+refunded_cents synchronously
        // before the refund call even returned. This handler exists for
        // refunds Stripe knows about that didn't go through cancel-session
        // (dashboard refunds, disputes, etc.) and as an idempotent
        // reconciliation pass — it always overwrites with what Stripe says
        // is true of the charge as a whole, so it can never leave the ledger
        // out of sync with Stripe even if it fires more than once or after
        // cancel-session already ran.
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (paymentIntentId) {
          const fullyRefunded = charge.amount_refunded >= charge.amount;
          await adminClient
            .from("payments")
            .update({
              status: fullyRefunded ? "refunded" : "partially_refunded",
              refunded_cents: charge.amount_refunded,
              updated_at: new Date().toISOString(),
            })
            .eq("payment_intent_id", paymentIntentId)
            // An open dispute keeps its marker until charge.dispute.closed.
            .neq("status", "disputed");

          // A refund issued from the Stripe dashboard must not leave a live
          // paid session behind: once the whole charge is back, the lesson
          // is cancelled (only if still confirmed, so cancel-session's own
          // 'cancelled' / 'no_show' outcome is never overwritten).
          if (fullyRefunded) {
            const { data: refundedRow } = await adminClient
              .from("payments")
              .select("lesson_session_id")
              .eq("payment_intent_id", paymentIntentId)
              .limit(1)
              .maybeSingle();
            await cancelSessionIfUnfunded(refundedRow?.lesson_session_id);
          }
        }
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const paymentIntentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
        if (paymentIntentId) {
          await adminClient
            .from("payments")
            .update({ status: "disputed", updated_at: new Date().toISOString() })
            .eq("payment_intent_id", paymentIntentId)
            .in("status", ["paid", "partially_refunded"]);
        }
        break;
      }

      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        const paymentIntentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
        if (paymentIntentId) {
          const { data: row } = await adminClient
            .from("payments")
            .select("refunded_cents, lesson_session_id")
            .eq("payment_intent_id", paymentIntentId)
            .maybeSingle();
          if (dispute.status === "won" || dispute.status === "warning_closed") {
            // Funds stay with us (a closed warning never became a dispute).
            // If part of the charge had been refunded before, it still is.
            await adminClient
              .from("payments")
              .update({ status: (row?.refunded_cents ?? 0) > 0 ? "partially_refunded" : "paid", updated_at: new Date().toISOString() })
              .eq("payment_intent_id", paymentIntentId)
              .eq("status", "disputed");
          } else if (dispute.status === "charge_refunded") {
            // We refunded the charge ourselves to settle it.
            await adminClient
              .from("payments")
              .update({ status: "refunded", updated_at: new Date().toISOString() })
              .eq("payment_intent_id", paymentIntentId)
              .in("status", ["disputed", "paid", "partially_refunded"]);
          } else if (dispute.status === "lost") {
            await adminClient
              .from("payments")
              .update({ status: "refunded", refunded_cents: dispute.amount, updated_at: new Date().toISOString() })
              .eq("payment_intent_id", paymentIntentId)
              .in("status", ["disputed", "paid", "partially_refunded"]);
            // The money is gone, so the lesson can't stay a live paid one.
            await cancelSessionIfUnfunded(row?.lesson_session_id);
          }
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
