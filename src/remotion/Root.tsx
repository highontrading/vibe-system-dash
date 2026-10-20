import React from 'react';
import { Composition, type CalculateMetadataFunction } from 'remotion';
import { ASPECT_SIZE } from '../shared/schema';
import { PRESET_LOOKS } from '../shared/looks';
import { EditComposition, totalFrames, type EditProps } from './EditComposition';

const calculateMetadata: CalculateMetadataFunction<EditProps> = ({ props }) => {
  const { width, height } = ASPECT_SIZE[props.plan.aspect];
  return { width, height, fps: props.plan.fps, durationInFrames: totalFrames(props.plan) };
};

const defaultProps: EditProps = {
  src: '',
  plan: {
    version: 1,
    aspect: '9:16',
    fps: 30,
    sourceDuration: 5,
    look: PRESET_LOOKS[0],
    segments: [{ id: 's1', start: 0, end: 5 }],
    hook: { enabled: true, text: 'Quit your job?', highlight: ['job'], duration: 2.5 },
    captions: { enabled: false, words: [] },
    overlays: [],
    zooms: [],
  },
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Edit"
    component={EditComposition}
    defaultProps={defaultProps}
    calculateMetadata={calculateMetadata}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={150}
  />
);
