// Check a one-time code sent to a conservatory address.
//
// The counterpart to send-conservatory-code. Returns whether the code was
// right and nothing else: no session, no token, no account. Proving you can
// read mail at an address is a fact about the address, and it should not also
// be a way to become somebody.
//
// Deploy: supabase functions deploy verify-conservatory-code --no-verify-jwt
//
// --no-verify-jwt for the same reason as the sender: the caller is partway
// through signup and has no session to present.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Six digits is only worth something while guessing is expensive. Five tries
// per code, and a wrong guess counts even when the code has already expired,
// so burning through them is never a way to learn anything.
const MAX_ATTEMPTS = 5;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function sha256(s: string) {
  const bytes = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Compare in time that does not depend on where the first difference is.
// Both sides are hex digests of a fixed length here, so this is belt and
// braces — but the moment someone compares a raw code with === this becomes
// the thing that was missing.
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let email = "", code = "";
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim().toLowerCase();
    code = String(body?.code ?? "").trim();
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }
  if (!email || !/^\d{4,10}$/.test(code)) {
    return json({ error: "That code didn't match. Please check and try again." }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Newest unspent code for the address. Asking for a second code should not
  // leave the first one working.
  const { data: rows, error } = await admin
    .from("conservatory_email_codes")
    .select("id, code_hash, expires_at, attempts, verified_at")
    .eq("email", email)
    .is("verified_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return json({ error: error.message }, 500);

  const row = rows?.[0];
  // One message for every failure below. Which of them it was — no code, the
  // wrong code, an expired one — is only useful to someone who is guessing.
  const nope = () => json({ error: "That code didn't match. Please check and try again." }, 400);
  if (!row) return nope();

  if (row.attempts >= MAX_ATTEMPTS) {
    return json({ error: "Too many attempts. Ask for a new code." }, 429);
  }

  // Count the attempt before judging it, so a client that hangs up on a wrong
  // answer still pays for it.
  await admin.from("conservatory_email_codes")
    .update({ attempts: row.attempts + 1 }).eq("id", row.id);

  if (new Date(row.expires_at).getTime() < Date.now()) return nope();
  if (!timingSafeEqual(await sha256(code), row.code_hash)) return nope();

  // Spend it. A code that still works after it has been used is a code that
  // can be replayed by anyone who saw the inbox.
  const { error: spendError } = await admin.from("conservatory_email_codes")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("verified_at", null);
  if (spendError) return json({ error: spendError.message }, 500);

  return json({ ok: true });
});
