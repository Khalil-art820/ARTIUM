import React from "react";
import {
  Menu,
  UserRound,
  ArrowRight,
  Users,
  ShieldCheck,
  BarChart3,
  GraduationCap,
  Piano,
} from "lucide-react";

import "./artium-landing.css";

/* =========================================================
   The client's implementation, installed verbatim. Edits are
   integration only: the app navigates by state rather than
   URLs, so every href hands off to the existing handler; the
   clip-path pin placeholders carry the real Artium pin path
   (the same mark the whole app draws, window punched by
   evenodd rather than a white dot painted on top); the header
   count is live; login is the existing Supabase flow.
========================================================= */

const experiences = [
  {
    number: "01",
    title: "Find a Teacher",
    description:
      "Discover and connect with top conservatory musicians and inspiring teachers.",
    icon: "teacher",
    href: "/teachers",
    position: "top-left",
  },
  {
    number: "02",
    title: (
      <>
        I'm a Conservatory
        <br />
        Student | Graduate
      </>
    ),
    description:
      "Learn, connect with peers, access resources, and grow in your musical journey.",
    icon: "graduate",
    href: "/students",
    position: "top-right",
  },
  {
    number: "03",
    title: (
      <>
        Find a
        <br />
        Concert Pianist
      </>
    ),
    description:
      "Hire talented conservatory pianists for your concert, event or project.",
    icon: "piano",
    href: "/pianists",
    position: "bottom-left",
  },
  {
    number: "04",
    title: (
      <>
        The Wall of
        <br />
        Composers
      </>
    ),
    description:
      "Explore the lives and legacies of the greatest composers in history.",
    icon: "composer",
    href: "/composers",
    position: "bottom-right",
  },
];

/** The real Artium pin, at the CSS placeholder's exact footprint. */
function PinMark({ className }) {
  return (
    <svg viewBox="0 0 28 40" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        fill="currentColor"
        d="M14 0.9C6.82 0.9 1.4 6.28 1.4 13.2c0 3.35 1.3 6.36 3.2 9.36 1.6 2.53 3.63 5.02 5.53 7.62 1.35 1.85 2.6 3.72 3.28 5.98a.62.62 0 0 0 1.18 0c.68-2.26 1.93-4.13 3.28-5.98 1.9-2.6 3.93-5.09 5.53-7.62 1.9-3 3.2-6.01 3.2-9.36C26.6 6.28 21.18.9 14 .9zm0 7.68a5.04 5.04 0 1 0 0 10.08 5.04 5.04 0 0 0 0-10.08z"
      />
    </svg>
  );
}

function Logo() {
  return (
    <div className="artium-logo">
      <PinMark className="artium-logo-pin-svg" />
      <span>artium</span>
    </div>
  );
}

function TeacherIcon() {
  return (
    <svg viewBox="0 0 80 80" className="custom-icon">
      <circle cx="34" cy="18" r="8" />
      <path d="M27 28 C20 32 19 43 23 51" />
      <path d="M41 28 C48 32 49 42 45 51" />
      <path d="M24 36 L10 43" />
      <path d="M10 43 L7 39" />
      <path d="M10 43 L13 47" />
      <path d="M45 34 L66 17" />
      <path d="M66 17 L70 17" />
      <path d="M66 17 L65 21" />
      <path d="M28 50 L27 68" />
      <path d="M43 50 L45 68" />
      <path d="M27 68 L20 71" />
      <path d="M45 68 L52 71" />
    </svg>
  );
}

function ComposerIcon() {
  return (
    <svg viewBox="0 0 80 80" className="custom-icon composer-icon">
      <path d="M48 15 C60 13 68 21 66 32 C64 44 52 48 45 44" />
      <path d="M45 44 C42 50 37 54 32 55" />
      <path d="M32 55 C37 57 43 58 48 57" />
      <path d="M48 57 C54 55 58 51 61 46" />
      <path d="M36 22 C32 28 31 35 35 40" />
      <path d="M30 28 C27 34 28 40 33 44" />
      <path d="M24 40 C27 47 32 50 39 51" />
    </svg>
  );
}

function ExperienceIcon({ type }) {
  if (type === "teacher") return <TeacherIcon />;

  if (type === "graduate") {
    return (
      <GraduationCap
        className="lucide-experience-icon"
        strokeWidth={1.35}
      />
    );
  }

  if (type === "piano") {
    return (
      <Piano
        className="lucide-experience-icon"
        strokeWidth={1.35}
      />
    );
  }

  return <ComposerIcon />;
}

function ExperienceCard({ item, onSelect }) {
  return (
    <a
      href={item.href}
      onClick={(e) => { e.preventDefault(); onSelect && onSelect(); }}
      className={`experience-card ${item.position}`}
    >
      <div className="card-number">{item.number}</div>

      <div className="card-content">

        <div className="experience-icon">
          <ExperienceIcon type={item.icon} />
        </div>

        <h2>{item.title}</h2>

        <div className="card-divider" />

        <p>{item.description}</p>

        <div className="card-arrow">
          <ArrowRight size={19} strokeWidth={1.6} />
        </div>

      </div>
    </a>
  );
}

function ArtiumCenter() {
  return (
    <div className="artium-center">

      <div className="center-ring center-ring-outer" />
      <div className="center-ring center-ring-inner" />

      <div className="center-content">

        <PinMark className="center-pin-svg" />

        <div className="center-wordmark">
          artium
        </div>

      </div>

    </div>
  );
}

function Architecture({ actionFor }) {
  return (
    <section className="architecture">

      <div className="architecture-circle circle-large" />
      <div className="architecture-circle circle-small" />

      <div className="architecture-line architecture-horizontal" />
      <div className="architecture-line architecture-vertical" />

      <div className="architecture-dot dot-top" />
      <div className="architecture-dot dot-bottom" />
      <div className="architecture-dot dot-left" />
      <div className="architecture-dot dot-right" />

      <div className="cards-grid">

        {experiences.map((item) => (
          <ExperienceCard
            key={item.number}
            item={item}
            onSelect={actionFor[item.number]}
          />
        ))}

        <ArtiumCenter />

      </div>

    </section>
  );
}

function Benefits() {
  return (
    <section className="benefits">

      <div className="benefit-item">

        <div className="benefit-icon">
          <Users size={25} strokeWidth={1.5} />
        </div>

        <div>
          <h3>
            Trusted
            <br />
            Community
          </h3>

          <p>
            Verified conservatory
            <br />
            students & musicians
          </p>
        </div>

      </div>

      <div className="benefit-item">

        <div className="benefit-icon">
          <ShieldCheck size={25} strokeWidth={1.5} />
        </div>

        <div>
          <h3>
            Safe &
            <br />
            Secure
          </h3>

          <p>
            Private, secure and
            <br />
            reliable platform
          </p>
        </div>

      </div>

      <div className="benefit-item">

        <div className="benefit-icon">
          <BarChart3 size={25} strokeWidth={1.5} />
        </div>

        <div>
          <h3>
            Grow
            <br />
            Together
          </h3>

          <p>
            Opportunities,
            <br />
            collaborations and
            <br />
            real connections
          </p>
        </div>

      </div>

    </section>
  );
}

const ACT_INSTAGRAM = "https://www.instagram.com/aclassicaltone?igsh=MTZzdzk3bWo5OGdkbA==";

export default function ArtiumLanding({ onLearner, onStudent, onPianist, onComposers, onLogin, memberCount }) {
  // The app around this page is dark; iOS rubber-band overscroll shows the
  // body. Own it while mounted, hand it back on the way out.
  React.useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#fcfbf9";
    return () => { document.body.style.backgroundColor = prev; };
  }, []);

  const actionFor = {
    "01": onLearner,
    "02": onStudent,
    "03": onPianist,
    "04": onComposers,
  };

  return (
    <div className="artium-page">

      <header className="artium-header">

        <a href="/" className="logo-link">
          <Logo />
        </a>

        <div className="header-actions">

          <button className="header-circle" aria-label="Menu">
            <Menu size={23} strokeWidth={1.55} />
          </button>

          <button className="header-user" aria-label="Members">
            <UserRound size={22} strokeWidth={1.5} />

            <span>{memberCount ?? 40}</span>
          </button>

        </div>

      </header>

      <main>

        <section className="hero">

          <div className="welcome">
            WELCOME TO ARTIUM
          </div>

          <h1>
            Your Classical
            <br />
            Music World
          </h1>

          <p>
            Connect. Learn. Elevate.
          </p>

          <div className="hero-decoration">
            <span />
            <b>◆</b>
            <span />
          </div>

        </section>

        <Architecture actionFor={actionFor} />

        <Benefits />

        <section className="login-section">

          <p>
            Already have an account?
          </p>

          <a
            href="/login"
            onClick={(e) => { e.preventDefault(); onLogin && onLogin(); }}
            className="login-button"
          >
            <span>Log in</span>
            <ArrowRight
              size={21}
              strokeWidth={1.7}
            />
          </a>

        </section>

      </main>

      <footer className="artium-footer">

        <div className="footer-top">

          <div className="partnership">
            <span>In partnership with</span>

            <strong>
              aclassicaltone
            </strong>
          </div>

          <div className="socials">

            <a href={ACT_INSTAGRAM} target="_blank" rel="noreferrer" aria-label="Instagram">
              <span>◎</span>
            </a>

            <a href="#" aria-label="Facebook">
              <span>f</span>
            </a>

          </div>

        </div>

        <div className="footer-bottom">

          <nav>
            <a href="#about">About Us</a>
            <i>•</i>
            <a href="#help">Help Center</a>
            <i>•</i>
            <a href="#contact">Contact</a>
          </nav>

          <span>
            © 2026 Artium. All rights reserved.
          </span>

        </div>

      </footer>

    </div>
  );
}
