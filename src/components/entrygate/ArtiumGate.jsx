import React from "react";
import paths from "./paths.json";
import "./artium-gate.css";

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

function FeatureCard({ card, onActivate }) {
  const { id, numSide, title, text, Icon, ariaLabel } = card;
  const numStr = String(id).padStart(2, "0");
  const gp = `gp${id}`, gn = `gn${id}`, sh = `sh${id}`, gr = `gr${id}`;
  return (
    <article className="feature">
      <svg className="cardsvg" viewBox="0 0 260 412" aria-hidden="true">
        <defs>
          <linearGradient id={gp} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="412">
            <stop offset="0" stopColor="#FFFEFB" /><stop offset=".68" stopColor="#F8F2E6" /><stop offset="1" stopColor="#F0E7D4" />
          </linearGradient>
          <linearGradient id={gn} gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="402">
            <stop offset="0" stopColor="#FFFEFC" /><stop offset=".62" stopColor="#FBF6EB" /><stop offset="1" stopColor="#F5EDDC" />
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
        <button className="go puck" aria-label={ariaLabel} onClick={onActivate}>
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
  // The app around this page is dark; own the body while mounted so iOS
  // overscroll doesn't frame the page in black — same as the old ArtiumHero,
  // just restoring to this page's cream instead of white.
  React.useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#FDFAF5";
    return () => { document.body.style.backgroundColor = prev; };
  }, []);

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
        <div className="stage">
          <div className="diamond">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7 0l1.8 5.2L14 7l-5.2 1.8L7 14 5.2 8.8 0 7l5.2-1.8z" /></svg>
          </div>

          <div className="rings">
            <svg width="700" height="700" viewBox="0 0 700 700" fill="none">
              <circle cx="350" cy="350" r="240" stroke="rgba(198,149,47,.30)" strokeWidth="1" />
              <circle cx="350" cy="350" r="291" stroke="rgba(198,149,47,.38)" strokeWidth="1" />
              <path d="M350 20V680 M20 350H680" stroke="rgba(198,149,47,.25)" strokeWidth="1" />
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
              <FeatureCard key={card.id} card={card} onActivate={handlers[card.propKey]} />
            ))}

            {/* MEDALLION */}
            <div className="oval-slab">
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
              <button className="go puck" aria-label="Join the community" onClick={onStudent}>
                <Arrow />
              </button>
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
    </div>
  );
}
