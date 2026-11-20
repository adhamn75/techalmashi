import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import {Caption, V} from '../shared/Caption';
import TL from './Fam12Pass.timeline.json';

// Family ep 12: weak password vs a long passphrase. Daylight PAPER look (graph paper, marker ink), two strength
// meters side by side. A short name+year password is guessed by a "robot" in a blink; a four-word phrase makes the
// meter climb and the robot give up. No invented crack times: the lesson is "length beats complexity, never reuse".

const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
export const FAMILY12_FRAMES = TL.frames;
const A = VOICE.map((v) => v.at);
const INK = '#23201b', PAPER = '#f3eddc', RED = '#e5322d', GRN = '#1fb85a', YEL = '#ffd23f', BLUE = '#2a5bd7';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const Meter: React.FC<{p: number; col: string; label: string}> = ({p, col, label}) => (
  <div style={{margin: '18px 0'}}>
    <div style={{height: 46, borderRadius: 24, background: '#fff', border: `5px solid ${INK}`, overflow: 'hidden'}}>
      <div style={{width: `${p * 100}%`, height: '100%', background: col}} />
    </div>
    <div dir="rtl" style={{fontFamily: FONT, fontWeight: 900, fontSize: 40, color: col, marginTop: 6, opacity: p > 0.05 ? 1 : 0}}>{label}</div>
  </div>
);

const Field: React.FC<{text: string; ok?: number; bad?: number; ltr?: boolean}> = ({text, ok = 0, bad = 0, ltr}) => (
  <div style={{background: '#fff', border: `6px solid ${bad ? RED : ok ? GRN : INK}`, borderRadius: 26, padding: '24px 30px', fontFamily: 'Segoe UI, Arial', fontWeight: 700, fontSize: ltr ? 62 : 54, color: INK,
    direction: ltr ? 'ltr' : 'rtl', textAlign: 'center', boxShadow: bad ? `0 0 0 8px rgba(229,50,45,.2)` : ok ? `0 0 0 8px rgba(31,184,90,.2)` : 'none'}}>{text}</div>
);

export const Family12Pass: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const typedWeak = Math.min(9, Math.floor(Math.max(0, frame - (A[0] + 6)) / 2));
  const weakText = 'ahmad2015'.slice(0, typedWeak);
  const crack = interpolate(frame, [A[1], A[1] + 10], [0, 1], clamp);       // robot guesses it at once
  const robot = spring({frame: frame - A[1] - 2, fps, config: {damping: 9, mass: 0.6}});
  const phrase = ['قمرٌ', 'حصانٌ', 'نافذةٌ', 'ثلجٌ'];
  const shown = Math.min(4, Math.max(0, Math.floor((frame - A[2] - 8) / 14) + 1));
  const strong = interpolate(frame, [A[2] + 8, A[2] + 70], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const giveUp = spring({frame: frame - (A[2] + 74), fps, config: {damping: 10}});
  const rule = spring({frame: frame - A[3], fps, config: {damping: 10, mass: 0.7}});
  const outro = spring({frame: frame - A[4], fps, config: {damping: 15}});
  const phase = frame < A[2] ? 0 : 1;
  return (
    <AbsoluteFill style={{background: PAPER, overflow: 'hidden'}}>
      <AbsoluteFill style={{backgroundImage: 'linear-gradient(rgba(60,90,160,.14) 2px, transparent 2px), linear-gradient(90deg, rgba(60,90,160,.14) 2px, transparent 2px)', backgroundSize: '54px 54px'}} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(255,255,255,.4), transparent 35%)'}} />

      {frame < A[3] && (
        <div style={{position: 'absolute', left: 80, right: 80, top: 450}}>
          {/* card: the weak password */}
          <div style={{opacity: phase ? 0.35 : 1, scale: phase ? '0.82' : '1', transformOrigin: '50% 0', transition: 'none', position: 'relative'}}>
            <div dir="rtl" style={{fontFamily: FONT, fontWeight: 900, fontSize: 44, color: INK, marginBottom: 10}}>كلمة سرّ ابنك</div>
            <Field text={weakText || ' '} ltr bad={crack > 0.5 ? 1 : 0} />
            <Meter p={crack > 0.5 ? 0.08 : weakText.length * 0.01} col={RED} label="ضعيفة جدًا" />
            <div style={{position: 'absolute', left: -20, top: -70, fontSize: 130, scale: `${robot}`, rotate: `${(1 - robot) * -30}deg`}}>🤖</div>
            {crack > 0.5 && <div dir="rtl" style={{position: 'absolute', right: 0, top: -64, fontFamily: FONT, fontWeight: 900, fontSize: 44, color: '#fff', background: RED, borderRadius: 20, padding: '4px 26px', rotate: '4deg', scale: `${robot}`}}>خمّنها فورًا!</div>}
          </div>
          {/* card: the strong passphrase */}
          {frame >= A[2] - 4 && (
            <div style={{marginTop: 36}}>
              <div dir="rtl" style={{fontFamily: FONT, fontWeight: 900, fontSize: 44, color: INK, marginBottom: 10}}>عبارةٌ طويلة</div>
              <Field ok={strong > 0.9 ? 1 : 0} text={phrase.slice(0, shown).join(' ') || ' '} />
              <Meter p={strong} col={GRN} label="قوية جدًا" />
              {giveUp > 0.05 && <div style={{fontSize: 120, scale: `${giveUp}`, textAlign: 'left', marginTop: -10}}>🤖💤</div>}
            </div>
          )}
        </div>
      )}

      {frame >= A[3] && frame < A[4] && (
        <div dir="rtl" style={{position: 'absolute', left: 90, right: 90, top: 520, scale: `${rule}`, rotate: `${(1 - rule) * -12 + 2}deg`, background: '#fff', border: `14px solid ${BLUE}`, borderRadius: 40, padding: '40px 30px',
          textAlign: 'center', fontFamily: FONT, boxShadow: '0 30px 60px rgba(0,0,0,.25)'}}>
          <div style={{fontWeight: 900, fontSize: 92, color: BLUE}}>الطول أهمّ</div>
          <div style={{fontWeight: 900, fontSize: 60, color: INK}}>من التعقيد</div>
          <div style={{fontWeight: 700, fontSize: 46, color: RED, marginTop: 22, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16}}>
            <span style={{fontSize: 70}}>🔁</span> لا تكرّرها في كل حساب
          </div>
        </div>
      )}

      {frame >= A[4] && (
        <div dir="rtl" style={{position: 'absolute', top: 640, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, opacity: outro, translate: `0 ${(1 - outro) * 80}px`}}>
          <div style={{display: 'inline-block', background: INK, color: '#fff', borderRadius: 30, padding: '16px 40px', fontSize: 52}}>📤 أرسله لكل أب وأم</div><br />
          <div style={{display: 'inline-block', fontSize: 44, color: INK, background: YEL, borderRadius: 26, padding: '6px 32px', marginTop: 22}}>🔔 اشترك ليصلك الدرس التالي</div><br />
          <div style={{display: 'inline-block', fontSize: 42, color: '#fff', background: BLUE, borderRadius: 26, padding: '6px 30px', marginTop: 20}}>الحلقة القادمة: وقت الشاشة في 10 ثوانٍ ⏱️</div>
        </div>
      )}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', translate: frame >= A[4] ? '-340px 700px' : '380px 760px', opacity: interpolate(frame, [A[1] - 8, A[1] + 6], [0, 1], clamp)}}>
        <Mokaab frame={frame} scale={0.22} y={0} mood={frame < A[2] ? 'shock' : 'happy'} wave={frame >= A[4] ? 1 : 0} lookX={-0.6} talk={speaking(LINES, frame)} rings={false} />
      </div>
      {VOICE.map((v, i) => <Caption key={v.src} line={v} top={110} accent={i === 1 ? '#ff6b66' : i === 2 ? '#7dffb5' : i === 4 ? '#8fb3ff' : YEL} />)}
      {frame >= A[4] && <div dir="rtl" style={{position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 32, color: '#6a624f'}}>احمِ أطفالك على الإنترنت · الحلقة 12 · تك عالماشي · خلّيك ذكي!</div>}
      <VoiceTrack lines={LINES} />
      {Array.from({length: 9}, (_, i) => <Sfx key={i} name="tick" at={A[0] + 6 + i * 2} volume={0.25} />)}
      <Sfx name="buzz" at={A[1] + 8} volume={0.45} /><Sfx name="pop" at={A[1] + 4} volume={0.4} />
      {[0, 1, 2, 3].map((i) => <Sfx key={i} name="blip" at={A[2] + 8 + i * 14} volume={0.35} />)}
      <Sfx name="ding" at={A[2] + 74} volume={0.45} /><Sfx name="pop" at={A[3]} volume={0.5} /><Sfx name="ding" at={A[4] + 2} volume={0.4} />
    </AbsoluteFill>
  );
};
