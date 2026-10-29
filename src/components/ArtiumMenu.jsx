import React from "react";
import "./ArtiumMenu.css";
import ArtiumMark from "./ArtiumMark.jsx";
import { setLanguage } from "../i18n/runtime.js"; // eslint-disable-line no-unused-vars

// The three-line menu every top bar opens: a side panel in Facebook's manner
// — white sheet over a dimmed page, a raised card at the top, rows with an
// outline icon and a chevron that open in place, and Log out at the foot.
// Your profile is reached from the member counter, not from here.

// The language the visitor picked (footer or Settings): the whole app follows
// it (src/i18n/runtime.js), and so do the legal documents. Each name is
// written in its own language, so the lists are never translated.
export const LANGS = [["de", "Deutsch"], ["en", "English"], ["es", "Español"], ["fr", "Français"], ["nl", "Nederlands"], ["it", "Italiano"], ["pt-BR", "Português do Brasil"], ["pl", "Polski"]];
export function readLang() {
  try { const v = localStorage.getItem("artium_lang"); if (LANGS.some(([k]) => k === v)) return v; } catch { /* private mode */ }
  // First visit: the browser's language when we have it, else English.
  try {
    for (const nav of navigator.languages || [navigator.language]) {
      const l = String(nav || "").toLowerCase();
      if (l.startsWith("pt")) return "pt-BR";
      const hit = LANGS.find(([k]) => l.split("-")[0] === k);
      if (hit) return hit[0];
    }
  } catch { /* old browser */ }
  return "en";
}
// A new language reloads the page: the refresh rule keeps you where you were,
// and every date, number and component comes back in the new language.
export function writeLang(k) {
  if (k === readLang()) return;
  try { localStorage.setItem("artium_lang", k); } catch { /* private mode */ }
  try { window.location.reload(); } catch { setLanguage(k); }
}
export function useLang() {
  const [lang, setLang] = React.useState(readLang);
  React.useEffect(() => {
    const on = () => setLang(readLang());
    window.addEventListener("artium-lang", on);
    return () => window.removeEventListener("artium-lang", on);
  }, []);
  return [lang, (k) => { writeLang(k); setLang(k); }];
}

const Svg = ({ children, size = 22, sw = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

function Settings({ onProfile, onLegal, close }) {
  const [lang, setLang] = useLang();
  return (
    <div className="am-settings">
      <p className="am-sub">Language</p>
      <div className="am-choices" role="radiogroup" aria-label="Language" data-no-translate="">
        {LANGS.map(([k, name]) => (
          <button key={k} type="button" role="radio" aria-checked={lang === k} className={lang === k ? "is-on" : ""} onClick={() => setLang(k)}>
            <span>{name}</span>
            {lang === k && <Svg size={18} sw={2.2}><path d="M5 12.5l4.2 4.2L19 7" /></Svg>}
          </button>
        ))}
      </div>
      {(onProfile || onLegal) && <p className="am-sub">Account &amp; policies</p>}
      {onProfile && (
        <button type="button" className="am-link" onClick={() => { close(); onProfile(); }}>
          <Svg size={20} sw={1.7}><circle cx="12" cy="8" r="3.6" /><path d="M4.8 20c.9-3.6 3.6-5.6 7.2-5.6s6.3 2 7.2 5.6" /></Svg>
          <span>Edit my profile</span>
        </button>
      )}
      {onLegal && (
        <>
          <button type="button" className="am-link" onClick={() => onLegal("terms")}>
            <Svg size={20} sw={1.7}><path d="M7 3.5h7.5L19 8v12.5H7z" /><path d="M14.5 3.5V8H19M9.8 12h6.4M9.8 15.5h6.4" /></Svg>
            <span>Terms &amp; Conditions</span>
          </button>
          <button type="button" className="am-link" onClick={() => onLegal("privacy")}>
            <Svg size={20} sw={1.7}><path d="M12 3l7.5 3v5.5c0 4.6-3.1 8-7.5 9.5-4.4-1.5-7.5-4.9-7.5-9.5V6z" /><rect x="9" y="10.5" width="6" height="5" rx="1" /><path d="M10.3 10.5V9a1.7 1.7 0 0 1 3.4 0v1.5" /></Svg>
            <span>Privacy Policy</span>
          </button>
        </>
      )}
    </div>
  );
}

const SECTIONS = [
  {
    k: "about", label: "About us",
    icon: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.2" /></>,
    body: () => (
      <>
        <p>Artium is a network for classical music. Conservatory students and graduates meet one another across schools and countries, music learners find a teacher, and anyone can book a musician for a concert or an event.</p>
        <p>Every student on Artium is verified with their conservatory, so the people you meet are who they say they are.</p>
      </>
    ),
  },
  {
    k: "help", label: "Help center",
    icon: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 16.9v.2" /></>,
    body: () => (
      <dl className="am-faq">
        <dt>How do I join?</dt>
        <dd>Tap “Join as a Conservatory Student or Graduate” on the home page, create your account, then verify your conservatory with your school email or a document. Documents are checked by our team.</dd>
        <dt>How do I edit my profile?</dt>
        <dd>Tap the member photos with the counter at the top of the page, or Settings → Edit my profile here.</dd>
        <dt>My application wasn't approved</dt>
        <dd>Sign in again: your answers are kept. Update what's needed, verify again and resubmit.</dd>
        <dt>Still stuck?</dt>
        <dd>Write to us from Support &amp; contact below.</dd>
      </dl>
    ),
  },
  {
    k: "contact", label: "Support & contact",
    icon: <><rect x="3" y="5.5" width="18" height="13" rx="2.2" /><path d="M3.8 7l8.2 6 8.2-6" /></>,
    body: () => (
      <>
        <p>A problem with your account, something not working, a question about a lesson or a booking, or a partnership idea: write to us and we'll get back to you.</p>
        <a className="am-btn" href="mailto:contact@art-ium.com">contact@art-ium.com</a>
      </>
    ),
  },
  {
    k: "settings", label: "Settings",
    icon: <><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.5 7.5 0 0 0-2.6-1.5L14 2.4h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4.9 2-3.4z" /></>,
    body: (p) => <Settings {...p} />,
  },
];

function Drawer({ onClose, onProfile, onLogout, onLegal }) {
  const [openK, setOpenK] = React.useState(null);
  React.useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="am-root" role="dialog" aria-modal="true" aria-label="Menu" onClick={onClose}>
      <nav className="am-panel" onClick={(e) => e.stopPropagation()}>
        <div className="am-card">
          <span className="am-mark" aria-hidden="true"><ArtiumMark size={44} /></span>
          <span className="am-name"><b data-no-translate="">ARTIUM</b><em>A world connected by music</em></span>
          <button type="button" className="am-x" onClick={onClose} aria-label="Close menu">
            <Svg size={20} sw={2.2}><path d="M6 6l12 12M18 6L6 18" /></Svg>
          </button>
        </div>
        <div className="am-list">
          {SECTIONS.map(({ k, label, icon, body }) => (
            <section key={k} className={`am-sec${openK === k ? " is-open" : ""}`}>
              <button type="button" className="am-row" aria-expanded={openK === k} onClick={() => setOpenK((o) => (o === k ? null : k))}>
                <Svg size={26} sw={1.7}>{icon}</Svg>
                <span>{label}</span>
                <Svg size={20} sw={2}><path d={openK === k ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></Svg>
              </button>
              {openK === k && <div className="am-body">{body({ onProfile, onLegal, close: onClose })}</div>}
            </section>
          ))}
        </div>
        {onLogout && (
          <button type="button" className="am-logout" onClick={() => { onClose(); onLogout(); }}>
            <Svg size={22} sw={1.9}><path d="M10 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H10" /><path d="M9.5 12H20" /><path d="M16.5 8.5 20 12l-3.5 3.5" /></Svg>
            <span>Log out</span>
          </button>
        )}
      </nav>
    </div>
  );
}

// The button that sits where the avatar used to, and the panel it opens.
// legalSheet: the app's TermsSheet component ({ doc, onClose }), passed in so
// this file doesn't depend on App.
export default function ArtiumMenu({ onProfile, onLogout, legalSheet: LegalSheet, className = "" }) {
  const [open, setOpen] = React.useState(false);
  const [legal, setLegal] = React.useState(null);
  const close = React.useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" className={`am-burger ${className}`} onClick={() => setOpen(true)} aria-label="Menu" aria-haspopup="dialog" aria-expanded={open}>
        <span /><span /><span />
      </button>
      {open && (
        <Drawer onClose={close} onProfile={onProfile} onLogout={onLogout}
          onLegal={LegalSheet ? (doc) => { setOpen(false); setLegal(doc); } : null} />
      )}
      {legal && LegalSheet && <LegalSheet doc={legal} onClose={() => setLegal(null)} />}
    </>
  );
}
