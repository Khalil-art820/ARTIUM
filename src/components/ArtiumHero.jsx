import React from "react";
import { Music2, Menu, UserRound, Users, ShieldCheck, BarChart3, Instagram, Facebook } from "lucide-react";
import "./artium-hero.css";

const GOLD = "#C79A43";

/* =========================================================
   The client's SVG hero, installed as supplied. Seams only:
   the app navigates by state, so every card and the login
   button take handlers; the pin placeholders carry the real
   Artium pin path; the header count is live; the glyph
   placeholders (♪ ☰ ♙ ♧ ◇ ▥) become the icon set the
   reference screenshot draws; the footer gains the social
   circles the screenshot shows. Geometry is iterated toward
   the reference per the client's render-compare instruction.
========================================================= */

const Arrow = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/** The real Artium pin — window punched by the path, not painted on. */
const Pin = ({ size = 44 }) => (
  <svg width={size * 0.7} height={size} viewBox="0 0 28 40">
    <path
      fillRule="evenodd"
      fill={GOLD}
      d="M14 0.9C6.82 0.9 1.4 6.28 1.4 13.2c0 3.35 1.3 6.36 3.2 9.36 1.6 2.53 3.63 5.02 5.53 7.62 1.35 1.85 2.6 3.72 3.28 5.98a.62.62 0 0 0 1.18 0c.68-2.26 1.93-4.13 3.28-5.98 1.9-2.6 3.93-5.09 5.53-7.62 1.9-3 3.2-6.01 3.2-9.36C26.6 6.28 21.18.9 14 .9zm0 7.68a5.04 5.04 0 1 0 0 10.08 5.04 5.04 0 0 0 0-10.08z"
    />
  </svg>
);

const Teacher = () => (
  <svg viewBox="0 0 64 64" className="art-icon">
    <circle cx="28" cy="14" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.7"/>
    <path d="M22 23c-4 5-5 12-4 20l-2 9M34 23c4 4 6 10 6 17v11M21 31l-10 7M34 31l13-11M45 20l3-1M45 20l1 4M23 52h-7M39 52h8"
      fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Graduate = () => (
  <svg viewBox="0 0 76 64" className="art-icon">
    <path d="M8 23 38 9l30 14-30 14L8 23Z" fill="none" stroke="currentColor" strokeWidth="2"/>
    <path d="M20 29v14c7 7 29 7 36 0V29M68 23v16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="68" cy="41" r="2" fill="currentColor"/>
  </svg>
);

const Piano = () => (
  <svg viewBox="0 0 76 64" className="art-icon">
    <path d="M12 48V18c0-4 3-7 7-7h12c7 0 12 5 12 12v25H12Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M12 39h31M21 39v9M30 39v9M39 39v9M43 23c6 0 12 4 17 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const Composer = () => (
  <svg viewBox="0 0 76 64" className="art-icon">
    <path d="M45 14c-8 0-14 6-14 14 0 6 4 11 9 13-3 4-8 7-14 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M31 16c-5 3-8 8-8 14 0 4 1 7 3 10M24 20c-5 3-7 8-7 13 0 4 2 8 5 11M42 14c7 2 11 8 11 15 0 8-5 14-12 17"
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const cards = [
  ["01","Find a Teacher",<>Discover and connect with top conservatory musicians and inspiring teachers.</>,Teacher,"tl"],
  ["02",<>I'm a<br/>Conservatory<br/>Student | Graduate</>,<>Learn, connect with peers, access resources, and grow in your musical journey.</>,Graduate,"tr"],
  ["03",<>Find a<br/>Concert Pianist</>,<>Hire talented conservatory pianists for your concert, event or project.</>,Piano,"bl"],
  ["04",<>The Wall of<br/>Composers</>,<>Explore the lives and legacies of the greatest composers in history.</>,Composer,"br"]
];

function PremiumCard({ data, onSelect }) {
  const [number,title,description,Icon,position] = data;
  const path = "M34 2H286Q306 2 306 22V286Q306 306 286 306H38Q10 306 10 278V32Q10 2 34 2Z";
  const activate = (e) => { e.preventDefault(); onSelect && onSelect(); };
  return (
    <div
      className={`art-card ${position}`}
      role="link"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") activate(e); }}
      style={{ cursor: "pointer" }}
    >
      <svg className="card-svg" viewBox="0 0 308 308" preserveAspectRatio="none">
        <defs>
          <filter id={`shadow-${position}`} x="-25%" y="-25%" width="150%" height="160%">
            <feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#8c6a2f" floodOpacity=".10"/>
          </filter>
          <linearGradient id={`rim-${position}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff"/>
            <stop offset=".4" stopColor="#e4d2aa"/>
            <stop offset=".55" stopColor="#fffdf8"/>
            <stop offset="1" stopColor="#d3c09a"/>
          </linearGradient>
        </defs>
        <path d={path} fill="#fff" filter={`url(#shadow-${position})`}/>
        <path d={path} fill={`url(#rim-${position})`} stroke="#d9c596" strokeWidth="1.2"/>
        <path d="M38 7H281Q300 7 300 27V279Q300 300 280 300H39Q17 300 17 278V31Q17 7 38 7Z"
          fill="none" stroke="#f4ead4" strokeWidth="3"/>
        <path d="M41 10H278Q297 10 297 29V276Q297 298 277 298H42Q20 298 20 276V33Q20 10 41 10Z"
          fill="#fffefa" stroke="#eee5d2" strokeWidth="1"/>
        <path d="M40 13H270Q287 13 293 27" fill="none" stroke="#fff" strokeWidth="2"/>
        <path d="M28 286Q32 296 45 296H272" fill="none" stroke="#d7c8a8" strokeWidth="1.3" opacity=".65"/>
      </svg>

      <div className="card-content">
        <div className="number">{number}</div>
        <Icon/>
        <h3>{title}</h3>
        <div className="divider"/>
        <p>{description}</p>
        <button className="arrow" aria-label={`Open ${number}`} onClick={activate}><Arrow/></button>
      </div>
    </div>
  );
}

function Orbit() {
  return (
    <svg className="orbit" viewBox="0 0 820 760" aria-hidden="true">
      <circle cx="410" cy="380" r="182" fill="none" stroke={GOLD} strokeWidth="1" opacity=".11"/>
      <circle cx="410" cy="380" r="245" fill="none" stroke={GOLD} strokeWidth="1" opacity=".075"/>
      <circle cx="410" cy="380" r="315" fill="none" stroke={GOLD} strokeWidth="1" opacity=".045"/>
      <path d="M410 38V722" stroke={GOLD} strokeWidth="1" opacity=".07"/>
      <path d="M80 380H740" stroke={GOLD} strokeWidth="1" opacity=".045"/>
      <circle cx="410" cy="115" r="3.5" fill={GOLD} opacity=".7"/>
      <circle cx="410" cy="645" r="3.5" fill={GOLD} opacity=".7"/>
    </svg>
  );
}

function Medallion() {
  return (
    <div className="medallion">
      <svg viewBox="0 0 180 180">
        <defs>
          <filter id="med-shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="7" stdDeviation="8" floodColor="#9b762d" floodOpacity=".13"/>
          </filter>
          <radialGradient id="med-face">
            <stop offset="0" stopColor="#fff"/>
            <stop offset=".8" stopColor="#fffdf9"/>
            <stop offset="1" stopColor="#f6f1e5"/>
          </radialGradient>
        </defs>
        <circle cx="90" cy="90" r="78" fill="#fff" filter="url(#med-shadow)"/>
        <circle cx="90" cy="90" r="77" fill="none" stroke="#d5bd88"/>
        <circle cx="90" cy="90" r="70" fill="none" stroke="#eee3cc" strokeWidth="2"/>
        <circle cx="90" cy="90" r="61" fill="url(#med-face)" stroke="#d9bd82"/>
        <circle cx="90" cy="90" r="53" fill="none" stroke="#efe3ca"/>
        {/* the real pin, path window and all, at the placeholder's spot */}
        <path
          fillRule="evenodd"
          fill={GOLD}
          transform="translate(76 51) scale(1.05)"
          d="M14 0.9C6.82 0.9 1.4 6.28 1.4 13.2c0 3.35 1.3 6.36 3.2 9.36 1.6 2.53 3.63 5.02 5.53 7.62 1.35 1.85 2.6 3.72 3.28 5.98a.62.62 0 0 0 1.18 0c.68-2.26 1.93-4.13 3.28-5.98 1.9-2.6 3.93-5.09 5.53-7.62 1.9-3 3.2-6.01 3.2-9.36C26.6 6.28 21.18.9 14 .9z"
        />
        <circle cx="90.7" cy="64.9" r="5.3" fill="#fff"/>
        <text x="90" y="126" textAnchor="middle" className="med-word">artium</text>
      </svg>
    </div>
  );
}

function Trust() {
  return (
    <section className="trust">
      <div><b><Users size={24} strokeWidth={1.5}/></b><h4>Trusted<br/>Community</h4><p>Verified conservatory students & musicians</p></div>
      <div><b><ShieldCheck size={24} strokeWidth={1.5}/></b><h4>Safe &<br/>Secure</h4><p>Private, secure and reliable platform</p></div>
      <div><b><BarChart3 size={24} strokeWidth={1.5}/></b><h4>Grow<br/>Together</h4><p>Opportunities, collaborations and real connections</p></div>
    </section>
  );
}

const ACT_INSTAGRAM = "https://www.instagram.com/aclassicaltone?igsh=MTZzdzk3bWo5OGdkbA==";

export default function ArtiumHero({ onLearner, onStudent, onPianist, onComposers, onLogin, memberCount, musicOn, onMusicToggle }) {
  // The app around this page is dark; own the body while mounted so iOS
  // overscroll doesn't frame the white page in black.
  React.useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#FFFFFF";
    return () => { document.body.style.backgroundColor = prev; };
  }, []);

  const actionFor = { "01": onLearner, "02": onStudent, "03": onPianist, "04": onComposers };

  return (
    <main className="artium-page">
      <header className="header">
        <div className="brand"><Pin/><span>artium</span></div>
        <div className="actions">
          {onMusicToggle && (
            <button aria-label={musicOn ? "Pause ambient music" : "Play ambient music"} aria-pressed={!!musicOn}
              onClick={onMusicToggle} style={musicOn ? { color: GOLD, borderColor: "#d9c596" } : undefined}>
              <Music2 size={22} strokeWidth={1.6}/>
            </button>
          )}
          <button aria-label="Menu"><Menu size={22} strokeWidth={1.6}/></button>
          <button className="user" aria-label="Members"><UserRound size={20} strokeWidth={1.6}/> <span>{memberCount ?? 40}</span></button>
        </div>
      </header>

      <section className="hero">
        <div className="kicker">WELCOME TO ARTIUM</div>
        <h1>Your Classical<br/>Music World</h1>
        <div className="subtitle">Connect. Learn. Elevate.</div>
        <div className="rule"><i/><b>◆</b><i/></div>

        <div className="stage">
          <Orbit/>
          {cards.map((c) => <PremiumCard key={c[0]} data={c} onSelect={actionFor[c[0]]}/>)}
          <Medallion/>
        </div>

        <Trust/>
        <div className="login">
          <p>Already have an account?</p>
          <button onClick={() => onLogin && onLogin()}>Log in <span>→</span></button>
        </div>
      </section>

      <footer className="footer">
        <span>In partnership with <strong>aclassicaltone</strong></span>
        <span className="footer-socials">
          <a href={ACT_INSTAGRAM} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={15} strokeWidth={1.6}/></a>
          <a href="#" aria-label="Facebook"><Facebook size={15} strokeWidth={1.6}/></a>
        </span>
        <span>About Us　•　Help Center　•　Contact</span>
        <span>© 2026 Artium. All rights reserved.</span>
      </footer>
    </main>
  );
}
