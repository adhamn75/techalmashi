import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import TL from './H21Tv.timeline.json';
import {Face} from './HoodedFace';

// Horror ep 21 — «التلفاز المطفأ». The TV is off, yet it sees me. In its black screen I see the whole room, myself on
// the sofa… and someone sitting beside me.
// Look (unlike the clock's teal wall): the TV flat-on, everything that matters exists only as a dim mirrored picture
// inside a curved black screen under a moving glare; the only colour is the red standby dot, which blinks like an eye.
// Scare: the neighbour leans out of the reflection and the hooded face fills the glass. Voice: Hamed +18 %, −22 Hz.

const RED = '#ff1a33';
const FONT = 'Cairo, sans-serif';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H21_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const TEXT = ['التلفاز مطفأ… لكنّه يراني', 'في شاشته السوداء… أرى الصالة كلّها', 'وأرى نفسي على الأريكة', 'فمَن هذا… الجالس بجانبي؟'];
const rnd = (n: number) => {const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x);};
const SX = 60, SY = 480, SW = 960, SH = 760; // screen box

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={Math.round(at)} durationInFrames={Math.max(1, dur)} layout="none"><Audio src={staticFile(`sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1500, size = 62}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [from === 0 ? 1 : 0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#e4e0dc', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000, 0 0 6px #000'}}>{text}</div>
  );
};

// a seated person as seen in dark glass: head, shoulders, thighs
const Sitter: React.FC<{x: number; fill: string; tilt?: number; o: number; rim?: string}> = ({x, fill, tilt = 0, o, rim = '#8d8a92'}) => (
  <g transform={`translate(${x} 0)`} opacity={o}>
    <path d="M-105 700 Q-110 520 -60 488 Q0 462 60 488 Q110 520 105 700 Z" fill={fill} stroke={rim} strokeWidth="4" strokeOpacity="0.55" />
    <g transform={`rotate(${tilt} 0 470)`}><ellipse cx="0" cy="405" rx="58" ry="70" fill={fill} stroke={rim} strokeWidth="4" strokeOpacity="0.65" /></g>
    <path d="M-100 660 Q-140 700 -135 760 L-60 760 L-40 690 M100 660 Q140 700 135 760 L60 760 L40 690" fill={fill} />
  </g>
);

const Screen: React.FC<{f: number}> = ({f}) => {
  const room = interpolate(f, [0, VO[1].at, VO[1].at + 45], [0.55, 0.6, 1], clamp);
  const me = interpolate(f, [VO[1].at + 20, VO[2].at + 10], [0.15, 1], clamp);
  const other = interpolate(f, [VO[3].at - 4, VO[3].at + 40], [0, 1], clamp);
  const lean = interpolate(f, [VO[3].at + 40, B.silence], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
  const breathe = f < B.silence ? Math.sin(f / 13) * 3 : 0;
  // frame 0: two red eyes already in the glass, then gone
  const early = interpolate(f, [0, 22, 34], [1, 0.9, 0], clamp) * (f % 11 < 9 ? 1 : 0.3);
  const glare = ((f * 2.2) % 1500) - 300;
  return (
    <svg width={SW} height={SH} viewBox="0 0 960 760" style={{position: 'absolute', left: SX, top: SY, borderRadius: 54, overflow: 'hidden'}}>
      <defs>
        <radialGradient id="h21glass" cx="50%" cy="42%" r="75%"><stop offset="0" stopColor="#16181d" /><stop offset="1" stopColor="#020203" /></radialGradient>
        <radialGradient id="h21lamp" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#c9b8a0" stopOpacity="0.55" /><stop offset="1" stopColor="#c9b8a0" stopOpacity="0" /></radialGradient>
        <filter id="h21blur"><feGaussianBlur stdDeviation="2.4" /></filter>
      </defs>
      <rect width="960" height="760" fill="url(#h21glass)" />
      <g opacity={room} filter="url(#h21blur)">
        {/* doorway behind the sofa, window, floor lamp */}
        <rect x="70" y="110" width="170" height="430" fill="#000" stroke="#4b4952" strokeWidth="7" />
        <rect x="640" y="120" width="220" height="210" fill="#1d2836" stroke="#555b68" strokeWidth="8" />
        <path d="M750 120 V330 M640 225 H860" stroke="#555b68" strokeWidth="6" />
        <circle cx="330" cy="250" r="150" fill="url(#h21lamp)" />
        <path d="M300 220 L360 220 L385 275 L275 275 Z" fill="#8e7c66" />
        <path d="M330 275 V560" stroke="#6a6168" strokeWidth="8" />
        {/* sofa */}
        <rect x="170" y="500" width="640" height="190" rx="46" fill="#252229" stroke="#59545f" strokeWidth="5" />
        <rect x="130" y="580" width="110" height="170" rx="36" fill="#2c2831" />
        <rect x="740" y="580" width="110" height="170" rx="36" fill="#2c2831" />
        <rect x="200" y="660" width="580" height="90" rx="26" fill="#1c1a20" />
      </g>
      <g transform={`translate(0 ${breathe})`}><Sitter x={380} fill="#3a3841" o={me} /></g>
      {/* the one beside me: appears, then slowly tips its head toward me */}
      <Sitter x={600 - lean * 55} fill="#050405" rim={RED} tilt={-lean * 30} o={other} />
      <g opacity={other * interpolate(f, [VO[3].at + 55, VO[3].at + 70], [0, 1], clamp)} transform={`rotate(${-lean * 30} ${600 - lean * 55} 470)`}>
        {[-20, 20].map((dx) => <circle key={dx} cx={600 - lean * 55 + dx} cy={400} r="7" fill={RED} style={{filter: 'drop-shadow(0 0 12px #ff1a33)'}} />)}
      </g>
      <g opacity={early}>
        {[578, 622].map((x) => <ellipse key={x} cx={x} cy={402} rx="12" ry="8" fill={RED} style={{filter: 'drop-shadow(0 0 22px #ff1a33)'}} />)}
      </g>
      {/* glass glare */}
      <path d={`M${glare} 0 L${glare + 140} 0 L${glare - 160} 760 L${glare - 300} 760 Z`} fill="#fff" opacity="0.035" />
      <path d="M30 120 Q50 40 160 30" stroke="#fff" strokeWidth="8" fill="none" opacity="0.18" strokeLinecap="round" />
    </svg>
  );
};

export const H21Tv: React.FC = () => {
  const f = useCurrentFrame();
  const scare = f >= B.scare && f < B.black;
  const zoom = interpolate(f, [0, VO[1].at, VO[3].at, B.silence], [1.0, 1.04, 1.12, 1.34], {...clamp, easing: Easing.inOut(Easing.sin)});
  const push = scare ? interpolate(f, [B.scare, B.scare + 7], [0.7, 1.45], {...clamp, easing: Easing.out(Easing.back(1.5))}) : 1;
  const shake = scare && f < B.scare + 14 ? (rnd(f) - 0.5) * 36 : 0;
  const led = f < B.silence ? (f % 40 < 26 ? 1 : 0.25) : 1;

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {f < B.black && (
        <AbsoluteFill style={{transformOrigin: '560px 900px', transform: `translateX(${shake}px) scale(${zoom})`}}>
          <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, #241318 0%, #0b0608 55%, #000 100%)'}} />
          {/* the set: bezel, stand, shelf */}
          <div style={{position: 'absolute', left: SX - 34, top: SY - 34, width: SW + 68, height: SH + 110, borderRadius: 78, background: 'linear-gradient(180deg,#1d181a,#0a0809)', boxShadow: '0 40px 90px #000, inset 0 2px 0 #3d3236'}} />
          <Screen f={f} />
          <div style={{position: 'absolute', left: 524, top: SY + SH + 24, width: 32, height: 32, borderRadius: 16, background: RED, opacity: led, boxShadow: `0 0 ${36 * led}px ${12 * led}px rgba(255,26,51,.7)`}} />
          <div style={{position: 'absolute', left: 300, top: SY + SH + 76, width: 480, height: 90, background: '#0d0a0b', clipPath: 'polygon(25% 0, 75% 0, 100% 100%, 0 100%)'}} />
          <div style={{position: 'absolute', left: -60, right: -60, top: SY + SH + 166, height: 400, background: 'linear-gradient(180deg,#170e10,#000)', borderTop: '5px solid #2d1d21'}} />
          {scare && (
            <div style={{position: 'absolute', left: 280, top: 520, width: 520, height: 676, WebkitMaskImage: 'linear-gradient(180deg, #000 72%, transparent 99%)', maskImage: 'linear-gradient(180deg, #000 72%, transparent 99%)', transform: `scale(${push})`}}><Face f={f} /></div>
          )}
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,.92) 100%)', pointerEvents: 'none'}} />
      <AbsoluteFill style={{opacity: 0.08, mixBlendMode: 'screen', pointerEvents: 'none',
        backgroundImage: `repeating-radial-gradient(circle at ${rnd(f) * 100}% ${rnd(f + 3) * 100}%, rgba(255,235,235,.5) 0 1px, transparent 1px 3px)`}} />
      {scare && <AbsoluteFill style={{background: RED, opacity: 0.22 * rnd(f + 2), mixBlendMode: 'multiply'}} />}

      {TEXT.map((t, i) => <Caption key={i} f={f} from={i === 0 ? 0 : VO[i].at - 2} to={Math.min(VO[i].at + VO[i].dur + 10, B.scare - 1)} text={t} red={i === 3} />)}
      {f >= B.black && (
        <>
          <Caption f={f} from={B.black + 2} to={H21_FRAMES + 8} text="القادمة: معطف معلّق… يتنفّس" y={760} red size={60} />
          <div style={{position: 'absolute', top: 1100, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: 44,
            opacity: interpolate(f, [B.black + 26, B.black + 36], [0, 1], clamp)}}>
            <span style={{background: '#ffd35a', color: '#140406', borderRadius: 24, padding: '6px 30px'}}>🔔 اشترك لتصلك قصة الليلة القادمة</span>
          </div>
        </>
      )}

      <Snd name="drone" at={0} dur={B.silence} vol={0.26} loop />
      <Snd name="static" at={0} dur={20} vol={0.25} />
      <Snd name="flicker" at={VO[1].at} dur={20} vol={0.3} />
      <Snd name="creak" at={VO[3].at} dur={60} vol={0.4} />
      <Snd name="breath" at={VO[3].at + 20} dur={B.silence - VO[3].at - 20} vol={0.45} />
      {Array.from({length: 2}, (_, i) => <Snd key={`h${i}`} name="heartbeat" at={VO[3].at + 34 + i * 22} dur={24} vol={0.45} />)}
      <Snd name="sting" at={B.scare} dur={90} vol={0.6} />
      <Snd name="static" at={B.scare} dur={B.black - B.scare} vol={0.35} />
      <Snd name="drone" at={B.black} dur={H21_FRAMES - B.black} vol={0.18} />
      {VO.map((v) => (
        <Sequence key={v.src} from={v.at} durationInFrames={v.dur + 8} layout="none"><Audio src={staticFile(v.src)} volume={1} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
