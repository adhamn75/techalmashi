import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import TL from './H12Footprints.timeline.json';
import {Face} from './HoodedFace';

// Horror ep 12 — «آثار أقدام». I wake to dripping water. Wet footprints leave the bathroom, cross the bedroom,
// stop beside my bed… and not one print goes back. It's still standing next to me.
// Look: straight top-down view of the room (a floor plan — none of the earlier eps used it): dark floorboards,
// a red night-light, the bathroom door ajar at the top, the bed at the bottom, prints that glisten red as they
// appear one by one with ripples. The camera tracks the prints down, then holds on the last pair. Never gore.
// Voice: Hamed −6 %, −18 Hz (public/voice/h12-footprints).

const FONT = 'Cairo, sans-serif';
const RED = '#ff1a33';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H12_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const TEXT = ['صوت ماءٍ يقطر', 'آثار أقدام مبلّلة… من الحمّام', 'تقف بجانب سريري', 'ولا أثر يعود', 'إنّه هنا… الآن'];
const rnd = (n: number) => {const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x);};

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={Math.round(at)} durationInFrames={Math.max(1, dur)} layout="none"><Audio src={staticFile(`sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1600, size = 64}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#efe7e4', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000, 0 0 6px #000'}}>{text}</div>
  );
};

// the room is 1080 x 2600 (taller than the frame, the camera travels down it)
const ROOM_H = 2600;
// footprint path: from the bathroom door (top) curving down to the bed's side
const N = 12;
const STEPS = Array.from({length: N}, (_, i) => {
  const t = i / (N - 1);
  const x = 600 - Math.sin(t * Math.PI) * 170 + (i % 2 ? 34 : -34);
  const y = 420 + t * 1460;
  const ang = Math.cos(t * Math.PI) * 18;
  return {x, y, ang, left: i % 2 === 0};
});

const Foot: React.FC<{x: number; y: number; ang: number; left: boolean; o: number; wet: number}> = ({x, y, ang, left, o, wet}) => (
  <g transform={`translate(${x} ${y}) rotate(${180 + ang}) scale(${left ? -1 : 1} 1)`} opacity={o}>
    <ellipse cx="0" cy="10" rx="26" ry="44" fill="#3a0a12" />
    <ellipse cx="2" cy="-46" rx="22" ry="18" fill="#3a0a12" />
    {[[-14, -74, 9], [-1, -80, 8], [11, -78, 7], [21, -71, 6], [28, -62, 5]].map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} fill="#3a0a12" />)}
    {/* wet sheen */}
    <ellipse cx="-6" cy="0" rx="10" ry="26" fill={RED} opacity={0.35 * wet} />
    <ellipse cx="0" cy="10" rx="30" ry="48" fill="none" stroke={RED} strokeWidth="2" opacity={0.4 * wet} />
  </g>
);

const Room: React.FC<{f: number}> = ({f}) => {
  // prints appear between B.prints and B.stop
  const shown = interpolate(f, [0, B.prints, B.stop], [2, 2.5, N], clamp);
  const light = 0.8 + 0.2 * Math.sin(f / 17) * (rnd(Math.floor(f / 3)) > 0.1 ? 1 : 0.2);
  return (
    <svg width={1080} height={ROOM_H} viewBox={`0 0 1080 ${ROOM_H}`} style={{position: 'absolute', left: 0, top: 0}}>
      <defs>
        <radialGradient id="h12night" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={RED} stopOpacity="0.5" /><stop offset="1" stopColor={RED} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* floorboards */}
      <rect width="1080" height={ROOM_H} fill="#0c0606" />
      {Array.from({length: 12}, (_, i) => (
        <g key={i}>
          <rect x={i * 90} y="0" width="88" height={ROOM_H} fill={i % 2 ? '#110807' : '#0e0606'} />
          {Array.from({length: 5}, (_, k) => <line key={k} x1={i * 90} x2={i * 90 + 88} y1={(rnd(i * 7 + k) * ROOM_H)} y2={(rnd(i * 7 + k) * ROOM_H)} stroke="#050202" strokeWidth="3" />)}
        </g>
      ))}
      {/* bathroom at the top: tiles, door ajar, puddle */}
      <rect x="0" y="0" width="1080" height="300" fill="#140a0c" />
      {Array.from({length: 18}, (_, i) => Array.from({length: 4}, (_, k) => (
        <rect key={`${i}-${k}`} x={i * 60 + 2} y={k * 72 + 6} width="56" height="66" fill="#1c1012" />
      )))}
      <rect x="0" y="296" width="1080" height="16" fill="#050202" />
      <rect x="430" y="296" width="300" height="16" fill="#140a0c" />
      <path d={`M430 304 L${430 + 300 * Math.cos(0.9)} ${304 + 300 * Math.sin(0.9)}`} stroke="#2a1614" strokeWidth="22" />
      <ellipse cx="590" cy="200" rx="170" ry="70" fill="#260810" opacity="0.8" />
      <ellipse cx="590" cy="200" rx="170" ry="70" fill="none" stroke={RED} strokeWidth="2" opacity="0.3" />
      {/* drip ripples in the puddle */}
      {[0, 1, 2].map((i) => {
        const t = ((f / 36 + i / 3) % 1);
        return <ellipse key={i} cx="600" cy="196" rx={10 + t * 120} ry={4 + t * 48} fill="none" stroke={RED} strokeWidth="3" opacity={(1 - t) * 0.6} />;
      })}
      {/* night-light glow on the wall side */}
      <circle cx="80" cy="1300" r="460" fill="url(#h12night)" opacity={light} />
      <rect x="20" y="1280" width="34" height="44" rx="8" fill={RED} opacity={light} style={{filter: 'drop-shadow(0 0 18px #ff1a33)'}} />
      {/* the bed at the bottom (seen from above): headboard at the bottom edge, blanket, my shape under it */}
      <rect x="560" y="1900" width="470" height="700" rx="18" fill="#1a0d0f" stroke="#2a1416" strokeWidth="8" />
      <rect x="575" y="1915" width="440" height="520" rx="30" fill="#2a1013" />
      <path d="M600 1960 Q800 1930 990 1970 Q1000 2200 980 2420 Q790 2440 600 2420 Z" fill="#33141a" />
      <ellipse cx="790" cy="2480" rx="120" ry="70" fill="#d8c8c4" opacity="0.18" />
      <ellipse cx="790" cy="2470" rx="60" ry="50" fill="#0a0405" />
      {/* the footprints */}
      {STEPS.map((s, i) => {
        const o = interpolate(shown, [i, i + 0.6], [0, 1], clamp);
        const wet = i >= N - 2 ? 1 : interpolate(f, [B.prints + i * 10, B.prints + i * 10 + 120], [1, 0.35], clamp);
        return o > 0 ? <Foot key={i} {...s} o={o} wet={wet} /> : null;
      })}
      {/* last pair: still dripping, a ripple around them */}
      {f >= B.stop && [0, 1].map((i) => {
        const t = ((f - B.stop) / 30 + i / 2) % 1;
        const p = STEPS[N - 1];
        return <ellipse key={`p${i}`} cx={p.x - 20} cy={p.y} rx={60 + t * 90} ry={40 + t * 60} fill="none" stroke={RED} strokeWidth="3" opacity={(1 - t) * 0.5} />;
      })}
      {/* «it's standing next to me»: a shadow head + shoulders from above, right over the last prints */}
      <g opacity={interpolate(f, [B.here, B.here + 30], [0, 0.9], clamp) * (f < B.scare ? 1 : 0)}>
        <ellipse cx={STEPS[N - 1].x - 20} cy={STEPS[N - 1].y - 20} rx="120" ry="56" fill="#000" />
        <ellipse cx={STEPS[N - 1].x - 20} cy={STEPS[N - 1].y - 20} rx="54" ry="62" fill="#000" />
        <circle cx={STEPS[N - 1].x - 38} cy={STEPS[N - 1].y + 16} r="6" fill={RED} style={{filter: 'drop-shadow(0 0 8px #ff1a33)'}} />
        <circle cx={STEPS[N - 1].x - 2} cy={STEPS[N - 1].y + 16} r="6" fill={RED} style={{filter: 'drop-shadow(0 0 8px #ff1a33)'}} />
      </g>
    </svg>
  );
};

export const H12Footprints: React.FC = () => {
  const f = useCurrentFrame();
  // camera: tight on the dripping puddle (hook), travels down the trail, holds on the last pair, pushes in
  const sc = interpolate(f, [0, B.prints, B.stop, B.none, B.here, B.scare], [1.7, 1.25, 1.1, 1.0, 1.35, 1.7], {...clamp, easing: Easing.inOut(Easing.sin)});
  const cy = interpolate(f, [0, B.prints, B.stop, B.none, B.here], [220, 500, 1750, 1500, 1880], {...clamp, easing: Easing.inOut(Easing.sin)});
  const cx = interpolate(f, [0, B.stop, B.here], [600, 560, STEPS[N - 1].x - 20], clamp);
  const camX = Math.min(1080 - 540 / sc, Math.max(540 / sc, cx));
  const camY = Math.min(ROOM_H - 960 / sc, Math.max(960 / sc, cy));
  const scared = f >= B.scare && f < B.black;
  const flick = scared && rnd(f) > 0.78 ? 0.25 : 1;

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {f < B.scare && (
        <AbsoluteFill style={{transformOrigin: '0 0', transform: `translate(${540 - camX * sc}px, ${960 - camY * sc}px) scale(${sc})`}}>
          <Room f={f} />
        </AbsoluteFill>
      )}

      {scared && (
        <AbsoluteFill style={{opacity: flick, background: 'radial-gradient(circle at 50% 45%, #2a0207, #000 70%)'}}>
          <div style={{position: 'absolute', left: 40, top: 240, width: 1000, height: 1300, transform: `scale(${interpolate(f, [B.scare, B.black], [1.05, 1.35], clamp)})`}}>
            <Face f={f} eye={1} />
          </div>
        </AbsoluteFill>
      )}

      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,.9) 100%)', pointerEvents: 'none'}} />
      <AbsoluteFill style={{opacity: 0.07, mixBlendMode: 'screen', pointerEvents: 'none',
        backgroundImage: `repeating-radial-gradient(circle at ${rnd(f) * 100}% ${rnd(f + 3) * 100}%, rgba(255,255,255,.5) 0 1px, transparent 1px 3px)`}} />

      {TEXT.map((t, i) => <Caption key={i} f={f} from={i === 0 ? 0 : VO[i].at - 2} to={VO[i].at + VO[i].dur + 10} text={t} red={i >= 3} size={i === 4 ? 80 : 62} y={i === 4 ? 360 : 1600} />)}
      {f >= B.black && (
        <>
          <Caption f={f} from={B.black + 2} to={H12_FRAMES} text="الليلة القادمة… رجلٌ تحت عمود الإنارة… يقترب" y={780} red size={56} />
          <div style={{position: 'absolute', top: 1080, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: 44,
            opacity: interpolate(f, [B.black + 26, B.black + 36], [0, 1], clamp)}}>
            <span style={{background: '#ffd35a', color: '#140406', borderRadius: 24, padding: '6px 30px'}}>🔔 اشترك لتصلك قصة الليلة القادمة</span>
          </div>
        </>
      )}

      <Snd name="drone" at={0} dur={B.silence} vol={0.3} loop />
      {Array.from({length: Math.floor(B.silence / 24)}, (_, i) => <Snd key={`d${i}`} name="clock" at={i * 24 + 3} dur={10} vol={0.18} />)}
      {Array.from({length: N}, (_, i) => <Snd key={`s${i}`} name="creak" at={B.prints + (i * (B.stop - B.prints)) / N} dur={14} vol={0.16} />)}
      {Array.from({length: 4}, (_, i) => <Snd key={`h${i}`} name="heartbeat" at={B.none + i * 22} dur={24} vol={0.4} />)}
      <Snd name="sting" at={B.scare} dur={90} vol={0.6} />
      <Snd name="flicker" at={B.scare + 2} dur={20} vol={0.4} />
      <Snd name="drone" at={B.black} dur={H12_FRAMES - B.black} vol={0.18} />
      {VO.map((v) => (
        <Sequence key={v.src} from={v.at} durationInFrames={v.dur + 8} layout="none"><Audio src={staticFile(v.src)} volume={1} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
