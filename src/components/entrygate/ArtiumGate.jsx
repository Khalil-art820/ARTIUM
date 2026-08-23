import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import paths from "./paths.json";
import "./artium-gate.css";

const STAGE_W = 840;
const STAGE_H = 846;

/* =========================================================
   Spotlight tour — the entry gate's one and only introduction (the
   choreographed "reveal" that hid/animated cards in was tried and
   retired in favor of this). It never hides anything: the gate always
   renders in its normal finished, fully-interactive state; the tour is
   just a dimmed overlay with a spotlight hole framing one element at a
   time on top of it.

   Activation (see useTourActivation below):
     - First-time visitors: plays automatically, gated by the
       artium_gate_tour_v1 localStorage flag, decided synchronously
       (lazy useState initializer — runs during render, before paint)
       so there is never a flash of the overlay mounting then vanishing.
     - `?intro=tour` in the URL: force-replays it regardless of the
       flag, for previewing/QA. Both paths mark the flag done on
       finish; the forced path doesn't need to, but it's harmless.

   Steps: 0 = medallion, 1..4 = cards 01..04 (TOUR_CAPTIONS index).
   The spotlight hole is the "huge box-shadow" trick: a transparent,
   fixed div sized to the target's rect (+14px pad, rounded to match —
   ellipse for the medallion, ~28px for cards) whose
   `box-shadow: 0 0 0 9999px rgba(35,42,59,.45)` paints the dim
   everywhere BUT that div, i.e. the hole. Position/size are recomputed
   from getBoundingClientRect on every step change and on resize/scroll
   (rects are viewport-relative, matching this fixed-position overlay,
   and already reflect the stage's own scale() transform — no extra
   math needed for the mobile scaled stage).
========================================================= */
const TOUR_SEEN_KEY = "artium_gate_tour_v1";
const TOUR_CAPTIONS = [
  "The heart of Artium — conservatory students & graduates.",
  "Find inspiring teachers.",
  "Hire a concert pianist.",
  "Classical news & events.",
  "Tomorrow's composers.",
];
const TOUR_STEP_COUNT = TOUR_CAPTIONS.length;
const TOUR_PAD = 14;
const TOUR_GAP = 16;
const TOUR_CARD_W = 300;
const TOUR_CARD_H_ESTIMATE = 150;
// Auto-play (first visit) waits longer before dimming than a deliberate
// ?intro=tour replay, so the whole gate is seen once, unframed, first.
const TOUR_DELAY_AUTO = 800;
const TOUR_DELAY_FORCED = 400;

function useTourActivation() {
  const forced = (() => {
    try { return new URLSearchParams(window.location.search).get("intro") === "tour"; } catch { return false; }
  })();
  // Lazy initializer runs synchronously during the initial render (before
  // the browser paints), same pre-paint guarantee the old reveal used —
  // no flash for repeat visitors, and no missed auto-play for new ones.
  const [active] = useState(() => {
    if (forced) return true;
    try { return localStorage.getItem(TOUR_SEEN_KEY) !== "1"; } catch { return false; }
  });
  const markSeen = useCallback(() => {
    try { localStorage.setItem(TOUR_SEEN_KEY, "1"); } catch { /* private mode etc. */ }
  }, []);
  return { active, delay: forced ? TOUR_DELAY_FORCED : TOUR_DELAY_AUTO, markSeen };
}

function useSpotlightTour(active, delayMs, onEnd, medallionRef, cardRefs) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [spot, setSpot] = useState(null); // {top,left,width,height,radius}
  const nextBtnRef = useRef(null);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    try { reduceMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { reduceMotionRef.current = false; }
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [active, delayMs]);

  const targetEl = useCallback(
    (i) => (i === 0 ? medallionRef.current : cardRefs.current[i - 1]),
    [medallionRef, cardRefs]
  );

  const recompute = useCallback(() => {
    const el = targetEl(step);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSpot({
      top: r.top - TOUR_PAD,
      left: r.left - TOUR_PAD,
      width: r.width + TOUR_PAD * 2,
      height: r.height + TOUR_PAD * 2,
      radius: step === 0 ? "50%" : "28px",
    });
  }, [step, targetEl]);

  // Scroll the target into view, then track it (scroll/resize) while this
  // step is showing; re-measure a few times as the smooth scroll settles.
  useEffect(() => {
    if (!active || !visible) return;
    const el = targetEl(step);
    if (el) {
      try {
        el.scrollIntoView({ block: "center", behavior: reduceMotionRef.current ? "auto" : "smooth" });
      } catch { /* older Safari without options support still scrolls */ }
    }
    recompute();
    const ticks = [50, 150, 300, 450, 650].map((ms) => setTimeout(recompute, ms));
    window.addEventListener("scroll", recompute, { passive: true });
    window.addEventListener("resize", recompute);
    if (nextBtnRef.current) nextBtnRef.current.focus();
    return () => {
      ticks.forEach(clearTimeout);
      window.removeEventListener("scroll", recompute);
      window.removeEventListener("resize", recompute);
    };
  }, [active, visible, step, recompute, targetEl]);

  const end = useCallback(() => { setVisible(false); onEnd && onEnd(); }, [onEnd]);
  const next = useCallback(() => {
    setStep((s) => {
      if (s >= TOUR_STEP_COUNT - 1) { end(); return s; }
      return s + 1;
    });
  }, [end]);

  useEffect(() => {
    if (!active || !visible) return;
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); end(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, visible, end]);

  const caption = TOUR_CAPTIONS[step];
  const isLast = step === TOUR_STEP_COUNT - 1;
  const reduceMotion = reduceMotionRef.current;

  return { visible, step, spot, caption, isLast, next, skip: end, nextBtnRef, reduceMotion };
}

/* The client's decision: mobile shows the exact desktop composition (the
   840x846 carved stage — 4 silhouette cards + medallion + rings + diamond)
   scaled down as one unit, not the handoff's plain-card responsive fallback.
   The scaler measures its own content-box width (already net of .page's
   padding since it's a plain block child) and scales the stage uniformly;
   the wrapper's height is pinned to the scaled stage height so nothing
   below it gaps. No CSS calc() unit-division — older iOS Safari can't do
   it — the ratio is computed in JS on resize. */
function useStageScale(ref) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const recompute = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(Math.min(1, w / STAGE_W));
    };
    recompute();
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(recompute);
      ro.observe(el);
    }
    window.addEventListener("resize", recompute);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [ref]);
  return scale;
}

/* =========================================================
   Artium entry gate — ported 1:1 from the client's approved
   reference (artium-handoff/artium-landing.html + DESIGN_SPEC.md).
   Card silhouettes are the pre-generated SVG paths from
   paths.json (plate/platekey/panel/panelkey per card) — never
   replace these with CSS mask/clip-path/border-radius, that
   breaks the border continuity and kills the carved shadows
   (see tools/generate_card_paths.py + DESIGN_SPEC.md §4).

   Wiring is state-based (this app has no router):
     card 1 "Find a Teacher"            -> onLearner
     card 2 "Find a Concert Pianist"    -> onPianist
     card 3 "News | Classical Music..." -> onNews (TODO: no route yet)
     card 4 "Tomorrow's Composers"      -> onComposers
     medallion arrow                    -> onStudent
     "Log in"                           -> onLogin
     header play puck                   -> onMusicToggle (reflects musicOn)
     header account puck                -> onLogin
   learnerProfile / learnerLoggedOut / studentLoggedIn are accepted
   for signature compatibility with the previous <ArtiumHero/> but
   are not yet used by this gate.
========================================================= */

const ARTIUM_INSTAGRAM = "https://www.instagram.com/aclassicaltone?igsh=MTZzdzk3bWo5OGdkbA==";

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
);

const GoldBallGradient = ({ id }) => (
  <radialGradient id={id} cx="35%" cy="30%" r="80%">
    <stop offset="0%" stopColor="#F2CE7E" />
    <stop offset="60%" stopColor="#C9962E" />
    <stop offset="100%" stopColor="#96690F" />
  </radialGradient>
);

const TeacherIcon = () => (
  <svg width="78" height="92" viewBox="0 0 86 100" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="34" cy="14" r="8" />
    <path d="M34 24v30M34 34l-14 12M34 30l22-14M56 16l14-8M70 8l4 2" />
    <path d="M34 54l-11 34M34 54l11 34" />
  </svg>
);

const PianistIcon = () => (
  <svg width="92" height="86" viewBox="0 0 104 96" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 62V40c0-4 2-8 6-10l40-20c6-3 14 0 18 6 3 5 3 12-1 16l-9 9v21" />
    <path d="M18 62h54M18 70h54M18 62v8M72 62v8" />
    <path d="M24 70v16M40 70v16M56 70v16M70 70v16" />
    <path d="M30 70v9M36 70v9M46 70v9M52 70v9M62 70v9" />
  </svg>
);

const NewsIcon = () => (
  <svg width="82" height="88" viewBox="0 0 92 96" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="12" y="16" width="68" height="66" rx="10" />
    <path d="M12 34h68M30 8v14M62 8v14" />
    <path d="M52 66V46l12-3v18" />
    <circle cx="47" cy="66" r="5" />
    <circle cx="59" cy="61" r="5" />
  </svg>
);

const ComposerIcon = () => (
  <svg width="78" height="88" viewBox="0 0 86 100" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M36 14c8-8 22-6 26 2 3 6 1 12-3 15 3 2 4 6 2 10-1 3-4 5-7 5 1 3 0 7-3 9-3 3-8 3-11 1" />
    <path d="M36 14c-6 3-9 9-9 15 0 4 1 7 3 10-2 4-2 9 1 13 2 3 5 5 9 5v14c0 6-4 10-10 10" />
    <path d="M40 40c2 1 5 1 7 0M42 50c1 1 3 1 4 0" />
  </svg>
);

const CARDS = [
  {
    id: 1,
    numSide: "left",
    title: "Find a Teacher",
    text: "Discover and connect with top conservatory musicians and inspiring teachers.",
    Icon: TeacherIcon,
    ariaLabel: "Find a teacher",
    propKey: "onLearner",
  },
  {
    id: 2,
    numSide: "right",
    title: (
      <>
        Find a Concert
        <br />
        Pianist
      </>
    ),
    text: "Hire talented conservatory pianists for your concert, event or project.",
    Icon: PianistIcon,
    ariaLabel: "Find a concert pianist",
    propKey: "onPianist",
  },
  {
    id: 3,
    numSide: "left",
    title: (
      <>
        News | Classical
        <br />
        Music Events
      </>
    ),
    text: "Stay updated with concerts, festivals, competitions and classical music news around the world.",
    Icon: NewsIcon,
    ariaLabel: "See news and events",
    propKey: "onNews",
  },
  {
    id: 4,
    numSide: "right",
    title: (
      <>
        Tomorrow's
        <br />
        Composers
      </>
    ),
    text: "A space where today's living composers post and share their newest works.",
    Icon: ComposerIcon,
    ariaLabel: "Discover tomorrow's composers",
    propKey: "onComposers",
  },
];

function FeatureCard({ card, onActivate, rootRef }) {
  const { id, numSide, title, text, Icon, ariaLabel } = card;
  const numStr = String(id).padStart(2, "0");
  const gp = `gp${id}`, gn = `gn${id}`, sh = `sh${id}`, gr = `gr${id}`;
  const activate = (e) => { e.preventDefault(); onActivate && onActivate(); };
  return (
    <article
      ref={rootRef}
      className="feature"
      role="link"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={activate}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") activate(e); }}
    >
      <svg className="cardsvg" viewBox="0 0 260 412" aria-hidden="true">
        <defs>
          {/* Card surface now matches the page ground (--bg #FDFAF5)
              exactly, per the client's follow-up — flat stops, same
              gradient element/id so the rest of the layer stack (keylines,
              groove filter, shade overlay, drop-shadows) is untouched. */}
          <linearGradient id={gp} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="412">
            <stop offset="0" stopColor="#FDFAF5" /><stop offset="1" stopColor="#FDFAF5" />
          </linearGradient>
          <linearGradient id={gn} gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="402">
            <stop offset="0" stopColor="#FDFAF5" /><stop offset="1" stopColor="#FDFAF5" />
          </linearGradient>
          <linearGradient id={sh} gradientUnits="userSpaceOnUse" x1="0" y1="240" x2="0" y2="402">
            <stop offset="0" stopColor="rgba(176,146,98,0)" /><stop offset="1" stopColor="rgba(176,146,98,.16)" />
          </linearGradient>
          <filter id={gr} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.6" stdDeviation="1.3" floodColor="rgba(150,110,50,.45)" />
          </filter>
        </defs>
        <path d={paths[`plate${id}`]} fill={`url(#${gp})`} stroke="rgba(176,146,98,.35)" strokeWidth="1" />
        <path d={paths[`platekey${id}`]} fill="none" stroke="rgba(255,255,255,.92)" strokeWidth="1.7" />
        <path d={paths[`panel${id}`]} fill={`url(#${gn})`} stroke="rgba(255,255,255,.75)" strokeWidth="1" filter={`url(#${gr})`} />
        <path d={paths[`panel${id}`]} fill={`url(#${sh})`} />
        <path d={paths[`panelkey${id}`]} fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="1.5" />
      </svg>
      <div className={`content ${numSide === "left" ? "nl" : "nr"}`}>
        <div className="num puck">{numStr}</div>
        <div className="art"><Icon /></div>
        <h3>{title}</h3>
        <div className="rule" />
        <p>{text}</p>
        <span className="sp" />
        <button
          className="go puck"
          aria-label={ariaLabel}
          onClick={(e) => { e.stopPropagation(); activate(e); }}
        >
          <Arrow />
        </button>
      </div>
    </article>
  );
}

export default function ArtiumGate({
  onLearner,
  onStudent,
  onPianist,
  onLogin,
  onComposers,
  onNews,
  learnerProfile,
  learnerLoggedOut,
  studentLoggedIn,
  musicOn,
  onMusicToggle,
  memberCount,
}) {
  // The app around this page is dark (index.css pins html/body/#root to
  // #0F1012); own both html and body while mounted so iOS overscroll
  // rubber-banding past the top/bottom edge shows this page's cream
  // instead of the app's dark theme or a mismatched white — same idea as
  // the old ArtiumHero, extended to html since some browsers paint the
  // overscroll fill from the root element instead of body.
  React.useEffect(() => {
    const prevBody = document.body.style.backgroundColor;
    const prevHtml = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = "#FDFAF5";
    document.documentElement.style.backgroundColor = "#FDFAF5";
    return () => {
      document.body.style.backgroundColor = prevBody;
      document.documentElement.style.backgroundColor = prevHtml;
    };
  }, []);

  const stageScalerRef = useRef(null);
  const scale = useStageScale(stageScalerRef);

  // The gate's one introduction: plays automatically on a first visit
  // (artium_gate_tour_v1 flag) or on demand via ?intro=tour. The gate
  // itself always renders finished/interactive — see useTourActivation
  // and useSpotlightTour above.
  const { active: tourActive, delay: tourDelay, markSeen: tourMarkSeen } = useTourActivation();
  const medallionRef = useRef(null);
  const cardRefs = useRef([]);
  const tour = useSpotlightTour(tourActive, tourDelay, tourMarkSeen, medallionRef, cardRefs);

  const handlers = {
    onLearner,
    onPianist,
    onComposers,
    // TODO: no "news / classical music events" route exists yet in App.jsx.
    // Wire this to the real screen once it's built; for now it's a no-op
    // unless the caller passes onNews explicitly.
    onNews: onNews || (() => {}),
  };
  const count = memberCount ?? 40;
  const activateStudent = (e) => { e.preventDefault(); onStudent && onStudent(); };

  return (
    <div className="agate">
      <div className="page">
        {/* ================= HEADER ================= */}
        <header>
          <div className="brand">
            <span className="wordmark">artium</span>
          </div>
          <div className="head-actions">
            {onMusicToggle && (
              <button
                className={`puck${musicOn ? " is-on" : ""}`}
                aria-label={musicOn ? "Pause ambient music" : "Play ambient music"}
                aria-pressed={!!musicOn}
                onClick={onMusicToggle}
              >
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
              </button>
            )}
            <button className="puck" aria-label="Account">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5" /></svg>
            </button>
            <span className="head-count">{count}</span>
          </div>
        </header>

        {/* ================= HERO ================= */}
        <section className="hero">
          <div className="eyebrow">Welcome to Artium</div>
          <h1>Your Classical<br />Music World</h1>
          <div className="tagline">Connect. Learn. Elevate.</div>
        </section>

        {/* ================= STAGE ================= */}
        {/* The client wants the exact desktop composition on mobile too —
            the stage keeps its 840x846 desktop DOM/CSS at every width and
            is scaled down as one unit (see useStageScale above), never
            swapped for a plain-card responsive layout. */}
        <div
          className="stage-scaler"
          ref={stageScalerRef}
          style={{ height: STAGE_H * scale }}
        >
          {/* Origin top LEFT, not center: when the 840px stage overflows the
    scaler, auto margins clamp to 0 (they never go negative), so a
    center origin shoves the scaled box right by 420·(1−s). From the
    left origin the scaled width is exactly the scaler width (s = w/840),
    which centers it by construction; at s=1 the auto margins center. */}
<div className="stage" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <div className="diamond">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7 0l1.8 5.2L14 7l-5.2 1.8L7 14 5.2 8.8 0 7l5.2-1.8z" /></svg>
          </div>

          <div className="rings">
            <svg width="700" height="700" viewBox="0 0 700 700" fill="none">
              <circle cx="350" cy="350" r="240" stroke="rgba(198,149,47,.30)" strokeWidth="1" />
              <circle cx="350" cy="350" r="291" stroke="rgba(198,149,47,.38)" strokeWidth="1" />
              {/* Vertical axis only — the horizontal hairline read as a wire
    strung between cards 01 and 02, so it's gone. */}
<path d="M350 20V680" stroke="rgba(198,149,47,.25)" strokeWidth="1" />
              <path d="M148 233L552 467 M148 467L552 233" stroke="rgba(198,149,47,.14)" strokeWidth="1" />
              <circle cx="350" cy="59" r="6.5" fill="url(#agate-gball)" />
              <circle cx="350" cy="641" r="6.5" fill="url(#agate-gball)" />
              <defs>
                <GoldBallGradient id="agate-gball" />
              </defs>
            </svg>
          </div>

          <div className="grid">
            {CARDS.map((card) => (
              <FeatureCard
                key={card.id}
                card={card}
                onActivate={handlers[card.propKey]}
                rootRef={(el) => { cardRefs.current[card.id - 1] = el; }}
              />
            ))}

            {/* MEDALLION */}
            <div
              ref={medallionRef}
              className="oval-slab"
              role="link"
              tabIndex={0}
              aria-label="Conservatory Students | Graduates"
              onClick={activateStudent}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") activateStudent(e); }}
            >
              <span className="oring" />
              <span className="ball l" />
              <span className="ball r" />

              <div className="cap">
                <svg width="42" height="31" viewBox="0 0 46 34" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 3L2 12l21 9 21-9z" />
                  <path d="M11 16v8c0 3 5.4 6 12 6s12-3 12-6v-8" />
                  <path d="M43 12v10" />
                </svg>
              </div>
              <h2>Conservatory Students<br />| Graduates</h2>
              <div className="sub">The heart of tomorrow's music.</div>

              <div className="member">
                <div className="avatar">AD</div>
                <div className="who">
                  <div className="name">Amélie D.</div>
                  <div className="meta">Piano · Paris</div>
                </div>
                <span className="seal">
                  <svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1l2.4 2 3-.5 1 2.9 2.9 1-.5 3 2 2.4-2 2.4.5 3-2.9 1-1 2.9-3-.5L12 23l-2.4-2-3 .5-1-2.9-2.9-1 .5-3L1.2 12l2-2.4-.5-3 2.9-1 1-2.9 3 .5z" />
                    <path d="M8.2 12.3l2.5 2.5 5-5" stroke="#FFFEFC" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>

              <div className="member">
                <div className="avatar">LM</div>
                <div className="who">
                  <div className="name">Lucas M.</div>
                  <div className="meta">Violin · Vienna</div>
                </div>
                <span className="seal">
                  <svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1l2.4 2 3-.5 1 2.9 2.9 1-.5 3 2 2.4-2 2.4.5 3-2.9 1-1 2.9-3-.5L12 23l-2.4-2-3 .5-1-2.9-2.9-1 .5-3L1.2 12l2-2.4-.5-3 2.9-1 1-2.9 3 .5z" />
                    <path d="M8.2 12.3l2.5 2.5 5-5" stroke="#FFFEFC" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>

              <div className="join">Join, connect and grow within a trusted community.</div>
              <button
                className="go puck"
                aria-label="Join the community"
                onClick={(e) => { e.stopPropagation(); activateStudent(e); }}
              >
                <Arrow />
              </button>
            </div>
          </div>
          </div>
        </div>

        {/* ================= TRUST BAR ================= */}
        <section className="trust">
          <div className="cell">
            <div className="disc puck">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="8" r="3" /><path d="M3 19c1-3.2 3.2-4.8 6-4.8s5 1.6 6 4.8" /><circle cx="17" cy="7" r="2.4" /><path d="M15.5 12.7c2.6.1 4.5 1.5 5.3 4.3" /></svg>
            </div>
            <div>
              <h4>Trusted<br />Community</h4>
              <p>Verified conservatory students | musicians.</p>
            </div>
          </div>
          <div className="cell">
            <div className="disc puck">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 3v6c0 5-3.4 8.6-8 11-4.6-2.4-8-6-8-11V5z" /><path d="M8.6 12l2.3 2.3 4.5-4.6" /></svg>
            </div>
            <div>
              <h4>Safe |<br />Secure</h4>
              <p>Private, secure and reliable platform</p>
            </div>
          </div>
          <div className="cell">
            <div className="disc puck">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 20v-5M10 20v-9M15 20v-6M20 20V7" /></svg>
            </div>
            <div>
              <h4>Grow<br />Together</h4>
              <p>Opportunities, collaborations and real connections.</p>
            </div>
          </div>
        </section>

        {/* ================= LOGIN ================= */}
        <section className="login-zone">
          <div className="q">Already have an account?</div>
          <button className="btn-login" onClick={onLogin}>
            Log in
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15M13 6l6 6-6 6" /></svg>
          </button>
        </section>

        {/* ================= FOOTER ================= */}
        <footer>
          <div className="foot-top">
            <div className="partner">
              <span className="lbl">In partnership with</span>
              <span className="pname">aclassicaltone</span>
            </div>
            <div className="socials">
              <a className="puck" href={ARTIUM_INSTAGRAM} target="_blank" rel="noreferrer" aria-label="Instagram">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9962E" strokeWidth="1.8" strokeLinecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1" fill="#C9962E" stroke="none" /></svg>
              </a>
              <a className="puck" href="#" aria-label="Facebook">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#C9962E"><path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.3 0-1.1-.1-2-.1-2 0-3.4 1.2-3.4 3.5V11H8.5v3H11v7z" /></svg>
              </a>
            </div>
          </div>
          <div className="foot-bottom">
            <div className="foot-links">
              <a href="#">About Us</a><span className="dot">•</span>
              <a href="#">Help Center</a><span className="dot">•</span>
              <a href="#">Contact</a>
            </div>
            <div>© 2026 Artium. All rights reserved.</div>
          </div>
        </footer>
      </div>

      {/* ================= SPOTLIGHT TOUR =================
          The gate's one introduction: auto-plays for first-time visitors
          (artium_gate_tour_v1) or on demand via ?intro=tour. The gate
          underneath is already fully rendered/interactive; this overlay
          just frames it. */}
      {tourActive && tour.visible && tour.spot && (
        <div className="tour-overlay" role="dialog" aria-modal="true" aria-label="Guided tour">
          <div
            className={`tour-spot${tour.reduceMotion ? " no-anim" : ""}`}
            style={{
              top: tour.spot.top,
              left: tour.spot.left,
              width: tour.spot.width,
              height: tour.spot.height,
              borderRadius: tour.spot.radius,
            }}
          />
          <TourCard tour={tour} />
        </div>
      )}
    </div>
  );
}

/* Floating caption card: dots (1..5), caption text, Skip / Next-Done.
   Positioned below the spotlight by default, flipped above it when there
   isn't enough room underneath, and clamped horizontally to stay on
   screen. Recomputed on every step/spot change — no CSS transform tricks,
   since its own height is content-dependent. */
function TourCard({ tour }) {
  const { spot, step, caption, isLast, next, skip, nextBtnRef } = tour;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const cardW = Math.min(TOUR_CARD_W, vw - TOUR_GAP * 2);
  const centerX = spot.left + spot.width / 2;
  const rawLeft = centerX - cardW / 2;
  const left = Math.min(Math.max(rawLeft, TOUR_GAP), vw - cardW - TOUR_GAP);
  const spaceBelow = vh - (spot.top + spot.height);
  const placeBelow = spaceBelow > TOUR_CARD_H_ESTIMATE + TOUR_GAP;
  const posStyle = placeBelow
    ? { top: spot.top + spot.height + TOUR_GAP, left }
    : { bottom: vh - spot.top + TOUR_GAP, left };

  return (
    <div className="tour-card" style={{ ...posStyle, width: cardW }}>
      <div className="tour-dots">
        {Array.from({ length: TOUR_STEP_COUNT }).map((_, i) => (
          <span key={i} className={`tour-dot${i === step ? " is-active" : ""}`} />
        ))}
      </div>
      <p className="tour-caption">{caption}</p>
      <div className="tour-actions">
        <button type="button" className="tour-skip" onClick={skip}>Skip</button>
        <button type="button" className="tour-next" ref={nextBtnRef} onClick={next}>
          {isLast ? "Done" : "Next"}
        </button>
      </div>
    </div>
  );
}
