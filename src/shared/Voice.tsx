import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';

// A voice line placed at an absolute frame. dur is the trimmed clip length in frames.
export type Line = {at: number; dur: number; src: string};

export const VoiceTrack: React.FC<{lines: Line[]; volume?: number}> = ({lines, volume = 1}) => (
  <>
    {lines.map((l) => (
      <Sequence key={l.src} from={l.at} durationInFrames={l.dur + 6}>
        <Audio src={staticFile(l.src)} volume={volume} />
      </Sequence>
    ))}
  </>
);

// 1 while any line is playing at absolute frame f (drives the host's mouth).
export const speaking = (lines: Line[], f: number) => (lines.some((l) => f >= l.at && f < l.at + l.dur) ? 1 : 0);
