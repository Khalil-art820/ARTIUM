import React from "react";

/**
 * The hub's centrepiece: a double-ringed disc carrying the mark, sitting
 * where the four cards meet. It is not a button — nothing here navigates —
 * it is the page saying "this is Artium" at the one point every card points
 * toward. The breathing glow is the only motion on the page that isn't tied
 * to a hover, so it is the one thing gated behind prefers-reduced-motion
 * rather than a hover class: reduced motion can't turn off a state it
 * doesn't create, it has to turn off an animation that runs regardless.
 */
export default function ArtiumCenter({ className = "" }) {
  return (
    <div className={`artium-center flex h-[110px] w-[110px] shrink-0 flex-col items-center justify-center rounded-full border border-champagne/70 bg-white md:h-[130px] md:w-[130px] lg:h-[176px] lg:w-[176px] ${className}`}>
      <style>{`
        .artium-center {
          box-shadow: 0 14px 34px rgba(25,30,35,0.09), 0 0 0 1px rgba(196,147,57,0.08);
        }
        @media (prefers-reduced-motion: no-preference) {
          .artium-center { animation: artium-center-breathe 4s ease-in-out infinite; }
        }
        @keyframes artium-center-breathe {
          0%, 100% { box-shadow: 0 14px 34px rgba(25,30,35,0.09), 0 0 0 1px rgba(196,147,57,0.08); }
          50%      { box-shadow: 0 14px 34px rgba(25,30,35,0.09), 0 0 0 5px rgba(196,147,57,0.16); }
        }
      `}</style>

      {/* The inner ring — thin, champagne, set a few pixels in from the
          card's own border, which is what reads as "double ring" rather
          than "thick ring". */}
      <div className="flex h-[86%] w-[86%] flex-col items-center justify-center rounded-full border border-gold-pale">
        <svg width="18" height="26" viewBox="0 0 28 40" aria-hidden="true" className="lg:w-[22px]" style={{ width: 16, height: 23 }}>
          <path
            fillRule="evenodd"
            fill="#C49339"
            d="M14 0.9C6.82 0.9 1.4 6.28 1.4 13.2c0 3.35 1.3 6.36 3.2 9.36 1.6 2.53 3.63 5.02 5.53 7.62 1.35 1.85 2.6 3.72 3.28 5.98a.62.62 0 0 0 1.18 0c.68-2.26 1.93-4.13 3.28-5.98 1.9-2.6 3.93-5.09 5.53-7.62 1.9-3 3.2-6.01 3.2-9.36C26.6 6.28 21.18.9 14 .9zm0 7.68a5.04 5.04 0 1 0 0 10.08 5.04 5.04 0 0 0 0-10.08z"
          />
        </svg>
        <span
          className="mt-1.5 text-[13px] leading-none text-gold md:text-[15px]"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}
        >
          artium
        </span>
      </div>
    </div>
  );
}
