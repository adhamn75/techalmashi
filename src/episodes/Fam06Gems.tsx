import React from 'react';
import {AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import TL from './Fam06Gems.timeline.json';

// Family ep 6: the fake "free gems / Robux generator" — it asks for the account name and password, then steals it.
// Look: neon gamer site (teal + magenta on deep navy) that glitches into amber/red; the phone fills the frame,
// unlike ep 5's call screen. Captions word by word, synced to the TTS word timings.

type Word = {w: string; start: number; end: number};
type V = {src: string; at: number; sec: number; words: Word[]};
const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const B = TL.beats;
export const FAMILY06_FRAMES = TL.frames;

const NAVY = '#0a0f2c';
const TEAL = '#19f0d0';
const MAG = '#ff3df2';
const AMBER = '#ffb020';
const RED = '#ff3b3b';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const Caption: React.FC<{line: V; top: number; accent: string}> = ({line, top, accent}) => {
  const frame = useCurrentFrame();
  const t = (frame - line.at) / 30;
  if (t < -0.1 || t > line.sec + 0.5) return null;
  return (
    <div dir="rtl" lang="ar" style={{position: 'absolute', top, left: 50, right: 50, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 70, lineHeight: 1.4,
      opacity: interpolate(t, [line.sec + 0.2, line.sec + 0.5], [1, 0], clamp)}}>
      {line.words.map((w, i) => {
        const said = t >= w.start;
        const on = said && t < (line.words[i + 1]?.start ?? w.end + 0.3);
        return (
          <span key={i} style={{display: 'inline-block', margin: '0 0.18em', color: on ? accent : said ? '#fff' : 'rgba(255,255,255,.25)',
            translate: `0 ${said ? 0 : 12}px`, scale: on ? '1.08' : '1', textShadow: on ? `0 0 30px ${accent}` : '0 4px 16px rgba(0,0,0,.7)'}}>{w.w}</span>
        );
      })}
    </div>
  );
};

// a cut gem drawn in SVG
const Gem: React.FC<{size: number; hue?: string; rot?: number}> = ({size, hue = TEAL, rot = 0}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{rotate: `${rot}deg`, filter: `drop-shadow(0 0 ${size / 6}px ${hue})`}}>
    <polygon points="20,30 50,8 80,30 50,95" fill={hue} />
    <polygon points="20,30 50,8 50,30" fill="#fff" opacity={0.55} />
    <polygon points="50,8 80,30 50,30" fill="#fff" opacity={0.25} />
    <polygon points="20,30 50,30 50,95" fill="#000" opacity={0.15} />
    <polygon points="50,30 80,30 50,95" fill="#000" opacity={0.35} />
  </svg>
);

const Field: React.FC<{label: string; value: string; caret: boolean; danger?: boolean}> = ({label, value, caret, danger}) => (
  <div style={{marginTop: 26}}>
    <div dir="rtl" style={{fontFamily: FONT, fontWeight: 700, fontSize: 34, color: '#9aa6d8', marginBottom: 8}}>{label}</div>
    <div style={{height: 92, borderRadius: 20, background: '#121a45', border: `3px solid ${danger ? RED : '#2b377a'}`, display: 'flex', alignItems: 'center',
      padding: '0 26px', fontFamily: 'Consolas, monospace', fontSize: 46, color: '#fff', direction: 'ltr'}}>
      {value}{caret && <span style={{width: 4, height: 50, background: TEAL, marginLeft: 4}} />}
    </div>
  </div>
);

// ---------- the phone with the fake site ----------
const Site: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const count = Math.round(interpolate(frame, [10, 90], [0, 100000], {...clamp, easing: Easing.out(Easing.cubic)}));
  const tap = frame > 100 && frame < 112;
  const typing = frame >= B.type;
  const user = 'player_ali'.slice(0, Math.max(0, Math.floor((frame - B.type - 8) / 2.2)));
  const passLen = Math.max(0, Math.min(9, Math.floor((frame - B.type - 44) / 3)));
  const prog = interpolate(frame, [B.type + 74, B.stolen], [0, 87], clamp);
  const stolen = frame >= B.stolen;
  const glitch = stolen && frame < B.stolen + 18 ? Math.sin(frame * 7) * 18 : 0;
  const drop = spring({frame: frame - B.stolen - 14, fps, config: {damping: 12}});
  const accent = stolen ? RED : TEAL;
  return (
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 120, width: 820, height: 1360, borderRadius: 70, background: '#05081c', border: '14px solid #1c2147',
        overflow: 'hidden', translate: `${glitch}px 0`, boxShadow: `0 0 80px ${stolen ? 'rgba(255,59,59,.35)' : 'rgba(25,240,208,.25)'}`}}>
        <div style={{height: 70, background: '#0f1538', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Consolas, monospace', fontSize: 28, color: stolen ? RED : '#7f8bc4', direction: 'ltr'}}>
          🔓 free-gems-generator.xyz
        </div>
        <div style={{padding: '30px 50px'}}>
          {!typing ? (
            <>
              <div style={{display: 'flex', justifyContent: 'center', gap: 10, marginTop: 30, height: 300, alignItems: 'flex-end'}}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} style={{translate: `0 ${Math.sin(frame / 8 + i) * 14}px`}}><Gem size={i === 2 ? 230 : 120} hue={i % 2 ? MAG : TEAL} rot={(i - 2) * 12} /></div>
                ))}
              </div>
              <div style={{textAlign: 'center', fontFamily: 'Consolas, monospace', fontWeight: 700, fontSize: 130, color: '#fff', textShadow: `0 0 40px ${TEAL}`, marginTop: 30, direction: 'ltr'}}>
                {count.toLocaleString('en-US')}
              </div>
              <div dir="rtl" style={{textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 60, color: MAG}}>جواهر مجانية! 💎</div>
              <div style={{margin: '60px auto 0', width: 560, height: 150, borderRadius: 75, background: `linear-gradient(90deg, ${TEAL}, ${MAG})`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 64, color: NAVY, scale: `${tap ? 0.92 : 1 + Math.abs(Math.sin(frame / 6)) * 0.04}`}}>
                احصل عليها الآن
              </div>
              <div style={{textAlign: 'center', fontSize: 110, marginTop: -40, translate: `120px ${tap ? -10 : 30}px`, opacity: frame > 80 ? 1 : 0}}>👆</div>
            </>
          ) : (
            <>
              <div dir="rtl" style={{fontFamily: FONT, fontWeight: 900, fontSize: 54, color: '#fff', textAlign: 'center', marginTop: 20}}>أدخل بيانات حسابك 🎮</div>
              <Field label="اسم الحساب" value={user} caret={!stolen && frame < B.type + 40} />
              <Field label="كلمة السرّ" value={'●'.repeat(passLen)} caret={!stolen && frame >= B.type + 40} danger={frame >= B.type + 44} />
              <div style={{marginTop: 50, height: 46, borderRadius: 23, background: '#121a45', overflow: 'hidden'}}>
                <div style={{width: `${prog}%`, height: '100%', background: `linear-gradient(90deg, ${accent}, ${stolen ? AMBER : MAG})`}} />
              </div>
              <div dir="rtl" style={{fontFamily: FONT, fontWeight: 700, fontSize: 36, color: stolen ? RED : '#9aa6d8', textAlign: 'center', marginTop: 14}}>
                {stolen ? 'خطأ… الجواهر: 0' : <>جارٍ توليد الجواهر… <span style={{direction: 'ltr', unicodeBidi: 'isolate'}}>{Math.round(prog)}%</span></>}
              </div>
              {stolen && (
                <div style={{marginTop: 50, borderRadius: 30, background: '#2a0b12', border: `3px solid ${RED}`, padding: '26px 30px', scale: `${drop}`}}>
                  <div dir="rtl" style={{fontFamily: FONT, fontWeight: 900, fontSize: 40, color: '#fff'}}>⚠️ تسجيل دخول من جهاز جديد</div>
                  <div dir="rtl" style={{fontFamily: FONT, fontWeight: 700, fontSize: 34, color: '#ffb3b3', marginTop: 8}}>تم تغيير كلمة السرّ · لا يمكنك الدخول</div>
                </div>
              )}
            </>
          )}
        </div>
        {stolen && frame < B.stolen + 18 && <AbsoluteFill style={{background: 'repeating-linear-gradient(0deg, rgba(255,59,59,.22) 0 5px, transparent 5px 12px)'}} />}
      </div>
    </AbsoluteFill>
  );
};

// ---------- no generator exists ----------
const NoGen: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stamp = spring({frame: frame - 12, fps, config: {damping: 9, mass: 0.8}});
  const items = ['جواهر مجانية', 'مولّد Robux', '«تحقّق أنك إنسان»'];
  return (
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 230, display: 'flex', flexDirection: 'column', gap: 30}}>
        {items.map((t, i) => {
          const a = spring({frame: frame - i * 8, fps, config: {damping: 14}});
          return (
            <div key={t} dir="rtl" style={{width: 800, height: 140, borderRadius: 34, background: '#141a3d', display: 'flex', alignItems: 'center', gap: 26, padding: '0 40px',
              fontFamily: FONT, fontWeight: 900, fontSize: 58, color: '#fff', translate: `${(1 - a) * 300}px 0`, opacity: a}}>
              <span style={{fontSize: 70}}>❌</span><span style={{textDecoration: frame > 30 + i * 6 ? `line-through 8px ${RED}` : 'none'}}>{t}</span>
            </div>
          );
        })}
      </div>
      <div dir="rtl" style={{position: 'absolute', top: 820, fontFamily: FONT, fontWeight: 900, fontSize: 104, color: RED, border: `10px solid ${RED}`, borderRadius: 30,
        padding: '0 46px', rotate: '-7deg', scale: `${interpolate(stamp, [0, 1], [2.4, 1])}`, opacity: Math.min(1, stamp * 1.5), background: 'rgba(42,11,18,.85)'}}>
        احتيال <span style={{direction: 'ltr', unicodeBidi: 'isolate'}}>100%</span>
      </div>
    </AbsoluteFill>
  );
};

// ---------- the rule: password only inside the game ----------
const Rule: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = spring({frame, fps, config: {damping: 13}});
  return (
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 250, display: 'flex', gap: 40, alignItems: 'center', direction: 'ltr', scale: `${a}`}}>
        <div style={{width: 360, height: 420, borderRadius: 40, background: '#141a3d', border: `5px solid ${RED}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10}}>
          <div style={{fontSize: 120}}>🌐</div>
          <div dir="rtl" style={{fontFamily: FONT, fontWeight: 900, fontSize: 46, color: RED}}>موقع خارجي</div>
          <div style={{fontSize: 90}}>⛔</div>
        </div>
        <div style={{width: 360, height: 420, borderRadius: 40, background: '#0f2a2a', border: `5px solid ${TEAL}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10}}>
          <div style={{fontSize: 120}}>🎮</div>
          <div dir="rtl" style={{fontFamily: FONT, fontWeight: 900, fontSize: 46, color: TEAL}}>داخل اللعبة</div>
          <div style={{fontSize: 90}}>✅</div>
        </div>
      </div>
      <div dir="rtl" style={{position: 'absolute', top: 760, fontFamily: FONT, fontWeight: 900, fontSize: 56, color: '#fff', opacity: interpolate(frame, [20, 32], [0, 1], clamp)}}>
        🔑 كلمة السرّ = <span style={{color: TEAL}}>داخل اللعبة فقط</span>
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = spring({frame, fps, config: {damping: 12}});
  return (
    <div dir="rtl" style={{position: 'absolute', top: 1290, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, color: '#fff', opacity: a}}>
      <div style={{fontSize: 66}}>📲 أرسله لمجموعة العائلة</div>
      <div style={{fontSize: 34, color: '#8f98c8', fontWeight: 700, marginTop: 24}}>احمِ أطفالك على الإنترنت · الحلقة 6 · <span style={{direction: 'ltr', display: 'inline-block'}}>@tech3almashi</span></div>
    </div>
  );
};

export const Family06Gems: React.FC = () => {
  const frame = useCurrentFrame();
  const stolen = frame >= B.stolen;
  const hostOn = frame >= B.nogen;
  const hostBig = frame >= B.outro;
  return (
    <AbsoluteFill style={{background: stolen ? `radial-gradient(circle at 50% 30%, #2a0e1e 0%, ${NAVY} 70%)` : `radial-gradient(circle at 50% 30%, #1b2a6b 0%, ${NAVY} 70%)`, overflow: 'hidden'}}>
      <Sequence durationInFrames={B.nogen} name="Site"><Site /></Sequence>
      <Sequence from={B.nogen} durationInFrames={B.rule - B.nogen} name="NoGen"><NoGen /></Sequence>
      <Sequence from={B.rule} name="Rule"><Rule /></Sequence>
      <Sequence from={B.outro} name="Outro"><Outro /></Sequence>
      {hostOn && (
        <AbsoluteFill style={{translate: hostBig ? '0 120px' : '0 0'}}>
          <Mokaab frame={frame} scale={hostBig ? 0.42 : 0.3} y={hostBig ? -0.2 : -1.25} mood={frame < B.rule ? 'shock' : 'happy'} wave={hostBig ? 1 : 0}
            lookX={0.3} talk={speaking(LINES, frame)} rings={false} />
        </AbsoluteFill>
      )}
      {VOICE.map((v, i) => <Caption key={v.src} line={v} top={i < 3 ? 1540 : 1620} accent={i < 2 ? TEAL : i === 2 ? RED : AMBER} />)}
      <VoiceTrack lines={LINES} />
      {[12, 30, 48, 66].map((x) => <Sfx key={x} name="blip" at={x} volume={0.4} />)}
      <Sfx name="click" at={102} volume={0.5} />
      {Array.from({length: 8}, (_, i) => <Sfx key={i} name="tick" at={B.type + 10 + i * 8} volume={0.35} />)}
      <Sfx name="buzz" at={B.stolen} volume={0.55} />
      <Sfx name="pop" at={B.stolen + 14} volume={0.45} />
      <Sfx name="whoosh" at={B.nogen} volume={0.45} />
      <Sfx name="buzz" at={B.nogen + 14} volume={0.4} />
      <Sfx name="ding" at={B.rule + 4} volume={0.5} />
      <Sfx name="pop" at={B.outro} volume={0.45} />
    </AbsoluteFill>
  );
};
