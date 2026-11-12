import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import TL from './H07Closet.timeline.json';
import {Face} from './HoodedFace';

// Horror ep 7 — «الخزانة». Every night at 3 a.m., three knocks from inside the wardrobe, then silence.
// Tonight I knock first… and the answer comes from under my bed. The camera tilts down to the black gap under
// the bed, two red eyes open, then the hood. Different from ep 6 (phone in hand) and ep 5 (mirror): a static
// bedroom POV from the pillow, a slow push into the wardrobe, then a tilt down to the floor.
// Black and blood-red, fog, silence before the scare. Never gore.

const FONT = 'Cairo, sans-serif';
const RED = '#ff1a33';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H07_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));

const KNOCKS_IN = [B.knock1, B.knock1 + 12, B.knock1 + 24];
const KNOCKS_ME = [B.mine, B.mine + 10, B.mine + 20];
const KNOCKS_BED = [B.reply, B.reply + 11, B.reply + 22];
const since = (f: number, ks: number[]) => {
  const k = [...ks].reverse().find((x) => x <= f);
  return k === undefined ? 999 : f - k;
};

const rnd = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={at} durationInFrames={dur} layout="none"><Audio src={staticFile(name.includes('/') ? name : `sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1600, size = 68}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#f2ecea', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000'}}>{text}</div>
  );
};

const Fog: React.FC<{f: number; o?: number; top?: number}> = ({f, o = 0.5, top = 1000}) => (
  <AbsoluteFill style={{opacity: o, pointerEvents: 'none'}}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{position: 'absolute', left: -400 + ((f * (0.5 + i * 0.25) + i * 470) % 1400), top: top + i * 240, width: 1400, height: 480, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(120,20,30,.22) 0%, transparent 70%)', filter: 'blur(30px)'}} />
    ))}
  </AbsoluteFill>
);

const Grain: React.FC<{f: number}> = ({f}) => (
  <AbsoluteFill style={{opacity: 0.07, mixBlendMode: 'screen', pointerEvents: 'none',
    backgroundImage: `repeating-radial-gradient(circle at ${rnd(f) * 100}% ${rnd(f + 3) * 100}%, rgba(255,255,255,.5) 0 1px, transparent 1px 3px)`}} />
);

// ---------- the bedroom from my pillow ----------
const Room: React.FC<{f: number}> = ({f}) => {
  const push = interpolate(f, [0, B.mine - 100], [1, 1.28], {...clamp, easing: Easing.inOut(Easing.quad)});
  const jolt = since(f, KNOCKS_IN) < 6 ? (6 - since(f, KNOCKS_IN)) * 1.6 : 0;
  const seep = 0.55 + (since(f, KNOCKS_IN) < 10 ? 0.45 : 0) + Math.sin(f / 11) * 0.08;
  const silent = f >= B.knock1 + 30;
  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, scale: `${push}`, transformOrigin: '50% 46%'}}>
        <svg width={1080} height={1920} viewBox="0 0 1080 1920">
          <defs>
            <radialGradient id="h7room" cx="50%" cy="42%" r="70%"><stop offset="0" stopColor="#1c0508" /><stop offset="1" stopColor="#000" /></radialGradient>
            <linearGradient id="h7wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#140406" /><stop offset="0.5" stopColor="#24090c" /><stop offset="1" stopColor="#0e0304" /></linearGradient>
            <filter id="h7blur"><feGaussianBlur stdDeviation="18" /></filter>
            <filter id="h7soft"><feGaussianBlur stdDeviation="4" /></filter>
          </defs>
          <rect width={1080} height={1920} fill="url(#h7room)" />
          {/* floorboards in perspective */}
          <polygon points="0,1330 1080,1330 1080,1920 0,1920" fill="#0a0203" />
          {Array.from({length: 9}, (_, i) => <line key={i} x1={540 + (i - 4) * 70} y1={1330} x2={540 + (i - 4) * 330} y2={1920} stroke="#1a0507" strokeWidth={3} />)}
          {/* the red seep, behind the doors */}
          <ellipse cx={540} cy={820} rx={120} ry={560} fill={RED} opacity={0.18 * seep} filter="url(#h7blur)" />
          {/* wardrobe */}
          <g transform={`translate(${jolt * (rnd(f) - 0.5) * 2} 0)`}>
            <rect x={250} y={260} width={580} height={1080} fill="#070102" />
            <rect x={270} y={290} width={268} height={1030} fill="url(#h7wood)" stroke="#3a0b10" strokeWidth={4} />
            <rect x={542} y={290} width={268} height={1030} fill="url(#h7wood)" stroke="#3a0b10" strokeWidth={4} />
            {[320, 760].map((y) => (
              <g key={y}>
                <rect x={300} y={y} width={208} height={y === 320 ? 400 : 520} fill="none" stroke="#2a080b" strokeWidth={5} />
                <rect x={572} y={y} width={208} height={y === 320 ? 400 : 520} fill="none" stroke="#2a080b" strokeWidth={5} />
              </g>
            ))}
            <circle cx={520} cy={800} r={10} fill="#4a3634" />
            <circle cx={560} cy={800} r={10} fill="#4a3634" />
            {/* the gap between the doors: red light */}
            <rect x={537} y={292} width={7} height={1026} fill={RED} opacity={0.75 * seep} filter="url(#h7soft)" />
            <rect x={538} y={292} width={4} height={1026} fill="#ff6070" opacity={0.6 * seep} />
            {/* light leaking under */}
            <ellipse cx={540} cy={1350} rx={260} ry={34} fill={RED} opacity={0.3 * seep} filter="url(#h7blur)" />
          </g>
          {/* nightstand + clock, bottom left */}
          <rect x={-20} y={1470} width={300} height={460} fill="#060102" />
          <rect x={110} y={1400} width={200} height={84} rx={12} fill="#0b0b0b" stroke="#220507" strokeWidth={3} />
          <text x={210} y={1460} textAnchor="middle" fontFamily="Consolas, monospace" fontSize={56} fill={RED} opacity={0.9}>03:00</text>
          <ellipse cx={210} cy={1440} rx={130} ry={60} fill={RED} opacity={0.12} filter="url(#h7blur)" />
          {/* the foot of my bed: blanket */}
          <path d="M-20 1920 L-20 1720 C200 1640 420 1700 560 1680 C720 1660 900 1600 1100 1660 L1100 1920 Z" fill="#050102" />
          <path d="M-20 1720 C200 1640 420 1700 560 1680 C720 1660 900 1600 1100 1660" stroke="#2a070a" strokeWidth={4} fill="none" />
        </svg>
      </div>
      <Fog f={f} o={silent ? 0.7 : 0.5} />
    </AbsoluteFill>
  );
};

// ---------- close on the door: my fist knocks ----------
const Door: React.FC<{f: number}> = ({f}) => {
  const k = since(f, KNOCKS_ME);
  const hit = k < 4 ? 1 - k / 4 : 0;
  const fistIn = interpolate(f, [B.mine - 40, B.mine - 6], [1, 0], {...clamp, easing: Easing.out(Easing.cubic)});
  const fistOut = interpolate(f, [B.still + 2, B.still + 20], [0, 1], clamp);
  const bob = k < 10 ? Math.sin((k / 10) * Math.PI) : 0;
  const push = interpolate(f, [B.mine - 100, B.reply], [1.04, 1.12], clamp);
  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, scale: `${push}`, translate: `${hit * (rnd(f) - 0.5) * 10}px 0`}}>
        <svg width={1080} height={1920} viewBox="0 0 1080 1920">
          <defs>
            <linearGradient id="h7plank" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#1e0709" /><stop offset="0.6" stopColor="#2c0b0e" /><stop offset="1" stopColor="#150506" /></linearGradient>
            <filter id="h7b2"><feGaussianBlur stdDeviation="10" /></filter>
          </defs>
          <rect width={1080} height={1920} fill="url(#h7plank)" />
          {Array.from({length: 7}, (_, i) => <line key={i} x1={i * 170 + 40} y1={0} x2={i * 170 + 60} y2={1920} stroke="#120304" strokeWidth={4} opacity={0.8} />)}
          {Array.from({length: 22}, (_, i) => (
            <path key={i} d={`M${(i * 97) % 1080} ${(i * 211) % 1920} c 40 ${10 + (i % 4) * 6} 90 -8 150 6`} stroke="#3b0f13" strokeWidth={2} fill="none" opacity={0.5} />
          ))}
          <rect x={150} y={200} width={780} height={1500} fill="none" stroke="#120304" strokeWidth={14} />
          {/* the red seam on the left edge */}
          <rect x={0} y={0} width={18} height={1920} fill={RED} opacity={0.5} filter="url(#h7b2)" />
          {hit > 0 && <circle cx={560} cy={860} r={140 + (1 - hit) * 120} fill="none" stroke={RED} strokeWidth={6} opacity={hit * 0.5} />}
        </svg>
      </div>
      {/* my fist, a dark silhouette from the bottom right */}
      <svg width={760} height={1100} viewBox="0 0 760 1100" style={{position: 'absolute', left: 380, top: 820 + (fistIn + fistOut) * 900 + bob * -50 + hit * -30, rotate: '-12deg'}}>
        <path d="M120 160 C120 90 190 50 260 60 L470 70 C540 75 590 120 590 190 L590 330 C590 400 540 440 470 440 L330 440 L360 1100 L80 1100 L110 420 C90 380 100 300 120 260 Z" fill="#070203" />
        {[0, 1, 2, 3].map((i) => <path key={i} d={`M${200 + i * 95} 70 C${190 + i * 95} 120 ${190 + i * 95} 170 ${205 + i * 95} 210`} stroke="#3a0b10" strokeWidth={5} fill="none" opacity={0.8} />)}
        <path d="M120 160 C120 90 190 50 260 60 L470 70" stroke="#5a0f16" strokeWidth={6} fill="none" opacity={0.7} />
      </svg>
      <Fog f={f} o={0.45} />
    </AbsoluteFill>
  );
};

// ---------- the tilt down: the gap under my bed ----------
const UnderBed: React.FC<{f: number}> = ({f}) => {
  const k = f - B.turn;
  const tilt = interpolate(k, [0, 22], [-500, 0], {...clamp, easing: Easing.out(Easing.cubic)});
  const push = interpolate(k, [0, B.scare - B.turn], [1, 1.3], {...clamp, easing: Easing.in(Easing.quad)});
  const eyes = interpolate(f, [B.turn + 22, B.scare - 6], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  const blink = rnd(Math.floor(f / 4)) > 0.92 ? 0.2 : 1;
  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, translate: `0 ${tilt}px`, scale: `${push}`, transformOrigin: '50% 58%'}}>
        <svg width={1080} height={1920} viewBox="0 0 1080 1920">
          <defs>
            <radialGradient id="h7eye" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#fff2f2" /><stop offset="0.3" stopColor={RED} /><stop offset="1" stopColor="#5a0008" stopOpacity="0" /></radialGradient>
            <filter id="h7b3"><feGaussianBlur stdDeviation="16" /></filter>
          </defs>
          {/* mattress + frame from floor level */}
          <rect x={-40} y={300} width={1160} height={560} fill="#0a0203" />
          <path d="M-40 860 L1120 860" stroke="#3a0b10" strokeWidth={8} />
          {/* hanging blanket edge */}
          <path d="M-40 860 C120 900 260 880 380 910 C520 950 640 900 760 925 C880 950 1000 905 1120 930 L1120 860 Z" fill="#120405" />
          {/* bed legs */}
          <rect x={40} y={860} width={50} height={330} fill="#0d0304" />
          <rect x={990} y={860} width={50} height={330} fill="#0d0304" />
          {/* the gap: pure black, a little red haze */}
          <rect x={90} y={930} width={900} height={260} fill="#000" />
          <ellipse cx={540} cy={1070} rx={420} ry={90} fill="#3a0008" opacity={0.25 + eyes * 0.3} filter="url(#h7b3)" />
          {/* floor */}
          <polygon points="-40,1190 1120,1190 1120,1920 -40,1920" fill="#080203" />
          {Array.from({length: 9}, (_, i) => <line key={i} x1={540 + (i - 4) * 120} y1={1190} x2={540 + (i - 4) * 300} y2={1920} stroke="#190507" strokeWidth={3} />)}
          <ellipse cx={540} cy={1200} rx={500} ry={50} fill={RED} opacity={0.08 + eyes * 0.12} filter="url(#h7b3)" />
          {/* eyes in the dark */}
          {[470, 610].map((x) => (
            <g key={x} opacity={eyes * blink}>
              <ellipse cx={x} cy={1060} rx={46} ry={22} fill={RED} filter="url(#h7b3)" opacity={0.9} />
              <ellipse cx={x} cy={1060} rx={30} ry={11 * eyes + 1} fill="url(#h7eye)" />
              <ellipse cx={x} cy={1060} rx={3} ry={9 * eyes} fill="#1a0003" />
            </g>
          ))}
          {/* fingers on the floor edge */}
          {eyes > 0.6 && [0, 1, 2, 3].map((i) => (
            <path key={i} d={`M${330 + i * 22} 1190 c -4 30 -2 60 ${4 + i * 2} ${80 - i * 6}`} stroke="#bfb3ab" strokeWidth={9} strokeLinecap="round" fill="none" opacity={(eyes - 0.6) * 1.6} />
          ))}
        </svg>
      </div>
      <Fog f={f} o={0.55} top={1150} />
    </AbsoluteFill>
  );
};

export const H07Closet: React.FC = () => {
  const f = useCurrentFrame();
  const room = f < B.mine - 100;
  const door = f >= B.mine - 100 && f < B.turn;
  const under = f >= B.turn && f < B.scare;
  const scare = f >= B.scare && f < B.black;
  const shake = scare ? Math.max(0, 1 - (f - B.scare) / 24) * 28 : 0;
  const flash = interpolate(f, [B.scare, B.scare + 2, B.scare + 14], [0, 0.8, 0], clamp);
  const sp = interpolate(f, [B.scare, B.scare + 7], [0.55, 1], {...clamp, easing: Easing.out(Easing.back(1.7))});
  const facePush = interpolate(f, [B.scare, B.black], [1, 1.12], clamp);
  // the room darkens to nothing when the knocks come from below
  const dim = interpolate(f, [B.reply - 2, B.reply], [0, 0.55], clamp) * (door ? 1 : 0);

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {room && <Room f={f} />}
      {door && <Door f={f} />}
      {door && <AbsoluteFill style={{background: '#000', opacity: dim}} />}
      {under && <UnderBed f={f} />}
      {scare && (
        <AbsoluteFill style={{translate: `${(rnd(f) - 0.5) * shake}px ${(rnd(f + 9) - 0.5) * shake}px`}}>
          <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, #3a0008 0%, #000 65%)'}} />
          <div style={{position: 'absolute', left: -80, top: 160, width: 1240, height: 1600, scale: `${sp * facePush}`, transformOrigin: '50% 40%'}}>
            <Face f={f} eye={rnd(Math.floor(f / 3)) > 0.08 ? 1 : 0.4} />
          </div>
          <Fog f={f} o={0.6} />
        </AbsoluteFill>
      )}

      <Grain f={f} />
      <AbsoluteFill style={{background: RED, opacity: flash, mixBlendMode: 'screen'}} />
      <AbsoluteFill style={{background: '#000', opacity: interpolate(f, [B.mine - 106, B.mine - 100, B.mine - 94], [0, 1, 0], clamp)}} />
      <AbsoluteFill style={{background: '#000', opacity: interpolate(f, [B.turn - 4, B.turn, B.turn + 3], [0, 1, 0], clamp)}} />
      <AbsoluteFill style={{background: '#000', opacity: interpolate(f, [B.black - 3, B.black], [0, 1], clamp)}} />

      <Caption f={f} from={0} to={186} text="كلّ ليلة… الساعة الثالثة… طرقاتٌ من داخل الخزانة" size={66} />
      <Caption f={f} from={190} to={284} text="ثلاثُ طرقات. ثمّ صمت." />
      <Caption f={f} from={290} to={B.still} text="الليلة… طرقتُ أنا أولًا" />
      <Caption f={f} from={B.reply + 12} to={B.scare - 1} text="فردّ عليّ… من تحت السرير" red size={72} />
      <Caption f={f} from={B.scare + 4} to={B.black - 1} text="وجدتُك" red size={110} y={1560} />

      {VO.map((v) => (
        <Sequence key={v.src} from={v.at} durationInFrames={v.dur + 8} layout="none"><Audio src={staticFile(v.src)} volume={1} /></Sequence>
      ))}
      <Snd name="drone" at={0} dur={B.mine - 10} vol={0.09} loop />
      <Snd name="clock" at={20} dur={10} vol={0.25} />
      <Snd name="clock" at={50} dur={10} vol={0.25} />
      <Snd name="clock" at={80} dur={10} vol={0.25} />
      <Snd name="clock" at={110} dur={10} vol={0.25} />
      {KNOCKS_IN.map((k) => <Snd key={k} name="knock" at={k} dur={14} vol={0.55} />)}
      <Snd name="wind" at={B.knock1 + 40} dur={140} vol={0.08} />
      {KNOCKS_ME.map((k) => <Snd key={k} name="knock" at={k} dur={14} vol={0.6} />)}
      {/* B.still → B.reply: dead silence */}
      {KNOCKS_BED.map((k) => <Snd key={k} name="knock" at={k} dur={14} vol={0.4} />)}
      <Snd name="heartbeat" at={B.turn} dur={B.scare - B.turn} vol={0.25} loop />
      <Snd name="creak" at={B.turn + 30} vol={0.25} />
      <Snd name="sting" at={B.scare} dur={B.black - B.scare + 6} vol={0.85} />
    </AbsoluteFill>
  );
};
