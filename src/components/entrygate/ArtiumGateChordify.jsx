import React, { useRef } from "react";
import { CARDS, useTourActivation, useSpotlightTour, TourSpotlight, TourCard } from "./ArtiumGate";
import "./artium-gate-chordify.css";

// Alternative entry gate in Chordify's design language (flat, teal, one sans).
// Same props, copy and behaviour as ArtiumGate (reshape only); shares its
// spotlight-tour hooks/components and the card marks. Dev-only trial.

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

// Plain-text titles (the original's JSX titles break across two lines with
// <br/>; same words). Order/ids/icons/aria-labels come from ArtiumGate's CARDS.
const TITLES = ["Find a Classical Music Teacher", "Find a Concert Musician", "News | Classical Music Events", "Tomorrow's Composers"];
const ACCENTS = ["#086868", "#6B57E8", "#E8862E", "#2EAA6E"];

const Seal = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill="#2EAA6E" />
    <path d="M7.4 12.3l3 3 6.2-6.3" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CHIP_FALLBACKS = [
  { initials: "AD", name: "Amélie D.", meta: "Piano · Paris" },
  { initials: "LM", name: "Lucas M.", meta: "Violin · Vienna" },
];

const KEYS = [
  { t: "Piano", check: true },
  { t: "Violin" },
  { t: "Masters", check: true },
  { t: "Cello" },
  { t: "Voice", check: true },
  { t: "Bachelor" },
  { t: "Flute" },
];

export default function ArtiumGateChordify({
  onLearner, onStudent, onPianist, onComposers, onNews,
  learnerProfile, studentLoggedIn, musicOn, onMusicToggle, memberCount,
  avatarPhotoUrl, avatarName, onAvatar, onLogout, memberChips, bellSlot, avatarNode,
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
  const activateStudent = (e) => { if (e && e.preventDefault) e.preventDefault(); if (!medallionOff && onStudent) onStudent(); };

  return (
    <div className="cgate">
      <header className="cg-head">
        <div className="cg-head-in">
          <span className="cg-head-spacer" aria-hidden="true" />
          <div className="cg-word" aria-label="ARTIUM">
            {/* The house wordmark, kept from the original gate: Jost caps,
                wide tracking, and the crossbar-less A drawn as a glyph. */}
            <svg className="cg-lambda" viewBox="0 0 15 15" aria-hidden="true">
              <path d="M7.5 0.9 L1.4 14.4 M7.5 0.9 L13.6 14.4" stroke="currentColor" strokeWidth="2.85" fill="none" />
            </svg>
            <span aria-hidden="true">RTIUM</span>
          </div>
          <div className="cg-actions">
            <span className="cg-count" title="Members" aria-label={`${count} members`}>
              <Svg size={16}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5" /></Svg>
              {count}
            </span>
            {onMusicToggle && (
              <button type="button" className="cg-icon" onClick={onMusicToggle} aria-pressed={!!musicOn}
                aria-label={musicOn ? "Pause ambient music" : "Play ambient music"}>
                {musicOn ? <Svg size={18} sw={2.6}><path d="M9 5v14M15 5v14" /></Svg>
                  : <Svg size={18} fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></Svg>}
              </button>
            )}
            {bellSlot}
            <button type="button" className="cg-avatar" onClick={onAvatar} disabled={!onAvatar}
              title={avatarName || "Your account"} aria-label={avatarName ? `${avatarName} — your account` : "Your account"}>
              {avatarNode || (avatarPhotoUrl ? <img src={avatarPhotoUrl} alt="" /> : <span aria-hidden="true">{accountInitials(avatarName)}</span>)}
            </button>
          </div>
        </div>
      </header>

      <section className="cg-hero">
        <div className="cg-hero-in">
          <h1>
            <span>Discover.</span>{" "}
            <span className="cg-accent">Connect.</span>{" "}
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
          aria-label="I am a conservatory student or graduate"
          onClick={activateStudent}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") activateStudent(e); }}
        >
          <div className="cg-illo" aria-hidden="true">
            {KEYS.map((k, i) => (
              <span key={k.t} className={`cg-key cg-key-${i}`}>
                {k.t}
                {k.check && <i className="cg-check"><svg viewBox="0 0 12 12" width="10" height="10"><path d="M2.5 6.3l2.3 2.3 4.7-5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></i>}
              </span>
            ))}
          </div>
          <div className="cg-student-head">
            <h2>I am a Conservatory Student or Graduate</h2>
          </div>
          <div className="cg-chips">
            {CHIP_FALLBACKS.map((fb, i) => {
              const c = memberChips?.[i];
              return (
                <div className="cg-chip" key={fb.initials}>
                  <span className="cg-chip-av">{c?.photoUrl ? <img src={c.photoUrl} alt="" /> : fb.initials}</span>
                  <span className="cg-chip-who">
                    <span className="cg-chip-name">{c?.name || fb.name}</span>
                    <span className="cg-chip-meta">{c?.meta || fb.meta}</span>
                  </span>
                  <Seal />
                </div>
              );
            })}
          </div>
          <p>A verified community. Connect, collaborate, grow.</p>
          <button type="button" className="cg-btn" aria-label="Join as a student or graduate" disabled={medallionOff}
            onClick={(e) => { e.stopPropagation(); activateStudent(e); }}>
            Join as a student or graduate
          </button>
        </article>

        <article className="cg-card cg-list">
          <h2>Explore Artium</h2>
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

        <button type="button" className="cg-logout" onClick={onLogout}>
          Log out
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" /></svg>
        </button>

        <article className="cg-card cg-partners">
          <h3>Our partners</h3>
          <a href={ARTIUM_INSTAGRAM} target="_blank" rel="noreferrer" aria-label="aclassicaltone on Instagram">
            <img src="/partner-aclassicaltone.png" alt="" width="44" height="44" />
            <span>aclassicaltone</span>
          </a>
        </article>
      </main>

      <footer className="cg-foot">
        <div className="cg-foot-links">
          <a href="#">About Us</a><span aria-hidden="true">•</span>
          <a href="#">Help Center</a><span aria-hidden="true">•</span>
          <a href="#">Contact</a>
        </div>
        <div>© 2026 Artium. All rights reserved.</div>
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
