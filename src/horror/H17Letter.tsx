import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import '@fontsource/aref-ruqaa/arabic-700.css';
import TL from './H17Letter.timeline.json';

// Horror ep 17 — «رسالة بخط يدك». A letter slid under my door, in MY handwriting, that I don't remember writing,
// dated tomorrow. Its last line: «don't open the door when you hear your own voice». Then my voice, outside.
// Look (unlike ep 1's lit note on a table): floor-level camera at the foot of a door, one warm strip of hall light
// under it; the letter is read only inside a moving phone-torch circle on black; the scare is an eye in the gap.
// Voice: Hamed +18 %, −22 Hz (public/voice/h17-letter). Never gore.

const RED = '#ff1a33';
const FONT = 'Cairo, sans-serif';
const HAND = '"Aref Ruqaa", serif';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H17_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const TEXT = ['رسالة تحت بابي… بخط يدي', 'لا أذكر أني كتبتها', 'تاريخها… غدًا', 'آخر سطر: لا تفتح الباب حين تسمع صوتك', 'ثم سمعت صوتي… خلف الباب'];
const rnd = (n: number) => {const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x);};

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={Math.round(at)} durationInFrames={Math.max(1, dur)} layout="none"><Audio src={staticFile(`sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1560, size = 62}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#f1e6dc', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000, 0 0 6px #000'}}>{text}</div>
  );
};

// floor-level view of the foot of the door; `feet` 0..1 brings two shadows into the light strip
const Door: React.FC<{f: number; feet: number; letterIn: number; eye: number}> = ({f, feet, letterIn, eye}) => {
  const flick = 0.9 + 0.1 * rnd(Math.floor(f / 4));
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
      <defs>
        <linearGradient id="h17floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a0f0a" /><stop offset="1" stopColor="#050303" /></linearGradient>
        <linearGradient id="h17spill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffb35a" stopOpacity="0.55" /><stop offset="1" stopColor="#ffb35a" stopOpacity="0" /></linearGradient>
        <radialGradient id="h17eye" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ff3b4e" /><stop offset="0.35" stopColor="#8a0010" /><stop offset="1" stopColor="#120000" /></radialGradient>
      </defs>
      <rect width="1080" height="1920" fill="#030202" />
      {/* the door: dark panels rising out of frame */}
      <rect x="90" y="0" width="900" height="1060" fill="#0d0807" />
      <rect x="160" y="80" width="330" height="900" fill="none" stroke="#1d1210" strokeWidth="10" />
      <rect x="590" y="80" width="330" height="900" fill="none" stroke="#1d1210" strokeWidth="10" />
      <rect x="40" y="0" width="50" height="1080" fill="#140b09" /><rect x="990" y="0" width="50" height="1080" fill="#140b09" />
      {/* the gap and the hall light behind it */}
      <rect x="90" y="1060" width="900" height="22" fill="#ffc06e" opacity={flick} />
      {/* feet blocking the light: two dark shapes in the gap and their shadows on the floor */}
      {feet > 0 && [330, 600].map((x, i) => (
        <g key={x} opacity={feet}>
          <rect x={x + i * 10} y="1060" width="150" height="22" fill="#030202" />
          <path d={`M${x + i * 10} 1082 L${x + i * 10 - 60} 1500 L${x + i * 10 + 210} 1500 L${x + i * 10 + 150} 1082 Z`} fill="#000" opacity="0.75" />
        </g>
      ))}
      {/* the eye in the gap at the scare */}
      {eye > 0 && (
        <g opacity={eye}>
          <rect x="380" y="1052" width="320" height="36" fill="#000" />
          <ellipse cx="540" cy="1070" rx={150 * eye} ry="16" fill="url(#h17eye)" />
          <circle cx="540" cy="1070" r="11" fill="#000" /><circle cx="535" cy="1066" r="3" fill="#fff" />
        </g>
      )}
      {/* floor in perspective with the light spilling toward the camera */}
      <path d="M90 1082 L990 1082 L1300 1920 L-220 1920 Z" fill="url(#h17floor)" />
      {Array.from({length: 7}, (_, i) => <path key={i} d={`M${90 + i * 150} 1082 L${-220 + i * 253} 1920`} stroke="#000" strokeWidth="3" opacity="0.6" />)}
      <path d="M90 1082 L990 1082 L1160 1520 L-80 1520 Z" fill="url(#h17spill)" opacity={flick} />
      {/* the envelope, slid in from the gap (gone at the scare) */}
      {eye === 0 && <g transform={`translate(${540 - 230} ${interpolate(letterIn, [0, 1], [1040, 1260])}) rotate(${interpolate(letterIn, [0, 1], [0, -7])})`}>
        <path d="M0 0 L460 0 L500 230 L-40 230 Z" fill="#d9c9ad" />
        <path d="M0 0 L250 120 L460 0" fill="none" stroke="#9c8a6c" strokeWidth="4" />
        <text x="230" y="190" textAnchor="middle" fontFamily={HAND} fontWeight="700" fontSize="50" fill="#2a1a10">إليّ</text>
      </g>}
    </svg>
  );
};

// the letter read by a phone torch: only what the circle touches is visible
const LINES = ['لم أكتب هذه الرسالة…', 'لكنها بخطي.', 'غدًا ستسمع طرقًا.', 'لا تفتح الباب', 'حين تسمع صوتك.'];
const Letter: React.FC<{f: number}> = ({f}) => {
  const t0 = B.letter;
  const date = f >= B.date;
  const last = f >= B.last;
  // the torch path: top (date) → middle lines → last line
  const tx = interpolate(f, [t0, B.date, B.last, B.door], [700, 330, 620, 520], {...clamp, easing: Easing.inOut(Easing.sin)}) + Math.sin(f / 7) * 14;
  const ty = interpolate(f, [t0, B.date, B.last, B.door], [760, 430, 1280, 1300], {...clamp, easing: Easing.inOut(Easing.sin)}) + Math.cos(f / 9) * 10;
  const r = interpolate(f, [t0, t0 + 10], [60, 330], clamp);
  const ink = (i: number) => interpolate(f, [t0 + 8 + i * 14, t0 + 22 + i * 14], [0, 1], clamp); // write-on, right to left
  return (
    <AbsoluteFill style={{background: '#020101'}}>
      <AbsoluteFill style={{WebkitMaskImage: `radial-gradient(circle ${r}px at ${tx}px ${ty}px, #000 55%, transparent 100%)`,
        maskImage: `radial-gradient(circle ${r}px at ${tx}px ${ty}px, #000 55%, transparent 100%)`}}>
        <div style={{position: 'absolute', left: 90, top: 260, width: 900, height: 1240, background: 'linear-gradient(160deg, #e7dcc4, #c9b994)', rotate: '-3deg',
          boxShadow: 'inset 0 0 120px rgba(80,50,20,.45)'}}>
          {Array.from({length: 13}, (_, i) => <div key={i} style={{position: 'absolute', left: 60, right: 60, top: 300 + i * 70, height: 2, background: '#8fa3b8', opacity: 0.35}} />)}
          {/* the date */}
          <div dir="rtl" style={{position: 'absolute', right: 70, top: 90, fontFamily: HAND, fontWeight: 700, fontSize: 64, color: date ? '#7a0812' : '#2a1a10',
            textShadow: date ? '0 0 14px rgba(255,26,51,.35)' : 'none'}}>
            ٢١ / ١١ / ٢٠٢٦
            {date && <span style={{position: 'absolute', right: -16, left: -16, top: 54, height: 6, background: RED, opacity: 0.8, borderRadius: 4,
              scale: `${interpolate(f, [B.date + 4, B.date + 14], [0, 1], clamp)} 1`, transformOrigin: 'right'}} />}
          </div>
          {LINES.map((l, i) => {
            const isLast = i >= 3;
            return (
              <div key={i} dir="rtl" style={{position: 'absolute', right: 80, left: 60, top: 250 + i * 140 + (isLast ? 200 : 0), fontFamily: HAND, fontWeight: 700,
                fontSize: isLast ? 92 : 76, color: isLast ? (last ? '#8c0010' : '#2a1a10') : '#2a1a10', textAlign: 'right',
                clipPath: `inset(0 0 0 ${100 - ink(i) * 100}%)`}}>{l}</div>
            );
          })}
          <div dir="rtl" style={{position: 'absolute', left: 90, bottom: 70, fontFamily: HAND, fontWeight: 700, fontSize: 58, color: '#2a1a10', opacity: ink(5)}}>— أنت</div>
        </div>
      </AbsoluteFill>
      {/* phone in the corner showing today's date */}
      <div style={{position: 'absolute', right: 40, top: 1560, width: 230, height: 120, borderRadius: 22, background: '#0b0b0d', border: '3px solid #26262a',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, color: '#d8d8dc',
        opacity: interpolate(f, [B.date - 4, B.date + 6], [0, 1], clamp)}}>
        <div style={{fontSize: 22, fontWeight: 700, opacity: 0.7}}>اليوم</div>
        <div style={{fontSize: 40, fontWeight: 900}}>٢٠ / ١١</div>
      </div>
    </AbsoluteFill>
  );
};

export const H17Letter: React.FC = () => {
  const f = useCurrentFrame();
  const onLetter = f >= B.letter && f < B.door;
  const letterIn = interpolate(f, [0, 34], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const feet = interpolate(f, [B.door + 24, B.door + 50], [0, 1], clamp);
  const eye = f >= B.scare ? interpolate(f, [B.scare, B.scare + 4], [0, 1], clamp) : 0;
  // camera: slow push to the gap on the door shots, a snap toward the eye at the scare
  const push = f < B.letter
    ? interpolate(f, [0, B.letter], [1.0, 1.12], clamp)
    : f < B.scare ? interpolate(f, [B.door, B.scare], [1.08, 1.32], {...clamp, easing: Easing.inOut(Easing.sin)})
      : interpolate(f, [B.scare, B.scare + 8], [1.32, 2.4], {...clamp, easing: Easing.out(Easing.cubic)});
  const shake = f >= B.scare && f < B.scare + 12 ? (rnd(f) - 0.5) * 30 : 0;
  const knocks = [B.door + 2, B.door + 14, B.door + 26];
  const knockKick = knocks.some((k) => f >= k && f < k + 3) ? 6 : 0;

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {f < B.black && !onLetter && (
        <AbsoluteFill style={{transformOrigin: '540px 1070px', transform: `translate(${shake}px, ${knockKick}px) scale(${push})`,
          opacity: f >= B.scare && rnd(f) > 0.8 ? 0.3 : 1}}>
          <Door f={f} feet={f >= B.door ? feet : 0} letterIn={f >= B.door ? 1 : letterIn} eye={eye} />
        </AbsoluteFill>
      )}
      {onLetter && <Letter f={f} />}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,.9) 100%)', pointerEvents: 'none'}} />
      <AbsoluteFill style={{opacity: 0.08, mixBlendMode: 'screen', pointerEvents: 'none',
        backgroundImage: `repeating-radial-gradient(circle at ${rnd(f) * 100}% ${rnd(f + 3) * 100}%, rgba(255,255,255,.5) 0 1px, transparent 1px 3px)`}} />
      {f >= B.scare && f < B.black && <AbsoluteFill style={{background: RED, opacity: 0.18 * rnd(f + 1), mixBlendMode: 'multiply'}} />}

      {TEXT.map((t, i) => <Caption key={i} f={f} from={i === 0 ? 0 : VO[i].at - 2} to={VO[i].at + VO[i].dur + 10} text={t} red={i === 2 || i >= 3} size={i === 3 ? 54 : 60}
        y={i >= 1 && i <= 3 ? 1720 : 1560} />)}
      {f >= B.black && (
        <>
          <Caption f={f} from={B.black + 2} to={H17_FRAMES} text="الليلة القادمة… درج يزيد درجة" y={760} red size={60} />
          <div style={{position: 'absolute', top: 1100, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: 44,
            opacity: interpolate(f, [B.black + 26, B.black + 36], [0, 1], clamp)}}>
            <span style={{background: '#ffd35a', color: '#140406', borderRadius: 24, padding: '6px 30px'}}>🔔 اشترك لتصلك قصة الليلة القادمة</span>
          </div>
        </>
      )}

      <Snd name="drone" at={0} dur={B.silence} vol={0.28} loop />
      <Snd name="creak" at={2} dur={30} vol={0.3} />
      <Snd name="wind" at={B.letter} dur={B.door - B.letter} vol={0.14} />
      <Snd name="clock" at={B.letter} dur={B.door - B.letter} vol={0.18} loop />
      {knocks.map((k) => <Snd key={k} name="knock" at={k} dur={20} vol={0.55} />)}
      {Array.from({length: 3}, (_, i) => <Snd key={`h${i}`} name="heartbeat" at={B.silence - 66 + i * 22} dur={24} vol={0.45} />)}
      <Snd name="sting" at={B.scare} dur={90} vol={0.6} />
      <Snd name="flicker" at={B.scare + 2} dur={20} vol={0.4} />
      <Snd name="drone" at={B.black} dur={H17_FRAMES - B.black} vol={0.18} />
      {VO.map((v) => (
        <Sequence key={v.src} from={v.at} durationInFrames={v.dur + 8} layout="none"><Audio src={staticFile(v.src)} volume={1} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
