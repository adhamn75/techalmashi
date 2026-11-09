import React from 'react';
import {Composition} from 'remotion';
import {Ep01Snake, EP01_FRAMES} from './episodes/Ep01Snake';
import {Family01Scam, FAMILY01_FRAMES} from './episodes/Fam01Scam';
import {Ep02Cube, EP02_FRAMES} from './episodes/Ep02Cube';
import {Family02Location, FAMILY02_FRAMES} from './episodes/Fam02Location';

// Every episode is one Composition. Its id must match "composition" in episodes.json.
export const Root: React.FC = () => (
  <>
    <Composition id="Ep01Snake" component={Ep01Snake} durationInFrames={EP01_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Family01Scam" component={Family01Scam} durationInFrames={FAMILY01_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Ep02Cube" component={Ep02Cube} durationInFrames={EP02_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Family02Location" component={Family02Location} durationInFrames={FAMILY02_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
