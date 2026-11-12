import React from 'react';
import {AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import TL from './Fam07Purchase.timeline.json';

// Family ep 7: the in-app purchase trap — the child taps «اشترِ الآن» again and again, the card saved on the
// phone pays without asking anyone, and the parent finds a $500 bill. Fix: every purchase needs the parent.
// Look: LIGHT theme for the first time in the series — a cream bank-statement page with ink-black type and
// red amounts, then a candy-purple game shop, then two settings screens side by side (iPhone / Android).

type Word = {w: string; start: number; end: number};
type V = {src: string; at: number; sec: number; words: Word[]};
const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const B = TL.beats;
export const FAMILY07_FRAMES = TL.frames;

const CREAM = '#f6f0e4';
const INK = '#1b1a17';
const RED = '#e0262f';
const GREEN = '#17a34a';
const GRAPE = '#5b21b6';
const CANDY = '#ff4fa3';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ltr: React.CSSProperties = {direction: 'ltr', unicodeBidi: 'isolate', display: 'inline-block'};

const Caption: React.FC<{line: V; top: number; accent: string; dark?: boolean}> = ({line, top, accent, dark}) => {
  const frame = useCurrentFrame();
  const t = (frame - line.at) / 30;
  if (t < -0.1 || t > line.sec + 0.4) return null;
  const base = dark ? INK : '#fff';
  return (
    <div dir="rtl" lang="ar" style={{position: 'absolute', top, left: 40, right: 40, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 68, lineHeight: 1.4,
      opacity: interpolate(t, [line.sec + 0.15, line.sec + 0.4], [1, 0], clamp)}}>
      {line.words.map((w, i) => {
        const said = t >= w.start;
        const on = said && t < (line.words[i + 1]?.start ?? w.end + 0.3);
        return (
          <span key={i} style={{display: 'inline-block', margin: '0 0.16em', color: on ? accent : said ? base : dark ? 'rgba(27,26,23,.25)' : 'rgba(255,255,255,.3)',
            translate: `0 ${said ? 0 : 12}px`, scale: on ? '1.08' : '1'}}>{w.w}</span>
        );
      })}
    </div>
  );
};

// ---------- the bank statement: charges pile up from frame 0 ----------
const CHARGES = [
  {n: 'حزمة الجواهر الكبرى', a: 99.99},
  {n: 'تذكرة الموسم الذهبية', a: 49.99},
  {n: 'صندوق الكنز الأسطوري', a: 99.99},
  {n: 'حزمة الجواهر الكبرى', a: 99.99},
  {n: '٥٠٠٠ عملة ذهبية', a: 49.99},
  {n: 'صندوق الكنز الأسطوري', a: 99.99},
];
const Statement: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const shown = CHARGES.filter((_, i) => frame >= i * 9 - 18);
  const total = shown.reduce((s, c) => s + c.a, 0);
  const totalShown = interpolate(frame, [0, 30], [199.97, 499.94], {...clamp, easing: Easing.out(Easing.quad)});
  const stamp = spring({frame: frame - 44, fps, config: {damping: 9, mass: 0.7}});
  return (
    <AbsoluteFill style={{background: CREAM}}>
      <div style={{position: 'absolute', top: 90, left: 70, right: 70}}>
        <div dir="rtl" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: `6px solid ${INK}`, paddingBottom: 14}}>
          <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 58, color: INK}}>كشف حساب البطاقة 💳</div>
          <div style={{fontFamily: 'Consolas, monospace', fontSize: 34, color: '#7a7466', ...ltr}}>•••• 4821</div>
        </div>
        <div dir="rtl" style={{fontFamily: FONT, fontWeight: 700, fontSize: 34, color: '#7a7466', marginTop: 10}}>اليوم · متجر التطبيقات · لعبة ابنك</div>
        <div style={{marginTop: 26}}>
          {shown.map((c, i) => {
            const a = i < 3 ? 1 : spring({frame: frame - (i * 9 - 18), fps, config: {damping: 15}});
            return (
              <div key={i} dir="rtl" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 104, borderBottom: '2px dashed #cfc6b2',
                translate: `${(1 - a) * -260}px 0`, opacity: a}}>
                <div style={{fontFamily: FONT, fontWeight: 700, fontSize: 44, color: INK}}>🎮 {c.n}</div>
                <div style={{fontFamily: 'Consolas, monospace', fontWeight: 700, fontSize: 48, color: RED, ...ltr}}>-${c.a.toFixed(2)}</div>
              </div>
            );
          })}
        </div>
        <div dir="rtl" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 30, padding: '24px 30px', background: INK, borderRadius: 24}}>
          <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 50, color: '#fff'}}>المجموع</div>
          <div style={{fontFamily: 'Consolas, monospace', fontWeight: 700, fontSize: 84, color: '#ff5a5f', ...ltr}}>-${(total > 0 ? totalShown : 0).toFixed(2)}</div>
        </div>
      </div>
      <div dir="rtl" style={{position: 'absolute', top: 1180, width: '100%', textAlign: 'center'}}>
        <span style={{display: 'inline-block', fontFamily: FONT, fontWeight: 900, fontSize: 80, color: RED, border: `9px solid ${RED}`, borderRadius: 26, padding: '0 40px',
          rotate: '-6deg', scale: `${interpolate(stamp, [0, 1], [2.2, 1])}`, opacity: Math.min(1, stamp * 1.4), background: 'rgba(246,240,228,.9)'}}>في 10 دقائق!</span>
      </div>
    </AbsoluteFill>
  );
};

// ---------- the game shop: tap, tap, tap ----------
const Shop: React.FC = () => {
  const frame = useCurrentFrame(); // local, starts at B.tap
  const {fps} = useVideoConfig();
  const taps = [14, 40, 62, 80, 96, 110];
  const lastTap = [...taps].reverse().find((t) => t <= frame) ?? -99;
  const pressed = frame - lastTap < 5;
  const bought = taps.filter((t) => frame >= t + 4).length;
  const saved = spring({frame: frame - 70, fps, config: {damping: 13}});
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 50% 30%, #8b5cf6 0%, ${GRAPE} 55%, #2e1065 100%)`}}>
      {/* sparkles */}
      {Array.from({length: 18}, (_, i) => (
        <div key={i} style={{position: 'absolute', left: (i * 211) % 1040, top: (i * 337) % 1500, fontSize: 30 + (i % 3) * 14, opacity: 0.25 + 0.25 * Math.sin(frame / 7 + i)}}>✦</div>
      ))}
      <div style={{position: 'absolute', top: 110, left: 90, right: 90, borderRadius: 50, background: '#fff', padding: '36px 40px 46px', boxShadow: '0 40px 80px rgba(0,0,0,.4)'}}>
        <div dir="rtl" style={{fontFamily: FONT, fontWeight: 900, fontSize: 52, color: GRAPE, textAlign: 'center'}}>🏪 متجر اللعبة</div>
        <div style={{display: 'flex', justifyContent: 'center', margin: '30px 0 10px'}}>
          <div style={{width: 340, height: 300, borderRadius: 40, background: 'linear-gradient(160deg, #fde68a, #f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 190, rotate: `${Math.sin(frame / 6) * 4}deg`}}>🎁</div>
        </div>
        <div dir="rtl" style={{fontFamily: FONT, fontWeight: 900, fontSize: 50, color: INK, textAlign: 'center'}}>صندوق الكنز الأسطوري</div>
        <div style={{fontFamily: 'Consolas, monospace', fontWeight: 700, fontSize: 62, color: CANDY, textAlign: 'center'}}>$99.99</div>
        <div style={{margin: '24px auto 0', width: 600, height: 150, borderRadius: 75, background: pressed ? '#16a34a' : GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: FONT, fontWeight: 900, fontSize: 70, color: '#fff', scale: pressed ? '0.93' : '1', boxShadow: pressed ? '0 2px 0 #0f6b30' : '0 14px 0 #0f6b30'}}>
          اشترِ الآن
        </div>
        <div style={{position: 'absolute', left: 620, top: 600, fontSize: 130, translate: `0 ${pressed ? -20 : 20}px`}}>👆</div>
      </div>
      {/* "purchased" toasts stacking */}
      <div style={{position: 'absolute', top: 1110, left: 90, right: 90, display: 'flex', flexDirection: 'column-reverse', gap: 10, height: 230, overflow: 'hidden'}}>
        {Array.from({length: bought}, (_, i) => (
          <div key={i} dir="rtl" style={{height: 66, borderRadius: 33, background: 'rgba(255,255,255,.95)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px',
            fontFamily: FONT, fontWeight: 900, fontSize: 36, color: GREEN, flexShrink: 0}}>
            <span>✓ تمّ الشراء</span><span style={{color: RED, fontFamily: 'Consolas, monospace', ...ltr}}>-$99.99</span>
          </div>
        ))}
      </div>
      {/* the saved card: nobody asks */}
      <div dir="rtl" style={{position: 'absolute', top: 1380, left: 120, right: 120, borderRadius: 30, background: INK, padding: '18px 28px', display: 'flex', alignItems: 'center', gap: 20,
        scale: `${saved}`, opacity: saved}}>
        <span style={{fontSize: 60}}>💳</span>
        <div>
          <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 40, color: '#fff'}}>بطاقتك محفوظة في الهاتف</div>
          <div style={{fontFamily: FONT, fontWeight: 700, fontSize: 32, color: '#ff8a8f'}}>لا كلمة سرّ · لا سؤال · لا إذن</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- the fix: every purchase needs you ----------
const Fix: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = spring({frame, fps, config: {damping: 12}});
  const lock = spring({frame: frame - 16, fps, config: {damping: 8, mass: 0.6}});
  return (
    <AbsoluteFill style={{background: CREAM, alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 360, display: 'flex', alignItems: 'center', gap: 40, direction: 'ltr', scale: `${a}`}}>
        <div style={{width: 300, height: 120, borderRadius: 60, background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 50, color: '#fff'}}>اشترِ الآن</div>
        <div style={{fontSize: 80, color: INK}}>→</div>
        <div style={{width: 230, height: 230, borderRadius: 50, background: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 130, scale: `${lock}`}}>🔒</div>
      </div>
      <div dir="rtl" style={{position: 'absolute', top: 680, fontFamily: FONT, fontWeight: 900, fontSize: 64, color: INK, opacity: interpolate(frame, [20, 32], [0, 1], clamp)}}>
        طلب إذن 👨‍👩‍👦 ← <span style={{color: GREEN}}>أنت توافق</span>
      </div>
    </AbsoluteFill>
  );
};

// ---------- the two settings screens ----------
const Toggle: React.FC<{on: number}> = ({on}) => (
  <div style={{width: 110, height: 62, borderRadius: 31, background: on > 0.5 ? '#34c759' : '#d1d1d6', position: 'relative', flexShrink: 0}}>
    <div style={{position: 'absolute', top: 5, left: 5 + on * 48, width: 52, height: 52, borderRadius: 26, background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.25)'}} />
  </div>
);
const Screen: React.FC<{os: string; title: string; path: string; f: number; delay: number; dark?: boolean}> = ({os, title, path, f, delay, dark}) => {
  const {fps} = useVideoConfig();
  const a = spring({frame: f - delay, fps, config: {damping: 14}});
  const on = interpolate(f, [delay + 26, delay + 34], [0, 1], clamp);
  return (
    <div style={{width: 470, height: 760, borderRadius: 56, background: dark ? '#202124' : '#fff', border: `10px solid ${INK}`, overflow: 'hidden', translate: `0 ${(1 - a) * 400}px`, opacity: a,
      boxShadow: '0 30px 60px rgba(0,0,0,.25)'}}>
      <div style={{height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, Arial', fontWeight: 800, fontSize: 36, color: dark ? '#e8eaed' : INK,
        borderBottom: `2px solid ${dark ? '#3c4043' : '#eee'}`}}>{os}</div>
      <div dir="rtl" style={{padding: '30px 28px'}}>
        <div style={{fontFamily: FONT, fontWeight: 700, fontSize: 31, color: dark ? '#9aa0a6' : '#8e8e93', lineHeight: 1.5}}>{path}</div>
        <div style={{marginTop: 40, borderRadius: 26, background: dark ? '#303134' : '#f2f2f7', padding: '28px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          outline: on > 0.5 ? '4px solid #34c759' : 'none'}}>
          <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 40, color: dark ? '#fff' : INK, lineHeight: 1.3}}>{title}</div>
          <Toggle on={on} />
        </div>
        <div style={{marginTop: 50, textAlign: 'center', fontSize: 120, opacity: on}}>✅</div>
      </div>
    </div>
  );
};
const Steps: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: CREAM}}>
      <div style={{position: 'absolute', top: 120, left: 50, right: 50, display: 'flex', justifyContent: 'space-between', direction: 'ltr'}}>
        <Screen os="iPhone" title="اطلب الشراء" path="الإعدادات ← العائلة ← حساب الطفل" f={frame} delay={0} />
        <Screen os="Android" title="المصادقة لكل عمليات الشراء" path="متجر Google Play ← الإعدادات ← المصادقة" f={frame} delay={60} dark />
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = spring({frame, fps, config: {damping: 12}});
  return (
    <div dir="rtl" style={{position: 'absolute', top: 950, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, color: INK, opacity: a, translate: `0 ${(1 - a) * 40}px`}}>
      <div style={{display: 'inline-block', fontSize: 58, background: INK, color: '#fff', borderRadius: 30, padding: '8px 40px'}}>📲 أرسله لمجموعة العائلة</div>
      <div style={{fontSize: 32, color: '#7a7466', fontWeight: 700, marginTop: 18}}>احمِ أطفالك على الإنترنت · الحلقة 7 · <span style={ltr}>@tech3almashi</span></div>
    </div>
  );
};

export const Family07Purchase: React.FC = () => {
  const frame = useCurrentFrame();
  const hostOn = frame >= B.fix;
  return (
    <AbsoluteFill style={{background: CREAM, overflow: 'hidden'}}>
      <Sequence durationInFrames={B.tap} name="Statement"><Statement /></Sequence>
      <Sequence from={B.tap} durationInFrames={B.fix - B.tap} name="Shop"><Shop /></Sequence>
      <Sequence from={B.fix} durationInFrames={B.steps - B.fix} name="Fix"><Fix /></Sequence>
      <Sequence from={B.steps} name="Steps"><Steps /></Sequence>
      <Sequence from={B.outro} name="Outro"><Outro /></Sequence>
      {hostOn && (
        <AbsoluteFill style={{translate: frame >= B.steps ? '0 370px' : '0 -40px'}}>
          <Mokaab frame={frame} scale={frame >= B.steps ? 0.27 : 0.34} y={frame >= B.steps ? -0.5 : -0.2} mood={frame < B.steps ? 'smirk' : 'happy'} wave={frame >= B.outro ? 1 : 0}
            lookX={0.2} talk={speaking(LINES, frame)} rings={false} />
        </AbsoluteFill>
      )}
      {VOICE.map((v, i) => (
        <Caption key={v.src} line={v} top={i === 0 ? 1440 : i === 1 ? 1560 : i === 2 ? 1520 : 1650} accent={i === 0 ? RED : i === 1 ? CANDY : GREEN} dark={!(i === 1)} />
      ))}
      <VoiceTrack lines={LINES} />
      {[0, 9, 18, 27, 36].map((t) => <Sfx key={t} name="blip" at={t} volume={0.4} />)}
      <Sfx name="buzz" at={44} volume={0.5} />
      {[14, 40, 62, 80, 96, 110].map((t) => <Sfx key={t} name="click" at={B.tap + t} volume={0.45} />)}
      {[18, 44, 66, 84, 100, 114].map((t) => <Sfx key={t} name="ding" at={B.tap + t} volume={0.3} />)}
      <Sfx name="whoosh" at={B.fix - 4} volume={0.45} />
      <Sfx name="pop" at={B.fix + 16} volume={0.5} />
      <Sfx name="tick" at={B.steps + 28} volume={0.5} />
      <Sfx name="tick" at={B.steps + 88} volume={0.5} />
      <Sfx name="pop" at={B.outro} volume={0.45} />
    </AbsoluteFill>
  );
};
