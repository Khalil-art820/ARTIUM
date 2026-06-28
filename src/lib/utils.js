import { PALETTE } from './constants';

export const colorFor = (seed) => {
  const s = String(seed).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTE[s % PALETTE.length];
};

export const initials = (name) => {
  if (!name) return "";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
};
