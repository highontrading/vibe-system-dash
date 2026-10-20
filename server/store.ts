import fs from 'node:fs';
import path from 'node:path';
import { customAlphabet } from 'nanoid';
import { EditPlan, Look, type ChatMessage, type Project, type VersionInfo } from '../src/shared/schema';
import { DEFAULT_LOOK_ID, PRESET_LOOKS } from '../src/shared/looks';
import { paths } from './config';
import { emit } from './events';

export const newId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);
export const shortId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

/** Atomic write so a crash mid-write never leaves half a JSON file. */
export function writeJson(file: string, data: unknown) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

const now = () => new Date().toISOString();

// ---------- projects ----------

const projectFile = (id: string) => path.join(paths.project(id), 'project.json');

export function listProjects(): Project[] {
  return fs
    .readdirSync(paths.projects, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => readJson<Project | null>(projectFile(d.name), null))
    .filter((p): p is Project => !!p)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getProject(id: string): Project | null {
  if (!/^[a-z0-9]+$/.test(id)) return null;
  return readJson<Project | null>(projectFile(id), null);
}

export function createProject(name: string, lookId: string, brief?: string): Project {
  const id = newId();
  fs.mkdirSync(path.join(paths.project(id), 'versions'), { recursive: true });
  fs.mkdirSync(path.join(paths.project(id), 'renders'), { recursive: true });
  const project: Project = {
    id,
    name,
    createdAt: now(),
    updatedAt: now(),
    status: 'uploading',
    lookId,
    brief,
    versions: [],
    renders: [],
  };
  writeJson(projectFile(id), project);
  return project;
}

export function updateProject(id: string, patch: Partial<Project> | ((p: Project) => Partial<Project>)): Project {
  const current = getProject(id);
  if (!current) throw new Error(`project ${id} not found`);
  const changes = typeof patch === 'function' ? patch(current) : patch;
  const next = { ...current, ...changes, updatedAt: now() };
  writeJson(projectFile(id), next);
  emit({ type: 'project', project: next });
  return next;
}

export function deleteProject(id: string) {
  if (!getProject(id)) return;
  fs.rmSync(paths.project(id), { recursive: true, force: true });
  emit({ type: 'project-deleted', id });
}

export const projectPath = (id: string, ...parts: string[]) => path.join(paths.project(id), ...parts);

// ---------- plans & versions ----------

export function getPlan(id: string): EditPlan | null {
  return readJson<EditPlan | null>(projectPath(id, 'plan.json'), null);
}

/** Saves the working plan; with `version` also stores a restorable snapshot. */
export function savePlan(id: string, plan: EditPlan, version?: { label: string; by: VersionInfo['by'] }): VersionInfo | null {
  const parsed = EditPlan.parse(plan);
  writeJson(projectPath(id, 'plan.json'), parsed);
  return version ? snapshotVersion(id, parsed, version) : null;
}

/** Stores a restorable copy of a plan without touching the working plan. */
export function snapshotVersion(id: string, plan: EditPlan, version: { label: string; by: VersionInfo['by'] }): VersionInfo {
  const info: VersionInfo = { id: shortId(), label: version.label, by: version.by, createdAt: now() };
  writeJson(projectPath(id, 'versions', `${info.id}.json`), plan);
  updateProject(id, (p) => ({ versions: [...p.versions, info] }));
  emit({ type: 'plan', projectId: id, versionId: info.id });
  return info;
}

export function getVersion(id: string, versionId: string): EditPlan | null {
  if (!/^[a-z0-9]+$/.test(versionId)) return null;
  return readJson<EditPlan | null>(projectPath(id, 'versions', `${versionId}.json`), null);
}

// ---------- chat ----------

export function getChat(id: string): ChatMessage[] {
  return readJson<ChatMessage[]>(projectPath(id, 'chat.json'), []);
}

export function addChat(id: string, role: ChatMessage['role'], text: string): ChatMessage {
  const message: ChatMessage = { id: shortId(), role, text, at: now() };
  const chat = getChat(id);
  chat.push(message);
  writeJson(projectPath(id, 'chat.json'), chat.slice(-300));
  emit({ type: 'chat', projectId: id, message });
  return message;
}

// ---------- looks ----------

export function listLooks(): (Look & { preset?: boolean })[] {
  const custom = readJson<Look[]>(paths.looks, []);
  const customIds = new Set(custom.map((l) => l.id));
  return [
    ...custom,
    ...PRESET_LOOKS.filter((l) => !customIds.has(l.id)).map((l) => ({ ...l, preset: true })),
  ];
}

export function getLook(id: string): Look {
  return listLooks().find((l) => l.id === id) ?? PRESET_LOOKS.find((l) => l.id === DEFAULT_LOOK_ID)!;
}

export function saveLook(look: Look): Look {
  const parsed = Look.parse(look);
  const custom = readJson<Look[]>(paths.looks, []).filter((l) => l.id !== parsed.id);
  writeJson(paths.looks, [parsed, ...custom]);
  return parsed;
}

export function deleteLook(id: string) {
  writeJson(paths.looks, readJson<Look[]>(paths.looks, []).filter((l) => l.id !== id));
}

// ---------- settings ----------

export type Settings = {
  /** Your own editing rules, appended to Claude's instructions on every edit. */
  editorRules: string;
  defaultLookId: string;
  defaultAspect: '9:16' | '16:9' | '1:1' | '4:5';
  claudeModel: string;
};

export function getSettings(): Settings {
  return {
    editorRules: '',
    defaultLookId: DEFAULT_LOOK_ID,
    defaultAspect: '9:16',
    claudeModel: '',
    ...readJson<Partial<Settings>>(paths.settings, {}),
  };
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch };
  writeJson(paths.settings, next);
  return next;
}
