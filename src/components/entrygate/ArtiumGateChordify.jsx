import React, { useRef } from "react";
import InlineWord from "../ArtiumWord";
import { CARDS, useTourActivation, useSpotlightTour, TourSpotlight, TourCard } from "./ArtiumGate";
import { installState } from "../../pwa.js";
import PartnerRequestSheet, { VacantPartnerTile } from "../PartnerRequest.jsx";
import ArtiumMenu, { LANGS, useLang } from "../ArtiumMenu.jsx";
import "./artium-gate-chordify.css";

// Alternative entry gate in Chordify's design language (flat, teal, one sans).
// Same props, copy and behaviour as ArtiumGate (reshape only); shares its
// spotlight-tour hooks/components and the card marks. Dev-only trial.

const ACLASSICALTONE_FACEBOOK = "https://www.facebook.com/profile.php?id=100094635454669";
const ARTIUM_INSTAGRAM = "https://www.instagram.com/aclassicaltone?igsh=MTZzdzk3bWo5OGdkbA==";
const FONT_HREF = "https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600;700&display=swap";

function accountInitials(name) {
  const t = (name || "").trim();
  if (!t) return "?";
  if (t.includes("@") && !t.includes(" ")) return t[0].toUpperCase();
  return t.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const Svg = ({ children, size = 22, fill = "none", sw = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={fill === "none" ? "currentColor" : "none"}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

// Footer language picker; the same choice as Settings in the menu.
function LanguagePicker() {
  const [lang, setLangShared] = useLang();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const off = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [open]);
  const pick = (k) => { setLangShared(k); setOpen(false); };
  const label = (LANGS.find(([k]) => k === lang) || LANGS[0])[1];
  return (
    <div className="cg-lang" ref={ref}>
      {open && (
        <ul className="cg-lang-menu" role="listbox" aria-label="Language" data-no-translate="">
          {LANGS.map(([k, name]) => (
            <li key={k} role="option" aria-selected={k === lang}>
              <button type="button" className={k === lang ? "is-on" : ""} onClick={() => pick(k)}>
                <span>{name}</span>
                {k === lang && <Svg size={18} sw={2.2}><path d="M5 12.5l4.2 4.2L19 7" /></Svg>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="cg-lang-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <Svg size={20} sw={1.7}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z" /></Svg>
        <span data-no-translate="">{label}</span>
        <Svg size={15} sw={2}><path d="M6 9l6 6 6-6" /></Svg>
      </button>
    </div>
  );
}

// Plain-text titles (the original's JSX titles break across two lines with
// <br/>; same words). Order/ids/icons/aria-labels come from ArtiumGate's CARDS.
// "Get the app" — Chordify's app banner, for the app as it exists today:
// installed straight from the website. Android/Chrome gets the browser's own
// install prompt; iPhone (no prompt there) and anything else get the steps.
// Shown inside the installed app too, at the owner's request.
function platformOf() {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}
function InstallAppBanner() {
  const [, bump] = React.useReducer((n) => n + 1, 0);
  const [help, setHelp] = React.useState(null); // null | "ios" | "android"
  React.useEffect(() => {
    window.addEventListener("artium-install-change", bump);
    return () => window.removeEventListener("artium-install-change", bump);
  }, []);
  const platform = platformOf();
  async function getApp(target) {
    const p = installState.prompt;
    if (target === "android" && platform === "android" && p) {
      try {
        p.prompt();
        await p.userChoice;
      } catch { /* prompt already used */ }
      installState.prompt = null;
      bump();
      return;
    }
    setHelp((h) => (h === target ? null : target));
  }
  // The visitor's own phone first, like Chordify leading with Android.
  const order = platform === "ios" ? ["ios", "android"] : ["android", "ios"];
  const label = { ios: "Get the iPhone app", android: "Get the Android app" };
  return (
    <section className="cg-app" aria-label="Get the Artium app">
      <div className="cg-app-in">
        <h2><ArtiumWord /><span className="cg-app-line">is one tap away</span></h2>
        <div className="cg-app-btns">
          {order.map((t) => (
            <button key={t} type="button" className="cg-app-btn" onClick={() => getApp(t)} aria-expanded={help === t}>{label[t]}</button>
          ))}
        </div>
        {help && (
          <p className="cg-app-help">
            {help === "ios" ? (
              platform === "ios"
                ? <>Tap the <strong>Share</strong> button <ShareGlyph />, then <strong>Add to Home Screen</strong>.</>
                : <>On your iPhone, open <strong>art-ium.com</strong>, tap <strong>Share</strong> <ShareGlyph />, then <strong>Add to Home Screen</strong>.</>
            ) : (
              platform === "android"
                ? <>Open your browser&rsquo;s menu <strong>&#8942;</strong>, then <strong>Install app</strong> or <strong>Add to Home screen</strong>.</>
                : <>On your Android phone, open <strong>art-ium.com</strong> in Chrome, then menu <strong>&#8942;</strong> &rarr; <strong>Install app</strong>.</>
            )}
          </p>
        )}
        <p className="cg-app-for"><ArtiumWord /><span className="cg-app-line">for iPhone and Android</span></p>
      </div>
    </section>
  );
}
// The top bar's wordmark, inline in running text.
const ArtiumWord = () => (
  <span className="cg-word cg-word-inline" role="img" aria-label="Artium">
    <svg className="cg-lambda" viewBox="0 0 15 15" aria-hidden="true">
      <path d="M7.5 0.9 L1.4 14.4 M7.5 0.9 L13.6 14.4" stroke="currentColor" strokeWidth="2.85" fill="none" />
    </svg>
    <span aria-hidden="true">RTIUM</span>
  </span>
);
const ShareGlyph = () => (
  <svg className="cg-app-share" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share">
    <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);

const TITLES = ["Find a Classical Music Teacher", "Find a Concert Musician", "News | Classical Music Events", "Tomorrow's Composers"];
const ACCENTS = ["#086868", "#6B57E8", "#E8862E", "#2EAA6E"];

const Seal = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill="#2EAA6E" />
    <path d="M7.4 12.3l3 3 6.2-6.3" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// The student card's art: four musician cards fanned like an editorial
// spread inside the lavender panel — the chosen one large and square-on with
// a champagne edge, one on each side tilted away, the fourth on the outer
// edge. Swipe, tap a side card or use the arrow keys to bring one forward.
// Photos: Piano, Violin, Cello, Voice ("Chorus member singing") and Trumpet
// ("Trumpet Player") are CC0 (Unsplash via Wikimedia Commons);
// Masters is Artium's own concert-hall conductor.
const FAN_CARDS = [
  { key: "violin", label: "Violin", photo: "/gate-cards/violin.webp", icon: "/instruments/violin.webp", pos: "50% 22%" },
  { key: "piano", label: "Piano", photo: "/gate-cards/piano.webp", icon: "/instruments/piano.webp", pos: "50% 50%" },
  { key: "cello", label: "Cello", photo: "/gate-cards/cello.webp", icon: "/instruments/cello.webp", pos: "50% 30%" },
  { key: "masters", label: "Masters", photo: "/gate-cards/masters.webp", icon: null, pos: "70% 30%" },
  { key: "voice", label: "Voice", photo: "/gate-cards/voice.webp", icon: "/instruments/voice.webp", pos: "45% 50%" },
  { key: "trumpet", label: "Trumpet", photo: "/gate-cards/trumpet.webp", icon: "/instruments/trumpet.webp", pos: "60% 50%" },
];
// Slot for each distance from the chosen card: x in card widths, tilt, size.
// Up to six: two on the left, the chosen one, three on the right.
const FAN_SLOTS = {
  "-2": { x: -0.74, r: -10, s: 0.66, z: 2 },
  "-1": { x: -0.46, r: -6, s: 0.84, z: 3 },
  "0": { x: 0, r: 0, s: 1.02, z: 5 },
  "1": { x: 0.46, r: 6, s: 0.84, z: 3 },
  "2": { x: 0.78, r: 10, s: 0.66, z: 2 },
  "3": { x: 0.98, r: 13, s: 0.52, z: 1 },
};
const FAN_MAX = 6;
// Centres the asymmetric spread in the panel (4 cards lean right; 6 a little).
const fanShift = (n) => (n >= 6 ? -0.11 : n === 5 ? -0.03 : -0.18);
// The owner's featured students come first (their photo, name and
// instrument); the instrument photos fill whatever is left of the four.
// Stock cards never carry a name — they aren't Artium members.
function fanCards(featured = []) {
  const people = featured.slice(0, FAN_MAX).map((m, i) => ({
    key: `m:${m.id || i}`, label: m.instrument, name: m.name, photo: m.photoUrl,
    icon: m.icon ? `/instruments/${m.icon}.webp` : null, pos: "50% 30%",
  }));
  // Fill with instruments not already on a featured card first.
  const shown = new Set(featured.map((m) => String(m.instrument || "").toLowerCase()));
  const stock = [...FAN_CARDS].sort((a, b) => shown.has(a.label.toLowerCase()) - shown.has(b.label.toLowerCase()));
  return [...people, ...stock.slice(0, Math.max(0, FAN_MAX - people.length))];
}
function CardFan({ active, onActive, cards = FAN_CARDS }) {
  const n = cards.length;
  const start = React.useRef(null);
  const go = (d) => onActive((active + d + n) % n);
  return (
    <div className="cf" role="group" aria-roledescription="carousel" aria-label="Instruments and degrees on Artium"
      tabIndex={0}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }}
      onPointerDown={(e) => { start.current = e.clientX; }}
      onPointerUp={(e) => {
        if (start.current == null) return;
        const dx = e.clientX - start.current; start.current = null;
        if (Math.abs(dx) > 30) go(dx < 0 ? 1 : -1);
      }}
      onPointerCancel={() => { start.current = null; }}>
      {cards.map((c, i) => {
        // Offset from the chosen card: -1..2 for four, -2..3 for six.
        const back = n >= 5 ? 2 : 1;
        const o = ((i - active + back + n) % n) - back;
        const slot = FAN_SLOTS[String(o)];
        const on = o === 0;
        return (
          <button key={c.key} type="button" className={`cf-card${on ? " is-on" : ""}${o > 0 ? " is-right" : ""}${Math.abs(o) > 1 ? " is-outer" : ""}`} tabIndex={-1}
            aria-label={c.name ? `${c.name}, ${c.label}` : c.label} aria-current={on || undefined}
            style={{
              transform: `translateX(${(slot.x + fanShift(n)) * 100}%) rotate(${slot.r}deg) scale(${slot.s})`,
              zIndex: slot.z,
            }}
            onClick={() => { if (!on) onActive(i); }}>
            <img className="cf-photo" src={c.photo} alt="" draggable={false} style={{ objectPosition: c.pos }} />
            {c.name && (
              // Verified member: the yellow badge on its own white plate, so it reads on any photo.
              <span className="cf-verified" title="Verified conservatory member" aria-label="Verified">
                {/* The app's verified badge: Instagram's scalloped shape, in yellow. */}
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12.00 2.60Q15.25 -0.12 16.70 3.86Q20.87 3.13 20.14 7.30Q24.12 8.75 21.40 12.00Q24.12 15.25 20.14 16.70Q20.87 20.87 16.70 20.14Q15.25 24.12 12.00 21.40Q8.75 24.12 7.30 20.14Q3.13 20.87 3.86 16.70Q-0.12 15.25 2.60 12.00Q-0.12 8.75 3.86 7.30Q3.13 3.13 7.30 3.86Q8.75 -0.12 12.00 2.60Z" fill="#F5B800" />
                  <path d="M7.7 12.2l2.9 2.9 5.8-5.9" fill="none" stroke="#FFFFFF" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
            <span className="cf-shade" aria-hidden="true" />
            {/* Caption band: the instrument mark in gold beside the name. */}
            <span className={`cf-cap cf-cap-row${c.name ? "" : " is-solo"}`}>
              {c.icon ? (
                // The instrument drawing as a mask filled in solid gold, so it
                // reads crisply at small sizes on any photo.
                <span className="cf-mark" aria-hidden="true" style={{ WebkitMaskImage: `url(${c.icon})`, maskImage: `url(${c.icon})` }} />
              ) : (
                <svg className="cf-mark cf-mark-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2.5 9.5 12 5l9.5 4.5L12 14z" /><path d="M6.5 11.5v4c1.6 1.4 3.4 2 5.5 2s3.9-.6 5.5-2v-4" /><path d="M21.5 9.5v5" />
                </svg>
              )}
              {c.name && <span className="cf-person">{on ? c.name : c.name.split(" ")[0]}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}



export default function ArtiumGateChordify({
  onLearner, onStudent, onPianist, onComposers, onNews,
  learnerProfile, studentLoggedIn, musicOn, onMusicToggle, memberCount,
  avatarPhotoUrl, avatarName, onAvatar, onLogout, memberChips, bellSlot, avatarNode, featuredMembers, legalSheet, connCount = 0,
}) {
  React.useEffect(() => {
    const id = "cgate-font";
    if (!document.getElementById(id)) {
      const l = document.createElement("link");
      l.id = id; l.rel = "stylesheet"; l.href = FONT_HREF;
      document.head.appendChild(l);
    }
    const pb = document.body.style.backgroundColor;
    const ph = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = "#F7F4F2";
    document.documentElement.style.backgroundColor = "#F7F4F2";
    return () => {
      document.body.style.backgroundColor = pb;
      document.documentElement.style.backgroundColor = ph;
    };
  }, []);

  // Same first-visit spotlight tour as the original (same flag, captions, rules).
  const { active: tourActive, delay: tourDelay, markSeen: tourMarkSeen } = useTourActivation();
  const tourAllowed = tourActive && !studentLoggedIn;
  const medallionRef = useRef(null);
  const cardRefs = useRef([]);
  const tour = useSpotlightTour(tourActive, tourDelay, tourMarkSeen, medallionRef, cardRefs);

  const handlers = { onLearner, onPianist, onComposers, onNews: onNews || (() => {}) };
  const count = memberCount ?? 40;
  const medallionOff = !!learnerProfile && !studentLoggedIn;
  const [partnerOpen, setPartnerOpen] = React.useState(false);
  const cards = React.useMemo(() => fanCards(featuredMembers || []), [featuredMembers]);
  const featuredCount = Math.min(4, (featuredMembers || []).length);
  // A featured student leads; with none chosen, Piano does.
  const [fanActive, setFanActive] = React.useState(featuredCount ? 0 : 1);
  React.useEffect(() => { setFanActive(featuredCount ? 0 : 1); }, [featuredCount]);
  const activateStudent = (e) => { if (e && e.preventDefault) e.preventDefault(); if (!medallionOff && onStudent) onStudent(); };

  return (
    <div className="cgate">
      <header className="cg-head">
        <div className="cg-head-in">
          <div className="cg-brand">
          {/* The menu leads the bar, before the wordmark (your profile is
              on the member counter now). */}
          <ArtiumMenu onProfile={onAvatar} onLogout={onLogout} legalSheet={legalSheet} />
          <div className="cg-word" aria-label="ARTIUM">
            {/* The house wordmark, kept from the original gate: Jost caps,
                wide tracking, and the crossbar-less A drawn as a glyph. */}
            <svg className="cg-lambda" viewBox="0 0 15 15" aria-hidden="true">
              <path d="M7.5 0.9 L1.4 14.4 M7.5 0.9 L13.6 14.4" stroke="currentColor" strokeWidth="2.85" fill="none" />
            </svg>
            <span aria-hidden="true">RTIUM</span>
          </div>
          </div>
          <div className="cg-actions">
            {/* The member counter is the way to your profile. */}
            {/* Your avatar and your number of connections; none, no pill. */}
            <button type="button" className="cg-count" onClick={onAvatar} disabled={!onAvatar}
              title={onAvatar ? "My profile" : "Your account"} aria-label={onAvatar ? `My profile — ${connCount || 0} connections` : "Your account"}>
              <span className="tm-hm">
                <span className="tm-hm-faces" aria-hidden="true">
                  {avatarPhotoUrl ? <img src={avatarPhotoUrl} alt="" /> : <span className="tm-hm-me">{accountInitials(avatarName)}</span>}
                </span>
                {connCount > 0 && <span className="tm-hm-n">+{connCount}</span>}
              </span>
            </button>
            {onMusicToggle && (
              <button type="button" className={`cg-icon cg-round${musicOn ? " is-on" : ""}`} onClick={onMusicToggle} aria-pressed={!!musicOn}
                aria-label={musicOn ? "Pause ambient music" : "Play ambient music"}>
                <svg className={`tm-wave${musicOn ? " is-playing" : ""}`} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  {[[3, 9], [7.5, 15], [12, 20], [16.5, 13], [21, 7]].map(([x, h], i) => (
                    <line key={i} x1={x} x2={x} y1={12 - h / 2} y2={12 + h / 2} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
                      style={{ animationDelay: `${i * 0.12}s` }} />
                  ))}
                </svg>
              </button>
            )}
            {bellSlot}
          </div>
        </div>
      </header>

      <section className="cg-hero">
        <div className="cg-hero-in">
          <h1>
            <span>Discover.</span>{" "}
            <span className="cg-accent">Connect.</span><br />
            <span>Elevate.</span>
          </h1>
          <p className="cg-sub">A trusted community for classical music students, teachers, artists and lovers.</p>
        </div>
      </section>

      <main className="cg-main">
        <article
          ref={medallionRef}
          className={`cg-card cg-student${medallionOff ? " cg-off" : ""}`}
          role="link"
          aria-disabled={medallionOff || undefined}
          tabIndex={medallionOff ? -1 : 0}
          aria-label="Join as a conservatory student or graduate"
          onClick={activateStudent}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") activateStudent(e); }}
        >
          <div className="cg-illo cg-illo-fan">
            <CardFan active={fanActive} onActive={setFanActive} cards={cards} />
          </div>
          <div className="cg-deck-dots cf-dots" aria-hidden="true">
            {cards.map((c, i) => <i key={c.key} className={i === fanActive ? "is-on" : undefined} />)}
          </div>
          <button type="button" className="cg-btn" aria-label="Join as a Conservatory Student or Graduate" disabled={medallionOff}
            onClick={(e) => { e.stopPropagation(); activateStudent(e); }}>
            Join as a Conservatory Student or Graduate
          </button>
        </article>

        <article className="cg-card cg-list">
          <h2>Explore <InlineWord /></h2>
          <ul>
            {CARDS.map((card, i) => {
              const off = studentLoggedIn && (card.id === 1 || card.id === 2);
              const Icon = card.Icon;
              return (
                <li key={card.id} className={off ? "cg-off" : undefined}>
                  <button type="button" className="cg-row" ref={(el) => { cardRefs.current[i] = el; }}
                    aria-label={card.ariaLabel} aria-disabled={off || undefined} disabled={off}
                    onClick={handlers[card.propKey]}>
                    <span className="cg-row-tile" style={{ color: ACCENTS[i] }}><Icon /></span>
                    <span className="cg-row-body">
                      <span className="cg-row-title">{TITLES[i]}</span>
                      <span className="cg-row-meta"><em className="cg-tag">{String(card.id).padStart(2, "0")}</em><span>{card.text}</span></span>
                    </span>
                    <Svg size={20}><path d="M9 5l7 7-7 7" /></Svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </article>

        <InstallAppBanner />

        <section className="cg-card cg-trust" aria-label="Why Artium">
          <div className="cg-trust-cell">
            <span className="cg-trust-ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3 19c1-3.2 3.2-4.8 6-4.8s5 1.6 6 4.8" /><circle cx="17" cy="7" r="2.4" /><path d="M15.5 12.7c2.6.1 4.5 1.5 5.3 4.3" /></svg></span>
            <span><h4>Trusted Community</h4><p>Verified conservatory students</p></span>
          </div>
          <div className="cg-trust-cell">
            <span className="cg-trust-ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.4 8.6-8 11-4.6-2.4-8-6-8-11V5z" /><path d="M8.6 12l2.3 2.3 4.5-4.6" /></svg></span>
            <span><h4>Safe | Secure</h4><p>Private, secure, reliable.</p></span>
          </div>
          <div className="cg-trust-cell">
            <span className="cg-trust-ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 20v-5M10 20v-9M15 20v-6M20 20V7" /></svg></span>
            <span><h4>Grow Together</h4><p>Opportunities and real connections.</p></span>
          </div>
        </section>


        <article className="cg-card cg-partners">
          <h3>Our partners</h3>
          <div className="cg-partner-row">
            {/* The partner itself isn't a link; its Instagram and Facebook are. */}
            <div className="cg-partner">
              <img src="/partner-aclassicaltone-v2.png" alt="" width="44" height="44" />
              <span>aclassicaltone</span>
              <span className="cg-partner-social">
                <a href={ARTIUM_INSTAGRAM} target="_blank" rel="noreferrer" aria-label="aclassicaltone on Instagram" className="is-ig">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" aria-hidden="true"><rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5.4" /><circle cx="12" cy="12" r="4.3" /><circle cx="17.4" cy="6.6" r="1.25" fill="currentColor" stroke="none" /></svg>
                </a>
                <a href={ACLASSICALTONE_FACEBOOK} target="_blank" rel="noreferrer" aria-label="aclassicaltone on Facebook" className="is-fb">
                  {/* A solid disc with the "f" cut out of it, like Facebook's own mark. */}
                  <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" fill="currentColor" d="M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21zm1.4 21v-7.6h2.5l.4-3h-2.9V10c0-.9.3-1.5 1.5-1.5h1.6V5.9c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.1H7.8v3h2.5v7.6z" /></svg>
                </a>
              </span>
            </div>
            <VacantPartnerTile onClick={() => setPartnerOpen(true)} />
            <VacantPartnerTile onClick={() => setPartnerOpen(true)} />
            <VacantPartnerTile onClick={() => setPartnerOpen(true)} />
          </div>
        </article>
        <PartnerRequestSheet open={partnerOpen} onClose={() => setPartnerOpen(false)} />
      </main>

      <footer className="cg-foot">
        <LanguagePicker />
        <div>© 2026 <InlineWord />. All rights reserved.</div>
      </footer>

      {tourAllowed && tour.visible && tour.spot && (
        <div className="tour-overlay" role="dialog" aria-modal="true" aria-label="Guided tour">
          <TourSpotlight tour={tour} shape="rect" radius={14} />
          <TourCard tour={tour} />
        </div>
      )}
    </div>
  );
}
