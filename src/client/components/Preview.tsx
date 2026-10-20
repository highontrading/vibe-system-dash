import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { ASPECT_SIZE, type EditPlan } from '../../shared/schema';
import { EditComposition, totalFrames, type EditProps } from '../../remotion/EditComposition';
import type { TimeStore } from '../planOps';

export type PreviewHandle = { seek: (outputSec: number) => void; toggle: () => void };

/** Live Remotion preview of the edit plan: what you see is what renders. */
export const Preview = forwardRef<PreviewHandle, { plan: EditPlan; src: string; time: TimeStore; still?: string; loop?: boolean }>(
  function Preview({ plan, src, time, still, loop = false }, ref) {
    const player = useRef<PlayerRef>(null);
    const inputProps = useMemo<EditProps>(() => ({ plan, src, still }), [plan, src, still]);
    const { width, height } = ASPECT_SIZE[plan.aspect];
    const duration = totalFrames(plan);

    useImperativeHandle(ref, () => ({
      seek: (sec) => player.current?.seekTo(Math.max(0, Math.min(duration - 1, Math.round(sec * plan.fps)))),
      toggle: () => player.current?.toggle(),
    }), [duration, plan.fps]);

    useEffect(() => {
      const p = player.current;
      if (!p) return;
      const onFrame = (e: { detail: { frame: number } }) => time.set(e.detail.frame / plan.fps);
      p.addEventListener('frameupdate', onFrame);
      p.addEventListener('seeked', onFrame);
      return () => {
        p.removeEventListener('frameupdate', onFrame);
        p.removeEventListener('seeked', onFrame);
      };
    }, [time, plan.fps]);

    return (
      <Player
        ref={player}
        component={EditComposition}
        inputProps={inputProps}
        durationInFrames={duration}
        compositionWidth={width}
        compositionHeight={height}
        fps={plan.fps}
        controls
        loop={loop}
        clickToPlay
        doubleClickToFullscreen
        spaceKeyToPlayOrPause
        acknowledgeRemotionLicense
        style={{ width: '100%', height: '100%', borderRadius: 14, overflow: 'hidden', background: '#000' }}
      />
    );
  },
);
