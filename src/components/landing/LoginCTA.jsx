import React from "react";
import { ArrowRight } from "lucide-react";

/**
 * The one place on the page that isn't an audience card — for the person
 * who already has an account and just wants back in. A pill rather than a
 * fourth style of card, so it reads as a single, obviously-different action.
 */
export default function LoginCTA({ onLogin }) {
  return (
    <section className="flex flex-col items-center gap-4 px-6 py-6 text-center md:py-10">
      <p className="text-[13.5px] text-muted" style={{ fontFamily: "'Manrope', sans-serif" }}>
        Already have an account?
      </p>
      <button
        onClick={onLogin}
        className="inline-flex min-w-[280px] items-center justify-center gap-2 rounded-full px-10 py-4 text-[15px] md:min-w-[340px] font-semibold text-ink shadow-[0_10px_28px_rgba(196,147,57,0.28)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
        style={{ fontFamily: "'Manrope', sans-serif", background: "linear-gradient(180deg, #E5C47B 0%, #C49339 100%)" }}
      >
        Log in <ArrowRight size={16} strokeWidth={2.2} />
      </button>
    </section>
  );
}
