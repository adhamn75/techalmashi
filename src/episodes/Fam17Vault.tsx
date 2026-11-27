import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import {Caption, V} from '../shared/Caption';
import {StickPro} from '../shared/StickPro';
import TL from './Fam17Vault.timeline.json';

// Family ep 17: the fake "calculator" vault app. A giant calculator on warm orange types a secret code and its keypad
// swings open like a safe door onto hidden pictures and chats; then the phone's app list with TWO calculators under a
// magnifier; then parent + child talk it over beside an "ask to install" switch; outro.

const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
export const FAMILY17_FRAMES = TL.frames;
const A = VOICE.map((v) => v.at);
const YEL = '#ffd23f', GRN = '#22d27a', RED = '#ff4d4d', BLUE = '#4b8bff', INK = '#1d1d2b';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const KEYS = ['C', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '⌫', '='];
const CODE = ['1', '9', '8', '4', '='];

const MiniCalc: React.FC<{w: number; color: string}> = ({w, color}) => (
  <svg width={w} height={w * 1.2} viewBox="0 0 100 120">
    <rect x="4" y="4" width="92" height="112" rx="16" fill={color} stroke="#1d1d2b" strokeWidth="6" />
    <rect x="18" y="18" width="64" height="26" rx="6" fill="#cfe8c8" />
    {Array.from({length: 9}, (_, i) => <rect key={i} x={18 + (i % 3) * 23} y={54 + Math.floor(i / 3) * 19} width="18" height="14" rx="4" fill="#fff" />)}
  </svg>
);

export const Family17Vault: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sp = (f: number, d = 14) => spring({frame: frame - f, fps, config: {damping: d}});
  // key presses: spread over the first line and the start of the second
  const press = [8, 28, 48, 68, A[1] + 6];
  const typed = CODE.filter((_, i) => frame >= press[i]).join('').replace('=', '');
  const active = press.findIndex((p) => frame >= p && frame < p + 9);
  const open = interpolate(frame, [A[1] + 14, A[1] + 40], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const outro = sp(A[4], 15);
  const talkT = sp(A[3] + 4);
  const sw = sp(A[3] + 48, 18);
  const mag = interpolate(frame, [A[2] + 14, A[2] + 44, A[2] + 66], [0, 1, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const found = frame >= A[2] + 44;
  const apps: [string, string, string][] = [['🎮', 'لعبة', '#7b61ff'], ['🧮', 'الحاسبة', '#2b2b33'], ['📷', 'الكاميرا', '#4b8bff'], ['💬', 'الرسائل', '#22d27a'], ['🎵', 'الموسيقى', '#ff6fa8'], ['🧮', 'حاسبة +', '#ff8a1f'], ['🗺️', 'الخرائط', '#2fbfb0'], ['⏰', 'الساعة', '#444a66'], ['📚', 'الكتب', '#b8793c']];
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg,#ffb25c,#ff8a3d)', overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: -200, backgroundImage: 'radial-gradient(rgba(29,29,43,.16) 5px, transparent 6px)', backgroundSize: '90px 90px', translate: `${frame % 90}px ${(frame % 90) / 2}px`}} />
      {frame < A[1] + 14 && [['🖼️', 70, 560, -16], ['💬', 880, 760, 14], ['🎞️', 60, 1120, 12], ['🖼️', 890, 1280, -10]].map(([e, x, y, r], i) => (
        <div key={i} style={{position: 'absolute', left: x as number, top: y as number, width: 130, height: 150, background: '#fff', border: `8px solid ${RED}`, borderRadius: 28, fontSize: 76, textAlign: 'center', lineHeight: '134px', rotate: `${(r as number) + 6 * Math.sin(frame / 7 + i * 2)}deg`}}>{e}</div>
      ))}
      {frame < A[2] && (
        <div style={{position: 'absolute', left: 150, top: 380, width: 780, height: 1180, scale: `${interpolate(frame, [0, A[2]], [1, 1.05], clamp)}`}}>
          <div style={{position: 'absolute', inset: 0, background: '#23242e', border: `12px solid ${INK}`, borderRadius: 70}} />
          <div dir="ltr" style={{position: 'absolute', left: 50, right: 50, top: 50, height: 200, background: '#cfe8c8', border: `8px solid ${INK}`, borderRadius: 34, textAlign: 'right', padding: '0 36px', fontFamily: FONT, fontWeight: 900, fontSize: 130, color: INK, lineHeight: '184px', letterSpacing: 8}}>{open > 0.05 ? '🔓' : typed || '0'}</div>
          {/* behind the keypad: the hidden vault */}
          <div style={{position: 'absolute', left: 50, right: 50, top: 290, bottom: 50, background: '#0d0e16', border: `8px solid ${RED}`, borderRadius: 40, padding: 30, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22, alignContent: 'start'}}>
            {['🖼️', '🖼️', '🎞️', '💬', '🖼️', '📁'].map((e, i) => <div key={i} style={{height: 200, background: '#2a2d45', borderRadius: 28, fontSize: 90, textAlign: 'center', lineHeight: '200px', scale: `${sp(A[1] + 20 + i * 3, 11)}`, position: 'relative'}}>{e}</div>)}
            <div dir="rtl" style={{gridColumn: '1 / -1', background: RED, color: '#fff', borderRadius: 28, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 48, whiteSpace: 'nowrap', padding: '22px 0', scale: `${sp(A[1] + 42, 10)}`}}>🙈 صور ومحادثات مخفية</div>
          </div>
          {/* the keypad swings away like a safe door */}
          <div dir="ltr" style={{position: 'absolute', left: 50, right: 50, top: 290, bottom: 50, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, padding: 14, background: '#23242e', borderRadius: 40, transformOrigin: 'left center', transform: `perspective(1600px) rotateY(${-open * 104}deg)`, opacity: open > 0.97 ? 0 : 1}}>
            {KEYS.map((k, i) => {
              const hit = active >= 0 && CODE[active] === k;
              return <div key={i} style={{background: hit ? '#fff' : i % 4 === 3 ? '#ff8a1f' : i < 3 ? '#8b8fa8' : '#454860', color: hit ? INK : '#fff', border: `7px solid ${INK}`, borderRadius: 34, fontFamily: FONT, fontWeight: 900, fontSize: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', scale: hit ? '0.9' : '1'}}>{k}</div>;
            })}
          </div>
        </div>
      )}
      {frame >= A[2] && frame < A[3] && (
        <div style={{position: 'absolute', left: 130, top: 380, width: 820, height: 1120, background: '#fff', border: `12px solid ${INK}`, borderRadius: 70, translate: `0 ${(1 - sp(A[2], 16)) * 900}px`}}>
          <div dir="rtl" style={{textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 54, color: INK, marginTop: 34}}>📱 كل التطبيقات</div>
          <div dir="rtl" style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '44px 20px', padding: '30px 40px'}}>
            {apps.map(([e, n, c], i) => {
              const calc = e === '🧮';
              return (
                <div key={i} style={{textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 36, color: INK, opacity: found && !calc ? 0.3 : 1}}>
                  <div style={{width: 170, height: 170, margin: '0 auto', borderRadius: 42, background: c, border: `8px solid ${found && calc ? RED : INK}`, fontSize: 86, lineHeight: '154px', scale: found && calc ? `${1.12 + 0.05 * Math.sin(frame / 4)}` : '1'}}>{calc ? <div style={{paddingTop: 14}}><MiniCalc w={102} color={c} /></div> : e}</div>
                  {n}
                </div>
              );
            })}
          </div>
          <div style={{position: 'absolute', left: 80 + mag * 420, top: 260 + mag * 230, fontSize: 200, opacity: found ? 0 : 1}}>🔍</div>
          <div dir="rtl" style={{position: 'absolute', left: 50, right: 50, bottom: -80, background: INK, color: '#fff', borderRadius: 34, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 50, whiteSpace: 'nowrap', padding: '20px 0', scale: `${sp(A[2] + 50, 10)}`}}>حاسبتان؟ افحص الثانية ⚠️</div>
        </div>
      )}
      {frame >= A[3] && frame < A[4] && (
        <>
          <div style={{position: 'absolute', left: 60, right: 60, top: 400, height: 680, background: '#fff6dc', border: `10px solid ${INK}`, borderRadius: 60, scale: `${0.85 + 0.15 * talkT}`}} />
          <StickPro frame={frame} role="parent" x={640} y={585} s={1.2} mood="happy" look={-0.8} seed={4} talk={frame < A[3] + 40} />
          <StickPro frame={frame} role="kid" bag x={180} y={645} s={1.0} mood={frame < A[3] + 40 ? 'worry' : 'happy'} look={0.8} seed={2} />
          <div dir="rtl" style={{position: 'absolute', left: 330, top: 430, background: '#fff', border: `7px solid ${INK}`, borderRadius: 34, padding: '6px 30px', fontFamily: FONT, fontWeight: 900, fontSize: 52, color: INK, scale: `${sp(A[3] + 10)}`}}>نتكلّم بهدوء 💛</div>
          <div dir="rtl" style={{position: 'absolute', left: 80, right: 80, top: 1160, background: '#fff', border: `10px solid ${sw > 0.5 ? GRN : INK}`, borderRadius: 44, padding: '34px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: FONT, fontWeight: 900, fontSize: 52, color: INK, opacity: sp(A[3] + 30)}}>
            <span>✅ موافقتي قبل التثبيت</span>
            <span dir="ltr" style={{width: 150, height: 76, borderRadius: 38, background: sw > 0.5 ? GRN : '#b8c2d6', position: 'relative', border: `6px solid ${INK}`}}><span style={{position: 'absolute', top: 4, left: 4 + sw * 72, width: 56, height: 56, borderRadius: 28, background: '#fff', border: `5px solid ${INK}`}} /></span>
          </div>
        </>
      )}
      {frame >= A[4] && (
        <div dir="rtl" style={{position: 'absolute', top: 480, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, opacity: outro, translate: `0 ${(1 - outro) * 80}px`}}>
          <div style={{display: 'inline-block', background: '#fff', color: INK, border: `6px solid ${INK}`, borderRadius: 30, padding: '16px 40px', fontSize: 52}}>📤 أرسلها لكل أب وأم</div><br />
          <div style={{display: 'inline-block', fontSize: 44, color: INK, background: YEL, border: `6px solid ${INK}`, borderRadius: 26, padding: '6px 32px', marginTop: 26}}>🔔 اشترك ليصلك الدرس التالي</div><br />
          <div style={{display: 'inline-block', fontSize: 42, color: '#fff', background: INK, borderRadius: 26, padding: '8px 30px', marginTop: 26}}>الحلقة القادمة: مصباح يطلب أسماء أصدقائه 🔦</div>
        </div>
      )}
      {frame >= A[4] && (
        <>
          <div style={{position: 'absolute', left: 200, top: 1150, rotate: `${-10 + 3 * Math.sin(frame / 9)}deg`, scale: `${outro}`}}>
            <MiniCalc w={330} color="#2b2b33" />
            <div style={{position: 'absolute', right: -70, top: -60, fontSize: 170}}>🔍</div>
          </div>
          <StickPro frame={frame} role="parent" x={640} y={1180} s={1.15} mood="happy" look={-0.8} arm={1} seed={4} />
        </>
      )}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', translate: frame >= A[4] ? '-340px 700px' : '390px 810px'}}>
        <Mokaab frame={frame} scale={0.2} y={0} mood={frame < A[3] ? 'shock' : 'happy'} wave={frame >= A[4] ? 1 : 0} lookX={-0.6} talk={speaking(LINES, frame)} rings={false} />
      </div>
      {VOICE.map((v, i) => (i < VOICE.length - 1 && frame >= A[i + 1] - 3) ? null : <Caption key={v.src} line={v} top={110} accent={i === 0 ? '#ff7b7b' : i === 3 ? '#7dffb5' : i === 4 ? '#8fb3ff' : YEL} bg="rgba(29,29,43,.9)" />)}
      {frame >= A[4] && <div dir="rtl" style={{position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 32, color: INK}}>احمِ أطفالك على الإنترنت · الحلقة 17 · تك عالماشي · خلّيك ذكي!</div>}
      <VoiceTrack lines={LINES} />
      {press.map((p) => <Sfx key={p} name="click" at={p} volume={0.45} />)}
      <Sfx name="whoosh" at={A[1] + 14} volume={0.5} /><Sfx name="buzz" at={A[1] + 42} volume={0.35} />
      <Sfx name="whoosh" at={A[2]} volume={0.4} /><Sfx name="ding" at={A[2] + 44} volume={0.5} /><Sfx name="click" at={A[3] + 48} volume={0.45} /><Sfx name="ding" at={A[4] + 2} volume={0.4} />
    </AbsoluteFill>
  );
};
