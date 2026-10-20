import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ASPECTS, type Aspect, type Project } from '../../shared/schema';
import { api, uploadVideos, useProjects, type LookWithMeta } from '../api';
import { Button, cx, Empty, Field, Icon, ProgressBar, Segmented, Select, StatusBadge, Textarea, Toggle } from '../components/ui';

const ASPECT_LABEL: Record<Aspect, string> = { '9:16': '9:16 Reels', '16:9': '16:9 YouTube', '1:1': '1:1', '4:5': '4:5' };

function Uploader() {
  const navigate = useNavigate();
  const [looks, setLooks] = useState<LookWithMeta[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [lookId, setLookId] = useState('');
  const [aspect, setAspect] = useState<Aspect>('9:16');
  const [brief, setBrief] = useState('');
  const [autoEdit, setAutoEdit] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([api.looks(), api.settings()]).then(([l, s]) => {
      setLooks(l);
      setLookId(s.defaultLookId);
      setAspect(s.defaultAspect);
    });
  }, []);

  const pick = (list: FileList | null) => {
    const vids = [...(list ?? [])].filter((f) => f.type.startsWith('video/') || /\.(mov|mp4|m4v|webm|mkv)$/i.test(f.name));
    if (vids.length) setFiles(vids);
  };

  const start = async () => {
    setError('');
    setProgress(0);
    try {
      const created = await uploadVideos(files, { lookId, aspect, brief, autoEdit: String(autoEdit) }, setProgress);
      setFiles([]);
      setBrief('');
      if (created.length === 1) navigate(`/p/${created[0].id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProgress(null);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files);
          }}
          onClick={() => input.current?.click()}
          className={cx(
            'flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-colors',
            drag ? 'border-brand bg-brand/5' : 'border-line hover:border-[#3a3a40] hover:bg-raised/40',
          )}
        >
          <input ref={input} type="file" accept="video/*,.mov,.mkv" multiple hidden onChange={(e) => pick(e.target.files)} />
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-raised">
            <Icon name="upload" className="h-5 w-5 text-brand" />
          </div>
          {files.length ? (
            <div className="space-y-1">
              <div className="font-medium">{files.length === 1 ? files[0].name : `${files.length} videos selected`}</div>
              <div className="text-xs text-muted">
                {(files.reduce((a, f) => a + f.size, 0) / 1024 ** 2).toFixed(0)} MB · click to change
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="font-medium">Drop your raw talking-head clips</div>
              <div className="text-xs text-muted">MP4 or MOV, straight from your phone. Several at once = batch edit.</div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Look">
              <Select value={lookId} onChange={setLookId} options={looks.map((l) => ({ value: l.id, label: l.name }))} />
            </Field>
            <Field label="Format">
              <Select value={aspect} onChange={setAspect} options={ASPECTS.map((a) => ({ value: a, label: ASPECT_LABEL[a] }))} />
            </Field>
          </div>
          <Field label="Brief for Claude (optional)">
            <Textarea
              rows={3}
              placeholder="e.g. 30s reel for founders, hook about quitting your job, add a stamp for every number"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
          </Field>
          <Toggle checked={autoEdit} onChange={setAutoEdit} label="Let Claude edit as soon as it's transcribed" />
          {error && <p className="text-sm text-danger">{error}</p>}
          {progress !== null ? (
            <div className="space-y-1.5">
              <ProgressBar value={progress} />
              <div className="text-xs text-muted">Uploading {Math.round(progress * 100)}%</div>
            </div>
          ) : (
            <Button variant="primary" className="w-full" disabled={!files.length || !lookId} onClick={start}>
              <Icon name="sparkles" /> {files.length > 1 ? `Upload & edit ${files.length} videos` : 'Upload & edit'}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const busy = ['processing', 'transcribing', 'editing', 'rendering'].includes(project.status);
  const thumbReady = project.status !== 'uploading' && project.status !== 'processing';
  const portrait = (project.media?.height ?? 16) >= (project.media?.width ?? 9);
  return (
    <Link to={`/p/${project.id}`} className="group block overflow-hidden rounded-xl border border-line bg-panel transition-colors hover:border-[#3a3a40]">
      <div className="relative aspect-[4/5] overflow-hidden bg-raised">
        {thumbReady && (
          <img
            src={`/media/${project.id}/thumb.jpg`}
            alt=""
            className={cx('h-full w-full transition-transform duration-500 group-hover:scale-[1.03]', portrait ? 'object-cover' : 'object-contain')}
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        )}
        {project.renders.length > 0 && (
          <span className="absolute right-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-brand backdrop-blur">
            {project.renders.length} export{project.renders.length > 1 ? 's' : ''}
          </span>
        )}
        {busy && project.progress !== undefined && (
          <div className="absolute inset-x-3 bottom-3"><ProgressBar value={project.progress} /></div>
        )}
      </div>
      <div className="space-y-1 p-3">
        <div className="truncate text-sm font-medium">{project.name}</div>
        <div className="flex items-center justify-between">
          <StatusBadge status={project.status} />
          {project.media && <span className="text-xs text-dim">{Math.round(project.media.duration)}s</span>}
        </div>
        {project.statusDetail && busy && <div className="truncate text-xs text-muted">{project.statusDetail}</div>}
      </div>
    </Link>
  );
}

export function Library() {
  const projects = useProjects();
  const [filter, setFilter] = useState<'all' | 'active' | 'exported'>('all');
  const shown = projects.filter((p) =>
    filter === 'all' ? true : filter === 'exported' ? p.renders.length > 0 : p.renders.length === 0,
  );
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <header>
        <h1 className="font-display text-4xl sm:text-5xl">Library</h1>
        <p className="mt-1 text-sm text-muted">Upload raw footage. Claude cuts it, writes the hook, captions it and adds graphics in your look.</p>
      </header>
      <Uploader />
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted">{projects.length} videos</h2>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'In progress' },
              { value: 'exported', label: 'Exported' },
            ]}
          />
        </div>
        {shown.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {shown.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        ) : (
          <Empty title="Nothing here yet">Your edits will show up here once you upload a clip.</Empty>
        )}
      </section>
    </div>
  );
}
