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

// Only ever redirect back into the app itself. The refresh/return URLs are
// client-supplied (Stripe requires an absolute URL and the client knows its
// own origin), but an attacker-supplied redirect target is exactly the kind
// of thing an Account Link should never carry, so it is validated against
// the two origins Artium is actually served from.
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
    const { refreshUrl, returnUrl } = await req.json();
    if (!isAllowedUrl(refreshUrl) || !isAllowedUrl(returnUrl)) {
      return new Response(JSON.stringify({ error: "Invalid redirect URL" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, name, conservatory_email")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "No profile found for this account" }), { status: 404, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: existing } = await adminClient
      .from("teacher_payout_accounts")
      .select("stripe_account_id")
      .eq("profile_id", user.id)
      .maybeSingle();

    let accountId = existing?.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: profile.conservatory_email || undefined,
        metadata: { profile_id: user.id },
      });
      accountId = account.id;

      const { error: upsertError } = await adminClient
        .from("teacher_payout_accounts")
        .upsert({
          profile_id: user.id,
          stripe_account_id: accountId,
          stripe_onboarding_status: "in_progress",
          updated_at: new Date().toISOString(),
        });
      if (upsertError) {
        return new Response(JSON.stringify({ error: upsertError.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
      }
    } else {
      await adminClient
        .from("teacher_payout_accounts")
        .update({ stripe_onboarding_status: "in_progress", updated_at: new Date().toISOString() })
        .eq("profile_id", user.id);
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: accountLink.url }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
