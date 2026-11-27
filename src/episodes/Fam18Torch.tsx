import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import {Caption, V} from '../shared/Caption';
import {StickPro} from '../shared/StickPro';
import TL from './Fam18Torch.timeline.json';

// Family ep 18: a torch app that asks for contacts and the microphone. A dark bedroom: the torch beam swings and
// catches permission pop-ups and a stick thief behind them; the beam alone needs nothing (red crosses); then the
// settings path and three permission switches going off one by one; outro in a lit room.

const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
export const FAMILY18_FRAMES = TL.frames;
const A = VOICE.map((v) => v.at);
const YEL = '#ffd23f', GRN = '#22d27a', RED = '#ff4d4d', INK = '#1d1d2b';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ASKS: [string, string][] = [['👥', 'جهات الاتصال'], ['🎤', 'الميكروفون'], ['📍', 'الموقع']];

export const Family18Torch: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sp = (f: number, d = 14) => spring({frame: frame - f, fps, config: {damping: d}});
  const dark = frame < A[2];
  const swing = interpolate(frame, [0, 24, 52, A[1]], [-10, 8, 14, 0], {...clamp, easing: Easing.inOut(Easing.sin)});
  const outro = sp(A[4], 15);
  const pop = [-24, 30, 56].map((d) => sp(d, 11));
  const cross = [A[1] + 24, A[1] + 44, A[1] + 62].map((d) => sp(d, 10));
  const off = [A[3] + 6, A[3] + 24, A[3] + 42].map((d) => sp(d, 18));
  const path = [sp(A[2] + 4), sp(A[2] + 22), sp(A[2] + 40)];
  return (
    <AbsoluteFill style={{background: dark ? '#0c1230' : '#e5f7ee', overflow: 'hidden'}}>
      {dark && (
        <>
          {/* beam from the torch phone at the bottom */}
          <svg width={1080} height={1920} style={{position: 'absolute'}}>
            <g transform={`rotate(${swing} 300 1520)`}>
              <path d="M262 1500 L-60 330 L860 330 L338 1500 Z" fill="#fff3b0" opacity={0.9} />
              <path d="M280 1500 L130 330 L660 330 L320 1500 Z" fill="#fffdf0" opacity={0.9} />
            </g>
            {Array.from({length: 22}, (_, i) => <circle key={i} cx={(i * 197) % 1060 + 10} cy={(i * 131) % 700 + 250} r={4} fill="#fff" opacity={0.25 + 0.4 * Math.abs(Math.sin(frame / 15 + i))} />)}
          </svg>
          <div style={{position: 'absolute', left: 200, top: 1450, width: 200, height: 330, background: '#222638', border: `10px solid ${INK}`, borderRadius: 44, rotate: `${swing * 0.6}deg`, textAlign: 'center'}}>
            <div style={{fontSize: 110, marginTop: 50}}>🔦</div>
            <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 34, color: '#fff'}}>مصباح</div>
          </div>
          <div style={{opacity: interpolate(frame, [30, 55], [0, 1], clamp)}}>
            <StickPro frame={frame} role="thief" mood={frame < A[1] + 24 ? 'smirk' : 'angry'} x={760} y={1220} s={1.0} look={-0.9} flip seed={7} arm={frame < A[1] ? 1 : 0} />
          </div>
          {ASKS.map(([e, n], i) => (
            <div key={n} dir="rtl" style={{position: 'absolute', left: 90 + (i % 2) * 90, width: 800, top: 400 + i * 250, background: '#fff', border: `8px solid ${INK}`, borderRadius: 40, padding: '14px 30px', fontFamily: FONT, fontWeight: 900, color: INK, scale: `${pop[i]}`, rotate: `${[-2, 2, -1][i]}deg`}}>
              <div style={{fontSize: 36, color: '#59607e'}}>«مصباح» يطلب الوصول إلى:</div>
              <div style={{fontSize: 62, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}><span>{e} {n}</span><span style={{fontSize: 40, background: GRN, borderRadius: 18, padding: '0 22px', opacity: 1 - cross[i]}}>سماح</span></div>
              <div style={{position: 'absolute', left: 36, top: 40, fontSize: 130, scale: `${cross[i]}`}}>❌</div>
            </div>
          ))}
          {frame >= A[1] + 6 && <div dir="rtl" style={{position: 'absolute', left: 360, top: 1170, width: 440, whiteSpace: 'nowrap', background: YEL, border: `7px solid ${INK}`, borderRadius: 34, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 54, color: INK, padding: '6px 0', scale: `${sp(A[1] + 6)}`}}>يكفيه الضوء 💡</div>}
        </>
      )}
      {frame >= A[2] && frame < A[4] && (
        <div dir="rtl" style={{position: 'absolute', left: 80, right: 80, top: 380, fontFamily: FONT, fontWeight: 900, color: INK}}>
          <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, fontSize: 40, whiteSpace: 'nowrap'}}>
            {['⚙️ الإعدادات', 'الخصوصية', 'الأذونات'].map((t, i) => <React.Fragment key={t}>{i > 0 && <span>◀</span>}<span style={{background: i === 2 ? INK : '#fff', color: i === 2 ? '#fff' : INK, border: `6px solid ${INK}`, borderRadius: 26, padding: '4px 20px', scale: `${path[i]}`}}>{t}</span></React.Fragment>)}
          </div>
          <div style={{marginTop: 40, background: '#fff', border: `10px solid ${INK}`, borderRadius: 50, padding: '20px 36px', opacity: sp(A[2] + 30), translate: `0 ${(1 - sp(A[2] + 30)) * 300}px`}}>
            <div style={{fontSize: 54, textAlign: 'center', borderBottom: `6px solid ${INK}`, paddingBottom: 10}}>🔦 تطبيق «مصباح»</div>
            {ASKS.map(([e, n], i) => (
              <div key={n} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 56, padding: '36px 0'}}>
                <span>{e} {n}</span>
                <span dir="ltr" style={{width: 150, height: 76, borderRadius: 38, background: off[i] > 0.5 ? '#b8c2d6' : RED, position: 'relative', border: `6px solid ${INK}`}}><span style={{position: 'absolute', top: 4, left: 76 - off[i] * 72, width: 56, height: 56, borderRadius: 28, background: '#fff', border: `5px solid ${INK}`}} /></span>
              </div>
            ))}
          </div>
          {frame >= A[3] + 50 && <div style={{textAlign: 'center', fontSize: 62, background: GRN, border: `7px solid ${INK}`, borderRadius: 34, marginTop: 34, scale: `${sp(A[3] + 50, 10)}`}}>أُغلقت كلها ✔</div>}
        </div>
      )}
      {frame >= A[2] && frame < A[4] && <StickPro frame={frame} role="parent" x={130} y={1500} s={0.82} mood={frame < A[3] + 50 ? 'worry' : 'happy'} look={0.6} seed={4} arm={frame >= A[3] + 50 ? 1 : 0} />}
      {frame >= A[4] && (
        <>
          <div dir="rtl" style={{position: 'absolute', top: 440, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, opacity: outro, translate: `0 ${(1 - outro) * 80}px`}}>
            <div style={{display: 'inline-block', background: INK, color: '#fff', borderRadius: 30, padding: '16px 40px', fontSize: 52}}>📤 أرسلها لكل أب وأم</div><br />
            <div style={{display: 'inline-block', fontSize: 44, color: INK, background: YEL, border: `6px solid ${INK}`, borderRadius: 26, padding: '6px 32px', marginTop: 26}}>🔔 اشترك ليصلك الدرس التالي</div><br />
            <div style={{display: 'inline-block', fontSize: 42, color: '#fff', background: '#6a4ce2', borderRadius: 26, padding: '8px 30px', marginTop: 26}}>الحلقة القادمة: بثّ يطلب من طفلك هديّة 🎁</div>
          </div>
          <StickPro frame={frame} role="kid" bag x={300} y={1100} s={1.05} mood="happy" arm={1} look={0.4} seed={2} />
          <StickPro frame={frame} role="parent" x={580} y={1060} s={1.15} mood="happy" look={-0.4} seed={4} />
        </>
      )}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', translate: frame >= A[4] ? '-340px 720px' : frame >= A[2] ? '370px 800px' : '60px 800px'}}>
        <Mokaab frame={frame} scale={0.2} y={0} mood={dark ? 'shock' : 'happy'} wave={frame >= A[4] ? 1 : 0} lookX={-0.6} talk={speaking(LINES, frame)} rings={false} />
      </div>
      {VOICE.map((v, i) => (i < VOICE.length - 1 && frame >= A[i + 1] - 3) ? null : <Caption key={v.src} line={v} top={110} accent={i === 0 ? '#ff7b7b' : i === 3 ? '#7dffb5' : i === 4 ? '#c0b0ff' : YEL} bg="rgba(29,29,43,.92)" />)}
      {frame >= A[4] && <div dir="rtl" style={{position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 32, color: INK}}>احمِ أطفالك على الإنترنت · الحلقة 18 · تك عالماشي · خلّيك ذكي!</div>}
      <VoiceTrack lines={LINES} />
      <Sfx name="pop" at={0} volume={0.45} /><Sfx name="pop" at={30} volume={0.45} /><Sfx name="pop" at={56} volume={0.45} />
      <Sfx name="buzz" at={A[1] + 24} volume={0.35} /><Sfx name="whoosh" at={A[2]} volume={0.45} />
      <Sfx name="click" at={A[3] + 6} volume={0.45} /><Sfx name="click" at={A[3] + 24} volume={0.45} /><Sfx name="click" at={A[3] + 42} volume={0.45} />
      <Sfx name="ding" at={A[3] + 50} volume={0.5} /><Sfx name="ding" at={A[4] + 2} volume={0.4} />
    </AbsoluteFill>
  );
};
