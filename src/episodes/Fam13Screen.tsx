import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import {Caption, V} from '../shared/Caption';
import TL from './Fam13Screen.timeline.json';

// Family ep 13: screen time. A dark bedroom at 3 AM, the phone glowing under a blanket; then the settings panel
// (a "play hours" range + a PIN the child doesn't know) and the room turns to sunrise with a sleeping child.
// Look: deep navy night to peach dawn (a sky gradient that changes with the story), big wall clock, stars.

const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
export const FAMILY13_FRAMES = TL.frames;
const A = VOICE.map((v) => v.at);
const YEL = '#ffd23f', GRN = '#22d27a', RED = '#ff5b5b', BLUE = '#4b8bff';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const Clock: React.FC<{h: number; m: number}> = ({h, m}) => (
  <div style={{width: 300, height: 300, borderRadius: 150, background: '#f7f3ea', border: '14px solid #2b2f4a', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,.4)'}}>
    {[...Array(12)].map((_, i) => <div key={i} style={{position: 'absolute', left: 143, top: 8, width: 8, height: 22, background: '#2b2f4a', transformOrigin: '4px 134px', rotate: `${i * 30}deg`}} />)}
    <div style={{position: 'absolute', left: 142, top: 60, width: 12, height: 90, background: '#2b2f4a', borderRadius: 6, transformOrigin: '6px 90px', rotate: `${(h % 12) * 30 + m * 0.5}deg`}} />
    <div style={{position: 'absolute', left: 144, top: 28, width: 8, height: 122, background: RED, borderRadius: 4, transformOrigin: '4px 122px', rotate: `${m * 6}deg`}} />
    <div style={{position: 'absolute', left: 134, top: 134, width: 28, height: 28, borderRadius: 14, background: '#2b2f4a'}} />
  </div>
);

export const Family13Screen: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dawn = interpolate(frame, [A[3] - 6, A[3] + 40], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const mix = (a: number, b: number) => Math.round(a + (b - a) * dawn);
  const sky = `linear-gradient(180deg, rgb(${mix(10, 255)},${mix(14, 176)},${mix(40, 130)}), rgb(${mix(24, 255)},${mix(28, 222)},${mix(70, 170)}))`;
  const clockH = frame < A[3] ? 3 : 7;
  const clockM = frame < A[3] ? (frame / 5) % 60 : 0;
  const panel = spring({frame: frame - A[1], fps, config: {damping: 13}});
  const dots = Math.min(4, Math.max(0, Math.floor((frame - A[2] - 40) / 8)));
  const slide = interpolate(frame, [A[2] + 4, A[2] + 36], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const outro = spring({frame: frame - A[4], fps, config: {damping: 15}});
  const glow = 0.7 + 0.3 * Math.sin(frame / 6);
  return (
    <AbsoluteFill style={{background: sky, overflow: 'hidden'}}>
      {/* stars + moon fade away at dawn */}
      {[...Array(22)].map((_, i) => <div key={i} style={{position: 'absolute', left: (i * 197) % 1000 + 40, top: (i * 131) % 520 + 40, width: 8, height: 8, borderRadius: 4, background: '#fff', opacity: (1 - dawn) * (0.4 + 0.6 * Math.abs(Math.sin(frame / 12 + i)))}} />)}
      <div style={{position: 'absolute', right: 110, top: 150 + dawn * 260, fontSize: 140, opacity: 1 - dawn}}>🌙</div>
      <div style={{position: 'absolute', left: 110, top: 420 - (1 - dawn) * 360, fontSize: 150, opacity: dawn}}>☀️</div>

      <div style={{position: 'absolute', left: 90, top: 330}}><Clock h={clockH} m={clockM} /></div>
      {frame < A[3] && <div dir="rtl" style={{position: 'absolute', left: 430, top: 400, fontFamily: FONT, fontWeight: 900, fontSize: 96, color: RED, rotate: '-4deg'}}>٣ فجرًا!</div>}

      {/* bed + child + phone light */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 1300, height: 440, background: dawn > 0.5 ? '#c98a6a' : '#1a2140', borderRadius: '60px 60px 0 0'}} />
      <div style={{position: 'absolute', left: 150, top: 1250, width: 780, height: 360, borderRadius: 120, background: dawn > 0.5 ? '#ffb38a' : '#2a3a78'}} />
      <div style={{position: 'absolute', left: 190, top: 1130, fontSize: 190}}>{dawn > 0.5 ? '😴' : '😳'}</div>
      {frame < A[3] && <div style={{position: 'absolute', left: 430, top: 1140, width: 190, height: 300, borderRadius: 30, background: '#bde4ff', boxShadow: `0 0 ${130 * glow}px ${60 * glow}px rgba(120,200,255,.55)`, rotate: '12deg'}} />}
      {dawn > 0.5 && [0, 1, 2].map((i) => <div key={i} style={{position: 'absolute', left: 430 + i * 60, top: 1120 - i * 70 - ((frame / 2) % 30), fontFamily: FONT, fontWeight: 900, fontSize: 60 + i * 14, color: '#fff', opacity: 0.9}}>Z</div>)}

      {/* settings panel */}
      {frame >= A[1] && frame < A[3] && (
        <div dir="rtl" style={{position: 'absolute', left: 70, right: 70, top: 620, scale: `${panel}`, background: 'rgba(255,255,255,.96)', borderRadius: 50, padding: '34px 36px', fontFamily: FONT, boxShadow: '0 40px 90px rgba(0,0,0,.5)', color: '#1a1f36'}}>
          <div style={{fontWeight: 900, fontSize: 56, display: 'flex', alignItems: 'center', gap: 16}}>⏳ وقت الشاشة</div>
          <div style={{marginTop: 24, fontWeight: 700, fontSize: 38, color: '#555'}}>ساعات اللعب المسموحة</div>
          <div style={{position: 'relative', height: 40, borderRadius: 20, background: '#dfe5f2', margin: '22px 0 8px'}}>
            <div style={{position: 'absolute', right: 0, width: `${20 + slide * 40}%`, height: '100%', borderRadius: 20, background: BLUE}} />
            <div style={{position: 'absolute', right: `${20 + slide * 40}%`, top: -14, width: 68, height: 68, borderRadius: 34, background: '#fff', border: `8px solid ${BLUE}`, boxShadow: '0 6px 14px rgba(0,0,0,.3)'}} />
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 40, direction: 'ltr'}}><span>٩ م</span><span style={{color: BLUE}}>{slide > 0.9 ? '٧ ص' : '…'}</span></div>
          {frame >= A[2] + 38 && (
            <div style={{marginTop: 26, display: 'flex', alignItems: 'center', gap: 20, fontWeight: 900, fontSize: 42}}>🔒 رمزٌ لا يعرفه:
              <span style={{display: 'flex', gap: 14, direction: 'ltr'}}>{[0, 1, 2, 3].map((i) => <span key={i} style={{width: 34, height: 34, borderRadius: 17, background: i < dots ? '#1a1f36' : '#cfd6e6'}} />)}</span>
            </div>
          )}
        </div>
      )}

      {frame >= A[4] && (
        <div dir="rtl" style={{position: 'absolute', top: 620, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, opacity: outro, translate: `0 ${(1 - outro) * 80}px`}}>
          <div style={{display: 'inline-block', background: '#1a1f36', color: '#fff', borderRadius: 30, padding: '16px 40px', fontSize: 52}}>📤 أرسله لكل أب وأم</div><br />
          <div style={{display: 'inline-block', fontSize: 44, color: '#1a1f36', background: YEL, borderRadius: 26, padding: '6px 32px', marginTop: 22}}>🔔 اشترك ليصلك الدرس التالي</div><br />
          <div style={{display: 'inline-block', fontSize: 42, color: '#fff', background: BLUE, borderRadius: 26, padding: '6px 30px', marginTop: 20}}>الحلقة القادمة: حاسبة تخفي أسرار ابنك 🧮</div>
        </div>
      )}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', translate: frame >= A[4] ? '-340px 760px' : '380px 700px', opacity: interpolate(frame, [A[1] - 8, A[1] + 6], [0, 1], clamp)}}>
        <Mokaab frame={frame} scale={0.22} y={0} mood={frame < A[3] ? 'shock' : 'happy'} wave={frame >= A[4] ? 1 : 0} lookX={-0.6} talk={speaking(LINES, frame)} rings={false} />
      </div>
      {VOICE.map((v, i) => <Caption key={v.src} line={v} top={110} accent={i === 0 ? '#ff7b7b' : i === 3 ? '#7dffb5' : i === 4 ? '#8fb3ff' : YEL} bg="rgba(10,14,40,.85)" />)}
      {frame >= A[4] && <div dir="rtl" style={{position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 32, color: '#5a3a30'}}>احمِ أطفالك على الإنترنت · الحلقة 13 · تك عالماشي · خلّيك ذكي!</div>}
      <VoiceTrack lines={LINES} />
      <Sfx name="buzz" at={A[0] + 4} volume={0.35} /><Sfx name="whoosh" at={A[1]} volume={0.45} /><Sfx name="click" at={A[2] + 36} volume={0.4} />
      {[0, 1, 2, 3].map((i) => <Sfx key={i} name="tick" at={A[2] + 48 + i * 8} volume={0.3} />)}
      <Sfx name="ding" at={A[3]} volume={0.5} /><Sfx name="ding" at={A[4] + 2} volume={0.4} />
    </AbsoluteFill>
  );
};
