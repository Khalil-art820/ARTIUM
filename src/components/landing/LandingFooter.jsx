import React from "react";
import { Instagram, Facebook } from "lucide-react";

// The partner's own channels — copied from the gate rather than imported,
// since App.jsx doesn't export either constant and the URLs are small
// enough that duplicating them here is less coupling than adding exports
// for two string literals.
const ACT_INSTAGRAM = "https://www.instagram.com/aclassicaltone?igsh=MTZzdzk3bWo5OGdkbA==";
const ACT_FACEBOOK = "https://www.facebook.com/share/1Q4piEHHN7/";

export default function LandingFooter() {
  return (
    <footer className="border-t border-border px-6 py-8 md:px-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-5 md:flex-row">
        <span className="text-[13px] text-muted" style={{ fontFamily: "'Manrope', sans-serif" }}>
          In partnership with{" "}
          <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }} className="text-ink">
            aclassicaltone
          </span>
        </span>

        <div className="flex items-center gap-3">
          <a
            href={ACT_INSTAGRAM} target="_blank" rel="noreferrer" aria-label="aclassicaltone on Instagram"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-gold transition-colors hover:border-gold"
          >
            <Instagram size={15} strokeWidth={1.7} />
          </a>
          <a
            href={ACT_FACEBOOK} target="_blank" rel="noreferrer" aria-label="aclassicaltone on Facebook"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-gold transition-colors hover:border-gold"
          >
            <Facebook size={15} strokeWidth={1.7} />
          </a>
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-5xl flex-col items-center gap-3 border-t border-border pt-6 text-center md:flex-row md:justify-between">
        <nav className="flex items-center gap-5 text-[12.5px] text-muted" style={{ fontFamily: "'Manrope', sans-serif" }}>
          <a href="#about" className="transition-colors hover:text-gold">About Us</a>
          <span aria-hidden="true">·</span>
          <a href="#help" className="transition-colors hover:text-gold">Help Center</a>
          <span aria-hidden="true">·</span>
          <a href="#contact" className="transition-colors hover:text-gold">Contact</a>
        </nav>
        <p className="text-[12px] text-muted" style={{ fontFamily: "'Manrope', sans-serif" }}>
          © 2026 Artium. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
