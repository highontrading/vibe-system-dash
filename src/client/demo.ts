import type { EditPlan, Look, Overlay, Word } from '../shared/schema';

/** Placeholder "talking head" frame used when you have no footage yet. */
export const DEMO_STILL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920">
  <defs>
    <radialGradient id="bg" cx="50%" cy="35%" r="80%"><stop offset="0" stop-color="#4a3b2c"/><stop offset="1" stop-color="#120e0b"/></radialGradient>
    <linearGradient id="body" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2b5dd1"/><stop offset="1" stop-color="#173a8a"/></linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)"/>
  <rect x="80" y="260" width="260" height="340" rx="10" fill="#2a211a" opacity=".7"/>
  <rect x="760" y="360" width="200" height="260" rx="10" fill="#2a211a" opacity=".6"/>
  <ellipse cx="540" cy="1880" rx="520" ry="560" fill="url(#body)"/>
  <rect x="470" y="1080" width="140" height="200" rx="60" fill="#6b4a33"/>
  <ellipse cx="540" cy="900" rx="210" ry="250" fill="#7a5439"/>
  <ellipse cx="540" cy="700" rx="225" ry="140" fill="#1b1410"/>
</svg>`);

const DEMO_TEXT = 'This one habit changed how I make content forever and it only takes ten minutes';

export function demoWords(): Word[] {
  return DEMO_TEXT.split(' ').map((text, i) => ({ text, start: 0.2 + i * 0.32, end: 0.2 + i * 0.32 + 0.28, emphasis: i === 2 || i === 13 ? true : undefined }));
}

export function demoPlan(
  look: Look,
  opts: { hook?: boolean; captions?: boolean; overlays?: Overlay[]; words?: Word[]; hookText?: string; aspect?: EditPlan['aspect'] } = {},
): EditPlan {
  return {
    version: 1,
    aspect: opts.aspect ?? '9:16',
    fps: 30,
    sourceDuration: 6,
    look,
    segments: [{ id: 'demo', start: 0, end: 6 }],
    hook: { enabled: opts.hook ?? true, text: opts.hookText ?? 'Quit your job?', highlight: ['job?'], duration: 3 },
    captions: { enabled: opts.captions ?? true, words: opts.words ?? demoWords() },
    overlays: opts.overlays ?? [],
    zooms: [],
  };
}
