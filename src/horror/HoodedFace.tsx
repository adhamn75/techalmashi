import React from 'react';

// The channel's hooded figure (logo look): pale face, glowing red eyes, black hood with a red rim.
// Shared by the horror episodes (one face per frame: the SVG ids are fixed).
const RED = '#ff1a33';

// ---------- the hooded face (logo look: pale face, glowing red eyes, black hood) ----------
export const Face: React.FC<{f: number; eye?: number}> = ({f, eye = 1}) => {
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

