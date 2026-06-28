import React from 'react';
import { C } from '../../lib/constants';

export function Staff({ tone = "dark", gap = 3 }) {
  const c = tone === "dark" ? C.inkLine : C.parchmentLine;
  return (
    <div className="w-full flex flex-col" style={{ gap }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ height: 1, width: "100%", background: c }} />
      ))}
    </div>
  );
}
