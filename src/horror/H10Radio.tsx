import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import TL from './H10Radio.timeline.json';
import {Face} from './HoodedFace';

// Horror ep 10 — «الراديو». Grandpa's old radio in the attic: no battery, its plug lies cut on the floor,
// yet it switches itself on, reads names through the static… then mine… then «أنا خلفك».
// Look: one big object, front-on, macro — a valve radio filling the frame (not the cutaway of ep 9, not the
// screens of eps 6/8): walnut cabinet, blood-red glowing dial with a needle hunting by itself, a speaker grille
// that breathes red with the voice, a swinging attic bulb, dust. The dial glass reflects what stands behind you.
// Voice: Hamed −6 %, −18 Hz (public/voice/h10-radio). Never gore.

const FONT = 'Cairo, sans-serif';
const RED = '#ff1a33';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H10_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const TEXT = ['وجدتُ راديو جدّي القديم في العليّة', 'لا بطّارية فيه… لكنّه اشتغل وحده', 'بين التشويش… صوتٌ يقرأ أسماءً', 'ثمّ… نطق اسمي أنا', '«أنا خلفك»'];
const NAMES = ['سامي', 'مريم', 'خالد', 'نور', 'أنت'];
const rnd = (n: number) => {const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x);};

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={Math.round(at)} durationInFrames={Math.max(1, dur)} layout="none"><Audio src={staticFile(`sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1600, size = 66}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#efe7e4', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000, 0 0 6px #000'}}>{text}</div>
  );
};

// how loud the voice is now (for the grille glow): 1 while a line plays
const talking = (f: number) => VO.some((v) => f >= v.at && f < v.at + v.dur) ? 0.6 + 0.4 * Math.abs(Math.sin(f * 0.9)) : 0;

const Radio: React.FC<{f: number; power: number}> = ({f, power}) => {
  // needle hunts by itself, then snaps to one frequency when it says my name
  const hunt = 300 + Math.sin(f / 11) * 170 + Math.sin(f / 4.3) * 40;
  const needle = f < B.myname ? hunt : interpolate(f, [B.myname, B.myname + 8], [hunt, 540], clamp);
  const knob = needle * 0.9;
  const g = talking(f) * power;
  const flick = power * (rnd(Math.floor(f / 2)) > 0.08 ? 1 : 0.35);
  const reflect = interpolate(f, [B.behind - 10, B.behind + 30], [0, 1], clamp) * (f < B.silence ? 1 : 0);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
      <defs>
        <linearGradient id="h10wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a1410" /><stop offset="0.5" stopColor="#170a08" /><stop offset="1" stopColor="#0a0404" />
        </linearGradient>
        <pattern id="h10grain" width="1080" height="24" patternUnits="userSpaceOnUse">
          <path d="M0 12 Q270 4 540 13 T1080 11" stroke="#3a1c16" strokeWidth="2" fill="none" opacity="0.5" />
        </pattern>
        <linearGradient id="h10dial" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff3346" /><stop offset="0.6" stopColor="#a3061a" /><stop offset="1" stopColor="#3a0208" />
        </linearGradient>
        <pattern id="h10cloth" width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill="#140808" /><path d="M0 0 L12 12 M12 0 L0 12" stroke="#2a1312" strokeWidth="2" />
        </pattern>
        <radialGradient id="h10glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={RED} stopOpacity="0.9" /><stop offset="1" stopColor={RED} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* glow on the attic wall behind */}
      <ellipse cx="540" cy="900" rx="620" ry="520" fill="url(#h10glow)" opacity={0.25 * flick} />
      {/* cabinet: arched top */}
      <path d="M90 1420 L90 700 Q90 430 540 400 Q990 430 990 700 L990 1420 Z" fill="url(#h10wood)" stroke="#3b1d17" strokeWidth="10" />
      <path d="M90 1420 L90 700 Q90 430 540 400 Q990 430 990 700 L990 1420 Z" fill="url(#h10grain)" opacity="0.7" />
      {/* speaker grille with fretwork arches */}
      <path d="M190 980 L190 700 Q190 520 540 500 Q890 520 890 700 L890 980 Z" fill="url(#h10cloth)" />
      <path d="M190 980 L190 700 Q190 520 540 500 Q890 520 890 700 L890 980 Z" fill={RED} opacity={0.08 + g * 0.35} />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${290 + i * 140} 980 L${290 + i * 140} 660 Q${360 + i * 140} 580 ${430 + i * 140} 660 L${430 + i * 140} 980`} fill="none" stroke="#2a130f" strokeWidth="18" />
      ))}
      {/* speaker rings breathing with the voice */}
      {g > 0 && [0, 1, 2].map((i) => {
        const t = ((f / 10 + i / 3) % 1);
        return <circle key={i} cx="540" cy="780" r={60 + t * 240} fill="none" stroke={RED} strokeWidth="4" opacity={(1 - t) * g * 0.7} />;
      })}
      {/* dial window */}
      <rect x="170" y="1020" width="740" height="200" rx="26" fill="#050202" stroke="#5a3a20" strokeWidth="10" />
      <rect x="186" y="1036" width="708" height="168" rx="18" fill="url(#h10dial)" opacity={0.15 + 0.85 * flick} />
      {Array.from({length: 41}, (_, i) => (
        <line key={i} x1={210 + i * 16.5} y1="1060" x2={210 + i * 16.5} y2={i % 5 === 0 ? 1100 : 1082} stroke="#1a0004" strokeWidth={i % 5 === 0 ? 4 : 2} opacity="0.85" />
      ))}
      {[88, 92, 96, 100, 104, 108].map((n, i) => (
        <text key={n} x={210 + i * 132} y="1140" fill="#1a0004" fontFamily="Consolas, monospace" fontSize="30" textAnchor="middle" fontWeight="700">{n}</text>
      ))}
      {/* the needle */}
      <rect x={210 + needle} y="1046" width="7" height="148" fill="#fff0e0" opacity={0.4 + 0.6 * power} style={{filter: 'drop-shadow(0 0 6px #fff)'}} />
      {/* reflection in the glass: something tall behind you */}
      <g opacity={reflect * 0.75}>
        <path d="M600 1204 Q596 1100 640 1060 Q684 1100 680 1204 Z" fill="#000" />
        <ellipse cx="640" cy="1104" rx="20" ry="26" fill="#000" />
        <circle cx="632" cy="1102" r="3.5" fill="#ffd0d0" /><circle cx="648" cy="1102" r="3.5" fill="#ffd0d0" />
      </g>
      <path d="M200 1050 L420 1050 L330 1190 L200 1190 Z" fill="#fff" opacity="0.06" />
      {/* knobs */}
      {[300, 780].map((cx, i) => (
        <g key={cx} transform={`rotate(${i === 0 ? knob : -knob * 0.6} ${cx} 1320)`}>
          <circle cx={cx} cy="1320" r="62" fill="#1a0d0a" stroke="#4a2a18" strokeWidth="8" />
          {Array.from({length: 16}, (_, k) => <line key={k} x1={cx} y1="1262" x2={cx} y2="1276" stroke="#3a2016" strokeWidth="5" transform={`rotate(${k * 22.5} ${cx} 1320)`} />)}
          <line x1={cx} y1="1320" x2={cx} y2="1268" stroke="#c9a070" strokeWidth="6" />
        </g>
      ))}
      {/* power lamp */}
      <circle cx="540" cy="1320" r="18" fill={RED} opacity={power * flick} style={{filter: 'drop-shadow(0 0 14px #ff1a33)'}} />
      {/* the floor and the cut plug: no power at all */}
      <rect x="0" y="1420" width="1080" height="500" fill="#070303" />
      <path d="M720 1420 Q760 1500 860 1520 Q920 1530 960 1560" stroke="#120808" strokeWidth="12" fill="none" />
      <rect x="950" y="1548" width="46" height="30" rx="5" fill="#1a1010" transform="rotate(18 970 1560)" />
      <line x1="995" y1="1566" x2="1022" y2="1578" stroke="#6a5a50" strokeWidth="3" /><line x1="992" y1="1576" x2="1018" y2="1592" stroke="#6a5a50" strokeWidth="3" />
    </svg>
  );
};

export const H10Radio: React.FC = () => {
  const f = useCurrentFrame();
  const power = f < B.silence ? 1 : 0;
  // camera: starts tight on the glowing dial (the hook), pulls back to the whole radio, then pushes into the glass
  const sc = interpolate(f, [0, B.on, B.names, B.behind, B.silence], [1.75, 1.2, 1.05, 1.25, 1.6], {...clamp, easing: Easing.inOut(Easing.sin)});
  const cy = interpolate(f, [0, B.on, B.names, B.behind, B.silence], [1120, 980, 940, 1110, 1120], {...clamp, easing: Easing.inOut(Easing.sin)});
  const cx = interpolate(f, [B.names, B.behind, B.silence], [540, 600, 640], clamp);
  const camX = Math.min(1080 - 540 / sc, Math.max(540 / sc, cx));
  const camY = Math.min(1920 - 960 / sc, Math.max(960 / sc, cy));
  const shake = f >= B.myname && f < B.silence ? (rnd(f) - 0.5) * 6 : 0;
  const scared = f >= B.scare && f < B.black;
  const flick = scared && rnd(f) > 0.78 ? 0.25 : 1;
  const bulb = Math.sin(f / 22) * 14;
  // which name the dial is reading
  const nameIdx = f >= B.myname ? 4 : Math.min(3, Math.floor((f - B.names) / 16));
  const staticOn = (f >= B.on && f < B.names + 10) || (f >= B.myname - 6 && f < B.myname + 4);

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {f < B.scare && (
        <AbsoluteFill style={{transformOrigin: '0 0', transform: `translate(${540 - camX * sc + shake}px, ${960 - camY * sc}px) scale(${sc})`}}>
          <Radio f={f} power={power} />
          {/* swinging attic bulb (off) and its cord */}
          <div style={{position: 'absolute', left: 540, top: 0, width: 4, height: 300, background: '#120707', transformOrigin: '50% 0', transform: `rotate(${bulb}deg)`}}>
            <div style={{position: 'absolute', left: -26, top: 296, width: 56, height: 70, borderRadius: '50% 50% 45% 45%', background: '#0c0707', border: '3px solid #1a1010'}} />
          </div>
          {/* dust in the red light */}
          {Array.from({length: 40}, (_, i) => {
            const t = ((f / 260 + rnd(i)) % 1);
            return <div key={i} style={{position: 'absolute', left: 120 + rnd(i + 9) * 840 + Math.sin(f / 30 + i) * 20, top: 1400 - t * 1100, width: 4, height: 4, borderRadius: 2,
              background: '#e8b0a8', opacity: 0.45 * Math.sin(t * Math.PI) * power}} />;
          })}
          {/* names read out in the dial */}
          {f >= B.names && f < B.silence && (
            <div style={{position: 'absolute', left: 186, top: 1150, width: 708, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: nameIdx === 4 ? 46 : 34,
              color: nameIdx === 4 ? '#fff' : '#2a0005', opacity: 0.6 + 0.4 * Math.sin(f / 3), textShadow: nameIdx === 4 ? `0 0 16px ${RED}` : 'none'}}>{NAMES[nameIdx]}</div>
          )}
          {/* fog */}
          <AbsoluteFill style={{background: `radial-gradient(70% 16% at ${40 + Math.sin(f / 50) * 20}% 88%, rgba(120,20,30,.25), transparent 70%)`}} />
        </AbsoluteFill>
      )}

      {/* static snow when the radio wakes and when it finds my name */}
      {staticOn && (
        <AbsoluteFill style={{opacity: 0.16, mixBlendMode: 'screen', pointerEvents: 'none',
          backgroundImage: `repeating-linear-gradient(${rnd(f) * 180}deg, rgba(255,255,255,.7) 0 1px, transparent 1px 2px), repeating-linear-gradient(0deg, rgba(255,40,60,.25) 0 2px, transparent 2px ${3 + Math.floor(rnd(f + 1) * 5)}px)`}} />
      )}

      {/* the scare */}
      {scared && (
        <AbsoluteFill style={{opacity: flick, background: 'radial-gradient(circle at 50% 45%, #2a0207, #000 70%)'}}>
          <div style={{position: 'absolute', left: 40, top: 240, width: 1000, height: 1300, transform: `scale(${interpolate(f, [B.scare, B.black], [1.05, 1.3], clamp)})`}}>
            <Face f={f} eye={1} />
          </div>
        </AbsoluteFill>
      )}

      {/* vignette + grain */}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,.88) 100%)', pointerEvents: 'none'}} />
      <AbsoluteFill style={{opacity: 0.07, mixBlendMode: 'screen', pointerEvents: 'none',
        backgroundImage: `repeating-radial-gradient(circle at ${rnd(f) * 100}% ${rnd(f + 3) * 100}%, rgba(255,255,255,.5) 0 1px, transparent 1px 3px)`}} />

      {/* captions */}
      {TEXT.map((t, i) => <Caption key={i} f={f} from={i === 0 ? 0 : VO[i].at - 2} to={VO[i].at + VO[i].dur + 10} text={t} red={i >= 3} size={i === 4 ? 90 : 66} />)}
      {f >= B.black && (
        <>
          <Caption f={f} from={B.black + 2} to={H10_FRAMES} text="الليلة القادمة… طرقٌ على نافذة الطابق العاشر 🪟" y={800} red size={56} />
          <div style={{position: 'absolute', top: 1080, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: 44,
            opacity: interpolate(f, [B.black + 26, B.black + 36], [0, 1], clamp)}}>
            <span style={{background: '#ffd35a', color: '#140406', borderRadius: 24, padding: '6px 30px'}}>🔔 اشترك لتصلك قصة الليلة القادمة</span>
          </div>
        </>
      )}

      {/* sound */}
      <Snd name="drone" at={0} dur={B.silence} vol={0.3} loop />
      <Snd name="wind" at={0} dur={B.on + 20} vol={0.16} />
      <Snd name="creak" at={4} dur={30} vol={0.35} />
      <Snd name="static" at={B.on} dur={B.names + 10 - B.on} vol={0.22} loop />
      <Snd name="static" at={B.myname - 6} dur={10} vol={0.35} />
      <Snd name="flicker" at={B.on - 2} dur={20} vol={0.35} />
      {Array.from({length: 6}, (_, i) => <Snd key={`h${i}`} name="heartbeat" at={B.myname + i * 22} dur={24} vol={0.4} />)}
      <Snd name="sting" at={B.scare} dur={90} vol={0.6} />
      <Snd name="flicker" at={B.scare + 2} dur={20} vol={0.4} />
      <Snd name="drone" at={B.black} dur={H10_FRAMES - B.black} vol={0.18} />
      {VO.map((v) => (
        <Sequence key={v.src} from={v.at} durationInFrames={v.dur + 8} layout="none"><Audio src={staticFile(v.src)} volume={1} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
