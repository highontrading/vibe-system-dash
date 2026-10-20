import { useState } from 'react';
import type { EditPlan, Project } from '../../shared/schema';
import { api } from '../api';
import { Button, Icon, ProgressBar, Spinner } from './ui';

const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
};

export function ExportsPanel({
  project,
  busy,
  onRender,
  onRestored,
  onDeleteProject,
}: {
  project: Project;
  busy: boolean;
  onRender: () => Promise<void>;
  onRestored: (plan: EditPlan) => void;
  onDeleteProject: () => void;
}) {
  const [copied, setCopied] = useState('');
  const rendering = project.status === 'rendering';
  return (
    <div className="h-full space-y-6 overflow-y-auto p-4">
      <section className="space-y-3">
        {rendering ? (
          <div className="space-y-2 rounded-xl border border-line bg-raised/50 p-4">
            <div className="flex items-center gap-2 text-sm"><Spinner className="h-4 w-4 text-brand" /> {project.statusDetail ?? 'Rendering…'}</div>
            <ProgressBar value={project.progress ?? 0} />
          </div>
        ) : (
          <Button variant="primary" className="w-full" disabled={busy || project.status === 'error'} onClick={onRender}>
            <Icon name="film" /> Render MP4
          </Button>
        )}
        <p className="text-xs text-dim">Renders at 1080p, H.264, ready to post on Instagram, TikTok and YouTube.</p>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Exports</h3>
        {project.renders.length === 0 && <p className="text-sm text-dim">No exports yet.</p>}
        {project.renders.map((r) => {
          const url = `/media/${project.id}/renders/${r.file}`;
          return (
            <div key={r.id} className="overflow-hidden rounded-xl border border-line bg-raised/40">
              <video src={url} controls preload="metadata" className="max-h-72 w-full bg-black" />
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="text-xs text-muted">
                  {r.aspect} · {r.durationSec.toFixed(1)}s · {(r.sizeBytes / 1024 ** 2).toFixed(1)} MB · {ago(r.createdAt)}
                </div>
                <div className="flex gap-1">
                  <a href={`${url}?download=1`} className="inline-flex h-7 items-center gap-1 rounded-lg bg-brand px-2.5 text-xs font-medium text-black">
                    <Icon name="download" className="h-3.5 w-3.5" /> Download
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Copy link (works while you're signed in)"
                    onClick={() => {
                      navigator.clipboard.writeText(new URL(url, window.location.origin).toString());
                      setCopied(r.id);
                      setTimeout(() => setCopied(''), 1500);
                    }}
                  >
                    <Icon name={copied === r.id ? 'check' : 'copy'} className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => api.deleteRender(project.id, r.id)} title="Delete export">
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <Icon name="history" className="h-3.5 w-3.5" /> Versions
        </h3>
        {[...project.versions].reverse().map((v) => (
          <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-raised">
            <div className="min-w-0">
              <div className="truncate text-sm">{v.label}</div>
              <div className="text-xs text-dim">{v.by === 'claude' ? 'Claude' : v.by === 'auto' ? 'Auto' : 'You'} · {ago(v.createdAt)}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => api.restore(project.id, v.id).then((r) => onRestored(r.plan))}>
              Restore
            </Button>
          </div>
        ))}
      </section>

      <section className="border-t border-line pt-4">
        <Button
          size="sm"
          variant="danger"
          onClick={() => window.confirm(`Delete “${project.name}” and all its exports?`) && onDeleteProject()}
        >
          <Icon name="trash" className="h-3.5 w-3.5" /> Delete this video
        </Button>
      </section>
    </div>
  );
}
