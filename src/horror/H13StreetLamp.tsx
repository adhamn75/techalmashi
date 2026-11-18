import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import TL from './H13StreetLamp.timeline.json';

// Horror ep 13 — «عمود الإنارة». Every night a man stands under the street lamp, one step closer each night.
// Tonight the lamp is empty… then a knock on my door.
// Look: seen from my upstairs window through half-open blinds (night 1 / 2 / 3 hard cuts with a counter),
// a sodium lamp glowing blood-red on a wet street, a faceless silhouette that grows each night. The scare
// is a fisheye peephole view — none of the earlier eps used either. Never gore.
// Voice: Hamed +4 %, −18 Hz (public/voice/h13-streetlamp).

const FONT = 'Cairo, sans-serif';
const RED = '#ff1a33';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const H13_FRAMES = TL.frames;
const B = TL.beats;
const VO = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const TEXT = ['كل ليلة… رجلٌ تحت عمود الإنارة', 'وكل ليلة أقرب بخطوة', 'الليلة… العمود فارغ', 'ثمّ طرق أحدٌ بابي'];
const rnd = (n: number) => {const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x);};

const Snd: React.FC<{name: string; at: number; dur?: number; vol?: number; loop?: boolean}> = ({name, at, dur = 90, vol = 0.3, loop}) => (
  <Sequence from={Math.round(at)} durationInFrames={Math.max(1, dur)} layout="none"><Audio src={staticFile(`sfx/horror/${name}.wav`)} volume={vol} loop={loop} /></Sequence>
);

const Caption: React.FC<{text: string; f: number; from: number; to: number; red?: boolean; y?: number; size?: number}> = ({text, f, from, to, red, y = 1560, size = 64}) => {
  if (f < from || f > to) return null;
  const o = interpolate(f, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: y, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.35,
      color: red ? RED : '#efe7e4', opacity: o, textShadow: '0 0 24px #000, 0 4px 0 #000, 0 0 6px #000'}}>{text}</div>
  );
};

// a faceless man in a long coat, feet at (x, y), h tall; eyes only show when he looks up
const Man: React.FC<{x: number; y: number; h: number; eyes?: number; sway?: number}> = ({x, y, h, eyes = 0, sway = 0}) => {
  const s = h / 300;
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(${sway})`}>
      {/* red haze behind him so the silhouette reads on the dark street */}
      <ellipse cx="0" cy="-160" rx="150" ry="230" fill="#ff1a33" opacity="0.16" style={{filter: 'blur(30px)'}} />
      <ellipse cx="0" cy="0" rx="70" ry="12" fill="#000" opacity="0.7" />
      <path d="M-16 0 L-12 -90 L12 -90 L16 0 Z" fill="#020101" />
      <path d="M-46 -70 C-50 -150 -44 -200 -36 -228 L36 -228 C44 -200 50 -150 46 -70 Z" fill="#030102" />
      <path d="M-36 -228 C-30 -244 30 -244 36 -228" fill="#030102" />
      <ellipse cx="0" cy="-262" rx="26" ry="32" fill="#030102" />
      {/* hat brim */}
      <ellipse cx="0" cy="-282" rx="42" ry="9" fill="#030102" />
      <rect x="-24" y="-312" width="48" height="30" rx="6" fill="#030102" />
      {/* red rim light from the lamp */}
      <path d="M36 -228 C44 -200 50 -150 46 -70" stroke={RED} strokeWidth="4" fill="none" opacity="0.8" />
      <path d="M-36 -228 C-44 -200 -50 -150 -46 -70" stroke={RED} strokeWidth="2" fill="none" opacity="0.35" />
      <path d="M-24 -282 L24 -282 M26 -262 C26 -240 18 -232 0 -230" stroke={RED} strokeWidth="2.5" fill="none" opacity="0.6" />
      {eyes > 0 && (
        <g opacity={eyes} style={{filter: 'drop-shadow(0 0 6px #ff1a33)'}}>
          <circle cx="-10" cy="-262" r="5.5" fill={RED} />
          <circle cx="10" cy="-262" r="5.5" fill={RED} />
        </g>
      )}
    </g>
  );
};

// the street below my window (night n = 1..4; 4 = empty lamp)
const Street: React.FC<{f: number; night: number; local: number}> = ({f, night, local}) => {
  const buzz = night === 4 ? (rnd(Math.floor(f / 2)) > 0.55 ? 1 : 0.25) : 0.9 + 0.1 * Math.sin(f / 7);
  const men = [
    {x: 742, y: 1050, h: 150, eyes: 0},
    {x: 610, y: 1290, h: 240, eyes: 0},
    {x: 440, y: 1600, h: 360, eyes: interpolate(local, [20, 40], [0, 1], clamp)},
  ];
  const m = night <= 3 ? men[night - 1] : null;
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
      <defs>
        <radialGradient id="h13cone" cx="50%" cy="0%" r="100%">
          <stop offset="0" stopColor="#ff3a24" stopOpacity="0.55" /><stop offset="1" stopColor="#ff1a33" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="h13pool" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ff2a1e" stopOpacity="0.5" /><stop offset="1" stopColor="#ff1a33" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="h13sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" /><stop offset="1" stopColor="#120305" />
        </linearGradient>
      </defs>
      <rect width="1080" height="1920" fill="url(#h13sky)" />
      {/* the houses across the street, all windows dark */}
      <path d="M0 520 L0 300 L180 220 L360 300 L360 520 Z M360 520 L360 340 L620 340 L620 520 Z M620 520 L620 260 L820 180 L1080 260 L1080 520 Z" fill="#070203" />
      {[[60, 360], [240, 360], [430, 400], [700, 320], [900, 330]].map(([x, y], i) => <rect key={i} x={x} y={y} width="70" height="90" fill="#0d0405" />)}
      {/* far pavement, road (wet, perspective), near pavement */}
      <path d="M0 520 L1080 520 L1080 1000 L0 1000 Z" fill="#0b0405" />
      <path d="M0 1000 L1080 1000 L1080 1500 L0 1500 Z" fill="#080303" />
      {Array.from({length: 7}, (_, i) => <rect key={i} x={60 + i * 160} y="1240" width="90" height="12" fill="#2a1a18" opacity="0.6" />)}
      <path d="M0 1500 L1080 1500 L1080 1920 L0 1920 Z" fill="#0c0506" />
      {Array.from({length: 6}, (_, i) => <line key={i} x1={i * 200} y1="1500" x2={i * 200 - 60} y2="1920" stroke="#050202" strokeWidth="4" />)}
      <rect x="0" y="1494" width="1080" height="12" fill="#1a0c0c" />
      {/* lamp light: cone + pool + reflection on the wet road */}
      <path d="M800 440 L560 1060 L1040 1060 Z" fill="url(#h13cone)" opacity={buzz} />
      <ellipse cx="780" cy="1050" rx="300" ry="70" fill="url(#h13pool)" opacity={buzz} />
      <rect x="770" y="1000" width="30" height="520" fill="#ff2a1e" opacity={0.12 * buzz} style={{filter: 'blur(10px)'}} />
      {/* lamp post */}
      <rect x="772" y="430" width="14" height="625" fill="#040202" />
      <path d="M779 432 Q780 400 820 404 L826 420" stroke="#040202" strokeWidth="10" fill="none" />
      <path d="M800 414 L850 414 L842 440 L808 440 Z" fill="#160606" />
      <rect x="810" y="438" width="30" height="8" fill="#ffb09a" opacity={buzz} style={{filter: 'drop-shadow(0 0 20px #ff3a24)'}} />
      {/* rain streaks */}
      {Array.from({length: 46}, (_, i) => {
        const x = rnd(i) * 1080; const y = ((rnd(i + 50) * 1920 + f * 38) % 2000) - 80;
        return <line key={i} x1={x} y1={y} x2={x - 8} y2={y + 60} stroke="#ff6a5a" strokeWidth="2" opacity={x > 560 && y < 1100 ? 0.35 : 0.08} />;
      })}
      {m && <Man {...m} sway={Math.sin(f / 40) * 0.6} />}
    </svg>
  );
};

// my window: frame + half-open blinds
const Blinds: React.FC<{f: number; part: number}> = ({f, part}) => (
  <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
    {Array.from({length: 26}, (_, i) => {
      const top = i < 13;
      const y = top ? i * 30 - part : 1920 - (26 - i) * 30 + part * 0.6;
      return <g key={i}>
        <rect x="0" y={y} width="1080" height="22" fill="#0a0506" />
        <rect x="0" y={y + 20} width="1080" height="2" fill={RED} opacity="0.12" />
      </g>;
    })}
    <rect x="0" y="0" width="40" height="1920" fill="#050203" />
    <rect x="1040" y="0" width="40" height="1920" fill="#050203" />
    <rect x="530" y="0" width="20" height="1920" fill="#050203" opacity="0.9" />
    {/* condensation on the glass */}
    {Array.from({length: 30}, (_, i) => <circle key={i} cx={rnd(i + 9) * 1080} cy={rnd(i + 99) * 1920} r={2 + rnd(i) * 5} fill="#ffd0c8" opacity={0.08} />)}
    <path d={`M120 ${400 + (f % 200)} q4 30 0 80`} stroke="#ffd0c8" strokeWidth="3" opacity="0.08" fill="none" />
  </svg>
);

// fisheye peephole: hallway outside my door, the man filling the lens
const Peephole: React.FC<{f: number}> = ({f}) => {
  const lean = interpolate(f, [B.peep, B.scare], [1, 1.35], {...clamp, easing: Easing.in(Easing.quad)});
  const lunge = f >= B.scare ? interpolate(f, [B.scare, B.scare + 8], [1, 2.4], {...clamp, easing: Easing.out(Easing.cubic)}) : 1;
  const flick = f >= B.scare && rnd(f) > 0.7 ? 0.3 : 1;
  const light = rnd(Math.floor(f / 3)) > 0.12 ? 1 : 0.4;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920">
        <defs>
          <clipPath id="h13lens"><circle cx="540" cy="880" r="430" /></clipPath>
          <radialGradient id="h13edge" cx="50%" cy="50%" r="50%">
            <stop offset="0.6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.95" />
          </radialGradient>
          <radialGradient id="h13hall" cx="50%" cy="20%" r="70%">
            <stop offset="0" stopColor="#5a0a12" /><stop offset="1" stopColor="#0a0203" />
          </radialGradient>
        </defs>
        <g clipPath="url(#h13lens)" opacity={flick}>
          <rect x="100" y="440" width="880" height="880" fill="url(#h13hall)" opacity={light} />
          {/* bent hallway walls (fisheye) */}
          <path d="M110 450 Q300 880 110 1320" stroke="#1a0507" strokeWidth="80" fill="none" />
          <path d="M970 450 Q780 880 970 1320" stroke="#1a0507" strokeWidth="80" fill="none" />
          <path d="M200 1250 Q540 1150 880 1250" stroke="#140405" strokeWidth="40" fill="none" />
          <rect x="500" y="460" width="80" height="14" fill="#ff8a7a" opacity={0.6 * light} style={{filter: 'drop-shadow(0 0 20px #ff1a33)'}} />
          <g transform={`translate(540 720) scale(${lean * lunge}) translate(-540 -720)`}>
            <Man x={540} y={1480} h={720} eyes={1} />
          </g>
        </g>
        <circle cx="540" cy="880" r="430" fill="url(#h13edge)" />
        <circle cx="540" cy="880" r="436" fill="none" stroke="#1a0a0a" strokeWidth="14" />
      </svg>
    </AbsoluteFill>
  );
};

export const H13StreetLamp: React.FC = () => {
  const f = useCurrentFrame();
  // nights: three hard cuts inside lines 0-1, then the empty lamp
  const cuts = [0, B.n2, B.n3, B.empty];
  const night = f >= B.empty ? 4 : f >= B.n3 ? 3 : f >= B.n2 ? 2 : 1;
  const start = cuts[night - 1];
  const local = f - start;
  const black = local < 3 && night > 1; // 3-frame blackout on each cut
  const push = interpolate(local, [0, 120], [1.0, 1.08], clamp) * (night === 4 ? interpolate(local, [0, 90], [1, 1.12], clamp) : 1);
  const part = interpolate(f, [0, B.n2], [0, 40], clamp);
  const toDoor = f >= B.peep;
  const nightLabel = ['الليلة ١', 'الليلة ٢', 'الليلة ٣', 'الليلة ٤'][night - 1];

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {!toDoor && !black && (
        <AbsoluteFill style={{transform: `scale(${push})`, transformOrigin: night === 4 ? '72% 50%' : '50% 55%'}}>
          <Street f={f} night={night} local={local} />
          <Blinds f={f} part={part} />
        </AbsoluteFill>
      )}
      {!toDoor && !black && (
        <div style={{position: 'absolute', top: 120, right: 70, fontFamily: FONT, fontWeight: 700, fontSize: 44, color: RED, letterSpacing: 2,
          textShadow: '0 0 14px #ff1a33', opacity: interpolate(local, [0, 4], [0, 1], clamp)}}>{nightLabel} · 3:00</div>
      )}
      {/* knock: the screen shakes on each hit */}
      {toDoor && f < B.black && <Peephole f={f} />}

      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,.88) 100%)', pointerEvents: 'none'}} />
      <AbsoluteFill style={{opacity: 0.08, mixBlendMode: 'screen', pointerEvents: 'none',
        backgroundImage: `repeating-radial-gradient(circle at ${rnd(f) * 100}% ${rnd(f + 3) * 100}%, rgba(255,255,255,.5) 0 1px, transparent 1px 3px)`}} />

      {TEXT.map((t, i) => <Caption key={i} f={f} from={i === 0 ? 0 : VO[i].at - 2} to={VO[i].at + VO[i].dur + 10} text={t} red={i >= 2} size={i === 3 ? 66 : 62} y={toDoor ? 1460 : 1560} />)}
      {f >= B.black && (
        <>
          <Caption f={f} from={B.black + 2} to={H13_FRAMES} text="الليلة القادمة… صوت أمّي يناديني من المطبخ" y={780} red size={56} />
          <div style={{position: 'absolute', top: 1080, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: 44,
            opacity: interpolate(f, [B.black + 26, B.black + 36], [0, 1], clamp)}}>
            <span style={{background: '#ffd35a', color: '#140406', borderRadius: 24, padding: '6px 30px'}}>🔔 اشترك لتصلك قصة الليلة القادمة</span>
          </div>
        </>
      )}

      <Snd name="wind" at={0} dur={B.knock} vol={0.25} loop />
      <Snd name="drone" at={0} dur={B.silence} vol={0.28} loop />
      {[B.n2, B.n3, B.empty].map((c, i) => <Snd key={`c${i}`} name="clock" at={c} dur={10} vol={0.45} />)}
      {Array.from({length: 4}, (_, i) => <Snd key={`h${i}`} name="heartbeat" at={B.empty + 10 + i * 22} dur={24} vol={0.4} />)}
      {[0, 14, 28].map((d, i) => <Snd key={`k${i}`} name="knock" at={B.knock + 14 + d} dur={14} vol={0.6} />)}
      <Snd name="creak" at={B.peep} dur={30} vol={0.3} />
      <Snd name="sting" at={B.scare} dur={90} vol={0.6} />
      <Snd name="flicker" at={B.scare + 2} dur={20} vol={0.4} />
      <Snd name="drone" at={B.black} dur={H13_FRAMES - B.black} vol={0.18} />
      {VO.map((v) => (
        <Sequence key={v.src} from={v.at} durationInFrames={v.dur + 8} layout="none"><Audio src={staticFile(v.src)} volume={1} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
