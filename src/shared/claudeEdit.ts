import { z } from 'zod';
import { Aspect, ELEMENT_TYPES, type EditPlan, type Look, type Word } from './schema';
import { normalizeSegments } from './timeline';

/**
 * The compact file Claude edits (`edit.json`). It leaves out the bulky word
 * list: captions are referenced by word index instead, which keeps Claude's
 * output small and stops it from mangling timings.
 */
export const ClaudeEdit = z.object({
  aspect: Aspect.optional(),
  keep: z.array(z.tuple([z.number(), z.number()])).min(1),
  hook: z.object({
    enabled: z.boolean(),
    text: z.string(),
    highlight: z.array(z.string()).default([]),
    duration: z.number().min(0.5).max(10).default(2.5),
  }),
  captions: z.object({
    enabled: z.boolean(),
    emphasis: z.array(z.number().int()).default([]),
    fixes: z.record(z.string(), z.string()).default({}),
  }),
  overlays: z
    .array(
      z.object({
        type: z.enum(ELEMENT_TYPES),
        start: z.number().min(0),
        duration: z.number().min(0.2).max(20),
        text: z.string().min(1),
        subtext: z.string().optional(),
        position: z.enum(['top', 'center', 'bottom', 'left', 'right']).default('center'),
      }),
    )
    .default([]),
  zooms: z
    .array(z.object({ start: z.number().min(0), duration: z.number().min(0.2).max(30), scale: z.number().min(1).max(2) }))
    .default([]),
  summary: z.string().default(''),
});
export type ClaudeEdit = z.infer<typeof ClaudeEdit>;

const r2 = (n: number) => Math.round(n * 100) / 100;

export function planToClaudeEdit(plan: EditPlan, originalWords: Word[]): ClaudeEdit {
  const fixes: Record<string, string> = {};
  plan.captions.words.forEach((w, i) => {
    if (originalWords[i] && originalWords[i].text !== w.text) fixes[String(i)] = w.text;
  });
  return {
    aspect: plan.aspect,
    keep: plan.segments.map((s) => [r2(s.start), r2(s.end)]),
    hook: { ...plan.hook },
    captions: {
      enabled: plan.captions.enabled,
      emphasis: plan.captions.words.flatMap((w, i) => (w.emphasis ? [i] : [])),
      fixes,
    },
    overlays: plan.overlays.map(({ id: _id, ...o }) => ({ ...o, start: r2(o.start) })),
    zooms: plan.zooms.map(({ id: _id, ...z }) => ({ ...z, start: r2(z.start) })),
    summary: plan.summary ?? '',
  };
}

export function claudeEditToPlan(
  edit: ClaudeEdit,
  base: EditPlan,
  originalWords: Word[],
  look: Look,
  newId: () => string,
): EditPlan {
  const emphasis = new Set(edit.captions.emphasis);
  const words = originalWords.map((w, i) => ({
    ...w,
    text: edit.captions.fixes[String(i)] ?? w.text,
    emphasis: emphasis.has(i) || undefined,
  }));
  const segments = normalizeSegments(
    edit.keep.map(([start, end]) => ({ id: newId(), start, end })),
    base.sourceDuration,
  );
  if (!segments.length) throw new Error('"keep" removed the whole video; keep at least one range.');
  return {
    ...base,
    aspect: edit.aspect ?? base.aspect,
    look,
    segments,
    hook: edit.hook,
    captions: { enabled: edit.captions.enabled, words },
    // Types the look allows, plus any you added by hand.
    overlays: edit.overlays
      .filter((o) => look.elements.allowed.includes(o.type) || base.overlays.some((b) => b.type === o.type))
      .map((o) => ({ ...o, id: newId() })),
    zooms: edit.zooms.map((z) => ({ ...z, id: newId() })),
    summary: edit.summary,
  };
}

/** Human/Claude-readable transcript: one word per line with its index and timing. */
export function wordsToText(words: Word[]): string {
  const lines: string[] = [];
  words.forEach((w, i) => {
    const prev = words[i - 1];
    const gap = prev ? w.start - prev.end : w.start;
    if (gap >= 0.4) lines.push(`-- pause ${gap.toFixed(1)}s --`);
    lines.push(`${i}\t${w.start.toFixed(2)}-${w.end.toFixed(2)}\t${w.text}`);
  });
  return lines.join('\n');
}
