import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';

export type SfxName = 'pop' | 'whoosh' | 'tick' | 'blip' | 'ding' | 'click' | 'buzz';

// Plays one of the code-generated sound effects in public/sfx at a given frame.
export const Sfx: React.FC<{name: SfxName; at: number; volume?: number}> = ({name, at, volume = 1}) => (
  <Sequence from={Math.max(0, Math.round(at))} durationInFrames={20} layout="none">
    <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
  </Sequence>
);
