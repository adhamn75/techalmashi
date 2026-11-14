import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import TL from './H09Ceiling.timeline.json';
import {Face} from './HoodedFace';

// Horror ep 9 — «السقف». I live on the top floor, yet every night there are footsteps above my ceiling.
// Tonight they stopped right above my bed… then I heard them coming down the stairs.
// Look: a CUTAWAY of the building (the roof, the slab, my bedroom, the stairwell) like a dark doll's house —
// not the screen-life of ep 8 or the room POV of ep 7. Black and blood-red, red moon, fog, a tall hooded
// silhouette walking on the roof; every step sends a red ripple through the ceiling. Silence, then the door.
// Voice: Hamed −6 %, −18 Hz, trimmed as CLAUDE.md says, then atempo 1.1 (public/voice/h09-ceiling, do not re-trim).
// Never gore.

const FONT = 'Cairo, sans-serif';
const RED = '#ff1a33';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H09_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const TEXT = ['أسكن في الطابق الأخير', 'لكنّي أسمع خطواتٍ فوق سقفي', 'الليلة توقّفت… فوق سريري تمامًا', 'ثمّ… سمعتُها تنزل الدرج'];

const ROOF = 640;        // top of the roof slab
const BED_X = 560;       // the walker stops here
const HUT_X = 900;       // roof access hut
const rnd = (n: number) => {const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x);};

// walker: x position over time and step frames
const walkX = (f: number) => {
  if (f < B.steps) return 70;
  if (f < B.stop) return interpolate(f, [B.steps, B.stop - 4], [70, BED_X], clamp);
  if (f < B.stairs) return BED_X;
  return interpolate(f, [B.stairs, B.stairs + 40], [BED_X, HUT_X + 20], clamp);
};
const ROOF_STEPS: number[] = [];
for (let f = B.steps + 6; f < B.stop - 2; f += 13) ROOF_STEPS.push(f);
for (let f = B.stairs + 4; f < B.stairs + 40; f += 13) ROOF_STEPS.push(f);
const STAIR_STEPS: number[] = [];
for (let i = 0; i < 6; i++) STAIR_STEPS.push(B.stairs + 46 + i * 9);
const stepIndex = (f: number) => ROOF_STEPS.filter((s) => s <= f).length;

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={Math.round(at)} durationInFrames={dur} layout="none"><Audio src={staticFile(`sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1560, size = 66}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#efe7e4', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000, 0 0 6px #000'}}>{text}</div>
  );
};

// the tall hooded walker, in silhouette with a red rim
const Walker: React.FC<{f: number; x: number; walking: boolean; look: number; eyes: number}> = ({f, x, walking, look, eyes}) => {
  const ph = walking ? Math.sin(((f - B.steps) / 13) * Math.PI) : 0;
  const bob = walking ? Math.abs(ph) * 6 : Math.sin(f / 14) * 1.5;
  return (
    <svg width={220} height={400} viewBox="0 0 220 400" style={{position: 'absolute', left: x - 110, top: ROOF - 400 + bob, overflow: 'visible', filter: 'drop-shadow(0 0 10px rgba(255,26,51,.55))'}}>
      <g stroke={RED} strokeWidth={2} strokeOpacity={0.7} fill="#030102">
        {/* legs */}
        <path d={`M100 300 L${96 - ph * 22} 398 L${108 - ph * 22} 398 L110 300 Z`} />
        <path d={`M112 300 L${116 + ph * 22} 398 L${128 + ph * 22} 398 L122 300 Z`} />
        {/* cloak */}
        <path d="M70 120 Q60 220 78 312 L150 312 Q166 220 150 120 Q140 96 110 94 Q80 96 70 120 Z" />
        {/* long arms */}
        <path d={`M76 130 Q58 220 ${66 + ph * 8} 300 L74 302 Q72 220 90 140 Z`} />
        <path d={`M144 130 Q162 220 ${154 - ph * 8} 300 L146 302 Q148 220 130 140 Z`} />
        {/* hood, tilted down when it looks through the floor */}
        <g transform={`rotate(${look * 28} 110 96)`}>
          <path d="M80 98 Q74 40 110 22 Q146 40 140 98 Q126 112 110 112 Q94 112 80 98 Z" />
          <ellipse cx="110" cy="80" rx="18" ry="22" fill="#000" stroke="none" />
          <circle cx="102" cy="80" r="3.4" fill={RED} stroke="none" opacity={eyes} />
          <circle cx="118" cy="80" r="3.4" fill={RED} stroke="none" opacity={eyes} />
        </g>
      </g>
    </svg>
  );
};

const Building: React.FC<{f: number}> = ({f}) => {
  const doorOpen = interpolate(f, [B.stairs + 66, B.silence + 4], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
  const crackEyes = interpolate(f, [B.silence - 6, B.silence + 6], [0, 1], clamp);
  const lamp = 0.55 + 0.45 * (rnd(Math.floor(f / 3)) > 0.12 ? 1 : 0.2);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
      <defs>
        <radialGradient id="h9sky" cx="70%" cy="12%" r="90%">
          <stop offset="0" stopColor="#5a0610" />
          <stop offset="0.35" stopColor="#24030a" />
          <stop offset="1" stopColor="#050102" />
        </radialGradient>
        <radialGradient id="h9moon" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffb3b3" />
          <stop offset="0.5" stopColor="#ff2a3c" />
          <stop offset="1" stopColor="#ff1a33" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="h9lamp" cx="50%" cy="0%" r="80%">
          <stop offset="0" stopColor="#7a0a16" stopOpacity="0.8" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <pattern id="h9hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="14" height="14" fill="#151012" />
          <line x1="0" y1="0" x2="0" y2="14" stroke="#2a2022" strokeWidth="3" />
        </pattern>
      </defs>
      {/* sky */}
      <rect width="1080" height={ROOF} fill="url(#h9sky)" />
      <circle cx="790" cy="190" r="190" fill="url(#h9moon)" opacity="0.55" />
      <circle cx="790" cy="190" r="74" fill="#ffd0d0" opacity="0.85" />
      {/* roof furniture: water tank, antenna, the access hut */}
      <rect x="150" y={ROOF - 150} width="120" height="110" rx="10" fill="#070304" />
      <rect x="160" y={ROOF - 40} width="12" height="40" fill="#070304" /><rect x="248" y={ROOF - 40} width="12" height="40" fill="#070304" />
      <line x1="380" y1={ROOF} x2="380" y2={ROOF - 260} stroke="#070304" strokeWidth="6" />
      <line x1="340" y1={ROOF - 220} x2="420" y2={ROOF - 220} stroke="#070304" strokeWidth="5" />
      <line x1="352" y1={ROOF - 180} x2="408" y2={ROOF - 180} stroke="#070304" strokeWidth="5" />
      <rect x={HUT_X - 60} y={ROOF - 230} width="240" height="230" fill="#0b0607" />
      <rect x={HUT_X - 10} y={ROOF - 170} width="70" height="170" fill="#000" />
      <rect x="0" y={ROOF - 24} width="1080" height="24" fill="#0d0809" />
      {/* the slab between the roof and my ceiling */}
      <rect x="0" y={ROOF} width="1080" height="70" fill="url(#h9hatch)" />
      {/* my bedroom */}
      <rect x="0" y={ROOF + 70} width="960" height="660" fill="#0c0708" />
      <rect x="0" y={ROOF + 70} width="960" height="660" fill="url(#h9lamp)" opacity={lamp} />
      {/* window with the red moonlight */}
      <rect x="70" y="860" width="170" height="230" fill="#2a0409" stroke="#1d1213" strokeWidth="12" />
      <line x1="155" y1="860" x2="155" y2="1090" stroke="#1d1213" strokeWidth="8" />
      <polygon points="70,1090 240,1090 420,1360 150,1360" fill="#ff1a33" opacity="0.07" />
      {/* bed + sleeper */}
      <rect x="380" y="1230" width="380" height="80" rx="10" fill="#1a1012" />
      <rect x="370" y="1150" width="30" height="170" fill="#140b0d" />
      <path d="M430 1232 Q470 1180 560 1196 Q680 1180 740 1232 Z" fill="#2b1a1d" />
      <ellipse cx="440" cy="1206" rx="34" ry="24" fill="#3a2a2c" />
      {/* bedroom door (opens into darkness) */}
      <rect x="800" y="1040" width="140" height="290" fill="#000" />
      <polygon points={`800,1040 ${800 + 140 * (1 - doorOpen * 0.35)},${1040 + doorOpen * 12} ${800 + 140 * (1 - doorOpen * 0.35)},${1330 - doorOpen * 12} 800,1330`} fill="#1c1113" stroke="#2a1b1d" strokeWidth="4" />
      <circle cx={918 - doorOpen * 48} cy="1192" r="6" fill="#4a3436" />
      <circle cx="918" cy="1150" r="5" fill={RED} opacity={crackEyes} style={{filter: "drop-shadow(0 0 6px #ff1a33)"}} /><circle cx="934" cy="1150" r="5" fill={RED} opacity={crackEyes} style={{filter: "drop-shadow(0 0 6px #ff1a33)"}} />
      {/* stairwell to the right */}
      <rect x="960" y={ROOF + 70} width="120" height="660" fill="#080405" />
      {Array.from({length: 11}, (_, i) => (
        <rect key={i} x={1080 - ((i % 2) ? 60 : 120)} y={ROOF + 110 + i * 56} width="60" height="10" fill="#1b1012" />
      ))}
      {/* floor slab and the dark floor below */}
      <rect x="0" y={ROOF + 730} width="1080" height="60" fill="url(#h9hatch)" />
      <rect x="0" y={ROOF + 790} width="1080" height={1920 - ROOF - 790} fill="#030102" />
    </svg>
  );
};

export const H09Ceiling: React.FC = () => {
  const f = useCurrentFrame();
  const x = walkX(f);
  const walking = (f >= B.steps && f < B.stop - 2) || (f >= B.stairs && f < B.stairs + 40);
  const look = interpolate(f, [B.stop + 20, B.stop + 40], [0, 1], clamp) * (f < B.stairs ? 1 : 0);
  const eyes = interpolate(f, [B.stop + 34, B.stop + 44], [0, 1], clamp) * (f < B.stairs ? 1 : 0);
  const walkerOn = interpolate(f, [B.stairs + 34, B.stairs + 46], [1, 0], clamp);
  // camera: push toward the ceiling over the bed, then pan to the door
  const cx = interpolate(f, [0, B.steps, B.stop, B.stairs, B.stairs + 60, B.silence, B.scare], [540, 540, BED_X, BED_X, 840, 870, 900], {...clamp, easing: Easing.inOut(Easing.sin)});
  const cy = interpolate(f, [0, B.steps, B.stop, B.stairs, B.stairs + 60, B.silence, B.scare], [900, 900, 760, 760, 1060, 1150, 1150], {...clamp, easing: Easing.inOut(Easing.sin)});
  const sc = interpolate(f, [0, B.steps, B.stop, B.stairs, B.stairs + 60, B.silence, B.scare], [1, 1.04, 1.14, 1.16, 1.3, 1.5, 1.9], {...clamp, easing: Easing.inOut(Easing.sin)});
  // keep the frame covered: the centre may not get closer to an edge than half the visible size
  const camX = Math.min(1080 - 540 / sc, Math.max(540 / sc, cx));
  const camY = Math.min(1920 - 960 / sc, Math.max(900 / sc, cy));
  const scared = f >= B.scare && f < B.black;
  const flick = scared && rnd(f) > 0.78 ? 0.25 : 1;
  const zoomFace = interpolate(f, [B.scare, B.black], [1, 1.25], clamp);

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {f < B.scare && (
        <AbsoluteFill style={{transformOrigin: '0 0', transform: `translate(${540 - camX * sc}px, ${900 - camY * sc}px) scale(${sc})`}}>
          <Building f={f} />
          {/* red ripples through the ceiling on every step */}
          {ROOF_STEPS.filter((s) => f >= s && f < s + 22).map((s) => {
            const t = (f - s) / 22;
            return <div key={s} style={{position: 'absolute', left: walkX(s) - 20 - t * 120, top: ROOF + 70 - 4, width: 40 + t * 240, height: 12 + t * 26, borderRadius: '50%',
              border: `3px solid ${RED}`, opacity: (1 - t) * 0.8, boxShadow: `0 0 18px ${RED}`}} />;
          })}
          {/* dust falling from the ceiling over the bed */}
          {f >= B.stop && f < B.stairs + 20 && Array.from({length: 26}, (_, i) => {
            const t0 = B.stop + (i * 5) % 90;
            const t = (f - t0) / 50;
            if (t < 0 || t > 1) return null;
            return <div key={i} style={{position: 'absolute', left: BED_X - 70 + rnd(i) * 140, top: ROOF + 72 + t * 470, width: 4, height: 4, borderRadius: 2, background: '#c9b8b0', opacity: 0.7 * (1 - t)}} />;
          })}
          {/* footsteps coming down the stairwell: a red glow on each step */}
          {STAIR_STEPS.filter((s) => f >= s && f < s + 24).map((s, i) => {
            const k = STAIR_STEPS.indexOf(s);
            const t = (f - s) / 24;
            return <div key={s} style={{position: 'absolute', left: 1080 - ((k % 2) ? 60 : 120), top: ROOF + 100 + k * 112, width: 60, height: 24, borderRadius: 12,
              background: RED, opacity: (1 - t) * 0.75, filter: 'blur(6px)'}} />;
          })}
          <div style={{opacity: walkerOn}}><Walker f={f} x={x} walking={walking} look={look} eyes={eyes} /></div>
          {/* fog */}
          <AbsoluteFill style={{background: `radial-gradient(60% 18% at ${30 + Math.sin(f / 40) * 20}% 32%, rgba(120,20,30,.22), transparent 70%)`}} />
        </AbsoluteFill>
      )}

      {/* the scare */}
      {scared && (
        <AbsoluteFill style={{opacity: flick, background: 'radial-gradient(circle at 50% 45%, #2a0207, #000 70%)'}}>
          <div style={{position: 'absolute', left: 40, top: 240, width: 1000, height: 1300, transform: `scale(${zoomFace})`}}>
            <Face f={f} eye={1} />
          </div>
        </AbsoluteFill>
      )}

      {/* vignette + grain */}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,.85) 100%)', pointerEvents: 'none'}} />
      <AbsoluteFill style={{opacity: 0.07, mixBlendMode: 'screen', pointerEvents: 'none',
        backgroundImage: `repeating-radial-gradient(circle at ${rnd(f) * 100}% ${rnd(f + 3) * 100}%, rgba(255,255,255,.5) 0 1px, transparent 1px 3px)`}} />

      {/* captions */}
      {TEXT.map((t, i) => <Caption key={i} f={f} from={VO[i].at - 2} to={VO[i].at + VO[i].dur + 10} text={t} red={i === 2} />)}
      {f < B.steps - 4 && (
        <div style={{position: 'absolute', top: 120, width: '100%', textAlign: 'center', fontFamily: 'Consolas, monospace', fontSize: 44, color: RED, letterSpacing: 6,
          opacity: 0.6 + 0.4 * Math.sin(f / 4), textShadow: `0 0 18px ${RED}`}}>03:00</div>
      )}
      {f >= B.black && (
        <>
          <Caption f={f} from={B.black + 2} to={H09_FRAMES} text="الليلة القادمة… راديو ينطق اسمك 📻" y={820} red size={56} />
          <div style={{position: 'absolute', top: 1060, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: 44,
            opacity: interpolate(f, [B.black + 26, B.black + 36], [0, 1], clamp)}}>
            <span style={{background: '#ffd35a', color: '#140406', borderRadius: 24, padding: '6px 30px'}}>🔔 اشترك لتصلك قصة الليلة القادمة</span>
          </div>
        </>
      )}

      {/* sound: drone and wind, footsteps, heartbeat, then silence before the door */}
      <Snd name="drone" at={0} dur={B.silence} vol={0.32} loop />
      <Snd name="wind" at={0} dur={130} vol={0.18} />
      {ROOF_STEPS.map((s) => <Snd key={`r${s}`} name="knock" at={s} dur={14} vol={0.32 + Math.min(0.2, stepIndex(s) * 0.02)} />)}
      {STAIR_STEPS.map((s, i) => <Snd key={`s${s}`} name="knock" at={s} dur={14} vol={0.4 + i * 0.04} />)}
      {Array.from({length: 7}, (_, i) => <Snd key={`h${i}`} name="heartbeat" at={B.stop + 30 + i * 24} dur={27} vol={0.4} />)}
      <Snd name="creak" at={B.stairs + 64} dur={34} vol={0.45} />
      <Snd name="sting" at={B.scare} dur={90} vol={0.6} />
      <Snd name="flicker" at={B.scare + 2} dur={20} vol={0.4} />
      <Snd name="drone" at={B.black} dur={H09_FRAMES - B.black} vol={0.18} />
      {VO.map((v) => (
        <Sequence key={v.src} from={v.at} durationInFrames={v.dur + 8} layout="none"><Audio src={staticFile(v.src)} volume={1} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
