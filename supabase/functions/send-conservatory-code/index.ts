// Send a one-time code to a conservatory address.
//
// This exists so that checking an address stops creating an account for it.
// Supabase's own OTP registers whatever address it is sent to, which turned
// "prove you can read mail at your school" into "you now have an Artium
// account under your school address" — and then refused the real signup that
// followed as a repeated one. The code here is a row in a table. It grants
// nothing, and nothing is left behind when it expires.
//
// Called before the visitor has an account, so it takes the anon key rather
// than a session. That makes it an open endpoint that sends mail, so the
// limits below are the whole security story: without them it is a way to post
// mail to strangers with Artium's name on it.
//
// Deploy:  supabase functions deploy send-conservatory-code --no-verify-jwt
// Secrets: supabase secrets set RESEND_API_KEY=re_...
//          supabase secrets set MAIL_FROM="Artium <verify@yourdomain>"
//
// --no-verify-jwt is required: the default rejects anything without a signed
// session, and the whole point is that the caller does not have one yet.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CODE_TTL_MINUTES = 15;
// Enough to cover a mistyped address and a slow inbox, not enough to be a
// mail cannon. Counted over the window below, per address.
const MAX_PER_HOUR = 5;
const WINDOW_MINUTES = 60;

// The addresses people reach for when a form asks for an email, none of which
// belong to an institution. Kept in step with FREE_MAIL in the client — the
// client's copy is there to explain the rule in the form, this one is there to
// enforce it, and only this one is out of the caller's reach.
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com",
  "hotmail.fr", "outlook.com", "outlook.fr", "live.com", "icloud.com",
  "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de",
  "mail.com", "yandex.com", "qq.com", "163.com", "orange.fr", "free.fr",
  "wanadoo.fr", "web.de", "t-online.de",
]);

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

function sixDigits() {
  // crypto.getRandomValues, not Math.random: this is the only secret in the
  // exchange, and a predictable one is no better than none.
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let email = "";
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim().toLowerCase();
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }

  const match = email.match(/^[^@\s]+@([^@\s]+\.[^@\s]+)$/);
  if (!match) return json({ error: "That doesn't look like an email address." }, 400);
  if (FREE_MAIL.has(match[1])) {
    return json({ error: "That's a personal address. We need the one your conservatory gave you." }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Cheap to run, and it keeps the table to roughly a day of traffic.
  await admin.rpc("prune_conservatory_email_codes");

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count, error: countError } = await admin
    .from("conservatory_email_codes")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", since);
  if (countError) return json({ error: countError.message }, 500);
  if ((count ?? 0) >= MAX_PER_HOUR) {
    return json({ error: "Too many codes requested for that address. Try again in an hour." }, 429);
  }

  const code = sixDigits();
  const expires = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();
  const { error: insertError } = await admin.from("conservatory_email_codes").insert({
    email,
    code_hash: await sha256(code),
    expires_at: expires,
  });
  if (insertError) return json({ error: insertError.message }, 500);

  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM");
  if (!key || !from) return json({ error: "Mail is not configured on the server." }, 500);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${code} is your Artium verification code`,
      text: [
        `${code} is your Artium verification code.`,
        ``,
        `Enter it on the signup page to confirm this address belongs to your conservatory.`,
        `It expires in ${CODE_TTL_MINUTES} minutes.`,
        ``,
        `If you didn't ask for this, you can ignore this email — no account has been created.`,
      ].join("\n"),
    }),
  });

  if (!res.ok) {
    // Say that sending failed rather than that the code was sent. The row
    // stays: it costs nothing, it expires on its own, and deleting it here
    // would be a second thing to get wrong on a path that is already failing.
    const detail = await res.text().catch(() => "");
    console.error("resend failed", res.status, detail);
    return json({ error: "Could not send the email. Please try again." }, 502);
  }

  return json({ ok: true });
});
