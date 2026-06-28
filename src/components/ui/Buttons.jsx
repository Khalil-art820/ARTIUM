import React from 'react';
import { C, FONT_BODY } from '../../lib/constants';
import { Home } from 'lucide-react';

export function PrimaryBtn({ children, onClick, disabled, full, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm transition-opacity ${full ? "w-full" : ""}`}
      style={{
        fontFamily: FONT_BODY, fontWeight: 600,
        background: disabled ? "rgba(201,162,75,0.35)" : C.brass,
        color: C.inkText,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children} {Icon && <Icon size={16} />}
    </button>
  );
}

export function GhostBtn({ children, onClick, icon: Icon, tone = "light", disabled }) {
  const col = tone === "light" ? C.ivory : C.inkText;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm"
      style={{
        fontFamily: FONT_BODY, fontWeight: 600, color: col,
        border: `1px solid ${tone === "light" ? C.inkLine : C.parchmentLine}`,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {Icon && <Icon size={15} />} {children}
    </button>
  );
}

export function HomeBtn({ onClick }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-sm" style={{ color: C.ivoryDim, fontFamily: FONT_BODY, fontWeight: 600 }}>
      <Home size={15} /> Home
    </button>
  );
}

export function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-sm transition-colors"
      style={{
        fontFamily: FONT_BODY,
        border: `1px solid ${active ? C.brass : C.inkLine}`,
        background: active ? C.brass : "transparent",
        color: active ? C.inkText : C.ivoryDim,
        fontWeight: active ? 600 : 500,
      }}
    >
      {children}
    </button>
  );
}
