import React from 'react';

// StickPro: the stickman with a face that acts. Same 260x420 box and same call shape as the old Stick
// (x, y, s, walk, arm, flip) plus: frame (drives breathing, blinking, sway), mood, role, look.
// Pure function of `frame`, so it renders identically every time.

const INK = '#1d1d2b';
export type StickMood = 'happy' | 'worry' | 'shock' | 'smirk' | 'angry' | 'sad';
export type StickRole = 'kid' | 'thief' | 'parent';

type P = {
  x: number; y: number; s?: number; frame: number;
  mood?: StickMood; role?: StickRole;
  walk?: number; arm?: number; flip?: boolean;
  look?: number;      // -1..1, where the pupils point
  bag?: boolean; shirt?: string; seed?: number;
  shadow?: boolean; talk?: boolean;
};

const BROWS: Record<StickMood, [string, string]> = {
  happy: ['M98 46 Q111 38 124 46', 'M136 46 Q149 38 162 46'],
  worry: ['M98 52 L124 40', 'M136 40 L162 52'],
  shock: ['M98 34 Q111 24 124 34', 'M136 34 Q149 24 162 34'],
  smirk: ['M98 50 L124 50', 'M136 36 Q149 30 162 38'],
  angry: ['M96 38 L124 54', 'M136 54 L164 38'],
  sad: ['M98 54 L124 44', 'M136 44 L162 54'],
};
const MOUTH: Record<StickMood, string> = {
  happy: 'M108 90 Q130 114 152 90',
  worry: 'M112 98 Q121 90 130 98 T148 98',
  shock: '',
  smirk: 'M112 96 Q134 102 152 86',
  angry: 'M110 102 Q130 84 150 102',
  sad: 'M112 102 Q130 88 148 102',
};

export const StickPro: React.FC<P> = ({x, y, s = 1, frame, mood = 'happy', role = 'kid', walk = 0, arm = 0, flip, look = 0, bag, shirt, seed = 0, shadow = true, talk}) => {
  const f = frame + seed * 17;
  const breathe = Math.sin(f / 11) * 2.6;
  const sway = Math.sin(f / 23) * 2;
  const blinkPhase = f % 96;
  const blink = blinkPhase < 4 ? 0.12 : 1;
  const sw = Math.sin(walk) * 22;
  const big = mood === 'shock';
  const eyeR = big ? 14 : 11;
  const px = look * 4.5, py = mood === 'worry' ? 2 : 0;
  const thief = role === 'thief', parent = role === 'parent';
  const shirtCol = shirt ?? (thief ? '#2b2f45' : parent ? '#7fd8a6' : '#fff6a8');
  const wave = Math.sin(f / 7) * 6 * (arm > 0 ? 1 : 0.3);
  // arms: shoulder -> elbow -> hand
  const hL = {x: 70 - arm * 10, y: 210 - arm * 50 + wave}, hR = {x: 190 + arm * 20, y: 210 - arm * 70 - wave};
  const eL = {x: 96, y: 186 - arm * 20}, eR = {x: 166, y: 186 - arm * 25};
  const mouthTalk = talk ? 6 + Math.abs(Math.sin(f / 3)) * 10 : 0;
  return (
    <svg width={260} height={420} viewBox="0 0 260 420" style={{position: 'absolute', left: x, top: y, scale: `${flip ? -s : s} ${s}`, transformOrigin: '130px 210px', overflow: 'visible'}}>
      {shadow && <ellipse cx={130} cy={402} rx={96} ry={13} fill="rgba(29,29,43,.18)" />}
      <g stroke={INK} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* legs + shoes */}
        <line x1={130} y1={250} x2={80 + sw} y2={388} /><line x1={130} y1={250} x2={180 - sw} y2={388} />
        <ellipse cx={72 + sw} cy={396} rx={26} ry={11} fill={INK} /><ellipse cx={188 - sw} cy={396} rx={26} ry={11} fill={INK} />
        <g transform={`translate(${sway} ${breathe})`}>
          {/* torso */}
          <line x1={130} y1={116} x2={130} y2={250} />
          <rect x={92} y={122} width={76} height={112 + breathe} rx={12} fill={shirtCol} strokeWidth={8} />
          {thief && [150, 176, 202].map((yy) => <line key={yy} x1={96} y1={yy} x2={164} y2={yy} strokeWidth={9} stroke="#e8ecff" />)}
          {bag && <rect x={152} y={132} width={52} height={88} rx={14} fill="#ff4d4d" />}
          {/* arms with elbows + hands */}
          <path d={`M126 150 Q${eL.x} ${eL.y} ${hL.x} ${hL.y}`} /><path d={`M134 150 Q${eR.x} ${eR.y} ${hR.x} ${hR.y}`} />
          <circle cx={hL.x} cy={hL.y} r={12} fill="#fff" strokeWidth={8} /><circle cx={hR.x} cy={hR.y} r={12} fill="#fff" strokeWidth={8} />
          {/* head */}
          <circle cx={130} cy={70} r={46} fill="#fff" />
          {!thief && !parent && <path d="M112 28 Q116 8 124 24 M130 24 Q136 4 142 24 M148 28 Q156 10 158 32" strokeWidth={8} />}
          {parent && <path d="M88 52 Q96 20 130 22 Q164 20 172 52" fill={INK} strokeWidth={6} />}
          {thief && <><path d="M84 54 Q88 8 130 6 Q172 8 176 54 Z" fill={INK} strokeWidth={6} /><rect x={86} y={56} width={88} height={30} rx={14} fill={INK} strokeWidth={4} /></>}
          {/* eyes */}
          <ellipse cx={112} cy={70} rx={eyeR} ry={eyeR * blink} fill="#fff" strokeWidth={6} /><ellipse cx={148} cy={70} rx={eyeR} ry={eyeR * blink} fill="#fff" strokeWidth={6} />
          {blink > 0.5 && <><circle cx={112 + px} cy={70 + py} r={big ? 4 : 5.5} fill={INK} stroke="none" /><circle cx={148 + px} cy={70 + py} r={big ? 4 : 5.5} fill={INK} stroke="none" /></>}
          {parent && <g strokeWidth={5}><circle cx={112} cy={70} r={18} /><circle cx={148} cy={70} r={18} /><line x1={130} y1={70} x2={130} y2={70} /></g>}
          {/* brows */}
          <path d={BROWS[mood][0]} strokeWidth={8} /><path d={BROWS[mood][1]} strokeWidth={8} />
          {/* mouth */}
          {mood === 'shock'
            ? <ellipse cx={130} cy={98} rx={11 + mouthTalk / 4} ry={15 + mouthTalk / 2} fill={INK} />
            : mouthTalk > 0 ? <ellipse cx={130} cy={98} rx={13} ry={4 + mouthTalk / 2} fill={INK} /> : <path d={MOUTH[mood]} strokeWidth={8} />}
          {mood === 'happy' && !thief && <><circle cx={96} cy={90} r={8} fill="#ff9ab0" stroke="none" /><circle cx={164} cy={90} r={8} fill="#ff9ab0" stroke="none" /></>}
          {mood === 'worry' && <path d="M172 40 Q178 54 172 62 Q166 54 172 40 Z" fill="#7fc4ff" strokeWidth={4} />}
        </g>
      </g>
    </svg>
  );
};
