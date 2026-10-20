import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');

export const config = {
  root,
  port: Number(process.env.PORT ?? 8787),
  dataDir: path.resolve(process.env.DATA_DIR ?? path.join(root, 'data')),
  appPassword: process.env.APP_PASSWORD ?? '',
  /** Model passed to `claude --model`. Empty uses your Claude Code default. */
  claudeModel: process.env.CLAUDE_MODEL ?? '',
  claudeBin: process.env.CLAUDE_BIN ?? 'claude',
  whisperModel: (process.env.WHISPER_MODEL ?? 'small') as
    | 'tiny' | 'tiny.en' | 'base' | 'base.en' | 'small' | 'small.en' | 'medium' | 'medium.en' | 'large-v3-turbo',
  whisperLanguage: process.env.WHISPER_LANGUAGE ?? 'auto',
  whisperVersion: '1.7.6',
  openaiKey: process.env.OPENAI_API_KEY ?? '',
  browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE || null,
  renderConcurrency: process.env.RENDER_CONCURRENCY ? Number(process.env.RENDER_CONCURRENCY) : null,
  isProd: process.env.NODE_ENV === 'production',
};

export const paths = {
  projects: path.join(config.dataDir, 'projects'),
  whisper: path.join(config.dataDir, 'whisper'),
  whisperModels: path.join(config.dataDir, 'whisper-models'),
  looks: path.join(config.dataDir, 'looks.json'),
  settings: path.join(config.dataDir, 'settings.json'),
  secret: path.join(config.dataDir, '.secret'),
  project: (id: string) => path.join(config.dataDir, 'projects', id),
};

fs.mkdirSync(paths.projects, { recursive: true });

/** Persistent secret used to sign login cookies and internal media URLs. */
export const secret: string = (() => {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  try {
    return fs.readFileSync(paths.secret, 'utf8').trim();
  } catch {
    const s = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(paths.secret, s, { mode: 0o600 });
    return s;
  }
})();

export const mediaToken = (projectId: string) =>
  crypto.createHmac('sha256', secret).update(`media:${projectId}`).digest('hex').slice(0, 32);
