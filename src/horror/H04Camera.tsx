import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import TL from './H04Camera.timeline.json';
import {Face} from './HoodedFace';

// Horror ep 4 — «كاميرا البيت». I live alone; the home camera app keeps saying "motion detected".
// Told entirely through a CCTV feed on a phone: red-tinted infrared, timestamp, REC, jump cuts, then the bedroom camera.
// Different from ep 3 (first-person lift): here we only ever see through the camera. Never gore.

const FONT = 'Cairo, sans-serif';
const RED = '#ff1a33';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H04_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));

const rnd = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const FW = 1000, FH = 1180; // the feed inside the phone

// ---------- the figure as the camera sees it ----------
const Figure: React.FC<{h: number; eyes?: number; tilt?: number}> = ({h, eyes = 1, tilt = 0}) => (
  <svg width={h * 0.42} height={h} viewBox="0 0 110 260" style={{overflow: 'visible'}}>
    <path d="M55 0 C26 0 16 26 18 52 C20 80 8 120 2 260 L108 260 C102 120 90 80 92 52 C94 26 84 0 55 0 Z" fill="#050505" />
    <g transform={`rotate(${tilt} 55 50)`}>
      <ellipse cx="55" cy="54" rx="17" ry="22" fill="#b9b0aa" opacity="0.5" />
      <circle cx="48" cy="52" r="3" fill={RED} opacity={eyes} />
      <circle cx="62" cy="52" r="3" fill={RED} opacity={eyes} />
    </g>
  </svg>
);

// ---------- hallway, seen from a high corner ----------
const Hallway: React.FC<{fig: number | null; f: number}> = ({fig, f}) => {
  // fig = 0 (far end) .. 1 (right under the camera)
  const scale = fig === null ? 0 : 0.6 + fig * 1.0;
  const y = fig === null ? 0 : 560 + fig * 450;
  return (
    <svg width={FW} height={FH} viewBox={`0 0 ${FW} ${FH}`}>
      <rect width={FW} height={FH} fill="#141414" />
      {/* far wall */}
      <rect x={380} y={250} width={240} height={250} fill="#2a2a2a" />
      <rect x={455} y={300} width={90} height={200} fill="#0c0c0c" />
      {/* floor */}
      <polygon points={`380,500 620,500 ${FW},${FH} 0,${FH}`} fill="#3a3a3a" />
      {Array.from({length: 7}, (_, i) => {
        const t = (i + 1) / 8, yy = 500 + (FH - 500) * t * t;
        return <line key={i} x1={380 - 380 * t * t} y1={yy} x2={620 + 380 * t * t} y2={yy} stroke="#2c2c2c" strokeWidth={3} />;
      })}
      {/* side walls with doors */}
      <polygon points={`0,0 380,250 380,500 0,${FH}`} fill="#222" />
      <polygon points={`${FW},0 620,250 620,500 ${FW},${FH}`} fill="#262626" />
      <polygon points="120,300 250,370 250,700 120,860" fill="#121212" />
      <polygon points="880,300 750,370 750,700 880,860" fill="#151515" />
      <polygon points="0,0 1000,0 620,250 380,250" fill="#1b1b1b" />
      {/* a faint lamp glow */}
      <ellipse cx={500} cy={520} rx={260} ry={60} fill="#ffffff" opacity={0.05 + rnd(Math.floor(f / 4)) * 0.02} />
      {fig !== null && (
        <g transform={`translate(${500 - 23 * scale}, ${y - 260 * scale * 0.5}) scale(${scale * 0.42}, ${scale * 0.5})`}>
          <path d="M55 0 C26 0 16 26 18 52 C20 80 8 120 2 260 L108 260 C102 120 90 80 92 52 C94 26 84 0 55 0 Z" fill="#050505" />
          <ellipse cx="55" cy="54" rx="17" ry="22" fill="#b9b0aa" opacity="0.5" />
          <circle cx="48" cy="52" r="3" fill={RED} />
          <circle cx="62" cy="52" r="3" fill={RED} />
        </g>
      )}
    </svg>
  );
};

// ---------- bedroom, seen from the ceiling corner ----------
const Bedroom: React.FC<{f: number; look: number}> = ({f, look}) => (
  <svg width={FW} height={FH} viewBox={`0 0 ${FW} ${FH}`}>
    <rect width={FW} height={FH} fill="#2e2e2e" />
    <polygon points="0,0 1000,0 1000,260 0,420" fill="#1e1e1e" />
    {/* rug */}
    <ellipse cx={420} cy={860} rx={300} ry={130} fill="#262626" />
    {/* bed in perspective */}
    <polygon points="430,330 900,300 960,860 380,900" fill="#3c3c3c" />
    <polygon points="440,340 890,312 900,420 445,450" fill="#4a4a4a" />
    <rect x={520} y={350} width={150} height={70} rx={20} fill="#5a5a5a" transform="rotate(-4 595 385)" />
    {/* the sleeper: a lump under the blanket */}
    <path d="M520 470 C560 430 700 430 760 470 C800 520 820 700 780 800 C700 840 560 840 500 800 C470 700 480 520 520 470 Z" fill="#555" />
    <path d="M500 800 C560 840 700 840 780 800 L800 860 C700 880 560 880 480 860 Z" fill="#444" />
    {/* the one standing beside the bed */}
    <g transform="translate(250, 330)">
      <Figure h={560} eyes={0.4 + look * 0.6} tilt={-look * 12} />
    </g>
    <ellipse cx={370} cy={895} rx={110} ry={26} fill="#000" opacity={0.35} />
    {/* blinking standby LED on the nightstand */}
    <rect x={900} y={880} width={80} height={120} fill="#1a1a1a" />
    <circle cx={940} cy={900} r={5} fill={RED} opacity={f % 30 < 15 ? 1 : 0.2} />
  </svg>
);

// ---------- CCTV chrome: IR tint, scanlines, timestamp, REC ----------
const Feed: React.FC<{f: number; cam: string; time: string; children: React.ReactNode; glitch?: number; zoom?: number; origin?: string; raw?: boolean}> = ({f, cam, time, children, glitch = 0, zoom = 1, origin = '50% 40%', raw = false}) => (
  <div style={{position: 'relative', width: FW, height: FH, overflow: 'hidden', background: '#000'}}>
    <div style={{position: 'absolute', inset: 0, filter: raw ? 'contrast(1.1)' : 'grayscale(1) contrast(1.3) brightness(1.2)', transform: `translateX(${glitch * (rnd(f) - 0.5) * 60}px) scale(${zoom})`, transformOrigin: origin}}>{children}</div>
    {!raw && <div style={{position: 'absolute', inset: 0, background: 'rgba(150,0,15,.45)', mixBlendMode: 'multiply'}} />}
    <div style={{position: 'absolute', inset: 0, background: 'rgba(255,40,60,.10)', mixBlendMode: 'screen'}} />
    <div style={{position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, rgba(0,0,0,.28) 0 2px, transparent 2px 5px)'}} />
    <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,.8) 100%)'}} />
    {glitch > 0 && Array.from({length: 6}, (_, i) => (
      <div key={i} style={{position: 'absolute', left: 0, right: 0, top: rnd(f * 3 + i) * FH, height: 4 + rnd(f + i * 7) * 30, background: 'rgba(255,255,255,.18)', mixBlendMode: 'screen'}} />
    ))}
    <div style={{position: 'absolute', top: 24, left: 30, fontFamily: 'monospace', fontWeight: 700, fontSize: 36, color: '#f2f2f2', textShadow: '0 0 6px #000'}}>{cam}</div>
    <div style={{position: 'absolute', top: 24, right: 30, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'monospace', fontWeight: 700, fontSize: 36, color: '#f2f2f2'}}>
      <div style={{width: 22, height: 22, borderRadius: 11, background: RED, opacity: f % 30 < 18 ? 1 : 0.15}} />REC
    </div>
    <div style={{position: 'absolute', bottom: 26, left: 30, fontFamily: 'monospace', fontWeight: 700, fontSize: 38, color: '#f2f2f2', textShadow: '0 0 6px #000'}}>{time}</div>
  </div>
);

const Banner: React.FC<{f: number; at: number; text: string}> = ({f, at, text}) => {
  const p = interpolate(f, [at, at + 8], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const out = interpolate(f, [at + 60, at + 70], [0, 1], clamp);
  if (f < at || out >= 1) return null;
  return (
    <div style={{position: 'absolute', top: 70, left: 60, right: 60, background: 'rgba(28,28,30,.96)', borderRadius: 34, padding: '22px 30px', direction: 'rtl',
      display: 'flex', gap: 22, alignItems: 'center', transform: `translateY(${(p - 1 - out) * 220}px)`, boxShadow: '0 20px 60px rgba(0,0,0,.7)', zIndex: 20}}>
      <div style={{width: 80, height: 80, borderRadius: 20, background: '#2b0006', border: `3px solid ${RED}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44}}>📷</div>
      <div>
        <div style={{fontFamily: FONT, fontWeight: 700, fontSize: 30, color: '#9a9a9a'}}>كاميرا البيت · الآن</div>
        <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 44, color: '#fff'}}>{text}</div>
      </div>
    </div>
  );
};

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1600, size = 66}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#f2ecea', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000'}}>{text}</div>
  );
};

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={at} durationInFrames={dur} layout="none"><Audio src={staticFile(name.includes('/') ? name : `sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

const clock = (f: number, base: number) => {
  const s = base + Math.floor(f / 30);
  return `03:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export const H04Camera: React.FC = () => {
  const f = useCurrentFrame();
  // hallway: figure position per jump cut (null = empty)
  const CUTS: [number, number | null, number][] = [[0, 0.0, 0], [B.motion, 0.25, 41], [B.motion + 34, 0.55, 97], [B.motion + 66, 0.85, 158], [B.close, null, 412]];
  let ci = 0;
  while (ci < CUTS.length - 1 && f >= CUTS[ci + 1][0]) ci++;
  const [cutAt, fig, base] = CUTS[ci];
  const cutGlitch = f - cutAt < 6 && cutAt > 0 ? 1 : 0;
  const bedroom = f >= B.bedroom && f < B.scare;
  const look = interpolate(f, [B.silence, B.scare], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  const zoom = bedroom ? interpolate(f, [B.bedroom, B.scare], [1, 1.5], {...clamp, easing: Easing.in(Easing.quad)}) : interpolate(f, [0, B.motion], [1.0, 1.08], clamp);
  const loading = f >= B.close && f < B.close + 40;
  const scare = f >= B.scare;
  const shake = scare ? Math.max(0, 1 - (f - B.scare) / 24) * 24 : 0;
  const flash = interpolate(f, [B.scare, B.scare + 2, B.scare + 16], [0, 0.7, 0], clamp);
  const sp = interpolate(f, [B.scare, B.scare + 8], [0.7, 1], {...clamp, easing: Easing.out(Easing.back(1.6))});
  const push = interpolate(f, [B.scare, H04_FRAMES], [1, 1.12], clamp);

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {/* the phone */}
      <div style={{position: 'absolute', top: 250, left: 40, width: FW, height: FH, borderRadius: 30, overflow: 'hidden', boxShadow: '0 0 0 6px #111, 0 0 80px rgba(255,26,51,.15)'}}>
        {!scare && (
          <div style={{width: FW, height: FH}}>
            {bedroom ? (
              <Feed f={f} cam="CAM 3 · غرفة النوم" time={clock(f - B.bedroom, 431)} glitch={f - B.bedroom < 6 ? 1 : 0} zoom={zoom} origin="30% 40%"><Bedroom f={f} look={look} /></Feed>
            ) : (
              <Feed f={f} cam="CAM 2 · الممرّ" time={clock(f - cutAt, base)} glitch={cutGlitch} zoom={zoom}><Hallway fig={fig} f={f} /></Feed>
            )}
          </div>
        )}
        {loading && (
          <div style={{position: 'absolute', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: interpolate(f, [B.close + 30, B.close + 40], [1, 0], clamp)}}>
            <div style={{width: 90, height: 90, borderRadius: 45, border: '8px solid #333', borderTopColor: RED, transform: `rotate(${f * 14}deg)`}} />
          </div>
        )}
        {scare && (
          <div style={{position: 'absolute', inset: 0, transform: `translate(${(rnd(f) - 0.5) * shake}px, ${(rnd(f + 9) - 0.5) * shake}px)`}}>
            <Feed f={f} cam="CAM 3 · غرفة النوم" time={clock(f - B.bedroom, 431)} glitch={f - B.scare < 10 ? 1 : 0} raw>
              <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 60% 40%, #3a0008 0%, #000 65%)'}} />
              <div style={{position: 'absolute', left: -40, top: -60, width: 1080, height: 1400, transform: `scale(${sp * push})`, transformOrigin: '50% 35%'}}>
                <Face f={f} eye={rnd(Math.floor(f / 3)) > 0.06 ? 1 : 0.4} />
              </div>
            </Feed>
          </div>
        )}
      </div>
      <Banner f={f} at={B.motion - 4} text="تمّ رصد حركة · الممرّ" />
      <Banner f={f} at={B.bedroom - 6} text="تمّ رصد حركة · غرفة النوم" />

      <AbsoluteFill style={{background: RED, opacity: flash, mixBlendMode: 'screen'}} />
      <AbsoluteFill style={{background: '#000', opacity: interpolate(f, [B.silence + 8, B.silence + 11, B.scare - 1, B.scare], [0, 0.85, 0.85, 0], clamp)}} />

      <Caption f={f} from={-8} to={B.motion - 6} text="أعيشُ وحدي… لكنّ الكاميرا تقول غير ذلك" size={70} />
      <Caption f={f} from={B.motion + 2} to={B.close - 2} text="حركة في الممرّ… الساعة الثالثة" />
      <Caption f={f} from={B.close} to={B.bedroom - 8} text="أغلقتُ باب غرفتي… وفتحتُ التطبيق من جديد" />
      <Caption f={f} from={B.bedroom} to={B.silence + 6} text="حركة… في غرفة النوم" />
      <Caption f={f} from={B.scare + 6} to={H04_FRAMES} text="لماذا أغلقتَ الباب؟" red size={96} />

      <Snd name="drone" at={0} dur={B.silence} vol={0.07} loop />
      <Snd name="clock" at={0} dur={B.motion} vol={0.12} loop />
      <Snd name="sfx/blip.wav" at={B.motion - 4} dur={20} vol={0.45} />
      {[B.motion, B.motion + 34, B.motion + 66].map((x) => <Snd key={x} name="flicker" at={x} dur={14} vol={0.25} />)}
      <Snd name="creak" at={B.close} vol={0.3} />
      <Snd name="heartbeat" at={B.close + 30} dur={B.silence - B.close - 30} vol={0.22} loop />
      <Snd name="sfx/blip.wav" at={B.bedroom - 6} dur={20} vol={0.45} />
      <Snd name="wind" at={B.bedroom} dur={B.silence - B.bedroom} vol={0.1} />
      <Snd name="sting" at={B.scare} dur={H04_FRAMES - B.scare} vol={0.85} />
      {VO.map((l) => <Snd key={l.src} name={l.src} at={l.at} dur={l.dur + 6} vol={1} />)}
    </AbsoluteFill>
  );
};
