import React from 'react';
import { C, FONT_DISPLAY } from '../../lib/constants';

export function Logo({ tone = "light", size = 20, slogan = false }) {
  const col = tone === "light" ? C.ivory : C.inkText;
  const dim = tone === "light" ? C.ivoryDim : C.inkTextDim;
  const r = size / 2;
  const fontSize = size * 0.68;
  const textY = r + fontSize * 0.36;
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={r} cy={r} r={r} fill="white" />
        <text
          x={r} y={textY}
          textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontWeight="700"
          fontSize={fontSize}
          fill="black"
        >A</text>
      </svg>
      <span style={{ fontFamily: FONT_DISPLAY, color: col, fontSize: size * 0.85, letterSpacing: 0.3 }}>Artium</span>
      {slogan && (
        <span style={{ fontFamily: FONT_DISPLAY, color: dim, fontSize: size * 0.62, letterSpacing: 0.5, fontWeight: 400, fontStyle: "italic", opacity: 0.75 }}>
          — A World Connected by Music
        </span>
      )}
    </div>
  );
}
