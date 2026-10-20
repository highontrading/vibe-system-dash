import { useEffect, useMemo, useState } from 'react';
import type { EditPlan, Overlay } from '../../shared/schema';
import { ELEMENT_INFO } from '../../shared/elements';
import { isKept, outputToSource, sourceToOutput } from '../../shared/timeline';
import { addOverlay, setGapKept, setWordsKept, setWordText, toggleEmphasis, useTime, type TimeStore } from '../planOps';
import { Button, cx, Icon } from './ui';

type Props = {
  plan: EditPlan;
  time: TimeStore;
  onChange: (plan: EditPlan) => void;
  onSeek: (outputSec: number) => void;
  onSelectOverlay: (id: string) => void;
};

/** Edit the video by editing the text: select words, cut or restore them. */
export function TranscriptEditor({ plan, time, onChange, onSeek, onSelectOverlay }: Props) {
  const words = plan.captions.words;
  const t = useTime(time);
  const srcNow = outputToSource(plan.segments, t);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  useEffect(() => {
    const up = () => setDragging(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const kept = useMemo(() => words.map((w) => isKept(plan.segments, (w.start + w.end) / 2)), [words, plan.segments]);
  const sel = anchor !== null && focus !== null ? ([Math.min(anchor, focus), Math.max(anchor, focus)] as const) : null;
  const selIdx = sel ? Array.from({ length: sel[1] - sel[0] + 1 }, (_, i) => sel[0] + i) : [];
  const selKept = selIdx.filter((i) => kept[i]).length;
  const activeIdx = words.findIndex((w) => srcNow >= w.start && srcNow < w.end + 0.05);

  if (!words.length) {
    return <div className="p-6 text-sm text-muted">No speech was found in this video, so there is no transcript to edit.</div>;
  }

  const clear = () => {
    setAnchor(null);
    setFocus(null);
  };

  const addFromSelection = (type: Overlay['type']) => {
    if (!sel) return;
    const text = type === 'emoji' ? undefined : selIdx.map((i) => words[i].text).join(' ').replace(/[.,!?]$/, '');
    const r = addOverlay(plan, type, words[sel[0]].start, text);
    onChange(r.plan);
    onSelectOverlay(r.id);
    clear();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 border-b border-line px-3 py-2">
        {sel ? (
          <>
            <span className="mr-1 text-xs text-muted">{selIdx.length} word{selIdx.length > 1 ? 's' : ''}</span>
            {selKept > 0 && (
              <Button size="sm" onClick={() => (onChange(setWordsKept(plan, sel[0], sel[1], false)), clear())}>
                <Icon name="scissors" className="h-3.5 w-3.5" /> Cut
              </Button>
            )}
            {selKept < selIdx.length && (
              <Button size="sm" onClick={() => (onChange(setWordsKept(plan, sel[0], sel[1], true)), clear())}>
                <Icon name="undo" className="h-3.5 w-3.5" /> Restore
              </Button>
            )}
            <Button size="sm" onClick={() => onChange(toggleEmphasis(plan, selIdx))}>Highlight</Button>
            {(['stamp', 'card', 'colorCard', 'note'] as const).map((type) => (
              <Button key={type} size="sm" variant="ghost" onClick={() => addFromSelection(type)}>
                + {ELEMENT_INFO[type].label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </>
        ) : (
          <span className="text-xs text-muted">Drag across words to cut, restore, highlight or turn them into graphics. Double-click a word to fix its spelling.</span>
        )}
      </div>
      <div className="min-h-0 flex-1 select-none overflow-y-auto px-4 py-3 text-[15px] leading-8">
        {words.map((w, i) => {
          const gap = i > 0 ? w.start - words[i - 1].end : 0;
          const gapKept = i > 0 && isKept(plan.segments, (words[i - 1].end + w.start) / 2);
          const inSel = sel && i >= sel[0] && i <= sel[1];
          return (
            <span key={i}>
              {gap >= 0.4 && (
                <button
                  title={gapKept ? 'Pause kept. Click to cut it' : 'Pause cut. Click to keep it'}
                  onClick={() => onChange(setGapKept(plan, i - 1, !gapKept))}
                  className={cx(
                    'mx-0.5 rounded px-1 align-middle text-[10px] leading-4',
                    gapKept ? 'bg-brand/15 text-brand' : 'bg-white/5 text-dim line-through',
                  )}
                >
                  {gap.toFixed(1)}s
                </button>
              )}
              {editing === i ? (
                <input
                  autoFocus
                  defaultValue={w.text}
                  className="w-24 rounded bg-raised px-1 text-[15px] outline-none ring-1 ring-brand"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== w.text) onChange(setWordText(plan, i, v));
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditing(null);
                  }}
                />
              ) : (
                <span
                  onMouseDown={(e) => {
                    if (e.shiftKey && anchor !== null) {
                      setFocus(i);
                      return;
                    }
                    setAnchor(i);
                    setFocus(i);
                    setDragging(true);
                  }}
                  onMouseEnter={() => dragging && setFocus(i)}
                  onClick={() => {
                    if (anchor === i && focus === i && kept[i]) {
                      const o = sourceToOutput(plan.segments, w.start);
                      if (o !== null) onSeek(o);
                    }
                  }}
                  onDoubleClick={() => setEditing(i)}
                  className={cx(
                    'cursor-text rounded px-[2px] py-0.5 transition-colors',
                    !kept[i] && 'text-dim line-through decoration-danger/70',
                    kept[i] && w.emphasis && 'font-semibold text-brand',
                    i === activeIdx && kept[i] && 'bg-white/15',
                    inSel && 'bg-brand/30 text-fg',
                  )}
                >
                  {w.text}
                </span>
              )}{' '}
            </span>
          );
        })}
      </div>
    </div>
  );
}
