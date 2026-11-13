import React from "react";

/**
 * The app's one back arrow, traced from Instagram's: a long straight shaft
 * and two arms at exactly 45°, each a little over a third of the shaft's
 * length, one even stroke (~1/11 of the width) with rounded ends and joins.
 * Fitted to the reference screenshot (97% of its ink matches). `size` is the
 * arrow's width (32px: the reference's size, read against its profile photo
 * and name); it is ~0.72 as tall.
 */
export default function BackArrow({ size = 32, className }) {
  return (
    <svg className={`back-arrow${className ? " " + className : ""}`} width={size} height={(size * 17.26) / 24} viewBox="0 0 24 17.26" fill="none"
      stroke="currentColor" strokeWidth="2.17" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ display: "block", flex: "none" }}>
      <path d="M22.91 8.63H1.09M8.63 1.09L1.09 8.63L8.63 16.17" />
    </svg>
  );
}
