import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import {Caption, V} from '../shared/Caption';
import {Stick} from './Fam14Uniform';
import TL from './Fam15Lock.timeline.json';

// Family ep 15: 2-step verification. Stickman on light-blue paper: a thief with the password key opens the door,
// then the settings path (three rows), then a code arrives on the phone and the thief is stopped at the door.

const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
export const FAMILY15_FRAMES = TL.frames;
const A = VOICE.map((v) => v.at);
const YEL = '#ffd23f', GRN = '#22d27a', RED = '#ff4d4d', BLUE = '#4b8bff', INK = '#1d1d2b';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const Door: React.FC<{open: number; locked?: boolean}> = ({open, locked}) => (
  <div style={{position: 'absolute', left: 600, top: 470, width: 330, height: 520, background: '#c9d6ff', border: `10px solid ${INK}`, borderRadius: '30px 30px 0 0'}}>
    <div style={{position: 'absolute', inset: 0, background: '#8a5a3c', border: `8px solid ${INK}`, borderRadius: '24px 24px 0 0', transformOrigin: 'left', transform: `perspective(900px) rotateY(${-open * 70}deg)`}}>
      <div style={{position: 'absolute', right: 24, top: 250, width: 30, height: 30, borderRadius: 15, background: YEL, border: `6px solid ${INK}`}} />
    </div>
    <div style={{position: 'absolute', left: 105, top: -86, fontSize: 90}}>{locked ? '🔒' : '🔓'}</div>
  </div>
);

export const Family15Lock: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sp = (f: number, d = 14) => spring({frame: frame - f, fps, config: {damping: d}});
  const thiefX = interpolate(frame, [4, 70], [-200, 250], clamp);
  const open1 = frame < A[3] ? sp(A[0] + 50) : 0;
  const rows = [sp(A[2] + 4), sp(A[2] + 40), sp(A[2] + 84)];
  const toggle = sp(A[2] + 110, 20);
  const outro = sp(A[4], 15);
  const code = sp(A[3] + 6);
  const shake = frame >= A[3] + 50 && frame < A[4] ? Math.sin(frame * 1.4) * 8 : 0;
  const scene1 = frame < A[2];
  const scene3 = frame >= A[3] && frame < A[4];
  return (
    <AbsoluteFill style={{background: '#d8ecff', overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(29,29,43,.07) 2px, transparent 2px), linear-gradient(90deg, rgba(29,29,43,.07) 2px, transparent 2px)', backgroundSize: '70px 70px'}} />
      {scene1 && (
        <>
          <Door open={open1} locked={frame < A[0] + 50} />
          <Stick x={thiefX} y={520} s={1.1} hat walk={frame / 3} arm={frame > A[0] + 40 ? 1 : 0} />
          <div dir="ltr" style={{position: 'absolute', left: thiefX + 60, top: 450, background: '#fff', border: `6px solid ${INK}`, borderRadius: 20, padding: '0 22px', fontFamily: FONT, fontWeight: 900, fontSize: 46, opacity: sp(A[0] + 20)}}>🔑 Ahmad2010</div>
          {frame >= A[1] && <div dir="rtl" style={{position: 'absolute', left: 60, right: 60, top: 1110, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 56, color: INK, opacity: sp(A[1] + 4)}}>عرف كلمة المرور… 😈 لكن أين الهاتف؟ <span style={{fontSize: 80}}>📱❓</span></div>}
        </>
      )}
      {frame >= A[2] && frame < A[3] && (
        <div dir="rtl" style={{position: 'absolute', left: 80, right: 80, top: 390, display: 'flex', flexDirection: 'column', gap: 30, fontFamily: FONT, fontWeight: 900, fontSize: 62, color: INK}}>
          {['⚙️ الإعدادات', '🛡️ الأمان'].map((t, i) => <div key={t} style={{background: '#fff', border: `8px solid ${INK}`, borderRadius: 34, padding: '16px 34px', opacity: rows[i], translate: `${(1 - rows[i]) * 260}px 0`}}>{t} <span style={{float: 'left'}}>◀</span></div>)}
          <div style={{background: '#fff', border: `8px solid ${toggle > 0.5 ? GRN : INK}`, borderRadius: 34, padding: '16px 34px', opacity: rows[2], translate: `${(1 - rows[2]) * 260}px 0`, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <span>✅ التحقق بخطوتين</span>
            <span dir="ltr" style={{width: 150, height: 76, borderRadius: 38, background: toggle > 0.5 ? GRN : '#b8c2d6', position: 'relative', border: `6px solid ${INK}`}}><span style={{position: 'absolute', top: 4, left: 4 + toggle * 72, width: 56, height: 56, borderRadius: 28, background: '#fff', border: `5px solid ${INK}`}} /></span>
          </div>
        </div>
      )}
      {scene3 && (
        <>
          <Door open={0} locked />
          <Stick x={120 + shake} y={520} s={1.1} hat arm={1} />
          <div style={{position: 'absolute', left: 430, top: 640, fontSize: 130, opacity: frame > A[3] + 50 ? 1 : 0}}>🚫</div>
          <div style={{position: 'absolute', left: 200, top: 1010, width: 260, height: 420, background: '#fff', border: `10px solid ${INK}`, borderRadius: 44, scale: `${code}`, textAlign: 'center', fontFamily: FONT, fontWeight: 900}}>
            <div style={{fontSize: 34, marginTop: 70}}>رمز التحقق</div>
            <div dir="ltr" style={{fontSize: 62, color: BLUE, marginTop: 20}}>482<br />913</div>
          </div>
          <div dir="rtl" style={{position: 'absolute', left: 520, top: 1090, fontFamily: FONT, fontWeight: 900, fontSize: 52, color: INK, width: 480}}>الرمز عندك أنت فقط ✔</div>
        </>
      )}
      {frame >= A[4] && (
        <div dir="rtl" style={{position: 'absolute', top: 420, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, opacity: outro, translate: `0 ${(1 - outro) * 80}px`}}>
          <div style={{display: 'inline-block', background: INK, color: '#fff', borderRadius: 30, padding: '16px 40px', fontSize: 52}}>📤 أرسلها لكل أب وأم</div><br />
          <div style={{display: 'inline-block', fontSize: 44, color: INK, background: YEL, border: `6px solid ${INK}`, borderRadius: 26, padding: '6px 32px', marginTop: 22}}>🔔 اشترك ليصلك الدرس التالي</div><br />
          <div style={{display: 'inline-block', fontSize: 42, color: '#fff', background: BLUE, borderRadius: 26, padding: '6px 30px', marginTop: 20}}>الحلقة القادمة: غريب يسأل طفلك «أين تسكن؟» 💬</div>
        </div>
      )}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', translate: frame >= A[4] ? '-340px 760px' : '380px 800px'}}>
        <Mokaab frame={frame} scale={0.2} y={0} mood={scene1 ? 'shock' : 'happy'} wave={frame >= A[4] ? 1 : 0} lookX={-0.6} talk={speaking(LINES, frame)} rings={false} />
      </div>
      {VOICE.map((v, i) => <Caption key={v.src} line={v} top={110} accent={i === 1 ? '#ff7b7b' : i === 3 ? '#7dffb5' : i === 4 ? '#8fb3ff' : YEL} bg="rgba(29,29,43,.88)" />)}
      {frame >= A[4] && <div dir="rtl" style={{position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 32, color: INK}}>احمِ أطفالك على الإنترنت · الحلقة 15 · تك عالماشي · خلّيك ذكي!</div>}
      <VoiceTrack lines={LINES} />
      <Sfx name="whoosh" at={A[0] + 4} volume={0.4} /><Sfx name="click" at={A[0] + 50} volume={0.45} /><Sfx name="buzz" at={A[1] + 4} volume={0.35} />
      <Sfx name="tick" at={A[2] + 4} volume={0.35} /><Sfx name="tick" at={A[2] + 40} volume={0.35} /><Sfx name="tick" at={A[2] + 84} volume={0.35} /><Sfx name="click" at={A[2] + 110} volume={0.45} />
      <Sfx name="ding" at={A[3] + 6} volume={0.5} /><Sfx name="buzz" at={A[3] + 50} volume={0.4} /><Sfx name="ding" at={A[4] + 2} volume={0.4} />
    </AbsoluteFill>
  );
};
