import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  CAPTION_POSITIONS,
  CAPTION_STYLES,
  ELEMENT_TYPES,
  FONT_NAMES,
  HOOK_STYLES,
  type EditPlan,
  type FontName,
  type Look,
  type Overlay,
} from '../../shared/schema';
import { PRESET_LOOKS } from '../../shared/looks';
import { ELEMENT_INFO } from '../../shared/elements';
import { FONT_FAMILY, loadFontNow } from '../../remotion/fonts';
import { api, useProjects, type ProjectDetail } from '../api';
import { DEMO_STILL, demoPlan } from '../demo';
import { LookThumb } from '../components/LookThumb';
import { Preview } from '../components/Preview';
import { Button, cx, Field, Icon, Input, Segmented, Select, Spinner, Toggle } from '../components/ui';
import { createTimeStore, uid } from '../planOps';

const STEPS = ['Colours', 'Fonts', 'Hook', 'Captions', 'Elements', 'Motion', 'Review'] as const;

const PALETTES: { name: string; colors: Look['colors'] }[] = [
  { name: 'Highlighter', colors: { primary: '#FFD60A', accent: '#FFD60A', text: '#FFFFFF', ink: '#111111' } },
  { name: 'Mint', colors: { primary: '#FFFFFF', accent: '#3DDC97', text: '#FFFFFF', ink: '#111111' } },
  { name: 'Signal', colors: { primary: '#FF3B30', accent: '#FFE600', text: '#FFFFFF', ink: '#FFFFFF' } },
  { name: 'Ultraviolet', colors: { primary: '#7C5CFF', accent: '#B9A8FF', text: '#FFFFFF', ink: '#FFFFFF' } },
  { name: 'Paper', colors: { primary: '#F2EDE4', accent: '#E8A33D', text: '#FFFFFF', ink: '#1A1A1A' } },
  { name: 'Ocean', colors: { primary: '#0A84FF', accent: '#64D2FF', text: '#FFFFFF', ink: '#FFFFFF' } },
  { name: 'Bubblegum', colors: { primary: '#FF5DA2', accent: '#FFD1E6', text: '#FFFFFF', ink: '#FFFFFF' } },
  { name: 'Mono', colors: { primary: '#111111', accent: '#FFFFFF', text: '#FFFFFF', ink: '#FFFFFF' } },
];

const HOOK_INFO: Record<Look['hook']['style'], string> = {
  ransom: 'Cut-out letters, like a ransom note',
  boxed: 'Clean text in a solid box',
  stacked: 'One word per line, sliding in',
  big: 'Huge outlined text that punches in',
  minimal: 'Soft text that fades up',
};
const CAPTION_INFO: Record<Look['captions']['style'], string> = {
  pop: 'Words pop in as you say them',
  karaoke: 'Current word lights up',
  boxed: 'Phrase sits in a colour box',
  clean: 'Simple, quiet subtitles',
  single: 'One big word at a time',
};

function OptionCard({
  index,
  selected,
  title,
  description,
  children,
  onClick,
  badge,
}: {
  index?: number;
  selected: boolean;
  title: string;
  description: string;
  children: React.ReactNode;
  onClick: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-panel text-left transition-all',
        selected ? 'border-fg/80 ring-1 ring-fg/60' : 'border-line hover:border-[#3a3a40]',
      )}
    >
      <div className="relative aspect-[9/14] overflow-hidden bg-raised">
        {children}
        {index !== undefined && <span className="absolute left-2 top-2 text-[11px] font-medium text-white/80 drop-shadow">{index}</span>}
        {badge}
        {selected && (
          <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-black">
            <Icon name="check" className="h-3 w-3" />
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-0.5 text-xs leading-snug text-muted">{description}</div>
      </div>
    </button>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-9 w-11 cursor-pointer rounded-lg border border-line bg-bg p-1" />
        <Input value={value} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && onChange(e.target.value.toUpperCase())} className="font-mono" />
      </div>
    </Field>
  );
}

function FontPicker({ label, value, onChange, sample }: { label: string; value: FontName; onChange: (f: FontName) => void; sample: string }) {
  useEffect(() => {
    FONT_NAMES.forEach((f) => loadFontNow(f));
  }, []);
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {FONT_NAMES.map((f) => (
          <button
            key={f}
            onClick={() => onChange(f)}
            className={cx(
              'rounded-lg border px-3 py-3 text-left transition-colors',
              value === f ? 'border-fg/80 bg-raised' : 'border-line hover:border-[#3a3a40]',
            )}
          >
            <div className="truncate text-xl leading-tight" style={{ fontFamily: `'${FONT_FAMILY[f]}'` }}>{sample}</div>
            <div className="mt-1 text-[11px] text-muted">{FONT_FAMILY[f]}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function LookBuilder() {
  const { id = 'new' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const projects = useProjects();
  const [look, setLook] = useState<Look | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [previewId, setPreviewId] = useState('');
  const [preview, setPreview] = useState<ProjectDetail | null>(null);
  const time = useMemo(() => createTimeStore(), []);

  useEffect(() => {
    api.looks().then((looks) => {
      const from = id === 'new' ? params.get('from') : id;
      const base = looks.find((l) => l.id === from) ?? PRESET_LOOKS[0];
      const { preset: _preset, ...clean } = base as Look & { preset?: boolean };
      setLook(id === 'new' ? { ...clean, id: `look-${uid()}`, name: `${base.name} copy` } : clean);
    });
  }, [id, params]);

  const ready = projects.filter((p) => p.versions.length > 0);
  useEffect(() => {
    if (!previewId && ready[0]) setPreviewId(ready[0].id);
  }, [previewId, ready]);
  useEffect(() => {
    if (previewId) api.project(previewId).then(setPreview).catch(() => setPreview(null));
  }, [previewId]);

  const still = preview ? preview.media.thumb : DEMO_STILL;
  const words = preview?.plan?.captions.words.slice(0, 40);
  const hookText = preview?.plan?.hook.text || 'Quit your job?';

  if (!look) return <div className="flex h-full items-center justify-center text-muted"><Spinner /></div>;

  const set = <K extends keyof Look>(key: K, value: Look[K]) => setLook({ ...look, [key]: value });
  const bigPlan: EditPlan = preview?.plan ? { ...preview.plan, look } : demoPlan(look, { hookText });

  // Times for card thumbnails: the frame that best shows each option.
  const capAt = words?.length ? Math.min(words[Math.min(4, words.length - 1)].end, 5) : 1.6;
  const cardWords = words?.length ? words : undefined;

  const save = async () => {
    setSaving(true);
    try {
      await api.saveLook(look);
      navigate('/looks');
    } finally {
      setSaving(false);
    }
  };

  const stepBody = () => {
    switch (STEPS[step]) {
      case 'Colours':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PALETTES.map((p) => {
                const on = JSON.stringify(p.colors) === JSON.stringify(look.colors);
                return (
                  <button
                    key={p.name}
                    onClick={() => set('colors', p.colors)}
                    className={cx('rounded-xl border p-3 text-left', on ? 'border-fg/80 bg-raised' : 'border-line hover:border-[#3a3a40]')}
                  >
                    <div className="flex h-10 overflow-hidden rounded-lg">
                      <div className="flex-[2]" style={{ background: p.colors.primary }} />
                      <div className="flex-1" style={{ background: p.colors.accent }} />
                      <div className="flex-1 bg-[#222]" />
                    </div>
                    <div className="mt-2 text-xs font-medium">{p.name}</div>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ColorInput label="Brand colour (boxes, cards)" value={look.colors.primary} onChange={(primary) => set('colors', { ...look.colors, primary })} />
              <ColorInput label="Highlight (key words)" value={look.colors.accent} onChange={(accent) => set('colors', { ...look.colors, accent })} />
              <ColorInput label="Caption text" value={look.colors.text} onChange={(text) => set('colors', { ...look.colors, text })} />
              <ColorInput label="Text on brand colour" value={look.colors.ink} onChange={(ink) => set('colors', { ...look.colors, ink })} />
            </div>
          </div>
        );
      case 'Fonts':
        return (
          <div className="space-y-8">
            <FontPicker label="Hook & headings" value={look.fonts.heading} sample="Quit your job?" onChange={(heading) => set('fonts', { ...look.fonts, heading })} />
            <FontPicker label="Captions" value={look.fonts.caption} sample="this changed everything" onChange={(caption) => set('fonts', { ...look.fonts, caption })} />
            <FontPicker label="Handwritten notes" value={look.fonts.note} sample="film once" onChange={(note) => set('fonts', { ...look.fonts, note })} />
          </div>
        );
      case 'Hook':
        return (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-4">
              <Segmented value={look.hook.position} onChange={(position) => set('hook', { ...look.hook, position })} options={[{ value: 'top', label: 'Top' }, { value: 'center', label: 'Centre' }]} />
              <Toggle checked={look.hook.uppercase} onChange={(uppercase) => set('hook', { ...look.hook, uppercase })} label="UPPERCASE" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {HOOK_STYLES.map((style, i) => {
                const l = { ...look, hook: { ...look.hook, style } };
                return (
                  <OptionCard key={style} index={i + 1} selected={look.hook.style === style} title={style[0].toUpperCase() + style.slice(1)} description={HOOK_INFO[style]} onClick={() => set('hook', l.hook)}>
                    <LookThumb plan={demoPlan(l, { captions: false, hookText })} still={still} atSec={1.2} className="h-full w-full" />
                  </OptionCard>
                );
              })}
            </div>
          </div>
        );
      case 'Captions':
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {CAPTION_STYLES.map((style, i) => {
                const l = { ...look, captions: { ...look.captions, style } };
                return (
                  <OptionCard key={style} index={i + 1} selected={look.captions.style === style} title={style[0].toUpperCase() + style.slice(1)} description={CAPTION_INFO[style]} onClick={() => set('captions', l.captions)}>
                    <LookThumb plan={demoPlan(l, { hook: false, words: cardWords })} still={still} atSec={capAt} className="h-full w-full" />
                  </OptionCard>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Position">
                <Select value={look.captions.position} onChange={(position) => set('captions', { ...look.captions, position })} options={CAPTION_POSITIONS.map((p) => ({ value: p, label: p }))} />
              </Field>
              <Field label={`Words on screen: ${look.captions.maxWords}`}>
                <input type="range" min={1} max={8} value={look.captions.maxWords} onChange={(e) => set('captions', { ...look.captions, maxWords: Number(e.target.value) })} className="w-full accent-[#ffd60a]" />
              </Field>
              <Field label={`Size: ${look.captions.size.toFixed(2)}×`}>
                <input type="range" min={0.6} max={1.6} step={0.05} value={look.captions.size} onChange={(e) => set('captions', { ...look.captions, size: Number(e.target.value) })} className="w-full accent-[#ffd60a]" />
              </Field>
              <div className="flex items-end pb-2">
                <Toggle checked={look.captions.uppercase} onChange={(uppercase) => set('captions', { ...look.captions, uppercase })} label="UPPERCASE" />
              </div>
            </div>
          </div>
        );
      case 'Elements':
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {ELEMENT_TYPES.map((type, i) => {
                const info = ELEMENT_INFO[type];
                const on = look.elements.allowed.includes(type);
                const overlay: Overlay = { id: `demo-${type}`, type, start: 0.3, duration: 4, text: info.sample.text ?? 'Text', subtext: info.sample.subtext, position: info.sample.position ?? 'center' };
                return (
                  <OptionCard
                    key={type}
                    index={i + 1}
                    selected={on}
                    title={info.label}
                    description={info.description}
                    onClick={() =>
                      set('elements', {
                        ...look.elements,
                        allowed: on ? look.elements.allowed.filter((t) => t !== type) : [...look.elements.allowed, type],
                      })
                    }
                  >
                    <LookThumb plan={demoPlan(look, { hook: false, captions: false, overlays: [overlay] })} still={still} atSec={1.4} className="h-full w-full" />
                  </OptionCard>
                );
              })}
            </div>
            <Toggle checked={look.elements.progressBar} onChange={(progressBar) => set('elements', { ...look.elements, progressBar })} label="Progress bar across the top" />
            <p className="text-xs text-dim">Claude only uses the elements you tick here. You can still add any element by hand in the studio.</p>
          </div>
        );
      case 'Motion':
        return (
          <div className="max-w-xl space-y-6">
            <Field label="Animation energy">
              <Segmented
                value={look.motion.intensity}
                onChange={(intensity) => set('motion', { ...look.motion, intensity })}
                options={[{ value: 'calm', label: 'Calm' }, { value: 'medium', label: 'Medium' }, { value: 'hype', label: 'Hype' }]}
              />
            </Field>
            <Toggle checked={look.motion.zoomOnCuts} onChange={(zoomOnCuts) => set('motion', { ...look.motion, zoomOnCuts })} label="Punch in on every jump cut (alternating zoom)" />
            <Toggle checked={look.motion.flashOnCuts} onChange={(flashOnCuts) => set('motion', { ...look.motion, flashOnCuts })} label="White flash on cuts" />
            <p className="text-sm text-muted">Hit play on the preview to feel the motion.</p>
          </div>
        );
      case 'Review':
        return (
          <div className="max-w-xl space-y-5">
            <Field label="Name this look">
              <Input value={look.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
              <dt className="text-muted">Colours</dt>
              <dd className="flex gap-1">{Object.values(look.colors).map((c, i) => <span key={i} className="h-5 w-5 rounded border border-line" style={{ background: c }} />)}</dd>
              <dt className="text-muted">Fonts</dt>
              <dd>{FONT_FAMILY[look.fonts.heading]} / {FONT_FAMILY[look.fonts.caption]} / {FONT_FAMILY[look.fonts.note]}</dd>
              <dt className="text-muted">Hook</dt>
              <dd>{look.hook.style}, {look.hook.position}</dd>
              <dt className="text-muted">Captions</dt>
              <dd>{look.captions.style}, {look.captions.position}, {look.captions.maxWords} words</dd>
              <dt className="text-muted">Elements</dt>
              <dd>{look.elements.allowed.map((t) => ELEMENT_INFO[t].label).join(', ') || 'none'}</dd>
              <dt className="text-muted">Motion</dt>
              <dd>{look.motion.intensity}{look.motion.zoomOnCuts ? ', punch-ins' : ''}{look.motion.flashOnCuts ? ', flashes' : ''}</dd>
            </dl>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:flex-row lg:px-8">
        {/* Live preview */}
        <div className="shrink-0 space-y-3 lg:sticky lg:top-6 lg:w-[300px] lg:self-start">
          <div className="mx-auto aspect-[9/16] w-full max-w-[300px]">
            {preview?.plan ? (
              <Preview plan={bigPlan} src={preview.media.video} time={time} loop />
            ) : (
              <Preview plan={bigPlan} src="" still={DEMO_STILL} time={time} loop />
            )}
          </div>
          <Field label="Previewing">
            <Select
              value={previewId || 'demo'}
              onChange={(v) => (v === 'demo' ? (setPreviewId(''), setPreview(null)) : setPreviewId(v))}
              options={[{ value: 'demo', label: 'Demo footage' }, ...ready.map((p) => ({ value: p.id, label: p.name }))]}
            />
          </Field>
        </div>

        {/* Steps */}
        <div className="min-w-0 flex-1 space-y-5">
          <nav className="flex gap-1 overflow-x-auto border-b border-line">
            {STEPS.map((s, i) => (
              <button
                key={s}
                onClick={() => setStep(i)}
                className={cx('relative shrink-0 px-3 py-2.5 text-sm', step === i ? 'font-semibold text-fg' : 'text-muted hover:text-fg')}
              >
                {i + 1} {s}
                {step === i && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-fg" />}
              </button>
            ))}
          </nav>
          <p className="text-sm text-muted">
            Step {step + 1} of {STEPS.length}.{' '}
            {['Pick your brand colours.', 'Choose your type.', 'How the opening hook appears.', 'How your words show up on screen.', 'Tick every element you want in your edits. Shown in your colours and fonts.', 'How much things move.', 'Name it and save.'][step]}
          </p>
          {stepBody()}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur lg:px-8">
        <Button variant="ghost" onClick={() => (step === 0 ? navigate('/looks') : setStep(step - 1))}>
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        <span className="hidden text-xs text-muted sm:inline">{look.name} · {look.elements.allowed.length} elements picked</span>
        {step < STEPS.length - 1 ? (
          <Button variant="primary" onClick={() => setStep(step + 1)}>Next: {STEPS[step + 1]}</Button>
        ) : (
          <Button variant="primary" onClick={save} disabled={saving || !look.name.trim()}>
            {saving ? <Spinner /> : <Icon name="check" />} Save look
          </Button>
        )}
      </div>
    </div>
  );
}
