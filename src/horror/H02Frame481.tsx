import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';

// Horror ep 2 — «الإطار 481». Anime stills (made by Adham in ChatGPT) animated in code:
// camera moves per shot, rain, glitch, flicker, eye-glow pulse, shake, lunge. Never gore.

const FONT = 'Cairo, sans-serif';
const RED = '#ff2340';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H02_FRAMES = 594;

const rnd = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const L = [
  {at: 36, dur: 202, src: 'voice/h02/0.wav'},
  {at: 246, dur: 130, src: 'voice/h02/1.wav'},
  {at: 384, dur: 98, src: 'voice/h02/2.wav'},
  {at: 504, dur: 65, src: 'voice/h02/3.wav'},
];

// shot: image, frames, camera from/to [scale, x%, y%] (focus point), extras
type Shot = {img: string; from: number; to: number; a: [number, number, number]; b: [number, number, number]; rain?: boolean; glitch?: boolean; shake?: number; eyes?: [number, number][]};
const SHOTS: Shot[] = [
  {img: 'hook', from: 0, to: 40, a: [1.25, 70, 45], b: [1.4, 72, 42], glitch: true, shake: 3},
  {img: 'room', from: 40, to: 150, a: [1.05, 45, 55], b: [1.45, 66, 40], rain: true},
  {img: 'far', from: 150, to: 250, a: [1.0, 50, 50], b: [1.35, 50, 45], glitch: true, eyes: [[50, 36]]},
  {img: 'near', from: 250, to: 388, a: [1.05, 50, 50], b: [1.5, 50, 48], glitch: true, eyes: [[42.5, 51.5], [57.5, 51.5]]},
  {img: 'behind', from: 388, to: 440, a: [1.05, 50, 60], b: [1.6, 32, 22], eyes: [[29.5, 13.2], [37.8, 13.2]]},
  {img: 'fear', from: 440, to: 482, a: [1.05, 50, 45], b: [1.25, 52, 38], rain: true, shake: 5},
  {img: 'lunge', from: 500, to: 576, a: [0.6, 50, 50], b: [1.35, 50, 45], shake: 16, eyes: [[25.8, 40.7], [74.5, 40.7]]},
  {img: 'hook', from: 572, to: 594, a: [1.25, 70, 45], b: [1.3, 70, 45], glitch: true},
];

const W = 1080, H = 1920;

const Rain: React.FC<{f: number}> = ({f}) => (
  <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
    {Array.from({length: 70}, (_, i) => {
      const x = rnd(i * 3.1) * W, y = (rnd(i * 7.7) * H + f * (40 + rnd(i) * 25)) % H;
      return <line key={i} x1={x} y1={y} x2={x - 8} y2={y + 60} stroke="#c8d4ff" strokeOpacity={0.22} strokeWidth={2} />;
    })}
  </svg>
);

const Glitch: React.FC<{f: number; strong: boolean}> = ({f, strong}) => (
  <>
    {Array.from({length: strong ? 9 : 3}, (_, i) => (
      <div key={i} style={{position: 'absolute', left: 0, right: 0, top: rnd(f * 1.7 + i * 9) * H, height: 3 + rnd(f + i) * (strong ? 40 : 8),
        background: i % 2 ? 'rgba(255,35,64,.35)' : 'rgba(110,150,255,.25)', mixBlendMode: 'screen'}} />
    ))}
  </>
);

const ShotView: React.FC<{s: Shot; f: number; rewinding: boolean}> = ({s, f, rewinding}) => {
  const t = interpolate(f, [s.from, s.to], [0, 1], {...clamp, easing: s.img === 'lunge' ? Easing.out(Easing.back(1.4)) : Easing.inOut(Easing.cubic)});
  const sc = s.a[0] + (s.b[0] - s.a[0]) * t;
  const fx = s.a[1] + (s.b[1] - s.a[1]) * t, fy = s.a[2] + (s.b[2] - s.a[2]) * t;
  const k = s.shake ? (s.img === 'lunge' ? Math.max(0, 1 - (f - s.from) / 40) : 1) * s.shake : 0;
  const sx = (rnd(f * 1.3) - 0.5) * k * 2, sy = (rnd(f * 2.1) - 0.5) * k * 2;
  // keep focus point centred but never show past the image edge
  const tx = Math.min(0, Math.max(W - W * sc, W / 2 - (fx / 100) * W * sc));
  const ty = Math.min(0, Math.max(H - H * sc, H / 2 - (fy / 100) * H * sc));
  const fade = interpolate(f, [s.from, s.from + 5], [0, 1], clamp);
  const breathe = 1 + Math.sin(f / 14) * 0.006;
  const pulse = 0.55 + 0.45 * Math.sin(f / 5);
  return (
    <AbsoluteFill style={{opacity: fade}}>
      <div style={{position: 'absolute', width: W, height: H, transformOrigin: '0 0',
        transform: `translate(${tx + sx}px, ${ty + sy}px) scale(${sc * breathe})`}}>
        <Img src={staticFile(`horror/h02/${s.img}.png`)} style={{width: W, height: H, objectFit: 'cover',
          filter: `brightness(${1.12 + (rewinding ? 0.25 : 0)}) contrast(1.05)`}} />
        {s.eyes?.map(([x, y], i) => (
          <div key={i} style={{position: 'absolute', left: `${x}%`, top: `${y}%`, width: 60, height: 60, marginLeft: -30, marginTop: -30,
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,40,60,.95) 0%, rgba(255,20,40,.4) 35%, rgba(255,0,0,0) 70%)',
            opacity: pulse, mixBlendMode: 'screen'}} />
        ))}
      </div>
      {s.rain && <Rain f={f} />}
      {s.glitch && <Glitch f={f} strong={rewinding} />}
    </AbsoluteFill>
  );
};

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1480, size = 76}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 60, right: 60, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900,
      fontSize: size, lineHeight: 1.35, color: red ? RED : '#fff', opacity: o, textShadow: '0 0 22px #000, 0 4px 0 #000, 0 0 6px #000'}}>{text}</div>
  );
};

const Sfx: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={at} durationInFrames={dur} layout="none"><Audio src={staticFile(`sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

export const H02Frame481: React.FC = () => {
  const f = useCurrentFrame();
  const rewinding = (f >= 256 && f < 272) || (f >= 316 && f < 332);
  const shots = SHOTS.filter((s) => f >= s.from && f < s.to);
  const dark = interpolate(f, [478, 486, 496, 500], [0, 1, 1, 0], clamp);
  const flash = interpolate(f, [500, 503, 520], [0, 0.65, 0], clamp);
  const flicker = (f > 384 && f < 482 && rnd(Math.floor(f / 2)) > 0.82) ? 0.35 : 0;
  const errorBox = f >= 168 && f < 250;

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {shots.map((s) => <ShotView key={s.img + s.from} s={s} f={f} rewinding={rewinding} />)}

      {errorBox && (
        <div style={{position: 'absolute', top: 260, left: 140, right: 140, padding: '22px 10px', border: `5px solid ${RED}`, borderRadius: 14,
          background: 'rgba(10,2,4,.85)', textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: 52, color: '#fff',
          opacity: rnd(Math.floor(f / 3)) > 0.12 ? 1 : 0.3, boxShadow: `0 0 40px ${RED}`}}>خطأ تصدير: الإطار 481</div>
      )}
      {f >= 250 && f < 388 && (
        <div style={{position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 70,
          color: '#fff', opacity: rewinding ? 1 : 0.45, textShadow: '0 0 16px #000'}}>◀◀ 481</div>
      )}

      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.5) 100%)'}} />
      <AbsoluteFill style={{background: '#000', opacity: flicker}} />
      <AbsoluteFill style={{background: RED, opacity: flash, mixBlendMode: 'screen'}} />
      <AbsoluteFill style={{background: '#000', opacity: dark}} />

      <Caption f={f} from={0} to={40} text="لا ترجّع الفيديو…" size={90} />
      <Caption f={f} from={42} to={150} text="كنت أصدّر فيلم رعب…" />
      <Caption f={f} from={152} to={246} text="فظهر خطأ… في الإطار 481" />
      <Caption f={f} from={250} to={380} text="كلّما أرجعتُ الفيديو… اقتربت خطوة" />
      <Caption f={f} from={386} to={480} text="ثم سمعتُ صوتها… من خلفي" />
      <Caption f={f} from={506} to={572} text="الآن… دوري" red size={116} y={1500} />
      <Caption f={f} from={576} to={594} text="لا ترجّع الفيديو…" size={90} />

      <Sequence from={0} durationInFrames={482} layout="none"><Audio src={staticFile('sfx/horror/drone.wav')} volume={0.06} loop /></Sequence>
      <Sfx name="flicker" at={150} vol={0.18} />
      <Sfx name="flicker" at={256} vol={0.2} />
      <Sfx name="flicker" at={316} vol={0.22} />
      <Sfx name="creak" at={388} vol={0.2} />
      <Sfx name="heartbeat" at={440} dur={42} vol={0.3} loop />
      <Sfx name="sting" at={500} dur={94} vol={0.85} />
      {L.map((l) => (
        <Sequence key={l.src} from={l.at} durationInFrames={l.dur + 6} layout="none"><Audio src={staticFile(l.src)} volume={1} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
