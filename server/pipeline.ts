import fs from 'node:fs';
import type { Aspect, Word } from '../src/shared/schema';
import { baselinePlan } from '../src/shared/looks';
import { claudeEdit } from './claude';
import { extractAudio, makeProxy, probe, thumbnail } from './media';
import { heavyQueue } from './queue';
import { addChat, getLook, getProject, newId, projectPath, savePlan, updateProject, writeJson } from './store';
import { transcribe } from './transcribe';

/**
 * Upload → proxy → transcript → instant auto-cut → (optional) Claude edit.
 */
export function processUpload(projectId: string, originalFile: string, opts: { aspect: Aspect; autoEdit: boolean }) {
  updateProject(projectId, { status: 'processing', statusDetail: 'Queued…', progress: 0 });
  return heavyQueue
    .run(async () => {
      const media = await probe(originalFile);
      updateProject(projectId, {
        statusDetail: 'Preparing video…',
        media: { width: media.width, height: media.height, duration: media.duration, fps: media.fps },
      });

      const proxy = projectPath(projectId, 'proxy.mp4');
      await makeProxy(originalFile, proxy, media.duration, (p) => updateProject(projectId, { progress: p }));
      await thumbnail(proxy, projectPath(projectId, 'thumb.jpg'), Math.min(1, media.duration / 3));

      let words: Word[] = [];
      if (media.hasAudio) {
        updateProject(projectId, { status: 'transcribing', statusDetail: 'Transcribing speech…', progress: 0 });
        const wav = projectPath(projectId, 'audio.wav');
        await extractAudio(proxy, wav);
        words = await transcribe(
          wav,
          (p) => updateProject(projectId, { progress: p }),
          (m) => updateProject(projectId, { statusDetail: m }),
        );
        fs.rmSync(wav, { force: true });
      }
      writeJson(projectPath(projectId, 'transcript.json'), words);

      const project = getProject(projectId)!;
      const plan = baselinePlan({ words, sourceDuration: media.duration, look: getLook(project.lookId), aspect: opts.aspect, newId });
      savePlan(projectId, plan, { label: 'Auto cut', by: 'auto' });
      updateProject(projectId, { status: 'ready', statusDetail: undefined, progress: undefined });
      addChat(projectId, 'system', `Transcribed ${words.length} words. Made an instant auto cut (pauses removed, captions on).`);
    })
    .then(() => {
      if (!opts.autoEdit) return;
      const brief = getProject(projectId)?.brief?.trim();
      return claudeEdit(
        projectId,
        brief ? `Edit this video. My brief: ${brief}` : 'Edit this video into a punchy, high-retention talking-head reel.',
      ).catch(() => undefined);
    })
    .catch((err: Error) => {
      console.error(`[${projectId}] processing failed`, err);
      updateProject(projectId, { status: 'error', statusDetail: undefined, progress: undefined, error: err.message.slice(0, 800) });
    });
}

/** Projects stuck mid-job when the server stopped can't resume; flag them. */
export function recoverInterruptedJobs(projects: { id: string; status: string }[]) {
  for (const p of projects) {
    if (p.status === 'editing' || p.status === 'rendering') {
      updateProject(p.id, { status: 'ready', statusDetail: undefined, progress: undefined });
    } else if (p.status === 'processing' || p.status === 'transcribing' || p.status === 'uploading') {
      updateProject(p.id, { status: 'error', error: 'The server restarted while this was processing. Delete it and upload again.' });
    }
  }
}
