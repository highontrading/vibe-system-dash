import { useState } from 'react';
import { CAPTION_POSITIONS, CAPTION_STYLES, ELEMENT_TYPES, type EditPlan, type Overlay } from '../../shared/schema';
import { ELEMENT_INFO } from '../../shared/elements';
import { formatTime, sourceToOutput } from '../../shared/timeline';
import { api } from '../api';
import { addOverlay, addZoom, removeOverlay, removeSegment, removeZoom, updateOverlay, updateZoom } from '../planOps';
import type { Selection } from './Timeline';
import { Button, cx, Field, Icon, Input, Segmented, Select, Spinner, Toggle } from './ui';

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-3 border-b border-line px-4 py-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Num({ value, onChange, step = 0.1, min = 0, max }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <Input
      type="number"
      step={step}
      min={min}
      max={max}
      value={Math.round(value * 100) / 100}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (!Number.isNaN(v)) onChange(Math.max(min, max !== undefined ? Math.min(max, v) : v));
      }}
    />
  );
}

export function Inspector({
  plan,
  projectId,
  selection,
  getSourceNow,
  onSelect,
  onChange,
  onSeekSource,
}: {
  plan: EditPlan;
  projectId: string;
  selection: Selection;
  getSourceNow: () => number;
  onSelect: (s: Selection) => void;
  onChange: (p: EditPlan) => void;
  onSeekSource: (src: number) => void;
}) {
  const [hooks, setHooks] = useState<string[] | null>(null);
  const [hooksBusy, setHooksBusy] = useState(false);
  const [hooksError, setHooksError] = useState('');
  const look = plan.look;
  const setCaptions = (patch: Partial<EditPlan['look']['captions']>) =>
    onChange({ ...plan, look: { ...look, captions: { ...look.captions, ...patch } } });
  const selectedOverlay = selection?.kind === 'overlay' ? plan.overlays.find((o) => o.id === selection.id) : undefined;
  const selectedZoom = selection?.kind === 'zoom' ? plan.zooms.find((z) => z.id === selection.id) : undefined;
  const selectedSegment = selection?.kind === 'segment' ? plan.segments.find((s) => s.id === selection.id) : undefined;
  const hookWords = plan.hook.text.split(/\s+/).filter(Boolean);

  const askHooks = async () => {
    setHooksBusy(true);
    setHooksError('');
    try {
      setHooks((await api.hooks(projectId)).hooks);
    } catch (err) {
      setHooksError((err as Error).message.slice(0, 200));
    } finally {
      setHooksBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      {selectedOverlay && (
        <Section
          title={`Selected · ${ELEMENT_INFO[selectedOverlay.type].label}`}
          action={
            <Button size="sm" variant="danger" onClick={() => (onChange(removeOverlay(plan, selectedOverlay.id)), onSelect(null))}>
              <Icon name="trash" className="h-3.5 w-3.5" /> Delete
            </Button>
          }
        >
          <Field label={selectedOverlay.type === 'emoji' ? 'Emoji' : 'Text'}>
            <Input value={selectedOverlay.text} onChange={(e) => onChange(updateOverlay(plan, selectedOverlay.id, { text: e.target.value }))} />
          </Field>
          {(selectedOverlay.type === 'card' || selectedOverlay.type === 'colorCard') && (
            <Field label="Second line">
              <Input
                value={selectedOverlay.subtext ?? ''}
                onChange={(e) => onChange(updateOverlay(plan, selectedOverlay.id, { subtext: e.target.value || undefined }))}
              />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select
                value={selectedOverlay.type}
                onChange={(type) => onChange(updateOverlay(plan, selectedOverlay.id, { type }))}
                options={ELEMENT_TYPES.map((t) => ({ value: t, label: ELEMENT_INFO[t].label }))}
              />
            </Field>
            <Field label="Position">
              <Select
                value={selectedOverlay.position}
                onChange={(position) => onChange(updateOverlay(plan, selectedOverlay.id, { position: position as Overlay['position'] }))}
                options={['top', 'center', 'bottom', 'left', 'right'].map((p) => ({ value: p, label: p }))}
              />
            </Field>
            <Field label="Starts (raw s)">
              <Num value={selectedOverlay.start} max={plan.sourceDuration} onChange={(start) => onChange(updateOverlay(plan, selectedOverlay.id, { start }))} />
            </Field>
            <Field label="Duration (s)">
              <Num value={selectedOverlay.duration} min={0.2} max={20} onChange={(duration) => onChange(updateOverlay(plan, selectedOverlay.id, { duration }))} />
            </Field>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onSeekSource(selectedOverlay.start)}>Jump to it</Button>
        </Section>
      )}

      {selectedZoom && (
        <Section
          title="Selected · Zoom"
          action={
            <Button size="sm" variant="danger" onClick={() => (onChange(removeZoom(plan, selectedZoom.id)), onSelect(null))}>
              <Icon name="trash" className="h-3.5 w-3.5" /> Delete
            </Button>
          }
        >
          <div className="grid grid-cols-3 gap-3">
            <Field label="Start (raw s)">
              <Num value={selectedZoom.start} max={plan.sourceDuration} onChange={(start) => onChange(updateZoom(plan, selectedZoom.id, { start }))} />
            </Field>
            <Field label="Duration">
              <Num value={selectedZoom.duration} min={0.2} max={30} onChange={(duration) => onChange(updateZoom(plan, selectedZoom.id, { duration }))} />
            </Field>
            <Field label="Scale">
              <Num value={selectedZoom.scale} step={0.02} min={1} max={2} onChange={(scale) => onChange(updateZoom(plan, selectedZoom.id, { scale }))} />
            </Field>
          </div>
        </Section>
      )}

      {selectedSegment && (
        <Section title="Selected · Clip">
          <p className="text-sm text-muted">
            Raw {formatTime(selectedSegment.start)} → {formatTime(selectedSegment.end)} ({(selectedSegment.end - selectedSegment.start).toFixed(1)}s)
          </p>
          <Button
            size="sm"
            variant="danger"
            disabled={plan.segments.length <= 1}
            onClick={() => (onChange(removeSegment(plan, selectedSegment.id)), onSelect(null))}
          >
            <Icon name="scissors" className="h-3.5 w-3.5" /> Cut this clip
          </Button>
          <p className="text-xs text-dim">Restore cut parts from the Transcript tab.</p>
        </Section>
      )}

      <Section title="Hook" action={<Toggle checked={plan.hook.enabled} onChange={(enabled) => onChange({ ...plan, hook: { ...plan.hook, enabled } })} />}>
        <Input value={plan.hook.text} onChange={(e) => onChange({ ...plan, hook: { ...plan.hook, text: e.target.value } })} placeholder="Quit your job?" />
        {hookWords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hookWords.map((w, i) => {
              const on = plan.hook.highlight.some((h) => h.toLowerCase() === w.toLowerCase());
              return (
                <button
                  key={i}
                  onClick={() =>
                    onChange({
                      ...plan,
                      hook: {
                        ...plan.hook,
                        highlight: on ? plan.hook.highlight.filter((h) => h.toLowerCase() !== w.toLowerCase()) : [...plan.hook.highlight, w],
                      },
                    })
                  }
                  className={cx('rounded-md px-2 py-0.5 text-xs', on ? 'bg-brand text-black' : 'bg-raised text-muted hover:text-fg')}
                >
                  {w}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">On screen</span>
          <input
            type="range"
            min={1}
            max={6}
            step={0.5}
            value={plan.hook.duration}
            onChange={(e) => onChange({ ...plan, hook: { ...plan.hook, duration: Number(e.target.value) } })}
            className="flex-1 accent-[#ffd60a]"
          />
          <span className="w-8 text-right text-xs text-muted">{plan.hook.duration}s</span>
        </div>
        <Button size="sm" onClick={askHooks} disabled={hooksBusy}>
          {hooksBusy ? <Spinner className="h-3.5 w-3.5" /> : <Icon name="sparkles" className="h-3.5 w-3.5" />} Hook ideas from Claude
        </Button>
        {hooksError && <p className="text-xs text-danger">{hooksError}</p>}
        {hooks && (
          <div className="space-y-1">
            {hooks.map((h) => (
              <button
                key={h}
                onClick={() => onChange({ ...plan, hook: { ...plan.hook, text: h, highlight: [], enabled: true } })}
                className="block w-full rounded-lg border border-line px-3 py-2 text-left text-sm hover:border-brand/60"
              >
                {h}
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Captions"
        action={<Toggle checked={plan.captions.enabled} onChange={(enabled) => onChange({ ...plan, captions: { ...plan.captions, enabled } })} />}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Style">
            <Select value={look.captions.style} onChange={(style) => setCaptions({ style })} options={CAPTION_STYLES.map((s) => ({ value: s, label: s }))} />
          </Field>
          <Field label="Position">
            <Select
              value={look.captions.position}
              onChange={(position) => setCaptions({ position })}
              options={CAPTION_POSITIONS.map((s) => ({ value: s, label: s }))}
            />
          </Field>
          <Field label="Words on screen">
            <Num value={look.captions.maxWords} step={1} min={1} max={8} onChange={(maxWords) => setCaptions({ maxWords: Math.round(maxWords) })} />
          </Field>
          <Field label="Size">
            <Num value={look.captions.size} step={0.05} min={0.5} max={2} onChange={(size) => setCaptions({ size })} />
          </Field>
        </div>
        <Toggle checked={look.captions.uppercase} onChange={(uppercase) => setCaptions({ uppercase })} label="UPPERCASE" />
        <p className="text-xs text-dim">Changes here apply to this video only. Edit the look to change it everywhere.</p>
      </Section>

      <Section title={`Elements (${plan.overlays.length})`}>
        <div className="flex flex-wrap gap-1.5">
          {ELEMENT_TYPES.map((type) => (
            <Button
              key={type}
              size="sm"
              onClick={() => {
                const r = addOverlay(plan, type, getSourceNow());
                onChange(r.plan);
                onSelect({ kind: 'overlay', id: r.id });
              }}
            >
              <Icon name="plus" className="h-3 w-3" /> {ELEMENT_INFO[type].label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-dim">Added at the playhead. Drag them on the timeline to move; drag the right edge to resize.</p>
        <div className="space-y-1">
          {plan.overlays.map((o) => {
            const out = sourceToOutput(plan.segments, o.start);
            return (
              <button
                key={o.id}
                onClick={() => (onSelect({ kind: 'overlay', id: o.id }), onSeekSource(o.start))}
                className={cx(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm',
                  selection?.id === o.id ? 'bg-raised ring-1 ring-brand/60' : 'hover:bg-raised',
                )}
              >
                <span className="truncate">
                  <span className="text-muted">{ELEMENT_INFO[o.type].label}</span> · {o.text}
                </span>
                <span className="ml-2 shrink-0 text-xs text-dim">{out === null ? 'cut' : formatTime(out)}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        title={`Zooms (${plan.zooms.length})`}
        action={
          <Button
            size="sm"
            onClick={() => {
              const r = addZoom(plan, getSourceNow());
              onChange(r.plan);
              onSelect({ kind: 'zoom', id: r.id });
            }}
          >
            <Icon name="plus" className="h-3 w-3" /> Zoom at playhead
          </Button>
        }
      >
        <Toggle
          checked={look.motion.zoomOnCuts}
          onChange={(zoomOnCuts) => onChange({ ...plan, look: { ...look, motion: { ...look.motion, zoomOnCuts } } })}
          label="Punch in on every jump cut"
        />
        <Toggle
          checked={look.motion.flashOnCuts}
          onChange={(flashOnCuts) => onChange({ ...plan, look: { ...look, motion: { ...look.motion, flashOnCuts } } })}
          label="Flash on cuts"
        />
        <Toggle
          checked={look.elements.progressBar}
          onChange={(progressBar) => onChange({ ...plan, look: { ...look, elements: { ...look.elements, progressBar } } })}
          label="Progress bar"
        />
        <Field label="Animation energy">
          <Segmented
            value={look.motion.intensity}
            onChange={(intensity) => onChange({ ...plan, look: { ...look, motion: { ...look.motion, intensity } } })}
            options={[
              { value: 'calm', label: 'Calm' },
              { value: 'medium', label: 'Medium' },
              { value: 'hype', label: 'Hype' },
            ]}
          />
        </Field>
      </Section>
    </div>
  );
}
