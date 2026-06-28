import React from 'react';
import { C, FONT_DISPLAY } from '../../lib/constants';
import { colorFor, initials } from '../../lib/utils';

export function Avatar({ name, id, size = 44, online, photoUrl }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          className="w-full h-full rounded-full object-cover"
          style={{ border: `1px solid ${C.inkLine}` }}
        />
      ) : (
        <div
          className="w-full h-full rounded-full flex items-center justify-center"
          style={{ background: colorFor(id || name), color: C.ivory, fontFamily: FONT_DISPLAY, fontSize: size * 0.36 }}
        >
          {initials(name)}
        </div>
      )}
      {online && (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full"
          style={{ width: size * 0.28, height: size * 0.28, background: C.brass, border: `2px solid ${C.ink}` }}
        />
      )}
    </div>
  );
}
