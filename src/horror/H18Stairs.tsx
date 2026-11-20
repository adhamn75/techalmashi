import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import TL from './H18Stairs.timeline.json';

// Horror ep 18 — «الدرج». I count my stairs every night: twelve. Tonight, thirteen. The extra step is at the bottom,
// in the dark — and when I stood on it, it breathed.
// Look: a cold moonlit cut-away of a staircase seen from the side, a big step counter that ticks as the camera walks
// down one step at a time (head-bob), the 13th step lit only by the red number; the scare is the step opening its eyes.
// Voice: Hamed +18 %, −22 Hz (public/voice/h18-stairs). Never gore.

const RED = '#ff1a33';
const FONT = 'Cairo, sans-serif';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H18_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const TEXT = ['درج بيتي… اثنتا عشرة درجة', 'الليلة عددتها… ثلاث عشرة', 'الزائدة في الأسفل… في الظلام', 'وحين وقفت عليها… تنفست'];
const rnd = (n: number) => {const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x);};
const AR = ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '١٠', '١١', '١٢', '١٣'];

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={Math.round(at)} durationInFrames={Math.max(1, dur)} layout="none"><Audio src={staticFile(`sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1620, size = 62}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#dfe7f0', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000, 0 0 6px #000'}}>{text}</div>
  );
};

// step geometry: step i (0 = top) in world space; 13 steps, the last one is the extra
const SW = 150, SH = 92;
const stepX = (i: number) => 180 + i * SW * 0.62;
const stepY = (i: number) => 300 + i * SH;

// how many steps have been counted at frame f: 1..12 during the first line, then the 13th
const counted = (f: number) => {
  if (f < B.count) return 0;
  if (f < B.thirteen) return Math.min(12, 1 + Math.floor((f - B.count) / ((B.thirteen - B.count) / 12)));
  return 13;
};

const Stairs: React.FC<{f: number; breath: number; eyes: number}> = ({f, breath, eyes}) => {
  const n = counted(f);
  return (
    <svg width={2400} height={2200} viewBox="0 0 2400 2200" style={{position: 'absolute', left: 0, top: 0}}>
      <defs>
        <linearGradient id="h18moon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9fb6d6" stopOpacity="0.45" /><stop offset="1" stopColor="#9fb6d6" stopOpacity="0" /></linearGradient>
        <linearGradient id="h18dark" x1="0" y1="0" x2="1" y2="0.6"><stop offset="0" stopColor="#000" stopOpacity="0" /><stop offset="0.55" stopColor="#000" stopOpacity="0.55" /><stop offset="1" stopColor="#000" stopOpacity="1" /></linearGradient>
        <radialGradient id="h18red" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ff1a33" stopOpacity="0.55" /><stop offset="1" stopColor="#ff1a33" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="2400" height="2200" fill="#04060a" />
      {/* the wall and a high window throwing moonlight down the stairs */}
      <rect x="60" y="40" width="220" height="300" fill="#1b2533" stroke="#0a0e14" strokeWidth="14" />
      <path d="M170 40 L170 340 M60 190 L280 190" stroke="#0a0e14" strokeWidth="12" />
      <path d="M60 340 L280 340 L1500 2200 L700 2200 Z" fill="url(#h18moon)" />
      {/* handrail */}
      <path d={`M${stepX(0) + 40} ${stepY(0) - 150} L${stepX(12) + 60} ${stepY(12) - 150}`} stroke="#1a222e" strokeWidth="16" />
      {Array.from({length: 12}, (_, i) => <path key={i} d={`M${stepX(i) + 60} ${stepY(i) - 150 + 8} L${stepX(i) + 60} ${stepY(i)}`} stroke="#141b25" strokeWidth="9" />)}
      {/* the twelve ordinary steps */}
      {Array.from({length: 12}, (_, i) => (
        <g key={i}>
          <rect x={stepX(i)} y={stepY(i)} width={SW + 1200} height={SH} fill={i % 2 ? '#2a3442' : '#2e394a'} />
          <rect x={stepX(i)} y={stepY(i)} width={SW + 1200} height="10" fill="#5b6c84" opacity="0.6" />
          {n > i && (
            <text x={stepX(i) + 70} y={stepY(i) + 66} textAnchor="middle" fontFamily={FONT} fontWeight="900" fontSize="54" fill="#dfe7f0"
              opacity={interpolate(f, [B.count + i * 4, B.count + i * 4 + 6], [0, 0.9], clamp)}>{AR[i]}</text>
          )}
        </g>
      ))}
      {/* the 13th step: darker, longer, softer — it rises and falls */}
      <g transform={`translate(${stepX(12)} ${stepY(12) - breath * 30})`}>
        <path d={`M0 ${SH} Q0 0 40 0 L${SW + 1200} 0 L${SW + 1200} ${SH + 24} Z`} fill="#0d0f13" />
        <path d={`M30 6 L${SW + 1200} 6`} stroke="#2a1416" strokeWidth="6" opacity={0.4 + breath * 0.4} />
        {n >= 13 && eyes === 0 && (
          <>
            <ellipse cx="300" cy="40" rx="520" ry="200" fill="url(#h18red)" />
            <text x="80" y="66" textAnchor="middle" fontFamily={FONT} fontWeight="900" fontSize="64" fill={RED} style={{filter: 'drop-shadow(0 0 14px #ff1a33)'}}>{AR[12]}</text>
          </>
        )}
        {/* its eyes: two slits along the tread that open at the scare */}
        {eyes > 0 && [190, 330].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy="40" rx="62" ry={4 + eyes * 26} fill="#e9e2d6" />
            <circle cx={x - 6} cy="42" r={eyes * 18} fill="#120000" />
            <circle cx={x - 6} cy="42" r={eyes * 6} fill={RED} />
          </g>
        ))}
      </g>
      <rect x="0" y="0" width="2400" height="2200" fill="url(#h18dark)" opacity="0.7" />
    </svg>
  );
};

export const H18Stairs: React.FC = () => {
  const f = useCurrentFrame();
  const n = counted(f);
  const breathing = f >= B.stand && f < B.silence;
  const breath = breathing ? (Math.sin((f - B.stand) / 9) * 0.5 + 0.5) : f >= B.scare ? 1 : 0;
  const eyes = f >= B.scare ? interpolate(f, [B.scare, B.scare + 5], [0, 1], clamp) : 0;
  // camera walks down: target = the step being counted, with a head-bob on each step; then it sinks into the dark
  const target = f < B.thirteen ? Math.max(0, n - 1) : interpolate(f, [B.thirteen, B.dark + 30], [11, 12.4], {...clamp, easing: Easing.inOut(Easing.sin)});
  const bob = f >= B.count && f < B.thirteen ? Math.abs(Math.sin(((f - B.count) / ((B.thirteen - B.count) / 12)) * Math.PI)) * -16 : 0;
  const zoom = f < B.dark ? 1 : f < B.scare
    ? interpolate(f, [B.dark, B.silence], [1, 1.35], {...clamp, easing: Easing.inOut(Easing.sin)})
    : interpolate(f, [B.scare, B.scare + 8], [1.35, 2.2], {...clamp, easing: Easing.out(Easing.cubic)});
  const cx = stepX(target) + 120, cy = stepY(target) + 10;
  const shake = f >= B.scare && f < B.scare + 12 ? (rnd(f) - 0.5) * 30 : 0;
  const dim = interpolate(f, [B.dark, B.dark + 20], [1, 0.9], clamp);

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {f < B.black && (
        <AbsoluteFill style={{opacity: f >= B.scare && rnd(f) > 0.78 ? 0.3 : dim}}>
          <div style={{position: 'absolute', left: 0, top: 0, transformOrigin: `${cx}px ${cy}px`,
            transform: `translate(${540 - cx + shake}px, ${900 - cy + bob}px) scale(${zoom}) rotate(-4deg)`}}>
            <Stairs f={f} breath={breath} eyes={eyes} />
          </div>
        </AbsoluteFill>
      )}
      {/* the step counter */}
      {f >= B.count && f < B.silence && (
        <div style={{position: 'absolute', top: 170, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 200, lineHeight: 1,
          color: n >= 13 ? RED : '#dfe7f0', textShadow: n >= 13 ? '0 0 40px #ff1a33' : '0 0 30px rgba(160,190,230,.5)',
          scale: `${n >= 13 ? interpolate(f, [B.thirteen, B.thirteen + 8], [1.5, 1], {...clamp, easing: Easing.out(Easing.back(2))}) : 1}`}}>
          {n > 0 ? AR[n - 1] : ''}
        </div>
      )}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,.92) 100%)', pointerEvents: 'none'}} />
      <AbsoluteFill style={{opacity: 0.08, mixBlendMode: 'screen', pointerEvents: 'none',
        backgroundImage: `repeating-radial-gradient(circle at ${rnd(f) * 100}% ${rnd(f + 3) * 100}%, rgba(255,255,255,.5) 0 1px, transparent 1px 3px)`}} />
      {f >= B.scare && f < B.black && <AbsoluteFill style={{background: RED, opacity: 0.2 * rnd(f + 2), mixBlendMode: 'multiply'}} />}

      {TEXT.map((t, i) => <Caption key={i} f={f} from={i === 0 ? 0 : VO[i].at - 2} to={VO[i].at + VO[i].dur + 10} text={t} red={i >= 1} />)}
      {f >= B.black && (
        <>
          <Caption f={f} from={B.black + 2} to={H18_FRAMES} text="الليلة القادمة… هاتف مقطوع السلك يرن" y={760} red size={58} />
          <div style={{position: 'absolute', top: 1100, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: 44,
            opacity: interpolate(f, [B.black + 26, B.black + 36], [0, 1], clamp)}}>
            <span style={{background: '#ffd35a', color: '#140406', borderRadius: 24, padding: '6px 30px'}}>🔔 اشترك لتصلك قصة الليلة القادمة</span>
          </div>
        </>
      )}

      <Snd name="wind" at={0} dur={B.silence} vol={0.2} loop />
      <Snd name="drone" at={0} dur={B.silence} vol={0.24} loop />
      {Array.from({length: 12}, (_, i) => <Snd key={`s${i}`} name="creak" at={B.count + Math.round(i * (B.thirteen - B.count) / 12)} dur={14} vol={0.22} />)}
      <Snd name="creak" at={B.thirteen} dur={40} vol={0.5} />
      {Array.from({length: 3}, (_, i) => <Snd key={`h${i}`} name="heartbeat" at={B.silence - 66 + i * 22} dur={24} vol={0.45} />)}
      <Snd name="sting" at={B.scare} dur={90} vol={0.6} />
      <Snd name="flicker" at={B.scare + 2} dur={20} vol={0.4} />
      <Snd name="drone" at={B.black} dur={H18_FRAMES - B.black} vol={0.18} />
      {VO.map((v) => (
        <Sequence key={v.src} from={v.at} durationInFrames={v.dur + 8} layout="none"><Audio src={staticFile(v.src)} volume={1} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
