import React from 'react';
import {Composition} from 'remotion';
import {Ep01Snake, EP01_FRAMES} from './episodes/Ep01Snake';
import {Family01Scam, FAMILY01_FRAMES} from './episodes/Fam01Scam';
import {Ep02Cube, EP02_FRAMES} from './episodes/Ep02Cube';
import {Family02Location, FAMILY02_FRAMES} from './episodes/Fam02Location';
import {Ep03Tetris, EP03_FRAMES} from './episodes/Ep03Tetris';
import {Family03Code, FAMILY03_FRAMES} from './episodes/Fam03Code';
import {H03Elevator, H03_FRAMES} from './horror/H03Elevator';
import {Ep04Maze, EP04_FRAMES} from './episodes/Ep04Maze';
import {Family04Suspend, FAMILY04_FRAMES} from './episodes/Fam04Suspend';
import {H04Camera, H04_FRAMES} from './horror/H04Camera';
import {H05Mirror, H05_FRAMES} from './horror/H05Mirror';
import {H01Rules, H01_FRAMES} from './horror/H01Rules';
import {H02Frame481, H02_FRAMES} from './horror/H02Frame481';

// Every episode is one Composition. Its id must match "composition" in episodes.json.
export const Root: React.FC = () => (
  <>
    <Composition id="Ep01Snake" component={Ep01Snake} durationInFrames={EP01_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Family01Scam" component={Family01Scam} durationInFrames={FAMILY01_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Ep02Cube" component={Ep02Cube} durationInFrames={EP02_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Family02Location" component={Family02Location} durationInFrames={FAMILY02_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="H02Frame481" component={H02Frame481} durationInFrames={H02_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="H01Rules" component={H01Rules} durationInFrames={H01_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Ep03Tetris" component={Ep03Tetris} durationInFrames={EP03_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Family03Code" component={Family03Code} durationInFrames={FAMILY03_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="H03Elevator" component={H03Elevator} durationInFrames={H03_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Ep04Maze" component={Ep04Maze} durationInFrames={EP04_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Family04Suspend" component={Family04Suspend} durationInFrames={FAMILY04_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="H04Camera" component={H04Camera} durationInFrames={H04_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="H05Mirror" component={H05Mirror} durationInFrames={H05_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
