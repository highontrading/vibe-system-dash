import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ASPECTS, type EditPlan, type ServerEvent } from '../../shared/schema';
import { outputDuration, outputToSource, sourceToOutput } from '../../shared/timeline';
import { api, useServerEvents, type LookWithMeta, type ProjectDetail } from '../api';
import { ChatPanel } from '../components/ChatPanel';
import { Inspector } from '../components/Inspector';
import { Preview, type PreviewHandle } from '../components/Preview';
import { Timeline, type Selection } from '../components/Timeline';
import { TranscriptEditor } from '../components/TranscriptEditor';
import { ExportsPanel } from '../components/ExportsPanel';
import { Button, cx, Icon, ProgressBar, Segmented, Select, Spinner, StatusBadge } from '../components/ui';
import { createTimeStore } from '../planOps';

type Tab = 'claude' | 'transcript' | 'design' | 'export';

/** Undo/redo history for the working plan. */
function usePlanHistory() {
  const [plan, setPlanState] = useState<EditPlan | null>(null);
  const past = useRef<EditPlan[]>([]);
  const future = useRef<EditPlan[]>([]);
  const [, bump] = useState(0);

  const setPlan = useCallback((next: EditPlan, opts: { record?: boolean } = {}) => {
    setPlanState((prev) => {
      if (prev && opts.record !== false) {
        past.current = [...past.current.slice(-60), prev];
        future.current = [];
      }
      return next;
    });
    bump((n) => n + 1);
  }, []);
  const undo = useCallback(() => {
    setPlanState((cur) => {
      const prev = past.current.pop();
      if (!prev || !cur) return cur;
      future.current.push(cur);
      return prev;
    });
    bump((n) => n + 1);
  }, []);
  const redo = useCallback(() => {
    setPlanState((cur) => {
      const next = future.current.pop();
      if (!next || !cur) return cur;
      past.current.push(cur);
      return next;
    });
    bump((n) => n + 1);
  }, []);
  return { plan, setPlan, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}

export function Studio() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [looks, setLooks] = useState<LookWithMeta[]>([]);
  const [notFound, setNotFound] = useState(false);
  const { plan, setPlan, undo, redo, canUndo, canRedo } = usePlanHistory();
  const [tab, setTab] = useState<Tab>('claude');
  const [selection, setSelection] = useState<Selection>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [editingName, setEditingName] = useState(false);
  const time = useMemo(() => createTimeStore(), []);
  const preview = useRef<PreviewHandle>(null);
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latestPlan = useRef<EditPlan | null>(null);
  latestPlan.current = plan;

  const load = useCallback(async () => {
    try {
      const d = await api.project(id);
      setDetail(d);
      if (d.plan) setPlan(d.plan, { record: false });
      dirty.current = false;
      setSaveState('saved');
    } catch {
      setNotFound(true);
    }
  }, [id, setPlan]);

  useEffect(() => {
    load();
    api.looks().then(setLooks);
  }, [load]);

  const flush = useCallback(async () => {
    clearTimeout(saveTimer.current);
    if (!dirty.current || !latestPlan.current) return;
    dirty.current = false;
    setSaveState('saving');
    try {
      await api.savePlan(id, latestPlan.current);
      setSaveState(dirty.current ? 'unsaved' : 'saved');
    } catch {
      dirty.current = true;
      setSaveState('unsaved');
    }
  }, [id]);

  const change = useCallback(
    (next: EditPlan) => {
      setPlan(next);
      dirty.current = true;
      setSaveState('unsaved');
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, 700);
    },
    [setPlan, flush],
  );

  // Undo/redo also need saving.
  const doUndo = () => {
    undo();
    dirty.current = true;
    setSaveState('unsaved');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 700);
  };
  const doRedo = () => {
    redo();
    dirty.current = true;
    setSaveState('unsaved');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 700);
  };

  useEffect(() => () => void flush(), [flush]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection && latestPlan.current) {
        const p = latestPlan.current;
        if (selection.kind === 'overlay') change({ ...p, overlays: p.overlays.filter((o) => o.id !== selection.id) });
        if (selection.kind === 'zoom') change({ ...p, zooms: p.zooms.filter((z) => z.id !== selection.id) });
        setSelection(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useServerEvents(
    useCallback(
      (e: ServerEvent) => {
        if (e.type === 'project' && e.project.id === id) {
          setDetail((d) => {
            if (!d) return d;
            const becameReady = !d.plan && e.project.status === 'ready';
            if (becameReady) setTimeout(load, 0);
            return { ...d, project: e.project, claudeRunning: e.project.status === 'editing' };
          });
        } else if (e.type === 'chat' && e.projectId === id) {
          setDetail((d) => (d && !d.chat.some((m) => m.id === e.message.id) ? { ...d, chat: [...d.chat, e.message] } : d));
        } else if (e.type === 'plan' && e.projectId === id) {
          // A new version from Claude or a restore: pull it in unless you're mid-edit.
          api.project(id).then((d) => {
            setDetail(d);
            if (d.plan && !dirty.current) setPlan(d.plan);
          });
        } else if (e.type === 'project-deleted' && e.id === id) {
          navigate('/');
        }
      },
      [id, load, navigate, setPlan],
    ),
  );

  if (notFound) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-muted">That video doesn't exist.</p>
        <Link to="/" className="text-brand">Back to library</Link>
      </div>
    );
  }
  if (!detail) return <div className="flex h-full items-center justify-center text-muted"><Spinner /></div>;

  const { project } = detail;
  const processing = !plan;
  const busy = ['processing', 'transcribing', 'rendering', 'editing'].includes(project.status);

  const seekSource = (src: number) => {
    if (!plan) return;
    const out = sourceToOutput(plan.segments, src);
    if (out !== null) preview.current?.seek(out);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'claude', label: 'Claude' },
    { id: 'transcript', label: 'Transcript' },
    { id: 'design', label: 'Design' },
    { id: 'export', label: `Export${project.renders.length ? ` (${project.renders.length})` : ''}` },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-panel px-2 sm:px-3">
        <Link to="/" className="rounded-lg p-2 text-muted hover:bg-raised hover:text-fg" title="Library">
          <Icon name="back" />
        </Link>
        <div className="min-w-0 flex-1">
          {editingName ? (
            <input
              autoFocus
              defaultValue={project.name}
              className="w-full max-w-xs rounded bg-raised px-2 py-1 text-sm outline-none ring-1 ring-brand"
              onBlur={(e) => {
                setEditingName(false);
                const name = e.target.value.trim();
                if (name && name !== project.name) api.updateProject(id, { name });
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <button onClick={() => setEditingName(true)} className="block max-w-full truncate text-left text-sm font-medium hover:text-brand">
              {project.name}
            </button>
          )}
          <div className="flex items-center gap-2">
            <StatusBadge status={project.status} />
            {!processing && (
              <span className="hidden text-xs text-dim sm:inline">
                {saveState === 'saved' ? 'All changes saved' : saveState === 'saving' ? 'Saving…' : 'Unsaved'}
              </span>
            )}
          </div>
        </div>
        {plan && (
          <>
            <div className="hidden items-center gap-1 lg:flex">
              <Button size="sm" variant="ghost" disabled={!canUndo} onClick={doUndo} title="Undo (Ctrl/Cmd+Z)">
                <Icon name="undo" className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" disabled={!canRedo} onClick={doRedo} title="Redo (Shift+Ctrl/Cmd+Z)">
                <Icon name="undo" className="h-3.5 w-3.5 -scale-x-100" />
              </Button>
            </div>
            <div className="hidden md:block">
              <Segmented value={plan.aspect} onChange={(aspect) => change({ ...plan, aspect })} options={ASPECTS.map((a) => ({ value: a, label: a }))} />
            </div>
            <Select
              className="!h-8 !w-36 !py-1 text-xs"
              value={project.lookId}
              onChange={async (lookId) => {
                await flush();
                await api.updateProject(id, { lookId });
                load();
              }}
              options={looks.map((l) => ({ value: l.id, label: l.name }))}
            />
            <Button
              variant="primary"
              size="sm"
              className="h-8"
              disabled={project.status === 'rendering'}
              onClick={async () => {
                await flush();
                await api.render(id);
                setTab('export');
              }}
            >
              {project.status === 'rendering' ? <Spinner className="h-3.5 w-3.5" /> : <Icon name="film" className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{project.status === 'rendering' ? `${Math.round((project.progress ?? 0) * 100)}%` : 'Render'}</span>
            </Button>
          </>
        )}
      </header>

      {project.error && (
        <div className="shrink-0 border-b border-danger/30 bg-danger/10 px-4 py-2 text-xs text-danger">{project.error}</div>
      )}

      {/* Main area */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-[320px] flex-1 items-center justify-center bg-bg p-3 sm:p-5">
            {plan ? (
              <div
                className="relative h-full max-h-full"
                style={{ aspectRatio: plan.aspect.replace(':', ' / '), maxWidth: '100%' }}
              >
                <Preview ref={preview} plan={plan} src={detail.media.video} time={time} />
              </div>
            ) : (
              <div className="w-full max-w-sm space-y-3 text-center">
                {project.status === 'error' ? (
                  <>
                    <p className="text-danger">Processing failed.</p>
                    <Button variant="danger" onClick={() => api.deleteProject(id).then(() => navigate('/'))}>Delete video</Button>
                  </>
                ) : (
                  <>
                    <Spinner className="mx-auto h-6 w-6 text-brand" />
                    <p className="text-sm">{project.statusDetail ?? 'Processing…'}</p>
                    {project.progress !== undefined && <ProgressBar value={project.progress} />}
                    <p className="text-xs text-muted">You can leave this page; it keeps going in the background.</p>
                  </>
                )}
              </div>
            )}
          </div>
          {plan && (
            <div className="hidden h-[196px] shrink-0 border-t border-line bg-panel md:block">
              <Timeline
                plan={plan}
                time={time}
                selection={selection}
                onSelect={(s) => {
                  setSelection(s);
                  if (s && s.kind !== 'segment') setTab('design');
                }}
                onSeek={(t) => preview.current?.seek(t)}
                onChange={change}
              />
            </div>
          )}
        </div>

        {/* Side panel */}
        <aside className="flex h-[55vh] min-h-0 w-full shrink-0 flex-col border-t border-line bg-panel lg:h-auto lg:w-[400px] lg:border-l lg:border-t-0">
          <div className="flex shrink-0 border-b border-line px-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cx(
                  'relative px-3 py-3 text-sm transition-colors',
                  tab === t.id ? 'text-fg' : 'text-muted hover:text-fg',
                )}
              >
                {t.label}
                {tab === t.id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand" />}
                {t.id === 'claude' && detail.claudeRunning && <span className="absolute right-1 top-2.5 h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {tab === 'claude' && (
              <ChatPanel
                chat={detail.chat}
                running={detail.claudeRunning}
                disabled={processing}
                onSend={async (msg) => {
                  await flush();
                  await api.chat(id, msg);
                  setDetail((d) => (d ? { ...d, claudeRunning: true } : d));
                }}
                onStop={() => api.stop(id)}
              />
            )}
            {tab === 'transcript' && plan && (
              <TranscriptEditor
                plan={plan}
                time={time}
                onChange={change}
                onSeek={(t) => preview.current?.seek(t)}
                onSelectOverlay={(oid) => {
                  setSelection({ kind: 'overlay', id: oid });
                }}
              />
            )}
            {tab === 'design' && plan && (
              <Inspector
                plan={plan}
                projectId={id}
                selection={selection}
                getSourceNow={() => outputToSource(plan.segments, Math.min(time.get(), outputDuration(plan.segments)))}
                onSelect={setSelection}
                onChange={change}
                onSeekSource={seekSource}
              />
            )}
            {tab === 'export' && (
              <ExportsPanel
                project={project}
                busy={busy}
                onRender={async () => {
                  await flush();
                  await api.render(id);
                }}
                onRestored={(p) => {
                  setPlan(p);
                  dirty.current = false;
                  setSaveState('saved');
                }}
                onDeleteProject={() => api.deleteProject(id).then(() => navigate('/'))}
              />
            )}
            {processing && tab !== 'claude' && tab !== 'export' && (
              <div className="p-6 text-sm text-muted">Available once the video has been processed.</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
