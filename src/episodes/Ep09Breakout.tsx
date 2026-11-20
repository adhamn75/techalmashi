import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import TL from './Ep09Breakout.timeline.json';
import {simulate, State, W, H, BR, BC, BW, BH, BY0, PY, PW, ROWCOL} from './Ep09Breakout.sim';

// Episode 9 of أسرار Excel: Breakout (brick breaker) played inside the cells (files/breakout.xlsm).
// Rules come from files/breakout.bas (40 x 36 cells, 60 bricks, paddle edge sends the ball sideways); autopilot paddle.
// Look: NOT a floating sheet (ep 8) or a dark arcade (ep 7): a full-bleed, flat Excel window in daylight green/white,
// the game field navy. Motion: every broken brick drops its 4x2 cells OUT of the sheet with gravity and they pile up
// at the bottom of the screen; at the reveal time freezes and dx/dy arrows show the bounce maths.

type Word = {w: string; start: number; end: number};
type V = {src: string; at: number; sec: number; words: Word[]};
const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const B = TL.beats;
export const EP09_FRAMES = TL.frames;

const XL = '#107c41';
const NAVY = '#0e0a26';
const GOLD = '#ffd23c';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// game clock: 1 tick per frame, starts already in play, freezes during the reveal
const START = 8;
const FZ0 = B.reveal, FZ1 = B.reveal + 54;
const tickAt = (f: number) => START + f - Math.max(0, Math.min(f, FZ1) - FZ0);
const SIM = simulate(tickAt(EP09_FRAMES) + 2);
const HITS: {f: number; r: number; c: number}[] = [];
const PADS: number[] = [];
for (let f = 1; f < EP09_FRAMES; f++) {
  if (tickAt(f) === tickAt(f - 1)) continue;
  const s = SIM[tickAt(f)];
  if (s.hit) HITS.push({f, ...s.hit});
  if (s.bounce === 'paddle') PADS.push(f);
}

const CELL = 24;
const ROWW = 44, HEAD = 28;
const SX = 40, SY = 300; // Excel window
const GX = SX + ROWW, GY = SY + 58 + 50 + 44 + HEAD; // top-left of the game grid on screen
const colName = (n: number) => {let s = ''; for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s;};
const COL0 = 1, ROW0 = 3;
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(v * k).toString(16).padStart(2, '0');
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
};

const paint = (s: State) => {
  const c: (string | null)[] = new Array(W * H).fill(null);
  for (let r = 0; r < BR; r++) for (let b = 0; b < BC; b++) {
    if (!s.bricks[r * BC + b]) continue;
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++)
      c[(BY0 + r * BH + y) * W + b * BW + x] = y === 0 && x < BW - 1 ? ROWCOL[r] : shade(ROWCOL[r], 0.6);
  }
  for (let x = 0; x < PW; x++) c[PY * W + s.px + x] = '#66ccff';
  c[s.by * W + s.bx] = '#ffffff';
  return c;
};

const ExcelWindow: React.FC<{f: number; frozen: boolean}> = ({f, frozen}) => {
  const s = SIM[tickAt(f)];
  const cells = paint(s);
  const name = frozen ? `${colName(COL0 + s.bx)}${ROW0 + s.by}` : `${colName(COL0 + s.px)}${ROW0 + PY}`;
  const fx = frozen ? 'If Cells(y + dy, x).Interior.Color <> NAVY Then dy = -dy' : `=SCORE  ${String(s.score).padStart(4, '0')}`;
  const tabs = ['ملف', 'الصفحة الرئيسية', 'إدراج', 'المطوّر'];
  return (
    <div style={{position: 'absolute', left: SX, top: SY, width: 1000, background: '#fff', borderRadius: 10, overflow: 'hidden',
      boxShadow: '0 30px 80px rgba(0,40,20,.35), 0 0 0 1px #c8d8cc'}}>
      <div style={{height: 58, background: XL, display: 'flex', alignItems: 'center', padding: '0 22px', gap: 14, color: '#fff', fontFamily: 'Segoe UI, Arial', fontSize: 25, fontWeight: 700}}>
        <div style={{width: 34, height: 34, borderRadius: 6, background: '#fff', color: XL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900}}>X</div>
        breakout.xlsm — Excel
        <div style={{marginLeft: 'auto', fontSize: 22, opacity: 0.85}}>● AutoSave</div>
      </div>
      <div dir="rtl" style={{height: 50, background: '#f6faf7', borderBottom: '1px solid #dbe5de', display: 'flex', alignItems: 'center', gap: 30, padding: '0 24px', fontFamily: FONT, fontWeight: 700, fontSize: 22, color: '#2d4a37'}}>
        {tabs.map((t, i) => <span key={t} style={{borderBottom: i === 3 && frozen ? `4px solid ${XL}` : '4px solid transparent', paddingBottom: 2, color: i === 3 && frozen ? XL : undefined}}>{t}</span>)}
      </div>
      <div style={{height: 44, background: '#fff', borderBottom: '1px solid #d4d4d4', display: 'flex', alignItems: 'center', fontFamily: 'Consolas, monospace', fontSize: 21, color: '#222', direction: 'ltr'}}>
        <div style={{minWidth: 90, padding: '0 10px', textAlign: 'center', borderRight: '1px solid #d4d4d4', fontWeight: frozen ? 700 : 400, color: frozen ? XL : '#222'}}>{name}</div>
        <div style={{padding: '0 12px', color: '#888', fontStyle: 'italic'}}>fx</div>
        <div style={{whiteSpace: 'nowrap', color: frozen ? '#0b5d2f' : '#222', fontWeight: frozen ? 700 : 400, fontSize: frozen ? 19 : 21}}>{fx}</div>
      </div>
      <div style={{display: 'flex', background: '#fff', paddingBottom: 12}}>
        <div style={{width: ROWW}}>
          <div style={{height: HEAD, background: '#f3f3f3'}} />
          {Array.from({length: H}, (_, y) => (
            <div key={y} style={{height: CELL, fontSize: 12, fontFamily: 'Segoe UI, Arial', color: y === s.by && frozen ? XL : '#777', fontWeight: y === s.by && frozen ? 700 : 400,
              textAlign: 'center', lineHeight: `${CELL}px`, background: y === s.by && frozen ? '#cfe8d8' : '#f3f3f3', borderBottom: '1px solid #e3e3e3'}}>{y + ROW0}</div>
          ))}
        </div>
        <div>
          <div style={{display: 'flex', height: HEAD}}>
            {Array.from({length: W}, (_, x) => (
              <div key={x} style={{width: CELL, fontSize: 11, fontFamily: 'Segoe UI, Arial', color: x === s.bx && frozen ? XL : '#777', textAlign: 'center', lineHeight: `${HEAD}px`,
                background: x === s.bx && frozen ? '#cfe8d8' : '#f3f3f3', borderRight: '1px solid #e3e3e3'}}>{colName(x + COL0)}</div>
            ))}
          </div>
          <div style={{display: 'grid', gridTemplateColumns: `repeat(${W}, ${CELL}px)`, gridAutoRows: CELL, background: NAVY}}>
            {cells.map((c, i) => (
              <div key={i} style={{background: c ?? NAVY, boxShadow: `inset -1px -1px 0 ${c ? 'rgba(0,0,0,.28)' : '#1d1745'}`}} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ball trail + glow over the grid (screen space)
const Ball: React.FC<{f: number; frozen: boolean}> = ({f, frozen}) => {
  const pts = Array.from({length: 7}, (_, k) => SIM[Math.max(0, tickAt(f) - k)]);
  return (
    <>
      {!frozen && pts.slice(1).map((s, k) => (
        <div key={k} style={{position: 'absolute', left: GX + s.bx * CELL, top: GY + s.by * CELL, width: CELL, height: CELL, background: '#fff', opacity: 0.35 - k * 0.05, borderRadius: 4}} />
      ))}
      <div style={{position: 'absolute', left: GX + pts[0].bx * CELL - 18, top: GY + pts[0].by * CELL - 18, width: CELL + 36, height: CELL + 36, borderRadius: '50%',
        background: 'radial-gradient(closest-side, rgba(255,255,255,.7), rgba(255,255,255,0))'}} />
    </>
  );
};

// the cells of each broken brick fall out of the sheet and pile up at the bottom of the screen
const FLOOR = 1880;
const Debris: React.FC<{f: number}> = ({f}) => (
  <>
    {HITS.filter((h) => h.f <= f).map((h, n) =>
      Array.from({length: BW * BH}, (_, i) => {
        const x = i % BW, y = Math.floor(i / BW);
        const x0 = GX + (h.c * BW + x) * CELL, y0 = GY + (BY0 + h.r * BH + y) * CELL;
        const t = (f - h.f) / 30;
        const vx = ((i * 53 + n * 31) % 11 - 5) * 40, vy = -260 - ((i * 17 + n) % 5) * 60;
        const restX = 60 + ((n * BW * BH + i) * 37) % 960;
        const restY = FLOOR - CELL * (1 + Math.floor((n * BW * BH + i) / 40));
        const fx = x0 + vx * t, fy = y0 + vy * t + 0.5 * 2600 * t * t;
        const landed = fy >= restY;
        const tl = landed ? 1 : 0;
        const X = landed ? restX : interpolate(fy, [y0, restY], [fx, fx + (restX - fx) * 0.6], clamp);
        const Y = Math.min(fy, restY);
        const rot = landed ? ((i * 29) % 30) - 15 : t * 520 * (i % 2 ? 1 : -1);
        const col = y === 0 && x < BW - 1 ? ROWCOL[h.r] : shade(ROWCOL[h.r], 0.6);
        return <div key={`${h.f}-${i}`} style={{position: 'absolute', left: X, top: Y, width: CELL, height: CELL, background: col, rotate: `${rot}deg`,
          boxShadow: tl ? '0 3px 0 rgba(0,0,0,.25)' : `0 0 14px ${col}`, border: '1px solid rgba(0,0,0,.25)'}} />;
      }),
    )}
  </>
);

// the bounce maths drawn on the frozen frame
const Vectors: React.FC<{f: number}> = ({f}) => {
  const s = SIM[tickAt(f)];
  const k = interpolate(f, [FZ0 + 4, FZ0 + 20], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const flip = f >= FZ0 + 26;
  const cx = GX + s.bx * CELL + CELL / 2, cy = GY + s.by * CELL + CELL / 2;
  const L = 120 * k;
  const dy = flip ? -s.dy : s.dy;
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      <defs><marker id="e9a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill={GOLD} /></marker></defs>
      <rect x={GX - 4} y={GY - 4} width={W * CELL + 8} height={H * CELL + 8} fill="rgba(0,0,0,.35)" />
      <circle cx={cx} cy={cy} r={22 + 6 * Math.sin(f / 3)} fill="none" stroke={GOLD} strokeWidth="4" />
      <line x1={cx} y1={cy} x2={cx + s.dx * L} y2={cy} stroke={GOLD} strokeWidth="7" markerEnd="url(#e9a)" />
      <line x1={cx} y1={cy} x2={cx} y2={cy + dy * L} stroke={flip ? '#ff5a78' : GOLD} strokeWidth="7" markerEnd="url(#e9a)" />
      <text x={cx + s.dx * (L + 30)} y={cy + 12} fontFamily="Consolas, monospace" fontWeight="700" fontSize="36" fill={GOLD} textAnchor="middle" opacity={k}>dx</text>
      <text x={cx + 50} y={cy + dy * (L + 20)} fontFamily="Consolas, monospace" fontWeight="700" fontSize="36" fill={flip ? '#ff5a78' : GOLD} opacity={k}>{flip ? 'dy = -dy' : 'dy'}</text>
    </svg>
  );
};

const CODE: {t: string; c: string; hl?: boolean}[] = [
  {t: 'Do While playing', c: '#569cd6'},
  {t: '  If hit Then dy = -dy', c: '#dcdcaa', hl: true},
  {t: '  x = x + dx: y = y + dy', c: '#9cdcfe'},
  {t: '  Cells(y, x).Interior.Color = vbWhite', c: '#9cdcfe'},
  {t: 'Loop', c: '#569cd6'},
];
const Editor: React.FC<{f: number}> = ({f}) => {
  const chars = Math.max(0, (f - FZ0 - 8) * 5);
  let used = 0;
  return (
    <div style={{width: 960, borderRadius: 16, overflow: 'hidden', background: '#1e1e1e', boxShadow: '0 30px 80px rgba(0,0,0,.45)'}}>
      <div style={{height: 44, background: '#2d2d2d', display: 'flex', alignItems: 'center', padding: '0 20px', fontFamily: 'Segoe UI, Arial', fontSize: 22, color: '#ccc'}}>
        VBA — Module1 · Sub Breakout()
      </div>
      <div style={{padding: '10px 24px', fontFamily: 'Consolas, monospace', fontSize: 31, lineHeight: '44px', direction: 'ltr'}}>
        {CODE.map((l, i) => {
          const show = Math.max(0, Math.min(l.t.length, chars - used));
          used += l.t.length;
          const on = l.hl && f >= FZ0 + 26;
          return (
            <div key={i} style={{display: 'flex', whiteSpace: 'pre', color: l.c, margin: '0 -10px', padding: '0 10px', borderRadius: 6,
              background: on ? '#ffd23c26' : 'transparent', outline: on ? `3px solid ${GOLD}` : 'none'}}>
              <span style={{color: '#5a5a5a', width: 44, flexShrink: 0}}>{i + 1}</span><span>{l.t.slice(0, show)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const KeyCap: React.FC<{label: string; on: boolean; w?: number}> = ({label, on, w = 150}) => (
  <div style={{width: w, height: 116, borderRadius: 20, background: on ? XL : '#fff', border: `3px solid ${on ? XL : '#b9cfc0'}`, color: on ? '#fff' : XL,
    boxShadow: on ? `0 0 40px ${XL}88` : '0 10px 0 #9fb8a7', translate: `0 ${on ? 10 : 0}px`, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: label.length > 2 ? 'Segoe UI, Arial' : FONT, fontSize: label.length > 2 ? 40 : 60, fontWeight: 900}}>{label}</div>
);

const groupLatin = (ws: Word[]) => ws.reduce<Word[]>((a, w) => {
  const prev = a[a.length - 1];
  if (prev && /^[A-Za-z]/.test(prev.w) && /^[A-Za-z]/.test(w.w)) {a[a.length - 1] = {w: `${prev.w} ${w.w}`, start: prev.start, end: w.end}; return a;}
  a.push(w); return a;
}, []);

const Caption: React.FC<{line: V; accent: string}> = ({line, accent}) => {
  const frame = useCurrentFrame();
  const t = (frame - line.at) / 30;
  if (t < -0.1 || t > line.sec + 0.35) return null;
  const y = interpolate(t, [-0.1, 0.15], [30, 0], {...clamp, easing: Easing.out(Easing.cubic)});
  return (
    <div dir="rtl" lang="ar" style={{position: 'absolute', top: 60, left: 24, right: 24, minHeight: 200, background: 'rgba(234,246,238,.94)', borderRadius: 28, boxShadow: '0 10px 40px rgba(16,124,65,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
      textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 68, lineHeight: 1.3, translate: `0 ${y}px`,
      opacity: interpolate(t, [-0.1, 0.05, line.sec + 0.15, line.sec + 0.35], [0, 1, 1, 0], clamp)}}>
      {groupLatin(line.words).map((w, i, ws) => {
        const said = t >= w.start;
        const on = said && t < (ws[i + 1]?.start ?? w.end + 0.3);
        return (
          <span key={i} dir={/[A-Za-z]/.test(w.w) ? 'ltr' : undefined} style={{display: 'inline-block', unicodeBidi: 'isolate', margin: '0 0.13em',
            color: on ? '#fff' : said ? '#0b3d21' : 'rgba(11,61,33,.3)', background: on ? accent : 'transparent', borderRadius: 14, padding: '0 10px'}}>{w.w}</span>
        );
      })}
    </div>
  );
};

export const Ep09Breakout: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const frozen = frame >= FZ0 && frame < FZ1;
  const outro = frame >= B.outro;
  const s = SIM[tickAt(frame)];
  // a small kick on every brick, a push toward the ball while it is frozen, a pull-back for the outro
  const kick = HITS.some((h) => frame >= h.f && frame < h.f + 4) ? 1.012 : 1;
  const zf = interpolate(frame, [FZ0, FZ0 + 14, FZ1 - 8, FZ1 + 4], [0, 1, 1, 0], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const so = spring({frame: frame - B.outro, fps, config: {damping: 16}});
  const bxS = GX + s.bx * CELL, byS = GY + s.by * CELL;
  const sc = kick * interpolate(zf, [0, 1], [1, 1.5]) * interpolate(so, [0, 1], [1, 0.7]);
  const ox = interpolate(zf, [0, 1], [540, bxS]), oy = interpolate(zf, [0, 1], [820, byS]);
  const keyOn = frame >= B.keys - 6 && frame < B.outro;

  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg, #eaf6ee 0%, #d6efdf 55%, #bfe3cc 100%)', overflow: 'hidden'}}>
      {/* faint spreadsheet grid behind everything */}
      <AbsoluteFill style={{backgroundImage: 'linear-gradient(#0f7c4115 1px, transparent 1px), linear-gradient(90deg, #0f7c4115 1px, transparent 1px)', backgroundSize: '60px 30px'}} />

      <AbsoluteFill style={{transformOrigin: `${ox}px ${oy}px`, scale: `${sc}`, translate: `0 ${interpolate(so, [0, 1], [0, -120])}px`}}>
        <ExcelWindow f={frame} frozen={frozen} />
        <Ball f={frame} frozen={frozen} />
        {frozen && <Vectors f={frame} />}
      </AbsoluteFill>
      <Debris f={frame} />

      {frame < B.reveal - 2 && (
        <div dir="rtl" style={{position: 'absolute', top: 1390, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 56, color: XL,
          opacity: interpolate(frame, [12, 22, B.reveal - 12, B.reveal - 2], [0, 1, 1, 0], clamp)}}>
          كلّ طوبة = 8 خلايا ملوّنة 🧱
        </div>
      )}
      {frozen && (
        <div style={{position: 'absolute', left: 60, top: 1370, opacity: interpolate(frame, [FZ0 + 2, FZ0 + 12, FZ1 - 8, FZ1], [0, 1, 1, 0], clamp),
          translate: `${interpolate(frame, [FZ0 + 2, FZ0 + 16], [700, 0], {...clamp, easing: Easing.out(Easing.cubic)})}px 0`}}>
          <Editor f={frame} />
        </div>
      )}
      {keyOn && (
        <div style={{position: 'absolute', top: 1420, width: '100%', display: 'flex', justifyContent: 'center', gap: 22, direction: 'ltr',
          opacity: interpolate(frame, [B.keys - 6, B.keys + 6, B.outro - 8, B.outro], [0, 1, 1, 0], clamp)}}>
          <KeyCap label="◀" on={s.key === 0} />
          <KeyCap label="Space" on={frame < B.keys + 12} w={320} />
          <KeyCap label="▶" on={s.key === 1} />
        </div>
      )}

      {outro && (
        <div dir="rtl" style={{position: 'absolute', top: 1110, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, opacity: so, translate: `0 ${(1 - so) * 80}px`}}>
          <div style={{display: 'inline-flex', alignItems: 'center', gap: 22, background: XL, borderRadius: 28, padding: '16px 34px', boxShadow: '0 20px 60px rgba(16,124,65,.4)'}}>
            <div style={{width: 76, height: 92, borderRadius: 10, background: '#fff', color: XL, fontSize: 30, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8, fontFamily: 'Segoe UI, Arial'}}>xlsm</div>
            <div style={{textAlign: 'right'}}>
              <div style={{fontSize: 58, color: '#fff'}}>اكتب «أريده» 📥</div>
              <div style={{fontSize: 30, color: '#cdeedb', fontWeight: 700}}>breakout.xlsm · مجاني · Excel على ويندوز</div>
            </div>
          </div><br />
          <div style={{display: 'inline-block', fontSize: 42, color: '#140c06', background: '#ffd35a', borderRadius: 24, padding: '4px 30px', marginTop: 20,
            opacity: interpolate(frame, [B.outro + 10, B.outro + 20], [0, 1], clamp)}}>🔔 اشترك لتصلك اللعبة التالية</div><br />
          <div style={{display: 'inline-block', fontSize: 40, color: '#0b3d21', background: '#fff', border: `3px solid ${XL}`, borderRadius: 24, padding: '4px 28px', marginTop: 18,
            opacity: interpolate(frame, [B.next - 2, B.next + 8], [0, 1], clamp)}}>الحلقة القادمة: كاسحة الألغام 💣</div>
        </div>
      )}

      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', translate: outro ? '0px 700px' : '-380px 560px',
        opacity: frame < 30 || frozen ? 0 : interpolate(frame, [30, 42], [0, 1], clamp)}}>
        <Mokaab frame={frame} scale={0.2} y={0} mood={frozen ? 'shock' : outro ? 'happy' : 'smirk'} wave={outro ? 1 : 0}
          lookX={0.7} talk={speaking(LINES, frame)} rings={false} />
      </div>

      {VOICE.map((v, i) => <Caption key={v.src} line={v} accent={i === 4 ? '#e0a400' : i === 2 ? '#d63a5a' : XL} />)}
      {outro && (
        <div dir="rtl" style={{position: 'absolute', bottom: 108, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 30, color: '#2d4a37'}}>
          أسرار Excel · الحلقة 9 · تك عالماشي · خلّيك ذكي!
        </div>
      )}

      <VoiceTrack lines={LINES} />
      {HITS.filter((h) => h.f < B.outro && !(h.f >= FZ0 && h.f < FZ1)).map((h) => <Sfx key={`h${h.f}`} name="pop" at={h.f} volume={0.42} />)}
      {PADS.filter((x) => x < B.outro).map((x) => <Sfx key={`p${x}`} name="blip" at={x} volume={0.25} />)}
      <Sfx name="whoosh" at={FZ0 - 4} volume={0.5} />
      <Sfx name="ding" at={FZ0 + 26} volume={0.45} />
      <Sfx name="whoosh" at={FZ1 - 4} volume={0.35} />
      <Sfx name="click" at={B.keys} volume={0.4} />
      <Sfx name="pop" at={B.outro + 2} volume={0.45} />
    </AbsoluteFill>
  );
};
