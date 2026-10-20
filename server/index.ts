import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { ASPECTS, EditPlan, Look, type Aspect } from '../src/shared/schema';
import { config, mediaToken } from './config';
import { isAuthed, login, logout, requireAuth, requireMediaAuth } from './auth';
import { addClient } from './events';
import { claudeEdit, claudeStatus, hookVariants, isClaudeRunning, stopClaude } from './claude';
import { hasBinary } from './media';
import { whisperExecutable } from './transcribe';
import { processUpload, recoverInterruptedJobs } from './pipeline';
import { getBundle, renderProject } from './render';
import {
  createProject,
  deleteLook,
  deleteProject,
  getChat,
  getLook,
  getPlan,
  getProject,
  getSettings,
  getVersion,
  listLooks,
  listProjects,
  projectPath,
  saveLook,
  savePlan,
  saveSettings,
  updateProject,
} from './store';

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '20mb' }));

type Handler = (req: Request, res: Response) => unknown;
const wrap = (fn: Handler) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res)).catch(next);

const project404 = (req: Request, res: Response) => {
  const p = getProject(req.params.id as string);
  if (!p) res.status(404).json({ error: 'Project not found' });
  return p;
};

// ---------- auth ----------
app.get('/api/me', (req, res) => res.json({ authed: isAuthed(req), passwordRequired: !!config.appPassword }));
app.post('/api/login', login);
app.post('/api/logout', logout);

// ---------- media (video, thumbnails, renders) ----------
app.get('/media/:id/:file', requireMediaAuth, (req, res) => {
  const file = req.params.file as string;
  if (!['proxy.mp4', 'thumb.jpg'].includes(file)) return res.status(404).end();
  res.sendFile(projectPath(req.params.id as string, file), { maxAge: '1h' }, (err) => err && !res.headersSent && res.status(404).end());
});
app.get('/media/:id/renders/:file', requireMediaAuth, (req, res) => {
  const file = path.basename(req.params.file as string);
  const project = getProject(req.params.id as string);
  const full = projectPath(req.params.id as string, 'renders', file);
  if (!project || !fs.existsSync(full)) return res.status(404).end();
  if (req.query.download) {
    const safe = project.name.replace(/[^\w\- ]+/g, '').trim() || 'edit';
    return res.download(full, `${safe} - ${file}`);
  }
  res.sendFile(full);
});

app.use('/api', requireAuth);

app.get('/api/events', (_req, res) => addClient(res));

app.get(
  '/api/health',
  wrap(async (_req, res) => {
    const [ffmpeg, claude] = await Promise.all([hasBinary('ffmpeg'), claudeStatus()]);
    const whisperReady = fs.existsSync(whisperExecutable());
    res.json({
      ffmpeg,
      claude,
      transcription: config.openaiKey ? 'openai' : whisperReady ? `whisper.cpp (${config.whisperModel})` : 'whisper.cpp (installs on first upload)',
    });
  }),
);

// ---------- projects ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(config.dataDir, '.uploads'),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 8 * 1024 ** 3 },
});
fs.mkdirSync(path.join(config.dataDir, '.uploads'), { recursive: true });

app.get('/api/projects', (_req, res) => res.json(listProjects()));

app.post(
  '/api/projects',
  upload.array('videos', 20),
  wrap((req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) return res.status(400).json({ error: 'No video uploaded' });
    const settings = getSettings();
    const lookId = String(req.body.lookId || settings.defaultLookId);
    const aspect = (ASPECTS as readonly string[]).includes(req.body.aspect) ? (req.body.aspect as Aspect) : settings.defaultAspect;
    const brief = String(req.body.brief ?? '').slice(0, 4000) || undefined;
    const autoEdit = req.body.autoEdit === 'true';

    const created = files.map((f) => {
      const name = path.basename(f.originalname, path.extname(f.originalname)).slice(0, 80) || 'Untitled';
      const project = createProject(name, lookId, brief);
      const dest = projectPath(project.id, `original${path.extname(f.originalname).toLowerCase() || '.mp4'}`);
      fs.renameSync(f.path, dest);
      void processUpload(project.id, dest, { aspect, autoEdit });
      return getProject(project.id);
    });
    res.json(created);
  }),
);

app.get('/api/projects/:id', (req, res) => {
  const project = project404(req, res);
  if (!project) return;
  res.json({
    project,
    plan: getPlan(project.id),
    chat: getChat(project.id),
    claudeRunning: isClaudeRunning(project.id),
    media: {
      video: `/media/${project.id}/proxy.mp4?t=${mediaToken(project.id)}`,
      thumb: `/media/${project.id}/thumb.jpg?t=${mediaToken(project.id)}`,
    },
  });
});

app.patch('/api/projects/:id', (req, res) => {
  const project = project404(req, res);
  if (!project) return;
  const patch: { name?: string; lookId?: string; brief?: string } = {};
  if (typeof req.body.name === 'string') patch.name = req.body.name.slice(0, 120);
  if (typeof req.body.brief === 'string') patch.brief = req.body.brief.slice(0, 4000);
  if (typeof req.body.lookId === 'string') {
    patch.lookId = req.body.lookId;
    const plan = getPlan(project.id);
    if (plan) savePlan(project.id, { ...plan, look: getLook(req.body.lookId) });
  }
  res.json(updateProject(project.id, patch));
});

app.delete('/api/projects/:id', (req, res) => {
  if (!project404(req, res)) return;
  stopClaude(req.params.id as string);
  deleteProject(req.params.id as string);
  res.json({ ok: true });
});

app.put('/api/projects/:id/plan', (req, res) => {
  if (!project404(req, res)) return;
  const parsed = EditPlan.safeParse(req.body.plan);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const version = savePlan(req.params.id as string, parsed.data, req.body.label ? { label: String(req.body.label), by: 'you' } : undefined);
  res.json({ ok: true, version });
});

app.get('/api/projects/:id/versions/:vid', (req, res) => {
  const plan = getVersion(req.params.id as string, req.params.vid as string);
  if (!plan) return res.status(404).json({ error: 'Version not found' });
  res.json(plan);
});

app.post('/api/projects/:id/versions/:vid/restore', (req, res) => {
  const project = project404(req, res);
  if (!project) return;
  const plan = getVersion(project.id, req.params.vid as string);
  const info = project.versions.find((v) => v.id === req.params.vid);
  if (!plan || !info) return res.status(404).json({ error: 'Version not found' });
  savePlan(project.id, plan, { label: `Restored “${info.label}”`, by: 'you' });
  res.json({ plan: getPlan(project.id) });
});

app.post('/api/projects/:id/chat', (req, res) => {
  const project = project404(req, res);
  if (!project) return;
  const message = String(req.body.message ?? '').trim();
  if (!message) return res.status(400).json({ error: 'Empty message' });
  if (!getPlan(project.id)) return res.status(409).json({ error: 'Wait for the video to finish processing' });
  if (isClaudeRunning(project.id)) return res.status(409).json({ error: 'Claude is already working on this video' });
  claudeEdit(project.id, message).catch((err) => console.error('claude edit failed', err));
  res.json({ ok: true });
});

app.post('/api/projects/:id/stop', (req, res) => {
  stopClaude(req.params.id as string);
  res.json({ ok: true });
});

app.post(
  '/api/projects/:id/hooks',
  wrap(async (req, res) => {
    if (!project404(req, res)) return;
    res.json({ hooks: await hookVariants(req.params.id as string, Number(req.body.count) || 5) });
  }),
);

app.post('/api/projects/:id/render', (req, res) => {
  const project = project404(req, res);
  if (!project) return;
  if (project.status === 'rendering') return res.status(409).json({ error: 'Already rendering' });
  renderProject(project.id).catch((err) => console.error('render failed', err));
  res.json({ ok: true });
});

app.delete('/api/projects/:id/renders/:rid', (req, res) => {
  const project = project404(req, res);
  if (!project) return;
  const r = project.renders.find((x) => x.id === req.params.rid);
  if (r) fs.rmSync(projectPath(project.id, 'renders', r.file), { force: true });
  res.json(updateProject(project.id, (p) => ({ renders: p.renders.filter((x) => x.id !== req.params.rid) })));
});

// ---------- looks ----------
app.get('/api/looks', (_req, res) => res.json(listLooks()));
app.post('/api/looks', (req, res) => {
  const parsed = Look.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  res.json(saveLook(parsed.data));
});
app.delete('/api/looks/:id', (req, res) => {
  deleteLook(req.params.id as string);
  res.json({ ok: true });
});

// ---------- settings ----------
app.get('/api/settings', (_req, res) => res.json(getSettings()));
app.put('/api/settings', (req, res) => {
  const { editorRules, defaultLookId, defaultAspect, claudeModel } = req.body ?? {};
  res.json(
    saveSettings({
      ...(typeof editorRules === 'string' && { editorRules: editorRules.slice(0, 20000) }),
      ...(typeof defaultLookId === 'string' && { defaultLookId }),
      ...((ASPECTS as readonly string[]).includes(defaultAspect) && { defaultAspect }),
      ...(typeof claudeModel === 'string' && { claudeModel: claudeModel.trim() }),
    }),
  );
});

// ---------- web app ----------
const dist = path.join(config.root, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api|media).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

recoverInterruptedJobs(listProjects());

app.listen(config.port, () => {
  console.log(`Vibe Edit server on http://localhost:${config.port} (data: ${config.dataDir})`);
  if (!config.appPassword) console.warn('APP_PASSWORD is not set: anyone who can reach this server can use it.');
  // Warm the Remotion bundle so the first render starts faster.
  getBundle().catch((err) => console.warn('Remotion bundle failed:', err.message));
});
