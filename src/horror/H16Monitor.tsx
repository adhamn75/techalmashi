import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import TL from './H16Monitor.timeline.json';

// Horror ep 16 — «جهاز مراقبة الطفل». The baby monitor switched itself on; it plays crying… and we have no
// baby. On its screen, a small cradle — in OUR room. The crying stops, and something turns to the camera.
// Look: the physical device as the hero object on a nightstand (a still-life, not a phone/CCTV full-screen like
// ep 4): a pale grey night-vision picture inside a small screen, a row of five sound-level LEDs that climb red
// with the crying, a slow push from the nightstand into the screen, then the face fills it. Never gore.
// Voice: Hamed +8 %, −22 Hz (public/voice/h16-monitor).

const FONT = 'Cairo, sans-serif';
const RED = '#ff1a33';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H16_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const TEXT = ['جهاز مراقبة الطفل اشتغل وحده', 'بكاء… ونحن لا طفل لدينا', 'على الشاشة… مهد في غرفتنا', 'سكت البكاء… والتفت نحو الكاميرا'];
const rnd = (n: number) => {const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x);};

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={Math.round(at)} durationInFrames={Math.max(1, dur)} layout="none"><Audio src={staticFile(`sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1600, size = 62}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#efe7e4', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000, 0 0 6px #000'}}>{text}</div>
  );
};

// the picture on the monitor (drawn in a 600×450 box)
const Feed: React.FC<{f: number}> = ({f}) => {
  const ours = interpolate(f, [B.room, B.room + 20], [0, 1], clamp); // our bed slides into view
  const rock = f < B.hush ? Math.sin(f / 9) * 7 : Math.sin(B.hush / 9) * 7 * interpolate(f, [B.hush, B.hush + 20], [1, 0], clamp);
  const turn = interpolate(f, [B.hush + 16, B.scare], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  const panX = interpolate(ours, [0, 1], [0, -120]);
  const noise = rnd(Math.floor(f / 2));
  return (
    <svg width="600" height="450" viewBox="0 0 600 450">
      <defs>
        <radialGradient id="h16ir" cx="45%" cy="55%" r="70%"><stop offset="0" stopColor="#7d8482" /><stop offset="1" stopColor="#141716" /></radialGradient>
      </defs>
      <rect width="600" height="450" fill="url(#h16ir)" />
      <g transform={`translate(${panX} 0)`}>
        {/* wall + floor */}
        <rect x="-200" y="300" width="1000" height="150" fill="#3a3f3d" />
        {/* OUR bed at the right (the room is ours): two shapes asleep under a blanket */}
        <g opacity={0.4 + ours * 0.6}>
          <rect x="520" y="230" width="260" height="110" fill="#5a605e" />
          <rect x="520" y="200" width="260" height="40" fill="#6c7270" />
          <ellipse cx="575" cy="220" rx="34" ry="24" fill="#2a2e2d" /><ellipse cx="650" cy="222" rx="34" ry="24" fill="#2a2e2d" />
        </g>
        {/* the cradle, rocking by itself */}
        <g transform={`translate(300 330) rotate(${rock})`}>
          <path d="M-110 -70 Q0 30 110 -70 Z" fill="#9aa19f" stroke="#1a1d1c" strokeWidth="4" />
          <path d="M-110 -70 Q0 30 110 -70" fill="none" stroke="#c9cfcc" strokeWidth="3" />
          {[-80, -40, 0, 40, 80].map((x) => <path key={x} d={`M${x} -70 l0 -60`} stroke="#c9cfcc" strokeWidth="4" />)}
          <path d="M-110 -130 L110 -130" stroke="#c9cfcc" strokeWidth="5" />
          <path d="M-70 0 L60 110 M70 0 L-60 110 M-90 110 L90 110" stroke="#c9cfcc" strokeWidth="5" fill="none" />
          {/* what lies in it: a small dark bundle… whose head turns to the lens */}
          <ellipse cx="0" cy="-80" rx="60" ry="26" fill="#1a1d1c" />
          <g transform={`translate(${-30 + turn * 30} ${-96 - turn * 90}) scale(${1 + turn * 1.6})`}>
            {/* too long for a baby's head: a gaunt grey face, hair hanging, hollow eyes, the mouth open */}
            <ellipse cx="0" cy="4" rx="27" ry="38" fill={turn > 0.05 ? '#a9adab' : '#1a1d1c'} />
            {turn > 0.05 && (
              <g opacity={turn}>
                <ellipse cx="-4" cy="10" rx="30" ry="40" fill="#000" opacity="0.35" />
                <ellipse cx="-11" cy="-4" rx="8" ry="11" fill="#050606" /><ellipse cx="11" cy="-4" rx="8" ry="11" fill="#050606" />
                <circle cx="-10" cy="-3" r="1.3" fill="#fff" /><circle cx="12" cy="-3" r="1.3" fill="#fff" />
                <path d="M-7 18 Q0 14 7 18 L5 40 Q0 44 -5 40 Z" fill="#050606" />
                <path d="M-30 -10 Q-30 -46 0 -44 Q30 -46 30 -10 L34 60 L22 58 Q24 0 14 -30 Q0 -36 -14 -30 Q-24 0 -22 58 L-34 60 Z" fill="#0b0c0c" />
                <path d="M-6 -36 Q-10 0 -4 40" stroke="#0b0c0c" strokeWidth="4" fill="none" />
              </g>
            )}
          </g>
        </g>
      </g>
      {/* night-vision noise + scanlines */}
      {Array.from({length: 45}, (_, i) => <rect key={i} x="0" y={i * 10} width="600" height="3" fill="#000" opacity="0.18" />)}
      <rect x="0" y={(f * 9) % 450} width="600" height="16" fill="#fff" opacity={0.05 + noise * 0.05} />
      {f >= B.scare && <rect width="600" height="450" fill="#ff1a33" opacity={0.25 + 0.2 * noise} style={{mixBlendMode: 'multiply'}} />}
      {/* HUD */}
      <circle cx="30" cy="30" r="9" fill={RED} opacity={Math.floor(f / 15) % 2 ? 1 : 0.2} />
      <text x="48" y="38" fontFamily="monospace" fontSize="24" fill="#e6ebe9">CAM 1</text>
      <text x="470" y="38" fontFamily="monospace" fontSize="24" fill="#e6ebe9">03:00</text>
      <text x="22" y="432" fontFamily="monospace" fontSize="20" fill="#e6ebe9">21°C</text>
    </svg>
  );
};

const Nightstand: React.FC<{f: number; level: number}> = ({f, level}) => {
  const glow = 0.85 + 0.15 * rnd(Math.floor(f / 3));
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
      <defs>
        <radialGradient id="h16glow" cx="50%" cy="40%" r="55%"><stop offset="0" stopColor="#9aa3a0" stopOpacity="0.35" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        <radialGradient id="h16red" cx="50%" cy="60%" r="50%"><stop offset="0" stopColor="#ff1a33" stopOpacity="0.5" /><stop offset="1" stopColor="#ff1a33" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="1080" height="1920" fill="#030102" />
      {/* the wall behind with a faint moon-blue window bar falling diagonally */}
      <path d="M-100 200 L300 0 L520 0 L120 200 Z" fill="#0e1012" opacity="0.6" />
      {/* screen light on the wall */}
      <ellipse cx="540" cy="760" rx="620" ry="560" fill="url(#h16glow)" opacity={glow} />
      <ellipse cx="540" cy="1080" rx="420" ry="300" fill="url(#h16red)" opacity={level * 0.9} />
      {/* nightstand top */}
      <path d="M-40 1260 L1120 1260 L1120 1920 L-40 1920 Z" fill="#120506" />
      <path d="M-40 1260 L1120 1260" stroke="#3a0d12" strokeWidth="6" />
      <ellipse cx="540" cy="1262" rx="380" ry="30" fill="#000" opacity="0.6" />
      {/* a glass of water and an alarm clock, to place it on a parent's nightstand */}
      <rect x="110" y="1130" width="80" height="130" rx="8" fill="#1a1012" opacity="0.7" stroke="#2c1a1c" strokeWidth="3" />
      <rect x="860" y="1170" width="150" height="90" rx="14" fill="#0c0405" />
      <text x="935" y="1230" textAnchor="middle" fontFamily="monospace" fontSize="44" fill={RED} opacity="0.85">03:00</text>
      {/* the monitor: rounded body, antenna, screen, five LEDs */}
      <g transform="translate(540 900)">
        <path d="M150 -360 L170 -470" stroke="#1c1012" strokeWidth="22" strokeLinecap="round" />
        <rect x="-330" y="-360" width="660" height="720" rx="70" fill="#1a1416" stroke="#000" strokeWidth="8" />
        <rect x="-330" y="-360" width="660" height="720" rx="70" fill="none" stroke="#3b2a2c" strokeWidth="3" />
        <rect x="-306" y="-330" width="612" height="462" rx="16" fill="#000" />
        <foreignObject x="-300" y="-325" width="600" height="450"><Feed f={f} /></foreignObject>
        {/* LEDs: the sound level of the crying */}
        {[0, 1, 2, 3, 4].map((i) => {
          const on = level * 5 > i + 0.2;
          return <circle key={i} cx={-160 + i * 80} cy="210" r="20" fill={on ? RED : '#2a0b0e'} style={on ? {filter: 'drop-shadow(0 0 14px #ff1a33)'} : undefined} />;
        })}
        <rect x="-60" y="270" width="120" height="40" rx="20" fill="#0d0809" />
      </g>
    </svg>
  );
};

export const H16Monitor: React.FC = () => {
  const f = useCurrentFrame();
  // crying level, jittered, only between the cry line and the hush
  const crying = f >= VO[1].at - 10 && f < B.hush;
  const level = crying ? 0.45 + 0.55 * Math.abs(Math.sin(f / 5 + rnd(Math.floor(f / 4)))) : f >= B.scare && f < B.black ? 1 : f < VO[1].at - 10 ? 0.2 * (rnd(Math.floor(f / 6)) > 0.6 ? 1 : 0) : 0;
  // camera: slow push towards the device, deeper at «our room», a dead-still hold at the hush, then the screen fills the frame
  const sc = f < B.scare
    ? interpolate(f, [0, B.room, B.hush, B.scare], [1.0, 1.25, 1.55, 1.62], {...clamp, easing: Easing.inOut(Easing.sin)})
    : interpolate(f, [B.scare, B.scare + 8], [1.62, 2.1], {...clamp, easing: Easing.out(Easing.cubic)});
  const oy = interpolate(sc, [1, 2.1], [0, 180], clamp);
  const drift = f < B.hush ? Math.sin(f / 30) * 6 : 0;
  const flick = f >= B.scare && f < B.black && rnd(f) > 0.74 ? 0.25 : 1;
  const shake = f >= B.scare && f < B.scare + 12 ? (rnd(f) - 0.5) * 28 : 0;

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {f < B.black && (
        <AbsoluteFill style={{opacity: flick, transformOrigin: '540px 800px', transform: `translate(${drift + shake}px, ${oy}px) scale(${sc})`}}>
          <Nightstand f={f} level={level} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,.92) 100%)', pointerEvents: 'none'}} />
      <AbsoluteFill style={{opacity: 0.07, mixBlendMode: 'screen', pointerEvents: 'none',
        backgroundImage: `repeating-radial-gradient(circle at ${rnd(f) * 100}% ${rnd(f + 3) * 100}%, rgba(255,255,255,.5) 0 1px, transparent 1px 3px)`}} />

      {TEXT.map((t, i) => <Caption key={i} f={f} from={i === 0 ? 0 : VO[i].at - 2} to={VO[i].at + VO[i].dur + 10} text={t} red={i >= 1} size={i >= 2 ? 56 : 60} />)}
      {f >= B.black && (
        <>
          <Caption f={f} from={B.black + 2} to={H16_FRAMES} text="الليلة القادمة… رسالة بخط يدك… مؤرخة غدًا" y={760} red size={56} />
          <div style={{position: 'absolute', top: 1100, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: 44,
            opacity: interpolate(f, [B.black + 26, B.black + 36], [0, 1], clamp)}}>
            <span style={{background: '#ffd35a', color: '#140406', borderRadius: 24, padding: '6px 30px'}}>🔔 اشترك لتصلك قصة الليلة القادمة</span>
          </div>
        </>
      )}

      <Snd name="drone" at={0} dur={B.hush} vol={0.28} loop />
      <Snd name="static" at={0} dur={VO[1].at} vol={0.14} />
      <Snd name="static" at={VO[1].at} dur={B.hush - VO[1].at} vol={0.08} loop />
      {Array.from({length: Math.floor((B.hush - B.room) / 40)}, (_, i) => <Snd key={`c${i}`} name="creak" at={B.room + i * 40} dur={20} vol={0.16} />)}
      {Array.from({length: 3}, (_, i) => <Snd key={`h${i}`} name="heartbeat" at={B.hush + 6 + i * 22} dur={24} vol={0.45} />)}
      <Snd name="sting" at={B.scare} dur={90} vol={0.6} />
      <Snd name="flicker" at={B.scare + 2} dur={20} vol={0.4} />
      <Snd name="drone" at={B.black} dur={H16_FRAMES - B.black} vol={0.18} />
      {VO.map((v) => (
        <Sequence key={v.src} from={v.at} durationInFrames={v.dur + 8} layout="none"><Audio src={staticFile(v.src)} volume={1} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
