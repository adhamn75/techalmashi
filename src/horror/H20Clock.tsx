import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import TL from './H20Clock.timeline.json';
import {Face} from './HoodedFace';

// Horror ep 20 — «الساعة». The wall clock runs backwards and stops at three every night. Tonight it didn't stop —
// it grew a third hand, a long one, and it points at my bed.
// Look: cold teal moonlight, the clock dead-centre and flat-on like a stare, pendulum below; hands spin backwards,
// freeze on 3:00, then a thin black third hand grows past the rim and the camera follows it down the wall to the bed.
// Scare: back on the clock, its face turns black and the hooded face is inside the rim. Voice: Hamed +18 %, −22 Hz.

const RED = '#ff1a33';
const TEAL = '#7fd1c7';
const FONT = 'Cairo, sans-serif';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H20_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const TEXT = ['ساعة الحائط… تدور إلى الوراء', 'كل ليلة تقف عند الثالثة', 'الليلة لم تقف… ونبت لها عقرب ثالث', 'عقرب طويل… يشير إلى سريري'];
const rnd = (n: number) => {const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x);};
const AR = ['١٢', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '١٠', '١١'];
const CX = 540, CY = 640, R = 330;

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={Math.round(at)} durationInFrames={Math.max(1, dur)} layout="none"><Audio src={staticFile(`sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1640, size = 62}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#d8efec', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000, 0 0 6px #000'}}>{text}</div>
  );
};

// clock time in minutes (backwards from 7:20 to 3:00, then stays)
const minutes = (f: number) => interpolate(f, [0, B.stop], [440, 180], {...clamp, easing: Easing.out(Easing.cubic)});

const Room: React.FC<{f: number; third: number; scare: boolean}> = ({f, third, scare}) => {
  const m = minutes(f);
  const hA = (m / 720) * 360, mA = (m % 60) * 6;
  const pend = Math.sin(f / 9) * (f < B.silence ? 14 : 0);
  const hand = (a: number, len: number, w: number, c: string) => (
    <path d={`M${CX} ${CY} L${CX + Math.sin(a * Math.PI / 180) * len} ${CY - Math.cos(a * Math.PI / 180) * len}`} stroke={c} strokeWidth={w} strokeLinecap="round" />
  );
  // third hand: grows from the centre toward the bed (down-left), crooked like a finger
  const tipLen = third * 1200;
  const ta = 194 * Math.PI / 180;
  const tx = CX + Math.sin(ta) * tipLen, ty = CY - Math.cos(ta) * tipLen;
  return (
    <svg width={1080} height={3000} viewBox="0 0 1080 3000" style={{position: 'absolute', left: 0, top: 0}}>
      <defs>
        <linearGradient id="h20moon" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor={TEAL} stopOpacity="0.22" /><stop offset="1" stopColor="#000" stopOpacity="0" /></linearGradient>
        <radialGradient id="h20face" cx="45%" cy="40%" r="65%"><stop offset="0" stopColor="#d9e6df" /><stop offset="1" stopColor="#6f8580" /></radialGradient>
      </defs>
      <rect width="1080" height="3000" fill="#071012" />
      {/* window-frame shadow cast by the moon */}
      <path d="M1080 0 L1080 1300 L520 2100 L380 0 Z" fill="url(#h20moon)" />
      <path d="M760 0 L700 1800 M1080 620 L430 1050" stroke="#030708" strokeWidth="26" opacity="0.7" />
      {/* the clock: wooden case, face, numerals, pendulum */}
      <rect x={CX - 60} y={CY + R - 20} width="120" height="560" rx="20" fill="#120b07" />
      <g transform={`rotate(${pend} ${CX} ${CY + R})`}>
        <path d={`M${CX} ${CY + R} L${CX} ${CY + R + 440}`} stroke="#7d6a3e" strokeWidth="8" />
        <circle cx={CX} cy={CY + R + 460} r="48" fill="#9c8446" />
      </g>
      <circle cx={CX} cy={CY} r={R + 40} fill="#1a110a" />
      <circle cx={CX} cy={CY} r={R} fill={scare ? '#000' : 'url(#h20face)'} />
      {!scare && AR.map((n, i) => {
        const a = i * 30 * Math.PI / 180;
        return <text key={i} x={CX + Math.sin(a) * (R - 62)} y={CY - Math.cos(a) * (R - 62) + 22} textAnchor="middle" fontFamily={FONT} fontWeight="900" fontSize="60"
          fill={i === 3 && f >= B.stop ? RED : '#1b2422'}>{n}</text>;
      })}
      {!scare && Array.from({length: 60}, (_, i) => {
        const a = i * 6 * Math.PI / 180, r0 = i % 5 ? R - 18 : R - 30;
        return <path key={`t${i}`} d={`M${CX + Math.sin(a) * r0} ${CY - Math.cos(a) * r0} L${CX + Math.sin(a) * (R - 6)} ${CY - Math.cos(a) * (R - 6)}`} stroke="#2a3330" strokeWidth={i % 5 ? 3 : 7} />;
      })}
      {!scare && hand(hA, 170, 18, '#0b0f0e')}
      {!scare && hand(mA, 250, 11, '#0b0f0e')}
      {/* the third hand */}
      {third > 0 && (
        <>
          <path d={`M${CX} ${CY} Q${(CX + tx) / 2 + 60} ${(CY + ty) / 2 - 40} ${tx} ${ty}`} stroke="#000" strokeWidth="9" fill="none" strokeLinecap="round" />
          <circle cx={tx} cy={ty} r="10" fill={RED} style={{filter: 'drop-shadow(0 0 16px #ff1a33)'}} />
        </>
      )}
      <circle cx={CX} cy={CY} r="20" fill="#0b0f0e" />
      {/* the bed at the bottom of the wall */}
      <rect x="-40" y="1760" width="620" height="260" rx="30" fill="#0f1b1d" />
      <path d="M-40 1790 Q140 1700 320 1770 Q460 1820 580 1780 L580 2020 L-40 2020 Z" fill="#1a2c2f" />
      <rect x="-40" y="1600" width="70" height="420" fill="#0b1416" />
    </svg>
  );
};

export const H20Clock: React.FC = () => {
  const f = useCurrentFrame();
  const third = f < B.third ? 0 : interpolate(f, [B.third, B.silence], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const scare = f >= B.scare;
  // camera: close on the face, pull back, then follow the third hand down to the bed, then snap back to the clock
  const follow = interpolate(f, [B.point, B.silence], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
  const camY = scare ? CY : interpolate(follow, [0, 1], [CY, 1700]);
  const camX = scare ? CX : interpolate(follow, [0, 1], [CX, 330]);
  const zoom = scare ? interpolate(f, [B.scare, B.scare + 7], [1.3, 2.3], {...clamp, easing: Easing.out(Easing.back(1.4))})
    : f < B.stop ? interpolate(f, [0, B.stop], [1.5, 1.2], clamp) : f < B.point ? interpolate(f, [B.stop, B.point], [1.2, 1.0], clamp) : 1.0;
  const shake = scare && f < B.scare + 14 ? (rnd(f) - 0.5) * 34 : 0;
  const stopJolt = f >= B.stop && f < B.stop + 6 ? (rnd(f) - 0.5) * 14 : 0;

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {f < B.black && (
        <div style={{position: 'absolute', left: 0, top: 0, transformOrigin: `${camX}px ${camY}px`,
          transform: `translate(${540 - camX + shake + stopJolt}px, ${860 - camY}px) scale(${zoom})`}}>
          <Room f={f} third={third} scare={scare} />
          {scare && (
            <div style={{position: 'absolute', left: CX - 230, top: CY - 300, width: 460, height: 600}}>
              <Face f={f} />
            </div>
          )}
        </div>
      )}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,.92) 100%)', pointerEvents: 'none'}} />
      <AbsoluteFill style={{opacity: 0.08, mixBlendMode: 'screen', pointerEvents: 'none',
        backgroundImage: `repeating-radial-gradient(circle at ${rnd(f) * 100}% ${rnd(f + 3) * 100}%, rgba(220,255,250,.5) 0 1px, transparent 1px 3px)`}} />
      {scare && f < B.black && <AbsoluteFill style={{background: RED, opacity: 0.22 * rnd(f + 2), mixBlendMode: 'multiply'}} />}

      {TEXT.map((t, i) => <Caption key={i} f={f} from={i === 0 ? 0 : VO[i].at - 2} to={VO[i].at + VO[i].dur + 10} text={t} red={i >= 2} />)}
      {f >= B.black && (
        <>
          <Caption f={f} from={B.black + 2} to={H20_FRAMES} text="الليلة القادمة… تلفاز مطفأ يراك" y={760} red size={60} />
          <div style={{position: 'absolute', top: 1100, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: 44,
            opacity: interpolate(f, [B.black + 26, B.black + 36], [0, 1], clamp)}}>
            <span style={{background: '#ffd35a', color: '#140406', borderRadius: 24, padding: '6px 30px'}}>🔔 اشترك لتصلك قصة الليلة القادمة</span>
          </div>
        </>
      )}

      <Snd name="drone" at={0} dur={B.silence} vol={0.24} loop />
      <Snd name="clock" at={0} dur={B.stop} vol={0.5} loop />
      <Snd name="knock" at={B.stop} dur={20} vol={0.45} />
      <Snd name="clock" at={B.third} dur={B.silence - B.third} vol={0.35} loop />
      <Snd name="creak" at={B.third} dur={60} vol={0.35} />
      {Array.from({length: 3}, (_, i) => <Snd key={`h${i}`} name="heartbeat" at={B.point + 20 + i * 22} dur={24} vol={0.45} />)}
      <Snd name="sting" at={B.scare} dur={90} vol={0.6} />
      <Snd name="flicker" at={B.scare + 2} dur={20} vol={0.4} />
      <Snd name="drone" at={B.black} dur={H20_FRAMES - B.black} vol={0.18} />
      {VO.map((v) => (
        <Sequence key={v.src} from={v.at} durationInFrames={v.dur + 8} layout="none"><Audio src={staticFile(v.src)} volume={1} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
