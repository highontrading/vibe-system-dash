import type { Aspect, EditPlan, Look, Word } from './schema';
import { segmentsFromWords } from './timeline';

export const PRESET_LOOKS: Look[] = [
  {
    id: 'ransom',
    name: 'Ransom Note',
    colors: { primary: '#FFD60A', accent: '#FFD60A', text: '#FFFFFF', ink: '#111111' },
    fonts: { heading: 'SpecialElite', caption: 'Montserrat', note: 'Caveat' },
    hook: { style: 'ransom', position: 'top', uppercase: true },
    captions: { style: 'pop', position: 'middle', maxWords: 3, uppercase: true, size: 1 },
    elements: { allowed: ['stamp', 'colorCard', 'note', 'card'], progressBar: false },
    motion: { intensity: 'medium', zoomOnCuts: true, flashOnCuts: false },
  },
  {
    id: 'clean-creator',
    name: 'Clean Creator',
    colors: { primary: '#FFFFFF', accent: '#3DDC97', text: '#FFFFFF', ink: '#111111' },
    fonts: { heading: 'Inter', caption: 'Inter', note: 'Kalam' },
    hook: { style: 'boxed', position: 'top', uppercase: false },
    captions: { style: 'karaoke', position: 'bottom', maxWords: 4, uppercase: false, size: 1 },
    elements: { allowed: ['stamp', 'card', 'emoji'], progressBar: true },
    motion: { intensity: 'calm', zoomOnCuts: true, flashOnCuts: false },
  },
  {
    id: 'hype',
    name: 'Hype',
    colors: { primary: '#FF3B30', accent: '#FFE600', text: '#FFFFFF', ink: '#FFFFFF' },
    fonts: { heading: 'Anton', caption: 'Anton', note: 'PermanentMarker' },
    hook: { style: 'big', position: 'center', uppercase: true },
    captions: { style: 'single', position: 'middle', maxWords: 1, uppercase: true, size: 1.3 },
    elements: { allowed: ['stamp', 'emoji', 'colorCard'], progressBar: true },
    motion: { intensity: 'hype', zoomOnCuts: true, flashOnCuts: true },
  },
  {
    id: 'editorial',
    name: 'Editorial Serif',
    colors: { primary: '#F2EDE4', accent: '#E8A33D', text: '#FFFFFF', ink: '#1A1A1A' },
    fonts: { heading: 'InstrumentSerif', caption: 'DMSans', note: 'Caveat' },
    hook: { style: 'minimal', position: 'top', uppercase: false },
    captions: { style: 'clean', position: 'bottom', maxWords: 5, uppercase: false, size: 0.95 },
    elements: { allowed: ['card', 'note', 'colorCard'], progressBar: false },
    motion: { intensity: 'calm', zoomOnCuts: false, flashOnCuts: false },
  },
  {
    id: 'bold-box',
    name: 'Bold Box',
    colors: { primary: '#7C5CFF', accent: '#7C5CFF', text: '#FFFFFF', ink: '#FFFFFF' },
    fonts: { heading: 'ArchivoBlack', caption: 'Poppins', note: 'Kalam' },
    hook: { style: 'stacked', position: 'top', uppercase: true },
    captions: { style: 'boxed', position: 'bottom', maxWords: 3, uppercase: true, size: 1 },
    elements: { allowed: ['stamp', 'card', 'emoji', 'note'], progressBar: true },
    motion: { intensity: 'medium', zoomOnCuts: true, flashOnCuts: false },
  },
];

export const DEFAULT_LOOK_ID = 'ransom';

/** First sentence of the transcript, trimmed to a hook-sized phrase. */
export function guessHook(words: Word[]): string {
  const out: string[] = [];
  for (const w of words) {
    out.push(w.text.trim());
    if (/[.!?]$/.test(w.text.trim()) || out.length >= 7) break;
  }
  return out.join(' ').replace(/[.,]$/, '');
}

/**
 * Instant first cut made without Claude: removes pauses, turns captions on and
 * uses the opening line as the hook. Claude then refines it.
 */
export function baselinePlan(opts: {
  words: Word[];
  sourceDuration: number;
  look: Look;
  aspect?: Aspect;
  newId: () => string;
}): EditPlan {
  const { words, sourceDuration, look, newId } = opts;
  return {
    version: 1,
    aspect: opts.aspect ?? '9:16',
    fps: 30,
    sourceDuration,
    look,
    segments: segmentsFromWords(words, sourceDuration, newId),
    hook: { enabled: words.length > 0, text: guessHook(words), highlight: [], duration: 2.5 },
    captions: { enabled: true, words },
    overlays: [],
    zooms: [],
    summary: 'Auto cut: removed pauses, added captions and used your opening line as the hook.',
  };
}
