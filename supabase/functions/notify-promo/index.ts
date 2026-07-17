// Emails the Artium owner when a new "Promote Me" submission arrives.
//
// Required Supabase secrets:
//   RESEND_API_KEY  – API key from https://resend.com
// Optional secrets:
//   OWNER_EMAIL     – recipient (defaults to ktannous0@gmail.com)
//   NOTIFY_FROM     – verified sender, e.g. "Artium <promo@yourdomain.com>"
//                     (defaults to Resend's shared onboarding@resend.dev sandbox)
//
// The function never throws to the caller: if email isn't configured it just
// returns { ok:false } so a missing key can't block a student's submission.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { name, videoLink, provider, proposedDate, proposedTime, caption } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const OWNER_EMAIL = Deno.env.get("OWNER_EMAIL") || "ktannous0@gmail.com";
    const FROM = Deno.env.get("NOTIFY_FROM") || "Artium <onboarding@resend.dev>";

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ ok: false, reason: "RESEND_API_KEY not set" }), { headers: cors });
    }

    const when = [proposedDate, proposedTime].filter(Boolean).join(" · ");
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;color:#0A2540;line-height:1.6">
        <h2 style="margin:0 0 12px">New promotion request</h2>
        <p style="margin:0 0 4px"><b>Student:</b> ${escapeHtml(name || "Unknown")}</p>
        <p style="margin:0 0 4px"><b>Provider:</b> ${escapeHtml(provider || "-")}</p>
        <p style="margin:0 0 4px"><b>Proposed post:</b> ${escapeHtml(when || "-")}</p>
        <p style="margin:0 0 4px"><b>Caption:</b> ${escapeHtml(caption || "-")}</p>
        <p style="margin:12px 0 4px"><b>Video link:</b><br>
          <a href="${escapeAttr(videoLink || "#")}">${escapeHtml(videoLink || "-")}</a></p>
        <p style="margin:16px 0 0;color:#425466;font-size:13px">
          Open the Promote Me tab in Artium (signed in as the owner) to approve or reject.</p>
      </div>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [OWNER_EMAIL],
        subject: `New promotion request from ${name || "a student"}`,
        html,
      }),
    });
    const data = await r.json();
    return new Response(JSON.stringify({ ok: r.ok, data }), { headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { headers: cors });
  }
});

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function escapeAttr(s: string) {
  return String(s).replace(/["'<>]/g, "");
}
