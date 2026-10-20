import fs from 'node:fs';
import path from 'node:path';
import {
  downloadWhisperModel,
  installWhisperCpp,
  toCaptions,
  transcribe as whisperTranscribe,
  type Language,
} from '@remotion/install-whisper-cpp';
import type { Word } from '../src/shared/schema';
import { config, paths } from './config';

let setup: Promise<void> | null = null;

// Same paths the Remotion installer uses (whisper.cpp >= 1.7.4); it doesn't export these helpers.
export const whisperExecutable = () => path.join(paths.whisper, 'build', 'bin', 'whisper-cli');
const modelPath = () => path.join(paths.whisperModels, `ggml-${config.whisperModel}.bin`);

/** Builds whisper.cpp and downloads the model the first time it's needed. */
export function ensureWhisper(log: (msg: string) => void = () => {}): Promise<void> {
  setup ??= (async () => {
    const exe = whisperExecutable();
    const model = modelPath();
    const modelOk = fs.existsSync(model) && fs.statSync(model).size > 1_000_000;
    if (fs.existsSync(exe) && modelOk) return;
    log('Setting up speech-to-text (first run only, takes a few minutes)…');
    // A half-finished earlier attempt would make the installer bail out.
    if (!fs.existsSync(exe)) fs.rmSync(paths.whisper, { recursive: true, force: true });
    if (!modelOk) fs.rmSync(model, { force: true });
    fs.mkdirSync(paths.whisperModels, { recursive: true });
    await installWhisperCpp({ to: paths.whisper, version: config.whisperVersion, printOutput: false });
    await downloadWhisperModel({ folder: paths.whisperModels, model: config.whisperModel, printOutput: false });
  })().catch((err) => {
    setup = null;
    throw new Error(
      `Speech-to-text setup failed (${err.message}). The server needs internet access to github.com and huggingface.co ` +
        'the first time, plus build tools (make, g++). Or set OPENAI_API_KEY to transcribe with OpenAI instead.',
    );
  });
  return setup;
}

/** Whisper splits words into sub-word tokens; glue the pieces back together. */
function tokensToWords(tokens: { text: string; startMs: number; endMs: number }[]): Word[] {
  const words: Word[] = [];
  for (const t of tokens) {
    const text = t.text;
    if (!text.trim() || /^\[.*\]$/.test(text.trim())) continue;
    const startsWord = /^\s/.test(text) || words.length === 0;
    const isPunct = /^[^\p{L}\p{N}]+$/u.test(text.trim());
    const last = words[words.length - 1];
    if (!startsWord || (isPunct && last)) {
      last.text += text.trim();
      last.end = Math.max(last.end, t.endMs / 1000);
    } else {
      words.push({ text: text.trim(), start: t.startMs / 1000, end: t.endMs / 1000 });
    }
  }
  // Whisper sometimes overlaps or reverses timings; make them monotonic.
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = words[i - 1];
    if (prev && w.start < prev.end) w.start = prev.end;
    if (w.end <= w.start) w.end = w.start + 0.08;
  }
  return words;
}

async function transcribeOpenAI(wavPath: string): Promise<Word[]> {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(wavPath)]), 'audio.wav');
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  if (config.whisperLanguage !== 'auto') form.append('language', config.whisperLanguage);
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.openaiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenAI transcription failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { words?: { word: string; start: number; end: number }[] };
  return (json.words ?? []).map((w) => ({ text: w.word.trim(), start: w.start, end: w.end }));
}

export async function transcribe(wavPath: string, onProgress: (p: number) => void, log: (m: string) => void): Promise<Word[]> {
  if (config.openaiKey) return transcribeOpenAI(wavPath);
  await ensureWhisper(log);
  const output = await whisperTranscribe({
    inputPath: wavPath,
    whisperPath: paths.whisper,
    whisperCppVersion: config.whisperVersion,
    model: config.whisperModel,
    modelFolder: paths.whisperModels,
    tokenLevelTimestamps: true,
    language: config.whisperLanguage as Language,
    splitOnWord: true,
    printOutput: false,
    onProgress,
  });
  const { captions } = toCaptions({ whisperCppOutput: output });
  return tokensToWords(captions.map((c) => ({ text: c.text, startMs: c.startMs, endMs: c.endMs })));
}
