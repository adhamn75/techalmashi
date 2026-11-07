import React from 'react';
import {AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';

// Family-safety series palette (distinct from the Excel series)
const NAVY = '#0b1324';
const BLUE = '#3a86ff';
const RED = '#ff4d4f';
const YELLOW = '#ffd166';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const MSGS = [
  {text: 'مبروووك!! ربحت آيفون', at: 14},
  {text: 'العرض بس لليوم!', at: 34},
  {text: 'win-now.prize/gift', at: 54, link: true},
  {text: 'دخّل رقم بطاقة ماما لنبعتلك ياه', at: 74},
];
// which message each warning sign points at
const SIGNS = [
  {n: 1, title: 'مستعجلة', sub: '"بس لليوم" حتى ما تفكّر', msg: 1},
  {n: 2, title: 'أحلى من إنها تكون حقيقية', sub: 'ما حدا بيوزّع آيفونات ببلاش', msg: 0},
  {n: 3, title: 'بدها رابط أو معلومات', sub: 'كلمة سر، بطاقة، عنوان', msg: 3},
];

const Phone: React.FC<{f: number; highlight: number | null; scale: number}> = ({f, highlight, scale}) => (
  <div style={{position: 'absolute', top: 300, left: '50%', width: 660, height: 1040, marginLeft: -330,
    transform: `scale(${scale})`, transformOrigin: 'top center', background: '#111827', borderRadius: 70,
    padding: 18, boxSizing: 'border-box', boxShadow: '0 40px 90px rgba(0,0,0,0.55)'}}>
    <div style={{width: '100%', height: '100%', borderRadius: 54, overflow: 'hidden', background: '#e8edf3', position: 'relative'}}>
      {/* chat header */}
      <div style={{height: 150, background: '#1f2937', display: 'flex', alignItems: 'flex-end', padding: '0 34px 24px',
        gap: 20, direction: 'rtl', boxSizing: 'border-box'}}>
        <div style={{width: 76, height: 76, borderRadius: 38, background: '#9ca3af', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 44, color: 'white'}}>؟</div>
        <div style={{fontFamily: FONT, fontWeight: 700, color: 'white', fontSize: 40}}>رقم غريب</div>
      </div>
      {/* messages */}
      <div style={{padding: '40px 30px', direction: 'rtl', display: 'flex', flexDirection: 'column', gap: 26}}>
        {MSGS.map((m, i) => {
          const p = spring({frame: f - m.at, fps: 30, config: {damping: 13}});
          if (f < m.at) return null;
          const hl = highlight === i;
          const dim = highlight !== null && !hl;
          return (
            <div key={i} style={{alignSelf: 'flex-start', maxWidth: 520, background: 'white', borderRadius: 30,
              borderTopRightRadius: 6, padding: '20px 30px', fontFamily: m.link ? 'monospace' : FONT,
              fontWeight: m.link ? 400 : 700, fontSize: m.link ? 36 : 42, color: m.link ? '#1d4ed8' : '#111',
              textDecoration: m.link ? 'underline' : 'none', direction: m.link ? 'ltr' : 'rtl',
              transform: `scale(${p * (hl ? 1.06 : 1)})`, transformOrigin: 'right center',
              opacity: dim ? 0.35 : 1, outline: hl ? `6px solid ${RED}` : 'none', outlineOffset: 4,
              boxShadow: '0 4px 10px rgba(0,0,0,0.08)'}}>
              {m.text}
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

// ---------- 1. The message arrives ----------
const Arrive: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ph = spring({frame: f, fps, config: {damping: 14}});
  const cap = f < 60 ? 'ابنك وصلتو هالرسالة...' : 'وكبس؟ 😬'.replace(' 😬', '');
  const capIn = interpolate(f % 60, [0, 8], [0, 1], clamp);
  // the child's finger moving toward the link
  const finger = interpolate(f, [86, 112], [0, 1], clamp);
  const stamp = spring({frame: f - 112, fps, config: {damping: 8}});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 110, width: '100%', textAlign: 'center', direction: 'rtl',
        fontFamily: FONT, fontWeight: 900, fontSize: 84, color: 'white', opacity: f < 120 ? capIn : 1}}>{cap}</div>
      <Phone f={f} highlight={null} scale={0.92 * ph} />
      {f > 86 && f < 140 && (
        <div style={{position: 'absolute', top: 1500 - finger * 680, left: 300 + finger * 120, width: 110, height: 110,
          borderRadius: 55, background: 'rgba(255,209,102,0.85)', border: '6px solid white'}} />
      )}
      {f >= 112 && (
        <div style={{position: 'absolute', top: 760, left: '50%', transform: `translateX(-50%) rotate(-12deg) scale(${stamp})`,
          border: `12px solid ${RED}`, color: RED, fontFamily: FONT, fontWeight: 900, fontSize: 150, padding: '0 50px',
          borderRadius: 30, background: 'rgba(11,19,36,0.85)', direction: 'rtl'}}>نصب!</div>
      )}
      <AbsoluteFill>
        <Mokaab frame={f} scale={0.4} y={-2.85} mood={f < 112 ? 'happy' : 'shock'} talk={f >= 112 ? 1 : 0} outfit="shield" />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- 2. Three warning signs ----------
const Signs: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const per = 55;
  const idx = Math.min(SIGNS.length - 1, Math.floor(f / per));
  const s = SIGNS[idx];
  const cardIn = spring({frame: f - idx * per, fps, config: {damping: 12}});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 110, width: '100%', textAlign: 'center', direction: 'rtl',
        fontFamily: FONT, fontWeight: 900, fontSize: 84, color: 'white'}}>
        3 علامات <span style={{color: RED}}>النصب</span>
      </div>
      <Phone f={200} highlight={s.msg} scale={0.72} />
      <div style={{position: 'absolute', top: 1110, left: 60, right: 60, background: 'white', borderRadius: 40,
        padding: '34px 40px', direction: 'rtl', display: 'flex', gap: 30, alignItems: 'center',
        transform: `translateY(${(1 - cardIn) * 120}px)`, opacity: cardIn, boxShadow: '0 20px 50px rgba(0,0,0,0.4)'}}>
        <div style={{minWidth: 120, height: 120, borderRadius: 60, background: RED, color: 'white', fontFamily: FONT,
          fontWeight: 900, fontSize: 80, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{s.n}</div>
        <div>
          <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 58, color: NAVY, lineHeight: 1.3}}>{s.title}</div>
          <div style={{fontFamily: FONT, fontWeight: 700, fontSize: 42, color: '#4b5563', marginTop: 6}}>{s.sub}</div>
        </div>
      </div>
      <div style={{position: 'absolute', top: 1500, width: '100%', display: 'flex', justifyContent: 'center', gap: 24}}>
        {SIGNS.map((_, i) => (
          <div key={i} style={{width: i === idx ? 70 : 22, height: 22, borderRadius: 11, background: i <= idx ? RED : '#334155'}} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---------- 3. The house rule + share CTA ----------
const Rule: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = spring({frame: f, fps, config: {damping: 11}});
  const b = spring({frame: f - 18, fps, config: {damping: 13}});
  const c = spring({frame: f - 50, fps, config: {damping: 13}});
  return (
    <AbsoluteFill>
      <AbsoluteFill><Mokaab frame={f} scale={a * 0.7} y={1.55} mood="happy" wave={1} talk={f < 45 ? 1 : 0} outfit="shield" /></AbsoluteFill>
      <div style={{position: 'absolute', top: 960, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900}}>
        <div style={{fontSize: 56, color: YELLOW, transform: `scale(${a})`}}>قاعدة البيت</div>
        <div style={{fontSize: 64, color: 'white', marginTop: 16, lineHeight: 1.4, opacity: b,
          transform: `translateY(${(1 - b) * 40}px)`, padding: '0 60px'}}>
          أي جائزة أو رابط؟<br />فرجيه لماما أو بابا <span style={{color: BLUE}}>قبل</span> ما تكبس
        </div>
        <div style={{marginTop: 70, display: 'inline-block', background: BLUE, color: 'white', fontSize: 52,
          padding: '18px 46px', borderRadius: 60, opacity: c, transform: `scale(${0.8 + 0.2 * c})`}}>
          ابعتو لغروب العيلة
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const FAMILY01_FRAMES = 150 + 165 + 110;

export const Family01Scam: React.FC = () => (
  <AbsoluteFill style={{background: `radial-gradient(circle at 50% 30%, #16233f 0%, ${NAVY} 70%)`}}>
    <Sequence durationInFrames={150}><Arrive /></Sequence>
    <Sequence from={150} durationInFrames={165}><Signs /></Sequence>
    <Sequence from={315} durationInFrames={110}><Rule /></Sequence>
    {MSGS.map((m) => <Sfx key={m.at} name="blip" at={m.at} />)}
    <Sfx name="buzz" at={112} volume={1.2} />
    <Sfx name="whoosh" at={148} />
    {SIGNS.map((_, i) => <Sfx key={i} name="pop" at={150 + i * 55} />)}
    <Sfx name="whoosh" at={313} />
    <Sfx name="ding" at={333} />
  </AbsoluteFill>
);
