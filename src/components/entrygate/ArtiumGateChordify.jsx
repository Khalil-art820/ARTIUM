import React from "react";
import "./artium-gate-chordify.css";

// Alternative entry gate in Chordify's design language (flat, teal, one sans).
// Same props as ArtiumGate. Local design trial — not wired into App.jsx.

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

const KEYS = [
  { t: "Piano", check: true },
  { t: "Violin" },
  { t: "Masters", check: true },
  { t: "Cello" },
  { t: "Voice", check: true },
  { t: "Bachelor" },
  { t: "Flute" },
];

// Flat colour tiles with a white glyph, Chordify-fashion — photo crops of
// the existing assets read as near-blank at 56px.
const ROWS = [
  { key: "onLearner", bg: "#086868", title: "Find a classical music teacher", tag: "Lessons", text: "Top conservatory musicians",
    icon: <><circle cx="12" cy="7" r="3.2" /><path d="M5.5 20c1.2-3.6 3.6-5.4 6.5-5.4s5.3 1.8 6.5 5.4" /></> },
  { key: "onPianist", bg: "#6B57E8", title: "Hire a concert musician", tag: "Concerts", text: "For events and performances",
    icon: <><path d="M3 20h18" /><path d="M5 20V10l7-5 7 5v10" /><path d="M10 20v-5h4v5" /></> },
  { key: "onNews", bg: "#E8862E", title: "Classical news and events", tag: "News", text: "Concerts, competitions, news",
    icon: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></> },
  { key: "onComposers", bg: "#2EAA6E", title: "Tomorrow's composers", tag: "New music", text: "Living composers' newest works",
    icon: <><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></> },
];

export default function ArtiumGateChordify({
  onLearner, onStudent, onPianist, onComposers, onNews,
  learnerProfile, studentLoggedIn, musicOn, onMusicToggle, memberCount,
  avatarPhotoUrl, avatarName, onAvatar, onLogout, bellSlot, avatarNode,
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

  const handlers = { onLearner, onPianist, onComposers, onNews: onNews || (() => {}) };
  const count = memberCount ?? 40;
  const medallionOff = !!learnerProfile && !studentLoggedIn;
  const goStudent = () => { if (!medallionOff && onStudent) onStudent(); };

  return (
    <div className="cgate">
      <header className="cg-head">
        <div className="cg-head-in">
          <button type="button" className="cg-icon" aria-label="Explore" onClick={onLearner}>
            <Svg><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></Svg>
          </button>
          <div className="cg-word" aria-label="artium"><b>art</b>ium</div>
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
              {avatarNode || (avatarPhotoUrl ? <img src={avatarPhotoUrl} alt="" /> : <span>{accountInitials(avatarName)}</span>)}
            </button>
          </div>
        </div>
      </header>

      <div className="cg-promo">
        <div className="cg-promo-in">
          <span className="cg-promo-text">Classical music's home for students, teachers and audiences</span>
          <button type="button" className="cg-pill" onClick={goStudent} disabled={medallionOff}>Join the network</button>
          <span className="cg-rate">{count} musicians</span>
        </div>
      </div>

      <section className="cg-hero">
        <div className="cg-hero-in">
          <h1>Discover, connect and play classical music</h1>
          <button type="button" className="cg-search" onClick={onLearner} aria-label="Find a teacher">
            <span>Who are you looking for?</span>
            <span className="cg-search-go"><Svg size={24}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></Svg></span>
          </button>
        </div>
      </section>

      <main className="cg-main">
        <article className={`cg-card cg-student${medallionOff ? " cg-off" : ""}`} aria-disabled={medallionOff || undefined}>
          <div className="cg-illo" aria-hidden="true">
            {KEYS.map((k, i) => (
              <span key={k.t} className={`cg-key cg-key-${i}`}>
                {k.t}
                {k.check && <i className="cg-check"><svg viewBox="0 0 12 12" width="10" height="10"><path d="M2.5 6.3l2.3 2.3 4.7-5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></i>}
              </span>
            ))}
          </div>
          <h2>I am a conservatory student or graduate</h2>
          <p>Create your profile, put yourself on the map and meet musicians from conservatories around the world.</p>
          <button type="button" className="cg-btn" onClick={goStudent} disabled={medallionOff}>Join as a student</button>
        </article>

        <article className="cg-card cg-list">
          <h2>Explore Artium</h2>
          <ul>
            {ROWS.map((r, i) => {
              const off = studentLoggedIn && i < 2;
              return (
                <li key={r.key} className={off ? "cg-off" : undefined}>
                  <button type="button" className="cg-row" disabled={off} onClick={handlers[r.key]}>
                    <span className="cg-row-tile" style={{ background: r.bg }}><Svg size={26}>{r.icon}</Svg></span>
                    <span className="cg-row-body">
                      <span className="cg-row-title">{r.title}</span>
                      <span className="cg-row-meta"><em className="cg-tag">{r.tag}</em><span>{r.text}</span></span>
                    </span>
                    <Svg size={20}><path d="M9 5l7 7-7 7" /></Svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </article>

        <article className="cg-card cg-partners">
          <h3>Our partners</h3>
          <a href={ARTIUM_INSTAGRAM} target="_blank" rel="noreferrer" aria-label="aclassicaltone on Instagram">
            <img src="/partner-aclassicaltone.png" alt="" width="44" height="44" />
            <span>aclassicaltone</span>
          </a>
        </article>
      </main>

      <footer className="cg-foot">
        {onLogout && <button type="button" className="cg-link" onClick={onLogout}>Log out</button>}
        <div>© 2026 Artium. All rights reserved.</div>
      </footer>
    </div>
  );
}
