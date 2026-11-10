import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import TL from './H03Elevator.timeline.json';

// Horror ep 3 — «الطابق 13». Drawn entirely in code (SVG/CSS): a lift in a 12-storey building stops at 13.
// Black + blood-red, fog, flicker, slow push-in, total silence, then the hooded pale face right beside you.
// Never gore. Scary through atmosphere, sound and the last-second reveal.

const FONT = 'Cairo, sans-serif';
const RED = '#ff1a33';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H03_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));

const rnd = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

// ---------- the hooded face (logo look: pale face, glowing red eyes, black hood) ----------
const Face: React.FC<{f: number; eye?: number}> = ({f, eye = 1}) => {
  const breathe = 1 + Math.sin(f / 9) * 0.01;
  return (
    <svg viewBox="0 0 400 520" width="100%" height="100%" style={{overflow: 'visible'}}>
      <defs>
        <radialGradient id="skin" cx="55%" cy="62%" r="55%">
          <stop offset="0" stopColor="#d9d0c8" />
          <stop offset="0.5" stopColor="#8c827b" />
          <stop offset="1" stopColor="#2b2523" />
        </radialGradient>
        <linearGradient id="hoodShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#000" stopOpacity="0.55" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="iris" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff2f2" />
          <stop offset="0.25" stopColor="#ff2a40" />
          <stop offset="1" stopColor="#5a0008" />
        </radialGradient>
        <filter id="glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="9" /></filter>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" /></filter>
        <linearGradient id="rim" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#7a0010" />
          <stop offset="0.3" stopColor="#1a0004" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
      </defs>
      <g transform={`scale(${breathe})`} style={{transformOrigin: '200px 300px'}}>
        {/* hood */}
        <path d="M200 0 C70 0 6 120 14 260 C20 380 0 470 -30 540 L430 540 C400 470 380 380 386 260 C394 120 330 0 200 0 Z" fill="url(#rim)" />
        <path d="M200 0 C70 0 6 120 14 260 C20 380 0 470 -30 540" stroke="#b0001a" strokeWidth="5" fill="none" opacity="0.8" filter="url(#soft)" />
        <path d="M200 0 C330 0 394 120 386 260 C380 380 400 470 430 540" stroke="#ff1a33" strokeWidth="4" fill="none" opacity="0.55" filter="url(#soft)" />
        <path d="M200 70 C110 70 70 150 74 250 C78 350 120 450 200 480 C280 450 322 350 326 250 C330 150 290 70 200 70 Z" fill="#000" />
        {/* face */}
        <path d="M200 120 C128 120 96 190 100 270 C104 350 150 430 200 440 C250 430 296 350 300 270 C304 190 272 120 200 120 Z" fill="url(#skin)" />
        <path d="M200 120 C128 120 96 190 100 270 C104 350 150 430 200 440 C250 430 296 350 300 270 C304 190 272 120 200 120 Z" fill="url(#hoodShade)" />
        {/* sunken sockets */}
        <ellipse cx="158" cy="268" rx="34" ry="20" fill="#120808" opacity="0.9" />
        <ellipse cx="242" cy="268" rx="34" ry="20" fill="#120808" opacity="0.9" />
        {/* glowing eyes */}
        {[158, 242].map((x) => (
          <g key={x} opacity={eye}>
            <circle cx={x} cy={268} r={22} fill={RED} filter="url(#glow)" opacity={0.9} />
            <ellipse cx={x} cy={268} rx={15} ry={10} fill="url(#iris)" />
            <ellipse cx={x} cy={268} rx={3} ry={9} fill="#1a0003" />
          </g>
        ))}
        {/* nose shadow and thin mouth */}
        <ellipse cx="200" cy="330" rx="7" ry="26" fill="#000" opacity="0.18" />
        <ellipse cx="135" cy="345" rx="26" ry="50" fill="#000" opacity="0.28" />
        <ellipse cx="265" cy="345" rx="26" ry="50" fill="#000" opacity="0.28" />
        {/* hair strands over the face */}
        {[[150, 120, 120, 400], [172, 118, 158, 330], [238, 118, 256, 360], [262, 124, 290, 420], [140, 130, 104, 300]].map(([x1, y1, x2, y2], i) => (
          <path key={i} d={`M${x1} ${y1} C${x1 - 6} ${(y1 + y2) / 2} ${x2 + 8} ${(y1 + y2) / 2} ${x2} ${y2}`} stroke="#050303" strokeWidth={i % 2 ? 5 : 8} fill="none" opacity="0.9" />
        ))}
        <path d="M168 388 C188 396 212 396 232 388" stroke="#1d1514" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M176 392 C192 400 208 400 224 392" stroke="#000" strokeWidth="2" fill="none" opacity="0.6" />
      </g>
    </svg>
  );
};

// ---------- the lift (first person, facing the doors) ----------
const Lift: React.FC<{f: number; open: number; light: number; figure: number; press: number}> = ({f, open, light, figure, press}) => {
  const doorW = 350;
  const shift = open * (doorW - 40);
  const seg = '13';
  const segOn = f < 40 || rnd(Math.floor(f / 3)) > 0.08;
  return (
    <div style={{position: 'absolute', inset: 0, width: 1080, height: 1920}}>
      {/* corridor behind the doors: fog + far red light + figure */}
      <div style={{position: 'absolute', left: 190, top: 420, width: 700, height: 1220, overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 42%, #2a0508 0%, #0a0103 45%, #000 80%)'}}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{position: 'absolute', left: -200 + ((f * (0.6 + i * 0.3) + i * 220) % 500) - 150, top: 520 + i * 140, width: 900, height: 260,
            borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(140,120,125,.18) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(10px)'}} />
        ))}
        <div style={{position: 'absolute', left: 350 - 55, top: 300, width: 110, height: 330, opacity: figure, filter: 'blur(1.5px)'}}>
          <svg viewBox="0 0 110 330" width="110" height="330">
            <path d="M55 0 C24 0 14 30 16 60 C18 90 6 140 0 330 L110 330 C104 140 92 90 94 60 C96 30 86 0 55 0 Z" fill="#000" />
            <ellipse cx="55" cy="62" rx="20" ry="26" fill="#cfc6bf" opacity="0.55" />
            <circle cx="47" cy="60" r="3.2" fill={RED} /><circle cx="63" cy="60" r="3.2" fill={RED} />
          </svg>
        </div>
      </div>
      {/* doors */}
      {[-1, 1].map((s) => (
        <div key={s} style={{position: 'absolute', top: 420, height: 1220, width: doorW, left: s < 0 ? 190 - shift : 540 + shift,
          background: 'linear-gradient(90deg, #1b1d21 0%, #34373d 30%, #22252a 60%, #15171a 100%)',
          borderLeft: s > 0 ? '3px solid #0a0a0c' : 'none', borderRight: s < 0 ? '3px solid #0a0a0c' : 'none',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,.6)'}}>
          {/* reflection streaks */}
          <div style={{position: 'absolute', left: '30%', top: 0, bottom: 0, width: 14, background: 'rgba(255,255,255,.05)'}} />
          <div style={{position: 'absolute', left: '62%', top: 0, bottom: 0, width: 4, background: 'rgba(255,255,255,.04)'}} />
        </div>
      ))}
      {/* frame around the doors */}
      <div style={{position: 'absolute', left: 150, top: 390, width: 780, height: 1260, border: '40px solid #111216', borderBottom: 'none', boxSizing: 'border-box'}} />
      {/* side walls in perspective */}
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        <defs>
          <linearGradient id="wallL" x1="0" x2="1"><stop offset="0" stopColor="#08080a" /><stop offset="1" stopColor="#1c1e22" /></linearGradient>
          <linearGradient id="wallR" x1="1" x2="0"><stop offset="0" stopColor="#08080a" /><stop offset="1" stopColor="#1c1e22" /></linearGradient>
        </defs>
        <polygon points="0,0 150,240 150,1650 0,1920" fill="url(#wallL)" />
        <polygon points="1080,0 930,240 930,1650 1080,1920" fill="url(#wallR)" />
        <polygon points="0,0 1080,0 930,240 150,240" fill="#0c0c0f" />
        <polygon points="0,1920 1080,1920 930,1650 150,1650" fill="#060607" />
        {/* ceiling light strip */}
        <rect x={300} y={90} width={480} height={30} rx={10} fill="#fff6e8" opacity={0.15 + 0.85 * light} />
      </svg>
      {/* floor display */}
      <div style={{position: 'absolute', left: 410, top: 255, width: 260, height: 120, background: '#050000', border: '6px solid #1d1d22', borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16}}>
        <div style={{fontSize: 46, color: RED, opacity: 0.8}}>▲</div>
        <div style={{fontFamily: 'monospace', fontWeight: 900, fontSize: 92, color: RED, opacity: segOn ? 1 : 0.25, textShadow: `0 0 18px ${RED}, 0 0 40px ${RED}`, letterSpacing: 4}}>{seg}</div>
      </div>
      {/* button panel on the right wall: 1..12 only */}
      <div style={{position: 'absolute', left: 952, top: 820, width: 100, height: 600, background: '#16171b', borderRadius: 10, border: '3px solid #24262c',
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', gap: 8, boxSizing: 'border-box'}}>
        {[12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => (
          <div key={n} style={{width: 40, height: 34, borderRadius: 17, border: '2px solid #3a3c43', fontFamily: 'monospace', fontSize: 20, color: '#9a9aa3',
            display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{n}</div>
        ))}
        <div style={{marginTop: 8, width: 64, height: 40, borderRadius: 8, border: `2px solid ${press > 0 ? RED : '#3a3c43'}`, fontSize: 20, color: press > 0 ? RED : '#9a9aa3',
          display: 'flex', alignItems: 'center', justifyContent: 'center', background: press > 0 ? 'rgba(255,26,51,.25)' : 'transparent',
          boxShadow: press > 0 ? `0 0 20px ${RED}` : 'none', transform: `scale(${1 - press * 0.12})`}}>▶|◀</div>
      </div>
      {/* overall light level: darkness eats the lift, red display survives */}
      <div style={{position: 'absolute', inset: 0, background: '#000', opacity: 0.25 + (1 - light) * 0.72}} />
      <div style={{position: 'absolute', left: 410, top: 255, width: 260, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 56,
        boxSizing: 'border-box', fontFamily: 'monospace', fontWeight: 900, fontSize: 92, color: RED, opacity: (1 - light) * (segOn ? 0.9 : 0.2), letterSpacing: 4,
        textShadow: `0 0 18px ${RED}, 0 0 50px ${RED}`}}>{seg}</div>
    </div>
  );
};

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1500, size = 74}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 60, right: 60, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#f2ecea', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000, 0 0 8px #000'}}>{text}</div>
  );
};

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={at} durationInFrames={dur} layout="none"><Audio src={staticFile(name.includes('/') ? name : `sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

export const H03Elevator: React.FC = () => {
  const f = useCurrentFrame();
  // camera: [frame, scale, focusX, focusY]
  const K: [number, number, number, number][] = [
    [0, 1.75, 540, 330], [B.pull, 1.75, 540, 330], [B.pull + 50, 1.0, 540, 960], [B.press - 4, 1.06, 540, 900],
    [B.press + 6, 2.0, 1000, 1120], [B.dark - 6, 2.0, 1000, 1120], [B.dark + 10, 1.1, 540, 900], [B.silence, 1.32, 540, 880],
  ];
  let i = 0;
  while (i < K.length - 2 && f >= K[i + 1][0]) i++;
  const [f0, s0, x0, y0] = K[i], [f1, s1, x1, y1] = K[i + 1];
  const t = interpolate(f, [f0, f1], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const sc = s0 + (s1 - s0) * t, fx = x0 + (x1 - x0) * t, fy = y0 + (y1 - y0) * t;
  const tx = Math.min(0, Math.max(1080 - 1080 * sc, 540 - fx * sc));
  const ty = Math.min(0, Math.max(1920 - 1920 * sc, 960 - fy * sc));

  const open = interpolate(f, [B.ding + 8, B.ding + 60], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
  const figure = f < B.press ? interpolate(f, [B.ding + 40, B.ding + 80], [0, 0.85], clamp) * (rnd(Math.floor(f / 2)) > 0.1 ? 1 : 0.3) : 0;
  const presses = [B.press + 6, B.press + 14, B.press + 20, B.press + 25];
  const press = presses.some((p) => f >= p && f < p + 4) ? 1 : 0;
  // flicker then off
  let light = 1;
  if (f >= B.dark && f < B.dark + 60) light = rnd(Math.floor(f / 2) + 3) > 0.45 ? 1 : 0.15;
  if (f >= B.dark + 60) light = 0;
  const scare = f >= B.scare;
  const sp = interpolate(f, [B.scare, B.scare + 8], [0.75, 1], {...clamp, easing: Easing.out(Easing.back(1.6))});
  const push = interpolate(f, [B.scare, H03_FRAMES], [1, 1.12], clamp);
  const shake = scare ? Math.max(0, 1 - (f - B.scare) / 24) * 22 : 0;
  const flash = interpolate(f, [B.scare, B.scare + 2, B.scare + 16], [0, 0.7, 0], clamp);

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {!scare && (
        <div style={{position: 'absolute', width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${sc})`}}>
          <Lift f={f} open={open} light={light} figure={figure} press={press} />
        </div>
      )}
      {scare && (
        <AbsoluteFill style={{transform: `translate(${(rnd(f) - 0.5) * shake}px, ${(rnd(f + 9) - 0.5) * shake}px)`}}>
          <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 40%, #3a0008 0%, #000 60%)'}} />
          <div style={{position: 'absolute', left: 230, top: 40, width: 1250, height: 1625, transform: `scale(${sp * push}) rotate(-6deg)`, transformOrigin: '40% 40%'}}>
            <Face f={f} eye={rnd(Math.floor(f / 3)) > 0.06 ? 1 : 0.4} />
          </div>
        </AbsoluteFill>
      )}
      {/* vignette, grain */}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,.75) 100%)'}} />
      <AbsoluteFill style={{background: RED, opacity: flash, mixBlendMode: 'screen'}} />
      <AbsoluteFill style={{background: '#000', opacity: interpolate(f, [B.silence, B.silence + 4, B.scare - 1, B.scare], [0, 1, 1, 0], clamp)}} />

      <Caption f={f} from={-8} to={B.pull + 4} text="المبنى فيه 12 طابقًا فقط" size={86} y={1420} />
      <Caption f={f} from={B.pull + 6} to={B.press - 2} text="لكنّ المصعد… توقّف عند الثالث عشر" />
      <Caption f={f} from={B.press} to={B.dark - 2} text="ضغطتُ زرّ الإغلاق… مرارًا" y={1560} />
      <Caption f={f} from={B.dark} to={B.silence} text="ثم انطفأ الضوء… وسمعتُ أنفاسًا بجانبي" />
      <Caption f={f} from={B.scare + 6} to={H03_FRAMES} text="شكرًا… لأنّك انتظرتني" red size={92} y={1560} />

      <Snd name="drone" at={0} dur={B.silence} vol={0.07} loop />
      <Snd name="flicker" at={0} dur={30} vol={0.18} />
      <Snd name="sfx/ding.wav" at={B.ding} dur={30} vol={0.22} />
      <Snd name="creak" at={B.ding + 8} vol={0.28} />
      <Snd name="wind" at={B.ding + 30} dur={B.press - B.ding - 30} vol={0.12} />
      <Snd name="heartbeat" at={B.press} dur={B.silence - B.press} vol={0.26} loop />
      {presses.map((p) => <Snd key={p} name="sfx/click.wav" at={p} dur={12} vol={0.5} />)}
      <Snd name="flicker" at={B.dark} dur={60} vol={0.25} />
      <Snd name="wind" at={B.dark + 60} dur={B.silence - B.dark - 60} vol={0.1} />
      <Snd name="sting" at={B.scare} dur={H03_FRAMES - B.scare} vol={0.85} />
      {VO.map((l) => <Snd key={l.src} name={l.src} at={l.at} dur={l.dur + 6} vol={1} />)}
    </AbsoluteFill>
  );
};
