import React from "react";

/**
 * The opening line. Everything here is centred and short — a label, a
 * headline, a tagline, a hairline-and-diamond rule — because the hub below
 * it is the page's real content and the hero's only job is to say, quietly,
 * what Artium is before the four cards say what to do about it.
 */
export default function HeroSection() {
  return (
    <section className="mx-auto max-w-2xl px-6 pb-12 pt-4 text-center md:pb-16 md:pt-8">
      <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-gold" style={{ fontFamily: "'Manrope', sans-serif" }}>
        Welcome to Artium
      </p>
      <h1
        className="mt-4 text-[40px] leading-[1.12] text-ink md:text-[54px]"
        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}
      >
        Your Classical
        <br />
        Music World
      </h1>
      <p className="mt-4 text-[15px] text-muted md:text-base" style={{ fontFamily: "'Manrope', sans-serif" }}>
        Connect. Learn. Elevate.
      </p>

      <div className="mx-auto mt-7 flex w-40 items-center justify-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-gold/40" />
        <span className="h-1.5 w-1.5 rotate-45 bg-gold" />
        <span className="h-px flex-1 bg-gold/40" />
      </div>
    </section>
  );
}
