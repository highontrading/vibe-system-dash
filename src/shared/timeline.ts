import type { EditPlan, Segment, Word } from './schema';

export type Interval = { start: number; end: number };

const EPS = 1e-3;

/** Sorts, clamps and merges touching/overlapping segments. */
export function normalizeSegments(segments: Segment[], sourceDuration: number): Segment[] {
  const sorted = segments
    .map((s) => ({ ...s, start: Math.max(0, s.start), end: Math.min(sourceDuration, s.end) }))
    .filter((s) => s.end - s.start > 0.05)
    .sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end + EPS) {
      last.end = Math.max(last.end, s.end);
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

export function outputDuration(segments: Segment[]): number {
  return segments.reduce((acc, s) => acc + (s.end - s.start), 0);
}

/**
 * Maps a source time to output time. A time inside a cut snaps forward to the
 * start of the next kept segment; a time after the last segment returns null.
 */
export function sourceToOutput(segments: Segment[], t: number): number | null {
  let acc = 0;
  for (const s of segments) {
    if (t < s.start) return acc;
    if (t <= s.end) return acc + (t - s.start);
    acc += s.end - s.start;
  }
  return null;
}

export function outputToSource(segments: Segment[], t: number): number {
  let acc = 0;
  for (const s of segments) {
    const len = s.end - s.start;
    if (t <= acc + len) return s.start + (t - acc);
    acc += len;
  }
  const last = segments[segments.length - 1];
  return last ? last.end : 0;
}

/** True when the source time is inside a kept segment. */
export function isKept(segments: Segment[], t: number): boolean {
  return segments.some((s) => t >= s.start - EPS && t <= s.end + EPS);
}

/** Removes [start, end] from the kept segments (cut). */
export function cutRange(segments: Segment[], range: Interval, newId: () => string): Segment[] {
  const out: Segment[] = [];
  for (const s of segments) {
    if (range.end <= s.start || range.start >= s.end) {
      out.push(s);
      continue;
    }
    if (range.start > s.start) out.push({ ...s, end: range.start });
    if (range.end < s.end) out.push({ id: newId(), start: range.end, end: s.end });
  }
  return out.filter((s) => s.end - s.start > 0.05);
}

/** Adds [start, end] back to the kept segments (restore). */
export function keepRange(
  segments: Segment[],
  range: Interval,
  sourceDuration: number,
  newId: () => string,
): Segment[] {
  return normalizeSegments([...segments, { id: newId(), ...range }], sourceDuration);
}

export type TimedWord = Word & { oStart: number; oEnd: number; index: number };

/** Kept words, with their output-time positions. */
export function keptWords(plan: Pick<EditPlan, 'segments' | 'captions'>): TimedWord[] {
  const out: TimedWord[] = [];
  plan.captions.words.forEach((w, index) => {
    const mid = (w.start + w.end) / 2;
    if (!isKept(plan.segments, mid)) return;
    const oStart = sourceToOutput(plan.segments, w.start);
    const oEnd = sourceToOutput(plan.segments, w.end);
    if (oStart === null || oEnd === null) return;
    out.push({ ...w, oStart, oEnd: Math.max(oEnd, oStart + 0.05), index });
  });
  return out;
}

export type CaptionChunk = { words: TimedWord[]; start: number; end: number };

/** Groups words into on-screen caption chunks (output time). */
export function chunkCaptions(words: TimedWord[], maxWords: number): CaptionChunk[] {
  const chunks: CaptionChunk[] = [];
  let cur: TimedWord[] = [];
  const flush = () => {
    if (cur.length) {
      chunks.push({ words: cur, start: cur[0].oStart, end: cur[cur.length - 1].oEnd });
      cur = [];
    }
  };
  for (const w of words) {
    const prev = cur[cur.length - 1];
    const pause = prev ? w.oStart - prev.oEnd : 0;
    const sentenceEnd = prev && /[.!?]$/.test(prev.text.trim());
    if (cur.length >= maxWords || pause > 0.6 || sentenceEnd) flush();
    cur.push(w);
  }
  flush();
  // Hold each chunk until the next one starts (avoids flicker), max 0.8s.
  for (let i = 0; i < chunks.length; i++) {
    const next = chunks[i + 1];
    const hold = next ? Math.min(next.start, chunks[i].end + 0.8) : chunks[i].end + 0.5;
    chunks[i].end = Math.max(chunks[i].end, hold);
  }
  return chunks;
}

/** Kept segments that remain after removing pauses longer than `maxGap`. */
export function segmentsFromWords(
  words: Word[],
  sourceDuration: number,
  newId: () => string,
  { maxGap = 0.45, pad = 0.12 }: { maxGap?: number; pad?: number } = {},
): Segment[] {
  if (!words.length) return [{ id: newId(), start: 0, end: sourceDuration }];
  const segs: Segment[] = [];
  let start = Math.max(0, words[0].start - pad);
  let end = words[0].end + pad;
  for (const w of words.slice(1)) {
    if (w.start - end > maxGap - pad) {
      segs.push({ id: newId(), start, end: Math.min(end, sourceDuration) });
      start = Math.max(0, w.start - pad);
    }
    end = w.end + pad;
  }
  segs.push({ id: newId(), start, end: Math.min(end, sourceDuration) });
  return normalizeSegments(segs, sourceDuration);
}

export function formatTime(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}
