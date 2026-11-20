import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import {Caption, V} from '../shared/Caption';
import TL from './Fam11Wifi.timeline.json';

// Family ep 11: the fake public Wi-Fi ("evil twin"). NIGHT café window, neon sign, a phone listing two networks
// with almost the same name; the fake one is run by a hooded figure who reads every message that passes through.
// Fix: never type a password on public Wi-Fi, use the phone's mobile data. Look: dark teal + neon pink, networks as
// glowing rows, data packets flying a curved path to the figure, a toggle that flips to mobile data at the end.

const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
export const FAMILY11_FRAMES = TL.frames;
const A = VOICE.map((v) => v.at);
const INK = '#0a1620', PINK = '#ff4fa3', CYAN = '#3de0ff', GRN = '#22d27a', YEL = '#ffd23f', RED = '#ff4d4d';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const Row: React.FC<{name: string; fake?: boolean; glow: number; s: number; mask: number}> = ({name, fake, glow, s, mask}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 18, direction: 'ltr', background: `rgba(255,255,255,${0.08 + glow * 0.18})`, border: `4px solid ${fake && glow > 0.5 ? RED : 'rgba(255,255,255,.15)'}`,
    borderRadius: 26, padding: '22px 26px', margin: '18px 0', scale: `${s}`, fontFamily: 'Segoe UI, Arial', color: '#fff', fontWeight: 700, fontSize: 40}}>
    <span style={{fontSize: 46}}>📶</span><span style={{flex: 1}}>{name}</span>
    {fake && <span style={{fontSize: 52, scale: `${mask}`, opacity: mask}}>🎭</span>}
    <span style={{opacity: 0.6, fontSize: 32}}>ⓘ</span>
  </div>
);

const Packet: React.FC<{p: number; i: number}> = ({p, i}) => {
  const x = interpolate(p, [0, 1], [190, 780]), y = 1120 + Math.sin(p * Math.PI) * -150 + i * 22;
  return <div style={{position: 'absolute', left: x, top: y, fontSize: 54, opacity: p > 0 && p < 1 ? 1 : 0, rotate: `${p * 40}deg`}}>{['✉️', '🔑', '💬', '📷'][i % 4]}</div>;
};

export const Family11Wifi: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rowIn = (d: number) => spring({frame: frame - d, fps, config: {damping: 13}});
  const mask = spring({frame: frame - (A[1] + 18), fps, config: {damping: 8, mass: 0.6}});
  const glow = interpolate(frame, [A[1] + 6, A[1] + 22], [0, 1], clamp);
  const flow = A[2];
  const fixT = spring({frame: frame - A[3], fps, config: {damping: 12}});
  const toggle = interpolate(frame, [A[3] + 40, A[3] + 58], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const outro = spring({frame: frame - A[4], fps, config: {damping: 15}});
  const neon = 0.75 + 0.25 * Math.sin(frame / 5);
  const phoneY = interpolate(frame, [0, 22], [160, 0], {...clamp, easing: Easing.out(Easing.cubic)});
  const showRows = frame < A[3];
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg, #08202e, #0b1018 70%)', overflow: 'hidden'}}>
      {/* café window with neon sign */}
      <div style={{position: 'absolute', left: 90, right: 90, top: 430, height: 190, borderRadius: 30, border: `8px solid ${PINK}`, boxShadow: `0 0 ${50 * neon}px ${PINK}, inset 0 0 40px rgba(255,79,163,.35)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, Arial', fontWeight: 900, fontSize: 96, color: '#fff', letterSpacing: 14, opacity: neon, direction: 'ltr'}}>☕ CAFE</div>

      {/* phone */}
      <div style={{position: 'absolute', left: 190, top: 680 + phoneY, opacity: interpolate(frame, [A[4] - 4, A[4] + 10], [1, 0], clamp), width: 700, height: 900, borderRadius: 80, background: '#05090d', padding: 20, boxShadow: '0 40px 90px rgba(0,0,0,.6), inset 0 0 0 4px #2a3a46'}}>
        <div style={{width: '100%', height: '100%', borderRadius: 62, overflow: 'hidden', background: 'linear-gradient(180deg,#14304a,#0e1f30)', padding: '70px 36px', boxSizing: 'border-box', position: 'relative'}}>
          <div style={{fontFamily: 'Segoe UI, Arial', color: '#fff', fontWeight: 900, fontSize: 46, direction: 'ltr', display: 'flex', justifyContent: 'space-between'}}>
            <span>Wi-Fi</span>
            <span style={{width: 100, height: 54, borderRadius: 30, background: toggle > 0.5 ? '#555' : GRN, position: 'relative'}}>
              <span style={{position: 'absolute', top: 5, left: toggle > 0.5 ? 6 : 50, width: 44, height: 44, borderRadius: 22, background: '#fff'}} /></span>
          </div>
          {showRows && (<>
            <Row name="Cafe_Free" glow={0} s={rowIn(8)} mask={0} />
            <Row name="Cafe_Free_Guest" fake glow={glow} s={rowIn(20)} mask={mask} />
          </>)}
          {frame >= A[3] && (
            <div dir="rtl" style={{marginTop: 30, background: 'rgba(34,210,122,.18)', border: `5px solid ${GRN}`, borderRadius: 30, padding: '30px 28px', fontFamily: FONT, color: '#fff', fontWeight: 900, fontSize: 52, scale: `${fixT}`, textAlign: 'center'}}>
              <div style={{fontSize: 90}}>📱📶</div>بيانات الهاتف<br /><span style={{fontSize: 36, color: GRN}}>مفعّلة ✓ آمنة</span>
            </div>
          )}
        </div>
      </div>

      {/* packets fly to the hooded figure while the child is "on" the fake network */}
      {frame >= flow && frame < A[3] && [0, 1, 2, 3].map((i) => <Packet key={i} i={i} p={((frame - flow - i * 12) % 60) / 60} />)}
      {frame >= flow - 10 && frame < A[3] && (
        <div style={{position: 'absolute', right: 40, top: 1000, fontSize: 200, scale: `${interpolate(frame, [flow - 10, flow + 8], [0, 1], clamp)}`, filter: `drop-shadow(0 0 30px ${RED})`}}>🕵️</div>
      )}
      {frame >= flow + 20 && frame < A[3] && (
        <div dir="rtl" style={{position: 'absolute', top: 1650, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 52, color: RED}}>صاحبُ الشبكة يرى كلَّ شيء 👀</div>
      )}

      {frame >= A[4] && (
        <div dir="rtl" style={{position: 'absolute', top: 1000, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, opacity: outro, translate: `0 ${(1 - outro) * 80}px`}}>
          <div style={{display: 'inline-block', background: '#fff', color: INK, borderRadius: 30, padding: '16px 40px', fontSize: 52}}>📤 أرسله لكل أب وأم</div><br />
          <div style={{display: 'inline-block', fontSize: 44, color: INK, background: YEL, borderRadius: 26, padding: '6px 32px', marginTop: 22}}>🔔 اشترك ليصلك الدرس التالي</div><br />
          <div style={{display: 'inline-block', fontSize: 42, color: '#fff', background: '#2a5bd7', borderRadius: 26, padding: '6px 30px', marginTop: 20}}>الحلقة القادمة: كلمة سرّ تُكسر في ثانية 🔓</div>
        </div>
      )}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', translate: frame >= A[4] ? '-340px 700px' : '380px 700px', opacity: interpolate(frame, [A[1] - 10, A[1] + 4], [0, 1], clamp)}}>
        <Mokaab frame={frame} scale={0.22} y={0} mood={frame < A[3] ? 'shock' : 'happy'} wave={frame >= A[4] ? 1 : 0} lookX={-0.6} talk={speaking(LINES, frame)} rings={false} />
      </div>
      {VOICE.map((v, i) => <Caption key={v.src} line={v} top={110} accent={i === 2 ? '#ff7b7b' : i === 3 ? '#7dffb5' : i === 4 ? '#8fb3ff' : YEL} bg="rgba(5,12,18,.88)" />)}
      {frame >= A[4] && <div dir="rtl" style={{position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 32, color: '#8aa0b0'}}>احمِ أطفالك على الإنترنت · الحلقة 11 · تك عالماشي · خلّيك ذكي!</div>}
      <VoiceTrack lines={LINES} />
      <Sfx name="blip" at={A[0] + 2} volume={0.4} /><Sfx name="pop" at={A[1] + 18} volume={0.45} /><Sfx name="buzz" at={A[1] + 24} volume={0.4} />
      {[0, 1, 2, 3].map((i) => <Sfx key={i} name="whoosh" at={A[2] + i * 12} volume={0.25} />)}
      <Sfx name="click" at={A[3] + 40} volume={0.45} /><Sfx name="ding" at={A[3] + 60} volume={0.45} /><Sfx name="ding" at={A[4] + 2} volume={0.4} />
    </AbsoluteFill>
  );
};
