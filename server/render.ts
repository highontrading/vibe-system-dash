import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { EditPlan, RenderInfo } from '../src/shared/schema';
import { outputDuration } from '../src/shared/timeline';
import { config, mediaToken } from './config';
import { heavyQueue } from './queue';
import { getPlan, getProject, projectPath, shortId, snapshotVersion, updateProject } from './store';

let bundlePromise: Promise<string> | null = null;

/** Webpack-bundles the Remotion composition once per server start. */
export function getBundle(): Promise<string> {
  bundlePromise ??= bundle({
    entryPoint: path.join(config.root, 'src', 'remotion', 'index.ts'),
    outDir: path.join(config.dataDir, '.remotion-bundle'),
  }).catch((err) => {
    bundlePromise = null;
    throw err;
  });
  return bundlePromise;
}

export function renderProject(projectId: string) {
  updateProject(projectId, { status: 'rendering', statusDetail: 'Queued for render…', progress: 0, error: undefined });
  return heavyQueue.run(async () => {
    const plan = getPlan(projectId);
    if (!plan || !getProject(projectId)) throw new Error('Nothing to render yet');
    try {
      updateProject(projectId, { statusDetail: 'Preparing renderer…' });
      const serveUrl = await getBundle();
      const src = `http://127.0.0.1:${config.port}/media/${projectId}/proxy.mp4?t=${mediaToken(projectId)}`;
      const inputProps = { plan: plan as EditPlan, src };
      const composition = await selectComposition({ serveUrl, id: 'Edit', inputProps, browserExecutable: config.browserExecutable });

      const id = shortId();
      const file = `${new Date().toISOString().slice(0, 10)}-${id}.mp4`;
      const outputLocation = projectPath(projectId, 'renders', file);
      let last = 0;
      await renderMedia({
        serveUrl,
        composition,
        inputProps,
        codec: 'h264',
        crf: 18,
        outputLocation,
        browserExecutable: config.browserExecutable,
        concurrency: config.renderConcurrency,
        onProgress: ({ progress }) => {
          if (progress - last > 0.02 || progress === 1) {
            last = progress;
            updateProject(projectId, { statusDetail: `Rendering ${Math.round(progress * 100)}%`, progress });
          }
        },
      });

      // Snapshot what was rendered so you can always get back to it.
      const version = snapshotVersion(projectId, plan, { label: 'Rendered', by: 'you' });
      const info: RenderInfo = {
        id,
        file,
        createdAt: new Date().toISOString(),
        aspect: plan.aspect,
        durationSec: outputDuration(plan.segments),
        sizeBytes: fs.statSync(outputLocation).size,
        versionId: version.id,
      };
      updateProject(projectId, (p) => ({ renders: [info, ...p.renders], status: 'ready', statusDetail: undefined, progress: undefined }));
      return info;
    } catch (err) {
      updateProject(projectId, { status: 'ready', statusDetail: undefined, progress: undefined, error: `Render failed: ${(err as Error).message}` });
      throw err;
    }
  });
}
