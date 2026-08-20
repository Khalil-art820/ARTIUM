import React from "react";
import { ArrowRight, GraduationCap, Piano } from "lucide-react";
import "./ArtiumArchitecture.css";

const GOLD = "#C99538";

/* =========================================================
   The client's hand-drawn architecture, installed verbatim.
   Integration seams only: `actionFor` carries the app's
   existing screen handlers into each card (the app navigates
   by state, not URLs), and the medallion's clip-path pin
   placeholder carries the real Artium pin. Geometry, layer
   stack and classes are the client's own.
========================================================= */

const cards = [
  {
    id: "01",
    type: "teacher",
    className: "card-01",
    title: <>Find a Teacher</>,
    description:
      "Discover and connect with top conservatory musicians and inspiring teachers.",
  },
  {
    id: "02",
    type: "student",
    className: "card-02",
    title: (
      <>
        I'm a
        <br />
        Conservatory
        <br />
        Student | Graduate
      </>
    ),
    description:
      "Learn, connect with peers, access resources, and grow in your musical journey.",
  },
  {
    id: "03",
    type: "piano",
    className: "card-03",
    title: (
      <>
        Find a
        <br />
        Concert Pianist
      </>
    ),
    description:
      "Hire talented conservatory pianists for your concert, event or project.",
  },
  {
    id: "04",
    type: "composer",
    className: "card-04",
    title: (
      <>
        The Wall of
        <br />
        Composers
      </>
    ),
    description:
      "Explore the lives and legacies of the greatest composers in history.",
  },
];

function TeacherIcon() {
  return (
    <svg viewBox="0 0 80 80" className="artium-svg-icon">
      <circle cx="35" cy="18" r="8" />
      <path d="M27 28C20 31 18 40 22 50" />
      <path d="M42 28C49 32 50 41 45 51" />
      <path d="M25 36L10 43" />
      <path d="M10 43L7 39" />
      <path d="M10 43L13 47" />
      <path d="M45 34L67 17" />
      <path d="M67 17L63 17" />
      <path d="M67 17L66 21" />
      <path d="M29 49L27 68" />
      <path d="M43 49L45 68" />
      <path d="M27 68L20 71" />
      <path d="M45 68L52 71" />
    </svg>
  );
}

function ComposerIcon() {
  return (
    <svg viewBox="0 0 80 80" className="artium-svg-icon">
      <path d="M50 17C60 14 67 20 67 29" />
      <path d="M67 29C67 40 59 47 50 46" />
      <path d="M50 46C45 52 39 55 32 54" />
      <path d="M32 54C38 58 46 58 52 55" />
      <path d="M29 27C25 34 27 41 33 45" />
      <path d="M24 34C23 41 27 47 33 50" />
    </svg>
  );
}

function CardIcon({ type }) {
  if (type === "teacher") return <TeacherIcon />;

  if (type === "student") {
    return (
      <GraduationCap
        className="artium-lucide-icon"
        strokeWidth={1.35}
      />
    );
  }

  if (type === "piano") {
    return (
      <Piano
        className="artium-lucide-icon"
        strokeWidth={1.35}
      />
    );
  }

  return <ComposerIcon />;
}

function CardContent({ card, onSelect }) {
  const activate = (e) => {
    e.preventDefault();
    onSelect && onSelect();
  };
  return (
    <div
      className={`architecture-card-content ${card.className}`}
      role="link"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") activate(e); }}
      style={{ cursor: "pointer" }}
    >
      <div className="architecture-number">
        {card.id}
      </div>

      <div className="architecture-icon">
        <CardIcon type={card.type} />
      </div>

      <h2>{card.title}</h2>

      <div className="architecture-divider" />

      <p>{card.description}</p>

      <button className="architecture-arrow" aria-label={`Open ${card.id}`} onClick={activate}>
        <ArrowRight size={20} strokeWidth={1.5} />
      </button>
    </div>
  );
}

export default function ArtiumArchitecture({ actionFor = {} }) {
  return (
    <section className="artium-architecture">

      <div className="architecture-stage">

        <svg
          className="architecture-svg"
          viewBox="0 0 1024 850"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>

            <linearGradient
              id="cardSurface"
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="55%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#FAF8F3" />
            </linearGradient>

            <linearGradient
              id="topHighlight"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="#FFFFFF"
                stopOpacity=".95"
              />

              <stop
                offset="60%"
                stopColor="#FFFFFF"
                stopOpacity=".25"
              />

              <stop
                offset="100%"
                stopColor="#FFFFFF"
                stopOpacity="0"
              />
            </linearGradient>

            <linearGradient
              id="bevelGradient"
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="#FFFFFF"
                stopOpacity=".95"
              />

              <stop
                offset="28%"
                stopColor="#E7DDCB"
                stopOpacity=".35"
              />

              <stop
                offset="55%"
                stopColor="#FFFFFF"
                stopOpacity=".85"
              />

              <stop
                offset="100%"
                stopColor="#C99538"
                stopOpacity=".15"
              />
            </linearGradient>

            <radialGradient
              id="medallionSurface"
              cx=".32"
              cy=".22"
            >
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="72%" stopColor="#FFFDF9" />
              <stop offset="100%" stopColor="#F7F0E2" />
            </radialGradient>

            <filter
              id="cardShadow"
              x="-30%"
              y="-30%"
              width="160%"
              height="170%"
            >
              <feDropShadow
                dx="0"
                dy="13"
                stdDeviation="15"
                floodColor="#786039"
                floodOpacity=".12"
              />
            </filter>

            <filter
              id="edgeGlow"
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
            >
              <feGaussianBlur stdDeviation="2.2" />
            </filter>

            <filter
              id="medallionShadow"
              x="-40%"
              y="-40%"
              width="180%"
              height="180%"
            >
              <feDropShadow
                dx="0"
                dy="10"
                stdDeviation="14"
                floodColor="#80632F"
                floodOpacity=".14"
              />
            </filter>

          </defs>

          <g className="architecture-guides">

            <circle
              cx="512"
              cy="425"
              r="274"
            />

            <circle
              cx="512"
              cy="425"
              r="154"
            />

            <line
              x1="125"
              y1="425"
              x2="899"
              y2="425"
            />

            <line
              x1="512"
              y1="45"
              x2="512"
              y2="805"
            />

          </g>

          <g filter="url(#cardShadow)">

            <path
              className="card-depth"
              d="
                M158 32
                C136 32 122 48 122 72
                L122 339
                C122 367 140 386 169 386
                L337 386
                C356 386 372 375 378 359
                C382 346 378 331 369 316
                C361 302 359 289 366 278
                C373 267 385 262 402 262
                L405 262
                C417 262 424 254 424 242
                L424 72
                C424 48 409 32 385 32
                Z
              "
            />

            <path
              className="card-surface"
              d="
                M158 32
                C136 32 122 48 122 72
                L122 339
                C122 367 140 386 169 386
                L337 386
                C356 386 372 375 378 359
                C382 346 378 331 369 316
                C361 302 359 289 366 278
                C373 267 385 262 402 262
                L405 262
                C417 262 424 254 424 242
                L424 72
                C424 48 409 32 385 32
                Z
              "
              fill="url(#cardSurface)"
            />

            <path
              className="card-rim"
              d="
                M158 32
                C136 32 122 48 122 72
                L122 339
                C122 367 140 386 169 386
                L337 386
                C356 386 372 375 378 359
                C382 346 378 331 369 316
                C361 302 359 289 366 278
                C373 267 385 262 402 262
                L405 262
                C417 262 424 254 424 242
                L424 72
                C424 48 409 32 385 32
                Z
              "
            />

            <path
              className="card-highlight"
              d="
                M158 39
                C141 39 130 52 130 73
                L130 335
                C130 358 145 378 170 378
                L335 378
              "
            />

            <path
              className="card-bevel"
              d="
                M158 44
                C146 44 136 55 136 73
                L136 332
                C136 353 149 370 171 370
                L334 370
              "
            />

            <path
              className="card-inner-line"
              d="
                M161 50
                C150 50 142 59 142 75
                L142 329
                C142 348 153 363 173 363
                L331 363
              "
            />

            <path
              className="card-edge-glow"
              d="
                M158 38
                C140 38 128 52 128 73
                L128 333
              "
            />

          </g>

          <g filter="url(#cardShadow)">

            <path
              className="card-depth"
              d="
                M639 32
                C615 32 600 48 600 72
                L600 242
                C600 254 607 262 619 262
                L622 262
                C639 262 651 267 658 278
                C665 289 663 302 655 316
                C646 331 642 346 646 359
                C652 375 668 386 687 386
                L855 386
                C884 386 902 367 902 339
                L902 72
                C902 48 888 32 866 32
                Z
              "
            />

            <path
              className="card-surface"
              d="
                M639 32
                C615 32 600 48 600 72
                L600 242
                C600 254 607 262 619 262
                L622 262
                C639 262 651 267 658 278
                C665 289 663 302 655 316
                C646 331 642 346 646 359
                C652 375 668 386 687 386
                L855 386
                C884 386 902 367 902 339
                L902 72
                C902 48 888 32 866 32
                Z
              "
              fill="url(#cardSurface)"
            />

            <path
              className="card-rim"
              d="
                M639 32
                C615 32 600 48 600 72
                L600 242
                C600 254 607 262 619 262
                L622 262
                C639 262 651 267 658 278
                C665 289 663 302 655 316
                C646 331 642 346 646 359
                C652 375 668 386 687 386
                L855 386
                C884 386 902 367 902 339
                L902 72
                C902 48 888 32 866 32
                Z
              "
            />

            <path
              className="card-highlight"
              d="
                M638 39
                C621 39 608 52 608 73
                L608 239
              "
            />

            <path
              className="card-bevel"
              d="
                M642 44
                C628 44 614 55 614 73
                L614 238
              "
            />

            <path
              className="card-inner-line"
              d="
                M647 50
                C635 50 620 59 620 75
                L620 237
              "
            />

            <path
              className="card-edge-glow"
              d="
                M638 38
                C619 38 606 52 606 73
                L606 238
              "
            />

          </g>

          <g filter="url(#cardShadow)">

            <path
              className="card-depth"
              d="
                M122 511
                C122 483 140 464 169 464
                L337 464
                C356 464 372 475 378 491
                C382 504 378 519 369 534
                C361 548 359 561 366 572
                C373 583 385 588 402 588
                L405 588
                C417 588 424 596 424 608
                L424 778
                C424 802 409 818 385 818
                L158 818
                C136 818 122 802 122 778
                Z
              "
            />

            <path
              className="card-surface"
              d="
                M122 511
                C122 483 140 464 169 464
                L337 464
                C356 464 372 475 378 491
                C382 504 378 519 369 534
                C361 548 359 561 366 572
                C373 583 385 588 402 588
                L405 588
                C417 588 424 596 424 608
                L424 778
                C424 802 409 818 385 818
                L158 818
                C136 818 122 802 122 778
                Z
              "
              fill="url(#cardSurface)"
            />

            <path
              className="card-rim"
              d="
                M122 511
                C122 483 140 464 169 464
                L337 464
                C356 464 372 475 378 491
                C382 504 378 519 369 534
                C361 548 359 561 366 572
                C373 583 385 588 402 588
                L405 588
                C417 588 424 596 424 608
                L424 778
                C424 802 409 818 385 818
                L158 818
                C136 818 122 802 122 778
                Z
              "
            />

            <path
              className="card-highlight"
              d="
                M158 471
                C141 471 130 487 130 512
                L130 775
              "
            />

            <path
              className="card-bevel"
              d="
                M158 477
                C146 477 136 490 136 513
                L136 773
              "
            />

            <path
              className="card-inner-line"
              d="
                M161 483
                C150 483 142 494 142 514
                L142 770
              "
            />

          </g>

          <g filter="url(#cardShadow)">

            <path
              className="card-depth"
              d="
                M600 608
                C600 596 607 588 619 588
                L622 588
                C639 588 651 583 658 572
                C665 561 663 548 655 534
                C646 519 642 504 646 491
                C652 475 668 464 687 464
                L855 464
                C884 464 902 483 902 511
                L902 778
                C902 802 888 818 866 818
                L639 818
                C615 818 600 802 600 778
                Z
              "
            />

            <path
              className="card-surface"
              d="
                M600 608
                C600 596 607 588 619 588
                L622 588
                C639 588 651 583 658 572
                C665 561 663 548 655 534
                C646 519 642 504 646 491
                C652 475 668 464 687 464
                L855 464
                C884 464 902 483 902 511
                L902 778
                C902 802 888 818 866 818
                L639 818
                C615 818 600 802 600 778
                Z
              "
              fill="url(#cardSurface)"
            />

            <path
              className="card-rim"
              d="
                M600 608
                C600 596 607 588 619 588
                L622 588
                C639 588 651 583 658 572
                C665 561 663 548 655 534
                C646 519 642 504 646 491
                C652 475 668 464 687 464
                L855 464
                C884 464 902 483 902 511
                L902 778
                C902 802 888 818 866 818
                L639 818
                C615 818 600 802 600 778
                Z
              "
            />

            <path
              className="card-highlight"
              d="
                M687 471
                L850 471
                C873 471 894 487 894 512
                L894 775
              "
            />

            <path
              className="card-bevel"
              d="
                M687 477
                L848 477
                C867 477 888 492 888 513
                L888 773
              "
            />

            <path
              className="card-inner-line"
              d="
                M689 483
                L846 483
                C864 483 882 497 882 514
                L882 770
              "
            />

          </g>

          <g className="center-nodes">
            <circle cx="512" cy="315" r="4" />
            <circle cx="512" cy="535" r="4" />
            <circle cx="410" cy="425" r="4" />
            <circle cx="614" cy="425" r="4" />
          </g>

          <g
            className="medallion-svg"
            filter="url(#medallionShadow)"
          >
            <circle
              cx="512"
              cy="425"
              r="91"
              fill="url(#medallionSurface)"
              stroke={GOLD}
              strokeOpacity=".65"
              strokeWidth="1.5"
            />

            <circle
              cx="512"
              cy="425"
              r="82"
              fill="none"
              stroke="#D8B777"
              strokeOpacity=".60"
              strokeWidth="1"
            />

            <circle
              cx="512"
              cy="425"
              r="69"
              fill="none"
              stroke="#E5D1A9"
              strokeOpacity=".85"
              strokeWidth="1"
            />
          </g>

        </svg>

        <div className="architecture-html">
          {cards.map((card) => (
            <CardContent
              key={card.id}
              card={card}
              onSelect={actionFor[card.id]}
            />
          ))}
        </div>

        <div className="architecture-center">

          {/* The real pin, at the placeholder's footprint — the window is
              punched by the path itself, not painted white on top. */}
          <svg viewBox="0 0 28 40" aria-hidden="true" className="architecture-pin-svg">
            <path
              fillRule="evenodd"
              fill="#C99538"
              d="M14 0.9C6.82 0.9 1.4 6.28 1.4 13.2c0 3.35 1.3 6.36 3.2 9.36 1.6 2.53 3.63 5.02 5.53 7.62 1.35 1.85 2.6 3.72 3.28 5.98a.62.62 0 0 0 1.18 0c.68-2.26 1.93-4.13 3.28-5.98 1.9-2.6 3.93-5.09 5.53-7.62 1.9-3 3.2-6.01 3.2-9.36C26.6 6.28 21.18.9 14 .9zm0 7.68a5.04 5.04 0 1 0 0 10.08 5.04 5.04 0 0 0 0-10.08z"
            />
          </svg>

          <div className="architecture-wordmark">
            artium
          </div>

        </div>

      </div>

    </section>
  );
}
