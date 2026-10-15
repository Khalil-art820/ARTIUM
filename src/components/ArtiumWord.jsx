import React from "react";

/**
 * The top bar's wordmark — ARTIUM with the crossbar-less A — sized to sit in
 * running text. Screen readers hear "Artium".
 */
export default function ArtiumWord({ className = "" }) {
  return (
    <span className={`aw-mark ${className}`.trim()} role="img" aria-label="Artium">
      <svg viewBox="0 0 15 15" aria-hidden="true">
        <path d="M7.5 0.9 L1.4 14.4 M7.5 0.9 L13.6 14.4" stroke="currentColor" strokeWidth="3.2" fill="none" />
      </svg>
      <span aria-hidden="true">RTIUM</span>
    </span>
  );
}
