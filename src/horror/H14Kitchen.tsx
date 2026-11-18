import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import TL from './H14Kitchen.timeline.json';

// Horror ep 14 — «المطبخ». My mother calls my name from the kitchen, in her exact voice… but my mother is
// asleep beside me. She whispers: «don't go… I heard it too».
// Look: a wide side-on view from my pillow (1900 px wide, the camera pans across it — no earlier ep panned
// sideways): the long corridor with a red fridge glow at the kitchen end on the right, my mother asleep under
// the blanket on the left. Her eyes open, then the thing from the kitchen is in our doorway. Never gore.
// Voice: Hamed +4 %, −18 Hz (public/voice/h14-kitchen).

const FONT = 'Cairo, sans-serif';
const RED = '#ff1a33';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H14_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const TEXT = ['أمّي تناديني من المطبخ', 'باسمي… وبصوتها تمامًا', 'لكنّ أمّي نائمة بجانبي', 'همست: لا تذهب… سمعته أيضًا'];
const rnd = (n: number) => {const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x);};
const W = 1900;

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={Math.round(at)} durationInFrames={Math.max(1, dur)} layout="none"><Audio src={staticFile(`sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1580, size = 64}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#efe7e4', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000, 0 0 6px #000'}}>{text}</div>
  );
};

// the tall thin thing: long arms, head tilted, red eyes
const Thing: React.FC<{x: number; y: number; h: number; o: number; tilt?: number}> = ({x, y, h, o, tilt = 0}) => (
  <g transform={`translate(${x} ${y}) scale(${h / 600})`} opacity={o}>
    <path d="M-40 0 L-30 -260 L-60 -470 Q0 -500 60 -470 L30 -260 L40 0 Z" fill="#010000" />
    <path d="M-58 -460 Q-110 -300 -96 -40 L-84 -38 Q-80 -300 -44 -440 Z" fill="#010000" />
    <path d="M58 -460 Q110 -300 96 -40 L84 -38 Q80 -300 44 -440 Z" fill="#010000" />
    {/* long fingers on the left hand */}
    {[0, 1, 2, 3].map((i) => <path key={i} d={`M${-92 + i * 4} -40 l${-6 + i * 4} 54`} stroke="#010000" strokeWidth="6" />)}
    <g transform={`translate(0 -520) rotate(${tilt})`}>
      <ellipse cx="0" cy="0" rx="40" ry="56" fill="#010000" />
      <g style={{filter: 'drop-shadow(0 0 10px #ff1a33)'}}>
        <circle cx="-14" cy="-4" r="7" fill={RED} /><circle cx="14" cy="-4" r="7" fill={RED} />
      </g>
    </g>
  </g>
);

const Room: React.FC<{f: number}> = ({f}) => {
  const fridge = (rnd(Math.floor(f / 4)) > 0.08 ? 1 : 0.5) * (0.85 + 0.15 * Math.sin(f / 11));
  // a shadow crossing the kitchen light while she «calls»
  const cross = interpolate(f, [8, 70], [1560, 1760], clamp);
  const crossO = f < 80 ? interpolate(f, [8, 20, 60, 72], [0, 1, 1, 0], clamp) : 0;
  const eyes = interpolate(f, [B.eyes, B.eyes + 6], [0, 1], clamp);
  const thingO = f >= B.scare ? 1 : 0;
  const breath = Math.sin(f / 18) * 4;
  return (
    <svg width={W} height={1920} viewBox={`0 0 ${W} 1920`} style={{position: 'absolute', left: 0, top: 0}}>
      <defs>
        <linearGradient id="h14glow" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#ff2a1e" stopOpacity="0.55" /><stop offset="1" stopColor="#ff1a33" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="h14fridge" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ff6a50" /><stop offset="0.4" stopColor="#c0101c" /><stop offset="1" stopColor="#2a0306" />
        </radialGradient>
      </defs>
      {/* bedroom wall */}
      <rect width={W} height="1920" fill="#080304" />
      {Array.from({length: 20}, (_, i) => <rect key={i} x={i * 96} y="0" width="2" height="1300" fill="#0d0506" />)}
      {/* bedroom doorway (right) opening on the corridor */}
      <rect x="1180" y="380" width="520" height="920" fill="#030102" />
      {/* corridor in perspective: walls converge to the kitchen door at the end */}
      <path d="M1180 380 L1390 640 L1390 1060 L1180 1300 Z" fill="#0b0304" />
      <path d="M1700 380 L1500 640 L1500 1060 L1700 1300 Z" fill="#100405" />
      <path d="M1180 1300 L1390 1060 L1500 1060 L1700 1300 Z" fill="#0a0304" />
      <path d="M1180 1300 L1390 1060 L1500 1060 L1700 1300 Z" fill="url(#h14glow)" opacity={0.5 * fridge} />
      {/* the kitchen at the end: open fridge glow */}
      <rect x="1390" y="640" width="110" height="420" fill="url(#h14fridge)" opacity={fridge} />
      <rect x="1390" y="640" width="110" height="420" fill="none" stroke="#000" strokeWidth="8" />
      {/* shadow crossing the kitchen light */}
      <rect x={cross - 1560 + 1380} y="700" width="40" height="360" fill="#000" opacity={crossO} />
      {/* door frame */}
      <rect x="1166" y="370" width="16" height="940" fill="#140708" />
      <rect x="1698" y="370" width="16" height="940" fill="#140708" />
      <rect x="1166" y="362" width="548" height="18" fill="#140708" />
      {/* the thing, now in our doorway, backlit by the corridor */}
      {thingO > 0 && <rect x="1182" y="380" width="516" height="920" fill="#ff1a33" opacity={0.35 * fridge} style={{filter: 'blur(40px)'}} />}
      <Thing x={1440} y={1300} h={900} o={thingO} tilt={interpolate(f, [B.scare, B.scare + 20], [0, 22], clamp)} />
      {/* bed: mattress edge + blanket across the whole bottom */}
      <rect x="0" y="1300" width={W} height="620" fill="#120607" />
      <path d={`M0 1360 Q400 ${1250 + breath} 760 1330 Q1100 1400 1500 1380 Q1800 1370 ${W} 1420 L${W} 1920 L0 1920 Z`} fill="#2a0d11" />
      <path d={`M0 1360 Q400 ${1250 + breath} 760 1330`} stroke={RED} strokeWidth="3" fill="none" opacity="0.25" />
      {/* my mother asleep, facing me: her head on the pillow at left */}
      <ellipse cx="420" cy="1200" rx="300" ry="90" fill="#1c0b0d" />
      <g transform={`translate(430 ${1150 + breath * 0.4})`}>
        <ellipse cx="0" cy="0" rx="118" ry="140" fill="#24181a" />
        {/* the face mostly in shadow, red rim from the corridor on the right cheek */}
        <ellipse cx="-40" cy="10" rx="100" ry="140" fill="#000" opacity="0.6" style={{filter: 'blur(14px)'}} />
        <path d="M100 -60 Q128 10 96 90" stroke={RED} strokeWidth="5" fill="none" opacity="0.55" style={{filter: 'blur(2px)'}} />
        {/* long hair spilling over the pillow and half the face */}
        <path d="M-140 -20 Q-130 -175 10 -172 Q150 -165 140 -20 Q118 -95 40 -112 Q-30 -110 -60 -60 Q-90 0 -70 120 Q-130 110 -150 60 Z" fill="#160607" stroke="#5a0a12" strokeWidth="3" />
        <path d="M-150 40 Q-230 120 -300 110 Q-210 170 -110 150 Z" fill="#040102" />
        {eyes < 0.5 ? (
          <g stroke="#000" strokeWidth="6" fill="none" opacity="0.8"><path d="M-30 6 q20 10 40 0" /><path d="M36 6 q20 10 40 0" /></g>
        ) : (
          <g opacity={eyes}>
            {/* wide, terrified eyes staring at me: tiny pupils with a red glint */}
            <ellipse cx="-10" cy="4" rx="22" ry="13" fill="#bdb0aa" /><ellipse cx="58" cy="4" rx="20" ry="12" fill="#cfc2bc" />
            <circle cx="-8" cy="4" r="5" fill="#000" /><circle cx="60" cy="4" r="5" fill="#000" />
            <circle cx="-6" cy="2" r="1.6" fill={RED} /><circle cx="62" cy="2" r="1.6" fill={RED} />
            <path d="M-34 -14 q24 -12 48 -2 M36 -14 q24 -10 46 0" stroke="#000" strokeWidth="5" fill="none" />
          </g>
        )}
        <path d="M10 72 q18 6 36 0" stroke="#000" strokeWidth="5" fill="none" opacity="0.7" />
      </g>
      {/* red rim from the corridor on everything */}
      <rect width={W} height="1920" fill="url(#h14glow)" opacity={0.18 * fridge} />
    </svg>
  );
};

export const H14Kitchen: React.FC = () => {
  const f = useCurrentFrame();
  // camera: on the corridor (hook), slow push, pans left to my mother, holds, snaps back right to the doorway
  const camX = interpolate(f, [0, B.pan, B.pan + 40, B.scare - 1, B.scare], [1440, 1440, 470, 470, 1440], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const sc = f >= B.scare ? interpolate(f, [B.scare, B.black], [1.15, 1.45], clamp)
    : interpolate(f, [0, B.pan, B.pan + 40, B.eyes, B.silence], [1.25, 1.4, 1.2, 1.25, 1.5], {...clamp, easing: Easing.inOut(Easing.sin)});
  const cy = f >= B.scare ? 820 : interpolate(f, [0, B.pan, B.pan + 40], [860, 860, 1150], clamp);
  const x = Math.min(W - 540 / sc, Math.max(540 / sc, camX));
  const y = Math.min(1920 - 960 / sc, Math.max(960 / sc, cy));
  const flick = f >= B.scare && f < B.black && rnd(f) > 0.75 ? 0.3 : 1;
  // «my name, in her voice»: red sound rings travelling out of the kitchen
  const rings = f >= VO[0].at && f < B.pan + 10;

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {f < B.black && (
        <AbsoluteFill style={{transformOrigin: '0 0', opacity: flick, transform: `translate(${540 - x * sc}px, ${960 - y * sc}px) scale(${sc})`}}>
          <Room f={f} />
          {rings && (
            <svg width={W} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
              {[0, 1, 2].map((i) => {
                const t = ((f / 40 + i / 3) % 1);
                return <ellipse key={i} cx="1445" cy="850" rx={40 + t * 320} ry={30 + t * 260} fill="none" stroke={RED} strokeWidth="4" opacity={(1 - t) * 0.5} />;
              })}
            </svg>
          )}
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,.9) 100%)', pointerEvents: 'none'}} />
      <AbsoluteFill style={{opacity: 0.08, mixBlendMode: 'screen', pointerEvents: 'none',
        backgroundImage: `repeating-radial-gradient(circle at ${rnd(f) * 100}% ${rnd(f + 3) * 100}%, rgba(255,255,255,.5) 0 1px, transparent 1px 3px)`}} />

      {TEXT.map((t, i) => <Caption key={i} f={f} from={i === 0 ? 0 : VO[i].at - 2} to={VO[i].at + VO[i].dur + 10} text={t} red={i >= 2} size={i === 3 ? 58 : 62} />)}
      {f >= B.black && (
        <>
          <Caption f={f} from={B.black + 2} to={H14_FRAMES} text="الليلة القادمة… الحافلة الأخيرة… ومقعدٌ محجوز باسمك" y={760} red size={56} />
          <div style={{position: 'absolute', top: 1100, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: 44,
            opacity: interpolate(f, [B.black + 26, B.black + 36], [0, 1], clamp)}}>
            <span style={{background: '#ffd35a', color: '#140406', borderRadius: 24, padding: '6px 30px'}}>🔔 اشترك لتصلك قصة الليلة القادمة</span>
          </div>
        </>
      )}

      <Snd name="drone" at={0} dur={B.silence} vol={0.3} loop />
      {Array.from({length: Math.floor(B.silence / 26)}, (_, i) => <Snd key={`c${i}`} name="clock" at={i * 26 + 5} dur={10} vol={0.16} />)}
      <Snd name="static" at={VO[1].at} dur={VO[1].dur} vol={0.12} />
      {Array.from({length: 4}, (_, i) => <Snd key={`h${i}`} name="heartbeat" at={B.eyes + i * 22} dur={24} vol={0.42} />)}
      <Snd name="creak" at={B.silence + 4} dur={30} vol={0.35} />
      <Snd name="sting" at={B.scare} dur={90} vol={0.6} />
      <Snd name="flicker" at={B.scare + 2} dur={20} vol={0.4} />
      <Snd name="drone" at={B.black} dur={H14_FRAMES - B.black} vol={0.18} />
      {VO.map((v) => (
        <Sequence key={v.src} from={v.at} durationInFrames={v.dur + 8} layout="none"><Audio src={staticFile(v.src)} volume={1} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
