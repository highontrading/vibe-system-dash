import { useEffect, useState } from 'react';
import { ASPECTS } from '../../shared/schema';
import { api, type Health, type LookWithMeta, type Settings } from '../api';
import { Button, cx, Field, Input, Select, Spinner, Textarea } from '../components/ui';

const RULES_PLACEHOLDER = `Write your editing rules here, the way you'd brief a human editor. Claude follows them on every edit. For example:

- My audience: early-stage founders. Tone: direct, no fluff.
- Keep reels between 25 and 45 seconds.
- Always open on the boldest claim, even if I say it later.
- Put a stamp on every number or stat I mention.
- Never cut my jokes; cut repeated takes and "so basically".
- Brand names to spell right: Notion, ChatGPT, HubSpot.`;

function Check({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', ok ? 'bg-ok' : 'bg-danger')} />
      <div>
        <div className="text-sm">{label}</div>
        <div className="text-xs text-muted">{detail}</div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [looks, setLooks] = useState<LookWithMeta[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.settings().then(setSettings);
    api.looks().then(setLooks);
    api.health().then(setHealth);
  }, []);

  if (!settings) return <div className="flex h-full items-center justify-center text-muted"><Spinner /></div>;

  const save = async () => {
    setSettings(await api.saveSettings(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-6 sm:px-8 sm:py-10">
      <header>
        <h1 className="font-display text-4xl sm:text-5xl">Settings</h1>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Your editing system</h2>
        <p className="text-sm text-muted">
          This is your “vibe editing system”: house rules Claude reads before every edit, on top of its built-in talking-head editing
          playbook.
        </p>
        <Textarea
          rows={12}
          value={settings.editorRules}
          placeholder={RULES_PLACEHOLDER}
          onChange={(e) => setSettings({ ...settings, editorRules: e.target.value })}
          className="font-mono text-[13px] leading-relaxed"
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Field label="Default look">
          <Select value={settings.defaultLookId} onChange={(defaultLookId) => setSettings({ ...settings, defaultLookId })} options={looks.map((l) => ({ value: l.id, label: l.name }))} />
        </Field>
        <Field label="Default format">
          <Select value={settings.defaultAspect} onChange={(defaultAspect) => setSettings({ ...settings, defaultAspect })} options={ASPECTS.map((a) => ({ value: a, label: a }))} />
        </Field>
        <Field label="Claude model" hint="Blank uses your Claude Code default. e.g. opus, sonnet">
          <Input value={settings.claudeModel} placeholder="default" onChange={(e) => setSettings({ ...settings, claudeModel: e.target.value })} />
        </Field>
      </section>

      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={save}>Save settings</Button>
        {saved && <span className="text-sm text-ok">Saved</span>}
      </div>

      <section className="space-y-1 rounded-xl border border-line bg-panel p-4">
        <h2 className="mb-2 text-sm font-semibold">System check</h2>
        {health ? (
          <>
            <Check ok={health.claude.ok} label="Claude Code" detail={health.claude.ok ? health.claude.detail : 'Not signed in. Set CLAUDE_CODE_OAUTH_TOKEN on the server (run `claude setup-token` on your computer to get one).'} />
            <Check ok={health.ffmpeg} label="FFmpeg" detail={health.ffmpeg ? 'Installed' : 'Missing: install ffmpeg on the server'} />
            <Check ok label="Speech-to-text" detail={health.transcription} />
          </>
        ) : (
          <Spinner />
        )}
      </section>
    </div>
  );
}
