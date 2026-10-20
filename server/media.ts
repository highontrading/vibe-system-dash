import { spawn } from 'node:child_process';

function run(cmd: string, args: string[], onStderr?: (line: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => {
      const s = d.toString();
      err = (err + s).slice(-4000);
      if (onStderr) s.split(/\r|\n/).forEach((l: string) => l && onStderr(l));
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err}`))));
  });
}

export type Probe = { width: number; height: number; duration: number; fps: number; hasAudio: boolean };

export async function probe(file: string): Promise<Probe> {
  const out = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file]);
  const info = JSON.parse(out);
  const video = info.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
  if (!video) throw new Error('No video stream found in this file');
  const rotation = Math.abs(
    Number(video.tags?.rotate ?? video.side_data_list?.find((d: { rotation?: number }) => d.rotation !== undefined)?.rotation ?? 0),
  );
  const swap = rotation === 90 || rotation === 270;
  const [num, den] = String(video.avg_frame_rate || video.r_frame_rate || '30/1').split('/').map(Number);
  return {
    width: swap ? video.height : video.width,
    height: swap ? video.width : video.height,
    duration: Number(info.format.duration ?? video.duration ?? 0),
    fps: den ? num / den : 30,
    hasAudio: info.streams.some((s: { codec_type: string }) => s.codec_type === 'audio'),
  };
}

/**
 * Browser-friendly H.264 copy at 30fps with frequent keyframes, so the preview
 * player can seek to every jump cut quickly. HEVC iPhone footage plays too.
 */
export function makeProxy(input: string, output: string, duration: number, onProgress: (p: number) => void) {
  return run(
    'ffmpeg',
    [
      '-y', '-i', input,
      '-vf', "scale='if(gt(iw,ih),-2,min(1080,iw))':'if(gt(iw,ih),min(1080,ih),-2)',fps=30,format=yuv420p",
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-g', '15',
      '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
      '-movflags', '+faststart',
      output,
    ],
    (line) => {
      const m = /time=(\d+):(\d+):([\d.]+)/.exec(line);
      if (m && duration > 0) onProgress(Math.min(1, (+m[1] * 3600 + +m[2] * 60 + +m[3]) / duration));
    },
  );
}

/** 16kHz mono WAV, the input format whisper.cpp expects. */
export function extractAudio(input: string, output: string) {
  return run('ffmpeg', ['-y', '-i', input, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', output]);
}

export function thumbnail(input: string, output: string, atSec: number) {
  return run('ffmpeg', ['-y', '-ss', String(atSec), '-i', input, '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '4', output]);
}

export async function hasBinary(cmd: string, args = ['-version']): Promise<boolean> {
  try {
    await run(cmd, args);
    return true;
  } catch {
    return false;
  }
}
