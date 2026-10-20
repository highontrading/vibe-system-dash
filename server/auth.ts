import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config, mediaToken, secret } from './config';

const COOKIE = 'vibe_session';
const sessionValue = () => crypto.createHmac('sha256', secret).update(`session:${config.appPassword}`).digest('hex');

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function isAuthed(req: Request): boolean {
  if (!config.appPassword) return true;
  const c = readCookie(req, COOKIE);
  return !!c && safeEqual(c, sessionValue());
}

export function login(req: Request, res: Response) {
  const password = String(req.body?.password ?? '');
  if (!config.appPassword || safeEqual(password, config.appPassword)) {
    res.cookie(COOKIE, sessionValue(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      maxAge: 1000 * 60 * 60 * 24 * 60,
    });
    return res.json({ ok: true });
  }
  setTimeout(() => res.status(401).json({ error: 'Wrong password' }), 600);
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: 'Not signed in' });
}

/** Media is reachable with a session, or with the per-project token the renderer uses. */
export function requireMediaAuth(req: Request, res: Response, next: NextFunction) {
  const t = typeof req.query.t === 'string' ? req.query.t : '';
  if (isAuthed(req) || (t && safeEqual(t, mediaToken(req.params.id as string)))) return next();
  res.status(401).end();
}
