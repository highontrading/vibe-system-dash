import { useSyncExternalStore } from 'react';
import type { EditPlan, Overlay, Zoom } from '../shared/schema';
import { ELEMENT_INFO } from '../shared/elements';
import { cutRange, keepRange, outputToSource } from '../shared/timeline';

export const uid = () => Math.random().toString(36).slice(2, 10);

export function updateOverlay(plan: EditPlan, id: string, patch: Partial<Overlay>): EditPlan {
  return { ...plan, overlays: plan.overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)) };
}

export function addOverlay(plan: EditPlan, type: Overlay['type'], sourceStart: number, text?: string): { plan: EditPlan; id: string } {
  const sample = ELEMENT_INFO[type].sample;
  const id = uid();
  const overlay: Overlay = {
    id,
    type,
    start: sourceStart,
    duration: type === 'colorCard' ? 1.8 : 1.6,
    text: text ?? sample.text ?? 'Text',
    subtext: type === 'card' && !text ? sample.subtext : undefined,
    position: sample.position ?? 'center',
  };
  return { plan: { ...plan, overlays: [...plan.overlays, overlay].sort((a, b) => a.start - b.start) }, id };
}

export function removeOverlay(plan: EditPlan, id: string): EditPlan {
  return { ...plan, overlays: plan.overlays.filter((o) => o.id !== id) };
}

export function addZoom(plan: EditPlan, sourceStart: number): { plan: EditPlan; id: string } {
  const id = uid();
  const zoom: Zoom = { id, start: sourceStart, duration: 1.2, scale: 1.18 };
  return { plan: { ...plan, zooms: [...plan.zooms, zoom].sort((a, b) => a.start - b.start) }, id };
}

export function updateZoom(plan: EditPlan, id: string, patch: Partial<Zoom>): EditPlan {
  return { ...plan, zooms: plan.zooms.map((z) => (z.id === id ? { ...z, ...patch } : z)) };
}

export function removeZoom(plan: EditPlan, id: string): EditPlan {
  return { ...plan, zooms: plan.zooms.filter((z) => z.id !== id) };
}

/** Cut or restore words a..b (inclusive) by editing the kept segments. */
export function setWordsKept(plan: EditPlan, a: number, b: number, keep: boolean): EditPlan {
  const words = plan.captions.words;
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  const prev = words[lo - 1];
  const next = words[hi + 1];
  const pad = keep ? 0.1 : 0.02;
  const start = Math.max(prev ? prev.end : 0, words[lo].start - pad);
  const end = Math.min(next ? next.start : plan.sourceDuration, words[hi].end + pad);
  const segments = keep
    ? keepRange(plan.segments, { start, end }, plan.sourceDuration, uid)
    : cutRange(plan.segments, { start, end }, uid);
  if (!segments.length) return plan; // never cut everything
  return { ...plan, segments };
}

export function setGapKept(plan: EditPlan, afterWord: number, keep: boolean): EditPlan {
  const w = plan.captions.words;
  const start = w[afterWord].end + 0.02;
  const end = w[afterWord + 1] ? w[afterWord + 1].start - 0.02 : plan.sourceDuration;
  if (end <= start) return plan;
  const segments = keep
    ? keepRange(plan.segments, { start, end }, plan.sourceDuration, uid)
    : cutRange(plan.segments, { start, end }, uid);
  return segments.length ? { ...plan, segments } : plan;
}

export function toggleEmphasis(plan: EditPlan, indexes: number[]): EditPlan {
  const set = new Set(indexes);
  const allOn = indexes.every((i) => plan.captions.words[i]?.emphasis);
  return {
    ...plan,
    captions: {
      ...plan.captions,
      words: plan.captions.words.map((w, i) => (set.has(i) ? { ...w, emphasis: allOn ? undefined : true } : w)),
    },
  };
}

export function setWordText(plan: EditPlan, index: number, text: string): EditPlan {
  return {
    ...plan,
    captions: { ...plan.captions, words: plan.captions.words.map((w, i) => (i === index ? { ...w, text } : w)) },
  };
}

export function removeSegment(plan: EditPlan, id: string): EditPlan {
  if (plan.segments.length <= 1) return plan;
  return { ...plan, segments: plan.segments.filter((s) => s.id !== id) };
}

export const outToSrc = (plan: EditPlan, t: number) => outputToSource(plan.segments, t);

// ---------- playhead store (kept outside React state so 30fps updates don't re-render the page) ----------

export function createTimeStore() {
  let time = 0;
  const subs = new Set<() => void>();
  return {
    get: () => time,
    set: (t: number) => {
      if (Math.abs(t - time) < 1e-4) return;
      time = t;
      subs.forEach((s) => s());
    },
    subscribe: (cb: () => void) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}
export type TimeStore = ReturnType<typeof createTimeStore>;

export function useTime(store: TimeStore) {
  return useSyncExternalStore(store.subscribe, store.get);
}
