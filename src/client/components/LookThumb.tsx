import { useMemo } from 'react';
import { Thumbnail } from '@remotion/player';
import { ASPECT_SIZE, type EditPlan } from '../../shared/schema';
import { EditComposition, totalFrames, type EditProps } from '../../remotion/EditComposition';

/** A single rendered frame of a plan on a still image: cheap enough for grids of option cards. */
export function LookThumb({ plan, still, atSec, className }: { plan: EditPlan; still: string; atSec: number; className?: string }) {
  const inputProps = useMemo<EditProps>(() => ({ plan, src: '', still }), [plan, still]);
  const { width, height } = ASPECT_SIZE[plan.aspect];
  const duration = totalFrames(plan);
  return (
    <div className={className}>
      <Thumbnail
        component={EditComposition}
        inputProps={inputProps}
        compositionWidth={width}
        compositionHeight={height}
        durationInFrames={duration}
        fps={plan.fps}
        frameToDisplay={Math.min(duration - 1, Math.round(atSec * plan.fps))}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
