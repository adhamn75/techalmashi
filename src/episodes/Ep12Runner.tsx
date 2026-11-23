import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import TL from './Ep12Runner.timeline.json';
import {simulate, H, LW, HW, HH, G} from './Ep12Runner.sim';

// Episode 12 of أسرار Excel: a side-scrolling platformer in cells (files/platformer.xlsm, rules in files/platformer.bas;
// the same level + physics run in Ep12Runner.sim.ts, so the video plays what the file plays).
// Look: NOT ep 11's beige board: full-bleed dusk sky made of cells, teal parallax hills, the sheet IS the world and the
// camera scrolls cell by cell. Motion: constant run from frame 0; the reveal is a ×0.2 replay of one pit jump with the
// trajectory dotted cell by cell next to the one gravity line. Original character only (Kubi: cyan head, yellow body).

type Word = {w: string; start: number; end: number};
type V = {src: string; at: number; sec: number; words: Word[]};
const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const B = TL.beats;
export const EP12_FRAMES = TL.frames;

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const XL = '#107c41', NAVY = '#10142c', GOLD = '#ffdb3c';

const RUN = simulate(B.outro - B.reveal + 261 + (TL.frames - B.outro) + 4);
const REPLAY_FROM = 216, SLOW = 5;
// game tick shown at video frame f
const tickAt = (f: number) =>
  f < B.reveal ? f + 36 : f < B.outro ? REPLAY_FROM + Math.floor((f - B.reveal) / SLOW) : B.reveal + 36 + (f - B.outro);

const VW = 24, CS = 45, GX = 0, GY = 420; // 24 visible cells, 45 px each
const camOf = (hx: number) => Math.max(0, Math.min(LW - VW, Math.floor(hx) - 8));
const rgb = (r: number, g: number, b: number) => `rgb(${r | 0},${g | 0},${b | 0})`;
const sky = (y: number) => {const t = y / (H - 1); return rgb(40 + 90 * t, 70 + 110 * t, 150 + 80 * t);};

const World: React.FC<{g: number; trail?: number}> = ({g, trail = -1}) => {
  const {s, tiles} = RUN[Math.min(g, RUN.length - 1)];
  const cam = camOf(s.hx);
  const cells: React.ReactNode[] = [];
  for (let x = 0; x < VW; x++) {
    const lx = x + cam;
    const hill = H - 7 - Math.floor(3 + 3 * Math.sin((x + cam / 2) / 6));
    for (let y = 0; y < H; y++) {
      const t = tiles[lx][y];
      let c = y >= hill ? '#2c5a66' : sky(y), edge = '';
      if (t === 1) {c = y > 0 && tiles[lx][y - 1] === 1 ? '#8a5e20' : '#4cd634'; edge = 'inset 0 -6px 0 rgba(0,0,0,.18)';}
      else if (t === 2) {c = (lx + y) % 4 === 0 ? '#aa5028' : '#dd703b'; edge = 'inset 0 -7px 0 #8c3c1c, inset -4px 0 0 #8c3c1c';}
      else if (t === 3) {c = (Math.floor(s.tick / 6) + lx) % 4 === 0 ? '#fffac8' : GOLD; edge = 'inset 0 0 0 7px #f0a800';}
      else if (t === 4) c = y === H - 14 ? '#ff3c5a' : '#e6e6e6';
      else if (t === 5) {c = '#e0e0e0'; edge = 'inset 0 -14px 0 #9a9aa8';}
      cells.push(<div key={`${x}-${y}`} style={{position: 'absolute', left: GX + x * CS, top: GY + y * CS, width: CS, height: CS, background: c, boxShadow: edge}} />);
    }
  }
  // pennant
  [[LW - 5, H - 14], [LW - 4, H - 14], [LW - 5, H - 13]].forEach(([x, y], i) => x - cam >= 0 && x - cam < VW &&
    cells.push(<div key={`p${i}`} style={{position: 'absolute', left: GX + (x - cam) * CS, top: GY + y * CS, width: CS, height: CS, background: '#ff3c5a'}} />));
  // trail of the replayed jump (hero centre per tick)
  const dots: React.ReactNode[] = [];
  if (trail >= 0) {
    for (let k = trail; k <= g; k++) {
      const q = RUN[k].s;
      const cx = GX + (q.hx + HW / 2 - cam) * CS, cy = GY + (q.hy + HH / 2) * CS;
      const last = k === g;
      dots.push(<div key={`d${k}`} style={{position: 'absolute', left: cx - 13, top: cy - 13, width: 26, height: 26, borderRadius: 13, background: last ? GOLD : '#fff',
        border: `4px solid ${NAVY}`, opacity: last ? 1 : 0.85}} />);
      if ((k > trail && (k - trail) % 3 === 1 && g - k > 1) || last) dots.push(
        <div key={`v${k}`} style={{position: 'absolute', left: last ? cx + 40 : cx - 170, width: 140, top: cy - 20, textAlign: last ? 'left' : 'right', fontFamily: 'Consolas, monospace', fontWeight: 700,
          fontSize: last ? 34 : 26, color: last ? GOLD : '#fff', textShadow: `0 0 6px ${NAVY}, 0 0 3px ${NAVY}`}}>{q.vy.toFixed(2)}</div>);
    }
  }
  // hero Kubi (same cells as Compose in the VBA)
  const ix = Math.floor(s.hx) - cam, iy = Math.floor(s.hy);
  const leg = s.on && (Math.floor(s.tick / 3) % 2 === 0) ? 1 : 0;
  const hero: [number, number, string][] = [[0, 0, '#3cdcff'], [1, 0, '#3cdcff'], [s.face > 0 ? 1 : 0, 0, '#141e3c'], [0, 1, '#ffcd28'], [1, 1, '#ffcd28']];
  if (leg === 0) hero.push([0, 2, '#1e286e'], [1, 2, '#1e286e']); else hero.push([s.face > 0 ? 1 : 0, 2, '#1e286e']);
  return (
    <>
      {cells}
      {hero.map(([dx, dy, c], i) => (
        <div key={`h${i}`} style={{position: 'absolute', left: GX + (ix + dx) * CS, top: GY + (iy + dy) * CS, width: CS, height: CS, background: c,
          boxShadow: c === '#141e3c' ? 'inset 0 0 0 9px #3cdcff, inset 0 0 0 20px #fff' : 'inset 0 -6px 0 rgba(0,0,0,.2)'}} />
      ))}
      {dots}
      {/* gridlines: it is a sheet */}
      <div style={{position: 'absolute', left: GX, top: GY, width: VW * CS, height: H * CS,
        backgroundImage: 'linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px)', backgroundSize: `${CS}px ${CS}px`}} />
      {/* +10 pops */}
      {s.got.map((e) => {
        const [tk, cx, cy] = e.split(':').map(Number);
        const a = g - tk;
        if (a < 0 || a > 14) return null;
        return <div key={e} style={{position: 'absolute', left: GX + (cx - cam) * CS - 30, width: CS + 60, top: GY + cy * CS - 20 - a * 5, textAlign: 'center',
          fontFamily: 'Segoe UI, Arial', fontWeight: 900, fontSize: 40, color: GOLD, textShadow: `0 3px 0 ${NAVY}`, opacity: interpolate(a, [0, 2, 10, 14], [0, 1, 1, 0])}}>+10</div>;
      })}
    </>
  );
};

const colName = (n: number) => {let s = ''; n++; while (n > 0) {const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26);} return s;};

const CODE: {t: string; c: string; hl?: boolean}[] = [
  {t: 'hx = hx + RUN', c: '#9cdcfe'},
  {t: 'If jump And onGround Then vy = -1.8', c: '#569cd6'},
  {t: 'vy = vy + G        \' G = 0.22', c: '#dcdcaa', hl: true},
  {t: 'hy = hy + vy', c: '#9cdcfe'},
  {t: 'If Hits(hx, hy) Then vy = 0', c: '#c586c0'},
];
const Editor: React.FC<{f: number}> = ({f}) => {
  const chars = Math.max(0, (f - B.reveal - 4) * 7);
  let used = 0;
  return (
    <div style={{width: 1000, borderRadius: 18, overflow: 'hidden', background: '#1e1e1e', boxShadow: '0 30px 80px rgba(0,0,0,.6)', border: `3px solid ${GOLD}`}}>
      <div style={{height: 48, background: NAVY, display: 'flex', alignItems: 'center', padding: '0 20px', fontFamily: 'Segoe UI, Arial', fontSize: 23, color: GOLD, fontWeight: 700}}>
        VBA — PlatformerGame · Function StepGame()
      </div>
      <div style={{padding: '10px 24px', fontFamily: 'Consolas, monospace', fontSize: 31, lineHeight: '48px', direction: 'ltr'}}>
        {CODE.map((l, i) => {
          const show = Math.max(0, Math.min(l.t.length, chars - used));
          used += l.t.length;
          const on = l.hl && f >= B.reveal + 34;
          return (
            <div key={i} style={{display: 'flex', whiteSpace: 'pre', color: l.c, margin: '0 -10px', padding: '0 10px', borderRadius: 6,
              background: on ? '#ffdb3c30' : 'transparent', outline: on ? `3px solid ${GOLD}` : 'none', scale: on ? `${interpolate(f - B.reveal - 34, [0, 4, 9], [1, 1.04, 1], clamp)}` : '1'}}>
              <span style={{color: '#5a5a5a', width: 44, flexShrink: 0}}>{i + 1}</span><span>{l.t.slice(0, show)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Hud: React.FC<{g: number}> = ({g}) => {
  const s = RUN[Math.min(g, RUN.length - 1)].s;
  const box = (l: string, v: string, c: string) => (
    <div style={{background: '#fff', border: '2px solid #c8c8c8', minWidth: 190, fontFamily: 'Segoe UI, Arial'}}>
      <div style={{background: '#e9eef5', fontSize: 22, fontWeight: 700, color: '#555', padding: '2px 12px', borderBottom: '1px solid #c8c8c8'}}>{l}</div>
      <div style={{fontSize: 52, fontWeight: 900, color: c, padding: '0 12px'}}>{v}</div>
    </div>
  );
  return (
    <div style={{display: 'flex', gap: 14, direction: 'ltr'}}>
      {box('SCORE', String(s.score), NAVY)}
      {box('COINS', String(s.coins), '#e09a00')}
      {box('LIVES', '●●●'.slice(0, s.lives), '#18a8d8')}
    </div>
  );
};

const Caption: React.FC<{line: V}> = ({line}) => {
  const frame = useCurrentFrame();
  const t = (frame - line.at) / 30;
  if (t < -0.1 || t > line.sec + 0.35) return null;
  const ws = line.words.reduce<Word[]>((a, w) => {
    const p = a[a.length - 1];
    if (p && /^[A-Za-z]/.test(p.w) && /^[A-Za-z]/.test(w.w)) {a[a.length - 1] = {w: `${p.w} ${w.w}`, start: p.start, end: w.end}; return a;}
    a.push(w); return a;
  }, []);
  return (
    <div dir="rtl" lang="ar" style={{position: 'absolute', top: 40, left: 30, right: 30, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
      textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: ws.length > 6 ? 64 : 74, lineHeight: 1.3,
      opacity: interpolate(t, [-0.1, 0.05, line.sec + 0.15, line.sec + 0.35], [0, 1, 1, 0], clamp)}}>
      {ws.map((w, i) => {
        const said = t >= w.start;
        const on = said && t < (ws[i + 1]?.start ?? w.end + 0.3);
        const lift = on ? interpolate(t - w.start, [0, 0.07, 0.16], [0, -14, -6], clamp) : 0;
        return (
          <span key={i} dir={/[A-Za-z]/.test(w.w) ? 'ltr' : undefined} style={{display: 'inline-block', unicodeBidi: 'isolate', margin: '0 0.14em', translate: `0 ${lift}px`,
            color: on ? GOLD : said ? '#fff' : 'rgba(255,255,255,.4)', WebkitTextStroke: `10px ${NAVY}`, paintOrder: 'stroke fill'}}>{w.w}</span>
        );
      })}
    </div>
  );
};

export const Ep12Runner: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const g = tickAt(frame);
  const s = RUN[Math.min(g, RUN.length - 1)].s;
  const reveal = frame >= B.reveal && frame < B.outro;
  const outro = frame >= B.outro;
  const so = spring({frame: frame - B.outro, fps, config: {damping: 15}});
  const ro = interpolate(frame, [B.reveal, B.reveal + 8, B.outro - 8, B.outro], [0, 1, 1, 0], clamp);
  const jumped = s.jumpStart === s.tick;
  const sc = interpolate(so, [0, 1], [1, 0.5]);
  // tiny camera kick on every take-off and landing
  const prev = RUN[Math.max(0, g - 1)].s;
  const kick = !reveal && (jumped || (s.on && !prev.on)) ? 6 : 0;
  const fx = reveal ? `vy = ${prev.vy.toFixed(2)} + ${G}  →  ${s.vy.toFixed(2)}` : `=COINS*10   ${s.score}`;
  const cam = camOf(s.hx);

  const jumps = new Set<number>(), coinsAt = new Set<number>();
  for (let f = 0; f < TL.frames; f++) {
    if (f >= B.reveal && f < B.outro) continue;
    const a = RUN[tickAt(f)].s, b = RUN[Math.max(0, tickAt(f) - 1)].s;
    if (a.jumpStart === a.tick) jumps.add(f);
    if (a.coins > b.coins && f % 1 === 0) coinsAt.add(f);
  }

  return (
    <AbsoluteFill style={{background: NAVY, overflow: 'hidden'}}>
      <AbsoluteFill style={{transformOrigin: '540px 260px', scale: `${sc}`, translate: `0 ${kick + so * 40}px`}}>
        {/* Excel chrome */}
        <div style={{position: 'absolute', left: 0, top: 262, width: 1080, height: 112, background: '#fff', overflow: 'hidden'}}>
          <div style={{height: 50, background: XL, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, color: '#fff', fontFamily: 'Segoe UI, Arial', fontSize: 24, fontWeight: 700}}>
            <div style={{width: 30, height: 30, borderRadius: 5, background: '#fff', color: XL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900}}>X</div>
            platformer.xlsm — Excel
            <div style={{marginLeft: 'auto', fontSize: 20, opacity: 0.9}}>CELL RUNNER</div>
          </div>
          <div style={{height: 62, display: 'flex', alignItems: 'center', fontFamily: 'Consolas, monospace', fontSize: 28, color: '#333', direction: 'ltr'}}>
            <div style={{width: 110, textAlign: 'center', borderRight: '1px solid #ddd', fontWeight: 700, color: reveal ? XL : '#333'}}>{reveal ? 'vy' : 'BA3'}</div>
            <div style={{padding: '0 12px', color: '#999', fontStyle: 'italic'}}>fx</div>
            <div style={{whiteSpace: 'nowrap', fontWeight: 700, color: reveal ? XL : '#333'}}>{fx}</div>
          </div>
        </div>
        {/* column letters scroll with the camera: the world moves through real columns */}
        <div style={{position: 'absolute', left: 0, top: 374, width: 1080, height: 46, background: '#e9eef5', borderBottom: '1px solid #c8c8c8'}}>
          {Array.from({length: VW}, (_, i) => (
            <div key={i} style={{position: 'absolute', left: i * CS, width: CS, top: 0, height: 46, lineHeight: '46px', textAlign: 'center', fontFamily: 'Segoe UI, Arial',
              fontSize: 17, color: '#666', borderRight: '1px solid #d4d4d4'}}>{colName(1 + cam + i)}</div>
          ))}
        </div>
        <World g={g} trail={reveal ? REPLAY_FROM + 2 : -1} />
      </AbsoluteFill>

      {!outro && (
        <div style={{position: 'absolute', left: 36, top: 1675, opacity: 1 - ro}}><Hud g={g} /></div>
      )}
      {ro > 0 && (
        <>
          <div style={{position: 'absolute', right: 30, top: 450, fontFamily: 'Segoe UI, Arial', fontWeight: 900, fontSize: 40, color: NAVY, background: GOLD, borderRadius: 14,
            padding: '4px 20px', opacity: ro, direction: 'ltr'}}>REPLAY ×0.2</div>
          <div style={{position: 'absolute', left: 40, top: 1560, opacity: ro, translate: `0 ${(1 - ro) * 220}px`}}><Editor f={frame} /></div>
        </>
      )}

      {outro && (
        <div dir="rtl" style={{position: 'absolute', top: 1060, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, opacity: so, translate: `0 ${(1 - so) * 80}px`}}>
          <div style={{display: 'inline-flex', alignItems: 'center', gap: 22, background: GOLD, borderRadius: 28, padding: '16px 34px', boxShadow: '0 20px 60px rgba(255,219,60,.35)'}}>
            <div style={{width: 76, height: 92, borderRadius: 10, background: '#fff', color: XL, fontSize: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8, fontFamily: 'Segoe UI, Arial', fontWeight: 900}}>xlsm</div>
            <div style={{textAlign: 'right'}}>
              <div style={{fontSize: 58, color: NAVY}}>اكتب «أريده» 📥</div>
              <div style={{fontSize: 30, color: '#4a3a00', fontWeight: 700}}>platformer.xlsm · مجاني · ويندوز</div>
            </div>
          </div><br />
          <div style={{display: 'inline-block', fontSize: 42, color: NAVY, background: '#3cdcff', borderRadius: 24, padding: '4px 30px', marginTop: 24,
            opacity: interpolate(frame, [B.outro + 10, B.outro + 20], [0, 1], clamp)}}>🔔 اشترك لتصلك اللعبة التالية</div><br />
          <div style={{display: 'inline-block', fontSize: 42, color: '#fff', border: `3px solid ${GOLD}`, borderRadius: 24, padding: '4px 28px', marginTop: 20,
            opacity: interpolate(frame, [B.next - 2, B.next + 8], [0, 1], clamp), translate: `0 ${interpolate(frame, [B.next - 2, B.next + 8], [20, 0], clamp)}px`}}>الحلقة القادمة: سيارةٌ تسابق الزحام 🏎️</div>
        </div>
      )}

      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', translate: outro ? '0px 760px' : '330px 720px',
        opacity: frame < 20 || ro > 0.05 ? 0 : interpolate(frame, [20, 32], [0, 1], clamp)}}>
        <Mokaab frame={frame} scale={0.17} y={0} mood={outro ? 'happy' : 'smirk'} wave={outro ? 1 : 0} lookX={-0.4} talk={speaking(LINES, frame)} rings={false} />
      </div>

      {VOICE.map((v) => <Caption key={v.src} line={v} />)}
      {outro && (
        <div dir="rtl" style={{position: 'absolute', bottom: 90, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 30, color: '#c8d0ff'}}>
          أسرار Excel · الحلقة 12 · تك عالماشي · خلّيك ذكي!
        </div>
      )}

      <VoiceTrack lines={LINES} />
      {[...jumps].map((f) => <Sfx key={`j${f}`} name="whoosh" at={f} volume={0.4} />)}
      {[...coinsAt].filter((f, i, a) => i === 0 || f - a[i - 1] > 3).map((f) => <Sfx key={`c${f}`} name="blip" at={f} volume={0.4} />)}
      <Sfx name="whoosh" at={B.reveal} volume={0.45} />
      <Sfx name="ding" at={B.reveal + 34} volume={0.55} />
      <Sfx name="pop" at={B.outro + 2} volume={0.45} />
    </AbsoluteFill>
  );
};
