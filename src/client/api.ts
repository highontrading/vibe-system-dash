import { useEffect, useSyncExternalStore } from 'react';
import type { ChatMessage, EditPlan, Look, Project, ServerEvent, VersionInfo } from '../shared/schema';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401 && !url.endsWith('/login')) window.dispatchEvent(new Event('vibe:unauthorized'));
    throw new ApiError(data?.error ?? res.statusText, res.status);
  }
  return data as T;
}

export type ProjectDetail = {
  project: Project;
  plan: EditPlan | null;
  chat: ChatMessage[];
  claudeRunning: boolean;
  media: { video: string; thumb: string };
};

export type LookWithMeta = Look & { preset?: boolean };

export type Settings = {
  editorRules: string;
  defaultLookId: string;
  defaultAspect: EditPlan['aspect'];
  claudeModel: string;
};

export type Health = {
  ffmpeg: boolean;
  claude: { ok: boolean; detail: string };
  transcription: string;
};

export const api = {
  me: () => request<{ authed: boolean; passwordRequired: boolean }>('GET', '/api/me'),
  login: (password: string) => request('POST', '/api/login', { password }),
  logout: () => request('POST', '/api/logout'),
  health: () => request<Health>('GET', '/api/health'),
  projects: () => request<Project[]>('GET', '/api/projects'),
  project: (id: string) => request<ProjectDetail>('GET', `/api/projects/${id}`),
  updateProject: (id: string, patch: { name?: string; lookId?: string; brief?: string }) =>
    request<Project>('PATCH', `/api/projects/${id}`, patch),
  deleteProject: (id: string) => request('DELETE', `/api/projects/${id}`),
  savePlan: (id: string, plan: EditPlan, label?: string) =>
    request<{ ok: true; version: VersionInfo | null }>('PUT', `/api/projects/${id}/plan`, { plan, label }),
  version: (id: string, vid: string) => request<EditPlan>('GET', `/api/projects/${id}/versions/${vid}`),
  restore: (id: string, vid: string) => request<{ plan: EditPlan }>('POST', `/api/projects/${id}/versions/${vid}/restore`),
  chat: (id: string, message: string) => request('POST', `/api/projects/${id}/chat`, { message }),
  stop: (id: string) => request('POST', `/api/projects/${id}/stop`),
  hooks: (id: string) => request<{ hooks: string[] }>('POST', `/api/projects/${id}/hooks`, { count: 5 }),
  render: (id: string) => request('POST', `/api/projects/${id}/render`),
  deleteRender: (id: string, rid: string) => request<Project>('DELETE', `/api/projects/${id}/renders/${rid}`),
  looks: () => request<LookWithMeta[]>('GET', '/api/looks'),
  saveLook: (look: Look) => request<Look>('POST', '/api/looks', look),
  deleteLook: (id: string) => request('DELETE', `/api/looks/${id}`),
  settings: () => request<Settings>('GET', '/api/settings'),
  saveSettings: (s: Partial<Settings>) => request<Settings>('PUT', '/api/settings', s),
};

/** Upload with progress (fetch can't report upload progress). */
export function uploadVideos(
  files: File[],
  fields: Record<string, string>,
  onProgress: (p: number) => void,
): Promise<Project[]> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    for (const f of files) form.append('videos', f);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/projects');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      const data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data?.error ?? `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed: network error'));
    xhr.send(form);
  });
}

// ---------- live events ----------

type Listener = (e: ServerEvent) => void;
const listeners = new Set<Listener>();
let source: EventSource | null = null;

function connect() {
  if (source) return;
  source = new EventSource('/api/events');
  source.onmessage = (msg) => {
    const event = JSON.parse(msg.data) as ServerEvent;
    listeners.forEach((l) => l(event));
  };
  source.onerror = () => {
    // EventSource reconnects by itself; if auth expired the 401 handler kicks in.
  };
}

export function useServerEvents(listener: Listener) {
  useEffect(() => {
    connect();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [listener]);
}

// ---------- tiny global store for the project list ----------

let projects: Project[] = [];
const projectSubs = new Set<() => void>();
const setProjects = (next: Project[]) => {
  projects = next;
  projectSubs.forEach((s) => s());
};

export function refreshProjects() {
  return api.projects().then(setProjects);
}

listeners.add((e) => {
  if (e.type === 'project') {
    const exists = projects.some((p) => p.id === e.project.id);
    setProjects(exists ? projects.map((p) => (p.id === e.project.id ? e.project : p)) : [e.project, ...projects]);
  } else if (e.type === 'project-deleted') {
    setProjects(projects.filter((p) => p.id !== e.id));
  }
});

export function useProjects(): Project[] {
  useEffect(() => {
    connect();
    refreshProjects().catch(() => {});
  }, []);
  return useSyncExternalStore(
    (cb) => {
      projectSubs.add(cb);
      return () => projectSubs.delete(cb);
    },
    () => projects,
  );
}

export const mediaUrls = (id: string, token?: string) => ({
  thumb: `/media/${id}/thumb.jpg${token ? `?t=${token}` : ''}`,
});
