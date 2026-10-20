import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Look } from '../../shared/schema';

/** Scale factor so element sizes are written for a 1080px-wide frame. */
export function useUnit(): number {
  const { width, height } = useVideoConfig();
  return Math.min(width, height * (9 / 16) * 1.6) / 1080;
}

export function springFor(look: Look) {
  switch (look.motion.intensity) {
    case 'calm':
      return { damping: 200, mass: 0.8, stiffness: 120 };
    case 'hype':
      return { damping: 9, mass: 0.6, stiffness: 220 };
    default:
      return { damping: 14, mass: 0.7, stiffness: 170 };
  }
}

/** 0→1 entrance spring and 1→0 exit fade for an element shown for `durationFrames`. */
export function useInOut(durationFrames: number, look: Look, exitFrames = 8) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: springFor(look) });
  const exit = interpolate(frame, [durationFrames - exitFrames, durationFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return { frame, fps, enter, exit };
}

/** Deterministic pseudo-random in [0,1) from a string + index. */
export function rand(seed: string, i: number): number {
  let h = 2166136261 ^ i;
  for (let k = 0; k < seed.length; k++) h = Math.imul(h ^ seed.charCodeAt(k), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export const textShadow = (u: number) =>
  `0 ${3 * u}px ${12 * u}px rgba(0,0,0,0.55), 0 0 ${2 * u}px rgba(0,0,0,0.6)`;

export function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111111' : '#FFFFFF';
}
