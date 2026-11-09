import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';

// Horror ep 2 — «الإطار 481», fully animated in code (anime style, no stills).
// A girl exports a horror film at night; the video errors at frame 481; every rewind the red-hooded
// figure on screen is a step closer; silence; she hears it behind her; it lunges out of the screen.
// Dark red + black, but lit so everything reads. Never gore.

const FONT = 'Cairo, sans-serif';
const RED = '#ff2340';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = {...clamp, easing: Easing.inOut(Easing.cubic)};
export const H02_FRAMES = 594;

const L = [
  {at: 36, dur: 202, src: 'voice/h02/0.wav'},
  {at: 246, dur: 130, src: 'voice/h02/1.wav'},
  {at: 384, dur: 98, src: 'voice/h02/2.wav'},
  {at: 504, dur: 65, src: 'voice/h02/3.wav'},
];

const rnd = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

// ---------- the figure (used on the monitor and full screen) ----------
const Hooded: React.FC<{f: number; walk?: number; eyes?: number; smile?: number}> = ({f, walk = 0, eyes = 1, smile = 0}) => {
  const sway = Math.sin(f / 9) * 4 * walk;
  const step = Math.sin(f / 5) * 10 * walk;
  return (
    <g transform={`rotate(${sway * 0.4})`}>
      {/* cloak */}
      <path d={`M -70 40 Q -95 180 ${-110 + step} 330 L ${110 + step} 330 Q 95 180 70 40 Z`} fill="#8e0f22" />
      <path d={`M -70 40 Q -95 180 ${-110 + step} 330 L ${-40 + step} 330 Q -40 160 -30 50 Z`} fill="#5c0814" />
      {/* hood */}
      <path d="M -88 30 Q -95 -110 0 -125 Q 95 -110 88 30 Q 60 70 0 72 Q -60 70 -88 30 Z" fill="#a8142b" />
      <path d="M -60 20 Q -62 -70 0 -82 Q 62 -70 60 20 Q 40 52 0 54 Q -40 52 -60 20 Z" fill="#14070a" />
      {/* pale face */}
      <path d="M -40 -20 Q -42 -62 0 -66 Q 42 -62 40 -20 Q 36 30 0 44 Q -36 30 -40 -20 Z" fill="#e9e4e6" />
      <path d="M -6 -60 L 4 -30 L -3 -5" stroke="#6d5a60" strokeWidth="2" fill="none" />
      {/* hollow eyes with red glow */}
      {[-17, 17].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={-14} rx={11} ry={8} fill="#0b0204" />
          <circle cx={x} cy={-14} r={3.4} fill={RED} opacity={eyes} />
          <circle cx={x} cy={-14} r={10} fill={RED} opacity={0.35 * eyes} />
        </g>
      ))}
      {/* smile */}
      <path d={`M -18 ${18 - smile * 2} Q 0 ${26 + smile * 10} 18 ${18 - smile * 2}`} stroke="#3a0b12" strokeWidth={3 + smile} fill="none" strokeLinecap="round" />
    </g>
  );
};

// ---------- the room ----------
const Rain: React.FC<{f: number; x: number; y: number; w: number; h: number}> = ({f, x, y, w, h}) => (
  <g>
    {Array.from({length: 46}, (_, i) => {
      const rx = x + rnd(i * 3.1) * w;
      const ry = y + ((rnd(i * 7.7) * h + f * (22 + rnd(i) * 10)) % h);
      return <line key={i} x1={rx} y1={ry} x2={rx - 6} y2={ry + 34} stroke="#9fb3ff" strokeOpacity={0.45} strokeWidth={2} />;
    })}
  </g>
);

const Screen: React.FC<{f: number; closeness: number; rewinding: boolean; error: boolean}> = ({f, closeness, rewinding, error}) => {
  // a corridor in perspective with the figure; closeness 0..1 brings it forward
  const s = 0.32 + closeness * 0.9;
  return (
    <g>
      <rect x={0} y={0} width={520} height={320} fill="#1a0a10" />
      <path d="M 0 0 L 190 120 L 330 120 L 520 0 Z" fill="#2a1118" />
      <path d="M 0 320 L 190 200 L 330 200 L 520 320 Z" fill="#240d13" />
      <rect x={190} y={120} width={140} height={80} fill="#0c0306" />
      <rect x={235} y={128} width={50} height={8} fill="#ff5a5a" opacity={0.6 + 0.4 * Math.sin(f / 3)} />
      <g transform={`translate(260 ${190 + closeness * 60}) scale(${s})`}>
        <Hooded f={f} walk={rewinding ? 0 : 1} eyes={0.6 + 0.4 * Math.sin(f / 6)} />
      </g>
      {rewinding && Array.from({length: 6}, (_, i) => (
        <rect key={i} x={0} y={rnd(f + i * 9) * 320} width={520} height={4 + rnd(f * 2 + i) * 10} fill={i % 2 ? '#ff2340' : '#5b8cff'} opacity={0.35} />
      ))}
      {error && (
        <g>
          <rect x={60} y={40} width={400} height={56} rx={8} fill="#0d0507" stroke={RED} strokeWidth={4} />
          <text x={260} y={78} textAnchor="middle" fill="#fff" fontFamily={FONT} fontWeight={900} fontSize={28} direction="rtl">خطأ تصدير: الإطار 481</text>
        </g>
      )}
      {/* glow + scanlines */}
      <rect x={0} y={0} width={520} height={320} fill="url(#scan)" opacity={0.5} />
    </g>
  );
};

// girl seen from behind / three-quarter, anime style
const Girl: React.FC<{f: number; turn: number; scared: number}> = ({f, turn, scared}) => {
  const breathe = Math.sin(f / 22) * 4;
  const type = Math.sin(f / 2.2) * 6 * (1 - turn);
  const blink = f % 96 > 91 ? 0.1 : 1;
  const tremble = scared ? (rnd(f) - 0.5) * 4 * scared : 0;
  return (
    <g transform={`translate(${tremble} ${breathe * 0.4})`}>
      {/* chair */}
      <path d="M -170 120 Q -180 -40 -150 -120 L 150 -120 Q 180 -40 170 120 Z" fill="#1d1a24" />
      <rect x={-20} y={120} width={40} height={140} fill="#141118" />
      {/* hoodie body */}
      <path d={`M -150 140 Q -160 -30 -90 -90 Q 0 -${130 + breathe} 90 -90 Q 160 -30 150 140 Z`} fill="#2f5d58" />
      <path d="M -90 -90 Q 0 -60 90 -90 Q 60 -40 0 -36 Q -60 -40 -90 -90 Z" fill="#244a46" />
      {/* typing arm */}
      <path d={`M 110 -40 Q 190 ${10 + type} 230 ${-10 + type}`} stroke="#2f5d58" strokeWidth={46} strokeLinecap="round" fill="none" />
      <circle cx={232} cy={-10 + type} r={18} fill="#f1d6c8" />
      {/* head */}
      <g transform={`translate(${turn * -14} -${170 + breathe * 0.5}) rotate(${-turn * 22})`}>
        <ellipse cx={0} cy={0} rx={86} ry={92} fill="#1b1622" />
        {/* face appears as she turns */}
        <g opacity={turn}>
          <path d="M -78 -6 Q -80 70 -20 92 Q -50 40 -52 -10 Z" fill="#f4dccf" />
          <ellipse cx={-56} cy={14} rx={16} ry={22 * blink * (1 + scared * 0.25)} fill="#fff" />
          <ellipse cx={-58} cy={18} rx={10} ry={14 * blink} fill="#3b2a52" />
          <circle cx={-61} cy={12} r={4} fill="#fff" opacity={blink} />
          <path d={`M -66 ${-14 - scared * 8} Q -54 ${-22 - scared * 10} -42 ${-14 - scared * 6}`} stroke="#1b1622" strokeWidth={4} fill="none" />
          <ellipse cx={-46} cy={66} rx={6 + scared * 4} ry={3 + scared * 7} fill="#7a3a42" />
        </g>
        {/* hair locks + clip */}
        <path d="M -86 -10 Q -100 80 -60 110 Q -70 40 -60 10 Z" fill="#1b1622" />
        <path d="M 86 -10 Q 104 70 70 112 Q 76 40 66 10 Z" fill="#1b1622" />
        <path d={`M -40 -86 Q 0 -110 50 -84 Q 20 -96 -10 -70 Z`} fill="#2a2333" />
        <rect x={-34} y={-60} width={30} height={9} rx={4} fill="#9fd3ff" transform="rotate(-18)" />
      </g>
    </g>
  );
};

const Room: React.FC<{f: number; closeness: number; rewinding: boolean; error: boolean; turn: number; scared: number; lampFlicker: number}> = (p) => {
  const {f} = p;
  const flick = 1 - p.lampFlicker * (rnd(Math.floor(f / 2)) > 0.7 ? 0.45 : 0);
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
      <defs>
        <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000" /></pattern>
        <radialGradient id="monGlow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#ff4060" stopOpacity="0.55" /><stop offset="1" stopColor="#ff4060" stopOpacity="0" /></radialGradient>
        <radialGradient id="lamp" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#ffb86b" stopOpacity="0.5" /><stop offset="1" stopColor="#ffb86b" stopOpacity="0" /></radialGradient>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a3150" /><stop offset="1" stopColor="#241d33" /></linearGradient>
      </defs>
      <rect width={1080} height={1920} fill="url(#wall)" />
      {/* window with rain */}
      <rect x={90} y={220} width={420} height={560} rx={10} fill="#16203f" />
      <Rain f={f} x={90} y={220} w={420} h={560} />
      <rect x={90} y={220} width={420} height={560} rx={10} fill="none" stroke="#4a4266" strokeWidth={14} />
      <line x1={300} y1={220} x2={300} y2={780} stroke="#4a4266" strokeWidth={10} />
      {/* lamp */}
      <circle cx={900} cy={360} r={220 * flick} fill="url(#lamp)" />
      <path d="M 860 300 L 940 300 L 960 370 L 840 370 Z" fill="#c9844a" opacity={0.9 * flick} />
      {/* desk */}
      <rect x={0} y={1130} width={1080} height={70} fill="#4b3a33" />
      <rect x={0} y={1200} width={1080} height={720} fill="#2b2128" />
      {/* monitor */}
      <circle cx={760} cy={880} r={420} fill="url(#monGlow)" />
      <rect x={480} y={690} width={560} height={360} rx={18} fill="#0c0b10" />
      <g transform="translate(500 710)"><Screen f={f} closeness={p.closeness} rewinding={p.rewinding} error={p.error} /></g>
      <rect x={730} y={1050} width={60} height={80} fill="#0c0b10" />
      {/* mug */}
      <rect x={380} y={1060} width={60} height={70} rx={10} fill="#d9cbbf" />
      {/* girl */}
      <g transform="translate(330 1330)"><Girl f={f} turn={p.turn} scared={p.scared} /></g>
      {/* red rim light from the screen */}
      <rect width={1080} height={1920} fill="#ff1a3a" opacity={0.06 + p.closeness * 0.08} style={{mixBlendMode: 'screen'}} />
    </svg>
  );
};

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1500, size = 76}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 60, right: 60, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900,
      fontSize: size, lineHeight: 1.35, color: red ? RED : '#fff', opacity: o, textShadow: '0 0 20px #000, 0 4px 0 #000'}}>{text}</div>
  );
};

const Sfx: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={at} durationInFrames={dur} layout="none"><Audio src={staticFile(`sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

export const H02Frame481: React.FC = () => {
  const f = useCurrentFrame();

  // story state
  const rewinding = (f >= 252 && f < 268) || (f >= 312 && f < 328);
  const closeness = f < 246 ? 0.05 : f < 268 ? 0.25 : f < 328 ? 0.5 : f < 384 ? 0.75 : 0.85;
  const error = f >= 150 && f < 246;
  const turn = interpolate(f, [400, 440], [0, 1], ease);
  const scared = interpolate(f, [430, 470], [0, 1], clamp);

  // camera: [scale, focusX, focusY] per shot, eased between
  const cams: [number, number, number, number][] = [
    // frame, scale, fx, fy
    [0, 2.6, 760, 900],     // hook: tight on the figure on screen
    [36, 1.0, 540, 960],    // wide room
    [200, 1.15, 600, 980],
    [246, 1.9, 760, 880],   // on the monitor while it rewinds
    [376, 1.9, 760, 880],
    [392, 1.6, 360, 1150],  // on her face as she turns
    [482, 1.75, 330, 1150],
    [570, 1.75, 330, 1150],
  ];
  let k = 0;
  while (k < cams.length - 2 && f >= cams[k + 1][0]) k++;
  const [fa, sa, xa, ya] = cams[k], [fb, sb, xb, yb] = cams[k + 1];
  const t = interpolate(f, [fa, fb], [0, 1], ease);
  const cut = k === 0 && f < 36; // hook holds
  const S = cut ? sa + 0.15 * (f / 36) : sa + (sb - sa) * t;
  const FX = cut ? xa : xa + (xb - xa) * t, FY = cut ? ya : ya + (yb - ya) * t;
  const camShake = f >= 500 && f < 540 ? 18 : f < 36 ? 3 : 0;
  const sx = (rnd(f * 1.3) - 0.5) * camShake, sy = (rnd(f * 2.1) - 0.5) * camShake;

  const dark = interpolate(f, [482, 490, 498, 500], [0, 0.9, 0.9, 0], clamp);
  const lunge = interpolate(f, [500, 520], [0.4, 1.25], {...clamp, easing: Easing.out(Easing.back(1.6))});
  const flash = interpolate(f, [500, 503, 522], [0, 0.6, 0], clamp);
  const loop = interpolate(f, [572, 594], [0, 1], clamp);

  return (
    <AbsoluteFill style={{background: '#120a12', overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `translate(${540 - FX * S + sx}px, ${960 - FY * S + sy}px) scale(${S})`, transformOrigin: '0 0'}}>
        <Room f={f} closeness={closeness} rewinding={rewinding} error={error} turn={turn} scared={scared} lampFlicker={f > 380 ? 1 : 0.3} />
      </AbsoluteFill>

      {/* the scare: it comes out of the screen */}
      {f >= 500 && f < 580 && (
        <AbsoluteFill>
          <svg viewBox="-540 -960 1080 1920" width={1080} height={1920}>
            <rect x={-540} y={-960} width={1080} height={1920} fill="#0a0204" opacity={0.85} />
            <g transform={`translate(0 120) scale(${lunge * 4.2})`}><Hooded f={f} eyes={1} smile={interpolate(f, [505, 530], [0, 1], clamp)} /></g>
          </svg>
        </AbsoluteFill>
      )}
      {/* loop back to the hook framing */}
      {loop > 0 && (
        <AbsoluteFill style={{opacity: loop, transform: `translate(${540 - 760 * 2.6}px, ${960 - 900 * 2.6}px) scale(2.6)`, transformOrigin: '0 0'}}>
          <Room f={f} closeness={0.05} rewinding={false} error={false} turn={0} scared={0} lampFlicker={0.3} />
        </AbsoluteFill>
      )}

      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)'}} />
      <AbsoluteFill style={{background: RED, opacity: flash, mixBlendMode: 'screen'}} />
      <AbsoluteFill style={{background: '#000', opacity: dark}} />
      {f >= 246 && f < 376 && (
        <div style={{position: 'absolute', top: 130, left: 0, right: 0, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 64,
          color: '#fff', opacity: rewinding ? 1 : 0.5, textShadow: '0 0 16px #000'}}>◀◀ 481</div>
      )}

      <Caption f={f} from={0} to={40} text="لا ترجّع الفيديو…" size={90} />
      <Caption f={f} from={40} to={150} text="كنت أصدّر فيلم رعب…" />
      <Caption f={f} from={150} to={242} text="فظهر خطأ… في الإطار 481" />
      <Caption f={f} from={248} to={376} text="كلّما أرجعتُ الفيديو… اقتربت خطوة" />
      <Caption f={f} from={386} to={484} text="ثم سمعتُ صوتها… من خلفي" />
      <Caption f={f} from={506} to={572} text="الآن… دوري" red size={116} y={1460} />
      <Caption f={f} from={576} to={594} text="لا ترجّع الفيديو…" size={90} />

      {/* quiet bed, clear narrator, one hard sting */}
      <Sequence from={0} durationInFrames={482} layout="none"><Audio src={staticFile('sfx/horror/drone.wav')} volume={0.06} loop /></Sequence>
      <Sfx name="flicker" at={150} vol={0.18} />
      <Sfx name="flicker" at={252} vol={0.2} />
      <Sfx name="flicker" at={312} vol={0.22} />
      <Sfx name="creak" at={386} vol={0.2} />
      <Sfx name="heartbeat" at={440} dur={42} vol={0.3} loop />
      <Sfx name="sting" at={500} dur={94} vol={0.85} />
      {L.map((l) => (
        <Sequence key={l.src} from={l.at} durationInFrames={l.dur + 6} layout="none"><Audio src={staticFile(l.src)} volume={1} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
