import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import TL from './H19Phone.timeline.json';
import {Face} from './HoodedFace';

// Horror ep 19 — «الهاتف». Grandpa's old phone in the hallway: its cord was cut years ago. Tonight it rang.
// I lifted the handset and heard breathing… then my own voice whispered: don't turn around.
// Look: front view at table height under one swinging amber bulb, a black rotary phone whose cord ends in frayed
// copper on the floor; it jumps on every bell strike. Then a full-screen macro of the earpiece holes that pulse
// with the breathing; the camera turns anyway — whip-pan to the dark doorway. Voice: Hamed +18 %, −22 Hz. Never gore.

const RED = '#ff1a33';
const AMBER = '#ffb347';
const FONT = 'Cairo, sans-serif';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H19_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const TEXT = ['هاتف جدي القديم… سلكه مقطوع', 'الليلة… رن', 'رفعت السماعة… فسمعت أنفاسًا', 'ثم همس صوتي أنا: لا تلتفت'];
const rnd = (n: number) => {const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x);};

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={Math.round(at)} durationInFrames={Math.max(1, dur)} layout="none"><Audio src={staticFile(`sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1600, size = 64}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#f3e2c4', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000, 0 0 6px #000'}}>{text}</div>
  );
};

// bell: ring.wav is 3 s long, strikes for the first 1.6 s → the phone jumps during those frames
const ringing = (f: number) => f >= B.ring && f < B.lift && ((f - B.ring) % 90) < 48;

const Hallway: React.FC<{f: number; lifted: number}> = ({f, lifted}) => {
  const ring = ringing(f);
  const jx = ring ? (rnd(f) - 0.5) * 16 : 0;
  const jy = ring ? -Math.abs(Math.sin(f * 2.1)) * 10 : 0;
  const swing = Math.sin(f / 26) * 6;
  const flick = ring && rnd(f + 9) > 0.8 ? 0.55 : 1;
  // the coiled cord: from the phone's side down to the floor, ending in frayed copper
  const coil = Array.from({length: 40}, (_, i) => {
    const t = i / 39;
    const x = 300 - t * 120 + Math.sin(t * 34) * 22;
    const y = 1180 + t * 330;
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
      <defs>
        <radialGradient id="h19bulb" cx="50%" cy="0%" r="90%"><stop offset="0" stopColor={AMBER} stopOpacity="0.55" /><stop offset="0.6" stopColor="#7a3d10" stopOpacity="0.15" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        <linearGradient id="h19bak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a2a22" /><stop offset="0.35" stopColor="#120c0a" /><stop offset="1" stopColor="#050303" /></linearGradient>
        <radialGradient id="h19dial" cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#f4ead2" /><stop offset="1" stopColor="#9c8f74" /></radialGradient>
        <pattern id="h19paper" width="90" height="90" patternUnits="userSpaceOnUse">
          <rect width="90" height="90" fill="#1d130b" /><path d="M45 10 q12 18 0 35 q-12 -17 0 -35 M45 55 q12 18 0 35 q-12 -17 0 -35" fill="#2a1b0f" />
        </pattern>
      </defs>
      {/* wallpaper, floor, the black doorway on the left */}
      <rect width="1080" height="1920" fill="url(#h19paper)" />
      <rect x="0" y="1520" width="1080" height="400" fill="#0b0705" />
      <path d="M0 1520 L1080 1520" stroke="#3a2614" strokeWidth="6" />
      <rect x="40" y="520" width="250" height="1000" fill="#000" />
      <rect x="40" y="520" width="250" height="1000" fill="none" stroke="#2c1c10" strokeWidth="18" />
      {/* the hanging bulb */}
      <g transform={`rotate(${swing} 640 0)`}>
        <path d="M640 0 L640 230" stroke="#111" strokeWidth="6" />
        <circle cx="640" cy="262" r="34" fill={AMBER} opacity={flick} style={{filter: 'drop-shadow(0 0 40px #ffb347)'}} />
      </g>
      <rect width="1080" height="1920" fill="url(#h19bulb)" opacity={flick} transform={`translate(${swing * 8} 0)`} />
      {/* a small wooden table */}
      <rect x="300" y="1240" width="720" height="40" rx="8" fill="#3b2412" />
      <path d="M340 1280 L360 1520 M980 1280 L960 1520" stroke="#2a190c" strokeWidth="26" />
      {/* the cut cord on the floor: the wall half lies separate */}
      <path d={coil} stroke="#0c0c0c" strokeWidth="14" fill="none" />
      <g style={{filter: 'drop-shadow(0 0 10px #ffb347)'}}><path d="M180 1510 l-44 -26 M180 1510 l-50 8 M180 1510 l-30 38 M180 1510 l-48 -6" stroke="#ffae4a" strokeWidth="7" strokeLinecap="round" /></g>
      <path d="M1080 1640 C880 1650 640 1700 420 1640" stroke="#0c0c0c" strokeWidth="14" fill="none" />
      <g style={{filter: 'drop-shadow(0 0 10px #ffb347)'}}><path d="M420 1640 l-44 -26 M420 1640 l-50 8 M420 1640 l-30 38 M420 1640 l-48 -6" stroke="#ffae4a" strokeWidth="7" strokeLinecap="round" /></g>
      <rect x="1040" y="1600" width="40" height="70" fill="#222" />
      {/* the phone */}
      <g transform={`translate(${jx} ${jy})`}>
        <path d="M330 1240 L410 960 L910 960 L990 1240 Z" fill="url(#h19bak)" />
        <path d="M410 960 L910 960" stroke={AMBER} strokeWidth="5" opacity="0.45" />
        <circle cx="660" cy="1110" r="118" fill="url(#h19dial)" />
        {Array.from({length: 10}, (_, i) => {
          const a = (-60 + i * 27) * Math.PI / 180;
          return <circle key={i} cx={660 + Math.cos(a) * 82} cy={1110 + Math.sin(a) * 82} r="19" fill="#1a120d" />;
        })}
        <circle cx="660" cy="1110" r="34" fill="#e9dcc0" stroke="#8a7a5c" strokeWidth="3" />
        {/* cradle prongs */}
        <rect x="430" y="905" width="40" height="60" rx="8" fill="#0e0a08" />
        <rect x="850" y="905" width="40" height="60" rx="8" fill="#0e0a08" />
        {/* the handset: rises off the cradle when lifted */}
        <g transform={`translate(0 ${-lifted * 1100})`}>
          <path d="M380 900 Q380 840 450 840 L870 840 Q940 840 940 900 L940 920 L860 920 Q800 880 660 880 Q520 880 460 920 L380 920 Z" fill="#14100d" />
          <path d="M450 850 L870 850" stroke={AMBER} strokeWidth="4" opacity="0.5" />
        </g>
      </g>
      {/* bell lines while it rings */}
      {ring && [0, 1, 2].map((i) => (
        <path key={i} d={`M${300 - i * 40} ${1000 - i * 20} q-30 40 0 80 M${1020 + i * 40} ${1000 - i * 20} q30 40 0 80`} stroke={AMBER} strokeWidth="8" fill="none" opacity={0.8 - i * 0.22} />
      ))}
    </svg>
  );
};

// full-screen macro of the earpiece: a disc of holes that pulse with the breathing
const Earpiece: React.FC<{f: number; red: number}> = ({f, red}) => {
  const breath = Math.sin((f - B.lift) / 14) * 0.5 + 0.5;
  const holes: React.ReactNode[] = [];
  for (let r = 0; r < 6; r++) {
    const count = r === 0 ? 1 : r * 7;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + r * 0.3;
      const x = 540 + Math.cos(a) * r * 92, y = 900 + Math.sin(a) * r * 92;
      const s = 26 + breath * 10 * (1 - r / 7);
      holes.push(<circle key={`${r}-${k}`} cx={x} cy={y} r={s} fill={red > 0.5 ? '#2a0004' : '#050302'} />);
    }
  }
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
      <defs><radialGradient id="h19ear" cx="45%" cy="40%" r="60%"><stop offset="0" stopColor="#3b2c22" /><stop offset="1" stopColor="#080504" /></radialGradient></defs>
      <rect width="1080" height="1920" fill="#030202" />
      <circle cx="540" cy="900" r="600" fill="url(#h19ear)" />
      <circle cx="540" cy="900" r="580" fill="none" stroke={AMBER} strokeWidth="6" opacity="0.25" />
      {holes}
      <circle cx="540" cy="900" r={560} fill={RED} opacity={red * 0.18} />
    </svg>
  );
};

export const H19Phone: React.FC = () => {
  const f = useCurrentFrame();
  const lifted = interpolate(f, [B.lift, B.lift + 14], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  const inEar = f >= B.lift + 14 && f < B.turn;
  // hallway camera: slow push on the cut copper ends, then wider while it rings
  const zoom = f < B.ring ? interpolate(f, [0, B.ring], [1.55, 1.25], clamp) : interpolate(f, [B.ring, B.lift], [1.12, 1.2], clamp);
  const ox = f < B.ring ? 180 : 600, oy = f < B.ring ? 1500 : 1150;
  const earZoom = interpolate(f, [B.lift + 14, B.turn], [1.0, 1.35], {...clamp, easing: Easing.inOut(Easing.sin)});
  // the turn: whip-pan to the doorway, the face waits in it
  const pan = interpolate(f, [B.turn, B.turn + 8], [1080, 0], {...clamp, easing: Easing.out(Easing.cubic)});
  const faceScale = f < B.scare ? 0.55 : interpolate(f, [B.scare, B.scare + 6], [0.55, 1.5], {...clamp, easing: Easing.out(Easing.back(1.6))});
  const shake = f >= B.scare && f < B.scare + 14 ? (rnd(f) - 0.5) * 34 : 0;
  const redEar = f >= VO[3].at ? interpolate(f, [VO[3].at, VO[3].at + 20], [0, 1], clamp) : 0;

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {f < B.lift + 14 && (
        <AbsoluteFill style={{transformOrigin: `${ox}px ${oy}px`, transform: `scale(${zoom})`}}>
          <Hallway f={f} lifted={lifted} />
        </AbsoluteFill>
      )}
      {inEar && (
        <AbsoluteFill style={{transform: `scale(${earZoom})`, opacity: interpolate(f, [B.lift + 14, B.lift + 22], [0, 1], clamp)}}>
          <Earpiece f={f} red={redEar} />
        </AbsoluteFill>
      )}
      {f >= B.turn && f < B.black && (
        <AbsoluteFill style={{background: '#020101', transform: `translateX(${pan + shake}px)`}}>
          <div style={{position: 'absolute', left: 140, top: 380, width: 800, height: 1160, background: '#000', border: '22px solid #1c120a', overflow: 'hidden'}}>
            <div style={{position: 'absolute', left: '50%', top: '52%', width: 560, height: 730, transform: `translate(-50%, -50%) scale(${faceScale})`, opacity: f < B.scare ? 0.35 : 1}}>
              <Face f={f} eye={f < B.scare ? 0.6 : 1} />
            </div>
          </div>
          <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 0%, rgba(255,179,71,.18), transparent 60%)`}} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,.9) 100%)', pointerEvents: 'none'}} />
      <AbsoluteFill style={{opacity: 0.09, mixBlendMode: 'screen', pointerEvents: 'none',
        backgroundImage: `repeating-radial-gradient(circle at ${rnd(f) * 100}% ${rnd(f + 3) * 100}%, rgba(255,230,200,.5) 0 1px, transparent 1px 3px)`}} />
      {f >= B.scare && f < B.black && <AbsoluteFill style={{background: RED, opacity: 0.25 * rnd(f + 2), mixBlendMode: 'multiply'}} />}

      {TEXT.map((t, i) => <Caption key={i} f={f} from={i === 0 ? 0 : VO[i].at - 2} to={VO[i].at + VO[i].dur + 10} text={t} red={i >= 1}
        size={i === 1 ? 110 : 64} y={i === 1 ? 300 : 1600} />)}
      {f >= B.black && (
        <>
          <Caption f={f} from={B.black + 2} to={H19_FRAMES} text="الليلة القادمة… ساعة تدور للوراء" y={760} red size={60} />
          <div style={{position: 'absolute', top: 1100, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: 44,
            opacity: interpolate(f, [B.black + 26, B.black + 36], [0, 1], clamp)}}>
            <span style={{background: '#ffd35a', color: '#140406', borderRadius: 24, padding: '6px 30px'}}>🔔 اشترك لتصلك قصة الليلة القادمة</span>
          </div>
        </>
      )}

      <Snd name="drone" at={0} dur={B.silence} vol={0.24} loop />
      <Snd name="wind" at={0} dur={B.ring} vol={0.14} loop />
      <Snd name="ring" at={B.ring} dur={B.lift - B.ring} vol={0.45} loop />
      <Snd name="click" at={B.lift} dur={10} vol={0.4} />
      <Snd name="breath" at={B.lift + 6} dur={B.silence - B.lift - 6} vol={0.5} loop />
      {Array.from({length: 2}, (_, i) => <Snd key={`h${i}`} name="heartbeat" at={B.silence - 44 + i * 22} dur={24} vol={0.45} />)}
      <Snd name="sting" at={B.scare} dur={90} vol={0.6} />
      <Snd name="static" at={B.scare + 2} dur={24} vol={0.35} />
      <Snd name="drone" at={B.black} dur={H19_FRAMES - B.black} vol={0.18} />
      {VO.map((v) => (
        <Sequence key={v.src} from={v.at} durationInFrames={v.dur + 8} layout="none"><Audio src={staticFile(v.src)} volume={1} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
