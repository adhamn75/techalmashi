import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import TL from './H05Mirror.timeline.json';

// Horror ep 5 — «المرآة». First episode made from stills rendered for free on GitHub
// (horror/stills.json → Horror stills workflow, open LCM Dreamshaper v7 model), animated here:
// slow push-ins, fog, flicker, a red pulse, a mirror "lag" double image, total silence, then the hooded one. Never gore.

const FONT = 'Cairo, sans-serif';
const RED = '#ff1a33';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H05_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const S = (n: string) => staticFile(`horror/h05-mirror/stills/${n}.png`);

const rnd = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

// shot: still, frames, scale from→to, focus point (%), extras
type Shot = {img: string; from: number; to: number; s: [number, number]; fx: [number, number]; fy: [number, number]; lag?: boolean; pulse?: boolean; shake?: number};
const SHOTS: Shot[] = [
  {img: 'dark_11', from: 0, to: B.room, s: [1.25, 1.4], fx: [50, 50], fy: [32, 30], pulse: true, shake: 3},
  {img: 'bathroom_42', from: B.room, to: B.lag, s: [1.0, 1.25], fx: [50, 50], fy: [55, 30]},
  {img: 'bathroom_7', from: B.lag, to: B.smile, s: [1.05, 1.45], fx: [50, 50], fy: [40, 28], lag: true},
  {img: 'reflection_7', from: B.smile, to: B.off, s: [1.0, 1.3], fx: [50, 50], fy: [45, 38], pulse: true},
  {img: 'bathroom_11', from: B.off, to: B.silence, s: [1.1, 1.15], fx: [50, 50], fy: [40, 40]},
  {img: 'reveal_42', from: B.scare, to: B.end, s: [1.4, 2.1], fx: [50, 50], fy: [17, 15], shake: 18, pulse: true},
];

const ShotView: React.FC<{s: Shot; f: number}> = ({s, f}) => {
  const t = interpolate(f, [s.from, s.to], [0, 1], {...clamp, easing: s.img.startsWith('reveal') ? Easing.out(Easing.back(1.3)) : Easing.inOut(Easing.sin)});
  const sc = s.s[0] + (s.s[1] - s.s[0]) * t;
  const fx = s.fx[0] + (s.fx[1] - s.fx[0]) * t, fy = s.fy[0] + (s.fy[1] - s.fy[0]) * t;
  const tx = Math.min(0, Math.max(1080 - 1080 * sc, 540 - (fx / 100) * 1080 * sc));
  const ty = Math.min(0, Math.max(1920 - 1920 * sc, 960 - (fy / 100) * 1920 * sc));
  const k = s.shake ? (s.img.startsWith('reveal') ? Math.max(0, 1 - (f - s.from) / 30) : 1) * s.shake : 0;
  const sx = (rnd(f * 1.3) - 0.5) * k * 2, sy = (rnd(f * 2.1) - 0.5) * k * 2;
  const fade = s.from === 0 ? 1 : interpolate(f, [s.from, s.from + 5], [0, 1], clamp);
  const img = (o: number, dx = 0, filter = '') => (
    <Img src={S(s.img)} style={{position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover', opacity: o, transform: `translateX(${dx}px)`,
      filter: `contrast(1.12) brightness(1.05) ${filter}`}} />
  );
  // the reflection lags: a ghost copy that follows the image a moment late
  const lagDx = s.lag ? Math.sin((f - s.from) / 14) * 22 : 0;
  return (
    <AbsoluteFill style={{opacity: fade}}>
      <div style={{position: 'absolute', width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${tx + sx}px, ${ty + sy}px) scale(${sc})`}}>
        {img(1)}
        {s.lag && img(0.35, lagDx, 'hue-rotate(-20deg) saturate(1.6)')}
      </div>
      {s.pulse && <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 32%, rgba(255,20,40,.35) 0%, rgba(0,0,0,0) 55%)', opacity: 0.5 + 0.5 * Math.sin(f / 6), mixBlendMode: 'screen'}} />}
    </AbsoluteFill>
  );
};

const Fog: React.FC<{f: number}> = ({f}) => (
  <>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{position: 'absolute', left: -400 + ((f * (0.8 + i * 0.4) + i * 300) % 700), top: 900 + i * 260, width: 1600, height: 420, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(170,150,155,.13) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(14px)'}} />
    ))}
  </>
);

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1520, size = 72}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#f2ecea', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000, 0 0 8px #000'}}>{text}</div>
  );
};

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={at} durationInFrames={dur} layout="none"><Audio src={staticFile(name.includes('/') ? name : `sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

export const H05Mirror: React.FC = () => {
  const f = useCurrentFrame();
  const shots = SHOTS.filter((s) => f >= s.from && f < s.to);
  const flicker = (f > B.smile && f < B.silence && rnd(Math.floor(f / 2)) > 0.8) ? 0.55 : 0;
  const lightsOut = interpolate(f, [B.off + 14, B.off + 18], [0, 1], clamp) * (f < B.scare ? 1 : 0);
  const flash = interpolate(f, [B.scare, B.scare + 2, B.scare + 18], [0, 0.7, 0], clamp);
  const hookGlitch = f < 14 && rnd(f) > 0.5;

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {shots.map((s) => <ShotView key={s.img + s.from} s={s} f={f} />)}
      <Fog f={f} />
      {hookGlitch && <AbsoluteFill style={{background: 'rgba(255,20,40,.25)', transform: `translateX(${(rnd(f * 3) - 0.5) * 40}px)`, mixBlendMode: 'screen'}} />}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 50%, rgba(0,0,0,.8) 100%)'}} />
      <AbsoluteFill style={{background: 'repeating-linear-gradient(0deg, rgba(255,255,255,.03) 0 2px, transparent 2px 4px)'}} />
      <AbsoluteFill style={{background: '#000', opacity: flicker}} />
      <AbsoluteFill style={{background: '#000', opacity: lightsOut}} />
      <AbsoluteFill style={{background: RED, opacity: flash, mixBlendMode: 'screen'}} />

      <Caption f={f} from={-8} to={B.room - 2} text="لا تنظر في المرآة… الساعة 3" size={84} />
      <Caption f={f} from={B.room} to={B.lag - 4} text="الساعة الثالثة… دخلتُ لأغسل وجهي" />
      <Caption f={f} from={B.lag} to={B.smile - 4} text="رفعتُ رأسي… فلم يرفع انعكاسي رأسه" />
      <Caption f={f} from={B.smile} to={B.off - 2} text="كان ينظر إليّ… ويبتسم" />
      <Caption f={f} from={B.off} to={B.silence} text="ثمّ انطفأ الضوء" />
      <Caption f={f} from={B.scare + 6} to={B.end} text="لا تلتفت… أنا خلفك الآن" red size={88} />

      <Snd name="drone" at={0} dur={B.silence} vol={0.08} loop />
      <Snd name="sting" at={0} dur={24} vol={0.35} />
      <Snd name="wind" at={B.room} dur={B.smile - B.room} vol={0.08} />
      <Snd name="creak" at={B.lag + 10} vol={0.22} />
      <Snd name="heartbeat" at={B.smile} dur={B.off - B.smile} vol={0.25} loop />
      <Snd name="flicker" at={B.off} dur={20} vol={0.35} />
      <Snd name="sting" at={B.scare} dur={B.end - B.scare} vol={0.85} />
      {VO.map((l) => <Snd key={l.src} name={l.src} at={l.at} dur={l.dur + 6} vol={1} />)}
    </AbsoluteFill>
  );
};
