import React from "react";
import { ArrowRight } from "lucide-react";

/**
 * One card in the hub. The chip and the arrow both sit on the card's OUTER
 * corner — top-left on the left column, top-right on the right column — so
 * the four cards read as mirrored pairs around the centre rather than four
 * copies of one layout. `side` carries that: it is which column the card is
 * in, not which corner any one element happens to be in.
 *
 * The whole card is a single <button>, not a div with a nested link — the
 * reference's affordance is "tap anywhere on the card", and a button is the
 * only element that gets that for free, including keyboard activation and
 * the focus ring.
 */
export default function ExperienceCard({ id, title, description, icon, side = "left", onClick }) {
  const corner = side === "right" ? "right-5 md:right-6" : "left-5 md:left-6";
  return (
    <button onClick={onClick} className={`exp-card exp-card--${side} group relative flex w-full flex-col items-center rounded-[26px] border border-border bg-white px-6 pb-14 pt-12 text-center md:px-7 md:pt-14`}>
      <span
        className={`absolute top-5 ${corner} flex h-7 w-7 items-center justify-center rounded-full border border-gold/30 text-[11px] font-semibold text-gold md:top-6`}
        style={{ fontFamily: "'Manrope', sans-serif" }}
        aria-hidden="true"
      >
        {id}
      </span>

      <span className="exp-card-icon flex h-14 w-14 items-center justify-center text-gold transition-transform duration-300 md:h-[60px] md:w-[60px]" aria-hidden="true">
        {icon}
      </span>

      <span
        className="mt-5 text-[21px] leading-[1.2] text-ink md:text-[23px]"
        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}
      >
        {title}
      </span>

      <span className="mt-3 h-px w-10 bg-gold/60" aria-hidden="true" />

      <span className="mt-3 text-[13.5px] leading-[1.55] text-muted" style={{ fontFamily: "'Manrope', sans-serif" }}>
        {description}
      </span>

      {/* The chip mirrors to the outer corner; the arrow does not. In the
          reference every arrow sits bottom-right regardless of column — the
          "go" affordance reads the same on all four, and only the number
          participates in the mirroring. */}
      <span
        className="exp-card-arrow absolute bottom-5 right-5 flex h-9 w-9 items-center justify-center rounded-full border border-border text-gold transition-transform duration-300 md:bottom-6 md:right-6"
        aria-hidden="true"
      >
        <ArrowRight size={15} strokeWidth={2} />
      </span>
    </button>
  );
}
