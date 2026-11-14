import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import TL from './Ep08Invaders.timeline.json';
import {simulate, invaderCells, State, W, H, PY, SPRITES, SX, SY, CANNON, UFO} from './Ep08Invaders.sim';

// Episode 8 of أسرار Excel: Space Invaders played inside the cells (files/invaders.xlsm).
// Rules come from files/invaders.bas (37 x 36 cells, fleet speeds up as it shrinks), the cannon runs on autopilot.
// Look: deep space with warp streaks, Excel in LIGHT mode floating like a satellite (not the dark arcade of ep 7).
// Motion: a slow Y-orbit of the sheet, a hard snap-zoom onto ONE invader to show its 15 cells, and every kill
// throws its pixels out of the sheet toward the camera in 3D.

type Word = {w: string; start: number; end: number};
type V = {src: string; at: number; sec: number; words: Word[]};
const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const B = TL.beats;
const TF = TL.tickFrames;
export const EP08_FRAMES = TL.frames;

const GRN = '#39ff6a';
const CYAN = '#3df5ff';
const MAG = '#ff3df0';
const ORG = '#ff8040';
const XL = '#107c41';
const ROWCOL = [MAG, CYAN, CYAN, GRN];
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// the game freezes during the macro zoom on one invader
const ZIN = B.reveal, ZOUT = B.reveal + 46;
const tickAt = (f: number) => {
  const paused = Math.max(0, Math.min(f, ZOUT) - ZIN);
  return Math.floor((f - paused) / TF);
};
const SIM = simulate(tickAt(EP08_FRAMES) + 2);
const KILLS: number[] = [];
const SHOTS: number[] = [];
for (let f = 1; f < EP08_FRAMES; f++) {
  if (tickAt(f) === tickAt(f - 1)) continue;
  const e = SIM[tickAt(f)].event;
  if (e === 'kill' || e === 'ufo') KILLS.push(f);
  if (e === 'fire') SHOTS.push(f);
}

const colName = (n: number) => {
  let s = '';
  for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
const COL0 = 1, ROW0 = 3; // grid starts at B3, like the file

// colour of every cell for one state
const paint = (s: State) => {
  const c: (string | null)[] = new Array(W * H).fill(null);
  s.bunker.forEach((hp, i) => {if (hp === 2) c[i] = '#28c85a'; else if (hp === 1) c[i] = '#146e32';});
  for (const p of invaderCells(s)) c[p.y * W + p.x] = ROWCOL[p.r];
  if (s.ufo !== null) UFO.forEach((row, dy) => row.split('').forEach((ch, dx) => {
    const x = s.ufo! + dx; if (ch === '#' && x >= 0 && x < W) c[(1 + dy) * W + x] = '#ff3c3c';
  }));
  for (const b of s.booms) {
    const pat = b.t < 3 ? ['#.#.#', '.###.', '#.#.#'] : ['#...#', '..#..', '#...#'];
    pat.forEach((row, dy) => row.split('').forEach((ch, dx) => {
      const x = b.x + dx, y = b.y + dy; if (ch === '#' && x >= 0 && x < W && y >= 0 && y < H) c[y * W + x] = '#ffff00';
    }));
  }
  for (const b of s.bombs) {c[b.y * W + b.x] = ORG; if (b.y > 0) c[(b.y - 1) * W + b.x] = '#8c3c1e';}
  if (s.shot) {c[s.shot.y * W + s.shot.x] = '#ffffff'; if (s.shot.y + 1 < H) c[(s.shot.y + 1) * W + s.shot.x] = '#9696c8';}
  CANNON.forEach((row, dy) => row.split('').forEach((ch, dx) => {if (ch === '#') c[(PY + dy) * W + s.px + dx] = GRN;}));
  return c;
};

// the invader the zoom lands on: second row, middle column
const FOCUS_R = 1, FOCUS_C = 2;
const NFOC = SPRITES[FOCUS_R][0].join('').split('').filter((c) => c === '#').length;

const Sheet: React.FC<{f: number; cell: number}> = ({f, cell}) => {
  const s = SIM[tickAt(f)];
  const cells = paint(s);
  const zooming = f >= ZIN - 4 && f < ZOUT + 6;
  const fox = s.fx + FOCUS_C * SX, foy = s.fy + FOCUS_R * SY;
  const inFocus = (x: number, y: number) => zooming && x >= fox && x < fox + 5 && y >= foy && y < foy + 3;
  const HEAD = 26, ROWW = 40;
  const nameBox = zooming ? `${colName(COL0 + fox)}${ROW0 + foy}:${colName(COL0 + fox + 4)}${ROW0 + foy + 2}` : `${colName(COL0 + s.px + 2)}${ROW0 + PY}`;
  const formula = zooming ? `.Interior.Color = RGB(61, 245, 255)   ' ${NFOC} cells` : `=SCORE  ${String(s.score).padStart(4, '0')}`;
  return (
    <div style={{background: '#fff', borderRadius: 14, overflow: 'hidden', width: ROWW + W * cell + 12, boxShadow: `0 0 0 2px #ffffff55, 0 0 90px ${CYAN}44, 0 50px 120px rgba(0,0,0,.8)`}}>
      <div style={{height: 54, background: XL, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14, color: '#fff', fontFamily: 'Segoe UI, Arial', fontSize: 25, fontWeight: 700}}>
        <div style={{width: 32, height: 32, borderRadius: 6, background: '#fff', color: XL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900}}>X</div>
        invaders.xlsm — Excel
        <div style={{marginLeft: 'auto', fontFamily: 'Consolas, monospace', fontSize: 23, opacity: 0.9}}>Sheet1</div>
      </div>
      <div style={{height: 42, background: '#f3f3f3', borderBottom: '1px solid #d4d4d4', display: 'flex', alignItems: 'center', fontFamily: 'Consolas, monospace', fontSize: 21, color: '#222', direction: 'ltr'}}>
        <div style={{minWidth: 96, padding: '0 10px', textAlign: 'center', borderRight: '1px solid #d4d4d4', color: zooming ? XL : '#222', fontWeight: zooming ? 700 : 400}}>{nameBox}</div>
        <div style={{padding: '0 12px', color: '#888', fontStyle: 'italic'}}>fx</div>
        <div style={{color: zooming ? '#0b5d2f' : '#222', fontWeight: zooming ? 700 : 400, whiteSpace: 'nowrap'}}>{formula}</div>
      </div>
      <div style={{display: 'flex', paddingRight: 12, paddingBottom: 10, background: '#fff'}}>
        <div style={{width: ROWW}}>
          <div style={{height: HEAD, background: '#f3f3f3'}} />
          {Array.from({length: H}, (_, y) => (
            <div key={y} style={{height: cell, fontSize: 12, fontFamily: 'Segoe UI, Arial', color: '#666', textAlign: 'center', lineHeight: `${cell}px`,
              background: y >= foy && y < foy + 3 && zooming ? '#cfe8d8' : '#f3f3f3', borderBottom: '1px solid #e1e1e1'}}>{y + ROW0}</div>
          ))}
        </div>
        <div>
          <div style={{display: 'flex', height: HEAD}}>
            {Array.from({length: W}, (_, x) => (
              <div key={x} style={{width: cell, fontSize: 11, fontFamily: 'Segoe UI, Arial', color: '#666', textAlign: 'center', lineHeight: `${HEAD}px`,
                background: x >= fox && x < fox + 5 && zooming ? '#cfe8d8' : '#f3f3f3', borderRight: '1px solid #e1e1e1'}}>{colName(x + COL0)}</div>
            ))}
          </div>
          <div style={{display: 'grid', gridTemplateColumns: `repeat(${W}, ${cell}px)`, gridAutoRows: cell, background: '#08021e', position: 'relative'}}>
            {cells.map((c, i) => {
              const x = i % W, y = Math.floor(i / W);
              const foc = inFocus(x, y);
              return (
                <div key={i} style={{background: c ?? '#08021e', boxShadow: `inset -1px -1px 0 ${c ? 'rgba(0,0,0,.25)' : '#1c1546'}${foc ? ', inset 0 0 0 2px #0b5d2f' : ''}`,
                  filter: c && c !== '#08021e' ? 'brightness(1.08)' : undefined}} />
              );
            })}
            {zooming && (
              <div style={{position: 'absolute', left: fox * cell - 2, top: foy * cell - 2, width: 5 * cell + 4, height: 3 * cell + 4, border: `3px solid ${XL}`,
                boxShadow: '0 0 0 2px #fff'}} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// pixels of a destroyed invader fly out of the sheet toward the camera
const Debris: React.FC<{f: number; cell: number; sheetX: number; sheetY: number}> = ({f, cell, sheetX, sheetY}) => (
  <>
    {KILLS.filter((k) => f >= k && f < k + 26).map((k) => {
      const s = SIM[tickAt(k)];
      const b = s.booms[s.booms.length - 1];
      if (!b) return null;
      const t = (f - k) / 26;
      const col = s.event === 'ufo' ? '#ff3c3c' : ROWCOL[Math.min(3, Math.round((b.y - SIM[tickAt(k)].fy) / SY))];
      return Array.from({length: 12}, (_, i) => {
        const a = (i / 12) * Math.PI * 2 + k;
        const sp = 140 + ((i * 37 + k) % 90);
        const z = interpolate(t, [0, 1], [0, 520 + (i % 4) * 90]);
        return (
          <div key={`${k}-${i}`} style={{position: 'absolute', left: sheetX + (b.x + 2.5) * cell, top: sheetY + (b.y + 1.5) * cell, width: cell, height: cell, background: col,
            boxShadow: `0 0 18px ${col}`, opacity: 1 - t,
            transform: `perspective(900px) translate3d(${Math.cos(a) * sp * t}px, ${Math.sin(a) * sp * t + 120 * t * t}px, ${z}px) rotate(${t * 300 * (i % 2 ? 1 : -1)}deg)`}} />
        );
      });
    })}
  </>
);

const Stars: React.FC<{f: number}> = ({f}) => (
  <>
    {Array.from({length: 90}, (_, i) => {
      const x = (i * 397) % 1080, sp = 2 + (i % 5) * 1.6;
      const y = ((i * 211) % 1920 + f * sp) % 1920;
      const len = 6 + sp * 5;
      return <div key={i} style={{position: 'absolute', left: x, top: y, width: i % 7 === 0 ? 3 : 2, height: len, borderRadius: 2,
        background: i % 9 === 0 ? CYAN : '#fff', opacity: 0.25 + (i % 5) * 0.12}} />;
    })}
  </>
);

const KeyCap: React.FC<{label: string; on: boolean; w?: number}> = ({label, on, w = 150}) => (
  <div style={{width: w, height: 120, borderRadius: 22, background: on ? GRN : '#120c2e', border: `3px solid ${on ? GRN : '#3a2f78'}`, color: on ? '#06021a' : '#b9b0ff',
    boxShadow: on ? `0 0 46px ${GRN}` : '0 12px 0 #050214', translate: `0 ${on ? 10 : 0}px`, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: label.length > 2 ? 'Segoe UI, Arial' : FONT, fontSize: label.length > 2 ? 40 : 64, fontWeight: 900}}>{label}</div>
);

const CODE: {t: string; c: string; hl?: boolean}[] = [
  {t: 'Do While alive', c: '#569cd6'},
  {t: '  key = GetAsyncKeyState(...)', c: '#9cdcfe'},
  {t: '  StepGame key, fire   \' fleet, bombs', c: '#dcdcaa', hl: true},
  {t: '  Compose: Flush       \' repaint cells', c: '#dcdcaa'},
  {t: '  DoEvents', c: '#9cdcfe'},
  {t: 'Loop', c: '#569cd6'},
];
const Editor: React.FC<{f: number}> = ({f}) => {
  const chars = Math.max(0, (f - ZOUT + 4) * 6);
  let used = 0;
  return (
    <div style={{width: 920, borderRadius: 18, overflow: 'hidden', background: '#0e0b22', boxShadow: `0 0 0 2px ${GRN}66, 0 0 60px ${GRN}33, 0 30px 80px rgba(0,0,0,.7)`}}>
      <div style={{height: 46, background: '#1a1538', display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', fontFamily: 'Segoe UI, Arial', fontSize: 22, color: '#bbb'}}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{width: 15, height: 15, borderRadius: 8, background: c}} />)}
        <span style={{marginLeft: 10}}>VBA — Module1 · Sub Invaders()</span>
      </div>
      <div style={{padding: '12px 24px', fontFamily: 'Consolas, monospace', fontSize: 31, lineHeight: '44px', direction: 'ltr'}}>
        {CODE.map((l, i) => {
          const show = Math.max(0, Math.min(l.t.length, chars - used));
          used += l.t.length;
          const on = l.hl && f >= ZOUT + 20;
          return (
            <div key={i} style={{display: 'flex', whiteSpace: 'pre', color: l.c, borderRadius: 8, margin: '0 -10px', padding: '0 10px',
              background: on ? `${GRN}22` : 'transparent', outline: on ? `3px solid ${GRN}` : 'none'}}>
              <span style={{color: '#4b4470', width: 46, flexShrink: 0}}>{i + 1}</span>
              <span>{l.t.slice(0, show)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// keep consecutive Latin words (Space Invaders) together so RTL layout does not swap them
const groupLatin = (ws: Word[]) => ws.reduce<Word[]>((a, w) => {
  const prev = a[a.length - 1];
  if (prev && /^[A-Za-z]/.test(prev.w) && /^[A-Za-z]/.test(w.w)) {a[a.length - 1] = {w: `${prev.w} ${w.w}`, start: prev.start, end: w.end}; return a;}
  a.push(w); return a;
}, []);

const Caption: React.FC<{line: V; top: number; accent: string}> = ({line, top, accent}) => {
  const frame = useCurrentFrame();
  const t = (frame - line.at) / 30;
  if (t < -0.1 || t > line.sec + 0.4) return null;
  const pop = interpolate(t, [-0.1, 0.12], [0.85, 1], {...clamp, easing: Easing.out(Easing.back(2))});
  return (
    <div dir="rtl" lang="ar" style={{position: 'absolute', top, left: 36, right: 36, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 70, lineHeight: 1.35,
      scale: `${pop}`, opacity: interpolate(t, [line.sec + 0.15, line.sec + 0.4], [1, 0], clamp)}}>
      {groupLatin(line.words).map((w, i, ws) => {
        const said = t >= w.start;
        const on = said && t < (ws[i + 1]?.start ?? w.end + 0.3);
        return (
          <span key={i} dir={/[A-Za-z]/.test(w.w) ? 'ltr' : undefined} style={{display: 'inline-block', unicodeBidi: 'isolate', margin: '0 0.14em', color: on ? accent : said ? '#fff' : 'rgba(255,255,255,.3)',
            textShadow: on ? `0 0 28px ${accent}, 0 4px 10px rgba(0,0,0,.9)` : '0 4px 14px rgba(0,0,0,.95), 0 0 4px #000'}}>{w.w}</span>
        );
      })}
    </div>
  );
};

export const Ep08Invaders: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = SIM[tickAt(frame)];
  const cell = 23;
  const outro = frame >= B.outro;
  const SHEET_W = 40 + W * cell + 12;
  const GRID_X = 40, GRID_Y = 54 + 42 + 26;

  // slow orbit of the sheet (swing in from the side on frame 0, then drift)
  const swing = interpolate(frame, [0, 40], [-24, 0], {...clamp, easing: Easing.out(Easing.cubic)});
  const rotY = swing + Math.sin(frame / 46) * 5;
  const rotX = 6 + Math.cos(frame / 60) * 3;
  // snap-zoom onto one invader
  const z = interpolate(frame, [ZIN - 4, ZIN + 10, ZOUT - 6, ZOUT + 8], [0, 1, 1, 0], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const so = spring({frame: frame - B.outro, fps, config: {damping: 15}});
  const fox = s.fx + FOCUS_C * SX, foy = s.fy + FOCUS_R * SY;
  const tx = GRID_X + (fox + 2.5) * cell, ty = GRID_Y + (foy + 1.5) * cell;
  const scale = interpolate(z, [0, 1], [1, 3.4]) * interpolate(so, [0, 1], [1, 0.62]);
  const ox = interpolate(z, [0, 1], [SHEET_W / 2, tx]);
  const oy = interpolate(z, [0, 1], [470, ty]);
  const sheetCY = 880 + interpolate(so, [0, 1], [0, -250]);
  const shake = KILLS.some((k) => frame >= k && frame < k + 5) ? Math.sin(frame * 9) * 5 : 0;
  const keyOn = frame >= B.keys - 6 && frame < B.outro;
  const editorOn = frame >= ZOUT - 4 && frame < B.keys - 4;

  return (
    <AbsoluteFill style={{background: 'radial-gradient(130% 70% at 50% 110%, #3b1470 0%, #12073a 40%, #040212 75%)', overflow: 'hidden'}}>
      <Stars f={frame} />
      {/* planet rim */}
      <div style={{position: 'absolute', left: -300, right: -300, top: 1640, height: 1200, borderRadius: '50%', background: 'radial-gradient(closest-side, #1a0b4a, #0a0420)',
        boxShadow: `0 -10px 80px ${MAG}55, inset 0 14px 40px ${MAG}66`}} />

      {/* the sheet */}
      <div style={{position: 'absolute', left: 540, top: sheetCY, translate: `${-ox + shake}px ${-oy}px`, transform: `perspective(1800px) rotateY(${rotY * (1 - z)}deg) rotateX(${rotX * (1 - z)}deg)`,
        transformOrigin: `${ox}px ${oy}px`}}>
        <div style={{scale: `${scale}`, transformOrigin: `${ox}px ${oy}px`, position: 'relative'}}>
          <Sheet f={frame} cell={cell} />
        </div>
      </div>
      <div style={{position: 'absolute', left: 540 - SHEET_W / 2, top: sheetCY - 470}}>
        {z === 0 && !outro && <Debris f={frame} cell={cell} sheetX={GRID_X} sheetY={GRID_Y} />}
      </div>

      {/* hook label */}
      {frame < B.reveal - 4 && (
        <div dir="rtl" style={{position: 'absolute', top: 1400, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 58, color: '#fff',
          textShadow: `0 0 24px ${GRN}`, opacity: interpolate(frame, [14, 26, B.reveal - 14, B.reveal - 4], [0, 1, 1, 0], clamp)}}>
          كلّ مربّع هنا = خليّة Excel 🤯
        </div>
      )}
      {z > 0.6 && (
        <div dir="rtl" style={{position: 'absolute', top: 1400, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 56, color: GRN, textShadow: `0 0 24px ${GRN}`}}>
          غازٍ واحد = {NFOC} خلايا ملوّنة
        </div>
      )}
      {editorOn && (
        <div style={{position: 'absolute', left: 80, top: 1380, opacity: interpolate(frame, [ZOUT - 4, ZOUT + 8, B.keys - 12, B.keys - 4], [0, 1, 1, 0], clamp),
          translate: `0 ${interpolate(frame, [ZOUT - 4, ZOUT + 14], [140, 0], {...clamp, easing: Easing.out(Easing.cubic)})}px`}}>
          <Editor f={frame} />
        </div>
      )}
      {keyOn && (
        <div style={{position: 'absolute', top: 1440, width: '100%', display: 'flex', justifyContent: 'center', gap: 22, direction: 'ltr',
          opacity: interpolate(frame, [B.keys - 6, B.keys + 6, B.outro - 8, B.outro], [0, 1, 1, 0], clamp)}}>
          <KeyCap label="◀" on={s.key === 0} />
          <KeyCap label="Space" on={!!s.shot && s.shot.y > PY - 8} w={330} />
          <KeyCap label="▶" on={s.key === 1} />
        </div>
      )}

      {/* outro */}
      {outro && (
        <div dir="rtl" style={{position: 'absolute', top: 1060, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, opacity: so, translate: `0 ${(1 - so) * 90}px`}}>
          <div style={{display: 'inline-flex', alignItems: 'center', gap: 22, background: '#fff', borderRadius: 30, padding: '16px 34px', boxShadow: `0 0 60px ${GRN}66`}}>
            <div style={{width: 76, height: 92, borderRadius: 10, background: XL, color: '#fff', fontSize: 30, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8, fontFamily: 'Segoe UI, Arial'}}>xlsm</div>
            <div style={{textAlign: 'right'}}>
              <div style={{fontSize: 58, color: '#0a0624'}}>اكتب «أريده» 📥</div>
              <div style={{fontSize: 30, color: '#5a5478', fontWeight: 700}}>invaders.xlsm · مجاني · Excel على ويندوز</div>
            </div>
          </div><br />
          <div style={{display: 'inline-block', fontSize: 42, color: '#140c06', background: '#ffd35a', borderRadius: 24, padding: '4px 30px', marginTop: 20,
            opacity: interpolate(frame, [B.outro + 10, B.outro + 20], [0, 1], clamp)}}>🔔 اشترك لتصلك اللعبة التالية</div><br />
          <div style={{display: 'inline-block', fontSize: 40, color: CYAN, border: `3px solid ${CYAN}`, borderRadius: 24, padding: '4px 28px', marginTop: 18, textShadow: `0 0 18px ${CYAN}`,
            opacity: interpolate(frame, [VOICE[4].at + 70, VOICE[4].at + 82], [0, 1], clamp)}}>الحلقة القادمة: كرةٌ تحطّم الطوب 🧱</div>
        </div>
      )}

      {/* host */}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', translate: outro ? '-370px 740px' : '400px 600px',
        opacity: frame < B.reveal ? 0 : interpolate(frame, [B.reveal, B.reveal + 12], [0, 1], clamp)}}>
        <Mokaab frame={frame} scale={outro ? 0.25 : 0.21} y={0} mood={frame < B.keys ? 'shock' : outro ? 'happy' : 'smirk'} wave={outro ? 1 : 0}
          lookX={outro ? 0.6 : -0.7} talk={speaking(LINES, frame)} rings={false} />
      </div>

      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 58%, rgba(0,0,0,.6) 100%)', pointerEvents: 'none'}} />
      <AbsoluteFill style={{background: '#fff', opacity: interpolate(frame, [ZIN - 2, ZIN + 1, ZIN + 6], [0, 0.35, 0], clamp), pointerEvents: 'none'}} />

      {VOICE.map((v, i) => <Caption key={v.src} line={v} top={150} accent={i === 4 ? '#ffd35a' : i === 2 ? GRN : CYAN} />)}
      {outro && (
        <div dir="rtl" style={{position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 32, color: '#b9b0ff'}}>
          أسرار Excel · الحلقة 8 · تك عالماشي · خلّيك ذكي!
        </div>
      )}

      <VoiceTrack lines={LINES} />
      {SHOTS.filter((x, i) => i % 2 === 0 && x < B.outro).map((x) => <Sfx key={`s${x}`} name="blip" at={x} volume={0.22} />)}
      {KILLS.filter((x) => x < B.outro).map((x) => <Sfx key={`k${x}`} name="pop" at={x} volume={0.45} />)}
      <Sfx name="whoosh" at={ZIN - 6} volume={0.5} />
      <Sfx name="ding" at={ZIN + 10} volume={0.4} />
      <Sfx name="whoosh" at={ZOUT - 2} volume={0.35} />
      <Sfx name="click" at={B.keys} volume={0.4} />
      <Sfx name="pop" at={B.outro + 2} volume={0.45} />
    </AbsoluteFill>
  );
};
