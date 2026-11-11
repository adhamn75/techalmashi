import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import TL from './H06OwnNumber.timeline.json';
import {Face} from './HoodedFace';

// Horror ep 6 — «رقمي أنا». 3 a.m., my own number calls me. My own voice: "open the door, I'm outside".
// But I never left the house. The call drops, the phone screen goes black… and in its reflection, behind me, the hood.
// Different from ep 4 (CCTV feed) and ep 5 (mirror): a hand-held phone in the dark, then the front door, then the
// black-screen reflection. Black and blood-red, fog, flicker, silence before the scare. Never gore.

const FONT = 'Cairo, sans-serif';
const RED = '#ff1a33';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H06_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));

const rnd = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={at} durationInFrames={dur} layout="none"><Audio src={staticFile(name.includes('/') ? name : `sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1610, size = 68}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#f2ecea', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000'}}>{text}</div>
  );
};

const Fog: React.FC<{f: number; o?: number}> = ({f, o = 0.5}) => (
  <AbsoluteFill style={{opacity: o, pointerEvents: 'none'}}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{position: 'absolute', left: -400 + ((f * (0.6 + i * 0.3) + i * 500) % 1400), top: 900 + i * 260, width: 1400, height: 520, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(120,20,30,.22) 0%, transparent 70%)', filter: 'blur(30px)'}} />
    ))}
  </AbsoluteFill>
);

const Grain: React.FC<{f: number}> = ({f}) => (
  <AbsoluteFill style={{opacity: 0.06, mixBlendMode: 'screen', pointerEvents: 'none',
    backgroundImage: `repeating-radial-gradient(circle at ${rnd(f) * 100}% ${rnd(f + 3) * 100}%, rgba(255,255,255,.5) 0 1px, transparent 1px 3px)`}} />
);

// ---------- the phone in my hand ----------
const PW = 640, PH = 1180;
const Phone: React.FC<{f: number; children: React.ReactNode; glow?: number; shake?: number}> = ({f, children, glow = 1, shake = 0}) => (
  <div style={{position: 'absolute', left: (1080 - PW) / 2, top: 300, width: PW, height: PH, borderRadius: 80, background: '#050505', border: '10px solid #161616',
    overflow: 'hidden', translate: `${(rnd(f) - 0.5) * shake}px ${(rnd(f + 7) - 0.5) * shake}px`, rotate: `${Math.sin(f / 40) * 1.2}deg`,
    boxShadow: `0 0 ${160 * glow}px rgba(255,26,51,${0.25 * glow})`}}>
    {children}
  </div>
);

// a hand holding it (a dark silhouette, lit from the screen)
const Hand: React.FC = () => (
  <svg width={1080} height={900} viewBox="0 0 1080 900" style={{position: 'absolute', left: 0, top: 1220}}>
    <path d="M300 120 C260 160 250 260 280 340 L330 900 L760 900 L800 380 C830 300 820 200 790 140 C770 110 740 120 735 160 L720 230 L360 230 L345 150 C340 110 320 100 300 120 Z" fill="#0b0607" />
    <path d="M300 120 C260 160 250 260 280 340" stroke="#4a0a12" strokeWidth={6} fill="none" opacity={0.7} />
    <path d="M790 140 C820 200 830 300 800 380" stroke="#4a0a12" strokeWidth={6} fill="none" opacity={0.7} />
  </svg>
);

const Incoming: React.FC<{f: number}> = ({f}) => {
  const ring = Math.abs(Math.sin(f / 4));
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg, #1a0306 0%, #050000 70%)', alignItems: 'center'}}>
      <div style={{marginTop: 80, fontFamily: 'Consolas, monospace', fontSize: 110, color: '#e9dcdc', fontWeight: 300}}>03:00</div>
      <div dir="rtl" style={{fontFamily: FONT, fontWeight: 700, fontSize: 36, color: '#a88'}}>مكالمة واردة…</div>
      <div style={{width: 220, height: 220, borderRadius: 110, marginTop: 50, background: '#2a0a0e', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 0 ${10 + ring * 18}px rgba(255,26,51,${0.25 - ring * 0.15})`}}>
        <svg width={120} height={120} viewBox="0 0 100 100"><circle cx={50} cy={36} r={20} fill="#6b3a3f" /><path d="M14 96 C14 66 86 66 86 96 Z" fill="#6b3a3f" /></svg>
      </div>
      <div dir="rtl" style={{fontFamily: FONT, fontWeight: 900, fontSize: 80, color: '#fff', marginTop: 30}}>أنا</div>
      <div style={{fontFamily: 'Consolas, monospace', fontSize: 40, color: RED, direction: 'ltr', marginTop: 4}}>(رقمي)</div>
      <div style={{position: 'absolute', bottom: 120, width: '100%', display: 'flex', justifyContent: 'space-around'}}>
        {['#7a0010', '#1f6b35'].map((c, i) => (
          <div key={c} style={{width: 130, height: 130, borderRadius: 65, background: c, display: 'flex', alignItems: 'center', justifyContent: 'center',
            scale: i === 1 ? `${1 + ring * 0.07}` : '1'}}>
            <svg width={60} height={60} viewBox="0 0 24 24" style={{rotate: i === 0 ? '135deg' : '0deg'}}><path fill="#fff" d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.6 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.4 11.4 0 00.6 3.6 1 1 0 01-.25 1z" /></svg>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const InCall: React.FC<{f: number; talking: boolean}> = ({f, talking}) => {
  const s = Math.max(0, f - B.answer);
  const t = `00:${String(Math.floor(s / 30)).padStart(2, '0')}`;
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg, #120204 0%, #000 80%)', alignItems: 'center'}}>
      <div dir="rtl" style={{marginTop: 120, fontFamily: FONT, fontWeight: 900, fontSize: 80, color: '#fff'}}>أنا</div>
      <div style={{fontFamily: 'Consolas, monospace', fontSize: 44, color: '#a88'}}>{t}</div>
      <div style={{display: 'flex', gap: 10, alignItems: 'center', height: 380, marginTop: 120}}>
        {Array.from({length: 22}, (_, i) => {
          const v = talking ? 0.2 + 0.8 * Math.abs(Math.sin(f / 3.3 + i * 0.9) * Math.sin(f / 7 + i * 0.4)) : 0.04;
          return <div key={i} style={{width: 12, borderRadius: 6, background: RED, height: 12 + v * 360, opacity: 0.85, boxShadow: `0 0 18px ${RED}`}} />;
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------- the front door at the end of the dark hall ----------
const Door: React.FC<{f: number}> = ({f}) => {
  const k = f - B.inside;
  const push = interpolate(k, [0, B.silence - B.inside], [1, 1.35], {...clamp, easing: Easing.in(Easing.quad)});
  const feet = k < 70; // the shadows under the door vanish
  const flick = rnd(Math.floor(f / 2)) > 0.9 ? 0.4 : 1;
  const knob = interpolate(k, [30, 46, 60, 70], [0, -28, -28, 0], clamp);
  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, scale: `${push}`, transformOrigin: '50% 55%'}}>
        <svg width={1080} height={1920} viewBox="0 0 1080 1920">
          <defs>
            <radialGradient id="h6hall" cx="50%" cy="52%" r="60%"><stop offset="0" stopColor="#3a0a10" /><stop offset="1" stopColor="#000" /></radialGradient>
            <linearGradient id="h6slit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={RED} /><stop offset="1" stopColor="#5a0008" /></linearGradient>
            <filter id="h6blur"><feGaussianBlur stdDeviation="14" /></filter>
          </defs>
          <rect width={1080} height={1920} fill="url(#h6hall)" />
          {/* hall walls in perspective */}
          <polygon points="0,0 360,620 360,1360 0,1920" fill="#070203" />
          <polygon points="1080,0 720,620 720,1360 1080,1920" fill="#080203" />
          <polygon points="0,1920 360,1360 720,1360 1080,1920" fill="#0d0405" />
          {/* door */}
          <rect x={390} y={680} width={300} height={670} fill="#1c0608" stroke="#6a1018" strokeWidth={8} />
          <rect x={420} y={720} width={240} height={250} fill="none" stroke="#3a0b10" strokeWidth={6} />
          <rect x={420} y={1010} width={240} height={300} fill="none" stroke="#3a0b10" strokeWidth={6} />
          <g transform={`rotate(${knob} 650 1020)`}><rect x={630} y={1012} width={44} height={14} rx={7} fill="#5a4a48" /></g>
          <circle cx={650} cy={1020} r={14} fill="#6b5a57" />
          {/* light under the door, with two shadows of feet */}
          <rect x={392} y={1346} width={296} height={10} fill="url(#h6slit)" opacity={flick} />
          <ellipse cx={540} cy={1380} rx={300} ry={70} fill={RED} opacity={0.35 * flick} filter="url(#h6blur)" />
          {feet && <rect x={470} y={1346} width={50} height={10} fill="#000" />}
          {feet && <rect x={560} y={1346} width={50} height={10} fill="#000" />}
        </svg>
      </div>
      <Fog f={f} o={0.8} />
    </AbsoluteFill>
  );
};

export const H06OwnNumber: React.FC = () => {
  const f = useCurrentFrame();
  const ringing = f < B.answer;
  const call = f >= B.answer && f < B.inside;
  const door = f >= B.inside && f < B.silence;
  const reflect = f >= B.silence && f < B.scare;
  const scare = f >= B.scare && f < B.black;
  const selfV = VO[1];
  const talking = f >= selfV.at && f < selfV.at + selfV.dur;
  const camPush = interpolate(f, [0, B.inside], [1, 1.12], clamp);
  const eyes = interpolate(f, [B.silence + 6, B.scare - 4], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  const shake = scare ? Math.max(0, 1 - (f - B.scare) / 26) * 26 : 0;
  const flash = interpolate(f, [B.scare, B.scare + 2, B.scare + 16], [0, 0.75, 0], clamp);
  const sp = interpolate(f, [B.scare, B.scare + 8], [0.65, 1], {...clamp, easing: Easing.out(Easing.back(1.6))});
  const facePush = interpolate(f, [B.scare, B.black], [1, 1.14], clamp);

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {(ringing || call) && (
        <AbsoluteFill style={{scale: `${camPush}`}}>
          <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 40%, #1a0306 0%, #000 60%)'}} />
          <Phone f={f} shake={ringing ? 6 : 0} glow={ringing ? 0.6 + Math.abs(Math.sin(f / 4)) * 0.4 : 0.8}>
            {ringing ? <Incoming f={f} /> : <InCall f={f} talking={talking} />}
          </Phone>
          <Hand />
          <Fog f={f} o={0.5} />
        </AbsoluteFill>
      )}

      {door && <Door f={f} />}

      {reflect && (
        <AbsoluteFill>
          <Phone f={f} glow={0}>
            {/* the black screen: a faint reflection of me… and something behind me */}
            <AbsoluteFill style={{background: 'linear-gradient(160deg, #0c0c0c 0%, #000 60%)'}} />
            <div style={{position: 'absolute', left: 60, top: 160, width: 520, height: 680, opacity: 0.08 + eyes * 0.5, filter: `blur(${(1 - eyes) * 6}px)`}}>
              <Face f={f} eye={eyes} />
            </div>
            <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,.05) 45%, transparent 60%)'}} />
          </Phone>
          <Hand />
          <div dir="rtl" style={{position: 'absolute', top: 160, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 40, color: '#7a5a5c'}}>انتهت المكالمة</div>
        </AbsoluteFill>
      )}

      {scare && (
        <AbsoluteFill style={{translate: `${(rnd(f) - 0.5) * shake}px ${(rnd(f + 9) - 0.5) * shake}px`}}>
          <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 40%, #3a0008 0%, #000 65%)'}} />
          <div style={{position: 'absolute', left: -60, top: 120, width: 1200, height: 1560, scale: `${sp * facePush}`, transformOrigin: '50% 35%'}}>
            <Face f={f} eye={rnd(Math.floor(f / 3)) > 0.07 ? 1 : 0.4} />
          </div>
          <Fog f={f} o={0.6} />
        </AbsoluteFill>
      )}

      <Grain f={f} />
      <AbsoluteFill style={{background: RED, opacity: flash, mixBlendMode: 'screen'}} />
      <AbsoluteFill style={{background: '#000', opacity: interpolate(f, [B.inside - 6, B.inside, B.inside + 4], [0, 1, 0], clamp)}} />
      <AbsoluteFill style={{background: '#000', opacity: interpolate(f, [B.black - 4, B.black], [0, 1], clamp)}} />
      {f >= B.black && (
        <div style={{position: 'absolute', top: 900, width: '100%', textAlign: 'center', fontFamily: 'Consolas, monospace', fontSize: 50, color: RED, opacity: rnd(f) > 0.3 ? 1 : 0.3}}>📞 03:00</div>
      )}

      <Caption f={f} from={0} to={B.answer - 4} text="الساعة الثالثة… اتّصل بي رقمي أنا" size={70} />
      <Caption f={f} from={B.answer + 8} to={B.inside - 6} text="«افتح الباب… أنا في الخارج»" red size={74} />
      <Caption f={f} from={B.answer + 8} to={B.inside - 6} text="صوتي أنا" y={1500} size={44} />
      <Caption f={f} from={B.inside + 2} to={B.silence - 2} text="لكنّي… لم أخرج من البيت" />
      <Caption f={f} from={B.scare + 6} to={B.black - 2} text="أعرف… لقد فتحتَ لي" red size={96} />

      {VO.map((v) => (
        <Sequence key={v.src} from={v.at} durationInFrames={v.dur + 8} layout="none"><Audio src={staticFile(v.src)} volume={1} /></Sequence>
      ))}
      <Snd name="drone" at={0} dur={B.silence} vol={0.08} loop />
      <Snd name="sfx/buzz.wav" at={0} dur={30} vol={0.4} />
      <Snd name="sfx/buzz.wav" at={45} dur={30} vol={0.4} />
      <Snd name="sfx/buzz.wav" at={90} dur={30} vol={0.4} />
      <Snd name="sfx/click.wav" at={B.answer} dur={20} vol={0.45} />
      <Snd name="wind" at={B.answer} dur={B.inside - B.answer} vol={0.1} />
      <Snd name="creak" at={B.inside + 30} vol={0.35} />
      <Snd name="heartbeat" at={B.inside + 40} dur={B.silence - B.inside - 40} vol={0.22} loop />
      <Snd name="flicker" at={B.inside + 70} dur={14} vol={0.25} />
      <Snd name="sting" at={B.scare} dur={B.black - B.scare + 12} vol={0.85} />
    </AbsoluteFill>
  );
};
