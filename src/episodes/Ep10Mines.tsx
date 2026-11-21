import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import TL from './Ep10Mines.timeline.json';

// Episode 10 of أسرار Excel: Minesweeper in cells (files/minesweeper.xlsm, rules from files/minesweeper.bas:
// 14 x 14, 30 mines, first click safe, zeros open by flood-fill, right-click = flag).
// Look: NOT ep 9's daylight Excel window. Night-indigo sheet (the file's own RGB(20,22,40) frame), raised bevel cells,
// a big board edge to edge. Motion: each click opens as a ripple, one BFS ring every 2 frames; the reveal is an X-ray
// zoom on a "3" with its 3x3 neighbourhood; the climax is a chain reaction of every mine from the wrong click.

type Word = {w: string; start: number; end: number};
type V = {src: string; at: number; sec: number; words: Word[]};
const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const B = TL.beats;
export const EP10_FRAMES = TL.frames;

const NIGHT = '#141628';
const GOLD = '#ffd23c';
const XL = '#21a366';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const N = 14;
const MINES: [number, number][] = [[0, 0], [0, 6], [0, 8], [0, 13], [1, 7], [2, 9], [3, 12], [4, 0], [4, 1], [4, 11], [5, 0], [5, 3], [6, 6], [6, 11], [6, 13], [7, 7], [7, 12], [8, 3], [8, 10], [9, 1], [9, 12], [10, 3], [10, 6], [10, 8], [11, 7], [12, 0], [12, 1], [12, 3], [12, 7], [13, 12]];
const isMine = new Array(N * N).fill(false);
MINES.forEach(([x, y]) => (isMine[y * N + x] = true));
const nbrs = (i: number) => {
  const x = i % N, y = Math.floor(i / N), out: number[] = [];
  for (let j = y - 1; j <= y + 1; j++) for (let k = x - 1; k <= x + 1; k++)
    if ((k !== x || j !== y) && k >= 0 && k < N && j >= 0 && j < N) out.push(j * N + k);
  return out;
};
const COUNT = Array.from({length: N * N}, (_, i) => nbrs(i).filter((n) => isMine[n]).length);
const NUMCOL = ['', '#005aff', '#009628', '#e61e1e', '#14148c', '#8c1414', '#009696', '#000', '#5a5a5a'];

// open time (frame) of every safe cell: same flood-fill as the VBA, timed by BFS depth
const OPEN = new Array<number>(N * N).fill(Infinity);
const flood = (start: number, at: number) => {
  const depth = new Map<number, number>([[start, 0]]);
  const q = [start];
  while (q.length) {
    const c = q.shift()!;
    if (OPEN[c] < Infinity || isMine[c]) continue;
    OPEN[c] = at + depth.get(c)! * 2;
    if (COUNT[c] === 0) for (const n of nbrs(c)) if (!depth.has(n)) {depth.set(n, depth.get(c)! + 1); q.push(n);}
  }
};
const C1 = 9 * N + 4, C2 = 9 * N + 12;
flood(C1, B.click1 + 4);
flood(C2, B.click2 + 4);
const openedBy = (f: number) => OPEN.map((t) => t <= f);
const ALL = openedBy(1e9);
// the "3" we X-ray, a flagged mine and the wrong click, all on the edge of the open area
const THREE = 8 * N + 11;
const border = MINES.map(([x, y]) => y * N + x).filter((m) => nbrs(m).some((n) => ALL[n]));
const dist = (a: number, b: number) => Math.hypot((a % N) - (b % N), Math.floor(a / N) - Math.floor(b / N));
const FLAG = border.filter((m) => dist(m, THREE) > 2).sort((a, b) => dist(a, C1) - dist(b, C1))[0];
const BOOM = border.filter((m) => m !== FLAG && dist(m, THREE) > 2).sort((a, b) => dist(a, 7 * N + 7) - dist(b, 7 * N + 7))[0];
const BOOMAT = (m: number) => B.boom + Math.round(dist(m, BOOM) * 1.6);

const CELL = 68, BX = 84, BY = 448;
const cx = (i: number) => BX + (i % N) * CELL, cy = (i: number) => BY + Math.floor(i / N) * CELL;
const colName = (x: number) => String.fromCharCode(66 + x); // board starts at column B, row 5

const Cell: React.FC<{i: number; f: number}> = ({i, f}) => {
  const open = OPEN[i] <= f;
  const flagged = i === FLAG && f >= B.flag;
  const blown = isMine[i] && f >= BOOMAT(i) && i !== FLAG;
  const t = f - (open ? OPEN[i] : blown ? BOOMAT(i) : B.flag);
  const pop = interpolate(t, [0, 3, 7], [0.6, 1.08, 1], clamp);
  const style: React.CSSProperties = {position: 'absolute', left: (i % N) * CELL, top: Math.floor(i / N) * CELL, width: CELL, height: CELL, boxSizing: 'border-box'};
  if (blown) {
    const hot = i === BOOM;
    return (
      <div style={{...style, background: hot ? '#ff2b2b' : '#e1e4f0', border: '1px solid #9aa0bd', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{width: 40, height: 40, borderRadius: '50%', background: '#111', scale: `${pop}`, boxShadow: '0 0 0 5px #111 inset, 0 0 18px #ff5a2088', position: 'relative'}}>
          <div style={{position: 'absolute', left: 9, top: 8, width: 10, height: 10, borderRadius: '50%', background: '#fff'}} />
        </div>
      </div>
    );
  }
  if (open) {
    const k = COUNT[i];
    return (
      <div style={{...style, background: '#e1e4f0', border: '1px solid #b9bed4', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Segoe UI, Arial', fontWeight: 900, fontSize: 44, color: NUMCOL[k]}}>
        <span style={{scale: `${pop}`, opacity: interpolate(t, [0, 2], [0.2, 1], clamp)}}>{k || ''}</span>
      </div>
    );
  }
  return (
    <div style={{...style, background: flagged ? '#ffc83c' : '#969baf', borderTop: '6px solid #c9cde0', borderLeft: '6px solid #c9cde0', borderRight: '6px solid #5d6180', borderBottom: '6px solid #5d6180',
      display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      {flagged && (
        <svg width="44" height="48" viewBox="0 0 44 48" style={{translate: `0 ${interpolate(t, [0, 6], [-60, 0], {...clamp, easing: Easing.bounce})}px`}}>
          <rect x="20" y="6" width="5" height="34" fill="#222" />
          <path d="M25 6 L42 15 L25 24 Z" fill="#d40000" />
          <rect x="8" y="38" width="30" height="6" rx="2" fill="#222" />
        </svg>
      )}
    </div>
  );
};

const Cursor: React.FC<{f: number}> = ({f}) => {
  // waypoints: [frame, cell, click type]
  const P: [number, number][] = [[0, C1 - 2 * N - 3], [B.click1, C1], [B.click2 - 14, C1], [B.click2, C2], [B.reveal - 6, C2], [B.flag - 16, C2], [B.flag, FLAG], [B.boom - 18, FLAG], [B.boom, BOOM]];
  let k = 0;
  while (k < P.length - 2 && f > P[k + 1][0]) k++;
  const [f0, a] = P[k], [f1, b] = P[k + 1];
  const p = interpolate(f, [f0, f1], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const x = interpolate(p, [0, 1], [cx(a), cx(b)]) + CELL / 2, y = interpolate(p, [0, 1], [cy(a), cy(b)]) + CELL / 2;
  const press = [B.click1, B.click2, B.flag, B.boom].some((c) => f >= c - 2 && f < c + 3);
  const right = f >= B.flag - 2 && f < B.flag + 3;
  return (
    <div style={{position: 'absolute', left: x, top: y, scale: press ? '0.85' : '1', transformOrigin: '0 0'}}>
      {press && <div style={{position: 'absolute', left: -40, top: -40, width: 80, height: 80, borderRadius: '50%', border: `5px solid ${right ? '#ff5a3c' : GOLD}`}} />}
      <svg width="62" height="78" viewBox="0 0 31 39"><path d="M1 1 L1 30 L8 23 L13 36 L18 34 L13 21 L23 21 Z" fill="#fff" stroke="#000" strokeWidth="2" strokeLinejoin="round" /></svg>
      {right && <div style={{position: 'absolute', left: 50, top: 10, fontFamily: 'Segoe UI, Arial', fontWeight: 900, fontSize: 26, color: '#fff', background: '#ff5a3c', borderRadius: 10, padding: '2px 10px', whiteSpace: 'nowrap'}}>Right-click</div>}
    </div>
  );
};

// X-ray of the 3x3 around the "3": the hidden mines show through and get counted
const XRay: React.FC<{f: number}> = ({f}) => {
  const t = f - B.reveal;
  const ring = nbrs(THREE).filter((n) => isMine[n]);
  const k = interpolate(t, [4, 14], [0, 1], clamp);
  const x0 = cx(THREE) - CELL, y0 = cy(THREE) - CELL;
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      <defs><mask id="e10m"><rect width="1080" height="1920" fill="#fff" /><rect x={x0} y={y0} width={CELL * 3} height={CELL * 3} fill="#000" /></mask></defs>
      <rect width="1080" height="1920" fill="rgba(8,9,20,.7)" mask="url(#e10m)" opacity={k} />
      <rect x={x0 - 4} y={y0 - 4} width={CELL * 3 + 8} height={CELL * 3 + 8} fill="none" stroke={GOLD} strokeWidth="7" rx="6" opacity={k} />
      {ring.map((m, j) => {
        const on = t >= 22 + j * 12;
        const mx = cx(m) + CELL / 2, my = cy(m) + CELL / 2;
        return (
          <g key={m} opacity={k}>
            <circle cx={mx} cy={my} r={18} fill="#111" opacity={0.75} />
            <circle cx={mx - 6} cy={my - 6} r={4} fill="#fff" opacity={0.75} />
            {on && <><circle cx={mx} cy={my} r={30} fill="none" stroke="#ff5a3c" strokeWidth="5" />
              <circle cx={mx + 26} cy={my - 26} r={17} fill="#ff5a3c" />
              <text x={mx + 26} y={my - 18} textAnchor="middle" fontFamily="Segoe UI, Arial" fontWeight="900" fontSize="24" fill="#fff">{j + 1}</text></>}
          </g>
        );
      })}
    </svg>
  );
};

const CODE: {t: string; c: string; hl?: boolean}[] = [
  {t: 'For j = y - 1 To y + 1', c: '#569cd6'},
  {t: '  For i = x - 1 To x + 1', c: '#569cd6'},
  {t: '    If mine(i, j) Then n = n + 1', c: '#dcdcaa', hl: true},
  {t: '  Next i', c: '#569cd6'},
  {t: 'Next j   \' n = 3', c: '#6a9955'},
];
const Editor: React.FC<{f: number}> = ({f}) => {
  const chars = Math.max(0, (f - B.reveal - 6) * 6);
  let used = 0;
  return (
    <div style={{width: 960, borderRadius: 18, overflow: 'hidden', background: '#1e1e1e', boxShadow: '0 30px 80px rgba(0,0,0,.6)', border: '2px solid #33365a'}}>
      <div style={{height: 46, background: '#2b2d48', display: 'flex', alignItems: 'center', padding: '0 20px', fontFamily: 'Segoe UI, Arial', fontSize: 22, color: '#c9cde0'}}>
        VBA — MinesweeperGame · Function Around(x, y)
      </div>
      <div style={{padding: '10px 24px', fontFamily: 'Consolas, monospace', fontSize: 32, lineHeight: '46px', direction: 'ltr'}}>
        {CODE.map((l, i) => {
          const show = Math.max(0, Math.min(l.t.length, chars - used));
          used += l.t.length;
          const on = l.hl && f >= B.reveal + 22;
          return (
            <div key={i} style={{display: 'flex', whiteSpace: 'pre', color: l.c, margin: '0 -10px', padding: '0 10px', borderRadius: 6,
              background: on ? '#ff5a3c22' : 'transparent', outline: on ? '3px solid #ff5a3c' : 'none'}}>
              <span style={{color: '#5a5a5a', width: 44, flexShrink: 0}}>{i + 1}</span><span>{l.t.slice(0, show)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Led: React.FC<{v: number; label: string}> = ({v, label}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
    <div style={{fontFamily: FONT, fontWeight: 700, fontSize: 30, color: '#9aa0c8'}}>{label}</div>
    <div style={{background: '#050505', border: '4px solid #33365a', borderRadius: 10, padding: '0 16px', fontFamily: 'Consolas, monospace', fontWeight: 700, fontSize: 64, color: '#ff3b2f',
      textShadow: '0 0 14px #ff3b2f', letterSpacing: 4}}>{String(v).padStart(3, '0')}</div>
  </div>
);

const NUM = ['ألفين', 'وثمانية', 'وأربعين'];
const groupLatin = (ws: Word[]) => ws.reduce<Word[]>((a, w, i) => {
  const prev = a[a.length - 1];
  if (w.w === NUM[0] && ws[i + 1]?.w === NUM[1]) {a.push({w: '2048', start: w.start, end: ws[i + 2]?.end ?? w.end}); return a;}
  if (prev?.w === '2048' && (w.w === NUM[1] || w.w === NUM[2])) return a;
  if (prev && /^[A-Za-z]/.test(prev.w) && /^[A-Za-z]/.test(w.w)) {a[a.length - 1] = {w: `${prev.w} ${w.w}`, start: prev.start, end: w.end}; return a;}
  a.push(w); return a;
}, []);

// captions: dark glass slab with a coloured left-to-right underline (not ep 9's mint pill)
const Caption: React.FC<{line: V; accent: string}> = ({line, accent}) => {
  const frame = useCurrentFrame();
  const t = (frame - line.at) / 30;
  if (t < -0.1 || t > line.sec + 0.35) return null;
  const s = interpolate(t, [-0.1, 0.15], [0.92, 1], {...clamp, easing: Easing.out(Easing.back(2))});
  return (
    <div dir="rtl" lang="ar" style={{position: 'absolute', top: 64, left: 30, right: 30, minHeight: 196, background: 'rgba(30,32,58,.92)', border: '2px solid #3a3e6a', borderRadius: 26,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 68, lineHeight: 1.3, scale: `${s}`,
      opacity: interpolate(t, [-0.1, 0.05, line.sec + 0.15, line.sec + 0.35], [0, 1, 1, 0], clamp)}}>
      {groupLatin(line.words).map((w, i, ws) => {
        const said = t >= w.start;
        const on = said && t < (ws[i + 1]?.start ?? w.end + 0.3);
        return (
          <span key={i} dir={/[A-Za-z0-9]/.test(w.w) ? 'ltr' : undefined} style={{display: 'inline-block', unicodeBidi: 'isolate', margin: '0 0.13em',
            color: on ? accent : said ? '#fff' : 'rgba(255,255,255,.28)', borderBottom: `7px solid ${on ? accent : 'transparent'}`}}>{w.w}</span>
        );
      })}
    </div>
  );
};

export const Ep10Mines: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const xray = frame >= B.reveal && frame < B.flag - 8;
  const outro = frame >= B.outro;
  const so = spring({frame: frame - B.outro, fps, config: {damping: 15}});
  const zx = interpolate(frame, [B.reveal, B.reveal + 12, B.flag - 18, B.flag - 6], [0, 1, 1, 0], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const sc = interpolate(zx, [0, 1], [1, 1.35]) * interpolate(so, [0, 1], [1, 0.62]);
  const ox = interpolate(zx, [0, 1], [540, cx(THREE) + CELL / 2]);
  const oy = interpolate(zx, [0, 1], [900, cy(THREE) + CELL / 2]);
  const tb = frame - B.boom;
  const shake = tb >= 0 && tb < 22 ? Math.sin(tb * 2.7) * (22 - tb) * 1.3 : 0;
  const flash = interpolate(tb, [0, 2, 14], [0, 0.75, 0], clamp);
  const opened = openedBy(frame).filter(Boolean).length;
  const left = 30 - (frame >= B.flag ? 1 : 0);
  const name = xray ? `${colName(THREE % N)}${5 + Math.floor(THREE / N)}` : 'B5';
  const fx = xray ? '=Around(x, y)   → 3' : frame >= B.boom ? '"BOOM! You hit a mine"' : `="Mines left: ${left}"`;

  return (
    <AbsoluteFill style={{background: `radial-gradient(120% 70% at 50% 40%, #23264a 0%, ${NIGHT} 60%, #0a0b16 100%)`, overflow: 'hidden'}}>
      <AbsoluteFill style={{translate: `${shake}px ${shake * 0.6}px`}}>
        <AbsoluteFill style={{transformOrigin: `${ox}px ${oy}px`, scale: `${sc}`, translate: `0 ${interpolate(so, [0, 1], [0, -170])}px`}}>
          {/* formula bar */}
          <div style={{position: 'absolute', left: 40, top: 300, width: 1000, height: 66, borderRadius: 12, background: '#1f2240', border: '2px solid #33365a', display: 'flex', alignItems: 'center',
            fontFamily: 'Consolas, monospace', fontSize: 28, color: '#e6e8f5', direction: 'ltr', overflow: 'hidden'}}>
            <div style={{width: 110, textAlign: 'center', borderRight: '2px solid #33365a', color: xray ? GOLD : '#9aa0c8', fontWeight: 700}}>{name}</div>
            <div style={{padding: '0 14px', color: '#6c7099', fontStyle: 'italic'}}>fx</div>
            <div style={{whiteSpace: 'nowrap', color: frame >= B.boom ? '#ff6b5a' : xray ? GOLD : '#e6e8f5', fontWeight: 700}}>{fx}</div>
            <div style={{marginLeft: 'auto', marginRight: 16, color: XL, fontFamily: 'Segoe UI, Arial', fontWeight: 900, fontSize: 24}}>minesweeper.xlsm</div>
          </div>
          {/* headers */}
          {Array.from({length: N}, (_, x) => (
            <div key={`c${x}`} style={{position: 'absolute', left: BX + x * CELL, top: BY - 40, width: CELL, textAlign: 'center', fontFamily: 'Segoe UI, Arial', fontSize: 22, color: '#6c7099'}}>{colName(x)}</div>
          ))}
          {Array.from({length: N}, (_, y) => (
            <div key={`r${y}`} style={{position: 'absolute', left: 36, top: BY + y * CELL, width: 44, height: CELL, lineHeight: `${CELL}px`, textAlign: 'center', fontFamily: 'Segoe UI, Arial', fontSize: 20, color: '#6c7099'}}>{y + 5}</div>
          ))}
          <div style={{position: 'absolute', left: BX - 6, top: BY - 6, width: N * CELL + 12, height: N * CELL + 12, background: '#33365a', borderRadius: 8, boxShadow: '0 40px 90px rgba(0,0,0,.6)'}} />
          <div style={{position: 'absolute', left: BX, top: BY, width: N * CELL, height: N * CELL}}>
            {Array.from({length: N * N}, (_, i) => <Cell key={i} i={i} f={frame} />)}
          </div>
          {xray && <XRay f={frame} />}
          {!outro && !xray && <Cursor f={frame} />}
        </AbsoluteFill>

        {/* counters under the board */}
        {!outro && (
          <div style={{position: 'absolute', top: 1430, width: '100%', display: 'flex', justifyContent: 'center', gap: 60, opacity: xray ? 0 : 1}}>
            <Led v={left} label="💣" />
            <Led v={opened} label="خلايا مفتوحة" />
          </div>
        )}
        {frame >= B.click1 + 6 && frame < B.reveal - 4 && (
          <div dir="rtl" style={{position: 'absolute', top: 1560, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 52, color: GOLD,
            opacity: interpolate(frame, [B.click1 + 6, B.click1 + 16, B.reveal - 14, B.reveal - 4], [0, 1, 1, 0], clamp)}}>
            نقرة واحدة = {frame < B.click2 + 4 ? openedBy(B.click2).filter(Boolean).length : opened} خلية 🌊
          </div>
        )}
        {xray && (
          <div style={{position: 'absolute', left: 60, top: 1430, opacity: interpolate(frame, [B.reveal + 2, B.reveal + 12, B.flag - 16, B.flag - 8], [0, 1, 1, 0], clamp),
            translate: `0 ${interpolate(frame, [B.reveal + 2, B.reveal + 16], [300, 0], {...clamp, easing: Easing.out(Easing.cubic)})}px`}}>
            <Editor f={frame} />
          </div>
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{background: '#ff2b1a', opacity: flash, mixBlendMode: 'screen'}} />

      {outro && (
        <div dir="rtl" style={{position: 'absolute', top: 1060, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, opacity: so, translate: `0 ${(1 - so) * 80}px`}}>
          <div style={{display: 'inline-flex', alignItems: 'center', gap: 22, background: '#1f2240', border: `4px solid ${XL}`, borderRadius: 28, padding: '16px 34px', boxShadow: '0 20px 60px rgba(0,0,0,.5)'}}>
            <div style={{width: 76, height: 92, borderRadius: 10, background: XL, color: '#fff', fontSize: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8, fontFamily: 'Segoe UI, Arial'}}>xlsm</div>
            <div style={{textAlign: 'right'}}>
              <div style={{fontSize: 58, color: '#fff'}}>اكتب «أريده» 📥</div>
              <div style={{fontSize: 30, color: '#9fe3c0', fontWeight: 700}}>minesweeper.xlsm · مجاني · ويندوز وماك</div>
            </div>
          </div><br />
          <div style={{display: 'inline-block', fontSize: 42, color: '#140c06', background: '#ffd35a', borderRadius: 24, padding: '4px 30px', marginTop: 22,
            opacity: interpolate(frame, [B.outro + 10, B.outro + 20], [0, 1], clamp)}}>🔔 اشترك لتصلك اللعبة التالية</div><br />
          <div style={{display: 'inline-block', fontSize: 42, color: '#fff', background: '#2b2d48', border: '3px solid #edc22e', borderRadius: 24, padding: '4px 28px', marginTop: 18,
            opacity: interpolate(frame, [B.next - 2, B.next + 8], [0, 1], clamp), scale: `${interpolate(frame, [B.next - 2, B.next + 8], [0.8, 1], clamp)}`}}>الحلقة القادمة: لعبة 2048 🟨</div>
        </div>
      )}

      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', translate: outro ? '0px 720px' : '380px 640px',
        opacity: frame < 30 || xray ? 0 : interpolate(frame, [30, 42], [0, 1], clamp)}}>
        <Mokaab frame={frame} scale={0.19} y={0} mood={frame >= B.boom && !outro ? 'shock' : outro ? 'happy' : 'smirk'} wave={outro ? 1 : 0}
          lookX={-0.7} talk={speaking(LINES, frame)} rings={false} />
      </div>

      {VOICE.map((v, i) => <Caption key={v.src} line={v} accent={i === 3 ? '#ff6b5a' : i === 4 ? '#ffd35a' : i === 2 ? GOLD : '#7fe0ae'} />)}
      {outro && (
        <div dir="rtl" style={{position: 'absolute', bottom: 100, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 30, color: '#9aa0c8'}}>
          أسرار Excel · الحلقة 10 · تك عالماشي · خلّيك ذكي!
        </div>
      )}

      <VoiceTrack lines={LINES} />
      <Sfx name="click" at={B.click1} volume={0.5} />
      <Sfx name="whoosh" at={B.click1 + 4} volume={0.4} />
      <Sfx name="click" at={B.click2} volume={0.5} />
      <Sfx name="whoosh" at={B.click2 + 4} volume={0.4} />
      <Sfx name="whoosh" at={B.reveal - 2} volume={0.4} />
      {nbrs(THREE).filter((n) => isMine[n]).map((m, j) => <Sfx key={m} name="tick" at={B.reveal + 22 + j * 12} volume={0.5} />)}
      <Sfx name="pop" at={B.flag} volume={0.5} />
      <Sfx name="click" at={B.boom - 1} volume={0.5} />
      <Sfx name="buzz" at={B.boom} volume={0.6} />
      <Sfx name="whoosh" at={B.boom + 2} volume={0.55} />
      <Sfx name="pop" at={B.outro + 2} volume={0.45} />
      <Sfx name="ding" at={B.next} volume={0.4} />
    </AbsoluteFill>
  );
};
