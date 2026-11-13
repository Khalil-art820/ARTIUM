import React from "react";

/**
 * The top bar's wordmark — ARTIUM with the crossbar-less A — sized to sit in
 * running text. Screen readers hear "Artium".
 */
export default function ArtiumWord({ className = "" }) {
  return (
    <span className={`aw-mark ${className}`.trim()} role="img" aria-label="Artium">
      <svg viewBox="0 0 720 700" aria-hidden="true">
        <path d="M0 700L316 0H404L720 700H551L360 277L169 700Z" fill="currentColor" />
      </svg>
      <span aria-hidden="true">RTIUM</span>
    </span>
  );
}
