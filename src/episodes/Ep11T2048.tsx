import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import TL from './Ep11T2048.timeline.json';

// Episode 11 of أسرار Excel: 2048 in cells B5:E8 (files/game2048.xlsm; rules from files/game2048.bas — arrow keys via
// OnKey, SlideLine merges equal neighbours once per move, a 2 (or 4) spawns after every move that changed the board).
// Look: NOT ep 10's night board or ep 9's window: warm paper-beige sheet, four giant tiles per row, Excel only as a thin
// green title strip + formula bar. Motion: tiles physically slide (8 frames, ease-out) and merges punch; the reveal lifts
// the bottom row OUT of the board into a "tape" that runs SlideLine step by step; climax = the 2048 tile with a gold burst.

type Word = {w: string; start: number; end: number};
type V = {src: string; at: number; sec: number; words: Word[]};
const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const B = TL.beats;
export const EP11_FRAMES = TL.frames;

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const N = 4, D = 8;
const XL = '#107c41', INK = '#776e65', PAPER = '#faf8ef', FRAME = '#bbada0';

// ---------- simulation (same rules as SlideLine / MapCell in game2048.bas) ----------
type Tile = {id: number; v: number; r: number; c: number; born: number; kind: 'start' | 'merge' | 'spawn'};
type Slide = {id: number; v: number; fr: number; fc: number; tr: number; tc: number};
type Move = {F: number; dir: number; slides: Slide[]; result: Tile[]; gain: number; merges: {r: number; c: number; v: number}[]};
let nextId = 1;
const START: number[][] = [[2, 2, 0, 0], [0, 4, 0, 4], [0, 0, 0, 128], [1024, 512, 256, 128]];
let tiles: Tile[] = [];
START.forEach((row, r) => row.forEach((v, c) => v && tiles.push({id: nextId++, v, r, c, born: -99, kind: 'start'})));
const INIT = tiles;
const mapCell = (d: number, j: number, i: number): [number, number] =>
  d === 0 ? [j, i] : d === 1 ? [j, N - 1 - i] : d === 2 ? [i, j] : [N - 1 - i, j];
const SPAWN_PREF: [number, number][] = [[0, 0], [0, 3], [1, 0], [0, 1], [1, 3], [2, 1], [0, 2], [1, 1], [2, 2], [1, 2]];
const DIRS = [1, 3, 1, 0, 0]; // right, down, right, left, left
const AT = [B.m1, B.m2, B.m3, B.m4, B.m5];
const MOVES: Move[] = [];
let score = 0;
DIRS.forEach((d, k) => {
  const F = AT[k];
  const at = (r: number, c: number) => tiles.find((t) => t.r === r && t.c === c);
  const slides: Slide[] = [], result: Tile[] = [], merges: Move['merges'] = [];
  let gain = 0;
  for (let j = 0; j < N; j++) {
    let n = 0, last: Tile | null = null, lastMerged = false;
    for (let i = 0; i < N; i++) {
      const [r, c] = mapCell(d, j, i);
      const t = at(r, c);
      if (!t) continue;
      if (last && !lastMerged && last.v === t.v) {
        const [tr, tc] = mapCell(d, j, n - 1);
        slides.push({id: t.id, v: t.v, fr: r, fc: c, tr, tc});
        result.splice(result.indexOf(last), 1);
        result.push({id: nextId++, v: t.v * 2, r: tr, c: tc, born: F + D, kind: 'merge'});
        merges.push({r: tr, c: tc, v: t.v * 2});
        gain += t.v * 2; lastMerged = true;
      } else {
        const [tr, tc] = mapCell(d, j, n);
        slides.push({id: t.id, v: t.v, fr: r, fc: c, tr, tc});
        last = {...t, r: tr, c: tc};
        result.push(last); lastMerged = false; n++;
      }
    }
  }
  const sp = SPAWN_PREF.find(([r, c]) => !result.some((t) => t.r === r && t.c === c));
  if (sp && k < DIRS.length - 1) result.push({id: nextId++, v: 2, r: sp[0], c: sp[1], born: F + D + 3, kind: 'spawn'});
  score += gain;
  MOVES.push({F, dir: d, slides, result, gain, merges});
  tiles = result;
});
const scoreAt = (f: number) => 3480 + MOVES.filter((m) => f >= m.F + D).reduce((a, m) => a + m.gain, 0);

const TS = 222, GAP = 18, BX = 55, BY = 430;
const px = (c: number) => BX + GAP + c * (TS + GAP), py = (r: number) => BY + GAP + r * (TS + GAP);
const COLORS: Record<number, [string, string]> = {
  2: ['#eee4da', INK], 4: ['#ede0c8', INK], 8: ['#f2b179', '#fff'], 16: ['#f59563', '#fff'], 32: ['#f67c5f', '#fff'], 64: ['#f65e3b', '#fff'],
  128: ['#edcf72', '#fff'], 256: ['#edcc61', '#fff'], 512: ['#edc850', '#fff'], 1024: ['#edc53f', '#fff'], 2048: ['#edc22e', '#fff'],
};

const TileBox: React.FC<{v: number; x: number; y: number; s?: number; glow?: number}> = ({v, x, y, s = 1, glow = 0}) => {
  const [bg, fg] = COLORS[v] ?? COLORS[2048];
  const fs = v >= 1024 ? 86 : v >= 128 ? 100 : 118;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: TS, height: TS, borderRadius: 14, background: bg, color: fg, scale: `${s}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, Arial', fontWeight: 900, fontSize: fs, letterSpacing: -2,
      boxShadow: glow ? `0 0 ${40 + 60 * glow}px ${20 * glow}px rgba(243,215,116,${0.5 + 0.4 * glow})` : '0 4px 0 rgba(0,0,0,.08)'}}>{v}</div>
  );
};

const Board: React.FC<{f: number}> = ({f}) => {
  const k = MOVES.filter((m) => f >= m.F).length;
  const m = k ? MOVES[k - 1] : null;
  let body: React.ReactNode;
  if (m && f < m.F + D) {
    const p = interpolate(f, [m.F, m.F + D], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
    body = m.slides.map((s) => <TileBox key={s.id} v={s.v} x={interpolate(p, [0, 1], [px(s.fc), px(s.tc)])} y={interpolate(p, [0, 1], [py(s.fr), py(s.tr)])} />);
  } else {
    const list = m ? m.result : INIT;
    body = list.filter((t) => f >= t.born).map((t) => {
      const age = f - t.born;
      const s = t.kind === 'merge' ? interpolate(age, [0, 3, 7], [1, 1.2, 1], clamp) : t.kind === 'spawn' ? interpolate(age, [0, 5], [0, 1], {...clamp, easing: Easing.out(Easing.back(2))}) : 1;
      const glow = t.v === 2048 ? interpolate(age, [0, 8, 30], [0, 1, 0.6], clamp) : 0;
      return <TileBox key={t.id} v={t.v} x={px(t.c)} y={py(t.r)} s={s} glow={glow} />;
    });
  }
  const W = N * TS + (N + 1) * GAP;
  return (
    <>
      <div style={{position: 'absolute', left: BX, top: BY, width: W, height: W, borderRadius: 22, background: FRAME}} />
      {Array.from({length: 16}, (_, i) => (
        <div key={i} style={{position: 'absolute', left: px(i % 4), top: py(Math.floor(i / 4)), width: TS, height: TS, borderRadius: 14, background: '#cdc1b4'}} />
      ))}
      {body}
      {m && f >= m.F + D && f < m.F + D + 26 && m.merges.map((g, i) => (
        <div key={i} style={{position: 'absolute', left: px(g.c), width: TS, top: py(g.r) - 10 - (f - m.F - D) * 3, textAlign: 'center', fontFamily: 'Segoe UI, Arial', fontWeight: 900,
          fontSize: 52, color: XL, opacity: interpolate(f - m.F - D, [0, 4, 18, 26], [0, 1, 1, 0], clamp)}}>+{g.v}</div>
      ))}
    </>
  );
};

// the reveal: the bottom row is lifted into a tape and SlideLine runs on it
const Tape: React.FC<{f: number}> = ({f}) => {
  const t = f - B.reveal;
  const lift = interpolate(t, [0, 12], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const step = t < 26 ? 0 : t < 44 ? 1 : 2; // 0: [1024,1024,0,0]  1: compare  2: [2048,0,0,0]
  const cells = step < 2 ? [1024, 1024, 0, 0] : [2048, 0, 0, 0];
  const y = interpolate(lift, [0, 1], [py(3), 820]);
  const ts = 150;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920}}>
      <div style={{position: 'absolute', inset: 0, background: 'rgba(250,248,239,.93)', opacity: lift}} />
      <div style={{position: 'absolute', left: 540 - 2 * (ts + 20), top: y - 70, fontFamily: 'Consolas, monospace', fontSize: 34, fontWeight: 700, color: INK, opacity: lift, direction: 'ltr'}}>
        v() = row 8 &nbsp;→&nbsp; SlideLine(v)
      </div>
      {cells.map((v, i) => {
        const x = 540 - 2 * (ts + 20) + i * (ts + 20);
        const hot = step === 1 && i < 2;
        const [bg, fg] = v ? COLORS[v] : ['#cdc1b4', INK];
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y, width: ts, height: ts, borderRadius: 12, background: bg, color: fg, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontFamily: 'Segoe UI, Arial', fontWeight: 900, fontSize: v >= 1000 ? 54 : 64, outline: hot ? `6px solid ${XL}` : 'none',
            scale: step === 2 && i === 0 ? `${interpolate(t, [44, 48, 54], [1, 1.2, 1], clamp)}` : '1'}}>{v || ''}</div>
        );
      })}
      {step === 1 && (
        <div style={{position: 'absolute', left: 540 - 2 * (ts + 20), width: 2 * ts + 20, top: y + ts + 10, textAlign: 'center', fontFamily: 'Consolas, monospace', fontWeight: 700, fontSize: 40, color: XL}}>last = v(i) ✓</div>
      )}
    </div>
  );
};

const CODE: {t: string; c: string; hl?: boolean}[] = [
  {t: 'For i = 0 To 3', c: '#569cd6'},
  {t: '  If last = v(i) Then', c: '#dcdcaa', hl: true},
  {t: '    t(k-1) = last * 2', c: '#dcdcaa', hl: true},
  {t: '    score = score + last * 2', c: '#9cdcfe'},
  {t: '  Else t(k) = v(i): k = k + 1', c: '#9cdcfe'},
];
const Editor: React.FC<{f: number}> = ({f}) => {
  const chars = Math.max(0, (f - B.reveal - 6) * 6);
  let used = 0;
  return (
    <div style={{width: 960, borderRadius: 18, overflow: 'hidden', background: '#1e1e1e', boxShadow: '0 30px 70px rgba(119,110,101,.45)'}}>
      <div style={{height: 46, background: XL, display: 'flex', alignItems: 'center', padding: '0 20px', fontFamily: 'Segoe UI, Arial', fontSize: 22, color: '#fff', fontWeight: 700}}>
        VBA — Game2048 · Function SlideLine(v)
      </div>
      <div style={{padding: '10px 24px', fontFamily: 'Consolas, monospace', fontSize: 32, lineHeight: '46px', direction: 'ltr'}}>
        {CODE.map((l, i) => {
          const show = Math.max(0, Math.min(l.t.length, chars - used));
          used += l.t.length;
          const on = l.hl && f >= B.reveal + 26;
          return (
            <div key={i} style={{display: 'flex', whiteSpace: 'pre', color: l.c, margin: '0 -10px', padding: '0 10px', borderRadius: 6,
              background: on ? '#edc22e2a' : 'transparent', outline: on ? '3px solid #edc22e' : 'none'}}>
              <span style={{color: '#5a5a5a', width: 44, flexShrink: 0}}>{i + 1}</span><span>{l.t.slice(0, show)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ARROW = ['◀', '▶', '▲', '▼'];
const Keys: React.FC<{f: number}> = ({f}) => {
  const on = MOVES.find((m) => f >= m.F - 3 && f < m.F + 6)?.dir ?? -1;
  const K: React.FC<{d: number}> = ({d}) => (
    <div style={{width: 112, height: 104, borderRadius: 18, background: on === d ? XL : '#fff', color: on === d ? '#fff' : INK, border: `3px solid ${on === d ? XL : '#d8cfc4'}`,
      boxShadow: on === d ? `0 0 34px ${XL}99` : '0 9px 0 #d8cfc4', translate: `0 ${on === d ? 9 : 0}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50}}>{ARROW[d]}</div>
  );
  return (
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 112px)', gap: 12, direction: 'ltr'}}>
      <div /><K d={2} /><div /><K d={0} /><K d={3} /><K d={1} />
    </div>
  );
};

const Score: React.FC<{f: number}> = ({f}) => (
  <div style={{display: 'flex', gap: 16}}>
    {[['SCORE', scoreAt(f)], ['BEST', Math.max(9876, scoreAt(f))]].map(([l, v]) => (
      <div key={l as string} style={{background: FRAME, borderRadius: 14, padding: '8px 22px', textAlign: 'center', minWidth: 170}}>
        <div style={{fontFamily: 'Segoe UI, Arial', fontWeight: 700, fontSize: 24, color: '#eee4da'}}>{l}</div>
        <div style={{fontFamily: 'Segoe UI, Arial', fontWeight: 900, fontSize: 50, color: '#fff'}}>{v}</div>
      </div>
    ))}
  </div>
);

// merge the three number words into one "2048" chip so the caption shows the digits the viewer knows
const NUM = ['ألفين', 'وثمانية', 'وأربعين'];
const groupWords = (ws: Word[]) => ws.reduce<Word[]>((a, w, i) => {
  const prev = a[a.length - 1];
  if (w.w === NUM[0] && ws[i + 1]?.w === NUM[1]) {a.push({w: '2048', start: w.start, end: ws[i + 2]?.end ?? w.end}); return a;}
  if (prev?.w === '2048' && (w.w === NUM[1] || w.w === NUM[2])) return a;
  if (prev && /^[A-Za-z]/.test(prev.w) && /^[A-Za-z]/.test(w.w)) {a[a.length - 1] = {w: `${prev.w} ${w.w}`, start: prev.start, end: w.end}; return a;}
  a.push(w); return a;
}, []);

// captions: tile-coloured chips that light up like 2048 tiles
const Caption: React.FC<{line: V}> = ({line}) => {
  const frame = useCurrentFrame();
  const t = (frame - line.at) / 30;
  if (t < -0.1 || t > line.sec + 0.35) return null;
  return (
    <div dir="rtl" lang="ar" style={{position: 'absolute', top: 70, left: 30, right: 30, minHeight: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '10px 0',
      textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: line.words.length > 7 ? 58 : 66, lineHeight: 1.25,
      opacity: interpolate(t, [-0.1, 0.05, line.sec + 0.15, line.sec + 0.35], [0, 1, 1, 0], clamp)}}>
      {groupWords(line.words).map((w, i, ws) => {
        const said = t >= w.start;
        const on = said && t < (ws[i + 1]?.start ?? w.end + 0.3);
        const big = w.w === '2048';
        const s = interpolate(t - w.start, [0, 0.08, 0.2], [0.8, 1.1, 1], clamp);
        return (
          <span key={i} dir={/[A-Za-z0-9]/.test(w.w) ? 'ltr' : undefined} style={{display: 'inline-block', unicodeBidi: 'isolate', margin: '0 0.1em', padding: '0 16px', borderRadius: 14,
            background: big && said ? '#edc22e' : on ? '#f59563' : said ? '#eee4da' : 'rgba(238,228,218,.45)', color: big && said ? '#fff' : on ? '#fff' : said ? INK : 'rgba(119,110,101,.45)',
            scale: said ? `${s}` : '1', fontFamily: big ? 'Segoe UI, Arial' : FONT}}>{w.w}</span>
        );
      })}
    </div>
  );
};

const Burst: React.FC<{f: number}> = ({f}) => {
  const t = f - (B.m5 + D);
  if (t < 0 || t > 40) return null;
  const x0 = px(0) + TS / 2, y0 = py(3) + TS / 2;
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      {Array.from({length: 26}, (_, i) => {
        const a = (i / 26) * Math.PI * 2 + i * 0.3, d = t * (14 + (i % 5) * 4), g = 0.6 * t * t;
        return <rect key={i} x={x0 + Math.cos(a) * d} y={y0 + Math.sin(a) * d + g} width={18} height={18} rx={3}
          fill={['#edc22e', '#f67c5f', XL, '#f2b179'][i % 4]} opacity={interpolate(t, [30, 40], [1, 0], clamp)} transform={`rotate(${t * 12 + i * 20} ${x0 + Math.cos(a) * d} ${y0 + Math.sin(a) * d + g})`} />;
      })}
      <circle cx={x0} cy={y0} r={t * 22} fill="none" stroke="#edc22e" strokeWidth={interpolate(t, [0, 20], [16, 0], clamp)} />
    </svg>
  );
};

export const Ep11T2048: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reveal = frame >= B.reveal && frame < B.m5 - 6;
  const outro = frame >= B.outro;
  const so = spring({frame: frame - B.outro, fps, config: {damping: 15}});
  const kick = MOVES.some((m) => m.merges.length && frame >= m.F + D && frame < m.F + D + 4) ? 1.012 : 1;
  const sc = kick * interpolate(so, [0, 1], [1, 0.55]);
  const ro = interpolate(frame, [B.reveal, B.reveal + 10, B.m5 - 14, B.m5 - 6], [0, 1, 1, 0], clamp);
  const fx = reveal ? 'Call SlideLine(v)   ' + "' row 8" : frame >= B.m5 + D ? '=E8   2048 ✓' : `=SCORE   ${scoreAt(frame)}`;

  return (
    <AbsoluteFill style={{background: PAPER, overflow: 'hidden'}}>
      <AbsoluteFill style={{backgroundImage: 'linear-gradient(#bbada033 1px, transparent 1px), linear-gradient(90deg, #bbada033 1px, transparent 1px)', backgroundSize: '90px 36px'}} />

      <AbsoluteFill style={{transformOrigin: '540px 300px', scale: `${sc}`, translate: `0 ${so * 90}px`}}>
        {/* thin Excel chrome */}
        <div style={{position: 'absolute', left: 40, top: 292, width: 1000, height: 104, borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 30px rgba(119,110,101,.2)', background: '#fff'}}>
          <div style={{height: 44, background: XL, display: 'flex', alignItems: 'center', padding: '0 18px', gap: 12, color: '#fff', fontFamily: 'Segoe UI, Arial', fontSize: 22, fontWeight: 700}}>
            <div style={{width: 28, height: 28, borderRadius: 5, background: '#fff', color: XL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900}}>X</div>
            game2048.xlsm — Excel
          </div>
          <div style={{height: 60, display: 'flex', alignItems: 'center', fontFamily: 'Consolas, monospace', fontSize: 27, color: '#333', direction: 'ltr'}}>
            <div style={{width: 96, textAlign: 'center', borderRight: '1px solid #ddd', color: reveal ? XL : '#333', fontWeight: 700}}>{reveal ? 'B8' : 'B5'}</div>
            <div style={{padding: '0 12px', color: '#999', fontStyle: 'italic'}}>fx</div>
            <div style={{whiteSpace: 'nowrap', fontWeight: 700, color: reveal || frame >= B.m5 + D ? XL : '#333'}}>{fx}</div>
          </div>
        </div>
        {['B', 'C', 'D', 'E'].map((l, c) => (
          <div key={l} style={{position: 'absolute', left: px(c), width: TS, top: BY - 32, textAlign: 'center', fontFamily: 'Segoe UI, Arial', fontSize: 24, color: '#a89c90'}}>{l}</div>
        ))}
        {[5, 6, 7, 8].map((n, r) => (
          <div key={n} style={{position: 'absolute', left: 14, top: py(r), height: TS, lineHeight: `${TS}px`, fontFamily: 'Segoe UI, Arial', fontSize: 24, color: '#a89c90'}}>{n}</div>
        ))}
        <Board f={frame} />
        <Burst f={frame} />
      </AbsoluteFill>

      {!outro && (
        <div style={{position: 'absolute', top: 1440, left: 60, right: 60, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', direction: 'ltr', opacity: 1 - ro}}>
          <Score f={frame} />
          <Keys f={frame} />
        </div>
      )}
      {ro > 0 && (
        <div style={{opacity: ro}}>
          <Tape f={frame} />
          <div style={{position: 'absolute', left: 60, top: 1330, translate: `0 ${(1 - ro) * 200}px`}}><Editor f={frame} /></div>
        </div>
      )}

      {outro && (
        <div dir="rtl" style={{position: 'absolute', top: 1020, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, opacity: so, translate: `0 ${(1 - so) * 80}px`}}>
          <div style={{display: 'inline-flex', alignItems: 'center', gap: 22, background: '#edc22e', borderRadius: 28, padding: '16px 34px', boxShadow: '0 20px 60px rgba(237,194,46,.45)'}}>
            <div style={{width: 76, height: 92, borderRadius: 10, background: '#fff', color: XL, fontSize: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8, fontFamily: 'Segoe UI, Arial', fontWeight: 900}}>xlsm</div>
            <div style={{textAlign: 'right'}}>
              <div style={{fontSize: 58, color: '#fff'}}>اكتب «أريده» 📥</div>
              <div style={{fontSize: 30, color: '#fff7d6', fontWeight: 700}}>game2048.xlsm · مجاني · ويندوز وماك</div>
            </div>
          </div><br />
          <div style={{display: 'inline-block', fontSize: 42, color: '#fff', background: XL, borderRadius: 24, padding: '4px 30px', marginTop: 22,
            opacity: interpolate(frame, [B.outro + 10, B.outro + 20], [0, 1], clamp)}}>🔔 اشترك لتصلك اللعبة التالية</div><br />
          <div style={{display: 'inline-block', fontSize: 40, color: INK, background: '#fff', border: `3px solid ${FRAME}`, borderRadius: 24, padding: '4px 28px', marginTop: 18,
            opacity: interpolate(frame, [B.next - 2, B.next + 8], [0, 1], clamp), translate: `0 ${interpolate(frame, [B.next - 2, B.next + 8], [20, 0], clamp)}px`}}>الحلقة القادمة: بطلٌ يقفز بين المنصّات 🏃</div>
        </div>
      )}

      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', translate: outro ? '0px 730px' : '20px 690px',
        opacity: frame < 30 || ro > 0.05 ? 0 : interpolate(frame, [30, 42], [0, 1], clamp)}}>
        <Mokaab frame={frame} scale={0.17} y={0} mood={frame >= B.m5 + D && frame < B.outro ? 'shock' : outro ? 'happy' : 'smirk'} wave={outro ? 1 : 0}
          lookX={0.5} talk={speaking(LINES, frame)} rings={false} />
      </div>

      {VOICE.map((v) => <Caption key={v.src} line={v} />)}
      {outro && (
        <div dir="rtl" style={{position: 'absolute', bottom: 100, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 30, color: INK}}>
          أسرار Excel · الحلقة 11 · تك عالماشي · خلّيك ذكي!
        </div>
      )}

      <VoiceTrack lines={LINES} />
      {MOVES.map((m) => <Sfx key={`k${m.F}`} name="click" at={m.F - 2} volume={0.4} />)}
      {MOVES.map((m) => <Sfx key={`w${m.F}`} name="whoosh" at={m.F} volume={0.3} />)}
      {MOVES.filter((m) => m.merges.length).map((m) => <Sfx key={`p${m.F}`} name="pop" at={m.F + D} volume={0.5} />)}
      <Sfx name="whoosh" at={B.reveal} volume={0.4} />
      <Sfx name="tick" at={B.reveal + 26} volume={0.5} />
      <Sfx name="blip" at={B.reveal + 44} volume={0.5} />
      <Sfx name="ding" at={B.m5 + D} volume={0.6} />
      <Sfx name="pop" at={B.outro + 2} volume={0.45} />
    </AbsoluteFill>
  );
};
