import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import {Caption, V} from '../shared/Caption';
import {StickPro} from '../shared/StickPro';
import TL from './Fam16Chat.timeline.json';

// Family ep 16: a stranger in a game chat. Dark game-lobby look (not paper): chat bubbles escalate while a
// danger bar fills; then a stick child raises a hand (STOP), the parent stick figure hears about it, outro.

const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
export const FAMILY16_FRAMES = TL.frames;
const A = VOICE.map((v) => v.at);
const YEL = '#ffd23f', GRN = '#22d27a', RED = '#ff4d4d', BLUE = '#4b8bff', INK = '#1d1d2b';

export const Family16Chat: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sp = (f: number, d = 14) => spring({frame: frame - f, fps, config: {damping: d}});
  const bubbles = [
    {t: 'مرحبا! لعبتك رائعة 😀', f: A[0] - 2, c: '#3a3f66'},
    {t: 'أين تسكن؟', f: A[0] + 40, c: RED},
    {t: 'في أي شارع؟', f: A[1] + 40, c: RED},
    {t: 'متى تخرج من المدرسة؟', f: A[1] + 110, c: RED},
  ];
  const danger = interpolate(frame, [A[0] + 40, A[1] + 150], [0.08, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const outro = sp(A[4], 15);
  const chatOn = frame < A[2];
  const stop = sp(A[2] + 6);
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg,#14163a,#2a1c4d)', overflow: 'hidden'}}>
      {[...Array(18)].map((_, i) => <div key={i} style={{position: 'absolute', left: (i * 173) % 1040 + 20, top: (i * 211) % 1700 + 30, width: 8, height: 8, borderRadius: 4, background: '#fff', opacity: 0.2 + 0.5 * Math.abs(Math.sin(frame / 14 + i))}} />)}
      {chatOn && (
        <>
          <div dir="rtl" style={{position: 'absolute', left: 70, right: 70, top: 330, height: 760, background: 'rgba(255,255,255,.07)', border: '6px solid #6f78d8', borderRadius: 40, padding: 30, display: 'flex', flexDirection: 'column', gap: 26}}>
            <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 38, color: '#9aa4ff'}}>💬 دردشة اللعبة — «Pro_Gamer_77» 👤</div>
            {bubbles.map((b, i) => <div key={i} style={{alignSelf: 'flex-start', background: b.c, color: '#fff', fontFamily: FONT, fontWeight: 900, fontSize: 56, borderRadius: 34, padding: '10px 34px', opacity: sp(b.f), scale: `${0.6 + 0.4 * sp(b.f)}`, transformOrigin: 'right center'}}>{b.t}</div>)}
          </div>
          <div style={{position: 'absolute', left: 40, top: 1280, width: 300, height: 390, background: '#fff4b8', border: `8px solid ${INK}`, borderRadius: 44}} /><div style={{position: 'absolute', left: 740, top: 1280, width: 300, height: 390, background: '#e6dcff', border: `8px solid ${INK}`, borderRadius: 44}} />
          <StickPro frame={frame} role="kid" bag x={60} y={1255} s={0.8} mood={frame < A[0] + 40 ? 'happy' : frame < A[1] + 40 ? 'worry' : 'shock'} look={0.9} seed={2} />
          <StickPro frame={frame} role="thief" x={760} y={1255} s={0.8} mood={frame < A[1] + 40 ? 'smirk' : 'angry'} look={-0.9} flip seed={7} />
          <div dir="rtl" style={{position: 'absolute', left: 90, right: 90, top: 1150, fontFamily: FONT, fontWeight: 900, fontSize: 46, color: '#fff'}}>
            مستوى الخطر ⚠️
            <div style={{height: 46, borderRadius: 23, background: '#ffffff30', marginTop: 12, overflow: 'hidden', border: '5px solid #fff'}}><div style={{height: '100%', width: `${danger * 100}%`, background: danger > 0.6 ? RED : YEL, float: 'right'}} /></div>
          </div>
        </>
      )}
      {frame >= A[2] && frame < A[4] && (
        <>
          <div style={{position: 'absolute', left: 0, right: 0, top: 360, height: 600, background: '#fff4b8', borderRadius: 60, border: `10px solid ${INK}`, margin: '0 50px'}} />
          <StickPro frame={frame} role="kid" bag x={120} y={420} s={1.15} arm={1} mood={frame < A[3] ? 'angry' : 'happy'} look={0.7} />
          <div style={{position: 'absolute', left: 330, top: 450, fontSize: 190, scale: `${stop}`}}>✋</div>
          <div dir="rtl" style={{position: 'absolute', left: 560, top: 520, width: 420, fontFamily: FONT, fontWeight: 900, fontSize: 58, color: INK, opacity: stop}}>لا معلومات<br />شخصية!<br /><span style={{color: RED}}>🏠 🏫 📍</span></div>
          {frame >= A[3] && <><div style={{position: 'absolute', left: 720, top: 1200, width: 300, height: 390, background: '#d4f7e4', border: `8px solid ${INK}`, borderRadius: 44}} /><StickPro frame={frame} role="parent" x={740} y={1175} s={0.8} mood="happy" arm={0} look={-0.6} seed={4} talk={false} /></>}
          {frame >= A[3] && <>
            <div style={{position: 'absolute', left: 70, right: 70, top: 1010, display: 'flex', gap: 24, justifyContent: 'center', opacity: sp(A[3] + 4)}}>
              <div dir="rtl" style={{background: GRN, color: INK, fontFamily: FONT, fontWeight: 900, fontSize: 48, border: `6px solid ${INK}`, borderRadius: 28, padding: '10px 28px'}}>🗣️ أخبر أمك وأباك فورًا</div>
              <div dir="rtl" style={{background: '#fff', color: INK, fontFamily: FONT, fontWeight: 900, fontSize: 48, border: `6px solid ${RED}`, borderRadius: 28, padding: '10px 28px'}}>🚫 📷 لا صور</div>
            </div>
          </>}
        </>
      )}
      {frame >= A[4] && (
        <div dir="rtl" style={{position: 'absolute', top: 420, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, opacity: outro, translate: `0 ${(1 - outro) * 80}px`}}>
          <div style={{display: 'inline-block', background: '#fff', color: INK, borderRadius: 30, padding: '16px 40px', fontSize: 52}}>📤 أرسلها لكل أب وأم</div><br />
          <div style={{display: 'inline-block', fontSize: 44, color: INK, background: YEL, border: `6px solid ${INK}`, borderRadius: 26, padding: '6px 32px', marginTop: 22}}>🔔 اشترك ليصلك الدرس التالي</div><br />
          <div style={{display: 'inline-block', fontSize: 42, color: '#fff', background: BLUE, borderRadius: 26, padding: '6px 30px', marginTop: 20}}>الحلقة القادمة: صوت قريب يطلب مالًا… وليس هو! 📞</div>
        </div>
      )}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', translate: frame >= A[4] ? '-340px 760px' : '380px 800px'}}>
        <Mokaab frame={frame} scale={0.2} y={0} mood={chatOn ? 'shock' : 'happy'} wave={frame >= A[4] ? 1 : 0} lookX={-0.6} talk={speaking(LINES, frame)} rings={false} />
      </div>
      {VOICE.map((v, i) => <Caption key={v.src} line={v} top={110} accent={i === 0 ? '#ff7b7b' : i === 3 ? '#7dffb5' : i === 4 ? '#8fb3ff' : YEL} bg="rgba(10,10,30,.88)" />)}
      {frame >= A[4] && <div dir="rtl" style={{position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 32, color: '#cfd3ff'}}>احمِ أطفالك على الإنترنت · الحلقة 16 · تك عالماشي · خلّيك ذكي!</div>}
      <VoiceTrack lines={LINES} />
      <Sfx name="buzz" at={A[0] + 40} volume={0.4} /><Sfx name="tick" at={A[1] + 40} volume={0.35} /><Sfx name="tick" at={A[1] + 110} volume={0.35} />
      <Sfx name="whoosh" at={A[2] + 4} volume={0.45} /><Sfx name="ding" at={A[3] + 4} volume={0.5} /><Sfx name="ding" at={A[4] + 2} volume={0.4} />
    </AbsoluteFill>
  );
};
