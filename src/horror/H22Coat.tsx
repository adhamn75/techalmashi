import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import TL from './H22Coat.timeline.json';
import {Face} from './HoodedFace';

// Horror ep 22 — «المعطف». My coat behind the door is breathing. "It only looks like a man." I lift it off…
// the coat drops, and the man stays standing.
// Look (unlike ep 21's black screen): a tall slice of a bedroom door lit only by lightning through unseen blinds
// (slatted violet-grey bars that slam on and off), the coat as one big silhouette; a first-person hand takes it.
// Scare: the standing shape lifts its head and the hooded face rushes in. Voice: Hamed +18 %, −22 Hz. Never gore.

const RED = '#ff1a33';
const FONT = 'Cairo, sans-serif';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H22_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const TEXT = ['معطفي خلف الباب… يتنفّس', 'قلت: إنّه يشبه رجلًا فقط', 'نهضتُ… ورفعتُ المعطف', 'سقط المعطف… وبقي الرجل واقفًا'];
const rnd = (n: number) => {const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x);};

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={Math.round(at)} durationInFrames={Math.max(1, dur)} layout="none"><Audio src={staticFile(`sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1630, size = 60}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [from === 0 ? 1 : 0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#e6e0f0', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000, 0 0 6px #000'}}>{text}</div>
  );
};

// lightning: a double flash at chosen frames
const bolt = (f: number, at: number) => {
  const d = f - at;
  if (d < 0 || d > 26) return 0;
  return d < 3 ? 1 : d < 6 ? 0.15 : d < 9 ? 0.85 : interpolate(d, [9, 26], [0.6, 0], clamp);
};

const COAT = 'M540 430 C470 430 455 500 462 560 C380 590 320 640 300 760 L250 1180 C245 1215 300 1225 312 1190 L372 900 L360 1420 C420 1450 480 1425 540 1440 C600 1425 660 1450 720 1420 L708 900 L768 1190 C780 1225 835 1215 830 1180 L780 760 C760 640 700 590 618 560 C625 500 610 430 540 430 Z';
const MAN = 'M540 440 C462 440 448 545 478 605 C400 630 345 690 335 820 L318 1180 L370 1190 L400 920 L415 1220 L430 1640 L515 1640 L540 1290 L565 1640 L650 1640 L665 1220 L680 920 L710 1190 L762 1180 L745 820 C735 690 680 630 602 605 C632 545 618 440 540 440 Z';

export const H22Coat: React.FC = () => {
  const f = useCurrentFrame();
  const scare = f >= B.scare && f < B.black;
  const flashes = [0, VO[1].at + 6, VO[2].at + 40, B.fall + 10, B.silence - 16];
  const light = Math.max(...flashes.map((a) => bolt(f, a)));
  // the coat breathes until the voice explains it away, then stops… then falls
  const amp = f < VO[1].at + 6 ? 1 : f < VO[2].at ? 0.25 : 0;
  const breathe = 1 + Math.sin(f / 7) * 0.035 * amp;
  const reach = interpolate(f, [VO[2].at, B.fall], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const away = interpolate(f, [B.fall + 6, B.fall + 24], [0, 1], clamp);
  const fall = interpolate(f, [B.fall, B.fall + 20], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
  const head = interpolate(f, [B.silence - 18, B.silence], [26, 0], clamp);
  const zoom = interpolate(f, [0, VO[2].at, B.fall, B.fall + 20, B.silence], [1.12, 1.2, 1.3, 1.02, 1.28], {...clamp, easing: Easing.inOut(Easing.sin)});
  const push = scare ? interpolate(f, [B.scare, B.scare + 7], [0.6, 1.7], {...clamp, easing: Easing.out(Easing.back(1.4))}) : 1;
  const shake = (scare && f < B.scare + 14) || (f >= B.fall + 18 && f < B.fall + 24) ? (rnd(f) - 0.5) * 30 : 0;
  const base = 0.3 + light * 0.7;

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {f < B.black && (
        <AbsoluteFill style={{transformOrigin: '540px 820px', transform: `translateX(${shake}px) scale(${zoom})`}}>
          <svg width={1080} height={1920} viewBox="0 0 1080 1920">
            <rect width="1080" height="1920" fill="#07050b" />
            <g opacity={base}>
              {/* wall + door */}
              <rect width="1080" height="1760" fill="#2a2338" />
              <rect x="150" y="150" width="780" height="1610" fill="#4a405c" stroke="#120e19" strokeWidth="26" />
              <rect x="230" y="240" width="620" height="560" fill="none" stroke="#2a2338" strokeWidth="14" />
              <rect x="230" y="900" width="620" height="760" fill="none" stroke="#2a2338" strokeWidth="14" />
              <circle cx="860" cy="1010" r="30" fill="#9b8f6a" />
              <path d="M0 1760 H1080 V1920 H0 Z" fill="#171220" />
            </g>
            {/* lightning through blinds */}
            <g opacity={0.12 + light * 0.55} style={{mixBlendMode: 'screen'}}>
              {Array.from({length: 9}, (_, i) => <path key={i} d={`M-80 ${180 + i * 190} L1160 ${-80 + i * 190} L1160 ${0 + i * 190} L-80 ${260 + i * 190} Z`} fill="#8f84c4" />)}
            </g>
            {/* hook */}
            <path d="M540 330 V390 Q540 425 575 420" stroke="#c9bfa0" strokeWidth="16" fill="none" strokeLinecap="round" opacity={0.4 + light * 0.6} />
            {/* the man, behind the coat all along */}
            <g opacity={f >= B.fall ? 1 : 0}>
              <path d={MAN} fill="#000" stroke="#4a0010" strokeWidth="6" transform={`rotate(${head * 0.12} 540 900)`} />
              <g opacity={interpolate(f, [B.silence - 22, B.silence - 8], [0, 1], clamp)}>
                {[512, 568].map((x) => <circle key={x} cx={x} cy={528 + head} r="10" fill={RED} style={{filter: 'drop-shadow(0 0 20px #ff1a33)'}} />)}
              </g>
            </g>
            {/* the coat */}
            <g transform={`translate(${fall * -150} ${fall * 1060}) rotate(${fall * -46} 540 600)`}>
              <g transform={`translate(540 760) scale(${breathe} ${1 + (breathe - 1) * 0.35}) translate(-540 -760)`}>
                <path d={COAT} fill="#0b0810" stroke={light > 0.3 ? '#a89fd0' : '#3b3150'} strokeWidth="7" />
                <path d="M540 560 L500 640 L540 720 L580 640 Z M540 720 V1420" stroke="#2e263d" strokeWidth="9" fill="none" />
                {[820, 960, 1100].map((y) => <circle key={y} cx="566" cy={y} r="11" fill="#3b3150" />)}
              </g>
            </g>
            {/* my hand, from the bottom of the frame */}
            {f >= VO[2].at && away < 1 && (
              <g transform={`translate(${(1 - reach) * 360 - reach * 150 + away * 560} ${(1 - reach) * 900 - reach * 60 + away * 860})`}>
                <path d="M760 1920 L690 1000 C688 950 660 880 640 820 C630 790 660 772 678 800 L720 868 L712 760 C710 724 748 720 756 754 L778 862 L790 770 C796 736 832 742 830 776 L824 880 L852 812 C868 784 900 800 888 832 L850 960 C850 1010 840 1040 850 1070 L980 1920 Z" fill="#120d14" stroke="#6b5d86" strokeWidth="5" />
              </g>
            )}
          </svg>
          {scare && (
            <div style={{position: 'absolute', left: 300, top: 360, width: 480, height: 624, WebkitMaskImage: 'linear-gradient(180deg, #000 72%, transparent 99%)', maskImage: 'linear-gradient(180deg, #000 72%, transparent 99%)', transform: `scale(${push})`}}><Face f={f} /></div>
          )}
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 42%, transparent 35%, rgba(0,0,0,.93) 100%)', pointerEvents: 'none'}} />
      <AbsoluteFill style={{opacity: 0.08, mixBlendMode: 'screen', pointerEvents: 'none',
        backgroundImage: `repeating-radial-gradient(circle at ${rnd(f) * 100}% ${rnd(f + 3) * 100}%, rgba(235,230,255,.5) 0 1px, transparent 1px 3px)`}} />
      {scare && <AbsoluteFill style={{background: RED, opacity: 0.22 * rnd(f + 2), mixBlendMode: 'multiply'}} />}

      {TEXT.map((t, i) => <Caption key={i} f={f} from={i === 0 ? 0 : VO[i].at - 2} to={Math.min(VO[i].at + VO[i].dur + 10, B.scare - 1)} text={t} red={i === 3} />)}
      {f >= B.black && (
        <>
          <Caption f={f} from={B.black + 2} to={H22_FRAMES + 8} text="القادمة: صندوق موسيقى… يعزف اسمي" y={760} red size={52} />
          <div style={{position: 'absolute', top: 1100, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: 44,
            opacity: interpolate(f, [B.black + 26, B.black + 36], [0, 1], clamp)}}>
            <span style={{background: '#ffd35a', color: '#140406', borderRadius: 24, padding: '6px 30px'}}>🔔 اشترك لتصلك قصة الليلة القادمة</span>
          </div>
        </>
      )}

      <Snd name="wind" at={0} dur={B.silence} vol={0.2} loop />
      <Snd name="drone" at={0} dur={B.silence} vol={0.2} loop />
      <Snd name="breath" at={0} dur={VO[1].at + 6} vol={0.5} loop />
      {flashes.slice(0, 4).map((a) => <Snd key={a} name="flicker" at={a} dur={20} vol={0.35} />)}
      <Snd name="creak" at={VO[2].at} dur={60} vol={0.4} />
      <Snd name="knock" at={B.fall + 18} dur={20} vol={0.45} />
      {Array.from({length: 2}, (_, i) => <Snd key={`h${i}`} name="heartbeat" at={VO[3].at + 40 + i * 22} dur={24} vol={0.45} />)}
      <Snd name="sting" at={B.scare} dur={90} vol={0.6} />
      <Snd name="drone" at={B.black} dur={H22_FRAMES - B.black} vol={0.18} />
      {VO.map((v) => (
        <Sequence key={v.src} from={v.at} durationInFrames={v.dur + 8} layout="none"><Audio src={staticFile(v.src)} volume={1} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
