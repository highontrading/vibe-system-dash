import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { EditPlan, Look, Word } from '../src/shared/schema';
import { ClaudeEdit, claudeEditToPlan, planToClaudeEdit, wordsToText } from '../src/shared/claudeEdit';
import { ELEMENT_INFO } from '../src/shared/elements';
import { config } from './config';
import { claudeQueue } from './queue';
import { addChat, getPlan, getProject, getSettings, newId, projectPath, savePlan, updateProject } from './store';

const SYSTEM_PROMPT = fs.readFileSync(path.join(import.meta.dirname, 'prompts', 'editor.md'), 'utf8');
const running = new Map<string, ChildProcess>();

export const isClaudeRunning = (projectId: string) => running.has(projectId);

export function stopClaude(projectId: string) {
  running.get(projectId)?.kill('SIGTERM');
}

const PLATFORM: Record<EditPlan['aspect'], string> = {
  '9:16': 'Vertical 9:16: Instagram Reels / TikTok / YouTube Shorts',
  '16:9': 'Horizontal 16:9: YouTube',
  '1:1': 'Square 1:1: Instagram / LinkedIn feed',
  '4:5': 'Portrait 4:5: Instagram feed',
};

function briefMarkdown(plan: EditPlan, look: Look, brief: string | undefined, rules: string): string {
  const allowed = look.elements.allowed.map((t) => `- \`${t}\`: ${ELEMENT_INFO[t].description}`).join('\n') || '- none (no overlays)';
  return `# Brief

## Platform
${PLATFORM[plan.aspect]}. Original video is ${plan.sourceDuration.toFixed(1)}s long.

## Look: ${look.name}
- Hook style: ${look.hook.style}; captions: ${look.captions.style}, max ${look.captions.maxWords} words on screen
- Motion: ${look.motion.intensity}${look.motion.zoomOnCuts ? ', automatic punch-in on every jump cut' : ''}

## Allowed overlay types
${allowed}

## The creator's own editing rules
${rules.trim() || '(none yet; use your best judgement)'}

## What they asked for when uploading
${brief?.trim() || '(nothing specific: make it a punchy, high-retention edit)'}
`;
}

type StreamEvent = {
  type: string;
  subtype?: string;
  session_id?: string;
  is_error?: boolean;
  result?: string;
  message?: { content?: { type: string; text?: string; name?: string; input?: Record<string, unknown> }[] };
};

function toolLabel(name: string, input: Record<string, unknown> = {}): string {
  const file = typeof input.file_path === 'string' ? path.basename(input.file_path) : '';
  switch (name) {
    case 'Read':
      return `Reading ${file}`;
    case 'Write':
      return `Writing ${file}`;
    case 'Edit':
      return `Editing ${file}`;
    default:
      return `Using ${name}`;
  }
}

function claudeArgs(extra: string[], resume?: string): string[] {
  const settings = getSettings();
  const model = settings.claudeModel || config.claudeModel;
  return [
    '-p',
    '--output-format', 'stream-json',
    '--verbose',
    '--append-system-prompt', SYSTEM_PROMPT,
    '--tools', 'Read,Write,Edit,Glob,Grep',
    '--allowedTools', 'Read,Write,Edit,Glob,Grep',
    '--permission-mode', 'acceptEdits',
    '--max-turns', '40',
    ...(model ? ['--model', model] : []),
    ...(resume ? ['--resume', resume] : []),
    ...extra,
  ];
}

/** Runs `claude -p` in `cwd`, streaming progress into the project's chat. */
function runClaude(projectId: string, cwd: string, prompt: string, resume?: string) {
  return new Promise<{ sessionId?: string; ok: boolean; error?: string }>((resolve) => {
    const child = spawn(config.claudeBin, claudeArgs([], resume), { cwd, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    running.set(projectId, child);
    child.stdin.end(prompt);
    let sessionId: string | undefined;
    let buf = '';
    let stderr = '';
    let resultError: string | undefined;
    child.stdout.on('data', (chunk) => {
      buf += chunk;
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let ev: StreamEvent;
        try {
          ev = JSON.parse(line);
        } catch {
          continue;
        }
        if (ev.session_id) sessionId = ev.session_id;
        if (ev.type === 'assistant') {
          for (const block of ev.message?.content ?? []) {
            if (block.type === 'text' && block.text?.trim()) addChat(projectId, 'claude', block.text.trim());
            if (block.type === 'tool_use' && block.name) addChat(projectId, 'tool', toolLabel(block.name, block.input));
          }
        }
        if (ev.type === 'result' && ev.is_error) resultError = ev.result || ev.subtype || 'Claude reported an error';
      }
    });
    child.stderr.on('data', (d) => (stderr = (stderr + d).slice(-3000)));
    child.on('error', (err) => {
      running.delete(projectId);
      resolve({ ok: false, error: `Could not start Claude Code (${err.message}). Is the claude CLI installed?` });
    });
    child.on('close', (code, signal) => {
      running.delete(projectId);
      if (signal) return resolve({ sessionId, ok: false, error: 'Stopped.' });
      if (code !== 0 || resultError) {
        const msg = resultError || stderr.trim() || `claude exited with code ${code}`;
        const auth = /log ?in|auth|credential|token|401/i.test(msg)
          ? ' Claude Code is not signed in on the server: set CLAUDE_CODE_OAUTH_TOKEN (run `claude setup-token` on your computer).'
          : '';
        return resolve({ sessionId, ok: false, error: msg.slice(0, 600) + auth });
      }
      resolve({ sessionId, ok: true });
    });
  });
}

function loadWords(projectId: string): Word[] {
  try {
    return JSON.parse(fs.readFileSync(projectPath(projectId, 'transcript.json'), 'utf8'));
  } catch {
    return [];
  }
}

/** Sends a chat message to Claude, which edits edit.json; the result becomes a new version. */
export function claudeEdit(projectId: string, message: string) {
  addChat(projectId, 'you', message);
  updateProject(projectId, { status: 'editing', statusDetail: 'Waiting for Claude…', error: undefined });
  return claudeQueue.run(async () => {
    const project = getProject(projectId);
    const plan = getPlan(projectId);
    if (!project || !plan) throw new Error('Project is not ready yet');
    updateProject(projectId, { statusDetail: 'Claude is editing…' });

    const words = loadWords(projectId);
    const look = plan.look; // includes per-video tweaks made in the studio
    const work = projectPath(projectId, 'work');
    fs.mkdirSync(work, { recursive: true });
    const before = JSON.stringify(planToClaudeEdit(plan, words), null, 2);
    fs.writeFileSync(path.join(work, 'edit.json'), before);
    fs.writeFileSync(path.join(work, 'words.txt'), wordsToText(words));
    fs.writeFileSync(path.join(work, 'brief.md'), briefMarkdown(plan, look, project.brief, getSettings().editorRules));

    let sessionId = project.claudeSessionId;
    let prompt = sessionId
      ? `The files were refreshed with the latest version (I may have tweaked things by hand).\n\n${message}`
      : message;

    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        let result = await runClaude(projectId, work, prompt, sessionId);
        if (!result.ok && sessionId && attempt === 0 && /session|conversation/i.test(result.error ?? '')) {
          // The old session is gone (e.g. new server); start fresh.
          sessionId = undefined;
          result = await runClaude(projectId, work, message);
        }
        if (result.sessionId) sessionId = result.sessionId;
        if (!result.ok) throw new Error(result.error);

        const after = fs.readFileSync(path.join(work, 'edit.json'), 'utf8');
        if (after.trim() === before.trim()) return null; // question answered, nothing changed
        try {
          const edit = ClaudeEdit.parse(JSON.parse(after));
          const next = claudeEditToPlan(edit, plan, words, look, newId);
          return savePlan(projectId, next, { label: `Claude: ${message.slice(0, 60)}`, by: 'claude' });
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          addChat(projectId, 'system', 'The edit had a problem, asking Claude to fix it…');
          prompt = `edit.json is invalid, please fix it and write it again. Error:\n${detail.slice(0, 2000)}`;
        }
      }
      throw new Error('Claude could not produce a valid edit after 3 tries.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addChat(projectId, 'system', msg);
      throw err;
    } finally {
      updateProject(projectId, { status: 'ready', statusDetail: undefined, claudeSessionId: sessionId });
    }
  });
}

/** Asks Claude for alternative hook lines (single turn, no tools). */
export async function hookVariants(projectId: string, count = 5): Promise<string[]> {
  const words = loadWords(projectId);
  const transcript = words.map((w) => w.text).join(' ').slice(0, 6000);
  const project = getProject(projectId);
  const prompt = `Here is the transcript of a talking-head social video:\n\n"""${transcript}"""\n\n${
    project?.brief ? `Creator's brief: ${project.brief}\n\n` : ''
  }Write ${count} different on-screen hook lines for the first 2 seconds. Each 2-7 words, curiosity-driven, true to the video, varied in angle (question, bold claim, number, contrarian, story). Reply with ONLY a JSON array of strings.`;
  const settings = getSettings();
  const model = settings.claudeModel || config.claudeModel;
  const out = await new Promise<string>((resolve, reject) => {
    const child = spawn(config.claudeBin, ['-p', '--output-format', 'json', '--tools', '', '--max-turns', '1', ...(model ? ['--model', model] : [])], {
      cwd: projectPath(projectId),
      env: process.env,
    });
    child.stdin.end(prompt);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `claude exited ${code}`))));
  });
  const result = (JSON.parse(out) as { result?: string }).result ?? '';
  const match = result.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Claude did not return hook ideas');
  return (JSON.parse(match[0]) as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, count);
}

export async function claudeStatus(): Promise<{ ok: boolean; detail: string }> {
  return new Promise((resolve) => {
    const child = spawn(config.claudeBin, ['auth', 'status'], { env: process.env });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('error', () => resolve({ ok: false, detail: 'claude CLI not found' }));
    child.on('close', () => {
      try {
        const s = JSON.parse(out) as { loggedIn?: boolean; authMethod?: string };
        resolve({ ok: !!s.loggedIn, detail: s.loggedIn ? `signed in (${s.authMethod})` : 'not signed in' });
      } catch {
        resolve({ ok: !!process.env.CLAUDE_CODE_OAUTH_TOKEN || !!process.env.ANTHROPIC_API_KEY, detail: out.trim().slice(0, 200) || 'unknown' });
      }
    });
  });
}
