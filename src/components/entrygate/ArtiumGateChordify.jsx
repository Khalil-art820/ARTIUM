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

const ARTIUM_INSTAGRAM = "https://www.instagram.com/aclassicaltone?igsh=MTZzdzk3bWo5OGdkbA==";
const FONT_HREF = "https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600;700&display=swap";

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
        <ul className="cg-lang-menu" role="listbox" aria-label="Language">
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
        <span>{label}</span>
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
              // Verified member: gold tick on its own white plate, so it reads on any photo.
              <span className="cf-verified" title="Verified conservatory member" aria-label="Verified">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <defs>
                    <linearGradient id="cf-verified-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#F7D774" />
                      <stop offset="1" stopColor="#D9A21E" />
                    </linearGradient>
                  </defs>
                  <polygon points="12.00,1.00 14.41,3.02 17.50,2.47 18.58,5.42 21.53,6.50 20.98,9.59 23.00,12.00 20.98,14.41 21.53,17.50 18.58,18.58 17.50,21.53 14.41,20.98 12.00,23.00 9.59,20.98 6.50,21.53 5.42,18.58 2.47,17.50 3.02,14.41 1.00,12.00 3.02,9.59 2.47,6.50 5.42,5.42 6.50,2.47 9.59,3.02" fill="url(#cf-verified-grad)" stroke="url(#cf-verified-grad)" strokeWidth="1.2" strokeLinejoin="round" />
                  <path d="M7.6 12.3l3 3 5.8-6.2" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
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
  avatarPhotoUrl, avatarName, onAvatar, onLogout, memberChips, bellSlot, avatarNode, featuredMembers, legalSheet,
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
            <button type="button" className="cg-count" onClick={onAvatar} disabled={!onAvatar}
              title={onAvatar ? "My profile" : "Members"} aria-label={onAvatar ? `${count} members — open my profile` : `${count} members`}>
              {(memberChips || []).some((f) => f.photoUrl) ? (
                // Two overlapping member portraits and the count, as in every top bar.
                <span className="tm-hm">
                  <span className="tm-hm-faces" aria-hidden="true">
                    {memberChips.filter((f) => f.photoUrl).slice(0, 2).map((f, i) => <img key={i} src={f.photoUrl} alt="" />)}
                  </span>
                  <span className="tm-hm-n">+{count}</span>
                </span>
              ) : (<>
                {/* Step 3's "Connect worldwide" mark — three figures, the middle one larger. */}
                <svg width="31" height="31" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8.1" r="3.1" fill="currentColor" /><path d="M5.9 20.1a6.1 6.1 0 0 1 12.2 0z" fill="currentColor" />
                  <circle cx="4.6" cy="10.6" r="2.1" /><path d="M1.2 19.2a3.6 3.6 0 0 1 3.1-4.4" />
                  <circle cx="19.4" cy="10.6" r="2.1" /><path d="M22.8 19.2a3.6 3.6 0 0 0-3.1-4.4" />
                </svg>
                +{count}
              </>)}
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

        {/* Log out pill: door-and-arrow in a white pill, the word, and a
            chevron at the far end, all in red on a white-to-blush pill. */}
        <button type="button" className="cg-logout-pill" onClick={onLogout}>
          <span className="cg-lp-mid">
            <span className="cg-lp-ic" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H10" /><path d="M9.5 12H20" /><path d="M16.5 8.5 20 12l-3.5 3.5" />
              </svg>
            </span>
            <b>Log out</b>
          </span>
          <svg className="cg-lp-chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </button>

        <article className="cg-card cg-partners">
          <h3>Our partners</h3>
          <div className="cg-partner-row">
            <a href={ARTIUM_INSTAGRAM} target="_blank" rel="noreferrer" aria-label="aclassicaltone on Instagram">
              <img src="/partner-aclassicaltone-v2.png" alt="" width="44" height="44" />
              <span>aclassicaltone</span>
            </a>
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
