import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import {Caption, V} from '../shared/Caption';
import TL from './Fam14Uniform.timeline.json';

// Family ep 14: school-uniform photo. Stickman line-art on pastel yellow paper: a stick child posts a photo,
// three clues get circled (logo, school name, location), a stranger stick figure walks to the school gate,
// then the fix (cover the logo, location off, private) and the outro.

const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
export const FAMILY14_FRAMES = TL.frames;
const A = VOICE.map((v) => v.at);
const YEL = '#ffd23f', GRN = '#22d27a', RED = '#ff4d4d', BLUE = '#4b8bff', INK = '#1d1d2b';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const Stick: React.FC<{x: number; y: number; s?: number; hat?: boolean; bag?: boolean; shirt?: string; walk?: number; arm?: number; flip?: boolean}> = ({x, y, s = 1, hat, bag, shirt, walk = 0, arm = 0, flip}) => {
  const sw = Math.sin(walk) * 22;
  return (
    <svg width={260} height={420} viewBox="0 0 260 420" style={{position: 'absolute', left: x, top: y, scale: `${flip ? -s : s} ${s}`, transformOrigin: '130px 210px', overflow: 'visible'}}>
      <g stroke={INK} strokeWidth={10} strokeLinecap="round" fill="none">
        <circle cx={130} cy={70} r={46} fill="#fff" />
        <line x1={130} y1={116} x2={130} y2={250} />
        <line x1={130} y1={150} x2={70 - arm * 10} y2={210 - arm * 50} /><line x1={130} y1={150} x2={190 + arm * 20} y2={210 - arm * 70} />
        <line x1={130} y1={250} x2={80 + sw} y2={390} /><line x1={130} y1={250} x2={180 - sw} y2={390} />
        {shirt && <rect x={96} y={122} width={68} height={110} rx={10} fill={shirt} stroke={INK} strokeWidth={8} />}
        {bag && <rect x={150} y={130} width={50} height={86} rx={14} fill={RED} />}
        {hat && <path d="M78 52 H182 M98 52 L108 14 H152 L162 52" fill={INK} />}
        <circle cx={114} cy={68} r={4} fill={INK} /><circle cx={148} cy={68} r={4} fill={INK} />
        <path d={hat ? 'M112 92 Q130 80 148 92' : 'M112 88 Q130 104 148 88'} />
      </g>
    </svg>
  );
};

const Photo: React.FC<{p: number; covered: number; loc: boolean}> = ({p, covered, loc}) => (
  <div style={{position: 'absolute', left: 110, right: 110, top: 360, height: 760, background: '#fff', border: `10px solid ${INK}`, borderRadius: 36, boxShadow: '14px 14px 0 rgba(0,0,0,.18)', scale: `${p}`, overflow: 'hidden'}}>
    <div style={{position: 'absolute', inset: 0, background: '#bfe3ff'}} />
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 170, background: '#8fd18f'}} />
    <div style={{position: 'absolute', left: 60, top: 110, width: 260, height: 300, background: '#e8b27a', border: `8px solid ${INK}`}}>
      <div dir="rtl" style={{fontFamily: FONT, fontWeight: 900, fontSize: 34, textAlign: 'center', marginTop: 14, color: INK}}>مدرسة النور</div>
    </div>
    <Stick x={380} y={170} s={1.05} bag shirt="#fff6a8" />
    <div style={{position: 'absolute', left: 462, top: 330, width: 64, height: 64, borderRadius: 32, background: BLUE, border: `6px solid ${INK}`, fontFamily: FONT, fontWeight: 900, fontSize: 36, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>ن</div>
    {covered > 0 && <div style={{position: 'absolute', left: 452, top: 320, width: 84, height: 84, borderRadius: 42, background: '#ff9ad0', border: `6px solid ${INK}`, fontSize: 54, textAlign: 'center', lineHeight: '78px', scale: `${covered}`}}>😎</div>}
    {loc && <div dir="rtl" style={{position: 'absolute', left: 30, bottom: 24, background: 'rgba(255,255,255,.95)', border: `6px solid ${INK}`, borderRadius: 24, padding: '4px 26px', fontFamily: FONT, fontWeight: 900, fontSize: 40}}>📍 حيّ الزهور</div>}
  </div>
);

const Ring: React.FC<{x: number; y: number; w: number; h: number; t: number; label: string}> = ({x, y, w, h, t, label}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, height: h, border: `10px solid ${RED}`, borderRadius: '50%', opacity: t, scale: `${0.6 + 0.4 * t}`}}>
    <div dir="rtl" style={{position: 'absolute', top: -70, left: '50%', translate: '-50% 0', whiteSpace: 'nowrap', background: RED, color: '#fff', fontFamily: FONT, fontWeight: 900, fontSize: 40, borderRadius: 22, padding: '2px 24px'}}>{label}</div>
  </div>
);

export const Family14Uniform: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sp = (f: number, d = 14) => spring({frame: frame - f, fps, config: {damping: d}});
  const photo = sp(A[0] + 6);
  const r1 = sp(A[1] + 4), r2 = sp(A[1] + 34), r3 = sp(A[1] + 62);
  const walkT = interpolate(frame, [A[2], A[2] + 100], [0, 1], {...clamp, easing: Easing.inOut(Easing.quad)});
  const cover = sp(A[3] + 8), outro = sp(A[4], 15);
  const showPhoto = frame < A[2] || (frame >= A[3] && frame < A[4]);
  const scene = frame >= A[2] && frame < A[3];
  const fixed = frame >= A[3];
  return (
    <AbsoluteFill style={{background: '#fff4b8', overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(29,29,43,.07) 2px, transparent 2px)', backgroundSize: '100% 70px'}} />
      {showPhoto && <Photo p={frame < A[2] ? photo : 1} covered={fixed ? cover : 0} loc={!fixed || frame < A[3] + 40} />}
      {frame >= A[1] && frame < A[2] && <><Ring x={528} y={640} w={170} h={170} t={r1} label="الشعار" /><Ring x={165} y={470} w={300} h={110} t={r2} label="اسم المدرسة" /><Ring x={130} y={1000} w={370} h={105} t={r3} label="الموقع" /></>}
      {frame < A[1] && <div dir="rtl" style={{position: 'absolute', top: 1180, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 64, color: INK}}>📤 نُشرت علنًا!</div>}
      {scene && (
        <>
          <div style={{position: 'absolute', left: 560, top: 520, width: 380, height: 360, background: '#e8b27a', border: `10px solid ${INK}`}}><div dir="rtl" style={{fontFamily: FONT, fontWeight: 900, fontSize: 48, textAlign: 'center', marginTop: 30}}>مدرسة النور</div><div style={{position: 'absolute', left: 140, bottom: 0, width: 100, height: 150, background: INK}} /></div>
          <div style={{position: 'absolute', left: 80, top: 940, width: 920, height: 12, background: INK}} />
          <Stick x={-120 + walkT * 560} y={640} s={1.15} hat walk={frame / 3} />
          <div dir="rtl" style={{position: 'absolute', left: 60 + walkT * 560, top: 600, fontFamily: FONT, fontWeight: 900, fontSize: 44, background: INK, color: '#fff', borderRadius: 20, padding: '0 22px'}}>غريب</div>
          <div style={{position: 'absolute', left: 100, top: 1060, fontFamily: FONT, fontWeight: 900, fontSize: 64, color: INK}} dir="rtl">🕑 ٢:٠٠ ظهرًا… ينتهي الدوام</div>
        </>
      )}
      {fixed && frame < A[4] && (
        <div dir="rtl" style={{position: 'absolute', left: 90, right: 90, top: 1170, display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FONT, fontWeight: 900, fontSize: 50, color: INK}}>
          {[['🙂 غطِّ الشعار', 0], ['📍 أوقف الموقع', 30], ['🔒 ليست علنية', 56]].map(([t, d]) => <div key={t as string} style={{background: '#fff', border: `8px solid ${GRN}`, borderRadius: 26, padding: '4px 28px', opacity: sp(A[3] + (d as number)), translate: `${(1 - sp(A[3] + (d as number))) * 200}px 0`}}>{t} ✓</div>)}
        </div>
      )}
      {frame >= A[4] && (
        <div dir="rtl" style={{position: 'absolute', top: 420, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, opacity: outro, translate: `0 ${(1 - outro) * 80}px`}}>
          <div style={{display: 'inline-block', background: INK, color: '#fff', borderRadius: 30, padding: '16px 40px', fontSize: 52}}>📤 أرسلها لكل أب وأم</div><br />
          <div style={{display: 'inline-block', fontSize: 44, color: INK, background: YEL, border: `6px solid ${INK}`, borderRadius: 26, padding: '6px 32px', marginTop: 22}}>🔔 اشترك ليصلك الدرس التالي</div><br />
          <div style={{display: 'inline-block', fontSize: 42, color: '#fff', background: BLUE, borderRadius: 26, padding: '6px 30px', marginTop: 20}}>الحلقة القادمة: التحقق بخطوتين 🔐</div>
        </div>
      )}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', translate: frame >= A[4] ? '-340px 760px' : '380px 800px'}}>
        <Mokaab frame={frame} scale={0.2} y={0} mood={frame < A[3] ? 'shock' : 'happy'} wave={frame >= A[4] ? 1 : 0} lookX={-0.6} talk={speaking(LINES, frame)} rings={false} />
      </div>
      {VOICE.map((v, i) => <Caption key={v.src} line={v} top={110} accent={i === 0 ? '#ff7b7b' : i === 3 ? '#7dffb5' : i === 4 ? '#8fb3ff' : YEL} bg="rgba(29,29,43,.88)" />)}
      {frame >= A[4] && <div dir="rtl" style={{position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 32, color: INK}}>احمِ أطفالك على الإنترنت · الحلقة 14 · تك عالماشي · خلّيك ذكي!</div>}
      <VoiceTrack lines={LINES} />
      <Sfx name="whoosh" at={A[0] + 4} volume={0.45} /><Sfx name="buzz" at={A[1] + 4} volume={0.35} /><Sfx name="tick" at={A[1] + 34} volume={0.35} /><Sfx name="tick" at={A[1] + 62} volume={0.35} />
      <Sfx name="whoosh" at={A[2]} volume={0.4} /><Sfx name="ding" at={A[3] + 8} volume={0.5} /><Sfx name="ding" at={A[3] + 38} volume={0.4} /><Sfx name="ding" at={A[4] + 2} volume={0.4} />
    </AbsoluteFill>
  );
};
