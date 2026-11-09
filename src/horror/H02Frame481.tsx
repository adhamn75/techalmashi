import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';

// Horror ep 2 — «الإطار 481». Remake of the owner's ChatGPT draft: same two panels, re-cut into
// short shots with push-ins, flicker, rewind glitches, a dark narrator, silence, then the scare.
// Panels are 1080x1425 (cropped from the draft). Never gore.

const FONT = 'Cairo, sans-serif';
const RED = '#ff1f3d';
const PW = 1080, PH = 1425;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// narrator lines: [start frame, length in frames]
const L = [
  {at: 36, dur: 202, src: 'voice/h02/0.wav'},
  {at: 246, dur: 130, src: 'voice/h02/1.wav'},
  {at: 384, dur: 98, src: 'voice/h02/2.wav'},
  {at: 504, dur: 65, src: 'voice/h02/3.wav'},
];
export const H02_FRAMES = 594;

// deterministic noise
const rnd = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

type ShotProps = {src: string; fx: number; fy: number; s0: number; s1: number; from: number; to: number; shake?: number; flicker?: number};
const Shot: React.FC<ShotProps & {f: number}> = ({src, fx, fy, s0, s1, from, to, shake = 0, flicker = 0, f}) => {
  const t = interpolate(f, [from, to], [0, 1], {...clamp, easing: Easing.inOut(Easing.quad)});
  const s = Math.max(1920 / PH, s0 + (s1 - s0) * t);
  let left = 540 - fx * s, top = 960 - fy * s;
  left = Math.min(0, Math.max(1080 - PW * s, left));
  top = Math.min(0, Math.max(1920 - PH * s, top));
  const jx = shake ? (rnd(f * 1.7) - 0.5) * shake : 0, jy = shake ? (rnd(f * 2.3) - 0.5) * shake : 0;
  const b = flicker ? 1 - flicker * (rnd(f * 0.9) > 0.82 ? 0.55 : rnd(f) * 0.15) : 1;
  return (
    <Img src={staticFile(src)} style={{position: 'absolute', left: left + jx, top: top + jy, width: PW * s, height: PH * s,
      filter: `brightness(${b * 1.18}) contrast(1.1) saturate(0.9)`}} />
  );
};

// red/blue split + tearing bars, for the "rewind" moments
const Glitch: React.FC<{f: number; amount: number}> = ({f, amount}) => {
  if (amount <= 0) return null;
  const bars = Array.from({length: 7}, (_, i) => ({y: rnd(f * 3 + i) * 1920, h: 10 + rnd(f + i * 7) * 70, dx: (rnd(f * 5 + i) - 0.5) * 160 * amount}));
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {bars.map((b, i) => (
        <div key={i} style={{position: 'absolute', left: b.dx, top: b.y, width: 1080, height: b.h,
          background: i % 2 ? 'rgba(255,31,61,0.28)' : 'rgba(80,140,255,0.22)', mixBlendMode: 'screen'}} />
      ))}
    </AbsoluteFill>
  );
};

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1380, size = 74}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 60, right: 60, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT,
      fontWeight: 900, fontSize: size, lineHeight: 1.35, color: red ? RED : '#f2f2f2', opacity: o,
      textShadow: '0 0 18px rgba(0,0,0,0.95), 0 4px 0 rgba(0,0,0,0.9)'}}>{text}</div>
  );
};

const Sfx: React.FC<{name: string; at: number; dur?: number; vol?: number}> = ({name, at, dur = 90, vol = 0.6}) => (
  <Sequence from={at} durationInFrames={dur} layout="none"><Audio src={staticFile(`sfx/horror/${name}.wav`)} volume={vol} /></Sequence>
);

export const H02Frame481: React.FC = () => {
  const f = useCurrentFrame();
  const A = 'horror/h02/panel_a.jpg', B = 'horror/h02/panel_b.jpg';

  // which shot is on screen
  let shot: React.ReactNode;
  if (f < 36) shot = <Shot f={f} src={B} fx={918} fy={640} s0={3.3} s1={3.6} from={0} to={36} flicker={1} />;
  else if (f < 246) shot = <Shot f={f} src={A} fx={560} fy={720} s0={1.4} s1={1.62} from={36} to={246} flicker={0.4} />;
  else if (f < 302) shot = <Shot f={f} src={A} fx={1000} fy={590} s0={2.6} s1={3.0} from={246} to={302} flicker={0.6} />;
  else if (f < 376) shot = <Shot f={f} src={B} fx={918} fy={650} s0={2.3} s1={2.7} from={302} to={376} flicker={0.6} />;
  else if (f < 500) shot = <Shot f={f} src={B} fx={250} fy={330} s0={1.9} s1={2.25} from={376} to={500} />;
  else shot = <Shot f={f} src={B} fx={918} fy={600} s0={4.8} s1={5.4} from={500} to={570} shake={f < 530 ? 26 : 8} flicker={0.5} />;

  // loop: fade the last frames into the opening framing
  const loop = interpolate(f, [570, 594], [0, 1], clamp);
  const glitch = Math.max(
    interpolate(f, [296, 300, 306, 310], [0, 1, 1, 0], clamp),
    interpolate(f, [240, 246, 250], [0, 0.6, 0], clamp),
    interpolate(f, [498, 502, 512], [0, 1, 0], clamp),
  );
  const redFlash = interpolate(f, [500, 503, 520], [0, 0.55, 0], clamp);
  const dark = interpolate(f, [482, 490, 498, 500], [0, 0.85, 0.85, 0], clamp); // the silence before the scare
  const errorIn = interpolate(f, [150, 156], [0, 1], clamp);

  return (
    <AbsoluteFill style={{background: '#050306', overflow: 'hidden'}}>
      {shot}
      {loop > 0 && (
        <AbsoluteFill style={{opacity: loop}}>
          <Shot f={f} src={B} fx={918} fy={640} s0={3.3} s1={3.3} from={0} to={1} flicker={1} />
        </AbsoluteFill>
      )}

      {/* vignette, scanlines, grain-ish tint */}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.75) 100%)'}} />
      <AbsoluteFill style={{backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 2px, rgba(0,0,0,0) 2px 5px)', opacity: 0.6}} />
      <AbsoluteFill style={{background: 'rgba(120,0,20,0.12)', mixBlendMode: 'multiply'}} />
      <Glitch f={f} amount={glitch} />
      <AbsoluteFill style={{background: RED, opacity: redFlash, mixBlendMode: 'screen'}} />
      <AbsoluteFill style={{background: '#000', opacity: dark}} />

      {/* export error box */}
      {f >= 150 && f < 246 && (
        <div style={{position: 'absolute', left: 90, right: 90, top: 230, opacity: errorIn, direction: 'rtl',
          background: 'rgba(10,6,10,0.88)', border: `3px solid ${RED}`, borderRadius: 18, padding: '22px 30px',
          fontFamily: FONT, fontWeight: 900, fontSize: 54, color: '#fff', textAlign: 'center',
          transform: `translateX(${(rnd(f) - 0.5) * 10 * (f % 9 < 2 ? 1 : 0)}px)`}}>
          <span style={{color: RED}}>●</span> خطأ تصدير: الإطار <span style={{color: RED}}>481</span> مفقود
        </div>
      )}
      {/* rewind HUD */}
      {f >= 246 && f < 376 && (
        <div style={{position: 'absolute', top: 120, left: 0, right: 0, textAlign: 'center', fontFamily: FONT, fontWeight: 900,
          fontSize: 60, color: '#fff', opacity: f % 20 < 14 ? 0.9 : 0.3, letterSpacing: 4}}>◀◀ 481</div>
      )}

      <Caption f={f} from={0} to={40} text="لا ترجّع الفيديو…" y={1360} size={88} />
      <Caption f={f} from={40} to={150} text="كنت أصدّر فيلم رعب…" />
      <Caption f={f} from={150} to={242} text="فظهر خطأ… في الإطار 481" />
      <Caption f={f} from={248} to={376} text="كلّما أرجعتُ الفيديو… اقتربت خطوة" />
      <Caption f={f} from={386} to={484} text="ثم سمعتُ صوتها… من خلفي" />
      <Caption f={f} from={506} to={572} text="الآن… دوري" red size={110} y={1300} />
      <Caption f={f} from={576} to={594} text="لا ترجّع الفيديو…" y={1360} size={88} />

      {/* sound: drone bed (cut for the silence), rain-like wind, flicker, creak, heartbeat, sting */}
      <Sequence from={0} durationInFrames={482} layout="none"><Audio src={staticFile('sfx/horror/drone.wav')} volume={0.35} loop /></Sequence>
      <Sequence from={0} durationInFrames={482} layout="none"><Audio src={staticFile('sfx/horror/wind.wav')} volume={0.18} loop /></Sequence>
      <Sfx name="flicker" at={2} vol={0.5} />
      <Sfx name="sting" at={0} dur={40} vol={0.35} />
      <Sfx name="flicker" at={150} vol={0.55} />
      <Sfx name="flicker" at={298} vol={0.7} />
      <Sfx name="creak" at={330} vol={0.45} />
      <Sfx name="heartbeat" at={384} dur={98} vol={0.6} />
      <Sfx name="sting" at={500} dur={94} vol={1} />
      {L.map((l) => (
        <Sequence key={l.src} from={l.at} durationInFrames={l.dur + 6} layout="none"><Audio src={staticFile(l.src)} volume={1} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
