import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import TL from './H11Window.timeline.json';
import {Face} from './HoodedFace';

// Horror ep 11 — «نافذة الطابق العاشر». Midnight, 10th floor, someone knocks on the window. No balcony, no ladder.
// A hand print on the glass grows with each knock… then the turn: the print is on the INSIDE, and the glass
// reflects who stands in the room with you.
// Look: one tall window filling the frame, a red-lit city ten floors down (bokeh), slanted rain, condensation,
// the glass shudders on each knock with a ripple. Slow push-in, a dead-silent beat, then the face. Never gore.
// Voice: Hamed −6 %, −18 Hz (public/voice/h11-window).

const FONT = 'Cairo, sans-serif';
const RED = '#ff1a33';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H11_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const TEXT = ['الطابق العاشر… منتصف الليل', 'طرقٌ على النافذة', 'لا شرفة هنا… ولا سلّم', 'وبصمة يدٍ تكبر مع كل طرقة', 'البصمة… من الداخل'];
const rnd = (n: number) => {const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x);};

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={Math.round(at)} durationInFrames={Math.max(1, dur)} layout="none"><Audio src={staticFile(`sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1560, size = 64}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#efe7e4', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000, 0 0 6px #000'}}>{text}</div>
  );
};

// knocks: three at the first line, then one per beat while the print grows
const KNOCKS = [B.knock + 4, B.knock + 14, B.knock + 24, B.print - 4, B.print + 22, B.print + 44, B.print + 66];
const lastKnock = (f: number) => KNOCKS.filter((k) => k <= f).pop();

// a hand pressed flat on the glass (palm + 5 fingers), drawn around 0,0
const Hand: React.FC<{s: number; o: number}> = ({s, o}) => (
  <g transform={`scale(${s})`} opacity={o}>
    <ellipse cx="0" cy="40" rx="62" ry="72" />
    {[[-58, -40, -24], [-28, -78, -8], [4, -88, 0], [36, -76, 8], [80, 0, 40]].map(([x, y, r], i) => (
      <rect key={i} x={x - 15} y={y - 50} width="30" height={i === 4 ? 70 : 100} rx="15" transform={`rotate(${r} ${x} ${y})`} />
    ))}
  </g>
);

const Window: React.FC<{f: number}> = ({f}) => {
  const k = lastKnock(f);
  const since = k === undefined ? 99 : f - k;
  const shudder = since < 6 ? Math.sin(since * 2.6) * (6 - since) * 1.6 : 0;
  const prints = KNOCKS.filter((x) => x <= f).length - 3; // print appears from the 4th knock
  const pScale = prints <= 0 ? 0 : 0.7 + prints * 0.22;
  const inside = f >= B.inside;
  const reflect = interpolate(f, [B.inside + 10, B.inside + 40], [0, 1], clamp) * (f < B.scare ? 1 : 0);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
      <defs>
        <linearGradient id="h11sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#020102" /><stop offset="0.6" stopColor="#12030a" /><stop offset="1" stopColor="#3a0612" />
        </linearGradient>
        <radialGradient id="h11bok" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ff4a5a" stopOpacity="0.9" /><stop offset="1" stopColor="#ff1a33" stopOpacity="0" />
        </radialGradient>
        <filter id="h11blur"><feGaussianBlur stdDeviation="6" /></filter>
        <filter id="h11fog"><feGaussianBlur stdDeviation="3" /></filter>
        <clipPath id="h11glass"><rect x="150" y="260" width="780" height="1240" /></clipPath>
      </defs>
      {/* the room wall around the window */}
      <rect width="1080" height="1920" fill="#060304" />
      <g transform={`translate(${shudder} 0)`}>
        <g clipPath="url(#h11glass)">
          <rect x="150" y="260" width="780" height="1240" fill="url(#h11sky)" />
          {/* city ten floors down: dim red windows and bokeh */}
          {Array.from({length: 26}, (_, i) => (
            <rect key={`b${i}`} x={150 + i * 32} y={1220 - rnd(i) * 220} width="30" height="400" fill="#080204" />
          ))}
          {Array.from({length: 60}, (_, i) => (
            <circle key={i} cx={160 + rnd(i + 3) * 760} cy={1180 + rnd(i + 7) * 300} r={8 + rnd(i) * 22} fill="url(#h11bok)"
              opacity={(0.25 + 0.35 * rnd(i + 11)) * (0.75 + 0.25 * Math.sin(f / 13 + i))} filter="url(#h11blur)" />
          ))}
          {/* rain streaks outside */}
          {Array.from({length: 70}, (_, i) => {
            const t = (f * (14 + rnd(i) * 8) + rnd(i + 5) * 1400) % 1400;
            const x = 150 + rnd(i + 1) * 820;
            return <line key={`r${i}`} x1={x - t * 0.12} y1={200 + t} x2={x - t * 0.12 - 8} y2={240 + t} stroke="#b08088" strokeWidth="2" opacity="0.35" />;
          })}
          {/* condensation on the glass */}
          <rect x="150" y="260" width="780" height="1240" fill="#c9b0b4" opacity={0.05 + 0.04 * Math.sin(f / 40)} filter="url(#h11fog)" />
          {Array.from({length: 46}, (_, i) => {
            const y = 300 + ((rnd(i + 2) * 1200 + f * rnd(i) * 1.4) % 1200);
            return <ellipse key={`d${i}`} cx={170 + rnd(i + 8) * 740} cy={y} rx="4" ry="6" fill="#e8d0d4" opacity="0.35" />;
          })}
          {/* the hand print, growing with each knock; at «من الداخل» it sharpens: it was pressed from our side */}
          {pScale > 0 && (
            <g transform={`translate(560 760)`} fill={inside ? '#f2dade' : '#d8c4c8'} filter={inside ? undefined : 'url(#h11fog)'}>
              <Hand s={pScale} o={inside ? 0.32 : 0.17} />
              {inside && Array.from({length: 5}, (_, i) => (
                <line key={i} x1={-60 + i * 34} y1={110 * pScale} x2={-60 + i * 34 + 2} y2={110 * pScale + interpolate(f, [B.inside, B.inside + 60], [0, 120 + i * 30], clamp)}
                  stroke="#f2dade" strokeWidth="5" opacity="0.35" />
              ))}
            </g>
          )}
          {/* knock ripple */}
          {since < 14 && <circle cx="560" cy="760" r={40 + since * 26} fill="none" stroke={RED} strokeWidth="5" opacity={(1 - since / 14) * 0.7} />}
          {/* reflection: someone tall standing in the room behind you, hand raised to the glass */}
          <g opacity={reflect * 0.7}>
            <path d="M300 1500 Q290 1120 370 1020 Q450 1120 440 1500 Z" fill="#000" />
            <ellipse cx="370" cy="960" rx="44" ry="58" fill="#000" />
            <path d="M420 1080 Q500 920 548 800" stroke="#000" strokeWidth="34" strokeLinecap="round" fill="none" />
            <circle cx="356" cy="956" r="6" fill={RED} style={{filter: 'drop-shadow(0 0 8px #ff1a33)'}} />
            <circle cx="386" cy="956" r="6" fill={RED} style={{filter: 'drop-shadow(0 0 8px #ff1a33)'}} />
          </g>
        </g>
        {/* frame and cross bar */}
        <rect x="150" y="260" width="780" height="1240" fill="none" stroke="#1a0b0d" strokeWidth="34" />
        <rect x="530" y="260" width="20" height="1240" fill="#1a0b0d" />
        <rect x="150" y="1040" width="780" height="20" fill="#1a0b0d" />
        <path d="M168 280 L420 280 L168 700 Z" fill="#fff" opacity="0.035" />
      </g>
      {/* sill and floor number plate */}
      <rect x="120" y="1500" width="840" height="40" fill="#140809" />
      <text x="540" y="210" textAnchor="middle" fill={RED} opacity={0.55 + 0.25 * Math.sin(f / 9)} fontFamily="Consolas, monospace" fontWeight="700" fontSize="54" letterSpacing="10">FLOOR 10</text>
    </svg>
  );
};

export const H11Window: React.FC = () => {
  const f = useCurrentFrame();
  // camera: tight on the knock ripple (the hook), eases back to the whole window, then pushes into the print
  const sc = interpolate(f, [0, B.knock, B.nobalcony, B.print, B.inside, B.scare], [1.6, 1.35, 1.0, 1.15, 1.45, 1.7], {...clamp, easing: Easing.inOut(Easing.sin)});
  const cy = interpolate(f, [0, B.nobalcony, B.print, B.inside, B.scare], [760, 900, 820, 820, 900], {...clamp, easing: Easing.inOut(Easing.sin)});
  const cx = interpolate(f, [B.inside, B.scare], [560, 420], clamp);
  const camX = Math.min(1080 - 540 / sc, Math.max(540 / sc, cx));
  const camY = Math.min(1920 - 960 / sc, Math.max(960 / sc, cy));
  const scared = f >= B.scare && f < B.black;
  const flick = scared && rnd(f) > 0.78 ? 0.25 : 1;
  const lightning = (f > B.nobalcony + 20 && f < B.nobalcony + 24) ? 0.35 : 0;

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {f < B.scare && (
        <AbsoluteFill style={{transformOrigin: '0 0', transform: `translate(${540 - camX * sc}px, ${960 - camY * sc}px) scale(${sc})`}}>
          <Window f={f} />
          <AbsoluteFill style={{background: '#ffd8dc', opacity: lightning}} />
        </AbsoluteFill>
      )}

      {/* the scare */}
      {scared && (
        <AbsoluteFill style={{opacity: flick, background: 'radial-gradient(circle at 50% 45%, #2a0207, #000 70%)'}}>
          <div style={{position: 'absolute', left: 40, top: 240, width: 1000, height: 1300, transform: `scale(${interpolate(f, [B.scare, B.black], [1.05, 1.35], clamp)})`}}>
            <Face f={f} eye={1} />
          </div>
        </AbsoluteFill>
      )}

      {/* vignette + grain */}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,.9) 100%)', pointerEvents: 'none'}} />
      <AbsoluteFill style={{opacity: 0.07, mixBlendMode: 'screen', pointerEvents: 'none',
        backgroundImage: `repeating-radial-gradient(circle at ${rnd(f) * 100}% ${rnd(f + 3) * 100}%, rgba(255,255,255,.5) 0 1px, transparent 1px 3px)`}} />

      {/* captions */}
      {TEXT.map((t, i) => <Caption key={i} f={f} from={i === 0 ? 0 : VO[i].at - 2} to={VO[i].at + VO[i].dur + 10} text={t} red={i >= 4} size={i === 4 ? 78 : 62} />)}
      {f >= B.black && (
        <>
          <Caption f={f} from={B.black + 2} to={H11_FRAMES} text="الليلة القادمة… آثار أقدام مبلّلة عند سريري 👣" y={780} red size={56} />
          <div style={{position: 'absolute', top: 1080, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: 44,
            opacity: interpolate(f, [B.black + 26, B.black + 36], [0, 1], clamp)}}>
            <span style={{background: '#ffd35a', color: '#140406', borderRadius: 24, padding: '6px 30px'}}>🔔 اشترك لتصلك قصة الليلة القادمة</span>
          </div>
        </>
      )}

      {/* sound */}
      <Snd name="wind" at={0} dur={B.silence} vol={0.25} loop />
      <Snd name="drone" at={0} dur={B.silence} vol={0.28} loop />
      {KNOCKS.map((k, i) => <Snd key={`k${i}`} name="knock" at={k} dur={20} vol={0.55} />)}
      <Snd name="creak" at={B.nobalcony + 20} dur={30} vol={0.3} />
      {Array.from({length: 4}, (_, i) => <Snd key={`h${i}`} name="heartbeat" at={B.inside + i * 22} dur={24} vol={0.4} />)}
      <Snd name="sting" at={B.scare} dur={90} vol={0.6} />
      <Snd name="flicker" at={B.scare + 2} dur={20} vol={0.4} />
      <Snd name="drone" at={B.black} dur={H11_FRAMES - B.black} vol={0.18} />
      {VO.map((v) => (
        <Sequence key={v.src} from={v.at} durationInFrames={v.dur + 8} layout="none"><Audio src={staticFile(v.src)} volume={1} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
