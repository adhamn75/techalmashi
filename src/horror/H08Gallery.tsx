import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import TL from './H08Gallery.timeline.json';
import {Face} from './HoodedFace';

// Horror ep 8 — «الاستوديو». In the morning there is a photo in my gallery I never took: me, asleep, 03:00.
// Zoom in: at its edge, a pale hand holding the phone above my face. Then a new photo arrives — «الآن».
// Look: "screen-life" — the whole frame IS the phone's gallery (no hand-held phone like ep 6, no room POV like
// ep 7): cold flash-photo greys, then black and blood-red for the hood. Silence before the last photo opens.
// Voice: Hamed −6 %, −18 Hz, trimmed as CLAUDE.md says, then atempo 1.1 so the five lines fit 18 s.
// Never gore.

const FONT = 'Cairo, sans-serif';
const RED = '#ff1a33';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H08_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));

const rnd = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={at} durationInFrames={dur} layout="none"><Audio src={staticFile(`sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1580, size = 68}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#f2ecea', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000, 0 0 6px #000'}}>{text}</div>
  );
};

const Grain: React.FC<{f: number; o?: number}> = ({f, o = 0.08}) => (
  <AbsoluteFill style={{opacity: o, mixBlendMode: 'screen', pointerEvents: 'none',
    backgroundImage: `repeating-radial-gradient(circle at ${rnd(f) * 100}% ${rnd(f + 3) * 100}%, rgba(255,255,255,.5) 0 1px, transparent 1px 3px)`}} />
);

// ---------- photo 1: me asleep, shot from above with the flash; a pale hand at the top-right edge ----------
const SleepPhoto: React.FC = () => (
  <svg viewBox="0 0 900 1200" width="100%" height="100%">
    <defs>
      <radialGradient id="flash" cx="50%" cy="38%" r="70%">
        <stop offset="0%" stopColor="#a7adb1" />
        <stop offset="55%" stopColor="#4a4f55" />
        <stop offset="100%" stopColor="#101215" />
      </radialGradient>
      <linearGradient id="hand" x1="1" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#e4ded8" />
        <stop offset="100%" stopColor="#9c958f" />
      </linearGradient>
    </defs>
    <rect width="900" height="1200" fill="url(#flash)" />
    {/* pillow */}
    <ellipse cx="450" cy="420" rx="330" ry="190" fill="#c9cdd0" opacity="0.85" />
    <path d="M150 430 Q450 300 750 430" stroke="#9aa0a5" strokeWidth="6" fill="none" opacity="0.5" />
    {/* hair + face, eyes closed */}
    <ellipse cx="450" cy="440" rx="128" ry="158" fill="#b9ab9e" />
    <path d="M322 420 Q330 268 450 262 Q574 268 580 420 Q560 330 450 322 Q345 330 322 420Z" fill="#1d1a19" />
    <path d="M385 450 Q405 462 425 450" stroke="#3a302b" strokeWidth="7" fill="none" strokeLinecap="round" />
    <path d="M475 450 Q495 462 515 450" stroke="#3a302b" strokeWidth="7" fill="none" strokeLinecap="round" />
    <path d="M440 470 Q450 500 446 515" stroke="#8d7f73" strokeWidth="5" fill="none" />
    <path d="M425 545 Q450 552 475 545" stroke="#6e5a52" strokeWidth="6" fill="none" strokeLinecap="round" />
    {/* blanket */}
    <path d="M0 620 Q200 560 450 600 Q700 560 900 620 L900 1200 L0 1200Z" fill="#5b6168" />
    <path d="M120 700 Q300 760 420 720 M520 760 Q700 700 820 780 M200 900 Q420 980 640 900" stroke="#3d4248" strokeWidth="10" fill="none" opacity="0.7" />
    {/* the hand at the edge: long pale fingers reaching in from the top-right corner */}
    <g fill="url(#hand)" opacity="0.92">
      <path d="M900 0 L900 230 Q840 250 790 210 Q760 160 800 90 L840 0Z" />
      <path d="M800 120 Q740 150 690 230 Q676 252 690 262 Q706 268 722 246 Q770 190 812 168Z" />
      <path d="M812 170 Q760 220 730 300 Q722 324 738 330 Q754 332 764 308 Q790 248 830 206Z" />
      <path d="M836 206 Q800 260 790 330 Q788 352 804 354 Q820 352 822 330 Q830 270 856 228Z" />
      <path d="M866 228 Q850 280 852 330 Q854 348 868 346 Q880 342 880 324 Q880 280 890 240Z" />
    </g>
    <rect width="900" height="1200" fill="#000" opacity="0.12" />
  </svg>
);

// ---------- photo 2: me, from behind, in bed, lit by my phone; and the hood over my shoulder ----------
const BehindPhoto: React.FC<{f: number}> = ({f}) => (
  <div style={{position: 'relative', width: '100%', height: '100%', background: 'radial-gradient(ellipse at 45% 70%, #23303b 0%, #07090c 60%, #000 100%)', overflow: 'hidden'}}>
    <svg viewBox="0 0 900 1200" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
      <defs>
        <radialGradient id="glow" cx="45%" cy="62%" r="40%">
          <stop offset="0%" stopColor="#8fb6ff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#8fb6ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="900" height="1200" fill="url(#glow)" />
      {/* the phone glowing in my hands, seen past my head */}
      <rect x="350" y="690" width="120" height="200" rx="16" fill="#cfe0ff" opacity="0.9" />
      {/* my head + shoulders from behind, rim-lit */}
      <path d="M180 1200 Q190 930 330 880 Q300 820 300 740 Q300 600 410 590 Q520 600 520 740 Q520 820 490 880 Q640 930 660 1200Z" fill="#050608" />
      <path d="M300 740 Q300 600 410 590 Q520 600 520 740" stroke="#6f8fd0" strokeWidth="5" fill="none" opacity="0.7" />
      <path d="M330 880 Q190 930 180 1200" stroke="#4b67a0" strokeWidth="4" fill="none" opacity="0.5" />
    </svg>
    {/* the hood, close behind my right shoulder */}
    <div style={{position: 'absolute', left: 520, top: 360, width: 340, height: 442, opacity: 0.92}}>
      <Face f={f} eye={0.85} />
    </div>
  </div>
);

const Thumb: React.FC<{bg: string; size: number; label?: string; glow?: number; children?: React.ReactNode}> = ({bg, size, label, glow = 0, children}) => (
  <div style={{width: size, height: size, background: bg, position: 'relative', overflow: 'hidden', boxShadow: glow ? `0 0 ${40 * glow}px ${RED}, inset 0 0 0 ${4 * glow}px ${RED}` : 'none'}}>
    {children}
    {label && <div style={{position: 'absolute', bottom: 8, right: 10, fontFamily: FONT, fontWeight: 900, fontSize: 28, color: '#fff', textShadow: '0 2px 6px #000'}}>{label}</div>}
  </div>
);
const OLD = [
  'linear-gradient(180deg,#ff9a5a,#6a2b6a)', 'radial-gradient(circle at 40% 40%,#e0c08a,#7a5b3a)', 'linear-gradient(160deg,#5fa8d3,#1b3a5a)',
  'radial-gradient(circle at 60% 50%,#b6d38a,#3f5a2a)', 'linear-gradient(200deg,#f2d0a4,#a05a3a)', 'linear-gradient(120deg,#9fb3c8,#3a4a5e)',
  'radial-gradient(circle at 50% 60%,#e8b4b8,#6b3a4a)', 'linear-gradient(180deg,#ccc,#666)', 'linear-gradient(140deg,#7ec8a9,#25584a)',
];

const Gallery: React.FC<{f: number; fresh: 'sleep' | 'behind'}> = ({f, fresh}) => {
  const size = 356;
  const pop = fresh === 'behind' ? interpolate(f, [B.newpic + 6, B.newpic + 14], [0, 1], {...clamp, easing: Easing.out(Easing.back(2))}) : 1;
  const tiles: React.ReactNode[] = [];
  if (fresh === 'behind') tiles.push(<div key="n" style={{scale: `${pop}`}}><Thumb bg="#000" size={size} label="الآن" glow={0.5 + 0.5 * Math.sin(f / 4)}><div style={{width: '100%', height: '100%', filter: 'blur(2px)'}}><BehindPhoto f={f} /></div></Thumb></div>);
  tiles.push(<Thumb key="s" bg="#222" size={size} label="03:00" glow={fresh === 'sleep' ? 0.4 + 0.4 * Math.sin(f / 5) : 0}><SleepPhoto /></Thumb>);
  OLD.forEach((g, i) => tiles.push(<Thumb key={i} bg={g} size={size} />));
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <div style={{height: 110, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 44px', fontFamily: 'Segoe UI, Arial', fontSize: 34, color: '#ddd', direction: 'ltr'}}>
        <span>{fresh === 'behind' ? '3:00' : '7:12'}</span><span>▮▮▮ 🔋</span>
      </div>
      <div dir="rtl" style={{padding: '0 40px 24px', fontFamily: FONT, fontWeight: 900, fontSize: 72, color: '#fff'}}>الصور</div>
      <div dir="rtl" style={{padding: '0 40px 18px', fontFamily: FONT, fontWeight: 700, fontSize: 36, color: '#8a8a8a'}}>{fresh === 'behind' ? 'الآن' : 'اليوم'}</div>
      <div dir="rtl" style={{display: 'grid', gridTemplateColumns: `repeat(3, ${size}px)`, gap: 6}}>{tiles.slice(0, 12)}</div>
    </AbsoluteFill>
  );
};

const Viewer: React.FC<{f: number; children: React.ReactNode; zoom: number; ox: number; oy: number; info: string; infoRed?: boolean}> = ({children, zoom, ox, oy, info, infoRed}) => (
  <AbsoluteFill style={{background: '#000'}}>
    <div style={{position: 'absolute', left: 0, right: 0, top: 190, height: 1330, overflow: 'hidden'}}>
      <div style={{width: 1080, height: 1440, scale: `${zoom}`, transformOrigin: `${ox}% ${oy}%`}}>{children}</div>
    </div>
    <div dir="rtl" style={{position: 'absolute', top: 110, left: 40, right: 40, display: 'flex', justifyContent: 'space-between', fontFamily: FONT, fontWeight: 700, fontSize: 38, color: '#ddd'}}>
      <span style={{color: infoRed ? RED : '#ddd'}}>{info}</span><span>‹ الصور</span>
    </div>
  </AbsoluteFill>
);

export const H08Gallery: React.FC = () => {
  const f = useCurrentFrame();
  const scene = f < B.open - 4 ? 'g1' : f < B.newpic ? 'v1' : f < B.newpic + 30 ? 'g2' : f < B.scare ? 'v2' : f < B.black ? 'scare' : 'end';
  // photo 1: slow push, then a hard zoom into the top-right corner (the hand)
  const z1 = interpolate(f, [B.open, B.zoom - 4], [1, 1.08], clamp) * interpolate(f, [B.zoom, B.zoom + 40], [1, 2.6], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const z2 = interpolate(f, [B.newpic + 30, B.scare], [1, 1.35], {...clamp, easing: Easing.in(Easing.quad)});
  const shake = scene === 'scare' ? Math.max(0, 1 - (f - B.scare) / 26) * 30 : 0;
  const flash = interpolate(f, [B.scare, B.scare + 2, B.scare + 14], [0, 0.85, 0], clamp);
  const sp = interpolate(f, [B.scare, B.scare + 7], [0.5, 1], {...clamp, easing: Easing.out(Easing.back(1.7))});
  const tap = (at: number) => interpolate(f, [at - 10, at - 4, at], [0, 1, 0], clamp);
  const flicker = scene === 'v2' && rnd(Math.floor(f / 2)) < 0.12 ? 0.5 : 0;

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {scene === 'g1' && <Gallery f={f} fresh="sleep" />}
      {scene === 'v1' && (
        <Viewer f={f} zoom={z1} ox={92} oy={6} info={f >= B.zoom ? 'من التقطها؟' : 'اليوم · 03:00:17'} infoRed={f >= B.zoom}>
          <SleepPhoto />
        </Viewer>
      )}
      {scene === 'g2' && <Gallery f={f} fresh="behind" />}
      {scene === 'v2' && (
        <Viewer f={f} zoom={z2} ox={70} oy={40} info="الآن · 03:00" infoRed>
          <BehindPhoto f={f} />
        </Viewer>
      )}
      {scene === 'v2' && <AbsoluteFill style={{background: '#000', opacity: flicker}} />}
      {scene === 'scare' && (
        <AbsoluteFill style={{translate: `${(rnd(f) - 0.5) * shake}px ${(rnd(f + 9) - 0.5) * shake}px`}}>
          <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, #3a0008 0%, #000 65%)'}} />
          <div style={{position: 'absolute', left: -80, top: 160, width: 1240, height: 1600, scale: `${sp * interpolate(f, [B.scare, B.black], [1, 1.12], clamp)}`, transformOrigin: '50% 40%'}}>
            <Face f={f} eye={rnd(Math.floor(f / 3)) > 0.08 ? 1 : 0.4} />
          </div>
        </AbsoluteFill>
      )}
      {scene === 'end' && (
        <AbsoluteFill style={{background: '#000', alignItems: 'center', justifyContent: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, textAlign: 'center'}}>
          <div style={{fontSize: 46, color: '#8a7f7f', opacity: interpolate(f, [B.black + 6, B.black + 16], [0, 1], clamp)}}>هل تفقّدت الاستوديو الليلة؟ 📷</div>
          <div style={{fontSize: 42, color: '#140406', background: RED, borderRadius: 26, padding: '8px 34px', marginTop: 40, boxShadow: `0 0 40px ${RED}`,
            opacity: interpolate(f, [B.black + 24, B.black + 34], [0, 1], clamp)}}>🔔 اشترك لتصلك قصة الليلة القادمة</div>
        </AbsoluteFill>
      )}

      {/* finger tap on the thumbnail before each photo opens */}
      {[B.open - 4, B.newpic + 30].map((at) => (
        <div key={at} style={{position: 'absolute', left: 842, top: 440, width: 120, height: 120,
          borderRadius: 60, background: 'rgba(255,255,255,.35)', opacity: tap(at), scale: `${0.6 + 0.4 * tap(at)}`}} />
      ))}

      <Grain f={f} o={scene === 'scare' ? 0.14 : 0.08} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.75) 100%)', pointerEvents: 'none'}} />
      <AbsoluteFill style={{background: RED, opacity: flash, mixBlendMode: 'screen'}} />
      <AbsoluteFill style={{background: '#000', opacity: interpolate(f, [B.black - 3, B.black], [0, 1], clamp) * interpolate(f, [B.black, B.black + 4], [1, 0], clamp)}} />

      <Caption f={f} from={4} to={B.open + 4} text="صورةٌ في هاتفي… لم ألتقطها" />
      <Caption f={f} from={B.open + 4} to={B.zoom - 2} text="التُقطت الثالثة فجرًا. وأنا نائم." />
      <Caption f={f} from={B.zoom} to={B.still + 6} text="في طرفها… يدٌ فوق وجهي" red size={74} />
      <Caption f={f} from={B.newpic} to={B.scare - 1} text="ثمّ ظهرت صورةٌ جديدة… الآن" red />
      <Caption f={f} from={B.black + 2} to={H08_FRAMES} text="الليلة القادمة… قصةٌ أخرى" y={1500} />

      {VO.map((v) => (
        <Sequence key={v.src} from={v.at} durationInFrames={v.dur + 8} layout="none"><Audio src={staticFile(v.src)} volume={1} /></Sequence>
      ))}
      <Snd name="drone" at={0} dur={B.still} vol={0.09} loop />
      <Snd name="clock" at={B.open + 8} dur={10} vol={0.22} />
      <Snd name="clock" at={B.open + 38} dur={10} vol={0.22} />
      <Snd name="clock" at={B.open + 68} dur={10} vol={0.22} />
      <Snd name="creak" at={B.zoom + 30} vol={0.3} />
      {/* B.still → B.newpic: dead silence */}
      <Snd name="flicker" at={B.newpic + 6} dur={30} vol={0.3} />
      <Snd name="heartbeat" at={B.newpic + 30} dur={B.scare - B.newpic - 30} vol={0.3} loop />
      <Snd name="sting" at={B.scare} dur={B.black - B.scare + 6} vol={0.85} />
      <Snd name="wind" at={B.black} dur={H08_FRAMES - B.black} vol={0.08} />
    </AbsoluteFill>
  );
};
