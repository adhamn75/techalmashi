import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-900.css';
import '@fontsource/aref-ruqaa/arabic-700.css';
import {Line} from '../shared/Voice';

// Horror shorts · «قواعد جدّتي» · الحلقة 1: الصوت في العليّة
// Everything drawn in code (SVG/CSS). Voices: Hamed (narrator) + Zariyah (grandma), Edge TTS.

const N_SEC = [4.28, 3.70, 1.42, 1.40, 4.56]; // narrator wav lengths (public/voice/horror01)
const G_SEC = [3.45, 4.73, 6.30, 2.78, 5.82]; // grandma wav lengths (public/voice/horror01g)
const GAP = 10;
const ORDER: [('n' | 'g'), number][] = [['n', 0], ['g', 0], ['g', 1], ['g', 2], ['n', 1], ['g', 3], ['n', 2], ['g', 4], ['n', 3], ['n', 4]];
const LINES: (Line & {who: 'n' | 'g'; i: number})[] = [];
{
  let at = 4;
  for (const [who, i] of ORDER) {
    const sec = who === 'n' ? N_SEC[i] : G_SEC[i];
    LINES.push({who, i, at, dur: Math.round(sec * 30), src: `voice/${who === 'n' ? 'horror01' : 'horror01g'}/${i}.wav`});
    at += Math.round(sec * 30) + GAP;
  }
}
const L = (k: number) => LINES[k];
const end = (k: number) => L(k).at + L(k).dur;
// scenes, keyed to the voice
const S_NOTE = 0;
const S_HALL = L(4).at - 6;
const S_STAIRS = L(6).at - 8;
const S_KITCHEN = L(7).at - 4;
const S_ATTIC = L(8).at - 6;
const S_END = end(8) + 22;
export const H01_FRAMES = end(9) + 40;

const INK = '#0b0a1a';
const NIGHT = '#151335';
const VIOLET = '#2a2160';
const WARM = '#ffcf6b';
const BLOOD = '#e63946';
const PAPER = '#efe3c4';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const CAPTIONS: Record<string, string> = {
  n0: 'تركت لنا جدّتي ورقة... فيها قواعد البيت',
  g0: '١. لا تُطفئوا ضوء الممرّ',
  g1: '٢. لا تفتحوا الشبّاك بعد منتصف الليل',
  g2: '٣. إذا ناداكم صوتي من العليّة... لا تصعدوا',
  n1: 'في منتصف الليل... سمعنا صوتها',
  g3: '«حبيبي... اصعد إليّ»',
  n2: 'صعدتُ أوّل درجة...',
  g4: '«مع من تتكلّم يا حبيبي؟ أنا هنا... في المطبخ»',
  n3: 'فمن الذي في العليّة؟',
  n4: 'ما هي القاعدة الرابعة؟ اكتبها في التعليقات 👇',
};

const Sound: React.FC<{src: string; at: number; vol?: number; dur?: number}> = ({src, at, vol = 0.5, dur = 120}) => (
  <Sequence from={Math.max(0, Math.round(at))} durationInFrames={dur} layout="none"><Audio src={staticFile(src)} volume={vol} /></Sequence>
);

// ---------- shared drawing pieces ----------
const Grain: React.FC<{f: number}> = ({f}) => (
  <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'overlay', opacity: 0.22}}>
    <svg width="1080" height="1920">
      <filter id={`g${f % 6}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={f % 6} /><feColorMatrix type="saturate" values="0" /></filter>
      <rect width="1080" height="1920" filter={`url(#g${f % 6})`} />
    </svg>
  </AbsoluteFill>
);
const Vignette: React.FC<{k?: number}> = ({k = 0.85}) => (
  <AbsoluteFill style={{pointerEvents: 'none', background: `radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(0,0,0,${k}) 100%)`}} />
);
const Dust: React.FC<{f: number; color?: string}> = ({f, color = 'rgba(255,220,150,0.5)'}) => (
  <svg width="1080" height="1920" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
    {Array.from({length: 26}).map((_, i) => {
      const x = (i * 397) % 1080 + Math.sin((f + i * 40) / 50) * 30;
      const y = ((i * 733) % 1920 - f * (0.6 + (i % 3) * 0.3) + 1920 * 3) % 1920;
      return <circle key={i} cx={x} cy={y} r={2 + (i % 3)} fill={color} />;
    })}
  </svg>
);

// the child: an original chibi character (big head, big eyes, striped pyjamas)
const Kid: React.FC<{x: number; y: number; s?: number; look?: number; scared?: number; back?: boolean; f: number}> = ({x, y, s = 1, look = 0, scared = 0, back = false, f}) => {
  const blink = f % 90 > 86 ? 0.15 : 1;
  const shake = scared * Math.sin(f * 2.3) * 3;
  return (
    <g transform={`translate(${x + shake},${y}) scale(${s})`}>
      <ellipse cx="0" cy="250" rx="90" ry="16" fill="rgba(0,0,0,0.35)" />
      {/* body */}
      <path d="M-62 120 Q-70 230 -40 248 L40 248 Q70 230 62 120 Q0 92 -62 120 Z" fill="#5b6cff" />
      {[140, 175, 210].map((yy) => <path key={yy} d={`M-64 ${yy} Q0 ${yy - 10} 64 ${yy}`} stroke="#8fa0ff" strokeWidth="9" fill="none" />)}
      <rect x="-44" y="236" width="34" height="22" rx="10" fill="#f2d2b6" />
      <rect x="10" y="236" width="34" height="22" rx="10" fill="#f2d2b6" />
      {/* head */}
      <circle cx="0" cy="20" r="112" fill="#f6dcc4" />
      {back ? (
        <path d="M-114 10 Q-110 -110 0 -96 Q110 -110 114 10 Q120 90 70 120 L-70 120 Q-120 90 -114 10 Z" fill="#2b1d16" />
      ) : (
        <>
          <path d="M-114 0 Q-112 -112 0 -98 Q112 -112 114 0 Q90 -50 40 -40 Q10 -70 -20 -38 Q-70 -60 -114 0 Z" fill="#2b1d16" />
          <path d="M-10 -96 q10 -40 34 -30" stroke="#2b1d16" strokeWidth="14" fill="none" strokeLinecap="round" />
          {[-44, 44].map((ex) => (
            <g key={ex} transform={`translate(${ex},30) scale(1,${blink})`}>
              <ellipse rx={26 + scared * 4} ry={32 + scared * 6} fill="white" />
              <ellipse cx={look * 8} cy="4" rx={18 - scared * 6} ry={22 - scared * 6} fill="#2a1b4a" />
              <circle cx={look * 8 - 6} cy="-6" r="6" fill="white" />
            </g>
          ))}
          <ellipse cx="-74" cy="70" rx="16" ry="9" fill="#ff9aa2" opacity="0.6" />
          <ellipse cx="74" cy="70" rx="16" ry="9" fill="#ff9aa2" opacity="0.6" />
          {scared > 0.5 ? <ellipse cx="0" cy="84" rx="12" ry="16" fill="#5a2a2a" /> : <path d="M-14 80 q14 12 28 0" stroke="#5a2a2a" strokeWidth="6" fill="none" strokeLinecap="round" />}
        </>
      )}
    </g>
  );
};

const Caption: React.FC<{f: number}> = ({f}) => {
  const cur = LINES.find((l) => f >= l.at - 2 && f < l.at + l.dur + 8);
  if (!cur) return null;
  const k = cur.who + cur.i;
  const p = interpolate(f - cur.at, [-2, 6], [0, 1], clamp);
  const grandma = cur.who === 'g';
  return (
    <div style={{position: 'absolute', bottom: 250, left: 60, right: 60, textAlign: 'center', direction: 'rtl', opacity: p,
      transform: `translateY(${(1 - p) * 20}px)`}}>
      <span style={{fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 64, lineHeight: 1.35, color: grandma ? '#ffd9e0' : 'white',
        textShadow: '0 4px 18px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.9)'}}>{CAPTIONS[k]}</span>
    </div>
  );
};

// ---------- 1. the note ----------
const Note: React.FC<{f: number; rulesShown: number; hot: number; fourth?: boolean}> = ({f, rulesShown, hot, fourth}) => {
  const rules = ['١. لا تُطفئوا ضوء الممرّ.', '٢. لا تفتحوا الشبّاك بعد منتصف الليل.', '٣. إذا ناداكم صوتي من العليّة… لا تصعدوا.'];
  return (
    <div style={{position: 'absolute', left: 120, top: 360, width: 840, height: 1000, background: PAPER, transform: `rotate(-3deg)`,
      boxShadow: '0 40px 90px rgba(0,0,0,0.7)', borderRadius: 8, padding: '90px 70px', boxSizing: 'border-box', direction: 'rtl',
      backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 86px, rgba(120,90,50,0.18) 86px 88px)'}}>
      <div style={{position: 'absolute', top: -30, left: '50%', marginLeft: -60, width: 120, height: 60, background: 'rgba(230,220,190,0.75)', transform: 'rotate(4deg)'}} />
      <div style={{fontFamily: '"Aref Ruqaa", serif', fontWeight: 700, fontSize: 92, color: '#3a2412', textAlign: 'center', marginBottom: 40}}>قواعد البيت</div>
      {rules.map((r, i) => {
        const p = interpolate(rulesShown - i, [0, 0.4], [0, 1], clamp);
        const isHot = i === 2 && hot > 0;
        return (
          <div key={i} style={{fontFamily: '"Aref Ruqaa", serif', fontWeight: 700, fontSize: 58, lineHeight: 1.45, color: isHot ? BLOOD : '#3a2412',
            marginBottom: 34, opacity: p, clipPath: `inset(0 0 0 ${(1 - p) * 100}%)`,
            transform: isHot ? `translateX(${Math.sin(f * 1.7) * 2 * hot}px)` : undefined}}>{r}</div>
        );
      })}
      {fourth && (
        <div style={{fontFamily: '"Aref Ruqaa", serif', fontWeight: 700, fontSize: 58, color: '#3a2412', opacity: 0.85}}>
          ٤. <span style={{display: 'inline-block', width: 420, borderBottom: '5px dashed #8a6a4a', transform: 'translateY(-14px)'}} />
        </div>
      )}
      <div style={{position: 'absolute', bottom: 60, left: 70, fontFamily: '"Aref Ruqaa", serif', fontSize: 50, color: '#5a3a1e'}}>— ستّك</div>
    </div>
  );
};

const NoteScene: React.FC = () => {
  const f = useCurrentFrame();
  const shown = interpolate(f, [L(1).at, L(1).at + 18, L(2).at, L(2).at + 18, L(3).at, L(3).at + 18], [0, 1, 1, 2, 2, 3], clamp);
  const hot = interpolate(f, [L(3).at + 30, L(3).at + 50], [0, 1], clamp);
  // camera: wide on the note, then pushes in on each rule as grandma reads it
  const zoom = interpolate(f, [0, L(1).at - 10, L(1).at + 10, S_HALL], [1.0, 1.04, 1.32, 1.42], clamp);
  const lineY = interpolate(f, [L(1).at, L(2).at, L(3).at, L(3).at + 40], [640, 760, 900, 920], clamp);
  const candle = 0.85 + Math.sin(f / 3) * 0.05 + Math.sin(f / 7.3) * 0.05;
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 50% 40%, #3b2a1a 0%, ${INK} 75%)`}}>
      <AbsoluteFill style={{transform: `scale(${zoom}) rotate(${Math.sin(f / 40) * 0.6}deg)`, transformOrigin: `50% ${f < L(1).at ? 860 : lineY}px`}}>
        <Note f={f} rulesShown={f < L(1).at ? 3 : shown} hot={f < L(1).at ? 1 : hot} />
      </AbsoluteFill>
      <AbsoluteFill style={{background: `radial-gradient(circle at 80% 85%, rgba(255,190,90,${0.35 * candle}) 0%, transparent 45%)`}} />
      {/* hook title on frame 0 */}
      <div style={{position: 'absolute', top: 120, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: 'Cairo, sans-serif', fontWeight: 900,
        fontSize: 78, color: 'white', textShadow: '0 6px 24px black', opacity: interpolate(f, [L(1).at - 10, L(1).at], [1, 0], clamp)}}>
        لا تكسر <span style={{color: BLOOD}}>القاعدة ٣</span>
      </div>
      <Dust f={f} />
    </AbsoluteFill>
  );
};

// ---------- 2. hallway at midnight ----------
const House: React.FC<{f: number; doorGlow: number; lightOn: number}> = ({f, doorGlow, lightOn}) => (
  <svg width="1080" height="1920" style={{position: 'absolute', inset: 0}}>
    <defs>
      <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={VIOLET} /><stop offset="1" stopColor={NIGHT} /></linearGradient>
      <radialGradient id="lamp" cx="0.5" cy="0.2" r="0.6"><stop offset="0" stopColor={WARM} stopOpacity={0.55 * lightOn} /><stop offset="1" stopColor={WARM} stopOpacity="0" /></radialGradient>
    </defs>
    <rect width="1080" height="1920" fill="url(#wall)" />
    {/* hallway lamp */}
    <rect width="1080" height="1920" fill="url(#lamp)" />
    {/* stairs going up to the attic, left side */}
    {Array.from({length: 9}).map((_, i) => (
      <rect key={i} x={80 + i * 52} y={1500 - i * 110} width={420 - i * 20} height={110} fill={i % 2 ? '#22194a' : '#271d55'} stroke="#120e2a" strokeWidth="4" />
    ))}
    {/* attic door at the top of the stairs */}
    <rect x="430" y="300" width="240" height="330" rx="10" fill="#0a0818" stroke="#3a2f78" strokeWidth="10" />
    <rect x="430" y="300" width={240 * (0.12 + 0.05 * Math.sin(f / 20))} height="330" fill={`rgba(170,140,255,${0.15 + doorGlow * 0.35})`} />
    {/* window with moon */}
    <rect x="760" y="520" width="200" height="280" rx="100" fill="#0e1a3a" stroke="#3a2f78" strokeWidth="10" />
    <circle cx="880" cy="600" r="44" fill="#e8ecff" opacity="0.85" />
    <line x1="860" y1="520" x2="860" y2="800" stroke="#3a2f78" strokeWidth="8" />
    <line x1="540" y1="0" x2="540" y2="110" stroke="#111" strokeWidth="6" />
    <circle cx="540" cy="130" r="30" fill={lightOn > 0.5 ? WARM : '#444'} />
    {/* floor */}
    <rect y="1610" width="1080" height="310" fill="#100c26" />
    {/* clock */}
    <g transform="translate(860,1050)">
      <circle r="70" fill="#d9c9a0" stroke="#3a2412" strokeWidth="8" />
      <line x1="0" y1="0" x2="0" y2="-50" stroke="#3a2412" strokeWidth="8" strokeLinecap="round" />
      <line x1="0" y1="0" x2="0" y2="-38" stroke="#3a2412" strokeWidth="8" strokeLinecap="round" transform="rotate(-2)" />
      <rect x="-14" y="70" width="28" height="200" fill="#5a3a1e" />
      <circle cx={Math.sin(f / 8) * 30} cy="260" r="20" fill="#c9a24a" />
    </g>
  </svg>
);

const HallScene: React.FC = () => {
  const f = useCurrentFrame();
  const g = f + S_HALL;
  const whisper = g >= L(5).at;
  const flick = (g % 47 < 3 || g % 61 < 2) && whisper ? 0.2 : 1;
  const push = interpolate(f, [0, S_STAIRS - S_HALL], [1, 1.18]);
  return (
    <AbsoluteFill style={{background: NIGHT}}>
      <AbsoluteFill style={{transform: `scale(${push})`, transformOrigin: '50% 30%'}}>
        <House f={g} doorGlow={whisper ? 1 : 0} lightOn={flick} />
        <svg width="1080" height="1920" style={{position: 'absolute', inset: 0}}><Kid x={720} y={1180} s={0.9} f={g} look={-1} scared={whisper ? 0.7 : 0} /></svg>
        {/* the voice drifting down from the attic */}
        {whisper && (
          <div style={{position: 'absolute', left: 340, top: 200, width: 420, textAlign: 'center', fontFamily: '"Aref Ruqaa", serif', fontSize: 60,
            color: 'rgba(220,200,255,0.9)', filter: 'blur(0.6px)', textShadow: '0 0 20px rgba(170,140,255,0.9)',
            transform: `translateY(${Math.sin(g / 9) * 8}px)`, opacity: interpolate(g, [L(5).at, L(5).at + 12], [0, 1], clamp)}}>حبيبي…</div>
        )}
        {/* midnight stamp */}
        <div style={{position: 'absolute', top: 900, left: 805, fontFamily: 'Cairo', fontWeight: 900, fontSize: 44, color: WARM,
          opacity: interpolate(f, [0, 10], [0, 1], clamp)}}>00:00</div>
      </AbsoluteFill>
      <Dust f={g} color="rgba(180,170,255,0.4)" />
    </AbsoluteFill>
  );
};

// ---------- 3. first step ----------
const StairsScene: React.FC = () => {
  const f = useCurrentFrame();
  const g = f + S_STAIRS;
  const step = interpolate(f, [8, 26], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  return (
    <AbsoluteFill style={{background: NIGHT}}>
      <AbsoluteFill style={{transform: `scale(${1.15 + step * 0.1})`, transformOrigin: '35% 55%'}}>
        <House f={g} doorGlow={1} lightOn={g % 37 < 2 ? 0.1 : 1} />
        <svg width="1080" height="1920" style={{position: 'absolute', inset: 0}}><Kid x={300 + step * 60} y={1250 - step * 110} s={0.8} f={g} back /></svg>
      </AbsoluteFill>
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% 25%, rgba(150,120,255,0.18), transparent 40%)`}} />
    </AbsoluteFill>
  );
};

// ---------- 4. grandma in the kitchen ----------
const KitchenScene: React.FC = () => {
  const f = useCurrentFrame();
  const g = f + S_KITCHEN;
  const turn = interpolate(f, [10, 24], [0, 1], clamp);
  const steam = (i: number) => Math.sin((g + i * 20) / 10) * 10;
  return (
    <AbsoluteFill style={{background: NIGHT}}>
      <svg width="1080" height="1920" style={{position: 'absolute'}}>
        <rect width="1080" height="1920" fill={VIOLET} />
        {/* kitchen doorway, warm and safe */}
        <rect x="560" y="380" width="440" height="1240" fill="#ffbf69" />
        <rect x="560" y="380" width="440" height="1240" fill="url(#kglow)" />
        <defs><radialGradient id="kglow" cx="0.5" cy="0.3" r="0.8"><stop offset="0" stopColor="#fff2c8" /><stop offset="1" stopColor="#e59c3c" /></radialGradient></defs>
        <rect x="540" y="360" width="480" height="1280" fill="none" stroke="#120e2a" strokeWidth="40" />
        {/* grandma: bun, glasses, apron, wooden spoon */}
        <g transform="translate(780,1000)">
          <ellipse cx="0" cy="610" rx="150" ry="20" fill="rgba(0,0,0,0.25)" />
          <path d="M-130 220 Q-150 600 -110 610 L110 610 Q150 600 130 220 Q0 160 -130 220 Z" fill="#7b3f6e" />
          <path d="M-80 260 L80 260 L95 560 L-95 560 Z" fill="#f4efe6" />
          <circle cx="0" cy="70" r="140" fill="#f1cfb2" />
          <path d="M-142 60 Q-130 -90 0 -80 Q130 -90 142 60 Q110 -10 0 -20 Q-110 -10 -142 60 Z" fill="#d9d9e3" />
          <circle cx="0" cy="-90" r="50" fill="#d9d9e3" />
          {[-50, 50].map((ex) => <g key={ex}><circle cx={ex} cy="70" r="34" fill="none" stroke="#3a2412" strokeWidth="7" /><ellipse cx={ex} cy="72" rx="9" ry="11" fill="#2a1b4a" /></g>)}
          <line x1="-16" y1="70" x2="16" y2="70" stroke="#3a2412" strokeWidth="7" />
          <path d="M-30 140 q30 22 60 0" stroke="#7a3a3a" strokeWidth="8" fill="none" strokeLinecap="round" />
          <ellipse cx="-90" cy="118" rx="20" ry="11" fill="#ff9aa2" opacity="0.6" />
          <ellipse cx="90" cy="118" rx="20" ry="11" fill="#ff9aa2" opacity="0.6" />
          <rect x="140" y="230" width="18" height="190" rx="9" fill="#a0703c" transform="rotate(14 150 320)" />
        </g>
        {/* pot steam */}
        {[0, 1, 2].map((i) => <path key={i} d={`M${900 + i * 30} 940 q${steam(i)} -40 0 -80 q${-steam(i)} -40 0 -80`} stroke="rgba(255,255,255,0.5)" strokeWidth="8" fill="none" />)}
      </svg>
      <svg width="1080" height="1920" style={{position: 'absolute'}}>
        <Kid x={290} y={1120} s={0.95} f={g} look={turn} back={turn < 0.5} scared={turn} />
      </svg>
    </AbsoluteFill>
  );
};

// ---------- 5. who is in the attic ----------
const AtticScene: React.FC = () => {
  const f = useCurrentFrame();
  const zoom = interpolate(f, [0, 60], [1, 2.6], {...clamp, easing: Easing.in(Easing.cubic)});
  const open = interpolate(f, [10, 50], [0.12, 0.34], clamp);
  const eyes = spring({frame: f - 34, fps: 30, config: {damping: 200}});
  const black = interpolate(f, [S_END - S_ATTIC - 10, S_END - S_ATTIC], [0, 1], clamp);
  return (
    <AbsoluteFill style={{background: '#06050e'}}>
      <AbsoluteFill style={{transform: `scale(${zoom})`, transformOrigin: '50% 24%'}}>
        <House f={f} doorGlow={0} lightOn={0.1} />
        <svg width="1080" height="1920" style={{position: 'absolute', inset: 0}}>
          <rect x="430" y="300" width={240 * open} height="330" fill="#000" />
          {[0, 1].map((i) => (
            <ellipse key={i} cx={448 + i * 34 + 6} cy={430} rx={9} ry={9 * eyes} fill="#ff2b4a" style={{filter: 'drop-shadow(0 0 6px #ff2b4a)'}} />
          ))}
          <path d={`M450 470 q 18 ${14 * eyes} 36 0`} stroke="#ff2b4a" strokeWidth="3" fill="none" opacity={eyes} />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill style={{background: '#000', opacity: black}} />
    </AbsoluteFill>
  );
};

// ---------- 6. end: the question + loop back to the note ----------
const EndScene: React.FC = () => {
  const f = useCurrentFrame();
  const g = f + S_END;
  const p = spring({frame: f, fps: 30, config: {damping: 14}});
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 50% 40%, #3b2a1a 0%, ${INK} 75%)`}}>
      <AbsoluteFill style={{transform: `scale(${0.9 + p * 0.1})`, opacity: p}}>
        <Note f={g} rulesShown={3} hot={1} fourth />
      </AbsoluteFill>
      <div style={{position: 'absolute', top: 120, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: 'Cairo', fontWeight: 900, fontSize: 80,
        color: 'white', textShadow: '0 6px 24px black', opacity: p}}>الجزء ٢ <span style={{color: BLOOD}}>قريبًا</span></div>
      <Dust f={g} />
    </AbsoluteFill>
  );
};

export const H01Rules: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: INK, overflow: 'hidden'}}>
      <Sequence durationInFrames={S_HALL}><NoteScene /></Sequence>
      <Sequence from={S_HALL} durationInFrames={S_STAIRS - S_HALL}><HallScene /></Sequence>
      <Sequence from={S_STAIRS} durationInFrames={S_KITCHEN - S_STAIRS}><StairsScene /></Sequence>
      <Sequence from={S_KITCHEN} durationInFrames={S_ATTIC - S_KITCHEN}><KitchenScene /></Sequence>
      <Sequence from={S_ATTIC} durationInFrames={S_END - S_ATTIC}><AtticScene /></Sequence>
      <Sequence from={S_END} durationInFrames={H01_FRAMES - S_END}><EndScene /></Sequence>
      <Vignette k={f >= S_ATTIC && f < S_END ? 0.95 : 0.8} />
      <Grain f={f} />
      <Caption f={f} />
      {/* voices */}
      {LINES.map((l) => (
        <Sequence key={l.src} from={l.at} durationInFrames={l.dur + 6} layout="none"><Audio src={staticFile(l.src)} volume={l.who === 'g' && l.i === 3 ? 0.8 : 1} /></Sequence>
      ))}
      {/* score: drone bed, heartbeat, creak, sting */}
      <Sound src="sfx/horror/drone.wav" at={0} vol={0.28} dur={360} />
      <Sound src="sfx/horror/drone.wav" at={340} vol={0.32} dur={360} />
      <Sound src="sfx/horror/drone.wav" at={680} vol={0.3} dur={360} />
      <Sound src="sfx/horror/drone.wav" at={1020} vol={0.3} dur={300} />
      <Sound src="sfx/horror/sting.wav" at={L(3).at + 32} vol={0.35} dur={90} />
      {Array.from({length: 6}).map((_, i) => <Sound key={`c${i}`} src="sfx/horror/clock.wav" at={S_HALL + i * 15} vol={0.5} dur={4} />)}
      <Sound src="sfx/horror/wind.wav" at={L(5).at - 6} vol={0.4} dur={120} />
      <Sound src="sfx/horror/flicker.wav" at={L(5).at + 10} vol={0.3} dur={20} />
      <Sound src="sfx/horror/creak.wav" at={S_STAIRS + 10} vol={0.6} dur={34} />
      {Array.from({length: 4}).map((_, i) => <Sound key={`h${i}`} src="sfx/horror/heartbeat.wav" at={S_STAIRS + 30 + i * 22} vol={0.55} dur={27} />)}
      {Array.from({length: 5}).map((_, i) => <Sound key={`k${i}`} src="sfx/horror/heartbeat.wav" at={S_ATTIC + i * 16} vol={0.6} dur={27} />)}
      <Sound src="sfx/horror/sting.wav" at={S_ATTIC + 34} vol={0.6} dur={90} />
    </AbsoluteFill>
  );
};
