import React from "react";
import { supabase } from "../lib/supabase";

// "Your brand here" → a short lead form. Values mirror the checks on
// public.partner_requests (see 20261012000000_partner_requests.sql).
const CATEGORIES = [
  ["instruments", "Instruments & accessories"],
  ["education", "Music education"],
  ["venue_festival", "Venue or festival"],
  ["publishing", "Sheet music & publishing"],
  ["audio_recording", "Audio & recording"],
  ["travel_lifestyle", "Travel & lifestyle"],
  ["other", "Something else"],
];
const PLACEMENTS = [
  ["partner_logo", "Partner logo on Artium"],
  ["sponsored_spotlight", "Sponsored spotlight"],
  ["both", "Both"],
  ["not_sure", "Not sure yet"],
];
const BUDGETS = [
  ["under_500", "Under €500"],
  ["500_2000", "€500–2,000"],
  ["2000_5000", "€2,000–5,000"],
  ["over_5000", "€5,000+"],
  ["discuss", "Let's discuss"],
];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function Chips({ options, value, onChange, name }) {
  return (
    <div className="pr-chips" role="radiogroup" aria-label={name}>
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v}
          className={`pr-chip${value === v ? " is-on" : ""}`} onClick={() => onChange(value === v ? "" : v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function VacantPartnerTile({ onClick }) {
  return (
    <button type="button" className="pr-vacant" onClick={onClick} aria-label="Request a partner spot for your brand">
      <span className="pr-vacant-disc" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </span>
      <span className="pr-vacant-label">Your brand here</span>
    </button>
  );
}

export default function PartnerRequestSheet({ open, onClose }) {
  const [f, setF] = React.useState({ brand: "", contact_name: "", email: "", phone: "", website: "", category: "", offering: "", placement: "", budget: "", message: "", consent: false });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v && v.target ? (v.target.type === "checkbox" ? v.target.checked : v.target.value) : v }));

  // Prefill from the signed-in account; it's the person most likely asking.
  React.useEffect(() => {
    if (!open) return;
    let live = true;
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user;
      if (!live || !u) return;
      setF((p) => ({
        ...p,
        email: p.email || u.email || "",
        contact_name: p.contact_name || u.user_metadata?.full_name || u.user_metadata?.name || "",
      }));
    });
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { live = false; document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!open) return null;

  // The message sits by the Send button; bring it into view wherever the
  // reader is in the form.
  function revealErr() {
    setTimeout(() => document.querySelector(".pr-err")?.scrollIntoView({ block: "center", behavior: "smooth" }), 0);
  }

  function validate() {
    if (!f.brand.trim()) return "Please tell us your brand or company name.";
    if (!f.contact_name.trim()) return "Please add a contact name.";
    if (!EMAIL_RE.test(f.email.trim())) return "Please enter a valid email so we can reply.";
    if (!f.category) return "Please pick the category that fits you best.";
    if (!f.offering.trim()) return "Please say what you'd like to promote.";
    if (!f.placement) return "Please choose the placement you're interested in.";
    if (f.message.trim().length < 10) return "Please write a short message (at least 10 characters).";
    if (!f.consent) return "Please allow us to contact you about this request.";
    return "";
  }

  async function submit(e) {
    e.preventDefault();
    const v = validate();
    if (v) { setErr(v); revealErr(); return; }
    setErr(""); setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in to send a request.");
      const row = {
        user_id: user.id,
        brand: f.brand.trim().slice(0, 120),
        contact_name: f.contact_name.trim().slice(0, 120),
        email: f.email.trim().slice(0, 200),
        phone: f.phone.trim() ? f.phone.trim().slice(0, 40) : null,
        website: f.website.trim() ? f.website.trim().slice(0, 300) : null,
        category: f.category,
        offering: f.offering.trim().slice(0, 300),
        placement: f.placement,
        budget: f.budget || null,
        message: f.message.trim().slice(0, 2000),
        consent: true,
      };
      const { error } = await supabase.from("partner_requests").insert(row);
      if (error) throw new Error(/limit|several requests/i.test(error.message) ? "You've already sent several requests today — we'll be in touch soon." : "We couldn't send your request just now. Please try again in a moment.");
      setSent(true);
    } catch (e2) {
      setErr(e2.message);
      revealErr();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pr-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pr-sheet" role="dialog" aria-modal="true" aria-labelledby="pr-title">
        <button type="button" className="pr-close" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        {sent ? (
          <div className="pr-done">
            <span className="pr-done-tick" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </span>
            <h2 id="pr-title">Request received</h2>
            <p>Thank you, {f.contact_name.split(" ")[0] || "and welcome"}. The Artium team will review your request and reply to <strong>{f.email}</strong>.</p>
            <button type="button" className="pr-submit" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <p className="pr-kicker">Partnerships</p>
            <h2 id="pr-title">Partner with Artium</h2>
            <p className="pr-intro">Put your brand in front of conservatory students, teachers and music lovers around the world. Tell us a little about you and we'll get back to you by email.</p>

            <fieldset>
              <legend>About you</legend>
              <label>Brand or company<span>*</span><input value={f.brand} onChange={set("brand")} maxLength={120} autoComplete="organization" /></label>
              <label>Contact name<span>*</span><input value={f.contact_name} onChange={set("contact_name")} maxLength={120} autoComplete="name" /></label>
              <div className="pr-row">
                <label>Email<span>*</span><input type="email" value={f.email} onChange={set("email")} maxLength={200} autoComplete="email" inputMode="email" /></label>
                <label>Phone <em>(optional)</em><input type="tel" value={f.phone} onChange={set("phone")} maxLength={40} autoComplete="tel" /></label>
              </div>
              <label>Website or Instagram <em>(optional)</em><input value={f.website} onChange={set("website")} maxLength={300} placeholder="https://… or @yourbrand" /></label>
            </fieldset>

            <fieldset>
              <legend>Your campaign</legend>
              <p className="pr-q">Category<span>*</span></p>
              <Chips name="Category" options={CATEGORIES} value={f.category} onChange={set("category")} />
              <label>What would you like to promote?<span>*</span><input value={f.offering} onChange={set("offering")} maxLength={300} placeholder="e.g. a summer masterclass, a new piano line" /></label>
              <p className="pr-q">Placement<span>*</span></p>
              <Chips name="Placement" options={PLACEMENTS} value={f.placement} onChange={set("placement")} />
              <p className="pr-q">Budget <em>(optional)</em></p>
              <Chips name="Budget" options={BUDGETS} value={f.budget} onChange={set("budget")} />
            </fieldset>

            <fieldset>
              <legend>Message</legend>
              <label className="pr-sr">Message<textarea value={f.message} onChange={set("message")} maxLength={2000} rows={4} placeholder="Tell us about your goals, timing and audience." /></label>
              <p className="pr-count">{f.message.length}/2000</p>
              <label className="pr-consent"><input type="checkbox" checked={f.consent} onChange={set("consent")} /> Artium may contact me about this request.</label>
            </fieldset>

            {err && <p className="pr-err" role="alert">{err}</p>}
            <button type="submit" className="pr-submit" disabled={busy}>{busy ? "Sending…" : "Send request"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
