import React from 'react';
import {AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import TL from './Ep03Tetris.timeline.json';

// Episode 3 of أسرار Excel: a real Tetris (rotation, line clears, score) running in cells.
// The file is files/tetris.xlsm (VBA in files/tetris.bas). Look: black arcade cabinet, amber neon floor,
// dark-mode Excel window tilted in 3D — nothing like ep1 (white sheet, green) or ep2 (purple, chart).

const LINES: Line[] = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const B = TL.beats;
export const EP03_FRAMES = TL.frames;

const AMBER = '#ff8a00';
const CYAN = '#00e5ff';
const INK = '#07070c';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// ---------- the same pieces / rotation as the VBA (ShapeCells) ----------
const SHAPES = ['01112131', '10201121', '10011121', '10200111', '00101121', '00011121', '20011121'];
const COLORS = ['#00e5ff', '#ffd600', '#aa46ff', '#28d25a', '#ff3c46', '#326eff', '#ff8c00'];
const cellsOf = (k: number, r: number): [number, number][] => {
  const n = k === 0 ? 4 : 3;
  return [0, 1, 2, 3].map((i) => {
    let x = +SHAPES[k][i * 2], y = +SHAPES[k][i * 2 + 1];
    if (k !== 1) for (let j = 0; j < r; j++) [x, y] = [n - 1 - y, x];
    return [x, y];
  });
};

const W = 10, H = 20;
type Grid = number[][]; // -1 empty, else colour index
type Frame = {grid: Grid; piece: {k: number; r: number; x: number; y: number} | null; flash: number[]; flashT: number; score: number; lines: number};

// scripted game: which piece, where it ends up (rotation, column). Gravity + moves happen like the VBA loop.
const SCRIPT = [
  {k: 1, r: 0, x: 3, y0: 5},  // O — already falling at frame 0
  {k: 5, r: 0, x: 6},         // J closes row 16 except the well
  {k: 0, r: 1, x: 7},         // I, rotated, into the well -> TETRIS
  {k: 2, r: 2, x: 0},
  {k: 3, r: 0, x: 5},
  {k: 4, r: 1, x: 1},
  {k: 6, r: 3, x: 7},
];

const simulate = (frames: number): Frame[] => {
  const grid: Grid = Array.from({length: H}, () => Array(W).fill(-1));
  // a game in progress: 4 full rows with a one-column well on the right, plus a ragged row on top
  const junk = [3, 5, 6, 2, 4, 0, 1, 3, 6, 5, 2, 4];
  for (let y = 16; y < 20; y++) for (let x = 0; x < 9; x++) grid[y][x] = junk[(x * 3 + y) % junk.length];
  for (let x = 0; x < 4; x++) grid[15][x] = junk[(x + 5) % junk.length];
  let si = 0, score = 2400, lines = 36;
  let p = {k: SCRIPT[0].k, r: 0, x: 3, y: SCRIPT[0].y0 ?? 0};
  let flash: number[] = [], flashT = 0, spawnWait = 0;
  const fits = (k: number, r: number, x0: number, y0: number) =>
    cellsOf(k, r).every(([x, y]) => x0 + x >= 0 && x0 + x < W && y0 + y < H && (y0 + y < 0 || grid[y0 + y][x0 + x] < 0));
  const out: Frame[] = [];
  for (let f = 0; f < frames; f++) {
    const snap = (): Frame => ({grid: grid.map((r) => [...r]), piece: spawnWait > 0 || flashT > 0 ? null : {...p}, flash: [...flash], flashT, score, lines});
    if (flashT > 0) {
      flashT--;
      if (flashT === 0) {
        for (const row of [...flash].sort((a, b) => a - b)) { grid.splice(row, 1); grid.unshift(Array(W).fill(-1)); }
        flash = [];
        spawnWait = 4;
      }
      out.push(snap());
      continue;
    }
    if (spawnWait > 0) {
      spawnWait--;
      if (spawnWait === 0) { si = Math.min(si + 1, SCRIPT.length - 1); p = {k: SCRIPT[si].k, r: 0, x: 3, y: SCRIPT[si].k === 0 ? -1 : 0}; }
      out.push(snap());
      continue;
    }
    if (f % 2 === 0) {
      const t = SCRIPT[si];
      if (p.r !== t.r && fits(p.k, (p.r + 1) % 4, p.x, p.y)) p.r = (p.r + 1) % 4;
      else if (p.x !== t.x && fits(p.k, p.r, p.x + Math.sign(t.x - p.x), p.y)) p.x += Math.sign(t.x - p.x);
      if (fits(p.k, p.r, p.x, p.y + 1)) p.y++;
      else {
        cellsOf(p.k, p.r).forEach(([x, y]) => { if (p.y + y >= 0) grid[p.y + y][p.x + x] = p.k; });
        const full = grid.map((row, i) => (row.every((c) => c >= 0) ? i : -1)).filter((i) => i >= 0);
        if (full.length) { flash = full; flashT = 12; lines += full.length; score += [0, 100, 300, 500, 800][full.length] * 4; }
        else spawnWait = 3;
        score += 18;
      }
    }
    out.push(snap());
  }
  return out;
};
const STATES = simulate(B.matrix + 20);
const CLEAR_AT = STATES.findIndex((s) => s.flashT === 12);
const LOCKS = STATES.map((s, i) => (i > 0 && s.piece === null && STATES[i - 1].piece !== null && s.flashT === 0 ? i : -1)).filter((i) => i > 0);

// ---------- dark-mode Excel window ----------
const CELL = 56, HDR_W = 46, HDR_H = 34;
const COLS = 'BCDEFGHIJK'.split('');
const SIDE = 250;

const Block: React.FC<{c: number; size: number; glow?: number}> = ({c, size, glow = 0}) => (
  <div style={{width: size, height: size, boxSizing: 'border-box', background: COLORS[c],
    boxShadow: `inset 0 6px 0 rgba(255,255,255,.35), inset 0 -6px 0 rgba(0,0,0,.35)${glow ? `, 0 0 ${18 * glow}px ${COLORS[c]}` : ''}`}} />
);

const ExcelTetris: React.FC<{s: Frame; f: number}> = ({s, f}) => {
  const live = new Map<string, number>();
  if (s.piece) cellsOf(s.piece.k, s.piece.r).forEach(([x, y]) => live.set(`${s.piece!.x + x},${s.piece!.y + y}`, s.piece!.k));
  const flashOn = s.flashT > 0 && Math.floor(s.flashT / 2) % 2 === 0;
  const next = SCRIPT[Math.min(SCRIPT.length - 1, (s.piece ? SCRIPT.findIndex((t) => t.k === s.piece!.k) : 0) + 1)].k;
  return (
    <div style={{width: HDR_W + CELL * W + SIDE, borderRadius: 18, overflow: 'hidden', background: '#16161f',
      boxShadow: `0 0 0 3px #2a2a3a, 0 40px 120px rgba(0,0,0,.8), 0 0 80px rgba(255,138,0,.18)`}}>
      <div style={{height: 58, background: '#1e1e2a', display: 'flex', alignItems: 'center', padding: '0 22px', gap: 12}}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{width: 18, height: 18, borderRadius: 9, background: c}} />)}
        <div style={{flex: 1, textAlign: 'center', color: '#e8e8f0', fontFamily: 'sans-serif', fontWeight: 700, fontSize: 28}}>tetris.xlsm</div>
      </div>
      <div style={{height: 52, display: 'flex', alignItems: 'center', borderBottom: '2px solid #2a2a3a', fontFamily: 'sans-serif', fontSize: 26, color: '#c9c9d6'}}>
        <div style={{width: 100, textAlign: 'center', borderRight: '2px solid #2a2a3a'}}>N4</div>
        <div style={{padding: '0 16px', fontStyle: 'italic', color: '#777'}}>fx</div>
        <div style={{fontFamily: 'monospace'}}>score = <b style={{color: AMBER}}>{s.score}</b></div>
      </div>
      <div style={{display: 'flex', background: '#1b1b26', height: HDR_H}}>
        <div style={{width: HDR_W}} />
        {COLS.map((c) => <div key={c} style={{width: CELL, textAlign: 'center', lineHeight: `${HDR_H}px`, fontFamily: 'sans-serif', fontSize: 20, color: '#777'}}>{c}</div>)}
        <div style={{width: SIDE, lineHeight: `${HDR_H}px`, fontFamily: 'sans-serif', fontSize: 20, color: '#777', paddingLeft: 30}}>N</div>
      </div>
      <div style={{display: 'flex'}}>
        <div>
          {Array.from({length: H}).map((_, y) => (
            <div key={y} style={{display: 'flex'}}>
              <div style={{width: HDR_W, height: CELL, background: '#1b1b26', textAlign: 'center', lineHeight: `${CELL}px`, fontFamily: 'sans-serif', fontSize: 18, color: '#666'}}>{y + 3}</div>
              {Array.from({length: W}).map((__, x) => {
                const lk = live.get(`${x},${y}`);
                const g = s.grid[y][x];
                const isFlash = s.flash.includes(y);
                return (
                  <div key={x} style={{width: CELL, height: CELL, background: '#12121c', borderTop: '1px solid #262636', borderLeft: '1px solid #262636', boxSizing: 'border-box', position: 'relative'}}>
                    {isFlash ? <div style={{position: 'absolute', inset: 0, background: flashOn ? '#ffffff' : COLORS[g], boxShadow: flashOn ? '0 0 30px #fff' : 'none'}} />
                      : lk !== undefined ? <Block c={lk} size={CELL - 1} glow={0.8} />
                        : g >= 0 ? <Block c={g} size={CELL - 1} /> : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{width: SIDE, borderLeft: '3px solid #2a2a3a', padding: '26px 0 0 30px', boxSizing: 'border-box', fontFamily: 'sans-serif', color: '#9a9aae'}}>
          {[['SCORE', s.score], ['LINES', s.lines], ['LEVEL', 4]].map(([k, v]) => (
            <div key={k as string} style={{marginBottom: 34}}>
              <div style={{fontSize: 24, fontWeight: 700, letterSpacing: 2}}>{k}</div>
              <div style={{fontSize: 46, fontWeight: 800, color: k === 'SCORE' ? AMBER : '#fff', fontFamily: 'monospace'}}>{v}</div>
            </div>
          ))}
          <div style={{fontSize: 24, fontWeight: 700, letterSpacing: 2, marginBottom: 14}}>NEXT</div>
          <div style={{position: 'relative', width: 4 * 40, height: 3 * 40}}>
            {cellsOf(next, 0).map(([x, y], i) => (
              <div key={i} style={{position: 'absolute', left: x * 40, top: (y - (next === 0 ? 1 : 0)) * 40}}><Block c={next} size={38} /></div>
            ))}
          </div>
          <div style={{marginTop: 70, width: 150, height: 50, borderRadius: 12, background: '#00aac8', color: '#fff', fontWeight: 800, fontSize: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.9 + 0.1 * Math.sin(f / 6)}}>Play</div>
        </div>
      </div>
    </div>
  );
};

// ---------- background: amber perspective floor + scanlines ----------
const Floor: React.FC<{f: number; o?: number}> = ({f, o = 1}) => {
  const lines = Array.from({length: 14}, (_, i) => {
    const t = ((i + (f / 20) % 1) / 14);
    return 1200 + Math.pow(t, 2.2) * 720;
  });
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, opacity: o}}>
      <defs>
        <linearGradient id="fl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={AMBER} stopOpacity="0" />
          <stop offset="1" stopColor={AMBER} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {lines.map((y, i) => <line key={i} x1={0} x2={1080} y1={y} y2={y} stroke="url(#fl)" strokeWidth={2 + (y - 1200) / 260} />)}
      {Array.from({length: 17}, (_, i) => <line key={`v${i}`} x1={540 + (i - 8) * 40} y1={1200} x2={540 + (i - 8) * 260} y2={1920} stroke="url(#fl)" strokeWidth={2} />)}
      <rect x={0} y={1180} width={1080} height={30} fill={AMBER} opacity={0.08} />
    </svg>
  );
};
const Scan: React.FC = () => (
  <AbsoluteFill style={{background: 'repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 2px, transparent 2px 5px)', pointerEvents: 'none'}} />
);

const Cap: React.FC<{text: React.ReactNode; f: number; at: number; top?: number; size?: number}> = ({text, f, at, top = 110, size = 84}) => {
  const p = spring({frame: f - at, fps: 30, config: {damping: 15, stiffness: 160}});
  return (
    <div style={{position: 'absolute', top, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size,
      color: '#fff', whiteSpace: 'nowrap', opacity: p, transform: `translateY(${(1 - p) * 30}px)`, textShadow: '0 6px 30px rgba(0,0,0,.8)'}}>{text}</div>
  );
};

// ---------- 1. the game, from frame 0 ----------
const Game: React.FC = () => {
  const f = useCurrentFrame();
  const s = STATES[Math.min(f, STATES.length - 1)];
  // window starts tilted in 3D and settles flat
  const settle = interpolate(f, [0, 40], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const rx = 18 * (1 - settle), ry = -14 * (1 - settle);
  const exit = interpolate(f, [B.matrix - 10, B.matrix + 6], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  const shake = CLEAR_AT > 0 && f >= CLEAR_AT && f < CLEAR_AT + 10 ? Math.sin(f * 3.1) * 8 * (1 - (f - CLEAR_AT) / 10) : 0;
  const tetris = spring({frame: f - CLEAR_AT, fps: 30, config: {damping: 9, stiffness: 180}});
  const tetrisO = interpolate(f, [CLEAR_AT, CLEAR_AT + 4, CLEAR_AT + 36, CLEAR_AT + 44], [0, 1, 1, 0], clamp);
  const chips = [['تدوير', 98], ['مسح الصفوف', 120], ['نقاط', 146]] as const;
  return (
    <AbsoluteFill style={{perspective: 1800}}>
      {f < 90 ? <Cap f={f} at={-10} size={74} text={<>تتريس حقيقية… داخل <span style={{color: AMBER}}>Excel</span>!</>} />
        : (
          <div style={{position: 'absolute', top: 120, width: '100%', display: 'flex', justifyContent: 'center', gap: 22, direction: 'rtl'}}>
            {chips.map(([t, at]) => {
              const p = spring({frame: f - at, fps: 30, config: {damping: 11, stiffness: 200}});
              return (
                <div key={t} style={{fontFamily: FONT, fontWeight: 900, fontSize: 56, color: INK, background: AMBER, borderRadius: 18, padding: '6px 30px',
                  transform: `scale(${p})`, boxShadow: '0 10px 40px rgba(255,138,0,.45)'}}>✓ {t}</div>
              );
            })}
          </div>
        )}
      <div style={{position: 'absolute', top: 290, left: '50%', transformOrigin: 'top center',
        transform: `translateX(-50%) translateX(${shake}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${0.97 - exit * 0.25})`, opacity: 1 - exit, filter: `blur(${exit * 10}px)`}}>
        <ExcelTetris s={s} f={f} />
      </div>
      {CLEAR_AT > 0 && f >= CLEAR_AT && (
        <div style={{position: 'absolute', top: 900, width: '100%', textAlign: 'center', opacity: tetrisO, transform: `scale(${0.6 + tetris * 0.5}) rotate(-6deg)`}}>
          <div style={{fontFamily: 'sans-serif', fontWeight: 900, fontSize: 130, color: '#fff', letterSpacing: 6, textShadow: `0 0 30px ${CYAN}, 0 0 60px ${CYAN}, 0 8px 0 #006c80`}}>TETRIS!</div>
          <div style={{fontFamily: 'monospace', fontWeight: 900, fontSize: 70, color: AMBER, textShadow: '0 0 24px rgba(255,138,0,.8)'}}>+3200</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ---------- 2. every piece is a matrix of numbers ----------
const Matrix: React.FC = () => {
  const f = useCurrentFrame();
  const at = (d: number) => spring({frame: f - d, fps: 30, config: {damping: 14, stiffness: 150}});
  const rot = interpolate(f, [52, 70], [0, 90], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const cells = cellsOf(2, 0);
  const on = (x: number, y: number) => cells.some(([a, b]) => a === x && b === y);
  const SZ = 190;
  return (
    <AbsoluteFill>
      <Cap f={f} at={2} text={<>كل قطعة = <span style={{color: AMBER}}>مصفوفة أرقام</span></>} />
      <div style={{position: 'absolute', top: 430, left: 540 - SZ * 1.5, width: SZ * 3, height: SZ * 3, transform: `scale(${at(6)}) rotate(${rot}deg)`}}>
        {[0, 1, 2].map((y) => [0, 1, 2].map((x) => {
          const v = on(x, y);
          return (
            <div key={`${x}${y}`} style={{position: 'absolute', left: x * SZ, top: y * SZ, width: SZ - 10, height: SZ - 10, borderRadius: 18,
              background: v ? COLORS[2] : '#15151f', border: v ? 'none' : '3px dashed #34344a', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'monospace', fontWeight: 900, fontSize: 110, color: v ? '#fff' : '#4a4a62',
              boxShadow: v ? `0 0 40px ${COLORS[2]}, inset 0 10px 0 rgba(255,255,255,.3)` : 'none', transform: `rotate(${-rot}deg)`}}>{v ? 1 : 0}</div>
          );
        }))}
      </div>
      <div style={{position: 'absolute', top: 1090, width: '100%', textAlign: 'center', opacity: at(36), transform: `translateY(${(1 - at(36)) * 30}px)`}}>
        <div style={{display: 'inline-block', fontFamily: 'monospace', fontSize: 58, color: '#fff', background: '#15151f', border: `3px solid ${AMBER}`, borderRadius: 20, padding: '20px 40px', direction: 'ltr'}}>
          x′ = 2 − y &nbsp;&nbsp; y′ = x
        </div>
        <div style={{fontFamily: FONT, fontWeight: 700, fontSize: 50, color: '#b9b9cc', marginTop: 26, direction: 'rtl'}}>الدوران = معادلة واحدة</div>
      </div>
      <div style={{position: 'absolute', top: 1420, width: '100%', textAlign: 'center', opacity: at(70), fontFamily: FONT, fontWeight: 900, fontSize: 64, color: CYAN, direction: 'rtl'}}>
        والخلية = بكسل
      </div>
    </AbsoluteFill>
  );
};

// ---------- 3. the loop (VBA) ----------
const CODE: [string, string][] = [
  ['kw', 'Do While alive'],
  ['', '  If Pressed(vbKeyLeft) Then TryMove -1, 0'],
  ['', '  If Tapped(vbKeyUp) Then TryRotate'],
  ['', '  If Timer >= nextDrop Then'],
  ['', '    If Not TryMove(0, 1) Then LockAndNext'],
  ['', '  End If'],
  ['', '  DoEvents: Sleep 15'],
  ['kw', 'Loop'],
];
const Code: React.FC = () => {
  const f = useCurrentFrame();
  const p = spring({frame: f, fps: 30, config: {damping: 16, stiffness: 140}});
  const pulse = interpolate(f % 20, [0, 10, 20], [0.4, 1, 0.4]);
  return (
    <AbsoluteFill>
      <Cap f={f} at={0} text={<>حلقة <span style={{color: AMBER}}>VBA</span> صغيرة</>} />
      <div style={{position: 'absolute', top: 360, left: 50, right: 50, background: '#0e0e16', borderRadius: 26, border: '2px solid #2a2a3a',
        padding: '34px 36px', direction: 'ltr', transform: `translateX(${(1 - p) * 900}px) rotate(${(1 - p) * 6}deg)`, boxShadow: '0 30px 100px rgba(0,0,0,.7)'}}>
        <div style={{fontFamily: 'monospace', fontSize: 26, color: '#666', marginBottom: 14}}>Module1 · Sub Tetris()</div>
        {CODE.map(([t, line], i) => {
          const o = interpolate(f, [4 + i * 5, 10 + i * 5], [0, 1], clamp);
          return (
            <div key={i} style={{fontFamily: 'monospace', fontSize: 34, lineHeight: 1.7, whiteSpace: 'pre', opacity: o,
              color: t === 'kw' ? AMBER : '#e6e6f0', transform: `translateX(${(1 - o) * 30}px)`}}>{line}</div>
          );
        })}
      </div>
      <div style={{position: 'absolute', top: 1110, width: '100%', display: 'flex', justifyContent: 'center', gap: 26, direction: 'rtl'}}>
        {['تُسقطها', 'تلوّنها', 'تمسح الصف'].map((t, i) => {
          const q = spring({frame: f - 30 - i * 10, fps: 30, config: {damping: 12}});
          return <div key={t} style={{fontFamily: FONT, fontWeight: 900, fontSize: 50, color: '#fff', border: `3px solid ${CYAN}`, borderRadius: 16, padding: '8px 26px', transform: `scale(${q})`,
            boxShadow: `0 0 ${20 * pulse}px rgba(0,229,255,.5)`}}>{t}</div>;
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------- 4. CTA ----------
const RAIN = Array.from({length: 16}, (_, i) => ({k: i % 7, x: (i * 137) % 1000, sp: 5 + (i * 7) % 6, d: (i * 53) % 400, r: i % 4}));
const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const a = spring({frame: f, fps: 30, config: {damping: 12}});
  const b = spring({frame: f - 16, fps: 30, config: {damping: 13}});
  return (
    <AbsoluteFill>
      {RAIN.map((p, i) => {
        const y = ((f * p.sp + p.d) % 2100) - 180;
        return (
          <div key={i} style={{position: 'absolute', left: p.x, top: y, opacity: 0.35, transform: `rotate(${p.r * 90}deg)`}}>
            {cellsOf(p.k, 0).map(([x, yy], j) => <div key={j} style={{position: 'absolute', left: x * 44, top: yy * 44}}><Block c={p.k} size={42} /></div>)}
          </div>
        );
      })}
      <AbsoluteFill><Mokaab frame={f + 380} scale={a * 0.7} y={1.5} mood="happy" wave={1} talk={speaking(LINES, f + B.outro)} /></AbsoluteFill>
      <div style={{position: 'absolute', top: 1090, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, color: '#fff', direction: 'rtl'}}>
        <div style={{fontSize: 92, transform: `scale(${a})`}}>الملف مجاني 🎮</div>
        <div style={{fontSize: 64, marginTop: 26, opacity: b, transform: `translateY(${(1 - b) * 40}px)`}}>
          اكتب <span style={{color: AMBER}}>«أريده»</span> في التعليقات
        </div>
        <div style={{fontSize: 40, marginTop: 64, color: '#9a9aae', fontWeight: 700, opacity: b}}>أسرار Excel · الحلقة 3</div>
        <div style={{fontSize: 44, marginTop: 12, fontWeight: 900, direction: 'ltr', opacity: b}}>@tech3almashi</div>
      </div>
    </AbsoluteFill>
  );
};

export const Ep03Tetris: React.FC = () => {
  const f = useCurrentFrame();
  const floorO = f < B.matrix ? 1 : f < B.outro ? 0.45 : 0.8;
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 30%, #1a1208 0%, ${INK} 65%)`, overflow: 'hidden'}}>
      <Floor f={f} o={floorO} />
      <Sequence durationInFrames={B.matrix + 8}><Game /></Sequence>
      <Sequence from={B.matrix} durationInFrames={B.code - B.matrix}><Matrix /></Sequence>
      <Sequence from={B.code} durationInFrames={B.outro - B.code}><Code /></Sequence>
      <Sequence from={B.outro}><Outro /></Sequence>
      {f < B.outro && (
        <AbsoluteFill><Mokaab frame={f} scale={0.3} y={-3.05} mood={f >= CLEAR_AT && f < CLEAR_AT + 50 ? 'shock' : 'smirk'}
          lookX={-0.6} talk={speaking(LINES, f)} rings={false} /></AbsoluteFill>
      )}
      <Scan />
      <VoiceTrack lines={LINES} />
      {LOCKS.filter((x) => x < B.matrix).map((x) => <Sfx key={x} name="tick" at={x} volume={0.45} />)}
      {CLEAR_AT > 0 && <Sfx name="ding" at={CLEAR_AT} volume={0.55} />}
      {CLEAR_AT > 0 && <Sfx name="whoosh" at={CLEAR_AT + 12} volume={0.45} />}
      {[98, 120, 146].map((x) => <Sfx key={x} name="pop" at={x} volume={0.4} />)}
      <Sfx name="whoosh" at={B.matrix - 6} volume={0.5} />
      <Sfx name="click" at={B.matrix + 52} volume={0.5} />
      <Sfx name="whoosh" at={B.code} volume={0.5} />
      {CODE.map((_, i) => <Sfx key={`t${i}`} name="tick" at={B.code + 4 + i * 5} volume={0.4} />)}
      <Sfx name="pop" at={B.outro + 2} volume={0.55} />
    </AbsoluteFill>
  );
};
