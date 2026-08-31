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

// Mirrors the mapping the account.updated webhook handler uses, so a page
// that calls this right after returning from onboarding sees the same
// status the webhook would eventually write, without waiting for it.
function statusesFor(account: Stripe.Account) {
  const onboarding = account.details_submitted ? "complete" : "in_progress";
  const payout = account.charges_enabled && account.payouts_enabled ? "ready"
    : account.requirements?.disabled_reason ? "disabled"
    : account.details_submitted ? "pending"
    : "none";
  return { onboarding, payout };
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
    const { data: row, error: rowError } = await adminClient
      .from("teacher_payout_accounts")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (rowError) {
      return new Response(JSON.stringify({ error: rowError.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    if (!row?.stripe_account_id) {
      return new Response(JSON.stringify({ status: null }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const account = await stripe.accounts.retrieve(row.stripe_account_id);
    const { onboarding, payout } = statusesFor(account);

    const individualName = account.individual
      ? [account.individual.first_name, account.individual.last_name].filter(Boolean).join(" ")
      : "";
    const legalName = account.business_profile?.name || individualName || row.legal_name;

    const update = {
      stripe_onboarding_status: onboarding,
      payout_status: payout,
      country: account.country || row.country,
      legal_name: legalName || null,
      professional_status: account.business_type || row.professional_status,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateError } = await adminClient
      .from("teacher_payout_accounts")
      .update(update)
      .eq("profile_id", user.id)
      .select()
      .single();

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ status: updated }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
