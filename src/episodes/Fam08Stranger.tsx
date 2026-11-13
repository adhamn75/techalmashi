import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import TL from './Fam08Stranger.timeline.json';

// Family ep 8: the "friend" in the game chat who is not a child. Handled at pattern level only: a gift, then
// "how old are you?", then "don't tell your parents", then "let's talk on another app" — each one stamped as a
// red flag. Fix: chat = friends only, and a promise to the child: tell me any secret, you won't be punished.
// Look: a night-time GAME LOBBY (deep indigo, chunky pixel frame, orange UI) — unlike the cream statement of
// ep 7 and the green chat of ep 3. Motion: the friendly avatar card is peeled away like a sticker at frame 0.

type Word = {w: string; start: number; end: number};
type V = {src: string; at: number; sec: number; words: Word[]};
const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const B = TL.beats;
export const FAMILY08_FRAMES = TL.frames;

const NIGHT = '#120c2e';
const PANEL = '#1f1747';
const ORANGE = '#ff8a1f';
const RED = '#ff3b4e';
const GREEN = '#2ee07a';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// the chat, pattern-level: when each message lands (frame)
const MSGS = [
  {at: B.chat + 2, text: '🎁 500 جوهرة هدية!', flag: 'هدية بلا سبب'},
  {at: B.chat + 58, text: 'كم عمرك؟ 🤔', flag: 'يسأل عن العمر'},
  {at: B.chat + 102, text: 'لا تخبر أهلك 🤫', flag: 'يطلب السرّية'},
  {at: B.chat + 128, text: 'تعال نتكلم في تطبيق آخر 📲', flag: 'ينقلك لمكان خاص'},
];

const Avatar: React.FC<{size: number}> = ({size}) => (
  // a friendly blocky game avatar (original, drawn in code)
  <div style={{width: size, height: size, borderRadius: size * 0.18, background: 'linear-gradient(160deg, #46d1ff, #2b6cff)', position: 'relative', overflow: 'hidden', boxShadow: 'inset 0 -10px 0 rgba(0,0,0,.2)'}}>
    <div style={{position: 'absolute', left: '22%', top: '24%', width: '56%', height: '50%', background: '#ffd2a1', borderRadius: size * 0.06}} />
    <div style={{position: 'absolute', left: '22%', top: '18%', width: '56%', height: '14%', background: '#3b2414', borderRadius: size * 0.04}} />
    <div style={{position: 'absolute', left: '32%', top: '40%', width: '10%', height: '12%', background: '#1b1b1b', borderRadius: 2}} />
    <div style={{position: 'absolute', left: '58%', top: '40%', width: '10%', height: '12%', background: '#1b1b1b', borderRadius: 2}} />
    <div style={{position: 'absolute', left: '38%', top: '58%', width: '24%', height: '6%', background: '#c0392b', borderRadius: 4}} />
    <div style={{position: 'absolute', left: '10%', top: '80%', width: '80%', height: '30%', background: ORANGE, borderRadius: size * 0.08}} />
  </div>
);

// what may be behind the card: a faceless grown-up silhouette at a desk, no detail, never graphic
const Shadow: React.FC<{size: number}> = ({size}) => (
  <div style={{width: size, height: size, borderRadius: size * 0.18, background: 'radial-gradient(circle at 50% 30%, #3a1020, #0a0508 75%)', position: 'relative', overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: '33%', top: '16%', width: '34%', height: '34%', borderRadius: '50%', background: '#000'}} />
    <div style={{position: 'absolute', left: '14%', top: '50%', width: '72%', height: '60%', borderRadius: '45% 45% 0 0', background: '#000'}} />
    <div style={{position: 'absolute', left: 0, right: 0, bottom: '8%', textAlign: 'center', fontSize: size * 0.2, fontWeight: 900, color: RED, fontFamily: FONT}}>؟</div>
  </div>
);

const Bubble: React.FC<{m: (typeof MSGS)[number]; i: number}> = ({m, i}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - m.at, fps, config: {damping: 13}});
  const stamp = spring({frame: frame - m.at - 12, fps, config: {damping: 9, mass: 0.6}});
  if (frame < m.at) return null;
  return (
    <div dir="rtl" style={{display: 'flex', alignItems: 'center', gap: 18, marginBottom: 30, opacity: p, translate: `${(1 - p) * 120}px 0`, position: 'relative'}}>
      <div style={{width: 84, flexShrink: 0}}><Avatar size={84} /></div>
      <div style={{background: '#fff', color: NIGHT, borderRadius: 28, borderTopRightRadius: 6, padding: '16px 32px', fontFamily: FONT, fontWeight: 900, fontSize: 52}}>{m.text}</div>
      <div style={{position: 'absolute', left: 0, top: -24, scale: `${stamp}`, rotate: `${-10 + i * 6}deg`, background: RED, color: '#fff', borderRadius: 14, padding: '4px 16px', fontFamily: FONT, fontWeight: 900, fontSize: 34,
        whiteSpace: 'nowrap', boxShadow: `0 0 26px ${RED}`, border: '3px solid #fff'}}>🚩 {m.flag}</div>
    </div>
  );
};

const Toggle: React.FC<{p: number}> = ({p}) => (
  <div style={{width: 150, height: 80, borderRadius: 40, background: p > 0.5 ? GREEN : '#55507a', position: 'relative', boxShadow: p > 0.5 ? `0 0 34px ${GREEN}` : 'none'}}>
    <div style={{position: 'absolute', top: 8, left: interpolate(p, [0, 1], [78, 8]), width: 64, height: 64, borderRadius: 32, background: '#fff'}} />
  </div>
);

const Caption: React.FC<{line: V; top: number; accent: string}> = ({line, top, accent}) => {
  const frame = useCurrentFrame();
  const t = (frame - line.at) / 30;
  if (t < -0.1 || t > line.sec + 0.4) return null;
  return (
    <div dir="rtl" lang="ar" style={{position: 'absolute', top, left: 40, right: 40, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 70, lineHeight: 1.35,
      opacity: interpolate(t, [line.sec + 0.15, line.sec + 0.4], [1, 0], clamp)}}>
      {line.words.map((w, i) => {
        const said = t >= w.start;
        const on = said && t < (line.words[i + 1]?.start ?? w.end + 0.3);
        return (
          <span key={i} style={{display: 'inline-block', margin: '0 0.15em', color: on ? accent : said ? '#fff' : 'rgba(255,255,255,.3)',
            translate: `0 ${said ? 0 : 12}px`, textShadow: on ? `0 0 26px ${accent}, 0 4px 10px rgba(0,0,0,.8)` : '0 4px 14px rgba(0,0,0,.85)'}}>{w.w}</span>
        );
      })}
    </div>
  );
};

// a QR-like block pattern for the teaser (random, not a real code)
const QR: React.FC<{size: number; f: number}> = ({size, f}) => {
  const n = 13;
  const cells = Array.from({length: n * n}, (_, i) => {
    const x = i % n, y = Math.floor(i / n);
    const finder = (x < 4 && y < 4) || (x > n - 5 && y < 4) || (x < 4 && y > n - 5);
    if (finder) return (x % 3 === 0 || y % 3 === 0 || (x % n > n - 5 && (x === n - 1 || x === n - 4))) ? 1 : (x === 1 || x === n - 3) && (y === 1 || y === n - 3) ? 1 : 0;
    return Math.sin(i * 12.9898 + 4) * 43758.5 % 1 > 0.0 ? 1 : 0;
  });
  return (
    <div style={{width: size, height: size, background: '#fff', borderRadius: 16, padding: 12, display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, filter: `blur(${3 + Math.sin(f / 6) * 1.5}px)`}}>
      {cells.map((c, i) => <div key={i} style={{background: c ? '#111' : '#fff'}} />)}
    </div>
  );
};

export const Family08Stranger: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // hook: the friendly card peels away from the corner and shows the shadow behind it
  const peel = interpolate(frame, [22, 62], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const hookOut = interpolate(frame, [B.chat - 10, B.chat], [1, 0], clamp);
  const fixIn = spring({frame: frame - B.fix, fps, config: {damping: 15}});
  const flip = interpolate(frame, [B.fix + 22, B.fix + 32], [0, 1], clamp);
  const talkIn = spring({frame: frame - B.talk, fps, config: {damping: 14}});
  const so = spring({frame: frame - B.outro, fps, config: {damping: 15}});
  const chatOn = frame >= B.chat - 6 && frame < B.fix;
  const flags = MSGS.filter((m) => frame >= m.at + 12).length;
  const scene = frame < B.chat ? 'hook' : frame < B.fix ? 'chat' : frame < B.talk ? 'fix' : frame < B.outro ? 'talk' : 'outro';

  return (
    <AbsoluteFill style={{background: `radial-gradient(110% 70% at 50% 20%, #2c1f6b 0%, ${NIGHT} 60%, #07041a 100%)`, overflow: 'hidden'}}>
      {/* pixel stars */}
      {Array.from({length: 40}, (_, i) => (
        <div key={i} style={{position: 'absolute', left: (i * 263) % 1080, top: (i * 431) % 1920, width: 8, height: 8, background: i % 3 ? '#6c5fd6' : ORANGE,
          opacity: 0.25 + 0.25 * Math.sin(frame / 10 + i)}} />
      ))}

      {/* HOOK: a friend card in the game lobby */}
      {scene === 'hook' && (
        <div style={{position: 'absolute', left: 110, top: 230, width: 860, opacity: hookOut}}>
          <div dir="rtl" style={{background: PANEL, border: `6px solid ${ORANGE}`, borderRadius: 30, padding: 34, boxShadow: `0 0 0 6px #000, 0 30px 80px rgba(0,0,0,.6)`}}>
            <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 40, color: ORANGE, marginBottom: 20}}>🎮 طلب صداقة جديد</div>
            <div style={{position: 'relative', width: 420, height: 420, margin: '0 auto'}}>
              <div style={{position: 'absolute', inset: 0}}><Shadow size={420} /></div>
              <div style={{position: 'absolute', inset: 0, transformOrigin: '100% 0%', transform: `perspective(900px) rotateY(${peel * -100}deg) rotateZ(${peel * 10}deg)`,
                boxShadow: `${-30 * peel}px ${20 * peel}px 40px rgba(0,0,0,${0.6 * peel})`, borderRadius: 76}}>
                <Avatar size={420} />
              </div>
            </div>
            <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 52, color: '#fff', textAlign: 'center', marginTop: 22}}>
              <span style={{direction: 'ltr', unicodeBidi: 'isolate'}}>Pro_Ninja12</span> ⭐
            </div>
            <div style={{fontFamily: FONT, fontWeight: 700, fontSize: 34, color: '#b9b0ea', textAlign: 'center'}}>«عمري 12 مثلك 😄»</div>
          </div>
          <div dir="rtl" style={{marginTop: 30, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 56, color: RED, opacity: peel, textShadow: `0 0 24px ${RED}`}}>
            من خلف الصورة فعلًا؟
          </div>
        </div>
      )}

      {/* CHAT: the pattern, one red flag at a time */}
      {chatOn && (
        <div style={{position: 'absolute', left: 40, right: 40, top: 240, background: PANEL, border: `6px solid ${ORANGE}`, borderRadius: 30, padding: '24px 30px 10px',
          boxShadow: '0 0 0 6px #000', opacity: interpolate(frame, [B.chat - 6, B.chat + 4], [0, 1], clamp)}}>
          <div dir="rtl" style={{display: 'flex', justifyContent: 'space-between', fontFamily: FONT, fontWeight: 900, fontSize: 36, color: ORANGE, marginBottom: 22}}>
            <span>💬 دردشة اللعبة</span>
            <span style={{color: flags ? RED : '#8c84c4'}}>علامات خطر: {flags}/4</span>
          </div>
          {MSGS.map((m, i) => <Bubble key={i} m={m} i={i} />)}
        </div>
      )}

      {/* FIX: chat = friends only */}
      {scene === 'fix' && (
        <div dir="rtl" style={{position: 'absolute', left: 70, right: 70, top: 360, background: '#f4f2ff', borderRadius: 36, padding: '40px 44px', scale: `${0.8 + 0.2 * fixIn}`, opacity: fixIn,
          boxShadow: `0 0 70px ${GREEN}55`}}>
          <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 50, color: NIGHT, marginBottom: 26}}>⚙️ إعدادات الخصوصية</div>
          {[['من يراسلني؟', 'الأصدقاء فقط'], ['طلبات الصداقة', 'بموافقتي فقط']].map(([k, v], i) => (
            <div key={k} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 0', borderTop: i ? '2px solid #ddd' : 'none'}}>
              <div>
                <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 54, color: NIGHT}}>{k}</div>
                <div style={{fontFamily: FONT, fontWeight: 700, fontSize: 42, color: flip > 0.5 ? '#14924a' : '#888'}}>{flip > 0.5 ? v : 'الجميع'}</div>
              </div>
              <Toggle p={interpolate(frame, [B.fix + 22 + i * 8, B.fix + 32 + i * 8], [0, 1], clamp)} />
            </div>
          ))}
        </div>
      )}

      {/* TALK: the promise that keeps the door open */}
      {scene === 'talk' && (
        <div dir="rtl" style={{position: 'absolute', left: 80, right: 80, top: 300, textAlign: 'center', opacity: talkIn, translate: `0 ${(1 - talkIn) * 80}px`}}>
          <div style={{display: 'inline-block', background: '#fff', color: NIGHT, borderRadius: 44, borderBottomLeftRadius: 8, padding: '34px 44px', fontFamily: FONT, fontWeight: 900, fontSize: 76, lineHeight: 1.35,
            boxShadow: `0 0 60px ${ORANGE}66`}}>
            أخبرني بأيّ سرّ…<br /><span style={{color: '#14924a'}}>ولن تُعاقَب 💛</span>
          </div>
          <div style={{marginTop: 40, fontSize: 220, scale: `${1 + 0.06 * Math.sin(frame / 5)}`}}>🫂</div>
        </div>
      )}

      {/* OUTRO: teaser + subscribe */}
      {scene === 'outro' && (
        <div dir="rtl" style={{position: 'absolute', top: 210, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, opacity: so}}>
          <div style={{fontSize: 46, color: ORANGE}}>الحلقة القادمة 👀</div>
          <div style={{display: 'flex', justifyContent: 'center', margin: '26px 0', rotate: `${(1 - so) * -8}deg`}}><QR size={360} f={frame} /></div>
          <div style={{fontSize: 60, color: '#fff'}}>رمز QR… يسرق هاتفك؟</div>
          <div style={{display: 'inline-block', fontSize: 46, color: NIGHT, background: '#ffd35a', borderRadius: 26, padding: '6px 34px', marginTop: 30,
            opacity: interpolate(frame, [B.outro + 14, B.outro + 24], [0, 1], clamp)}}>🔔 اشترك ليصلك الدرس التالي</div><br />
          <div style={{display: 'inline-block', fontSize: 38, color: '#d8d2ff', marginTop: 18, opacity: interpolate(frame, [B.outro + 24, B.outro + 34], [0, 1], clamp)}}>أرسله لمجموعة العائلة 👨‍👩‍👧</div>
        </div>
      )}

      {/* host */}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity: frame < B.fix ? 0 : fixIn,
        translate: scene === 'outro' ? '-360px 380px' : scene === 'talk' ? '0px 320px' : '330px 420px'}}>
        <Mokaab frame={frame} scale={scene === 'talk' ? 0.32 : 0.26} y={0} mood={scene === 'fix' ? 'smirk' : 'happy'} wave={scene === 'outro' ? 1 : 0}
          lookX={scene === 'fix' ? -0.6 : 0} talk={speaking(LINES, frame)} rings={false} />
      </div>

      {VOICE.map((v, i) => <Caption key={v.src} line={v} top={i === 1 ? 1330 : 1560} accent={i === 1 ? RED : i === 2 || i === 3 ? GREEN : ORANGE} />)}
      <div dir="rtl" style={{position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 30, color: '#8c84c4',
        opacity: scene === 'outro' ? 1 : 0}}>احمِ أطفالك على الإنترنت · الحلقة 8 · تك عالماشي · خلّيك ذكي!</div>

      <VoiceTrack lines={LINES} />
      <Sfx name="whoosh" at={24} volume={0.45} />
      <Sfx name="buzz" at={58} volume={0.4} />
      {MSGS.map((m) => <Sfx key={m.at} name="pop" at={m.at} volume={0.45} />)}
      {MSGS.map((m) => <Sfx key={`f${m.at}`} name="buzz" at={m.at + 12} volume={0.35} />)}
      <Sfx name="click" at={B.fix + 22} volume={0.55} />
      <Sfx name="ding" at={B.fix + 32} volume={0.45} />
      <Sfx name="pop" at={B.talk} volume={0.4} />
      <Sfx name="whoosh" at={B.outro} volume={0.45} />
    </AbsoluteFill>
  );
};
