import React from "react";
import ExperienceCard from "./ExperienceCard";
import ArtiumCenter from "./ArtiumCenter";

/**
 * All four marks are thin line art now. The first pass reused the dark
 * gate's filled silhouettes, and against the reference they read as stamps
 * where the photo shows engravings — the whole page is hairlines and raised
 * ivory, and a solid gold blot in the middle of each card broke the
 * material. Redrawn as strokes at the same weight as the bust, so the four
 * cards finally share one vocabulary.
 */
const stroke = { fill: "none", stroke: "#C49339", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };

function ConductorMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-full w-full" {...{ ...stroke }} style={{ fill: "none", stroke: "#C49339", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }}>
      <circle cx="23" cy="9.5" r="3.4" />
      <path d="M20 15.5q3-1.4 6 0l-1 10.5h-4z" />
      <path d="M26 17.5l6.5-5.5" />
      <path d="M32.5 12l6-6" />
      <path d="M20 17.5L14 23" />
      <path d="M21 26l-2 11M27 26l1.6 11" />
    </svg>
  );
}

function CapMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-full w-full" style={{ fill: "none", stroke: "#C49339", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }}>
      <path d="M24 9 42 16.5 24 24 6 16.5Z" />
      <path d="M14 20.5v5.8c0 2.6 4.5 4.7 10 4.7s10-2.1 10-4.7v-5.8" />
      <path d="M42 16.5v8.6" />
      <circle cx="42" cy="27.6" r="1.7" />
    </svg>
  );
}

function PianoMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-full w-full" style={{ fill: "none", stroke: "#C49339", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }}>
      <path d="M14.5 20.5 35 10.5l4 2-19 9.5" />
      <path d="M29.5 17.5 31 23" />
      <path d="M10.5 23.5h28c2.6 0 4.5 1.6 4.5 3.7s-1.9 3.8-4.5 3.8h-24c-2.6 0-4.5-1.7-4.5-3.8z" />
      <path d="M12 27.4h26" />
      <path d="M15.5 31v7.5M31.5 31v8.5M40.5 30.5v7" />
    </svg>
  );
}

// The bust keeps its original drawing — it was born as line art.
function ComposerMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#C49339" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-full w-full">
      <path d="M8.3 9.6c-.3-1.9.2-3.4 1.2-4.4 1.1-1.1 2.7-1.4 4-.9 1.1.4 1.9 1.3 2.1 2.4.7-.1 1.3.2 1.6.8.4.8 0 1.7-.8 2.2" />
      <path d="M8.3 9.6c-.9.2-1.4 1-1.3 1.9.1.9.9 1.5 1.7 1.4" />
      <path d="M8.8 12.8c.2 1.4 1 2.6 2.2 3.3.4.2.5.6.4 1l-.5 1.6" />
      <path d="M16.2 9.7c.3 1.7-.2 3.2-1.4 4.2-.5.4-.7.9-.6 1.5l.3 1.3" />
      <path d="M6.4 20.4c.3-1.7 1.6-2.9 3.2-3.2.9-.2 1.8-.2 2.7 0 1.7.3 3.1 1.6 3.4 3.2" />
      <path d="M4.6 20.6h14.8" />
    </svg>
  );
}

/**
 * The 2x2 with the centre carved into it. Each card's centre-facing corner
 * carries a much larger radius than the other three — that single detail is
 * what makes the reference read as one object with a circular well in the
 * middle, rather than four rectangles and a circle that happens to overlap
 * them. The geometry underneath is the photo's: one faint circle through
 * the inner corners, a vertical and a horizontal hairline crossing at the
 * centre, dots where they leave the composition. All of it sits under the
 * cards, so it surfaces only in the gaps — drawn fully, visible sparingly.
 */
export default function ExperienceHub({ onLearner, onStudent, onPianist, onComposers }) {
  const R = "28px", RB = "150px";
  const EXPERIENCES = [
    {
      id: "01", side: "left", icon: <ConductorMark />, onClick: onLearner,
      radius: `${R} ${R} ${RB} ${R}`,
      title: "Find a Teacher",
      description: "Discover and connect with top conservatory musicians and inspiring teachers.",
    },
    {
      id: "02", side: "right", icon: <CapMark />, onClick: onStudent,
      radius: `${R} ${R} ${R} ${RB}`,
      title: <>I'm a Conservatory<br />Student | Graduate</>,
      description: "Learn, connect with peers, access resources, and grow in your musical journey.",
    },
    {
      id: "03", side: "left", icon: <PianoMark />, onClick: onPianist,
      radius: `${R} ${RB} ${R} ${R}`,
      title: <>Find a<br />Concert Pianist</>,
      description: "Hire talented conservatory pianists for your concert, event or project.",
    },
    {
      id: "04", side: "right", icon: <ComposerMark />, onClick: onComposers,
      radius: `${RB} ${R} ${R} ${R}`,
      title: <>The Wall of<br />Composers</>,
      description: "Explore the lives and legacies of the greatest composers in history.",
    },
  ];

  return (
    <section className="relative mx-auto max-w-5xl px-6 pb-6 md:px-10">
      <style>{`
        .exp-card {
          background: linear-gradient(180deg, #FFFFFF 0%, #FBF7EF 100%);
          box-shadow:
            inset 0 1.5px 0 rgba(255,255,255,0.95),
            inset 0 -1px 0 rgba(196,147,57,0.10),
            0 22px 45px rgba(160,135,90,0.16),
            0 5px 14px rgba(160,135,90,0.10),
            0 0 0 1px rgba(196,147,57,0.14);
          transition: transform 350ms ease, box-shadow 350ms ease;
        }
        .exp-card:hover {
          transform: translateY(-4px);
          box-shadow:
            inset 0 1.5px 0 rgba(255,255,255,0.95),
            inset 0 -1px 0 rgba(196,147,57,0.10),
            0 30px 60px rgba(160,135,90,0.22),
            0 6px 16px rgba(160,135,90,0.12),
            0 0 0 1px rgba(196,147,57,0.30);
        }
        .exp-card:hover .exp-card-icon { transform: scale(1.05); }
        .exp-card:hover .exp-card-arrow { transform: translateX(3px); }
        .exp-card:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #C49339;
        }
        /* The raised white disc every small control on this page is made of:
           number chips, arrows, header buttons, benefit icons. One material,
           many sizes — exactly how the reference keeps a busy page quiet. */
        .lp-disc {
          background: linear-gradient(180deg, #FFFFFF 0%, #FAF6EE 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.9),
            0 5px 12px rgba(160,135,90,0.22),
            0 0 0 1px rgba(196,147,57,0.12);
        }
        @media (prefers-reduced-motion: reduce) {
          .exp-card, .exp-card-icon, .exp-card-arrow { transition: none !important; }
          .exp-card:hover { transform: none; }
        }
      `}</style>

      <div className="relative flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:gap-x-9 lg:gap-y-9">
        {/* The photo's geometry, under everything: a circle through the four
            inner corners, a vertical and a horizontal axis, four dots where
            the axes leave. Opaque cards cover most of it; the gaps do the
            revealing. */}
        <div className="pointer-events-none absolute inset-0 z-0 hidden lg:block" aria-hidden="true">
          <div className="absolute left-1/2 top-1/2 h-[430px] w-[430px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/30" />
          <div className="absolute left-1/2 top-[-36px] bottom-[-36px] w-px -translate-x-1/2 bg-gold/30" />
          <div className="absolute top-1/2 left-[-30px] right-[-30px] h-px -translate-y-1/2 bg-gold/30" />
          <div className="absolute left-1/2 top-[-40px] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-gold/70" />
          <div className="absolute left-1/2 bottom-[-40px] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-gold/70" />
          <div className="absolute top-1/2 left-[-34px] h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-gold/70" />
          <div className="absolute top-1/2 right-[-34px] h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-gold/70" />
        </div>

        <ArtiumCenter className="relative z-10 mx-auto lg:absolute lg:left-1/2 lg:top-1/2 lg:z-20 lg:-translate-x-1/2 lg:-translate-y-1/2" />

        {EXPERIENCES.map((exp) => (
          <ExperienceCard key={exp.id} {...exp} />
        ))}
      </div>
    </section>
  );
}
