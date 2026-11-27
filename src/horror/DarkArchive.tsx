import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import season from '../../horror/dark_archive_season1.json';

const FPS = 30;
const LINE_FRAMES = 10 * FPS;
export const DARK_ARCHIVE_FRAMES = 6 * LINE_FRAMES;
const FONT = 'Cairo, sans-serif';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

type Episode = (typeof season.episodes)[number];

const episodeFor = (id: string): Episode => {
  const episode = season.episodes.find((item) => item.id === id);
  if (!episode) throw new Error(`Unknown Dark Archive episode: ${id}`);
  return episode;
};

const FilmLayer: React.FC<{frame: number}> = ({frame}) => (
  <>
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,.88) 100%)'}} />
    <AbsoluteFill style={{opacity: 0.11, mixBlendMode: 'screen', backgroundImage: `repeating-linear-gradient(${89 + (frame % 3)}deg, transparent 0 3px, rgba(255,255,255,.18) 3px 4px)`}} />
    <AbsoluteFill style={{opacity: 0.07, backgroundImage: 'radial-gradient(circle, #fff 0 1px, transparent 1px)', backgroundSize: '7px 7px', transform: `translate(${frame % 7}px, ${frame % 5}px)`}} />
  </>
);

const Stamp: React.FC<{episode: Episode; frame: number}> = ({episode, frame}) => {
  const opacity = interpolate(frame, [0, 7, 65, 78], [0, 1, 1, 0], clamp);
  const scale = interpolate(frame, [0, 10], [1.3, 1], clamp);
  return (
    <div style={{position: 'absolute', top: 100, left: 72, right: 72, opacity, transform: `scale(${scale})`, transformOrigin: 'top center', direction: 'rtl', fontFamily: FONT}}>
      <div style={{display: 'inline-block', border: '5px solid #8e1b1b', color: '#d8d0bd', background: 'rgba(5,7,9,.82)', padding: '12px 26px', fontWeight: 900, fontSize: 42, transform: 'rotate(-1.5deg)', boxShadow: '0 8px 30px #000'}}>
        الأرشيف المظلم · الملف {String(episode.file).padStart(3, '0')}
      </div>
      <div style={{marginTop: 14, color: '#d8d0bd', fontWeight: 700, fontSize: 30, textShadow: '0 3px 12px #000'}}>{episode.place_year}</div>
    </div>
  );
};

const Caption: React.FC<{text: string; local: number}> = ({text, local}) => {
  const opacity = interpolate(local, [0, 7, LINE_FRAMES - 14, LINE_FRAMES - 2], [0, 1, 1, 0], clamp);
  const y = interpolate(local, [0, 10], [24, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 54, right: 54, bottom: 215, direction: 'rtl', textAlign: 'center', fontFamily: FONT, fontWeight: 900,
      fontSize: text.length > 88 ? 47 : 53, lineHeight: 1.45, color: '#f2ead7', opacity, transform: `translateY(${y}px)`,
      textShadow: '0 4px 2px #000, 0 0 22px #000, 0 0 7px #000'}}>{text}</div>
  );
};

export const DarkArchive: React.FC<{episodeId: string}> = ({episodeId}) => {
  const frame = useCurrentFrame();
  const episode = episodeFor(episodeId);
  const shotNames = Object.keys(episode.shots);
  const lineIndex = Math.min(5, Math.floor(frame / LINE_FRAMES));
  const local = frame - lineIndex * LINE_FRAMES;
  const shotName = shotNames[Math.min(shotNames.length - 1, Math.floor(lineIndex / 2))];
  const zoom = interpolate(local, [0, LINE_FRAMES], [1.03, 1.13], clamp);
  const driftX = interpolate(local, [0, LINE_FRAMES], [lineIndex % 2 ? -18 : 18, lineIndex % 2 ? 18 : -18], clamp);
  const final = frame >= DARK_ARCHIVE_FRAMES - 75;

  return (
    <AbsoluteFill style={{background: '#090b0f', overflow: 'hidden'}}>
      <Img src={staticFile(`horror/${episode.id}/stills/${shotName}_11.png`)} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `translateX(${driftX}px) scale(${zoom})`, filter: 'contrast(1.12) saturate(.65) brightness(.82)'}} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,.58) 0%, transparent 30%, transparent 58%, rgba(0,0,0,.94) 100%)'}} />
      <FilmLayer frame={frame} />
      <Stamp episode={episode} frame={frame} />
      <Caption text={episode.lines[lineIndex]} local={local} />

      {final && (
        <div style={{position: 'absolute', top: 720, left: 70, right: 70, direction: 'rtl', textAlign: 'center', fontFamily: FONT, color: '#d8d0bd', fontWeight: 900, fontSize: 48,
          background: 'rgba(5,7,9,.82)', border: '3px solid #8e1b1b', padding: '24px 30px', boxShadow: '0 12px 40px #000'}}>
          {episode.status_card}
          <div style={{fontSize: 35, marginTop: 20, color: '#f5d15f'}}>اشترك لفتح الملف التالي</div>
        </div>
      )}

      {episode.lines.map((_, i) => (
        <Sequence key={i} from={i * LINE_FRAMES} layout="none">
          <Audio src={staticFile(`voice/${episode.id}/${i}.mp3`)} volume={1} />
        </Sequence>
      ))}
      <Audio src={staticFile('sfx/horror/drone.wav')} volume={0.16} loop />
      <Sequence from={0} durationInFrames={28} layout="none"><Audio src={staticFile('sfx/horror/click.wav')} volume={0.48} /></Sequence>
      <Sequence from={DARK_ARCHIVE_FRAMES - 70} durationInFrames={70} layout="none"><Audio src={staticFile('sfx/horror/static.wav')} volume={0.22} /></Sequence>
      <div style={{position: 'absolute', left: 0, bottom: 0, height: 7, width: `${(frame / DARK_ARCHIVE_FRAMES) * 100}%`, background: '#8e1b1b'}} />
    </AbsoluteFill>
  );
};
