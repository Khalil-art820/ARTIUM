import React, { useState } from "react";
import { Menu } from "lucide-react";
import { MusicBtn, MemberCount } from "../../App";

/**
 * The gate's header redrawn for a white page. The old bar sat on a dark
 * backdrop and only needed to hold its own against a photograph; this one
 * has to hold its own against nothing at all, so every mark in it is a thin
 * gold line rather than a filled shape — the page reads as empty until you
 * look for the controls, which is the point.
 *
 * MusicBtn and MemberCount are the gate's own components, imported rather
 * than redrawn: MusicBtn's play/pause glyph and the live headcount both
 * live inside them, and duplicating that logic here would just be a second
 * place for it to drift out of sync with the one App.jsx actually reads
 * from.
 */
export default function ArtiumHeader({ musicOn, onMusicToggle, memberCount }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="relative z-30 flex items-center justify-between px-6 py-6 md:px-12 md:py-8">
      {/* Pin + wordmark — the same pin the gate draws, evenodd window and
          all, just gold on white instead of gold on ink. */}
      <a href="#" onClick={(e) => e.preventDefault()} className="flex items-center gap-2.5" aria-label="Artium">
        <svg width="19" height="27" viewBox="0 0 28 40" aria-hidden="true" className="shrink-0">
          <path
            fillRule="evenodd"
            fill="#C49339"
            d="M14 0.9C6.82 0.9 1.4 6.28 1.4 13.2c0 3.35 1.3 6.36 3.2 9.36 1.6 2.53 3.63 5.02 5.53 7.62 1.35 1.85 2.6 3.72 3.28 5.98a.62.62 0 0 0 1.18 0c.68-2.26 1.93-4.13 3.28-5.98 1.9-2.6 3.93-5.09 5.53-7.62 1.9-3 3.2-6.01 3.2-9.36C26.6 6.28 21.18.9 14 .9zm0 7.68a5.04 5.04 0 1 0 0 10.08 5.04 5.04 0 0 0 0-10.08z"
          />
        </svg>
        <span
          className="text-[22px] leading-none text-gold"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}
        >
          artium
        </span>
      </a>

      <div className="flex items-center gap-3">
        <MusicBtn playing={musicOn} onToggle={onMusicToggle} size={38} />

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full lp-disc text-gold transition-colors hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <Menu size={17} strokeWidth={1.8} />
          </button>
          {menuOpen && (
            <>
              {/* A full-screen catcher rather than onBlur — onBlur closes
                  the menu before a click on one of its own links lands. */}
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-[46px] z-20 w-44 overflow-hidden rounded-2xl lp-disc py-2 shadow-[0_18px_40px_rgba(25,30,35,0.12)]">
                {[
                  ["About Us", "#about"],
                  ["Help Center", "#help"],
                  ["Contact", "#contact"],
                ].map(([label, href]) => (
                  <a
                    key={label}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5 text-sm text-ink transition-colors hover:bg-gold-pale/40 hover:text-gold"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    {label}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex h-[38px] items-center gap-1.5 rounded-full lp-disc px-3.5">
          <MemberCount count={memberCount} mark="#C49339" figure="#111923" />
        </div>
      </div>
    </header>
  );
}
