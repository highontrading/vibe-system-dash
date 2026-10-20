import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { EditPlan } from '../../shared/schema';
import { ELEMENT_INFO } from '../../shared/elements';
import { chunkCaptions, keptWords, outputDuration, outputToSource, sourceToOutput } from '../../shared/timeline';
import { useTime, type TimeStore } from '../planOps';
import { cx } from './ui';

export type Selection = { kind: 'overlay' | 'zoom' | 'segment' | 'hook'; id: string } | null;

type Props = {
  plan: EditPlan;
  time: TimeStore;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onSeek: (outputSec: number) => void;
  onChange: (plan: EditPlan) => void;
};

const LABEL_W = 76;
const ROW_H = 30;

function Playhead({ time, pps }: { time: TimeStore; pps: number }) {
  const t = useTime(time);
  return (
    <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-brand" style={{ left: t * pps }}>
      <div className="absolute -left-[5px] -top-0.5 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-brand" />
    </div>
  );
}

/** A block you can drag to move (and resize from its right edge). Times in output seconds. */
function Block({
  start,
  duration,
  pps,
  max,
  selected,
  className,
  children,
  onClick,
  onCommit,
}: {
  start: number;
  duration: number;
  pps: number;
  max: number;
  selected: boolean;
  className: string;
  children: React.ReactNode;
  onClick: () => void;
  onCommit?: (start: number, duration: number) => void;
}) {
  const [drag, setDrag] = useState<{ start: number; duration: number } | null>(null);
  const s = drag?.start ?? start;
  const d = drag?.duration ?? duration;

  const begin = (e: React.PointerEvent, mode: 'move' | 'resize') => {
    e.stopPropagation();
    onClick();
    if (!onCommit) return;
    const x0 = e.clientX;
    let moved = false;
    let latest = { start, duration };
    const move = (ev: PointerEvent) => {
      const dt = (ev.clientX - x0) / pps;
      if (Math.abs(ev.clientX - x0) > 2) moved = true;
      latest =
        mode === 'move'
          ? { start: Math.max(0, Math.min(max - duration, start + dt)), duration }
          : { start, duration: Math.max(0.3, Math.min(max - start, duration + dt)) };
      setDrag(latest);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDrag(null);
      if (moved) onCommit(latest.start, latest.duration);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div
      onPointerDown={(e) => begin(e, 'move')}
      className={cx(
        'absolute top-1 bottom-1 flex items-center overflow-hidden rounded-md px-1.5 text-[11px] font-medium select-none',
        onCommit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        selected && 'ring-2 ring-brand ring-offset-1 ring-offset-bg',
        className,
      )}
      style={{ left: s * pps, width: Math.max(6, d * pps) }}
    >
      <span className="truncate">{children}</span>
      {onCommit && (
        <div onPointerDown={(e) => begin(e, 'resize')} className="absolute bottom-0 right-0 top-0 w-2 cursor-ew-resize hover:bg-white/20" />
      )}
    </div>
  );
}

export function Timeline({ plan, time, selection, onSelect, onSeek, onChange }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [zoom, setZoom] = useState(1);
  const total = outputDuration(plan.segments);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth - LABEL_W - 16));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pps = Math.max(8, (width / Math.max(1, total)) * zoom);
  const innerW = total * pps;

  const segBlocks = useMemo(() => {
    let acc = 0;
    return plan.segments.map((s, i) => {
      const block = { id: s.id, start: acc, duration: s.end - s.start, i };
      acc += s.end - s.start;
      return block;
    });
  }, [plan.segments]);

  const chunks = useMemo(
    () => (plan.captions.enabled ? chunkCaptions(keptWords(plan), plan.look.captions.maxWords) : []),
    [plan],
  );

  const toOut = (src: number) => sourceToOutput(plan.segments, src);
  const seekFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(total, (e.clientX - rect.left) / pps)));
  };

  const tick = pps > 60 ? 1 : pps > 25 ? 2 : pps > 12 ? 5 : 10;
  const ticks = Array.from({ length: Math.floor(total / tick) + 1 }, (_, i) => i * tick);

  const rows: { label: string; content: React.ReactNode }[] = [
    {
      label: 'Clips',
      content: segBlocks.map((b) => (
        <Block
          key={b.id}
          start={b.start}
          duration={b.duration}
          pps={pps}
          max={total}
          selected={selection?.kind === 'segment' && selection.id === b.id}
          className={b.i % 2 ? 'bg-[#2a2a31] text-muted' : 'bg-[#232329] text-muted'}
          onClick={() => onSelect({ kind: 'segment', id: b.id })}
        >
          {b.duration.toFixed(1)}s
        </Block>
      )),
    },
    {
      label: 'Hook',
      content: plan.hook.enabled && (
        <Block
          start={0}
          duration={Math.min(plan.hook.duration, total)}
          pps={pps}
          max={total}
          selected={selection?.kind === 'hook'}
          className="bg-brand/90 text-black"
          onClick={() => onSelect({ kind: 'hook', id: 'hook' })}
          onCommit={(_s, d) => onChange({ ...plan, hook: { ...plan.hook, duration: Math.round(d * 10) / 10 } })}
        >
          {plan.hook.text}
        </Block>
      ),
    },
    {
      label: 'Elements',
      content: plan.overlays.map((o) => {
        const s = toOut(o.start);
        if (s === null) return null;
        return (
          <Block
            key={o.id}
            start={s}
            duration={o.duration}
            pps={pps}
            max={total}
            selected={selection?.kind === 'overlay' && selection.id === o.id}
            className="bg-[#7c5cff]/85 text-white"
            onClick={() => onSelect({ kind: 'overlay', id: o.id })}
            onCommit={(ns, nd) =>
              onChange({
                ...plan,
                overlays: plan.overlays.map((x) =>
                  x.id === o.id ? { ...x, start: outputToSource(plan.segments, ns), duration: Math.round(nd * 10) / 10 } : x,
                ),
              })
            }
          >
            {ELEMENT_INFO[o.type].label.split(' ')[0]} · {o.text}
          </Block>
        );
      }),
    },
    {
      label: 'Zooms',
      content: plan.zooms.map((z) => {
        const s = toOut(z.start);
        if (s === null) return null;
        return (
          <Block
            key={z.id}
            start={s}
            duration={z.duration}
            pps={pps}
            max={total}
            selected={selection?.kind === 'zoom' && selection.id === z.id}
            className="bg-[#3ddc97]/80 text-black"
            onClick={() => onSelect({ kind: 'zoom', id: z.id })}
            onCommit={(ns, nd) =>
              onChange({
                ...plan,
                zooms: plan.zooms.map((x) =>
                  x.id === z.id ? { ...x, start: outputToSource(plan.segments, ns), duration: Math.round(nd * 10) / 10 } : x,
                ),
              })
            }
          >
            {z.scale.toFixed(2)}×
          </Block>
        );
      }),
    },
    {
      label: 'Captions',
      content: chunks.map((c, i) => (
        <div
          key={i}
          className="absolute top-1 bottom-1 truncate rounded-md bg-white/[0.07] px-1 text-[10px] leading-[22px] text-muted"
          style={{ left: c.start * pps, width: Math.max(4, (c.end - c.start) * pps - 1) }}
        >
          {c.words.map((w) => w.text).join(' ')}
        </div>
      )),
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted">
        <span>
          Timeline · {total.toFixed(1)}s{' '}
          <span className="text-dim">(from {plan.sourceDuration.toFixed(1)}s raw)</span>
        </span>
        <label className="flex items-center gap-2">
          Zoom
          <input type="range" min={1} max={8} step={0.25} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-24 accent-[#ffd60a]" />
        </label>
      </div>
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="relative" style={{ width: innerW + LABEL_W + 16 }}>
          <div className="sticky left-0 z-30 float-left bg-panel" style={{ width: LABEL_W }}>
            <div style={{ height: 20 }} />
            {rows.map((r) => (
              <div key={r.label} className="flex items-center pl-3 text-[11px] text-dim" style={{ height: ROW_H }}>
                {r.label}
              </div>
            ))}
          </div>
          <div className="relative" style={{ marginLeft: LABEL_W, width: innerW }}>
            <div className="relative h-5 cursor-pointer border-b border-line" onClick={seekFromEvent}>
              {ticks.map((t) => (
                <div key={t} className="absolute top-0 h-full border-l border-line pl-1 text-[10px] leading-5 text-dim" style={{ left: t * pps }}>
                  {t}s
                </div>
              ))}
            </div>
            {rows.map((r) => (
              <div key={r.label} className="relative border-b border-line/50" style={{ height: ROW_H }} onClick={seekFromEvent}>
                {r.content}
              </div>
            ))}
            <Playhead time={time} pps={pps} />
          </div>
        </div>
      </div>
    </div>
  );
}
