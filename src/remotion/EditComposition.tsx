import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { EditPlan } from '../shared/schema';
import { chunkCaptions, keptWords, sourceToOutput } from '../shared/timeline';
import { ensureFonts } from './fonts';
import { Captions } from './elements/Captions';
import { Hook } from './elements/Hook';
import { OVERLAY_COMPONENTS } from './elements/Overlays';

export type EditProps = {
  plan: EditPlan;
  /** URL of the source video (H.264 proxy). */
  src: string;
  /** When set, a still image replaces the video (fast thumbnails in the look builder). */
  still?: string;
};

type FrameSeg = { id: string; from: number; frames: number; trimBefore: number; index: number };

export function frameSegments(plan: EditPlan): FrameSeg[] {
  let acc = 0;
  return plan.segments.map((s, index) => {
    const from = Math.round(acc * plan.fps);
    acc += s.end - s.start;
    return { id: s.id, from, frames: Math.max(1, Math.round(acc * plan.fps) - from), trimBefore: Math.round(s.start * plan.fps), index };
  });
}

export function totalFrames(plan: EditPlan): number {
  const segs = frameSegments(plan);
  const last = segs[segs.length - 1];
  return Math.max(1, last ? last.from + last.frames : 1);
}

const Footage: React.FC<{ plan: EditPlan; src: string; still?: string; segs: FrameSeg[] }> = ({ plan, src, still, segs }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const current = segs.find((s) => frame >= s.from && frame < s.from + s.frames) ?? segs[0];
  let scale = plan.look.motion.zoomOnCuts && current && current.index % 2 === 1 ? 1.12 : 1;
  for (const z of plan.zooms) {
    const start = sourceToOutput(plan.segments, z.start);
    if (start === null) continue;
    const ramp = Math.min(0.35, z.duration / 3);
    const k = interpolate(t, [start, start + ramp, start + z.duration - ramp, start + z.duration], [0, 1, 1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    scale *= 1 + (z.scale - 1) * k;
  }

  const media: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})` }}>
      {still ? (
        <Img src={still} style={media} />
      ) : (
        segs.map((s) => (
          <Sequence key={s.id} from={s.from} durationInFrames={s.frames} premountFor={fps}>
            <OffthreadVideo src={src} trimBefore={s.trimBefore} style={media} pauseWhenBuffering />
          </Sequence>
        ))
      )}
    </AbsoluteFill>
  );
};

const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: '#fff', opacity: interpolate(frame, [0, 4], [0.7, 0], { extrapolateRight: 'clamp' }) }} />;
};

const ProgressBar: React.FC<{ color: string; total: number }> = ({ color, total }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 0, left: 0, height: height * 0.006, width: `${(frame / total) * 100}%`, background: color }} />
    </AbsoluteFill>
  );
};

export const EditComposition: React.FC<EditProps> = ({ plan, src, still }) => {
  const { fps } = useVideoConfig();
  const look = plan.look;
  useMemo(() => ensureFonts([look.fonts.heading, look.fonts.caption, look.fonts.note]), [look.fonts.heading, look.fonts.caption, look.fonts.note]);

  const segs = useMemo(() => frameSegments(plan), [plan]);
  const total = totalFrames(plan);
  const chunks = useMemo(
    () => (plan.captions.enabled ? chunkCaptions(keptWords(plan), look.captions.maxWords) : []),
    [plan, look.captions.maxWords],
  );
  const hookFrames = Math.round(plan.hook.duration * fps);

  // Colour cards cover the frame, so they sit above the captions; other elements sit below.
  const overlays = (cards: boolean) =>
    plan.overlays
      .filter((o) => (o.type === 'colorCard') === cards)
      .map((o) => {
        const start = sourceToOutput(plan.segments, o.start);
        if (start === null) return null;
        const from = Math.round(start * fps);
        const frames = Math.max(1, Math.min(Math.round(o.duration * fps), total - from));
        const Comp = OVERLAY_COMPONENTS[o.type];
        return (
          <Sequence key={o.id} from={from} durationInFrames={frames} layout="none">
            <Comp overlay={o} look={look} durationFrames={frames} />
          </Sequence>
        );
      });

  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <Footage plan={plan} src={src} still={still} segs={segs} />

      {look.motion.flashOnCuts &&
        segs.slice(1).map((s) => (
          <Sequence key={`f${s.id}`} from={s.from} durationInFrames={5}>
            <Flash />
          </Sequence>
        ))}

      {overlays(false)}

      {chunks.length > 0 && <Captions chunks={chunks} look={look} />}

      {overlays(true)}

      {plan.hook.enabled && plan.hook.text.trim() && (
        <Sequence durationInFrames={Math.min(hookFrames, total)} layout="none">
          <Hook hook={plan.hook} look={look} durationFrames={Math.min(hookFrames, total)} />
        </Sequence>
      )}

      {look.elements.progressBar && <ProgressBar color={look.colors.accent} total={total} />}
    </AbsoluteFill>
  );
};
