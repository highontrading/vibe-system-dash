import { z } from 'zod';

// Every time value in an EditPlan is in SOURCE seconds (position in the
// uploaded video). The renderer maps source time to output time through the
// kept `segments`, so cutting a segment never knocks captions or overlays out
// of sync.

export const FONT_NAMES = [
  'Inter',
  'Montserrat',
  'Poppins',
  'DMSans',
  'SpaceGrotesk',
  'BricolageGrotesque',
  'Syne',
  'Unbounded',
  'Anton',
  'BebasNeue',
  'ArchivoBlack',
  'Oswald',
  'InstrumentSerif',
  'PlayfairDisplay',
  'DMSerifDisplay',
  'Fraunces',
  'Caveat',
  'Kalam',
  'PermanentMarker',
  'SpecialElite',
] as const;
export const FontName = z.enum(FONT_NAMES);
export type FontName = z.infer<typeof FontName>;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a #rrggbb colour');

export const HOOK_STYLES = ['ransom', 'boxed', 'stacked', 'big', 'minimal'] as const;
export const CAPTION_STYLES = ['pop', 'karaoke', 'boxed', 'clean', 'single'] as const;
export const ELEMENT_TYPES = ['stamp', 'colorCard', 'note', 'emoji', 'card'] as const;
export const CAPTION_POSITIONS = ['bottom', 'middle', 'top'] as const;

export const Look = z.object({
  id: z.string(),
  name: z.string(),
  colors: z.object({
    primary: hex, // main brand colour: boxes, cards, stamps
    accent: hex, // active-word highlight
    text: hex, // caption text
    ink: hex, // text drawn on top of `primary`
  }),
  fonts: z.object({
    heading: FontName,
    caption: FontName,
    note: FontName,
  }),
  hook: z.object({
    style: z.enum(HOOK_STYLES),
    position: z.enum(['top', 'center']),
    uppercase: z.boolean(),
  }),
  captions: z.object({
    style: z.enum(CAPTION_STYLES),
    position: z.enum(CAPTION_POSITIONS),
    maxWords: z.number().int().min(1).max(8),
    uppercase: z.boolean(),
    size: z.number().min(0.5).max(2), // multiplier on the base size
  }),
  elements: z.object({
    allowed: z.array(z.enum(ELEMENT_TYPES)),
    progressBar: z.boolean(),
  }),
  motion: z.object({
    intensity: z.enum(['calm', 'medium', 'hype']),
    zoomOnCuts: z.boolean(), // alternate punch-in on every jump cut
    flashOnCuts: z.boolean(),
  }),
});
export type Look = z.infer<typeof Look>;

export const Word = z.object({
  text: z.string(),
  start: z.number().min(0),
  end: z.number().min(0),
  emphasis: z.boolean().optional(), // highlighted in the accent colour
});
export type Word = z.infer<typeof Word>;

export const Segment = z.object({
  id: z.string(),
  start: z.number().min(0),
  end: z.number().min(0),
});
export type Segment = z.infer<typeof Segment>;

export const Overlay = z.object({
  id: z.string(),
  type: z.enum(ELEMENT_TYPES),
  start: z.number().min(0),
  duration: z.number().min(0.2).max(20),
  text: z.string(), // for `emoji` this is the emoji itself
  subtext: z.string().optional(), // second line for `card` / `colorCard`
  position: z.enum(['top', 'center', 'bottom', 'left', 'right']).default('center'),
});
export type Overlay = z.infer<typeof Overlay>;

export const Zoom = z.object({
  id: z.string(),
  start: z.number().min(0),
  duration: z.number().min(0.2).max(30),
  scale: z.number().min(1).max(2),
});
export type Zoom = z.infer<typeof Zoom>;

export const ASPECTS = ['9:16', '16:9', '1:1', '4:5'] as const;
export const Aspect = z.enum(ASPECTS);
export type Aspect = z.infer<typeof Aspect>;

export const EditPlan = z.object({
  version: z.literal(1),
  aspect: Aspect,
  fps: z.number().int().min(24).max(60),
  sourceDuration: z.number().positive(),
  look: Look,
  segments: z.array(Segment).min(1),
  hook: z.object({
    enabled: z.boolean(),
    text: z.string(),
    highlight: z.array(z.string()).default([]), // words in the hook to colour with the accent
    duration: z.number().min(0.5).max(10),
  }),
  captions: z.object({
    enabled: z.boolean(),
    words: z.array(Word),
  }),
  overlays: z.array(Overlay),
  zooms: z.array(Zoom),
  summary: z.string().optional(), // Claude's note on what it did
});
export type EditPlan = z.infer<typeof EditPlan>;

export const ASPECT_SIZE: Record<Aspect, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
};

export type ProjectStatus =
  | 'uploading'
  | 'processing'
  | 'transcribing'
  | 'ready'
  | 'editing'
  | 'rendering'
  | 'error';

export type RenderInfo = {
  id: string;
  file: string;
  createdAt: string;
  aspect: Aspect;
  durationSec: number;
  sizeBytes: number;
  versionId: string;
};

export type VersionInfo = {
  id: string;
  label: string;
  createdAt: string;
  by: 'auto' | 'claude' | 'you';
};

export type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
  statusDetail?: string;
  progress?: number; // 0..1 for the current job
  error?: string;
  media?: {
    width: number;
    height: number;
    duration: number;
    fps: number;
  };
  lookId: string;
  brief?: string; // what you asked for at upload
  claudeSessionId?: string; // lets follow-up chat keep context
  versions: VersionInfo[];
  renders: RenderInfo[];
};

export type ChatMessage = {
  id: string;
  role: 'you' | 'claude' | 'tool' | 'system';
  text: string;
  at: string;
};

// Events pushed over /api/events (server-sent events).
export type ServerEvent =
  | { type: 'project'; project: Project }
  | { type: 'project-deleted'; id: string }
  | { type: 'chat'; projectId: string; message: ChatMessage }
  | { type: 'plan'; projectId: string; versionId: string };
