import React from 'react';
import {Composition} from 'remotion';
import {Ep01Snake, EP01_FRAMES} from './episodes/Ep01Snake';

// Every episode is one Composition. Its id must match "composition" in episodes.json.
export const Root: React.FC = () => (
  <>
    <Composition id="Ep01Snake" component={Ep01Snake} durationInFrames={EP01_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
