import React from 'react';
import {AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import TL from './Fam05Voice.timeline.json';

// Family ep 5: a call in your son's voice asking for money — it's an AI voice clone.
// First episode using the official Remotion skills: word-by-word Arabic captions synced to the TTS
// word timings (voice/<ep>/<n>.words.json), animated per word with dir="rtl" so letters stay joined.
// Look: deep violet night, lilac accents, a live waveform built from the real call audio.

type Word = {w: string; start: number; end: number};
type V = {src: string; at: number; sec: number; words: Word[]};
const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const B = TL.beats;
const ENV: number[] = TL.callEnvelope; // loudness of the call line, one value per frame (0..1)
export const FAMILY05_FRAMES = TL.frames;

const NIGHT = '#130a24';
const LILAC = '#b69cff';
const CALL = '#34c759';
const RED = '#ff453a';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// ---------- word-by-word captions (remotion-markup/arabic-text.md: animate words, base direction rtl) ----------
const Karaoke: React.FC<{line: V; top?: number; size?: number; accent?: string}> = ({line, top = 1500, size = 70, accent = LILAC}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = (frame - line.at) / fps;
  if (t < -0.1 || t > line.sec + 0.8) return null;
  return (
    <div dir="rtl" lang="ar" style={{position: 'absolute', top, left: 60, right: 60, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.45,
      opacity: interpolate(t, [line.sec + 0.4, line.sec + 0.8], [1, 0], clamp)}}>
      {line.words.map((w, i) => {
        const on = t >= w.start && t < (line.words[i + 1]?.start ?? w.end + 0.3);
        const said = t >= w.start;
        return (
          <span key={i} style={{display: 'inline-block', margin: '0 0.2em', color: on ? accent : said ? '#fff' : 'rgba(255,255,255,.28)',
            scale: on ? '1.06' : '1', translate: `0 ${said ? 0 : 10}px`, textShadow: on ? `0 0 28px ${accent}` : '0 4px 18px rgba(0,0,0,.6)'}}>{w.w}</span>
        );
      })}
    </div>
  );
};

const Wave: React.FC<{from: number; bars?: number; color: string; h?: number; fake?: boolean}> = ({from, bars = 34, color, h = 220, fake}) => {
  const frame = useCurrentFrame();
  const k = Math.max(0, frame - from);
  return (
    <div style={{display: 'flex', gap: 8, alignItems: 'center', height: h, justifyContent: 'center'}}>
      {Array.from({length: bars}, (_, i) => {
        const e = ENV[Math.min(ENV.length - 1, k + Math.abs(i - bars / 2))] ?? 0;
        const v = fake ? 0.25 + 0.75 * Math.abs(Math.sin(frame / 5 + i * 0.7)) * 0.8 : e;
        return <div key={i} style={{width: 14, borderRadius: 7, background: color, height: 10 + v * (h - 10) * (0.55 + 0.45 * Math.sin(i * 1.7 + frame / 3) ** 2)}} />;
      })}
    </div>
  );
};

// ---------- 1. the call (hook = the son's voice, frame 0) ----------
const Call: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ring = frame < B.answer;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 170, width: '100%', textAlign: 'center', direction: 'rtl'}}>
        <div style={{fontFamily: FONT, fontWeight: 700, fontSize: 42, color: '#a99cc8'}}>{ring ? 'مكالمة واردة…' : '00:0' + Math.floor(frame / fps)}</div>
        <div style={{width: 260, height: 260, borderRadius: 130, margin: '40px auto 26px', background: 'linear-gradient(160deg,#6e5ab8,#2b1d52)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 150,
          scale: `${1 + (ring ? Math.abs(Math.sin(frame / 5)) * 0.05 : 0)}`, boxShadow: ring ? `0 0 0 ${10 + (frame % 20)}px rgba(182,156,255,${0.3 - (frame % 20) / 70})` : 'none'}}>👦</div>
        <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 84, color: '#fff'}}>ابني 💙</div>
      </div>
      <div style={{position: 'absolute', top: 820, width: '100%'}}>{!ring && <Wave from={B.answer} color={CALL} />}</div>
      {ring && (
        <div style={{position: 'absolute', top: 1500, width: '100%', display: 'flex', justifyContent: 'space-around'}}>
          {[RED, CALL].map((c, i) => (
            <div key={c} style={{width: 170, height: 170, borderRadius: 85, background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80,
              rotate: i === 0 ? '135deg' : '0deg', scale: i === 1 ? `${1 + Math.abs(Math.sin(frame / 4)) * 0.08}` : '1'}}>📞</div>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};

// ---------- 2. it isn't him ----------
const Fake: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const flip = interpolate(frame, [0.5 * fps, 1.1 * fps], [0, 1], {...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1)});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 260, left: 140, right: 140, height: 560, borderRadius: 48, background: '#1d1236', border: `4px solid ${flip > 0.5 ? RED : '#3b2a66'}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, overflow: 'hidden'}}>
        <div style={{fontSize: 190, scale: `${1 - Math.abs(0.5 - flip) < 0.55 ? 1 : 1}`, filter: flip > 0.45 && flip < 0.6 ? 'blur(6px)' : 'none'}}>{flip < 0.5 ? '👦' : '🤖'}</div>
        <div dir="rtl" style={{fontFamily: FONT, fontWeight: 900, fontSize: 56, color: flip < 0.5 ? '#fff' : RED}}>{flip < 0.5 ? 'ابني 💙' : 'صوت مُقلَّد بالذكاء الاصطناعي'}</div>
        {flip > 0.45 && flip < 0.62 && <AbsoluteFill style={{background: 'repeating-linear-gradient(0deg, rgba(255,69,58,.25) 0 6px, transparent 6px 14px)'}} />}
      </div>
      <div style={{position: 'absolute', top: 900, width: '100%'}}><Wave from={B.fake} color={flip > 0.5 ? RED : CALL} fake h={180} /></div>
    </AbsoluteFill>
  );
};

// ---------- 3. three seconds of any video ----------
const Clone: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sel = interpolate(frame, [0.3 * fps, 1.2 * fps], [0, 1], {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)});
  const arrow = interpolate(frame, [1.3 * fps, 1.9 * fps], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 230, left: 120, right: 120, height: 620, borderRadius: 36, background: 'linear-gradient(160deg,#3a2a6e,#1a1033)', overflow: 'hidden'}}>
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 200}}>👦🎮</div>
        <div style={{position: 'absolute', left: 40, right: 40, bottom: 40, height: 14, borderRadius: 7, background: 'rgba(255,255,255,.25)'}}>
          <div style={{position: 'absolute', left: '30%', width: `${sel * 14}%`, top: -10, bottom: -10, borderRadius: 10, background: LILAC, boxShadow: `0 0 24px ${LILAC}`}} />
        </div>
        <div style={{position: 'absolute', top: 30, left: 30, fontFamily: 'monospace', fontWeight: 700, fontSize: 40, color: '#fff', background: 'rgba(0,0,0,.5)', borderRadius: 12, padding: '4px 16px'}}>0:03</div>
      </div>
      <div style={{position: 'absolute', top: 880, width: '100%', textAlign: 'center', fontSize: 110, opacity: arrow, translate: `0 ${(1 - arrow) * -30}px`}}>⬇️</div>
      <div style={{position: 'absolute', top: 1040, width: '100%', opacity: arrow}}><Wave from={B.clone} color={LILAC} fake h={200} /></div>
    </AbsoluteFill>
  );
};

// ---------- 4. the family password ----------
const Password: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const card = spring({frame, fps, config: {damping: 13}});
  const ask = spring({frame: frame - B.ask + B.password, fps, config: {damping: 12}});
  const end = interpolate(frame, [B.ask - B.password + 1.6 * fps, B.ask - B.password + 2 * fps], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 230, left: 110, right: 110, borderRadius: 40, background: '#fff', padding: '40px 30px', textAlign: 'center', scale: `${card}`}}>
        <div style={{fontSize: 110}}>🔐</div>
        <div dir="rtl" style={{fontFamily: FONT, fontWeight: 900, fontSize: 58, color: NIGHT}}>كلمة سرّ العائلة</div>
        <div dir="rtl" style={{fontFamily: FONT, fontWeight: 900, fontSize: 76, color: '#6e4fd8', marginTop: 10}}>«زرافة زرقاء» 🦒</div>
        <div dir="rtl" style={{fontFamily: FONT, fontWeight: 700, fontSize: 34, color: '#6b6386', marginTop: 10}}>مثال فقط: اختاروا كلمتكم ولا تنشروها</div>
      </div>
      <div dir="rtl" style={{position: 'absolute', top: 860, right: 110, maxWidth: 760, background: '#2a1c4d', borderRadius: 34, borderTopRightRadius: 8, padding: '22px 34px',
        fontFamily: FONT, fontWeight: 900, fontSize: 54, color: '#fff', scale: `${ask}`, transformOrigin: 'right top'}}>ما هي كلمة السرّ؟ 🤨</div>
      <div dir="rtl" style={{position: 'absolute', top: 1060, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 60, color: RED, opacity: end}}>📵 انتهت المكالمة</div>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = spring({frame, fps, config: {damping: 12}});
  return (
    <AbsoluteFill>
      <AbsoluteFill><Mokaab frame={frame} scale={a * 0.6} y={0.9} mood="happy" wave={1} talk={0} rings={false} /></AbsoluteFill>
      <div dir="rtl" style={{position: 'absolute', top: 1200, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, color: '#fff', opacity: a}}>
        <div style={{fontSize: 70}}>📲 أرسله لمجموعة العائلة</div>
        <div style={{fontSize: 46, color: LILAC, marginTop: 16}}>واتّفقوا على كلمتكم الليلة</div>
        <div style={{fontSize: 34, color: '#8f84ad', fontWeight: 700, marginTop: 40}}>احمِ أطفالك على الإنترنت · الحلقة 5 · <span style={{direction: 'ltr', display: 'inline-block'}}>@tech3almashi</span></div>
      </div>
    </AbsoluteFill>
  );
};

export const Family05Voice: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 50% 30%, #2a1650 0%, ${NIGHT} 65%)`, overflow: 'hidden'}}>
      <Sequence durationInFrames={B.fake} name="Call"><Call /></Sequence>
      <Sequence from={B.fake} durationInFrames={B.clone - B.fake} name="Fake"><Fake /></Sequence>
      <Sequence from={B.clone} durationInFrames={B.password - B.clone} name="Clone"><Clone /></Sequence>
      <Sequence from={B.password} durationInFrames={B.outro - B.password} name="Password"><Password /></Sequence>
      <Sequence from={B.outro} name="Outro"><Outro /></Sequence>
      {VOICE.map((v, i) => <Karaoke key={v.src} line={v} accent={i === 0 ? CALL : LILAC} top={i === 0 ? 1180 : 1300} size={i === 0 ? 66 : 66} />)}
      {frame >= B.fake && frame < B.outro && (
        <AbsoluteFill><Mokaab frame={frame} scale={0.28} y={-3.15} mood={frame < B.clone ? 'shock' : 'smirk'} lookX={0.5} talk={speaking(LINES.slice(1), frame)} rings={false} /></AbsoluteFill>
      )}
      <VoiceTrack lines={LINES} />
      {[0, 20, 40].map((x) => <Sfx key={x} name="blip" at={x} volume={0.45} />)}
      <Sfx name="click" at={B.answer} volume={0.5} />
      <Sfx name="buzz" at={B.fake + 22} volume={0.45} />
      <Sfx name="whoosh" at={B.clone} volume={0.45} />
      <Sfx name="pop" at={B.password} volume={0.5} />
      <Sfx name="pop" at={B.ask} volume={0.45} />
      <Sfx name="ding" at={B.outro} volume={0.5} />
    </AbsoluteFill>
  );
};
