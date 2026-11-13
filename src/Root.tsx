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
import {Family05Voice, FAMILY05_FRAMES} from './episodes/Fam05Voice';
import {H01Rules, H01_FRAMES} from './horror/H01Rules';
import {H02Frame481, H02_FRAMES} from './horror/H02Frame481';
import {Ep05Mandel, EP05_FRAMES} from './episodes/Ep05Mandel';
import {Family06Gems, FAMILY06_FRAMES} from './episodes/Fam06Gems';
import {H06OwnNumber, H06_FRAMES} from './horror/H06OwnNumber';
import {Ep06Flappy, EP06_FRAMES} from './episodes/Ep06Flappy';
import {Family07Purchase, FAMILY07_FRAMES} from './episodes/Fam07Purchase';
import {H07Closet, H07_FRAMES} from './horror/H07Closet';
import {Ep07Pacman, EP07_FRAMES} from './episodes/Ep07Pacman';
import {Family08Stranger, FAMILY08_FRAMES} from './episodes/Fam08Stranger';
import {H08Gallery, H08_FRAMES} from './horror/H08Gallery';

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
    <Composition id="Family05Voice" component={Family05Voice} durationInFrames={FAMILY05_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Ep05Mandel" component={Ep05Mandel} durationInFrames={EP05_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Family06Gems" component={Family06Gems} durationInFrames={FAMILY06_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="H06OwnNumber" component={H06OwnNumber} durationInFrames={H06_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Ep06Flappy" component={Ep06Flappy} durationInFrames={EP06_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Family07Purchase" component={Family07Purchase} durationInFrames={FAMILY07_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="H07Closet" component={H07Closet} durationInFrames={H07_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Ep07Pacman" component={Ep07Pacman} durationInFrames={EP07_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Family08Stranger" component={Family08Stranger} durationInFrames={FAMILY08_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="H08Gallery" component={H08Gallery} durationInFrames={H08_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
