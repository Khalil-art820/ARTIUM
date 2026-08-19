import React from "react";
import ExperienceCard from "./ExperienceCard";
import ArtiumCenter from "./ArtiumCenter";

/**
 * The gate's own line art, recoloured. The conductor mask is painted through
 * the same PNG mask the dark gate uses — it is artwork, not a font glyph, so
 * it travels as a mask-image rather than being redrawn — and the cap and
 * piano are the same filled-silhouette paths, copied rather than imported,
 * because the gate's copies are tuned for gold-on-ink and these are tuned
 * for gold-on-white at a different size. Only the composer bust is new: the
 * first three marks were drawn for exactly these three cards, but nothing
 * in the app already draws a person for "the fourth card".
 */
function ConductorMark() {
  return (
    <span
      className="block h-full w-full"
      style={{
        aspectRatio: "34 / 41", backgroundColor: "#C49339",
        WebkitMaskImage: "url('/teacher-mark.png')", maskImage: "url('/teacher-mark.png')",
        WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        WebkitMaskSize: "contain", maskSize: "contain",
        WebkitMaskPosition: "center", maskPosition: "center",
      }}
    />
  );
}

function CapMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-full w-full">
      <path d="M12 3.4 23 8.7 12 14 1 8.7z" fill="#C49339" />
      <path d="M6.6 11.05 12 13.65l5.4-2.6v4.02c0 .43-.26.82-.7 1.08-1.1.66-2.79 1.05-4.7 1.05s-3.6-.39-4.7-1.05c-.44-.26-.7-.65-.7-1.08z" fill="#C49339" />
      <path d="M20.7 10.15a.62.62 0 0 1 .62.62v4.06a.62.62 0 0 1-1.24 0v-4.06c0-.34.28-.62.62-.62z" fill="#C49339" />
      <circle cx="20.7" cy="16.1" r="1.15" fill="#C49339" />
    </svg>
  );
}

function PianoMark() {
  return (
    <svg viewBox="0 0 100 107" aria-hidden="true" className="h-full w-full">
      <g fill="#C49339">
        <path
          fillRule="evenodd"
          d="M70 19.5 85.5 19.5C90 21 93.5 28 93.5 37c0 8-4.5 14.5-11.5 17.5L76 56.5 23 58.5zM69.3 26.5 71.8 26.5 77.3 50 74.8 50z"
        />
        <path d="M18 66c0-4.5 3-7 7-7h49c8 0 15 2.5 20 7 3.5 3 5 6 3.5 8-1.5 2.2-5.5 2.5-9.5 2.5L26 77c-5 0-8-3-8-7z" />
        <path d="M29 76.5h4.2V95H29zM45 76.5h5v20h-5zM67 76.5h6v26h-6zM89.5 74h3v18h-3z" />
        <rect x="27.4" y="93" width="7.4" height="2.5" rx="1.25" />
        <rect x="42.6" y="94.6" width="9.8" height="2.6" rx="1.3" />
        <rect x="64.6" y="100.8" width="10.8" height="2.8" rx="1.4" />
      </g>
    </svg>
  );
}

// A classical profile bust, drawn thin-stroke to match the other three marks
// as line art rather than silhouette: a period hairline (a wave rather than
// a modern cut), a straight nose and set jaw, and a plinth underneath — the
// vocabulary of a carved composer bust rather than a generic head-and-
// shoulders icon.
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
 * The centrepiece: a data-driven 2x2 of cards with the Artium mark centred
 * over the seam between them, and a handful of hairlines tying the ring to
 * each card. On mobile the composition can't overlap — there is no gap for
 * the centre to sit in — so it stacks instead: centre, then the four cards
 * in the same 01–04 order, per the brief's mobile layout.
 */
export default function ExperienceHub({ onLearner, onStudent, onPianist, onComposers }) {
  const EXPERIENCES = [
    {
      id: "01", side: "left", icon: <ConductorMark />, onClick: onLearner,
      title: "Find a Teacher",
      description: "Discover and connect with top conservatory musicians and inspiring teachers.",
    },
    {
      id: "02", side: "right", icon: <CapMark />, onClick: onStudent,
      title: <>I'm a Conservatory<br />Student | Graduate</>,
      description: "Learn, connect with peers, access resources, and grow in your musical journey.",
    },
    {
      id: "03", side: "left", icon: <PianoMark />, onClick: onPianist,
      title: <>Find a<br />Concert Pianist</>,
      description: "Hire talented conservatory pianists for your concert, event or project.",
    },
    {
      id: "04", side: "right", icon: <ComposerMark />, onClick: onComposers,
      title: <>The Wall of<br />Composers</>,
      description: "Explore the lives and legacies of the greatest composers in history.",
    },
  ];

  return (
    <section className="relative mx-auto max-w-5xl px-6 pb-4 md:px-10">
      <style>{`
        .exp-card {
          background: linear-gradient(180deg, #FFFFFF 0%, #FFFDF9 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.9),
            0 12px 35px rgba(25,30,35,0.07),
            0 2px 6px rgba(40,30,15,0.08),
            0 0 0 1px rgba(196,147,57,0.12);
          transition: transform 350ms ease, box-shadow 350ms ease;
        }
        .exp-card:hover {
          transform: translateY(-4px);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.9),
            0 24px 55px rgba(25,30,35,0.12),
            0 2px 6px rgba(40,30,15,0.08),
            0 0 0 1px rgba(196,147,57,0.30);
        }
        .exp-card:hover .exp-card-icon { transform: scale(1.05); }
        .exp-card:hover .exp-card-arrow { transform: translateX(3px); }
        .exp-card:focus-visible {
          outline: none;
          box-shadow:
            0 0 0 2px #FFFFFF,
            0 0 0 4px #C49339;
        }
        @media (prefers-reduced-motion: reduce) {
          .exp-card, .exp-card-icon, .exp-card-arrow { transition: none !important; }
          .exp-card:hover { transform: none; }
        }
      `}</style>

      <div className="relative flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:gap-x-10 lg:gap-y-10">
        {/* Connector hairlines — desktop only, since the overlap they tie
            together doesn't exist once the layout stacks. Percent-based so
            they hold their aim regardless of the grid's actual pixel size. */}
        <svg
          className="pointer-events-none absolute inset-0 hidden lg:block"
          viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"
        >
          <g stroke="#C49339" strokeWidth="0.25" opacity="0.35">
            <line x1="50" y1="50" x2="28" y2="28" />
            <line x1="50" y1="50" x2="72" y2="28" />
            <line x1="50" y1="50" x2="28" y2="72" />
            <line x1="50" y1="50" x2="72" y2="72" />
          </g>
          <g fill="#C49339" opacity="0.5">
            <circle cx="39" cy="39" r="0.6" />
            <circle cx="61" cy="39" r="0.6" />
            <circle cx="39" cy="61" r="0.6" />
            <circle cx="61" cy="61" r="0.6" />
          </g>
        </svg>

        <ArtiumCenter className="relative z-10 mx-auto lg:absolute lg:left-1/2 lg:top-1/2 lg:z-20 lg:-translate-x-1/2 lg:-translate-y-1/2" />

        {EXPERIENCES.map((exp) => (
          <ExperienceCard key={exp.id} {...exp} />
        ))}
      </div>
    </section>
  );
}
