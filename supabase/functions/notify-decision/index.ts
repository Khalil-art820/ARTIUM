// Tell the applicant what was decided.
//
// Until now a decision was silent. Someone who sent a document or a domain
// request sat on "your application is under review" until they happened to
// open the site again — approved days earlier and never told, or rejected and
// still waiting for an answer that was never coming.
//
// Deploy:  supabase functions deploy notify-decision
// Uses the same RESEND_API_KEY and MAIL_FROM as send-conservatory-code.
//
// Note: no --no-verify-jwt here. Unlike the signup functions, the caller is an
// admin with a session, and the check below refuses anyone else.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userError } = await anonClient.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // This sends mail in Artium's name about somebody's application. Only an
  // admin may do that, and the check is here rather than in the caller —
  // anyone can call an edge function.
  const { data: caller } = await admin.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!caller?.is_admin) return json({ error: "Forbidden" }, 403);

  let verificationId = "", status = "", reason = "";
  try {
    const body = await req.json();
    verificationId = String(body?.verification_id ?? "").trim();
    status = String(body?.status ?? "").trim();
    reason = String(body?.reason ?? "").trim();
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }
  if (!verificationId || !["approved", "rejected"].includes(status)) {
    return json({ error: "verification_id and a status of approved or rejected are required." }, 400);
  }
  if (status === "rejected" && !reason) {
    return json({ error: "A rejection needs a reason — it is what the applicant is told." }, 400);
  }

  // Read the row here rather than trusting what was posted: the address the
  // mail goes to should come from the record, not from the request.
  const { data: row, error: rowError } = await admin
    .from("student_verifications")
    .select("id, name, personal_email, conservatory_name")
    .eq("id", verificationId)
    .maybeSingle();
  if (rowError) return json({ error: rowError.message }, 500);
  if (!row) return json({ error: "No such request." }, 404);
  if (!row.personal_email) return json({ error: "That request has no email address to write to." }, 400);

  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM");
  if (!key || !from) return json({ error: "Mail is not configured on the server." }, 500);

  const firstName = String(row.name || "").trim().split(/\s+/)[0] || "there";
  const school = String(row.conservatory_name || "").trim();

  const subject = status === "approved"
    ? "You're in — welcome to Artium"
    : "About your Artium application";

  // Where a reply goes.
  //
  // The From address sends and does not receive — Cloudflare Email Routing
  // only carries the addresses configured on it, and verify@ is not one. So a
  // rejection that ends "reply to this email if you'd like a hand" was an
  // invitation into a black hole, offered at exactly the moment someone has a
  // question. Set MAIL_REPLY_TO to an address that forwards to a real inbox.
  //
  // Unset, the offer is simply not made. Better to say nothing than to promise
  // an answer nobody will ever see.
  const replyTo = (Deno.env.get("MAIL_REPLY_TO") || "").trim();

  const lines = status === "approved"
    ? [
        `Hi ${firstName},`,
        ``,
        school
          ? `Your place at ${school} is confirmed. Your profile is live and your pin is on the map.`
          : `Your conservatory is confirmed. Your profile is live and your pin is on the map.`,
        ``,
        `Sign in and you'll find the rest of the network waiting — students at your own school and at every other conservatory on there.`,
      ]
    : [
        `Hi ${firstName},`,
        ``,
        `We weren't able to confirm your application this time.`,
        ``,
        reason,
        ``,
        replyTo
          ? `If that's something you can put right, you're welcome to apply again — just reply to this email if you'd like a hand.`
          : `If that's something you can put right, you're welcome to apply again.`,
      ];

  const text = lines.join("\n");
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a">${
    lines.map((l) => (l ? `<p style="margin:0 0 12px">${escapeHtml(l)}</p>` : "")).join("")
  }</div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [row.personal_email],
      subject,
      text,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("resend failed", res.status, detail);
    return json({ error: "The decision was saved, but the email could not be sent." }, 502);
  }

  // Stamped only on success, so a decision nobody was told about is visible
  // in the queue rather than indistinguishable from one that was.
  await admin.from("student_verifications")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", verificationId);

  return json({ ok: true });
});
