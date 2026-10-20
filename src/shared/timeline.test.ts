import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkCaptions, cutRange, keepRange, keptWords, outputDuration, outputToSource, segmentsFromWords, sourceToOutput } from './timeline';
import { ClaudeEdit, claudeEditToPlan, planToClaudeEdit } from './claudeEdit';
import { baselinePlan, PRESET_LOOKS } from './looks';
import type { Word } from './schema';

let n = 0;
const id = () => `id${n++}`;
const segs = [
  { id: 'a', start: 1, end: 3 },
  { id: 'b', start: 5, end: 6 },
];

test('source ↔ output mapping through cuts', () => {
  assert.equal(outputDuration(segs), 3);
  assert.equal(sourceToOutput(segs, 2), 1);
  assert.equal(sourceToOutput(segs, 4), 2); // inside a cut → next kept start
  assert.equal(sourceToOutput(segs, 5.5), 2.5);
  assert.equal(sourceToOutput(segs, 7), null);
  assert.equal(outputToSource(segs, 2.5), 5.5);
});

test('cut and restore ranges', () => {
  const cut = cutRange(segs, { start: 2, end: 5.5 }, id);
  assert.deepEqual(cut.map((s) => [s.start, s.end]), [[1, 2], [5.5, 6]]);
  const restored = keepRange(cut, { start: 2, end: 5.5 }, 10, id);
  assert.deepEqual(restored.map((s) => [s.start, s.end]), [[1, 6]]);
});

const words: Word[] = [
  { text: 'Hello', start: 0.5, end: 0.8 },
  { text: 'world.', start: 0.85, end: 1.2 },
  { text: 'This', start: 3.0, end: 3.2 },
  { text: 'works', start: 3.25, end: 3.6 },
];

test('pauses become cuts and captions follow the cut', () => {
  const s = segmentsFromWords(words, 5, id);
  assert.equal(s.length, 2);
  const plan = { segments: s, captions: { enabled: true, words } };
  const kw = keptWords(plan);
  assert.equal(kw.length, 4);
  assert.ok(kw[2].oStart < 1.5, 'third word moves up after the pause is cut');
  const chunks = chunkCaptions(kw, 3);
  assert.equal(chunks[0].words.length, 2, 'sentence end starts a new chunk');
});

test('Claude edit round-trips through the compact format', () => {
  const look = PRESET_LOOKS[0];
  const plan = baselinePlan({ words, sourceDuration: 5, look, newId: id });
  const edit = ClaudeEdit.parse(JSON.parse(JSON.stringify(planToClaudeEdit(plan, words))));
  edit.captions.emphasis = [3];
  edit.captions.fixes = { '0': 'Hi' };
  edit.overlays.push({ type: 'stamp', start: 3.25, duration: 1, text: 'WORKS', position: 'right' });
  edit.overlays.push({ type: 'emoji', start: 3.25, duration: 1, text: '🔥', position: 'top' }); // not allowed by this look
  const next = claudeEditToPlan(edit, plan, words, look, id);
  assert.equal(next.captions.words[0].text, 'Hi');
  assert.equal(next.captions.words[3].emphasis, true);
  assert.deepEqual(next.overlays.map((o) => o.type), ['stamp']);
  assert.deepEqual(next.segments.map((s) => [s.start, s.end]), plan.segments.map((s) => [Math.round(s.start * 100) / 100, Math.round(s.end * 100) / 100]));
});
