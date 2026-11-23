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

Deno.serve(async (req) => {
  // Browser preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: CORS });
  }

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await anonClient.auth.getUser();
  if (userError || !user) {
    return new Response("Unauthorized", { status: 401, headers: CORS });
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Refuse while money is on the line. Deleting the account cascades
  // lesson_sessions away with no refund and no transfer, leaving the other
  // party out of pocket, so the person must cancel (running the refund
  // policy) or wait. Runs before anything is deleted so a refusal changes
  // nothing. Two checks:
  //  1. a paid session that is still live, or whose 7-day no-show window
  //     (report-no-show) could still open: session_date from 8 days ago on,
  //     counted in Europe/Paris like the rest of the session maths;
  //  2. any payment tied to one of their sessions that still holds or may
  //     yet hold money (pending checkout, paid, partially refunded,
  //     disputed) while that session isn't cancelled / no_show.
  const parisToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const windowStart = new Date(new Date(parisToday + "T00:00:00Z").getTime() - 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const mine = `teacher_id.eq.${user.id},learner_id.eq.${user.id}`;
  const { count: upcomingPaid, error: upcomingError } = await adminClient
    .from("lesson_sessions")
    .select("id", { count: "exact", head: true })
    .or(mine)
    .eq("paid", true)
    .in("status", ["confirmed", "teacher_proposed", "student_proposed"])
    .gte("session_date", windowStart);
  if (upcomingError) {
    console.error("delete-account session check failed", upcomingError.message);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  let blocked = (upcomingPaid ?? 0) > 0;
  if (!blocked) {
    const { data: theirSessions, error: sessionsError } = await adminClient
      .from("lesson_sessions")
      .select("id")
      .or(mine)
      .not("status", "in", "(cancelled,no_show)");
    if (sessionsError) {
      console.error("delete-account session list failed", sessionsError.message);
      return new Response(JSON.stringify({ error: "server_error" }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const ids = (theirSessions || []).map((r: { id: string }) => r.id);
    if (ids.length > 0) {
      const { count: openPayments, error: paymentsError } = await adminClient
        .from("payments")
        .select("id", { count: "exact", head: true })
        .in("lesson_session_id", ids)
        .in("status", ["pending", "paid", "partially_refunded", "disputed"]);
      if (paymentsError) {
        console.error("delete-account payment check failed", paymentsError.message);
        return new Response(JSON.stringify({ error: "server_error" }), {
          status: 500,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      blocked = (openPayments ?? 0) > 0;
    }
  }
  if (blocked) {
    return new Response(JSON.stringify({ error: "upcoming_paid_sessions" }), {
      status: 409,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // The Stripe account id has to be read now: teacher_payout_accounts
  // cascades from profiles, so after the deletion the only link is gone.
  const { data: payoutRow } = await adminClient
    .from("teacher_payout_accounts")
    .select("stripe_account_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  // The uploaded proof goes first, and it has to go first.
  //
  // profiles now cascades from auth.users, so deleting the account takes the
  // profile, the verification requests, the tracks. Storage cascades from
  // none of it: a scanned student ID or a diploma sits in the student-proofs
  // bucket and outlives everything else about the person. Of everything held
  // about someone, that is the document they would least expect to survive a
  // deletion.
  //
  // Nothing in the file's own path says whose it is — it is uploaded during
  // signup, before there is an account to attribute it to — so the only link
  // is student_verifications.document_url. That row is about to be deleted by
  // the cascade, which is why the paths are collected before the user, not
  // after: the other order loses the only record of what to remove.
  //
  // Removing the file is reported but not fatal. An account deletion that
  // half-succeeds and returns an error leaves the person unsure whether they
  // still have an account, and re-running will not help — the user is gone by
  // then. A leftover file is a smaller wrong than that, and the query at the
  // bottom of this file finds them.
  const { data: proofRows, error: proofError } = await adminClient
    .from("student_verifications")
    .select("document_url")
    .eq("user_id", user.id);

  const paths = (proofRows || [])
    .map((r: { document_url: string | null }) => (r.document_url || "").trim())
    .filter((p: string) => p.length > 0);

  if (proofError) {
    console.error("could not list proofs for", user.id, proofError.message);
  } else if (paths.length > 0) {
    const { error: removeError } = await adminClient.storage.from("student-proofs").remove(paths);
    if (removeError) console.error("could not remove proofs for", user.id, removeError.message);
  }

  const { error } = await adminClient.auth.admin.deleteUser(user.id);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Close the teacher's connected account so it isn't orphaned. Stripe
  // refuses while the account still holds a balance; that is not worth
  // failing a deletion that already happened, so log it and move on.
  if (payoutRow?.stripe_account_id) {
    try {
      await stripe.accounts.del(payoutRow.stripe_account_id);
    } catch (stripeErr) {
      console.error("could not delete Stripe account", payoutRow.stripe_account_id, "for", user.id, stripeErr.message);
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
