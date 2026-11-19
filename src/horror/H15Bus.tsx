import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import TL from './H15Bus.timeline.json';

// Horror ep 15 — «الحافلة الأخيرة». I take the last bus, it is empty; on a back seat a paper with my name.
// I sit at the front, far from it… and in the window glass I see myself sitting back there.
// Look: one-point perspective down the bus aisle (no earlier ep used a symmetric vanishing point), sodium
// street lights sweeping through the windows as bands of orange that turn blood red, a slow dolly forward to
// the paper. Then a hard cut to the black window glass: my reflection, and behind it, «me» in the seat.
// Never gore. Voice: Hamed +10 %, −20 Hz (public/voice/h15-bus).

const FONT = 'Cairo, sans-serif';
const RED = '#ff1a33';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H15_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const TEXT = ['الحافلة الأخيرة… فارغة', 'على المقعد الخلفي… ورقة باسمي', 'جلست في الأمام', 'وفي زجاج النافذة… رأيتني جالسًا هناك'];
const rnd = (n: number) => {const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x);};

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={Math.round(at)} durationInFrames={Math.max(1, dur)} layout="none"><Audio src={staticFile(`sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1560, size = 62}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#efe7e4', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000, 0 0 6px #000'}}>{text}</div>
  );
};

// a passing street light: a band of light that sweeps from the back of the bus to the front
const sweep = (f: number, period: number, phase: number) => ((f + phase) % period) / period;

// vanishing point
const VX = 540, VY = 820;
// a point on the floor/ceiling/walls at depth z (0 = camera, 1 = back of the bus)
const P = (x: number, y: number, z: number) => {
  const k = 1 - z * 0.82;
  return [VX + (x - VX) * k, VY + (y - VY) * k];
};

const Seat: React.FC<{side: -1 | 1; z: number; tag?: number; ghost?: number}> = ({side, z, tag = 0, ghost = 0}) => {
  const xi = side < 0 ? 120 : 960, xo = side < 0 ? 380 : 700;
  const [ax, ay] = P(xi, 1500, z), [bx, by] = P(xo, 1500, z);
  const [cx, cy] = P(xi, 1040, z), [dx, dy] = P(xo, 1040, z);
  const [ex, ey] = P(xi, 1300, z), [fx, fy] = P(xo, 1300, z);
  const k = 1 - z * 0.82;
  return (
    <g>
      {/* backrest */}
      <path d={`M${cx} ${cy} L${dx} ${dy} L${fx} ${fy} L${ex} ${ey} Z`} fill="#1a0608" stroke="#000" strokeWidth={6 * k} />
      <path d={`M${cx} ${cy} L${dx} ${dy}`} stroke="#3a0d12" strokeWidth={10 * k} />
      {/* cushion */}
      <path d={`M${ex} ${ey} L${fx} ${fy} L${bx} ${by - 60 * k} L${ax} ${ay - 60 * k} Z`} fill="#12040600" />
      {/* the paper with my name, tucked on the backrest */}
      {tag > 0 && (
        <g transform={`translate(${(cx + dx) / 2} ${cy + 70 * k}) scale(${k * 1.8})`} opacity={tag}>
          <ellipse cx="0" cy="5" rx="120" ry="80" fill="#ff1a33" opacity="0.25" style={{filter: 'blur(18px)'}} />
          <rect x="-70" y="-30" width="140" height="70" fill="#d8cfc2" transform="rotate(-6)" />
          <path d="M-46 -6 h92 M-40 12 h70" stroke="#3a0a0e" strokeWidth="5" transform="rotate(-6)" />
        </g>
      )}
      {ghost > 0 && (
        <g transform={`translate(${(cx + dx) / 2} ${cy + 10 * k}) scale(${k})`} opacity={ghost}>
          <path d="M-70 120 Q-80 -30 0 -40 Q80 -30 70 120 Z" fill="#000" />
          <ellipse cx="0" cy="-90" rx="46" ry="58" fill="#000" />
          <g style={{filter: 'drop-shadow(0 0 8px #ff1a33)'}}><circle cx="-16" cy="-92" r="6" fill={RED} /><circle cx="16" cy="-92" r="6" fill={RED} /></g>
        </g>
      )}
    </g>
  );
};

const Aisle: React.FC<{f: number}> = ({f}) => {
  // street lights: orange at first, they turn red as the paper is found
  const redness = interpolate(f, [B.tag, B.tag + 40], [0, 1], clamp);
  const col = redness > 0.5 ? RED : '#ff8a2a';
  const zs = [0.18, 0.36, 0.52, 0.66, 0.78];
  const [bl, bt] = P(120, 340, 1), [br, bb] = P(960, 1500, 1);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
      <defs>
        <linearGradient id="h15floor" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#0d0405" /><stop offset="1" stopColor="#030102" /></linearGradient>
      </defs>
      <rect width="1080" height="1920" fill="#020001" />
      {/* ceiling, floor, side walls */}
      <path d={`M0 0 L1080 0 L${br} ${bt} L${bl} ${bt} Z`} fill="#070203" />
      <path d={`M0 1920 L1080 1920 L${br} ${bb} L${bl} ${bb} Z`} fill="url(#h15floor)" />
      <path d={`M0 0 L${bl} ${bt} L${bl} ${bb} L0 1920 Z`} fill="#0a0304" />
      <path d={`M1080 0 L${br} ${bt} L${br} ${bb} L1080 1920 Z`} fill="#0a0304" />
      {/* windows, both sides, with the street-light bands sweeping front-to-back as the bus drives */}
      {[-1, 1].map((s) => {
        const xa = s < 0 ? 0 : 1080;
        const xb = s < 0 ? 120 : 960;
        const [w1x, w1y] = P(xb, 420, 1), [w2x, w2y] = P(xb, 1000, 1);
        return (
          <g key={s}>
            <path d={`M${xa} 260 L${w1x} ${w1y} L${w2x} ${w2y} L${xa} 1180 Z`} fill="#050102" />
            {[0, 1].map((j) => {
              const t = sweep(f, 52, j * 26 + (s > 0 ? 9 : 0));
              const z = 1 - t; // from the back to the camera
              const [ux, uy] = P(xb, 420, z), [lx, ly] = P(xb, 1000, z);
              const k = 1 - z * 0.82;
              const w = 70 * k;
              const pts = `${ux} ${uy} ${ux + (s < 0 ? -w : w)} ${uy - 30 * k} ${lx + (s < 0 ? -w : w)} ${ly + 30 * k} ${lx} ${ly}`;
              return <polygon key={j} points={pts} fill={col} opacity={0.55 * Math.sin(t * Math.PI)} style={{filter: 'blur(6px)'}} />;
            })}
          </g>
        );
      })}
      {/* aisle light wash from the windows */}
      <path d={`M300 1920 L780 1920 L${VX + 60} ${bb} L${VX - 60} ${bb} Z`} fill={col} opacity={0.05 + 0.05 * Math.sin(f / 4)} />
      {/* grab poles */}
      {zs.map((z) => {
        const [x1, y1] = P(400, 0, z), [x2, y2] = P(400, 1500, z);
        const [x3, y3] = P(680, 0, z), [x4, y4] = P(680, 1500, z);
        return <g key={z} stroke="#2a0b0e" strokeWidth={10 * (1 - z * 0.82)}><path d={`M${x1} ${y1} L${x2} ${y2}`} /><path d={`M${x3} ${y3} L${x4} ${y4}`} /></g>;
      })}
      {/* seats, far to near */}
      {[...zs].reverse().map((z, i) => (
        <g key={z}>
          <Seat side={-1} z={z} />
          <Seat side={1} z={z} tag={z === 0.78 ? interpolate(f, [8, 30], [0, 1], clamp) : 0}
            ghost={z === 0.78 && f >= B.ghost && f < B.ghost + 4 ? 1 : 0} />
        </g>
      ))}
      {/* the back window of the bus */}
      <rect x={bl + 40} y={bt + 120} width={br - bl - 80} height={220} fill="#0a0203" stroke="#000" strokeWidth="6" />
      {/* flickering ceiling strip */}
      <path d={`M${VX - 20} 0 L${VX + 20} 0 L${VX + 6} ${bt} L${VX - 6} ${bt} Z`} fill="#ffd9b0" opacity={rnd(Math.floor(f / 3)) > 0.12 ? 0.12 : 0.02} />
    </svg>
  );
};

// the black window glass: my reflection, and behind it, me in the reserved seat
const Glass: React.FC<{f: number}> = ({f}) => {
  const lt = f - B.reflect;
  const scare = f >= B.scare;
  const near = scare ? interpolate(f, [B.scare, B.scare + 10], [0.6, 1.05], {...clamp, easing: Easing.out(Easing.cubic)}) : 0.6;
  const streak = sweep(f, 40, 0);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
      <rect width="1080" height="1920" fill="#020001" />
      {/* the city passing outside: blurred lights */}
      {Array.from({length: 8}, (_, i) => {
        const x = ((i * 190 - f * 14) % 1400 + 1400) % 1400 - 160;
        return <ellipse key={i} cx={x} cy={300 + (i % 3) * 120} rx="90" ry="20" fill={i % 2 ? '#ff8a2a' : RED} opacity="0.18" style={{filter: 'blur(14px)'}} />;
      })}
      {/* a big street-light sweep across the whole glass */}
      <rect x={-400 + streak * 1900} y="0" width="220" height="1920" fill="#ff8a2a" opacity={0.12 * Math.sin(streak * Math.PI)} transform="skewX(-12)" style={{filter: 'blur(30px)'}} />
      {/* reflected bus interior: the seat rows, faint */}
      {[0, 1, 2].map((i) => <rect key={i} x={140 + i * 40} y={980 + i * 30} width={800 - i * 80} height={14} fill="#2a0a0e" opacity="0.6" />)}
      {/* the reserved seat far behind, with the paper */}
      <rect x="600" y="820" width="200" height="260" rx="20" fill="#1a0507" opacity="0.8" />
      {/* «me» in that seat: same shape as my reflection, but it stares, and leans closer at the scare */}
      <g transform={`translate(700 ${1000 - (near - 0.6) * 300}) scale(${near})`}>
        <path d="M-150 260 Q-160 0 0 -10 Q160 0 150 260 Z" fill="#000" />
        <ellipse cx="0" cy="-110" rx="95" ry="118" fill="#8a807d" opacity={scare ? 0.85 : 0.3} />
        <ellipse cx="-30" cy="-90" rx="90" ry="120" fill="#000" opacity="0.45" style={{filter: 'blur(12px)'}} />
        <path d="M-100 -150 Q-90 -250 0 -248 Q90 -250 100 -150 Q60 -205 0 -200 Q-60 -205 -100 -150 Z" fill="#0a0203" />
        <ellipse cx="-34" cy="-110" rx="26" ry="22" fill="#000" /><ellipse cx="34" cy="-110" rx="26" ry="22" fill="#000" />
        <g style={{filter: 'drop-shadow(0 0 10px #ff1a33)'}} opacity={scare ? 1 : interpolate(lt, [20, 40], [0, 0.7], clamp)}>
          <circle cx="-34" cy="-110" r="5" fill={RED} /><circle cx="34" cy="-110" r="5" fill={RED} />
        </g>
        {/* wet hair hanging over half the face */}
        <path d="M-100 -150 Q-110 -30 -70 40 L-50 -60 Q-40 -150 10 -190 Q-30 -60 -10 30 L10 -150 Q40 -200 100 -150 Q110 -60 90 20 Q60 -110 40 -160 Z" fill="#050102" opacity="0.9" />
        {/* a smile that is not mine */}
        {scare ? <path d="M-60 -48 L-20 -40 L20 -40 L60 -50 L20 -32 L-20 -32 Z" fill="#000" /> : <path d="M-30 -48 L30 -48" stroke="#000" strokeWidth="5" />}
      </g>
      {/* my own reflection, close, at the left, seen from behind-ish: hood/hair, cheek lit red */}
      <g transform="translate(250 1180)">
        <path d="M-260 600 Q-250 120 0 90 Q250 120 260 600 Z" fill="#000" />
        <ellipse cx="0" cy="-40" rx="150" ry="180" fill="#080203" />
        <path d="M140 -110 Q172 -30 136 70" stroke={RED} strokeWidth="6" fill="none" opacity="0.5" style={{filter: 'blur(2px)'}} />
      </g>
      {/* rain on the glass */}
      {Array.from({length: 26}, (_, i) => {
        const x = rnd(i) * 1080, y = ((rnd(i + 9) * 1920 + f * (3 + rnd(i) * 4)) % 1920);
        return <path key={i} d={`M${x} ${y} l-3 ${30 + rnd(i + 2) * 40}`} stroke="#ffd9d0" strokeWidth="2" opacity="0.12" />;
      })}
      {/* the glass frame */}
      <rect x="0" y="0" width="1080" height="40" fill="#120405" /><rect x="0" y="1880" width="1080" height="40" fill="#120405" />
    </svg>
  );
};

export const H15Bus: React.FC = () => {
  const f = useCurrentFrame();
  // dolly down the aisle to the back seat (the paper), back off when I sit at the front, cut to the glass
  const dolly = interpolate(f, [0, B.tag, B.tag + 40, B.front, B.front + 30, B.reflect], [1.0, 1.25, 1.9, 1.9, 1.05, 1.15],
    {...clamp, easing: Easing.inOut(Easing.cubic)});
  const sway = Math.sin(f / 21) * 6 + Math.sin(f / 7) * 1.5; // the bus rocking
  const ty = interpolate(dolly, [1, 1.9], [0, -150], clamp);
  const tx = interpolate(dolly, [1, 1.9], [0, -190], clamp);
  const glassZoom = interpolate(f, [B.reflect, B.silence], [1.0, 1.18], {...clamp, easing: Easing.inOut(Easing.sin)});
  const flick = f >= B.scare && f < B.black && rnd(f) > 0.72 ? 0.25 : 1;
  const shake = f >= B.scare && f < B.scare + 12 ? (rnd(f) - 0.5) * 30 : 0;

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {f < B.reflect && (
        <AbsoluteFill style={{transformOrigin: `${VX}px ${VY}px`, transform: `translate(${sway + tx}px, ${ty}px) rotate(${sway * 0.08}deg) scale(${dolly})`}}>
          <Aisle f={f} />
        </AbsoluteFill>
      )}
      {f >= B.reflect && f < B.black && (
        <AbsoluteFill style={{opacity: flick, transformOrigin: '700px 900px', transform: `translate(${shake}px, ${sway * 0.6}px) scale(${glassZoom})`}}>
          <Glass f={f} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 36%, rgba(0,0,0,.92) 100%)', pointerEvents: 'none'}} />
      <AbsoluteFill style={{opacity: 0.08, mixBlendMode: 'screen', pointerEvents: 'none',
        backgroundImage: `repeating-radial-gradient(circle at ${rnd(f) * 100}% ${rnd(f + 3) * 100}%, rgba(255,255,255,.5) 0 1px, transparent 1px 3px)`}} />

      {TEXT.map((t, i) => <Caption key={i} f={f} from={i === 0 ? 0 : VO[i].at - 2} to={VO[i].at + VO[i].dur + 10} text={t} red={i >= 3} size={i === 3 ? 56 : 60} />)}
      {f >= B.black && (
        <>
          <Caption f={f} from={B.black + 2} to={H15_FRAMES} text="الليلة القادمة… جهاز مراقبة طفل… ولا طفل في البيت" y={760} red size={56} />
          <div style={{position: 'absolute', top: 1100, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: 44,
            opacity: interpolate(f, [B.black + 26, B.black + 36], [0, 1], clamp)}}>
            <span style={{background: '#ffd35a', color: '#140406', borderRadius: 24, padding: '6px 30px'}}>🔔 اشترك لتصلك قصة الليلة القادمة</span>
          </div>
        </>
      )}

      <Snd name="drone" at={0} dur={B.silence} vol={0.3} loop />
      <Snd name="wind" at={0} dur={B.silence} vol={0.22} loop />
      {Array.from({length: Math.floor(B.silence / 52)}, (_, i) => <Snd key={`w${i}`} name="static" at={i * 52 + 20} dur={14} vol={0.08} />)}
      {Array.from({length: 4}, (_, i) => <Snd key={`h${i}`} name="heartbeat" at={B.reflect + i * 22} dur={24} vol={0.42} />)}
      <Snd name="creak" at={B.front} dur={30} vol={0.3} />
      <Snd name="sting" at={B.scare} dur={90} vol={0.6} />
      <Snd name="flicker" at={B.scare + 2} dur={20} vol={0.4} />
      <Snd name="drone" at={B.black} dur={H15_FRAMES - B.black} vol={0.18} />
      {VO.map((v) => (
        <Sequence key={v.src} from={v.at} durationInFrames={v.dur + 8} layout="none"><Audio src={staticFile(v.src)} volume={1} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
