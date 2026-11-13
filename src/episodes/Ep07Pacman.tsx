import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import TL from './Ep07Pacman.timeline.json';
import {simulate, State, MAZE, W, H} from './Ep07Pacman.sim';

// Episode 7 of أسرار Excel: Pac-Man played inside the cells (files/pacman.xlsm).
// The simulation uses the rules of files/pacman.bas (19 x 21 tiles, a breadth-first search from Pac-Man every
// tick, ghosts step down the numbers, blue ghosts step up them), driven by an autopilot.
// Look: night arcade — black cabinet, magenta/cyan neon, CRT scanlines, Excel in dark mode. Motion: the sheet
// lands from a steep 3D tilt (not the push-out of ep 6), a macro zoom into ONE cell for the reveal, then the
// BFS numbers flood the maze ring by ring while the game holds its breath.

type Word = {w: string; start: number; end: number};
type V = {src: string; at: number; sec: number; words: Word[]};
const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const B = TL.beats;
const TF = TL.tickFrames;
export const EP07_FRAMES = TL.frames;

const NEON = '#ff2bd6';
const CYAN = '#29f0ff';
const YEL = '#ffe600';
const XL = '#107c41';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// game clock: one tick per TF frames, frozen while the BFS flood is drawn
const tickAt = (f: number) => {
  const paused = Math.max(0, Math.min(f, B.resume) - B.bfs);
  return Math.floor((f - paused) / TF);
};
const {states: SIM, keys: KEYS} = simulate(tickAt(EP07_FRAMES) + 2);
const EVENT_FRAMES = (kind: string) => {
  const out: number[] = [];
  for (let f = 1; f < EP07_FRAMES; f++) if (tickAt(f) !== tickAt(f - 1) && SIM[tickAt(f)].event === kind) out.push(f);
  return out;
};
const PELLET = EVENT_FRAMES('pellet');
const GHOSTS_EATEN = EVENT_FRAMES('ghost');
const DOTS = EVENT_FRAMES('dot');

const GHOST_COL = ['#ff2020', '#ffb8ff', '#00ffff', '#ffb852'];
const colName = (i: number) => String.fromCharCode(65 + i);

// numbers the ghosts follow: shown from the BFS beat (ring by ring during the freeze), then live
const showDist = (f: number) => f >= B.bfs && f < B.outro + 40;
const ringR = (f: number) => (f < B.resume ? (f - B.bfs) * 1.25 : 999);

// Blinky's path down the numbers to Pac-Man (what "shortest path" means)
const blinkyPath = (s: State): Set<number> => {
  const out = new Set<number>();
  const g = s.ghosts[0];
  if (g.mode !== 'chase') return out;
  let x = g.x, y = g.y;
  for (let n = 0; n < 60; n++) {
    const d = s.dist[y * W + x];
    if (d <= 0) break;
    let nx = x, ny = y;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const ax = (x + dx + W) % W, ay = y + dy;
      if (ay < 0 || ay >= H) continue;
      const v = s.dist[ay * W + ax];
      if (v >= 0 && v === d - 1) {nx = ax; ny = ay; break;}
    }
    if (nx === x && ny === y) break;
    x = nx; y = ny;
    out.add(y * W + x);
  }
  return out;
};

const Sheet: React.FC<{f: number; cell: number}> = ({f, cell}) => {
  const s = SIM[tickAt(f)];
  const nums = showDist(f);
  const r = ringR(f);
  const path = nums && f >= B.bfs + 34 ? blinkyPath(s) : new Set<number>();
  const blink = Math.floor(tickAt(f) / 3) % 2 === 0;
  const HEAD = 30, ROWW = 46;
  const pacCell = `${colName(s.px + 1)}${s.py + 3}`;
  const ghostAt = new Map<number, number>();
  s.ghosts.forEach((g, i) => ghostAt.set(g.y * W + g.x, i));
  const maxD = 30;
  return (
    <div style={{background: '#1f1f1f', borderRadius: 18, overflow: 'hidden', boxShadow: `0 0 0 3px ${NEON}88, 0 0 80px ${NEON}55, 0 40px 90px rgba(0,0,0,.7)`, width: ROWW + W * cell + 16}}>
      <div style={{height: 58, background: XL, display: 'flex', alignItems: 'center', padding: '0 22px', gap: 14, color: '#fff', fontFamily: 'Segoe UI, Arial', fontSize: 26, fontWeight: 700}}>
        <div style={{width: 34, height: 34, borderRadius: 6, background: '#fff', color: XL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900}}>X</div>
        pacman.xlsm — Excel
        <div style={{marginLeft: 'auto', background: 'rgba(0,0,0,.25)', borderRadius: 8, padding: '2px 14px', fontSize: 24, fontFamily: 'Consolas, monospace'}}>SCORE {s.score}</div>
      </div>
      <div style={{height: 44, background: '#2b2b2b', borderBottom: '1px solid #3d3d3d', display: 'flex', alignItems: 'center', fontFamily: 'Consolas, monospace', fontSize: 22, color: '#ddd'}}>
        <div style={{width: 90, textAlign: 'center', borderRight: '1px solid #3d3d3d'}}>{pacCell}</div>
        <div style={{padding: '0 14px', color: '#888'}}>fx</div>
        <div style={{color: f >= B.reveal && f < B.bfs ? YEL : '#eee'}}>{nums ? `=${s.dist[s.ghosts[0].y * W + s.ghosts[0].x]}  ' steps from the red ghost` : '.Interior.Color = RGB(255, 230, 0)'}</div>
      </div>
      <div style={{display: 'flex', paddingRight: 16, paddingBottom: 12}}>
        <div style={{width: ROWW}}>
          <div style={{height: HEAD}} />
          {Array.from({length: H}, (_, y) => (
            <div key={y} style={{height: cell, fontSize: 15, fontFamily: 'Segoe UI, Arial', color: '#999', textAlign: 'center', lineHeight: `${cell}px`,
              background: s.py === y ? '#2f4a3a' : '#262626', borderBottom: '1px solid #333'}}>{y + 3}</div>
          ))}
        </div>
        <div>
          <div style={{display: 'flex', height: HEAD}}>
            {Array.from({length: W}, (_, x) => (
              <div key={x} style={{width: cell, fontSize: 14, fontFamily: 'Segoe UI, Arial', color: '#999', textAlign: 'center', lineHeight: `${HEAD}px`,
                background: s.px === x ? '#2f4a3a' : '#262626', borderRight: '1px solid #333'}}>{colName(x + 1)}</div>
            ))}
          </div>
          <div style={{display: 'grid', gridTemplateColumns: `repeat(${W}, ${cell}px)`, gridAutoRows: cell, background: '#0c1014'}}>
            {Array.from({length: W * H}, (_, i) => {
              const x = i % W, y = Math.floor(i / W);
              const m = MAZE[y][x];
              const g = ghostAt.get(i);
              const isPac = s.px === x && s.py === y;
              let bg = m === '#' ? '#0060c0' : m === '-' ? '#ffaac8' : '#0c1014';
              let txt = '';
              let tc = '#ffd2aa';
              const d = s.dist[i];
              if (m !== '#' && m !== '-') {
                if (nums && d >= 0 && d <= r) {
                  txt = String(d);
                  tc = path.has(i) ? '#fff' : `hsl(${190 + Math.min(d / maxD, 1) * 120}, 100%, 72%)`;
                  if (path.has(i)) bg = '#6a0a14';
                } else {
                  const c = s.dots[y][x];
                  txt = c === '.' ? '•' : c === 'o' && blink ? '●' : '';
                }
              }
              if (g !== undefined) {
                const gh = s.ghosts[g];
                const flash = s.fright > 0 && s.fright < 10 && tickAt(f) % 2 === 0;
                bg = gh.mode === 'fright' ? (flash ? '#f0f0ff' : '#2840ff') : gh.mode === 'eyes' ? '#c8c8dc' : GHOST_COL[g];
                txt = '';
              }
              if (isPac) {bg = YEL; txt = '';}
              const glow = isPac ? `0 0 18px ${YEL}` : g !== undefined ? `0 0 14px ${bg}` : 'none';
              return (
                <div key={i} style={{background: bg, boxShadow: `inset -1px -1px 0 rgba(255,255,255,.07)${glow !== 'none' ? ', ' + glow : ''}`, zIndex: glow !== 'none' ? 2 : 0,
                  color: tc, fontFamily: 'Consolas, monospace', fontWeight: 700, fontSize: txt.length > 1 ? cell * 0.42 : txt === '•' ? cell * 0.5 : cell * 0.5,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{txt}</div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const Arrows: React.FC<{f: number}> = ({f}) => {
  const k = KEYS[tickAt(f)];
  const key = (dir: number, label: string) => {
    const on = k === dir;
    return (
      <div style={{width: 120, height: 104, borderRadius: 20, background: on ? YEL : '#1c1424', border: `3px solid ${on ? YEL : '#4a3360'}`, color: on ? '#140a1c' : '#c9b5dc',
        boxShadow: on ? `0 0 40px ${YEL}` : '0 10px 0 #0c0712', translate: `0 ${on ? 8 : 0}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 58, fontWeight: 900}}>{label}</div>
    );
  };
  return (
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 120px)', gap: 12, direction: 'ltr'}}>
      <div />{key(3, '▲')}<div />
      {key(2, '◀')}{key(1, '▼')}{key(0, '▶')}
    </div>
  );
};

const CODE: {t: string; c: string; hl?: boolean}[] = [
  {t: 'Do While alive', c: '#569cd6'},
  {t: '  MovePacman  KeyDir()', c: '#dcdcaa'},
  {t: '  Flood px, py, dist   \' BFS', c: '#ff9de2', hl: true},
  {t: '  For i = 0 To 3: MoveGhost i: Next', c: '#9cdcfe'},
  {t: '  Compose: Flush   \' repaint cells', c: '#dcdcaa'},
  {t: 'Loop', c: '#569cd6'},
];
const Editor: React.FC<{f: number}> = ({f}) => {
  const chars = Math.max(0, (f - B.reveal - 8) * 5);
  let used = 0;
  return (
    <div style={{width: 900, borderRadius: 20, overflow: 'hidden', background: '#16121c', boxShadow: `0 0 0 2px ${CYAN}66, 0 0 50px ${CYAN}33, 0 30px 80px rgba(0,0,0,.7)`}}>
      <div style={{height: 48, background: '#231c2c', display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', fontFamily: 'Segoe UI, Arial', fontSize: 22, color: '#bbb'}}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{width: 16, height: 16, borderRadius: 8, background: c}} />)}
        <span style={{marginLeft: 10}}>VBA — Module1 · Sub Pacman()</span>
      </div>
      <div style={{padding: '14px 24px', fontFamily: 'Consolas, monospace', fontSize: 32, lineHeight: '46px', direction: 'ltr'}}>
        {CODE.map((l, i) => {
          const show = Math.max(0, Math.min(l.t.length, chars - used));
          used += l.t.length;
          const on = l.hl && f >= B.bfs - 6;
          return (
            <div key={i} style={{display: 'flex', whiteSpace: 'pre', color: l.c, borderRadius: 8, margin: '0 -10px', padding: '0 10px',
              background: on ? `${NEON}30` : 'transparent', outline: on ? `3px solid ${NEON}` : 'none'}}>
              <span style={{color: '#5a5068', width: 50, flexShrink: 0}}>{i + 1}</span>
              <span>{l.t.slice(0, show)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Caption: React.FC<{line: V; top: number; accent: string}> = ({line, top, accent}) => {
  const frame = useCurrentFrame();
  const t = (frame - line.at) / 30;
  if (t < -0.1 || t > line.sec + 0.4) return null;
  return (
    <div dir="rtl" lang="ar" style={{position: 'absolute', top, left: 40, right: 40, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 72, lineHeight: 1.35,
      opacity: interpolate(t, [line.sec + 0.15, line.sec + 0.4], [1, 0], clamp)}}>
      {line.words.map((w, i) => {
        const said = t >= w.start;
        const on = said && t < (line.words[i + 1]?.start ?? w.end + 0.3);
        return (
          <span key={i} style={{display: 'inline-block', margin: '0 0.15em', color: on ? accent : said ? '#fff' : 'rgba(255,255,255,.28)',
            translate: `0 ${said ? 0 : 12}px`, scale: on ? '1.08' : '1', textShadow: on ? `0 0 30px ${accent}, 0 4px 10px rgba(0,0,0,.9)` : '0 4px 14px rgba(0,0,0,.9), 0 0 4px #000'}}>{w.w}</span>
        );
      })}
    </div>
  );
};

export const Ep07Pacman: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = SIM[tickAt(frame)];
  const cell = 44;
  const outro = frame >= B.outro;
  // hook: the sheet lands from a steep tilt
  const land = interpolate(frame, [0, 34], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const tiltX = interpolate(land, [0, 1], [58, 0]);
  const tiltZ = interpolate(land, [0, 1], [-8, 0]);
  // reveal: macro zoom into Pac-Man's own cell, out again for the flood
  const zIn = interpolate(frame, [B.reveal, B.reveal + 22, B.bfs - 8, B.bfs + 10], [0, 1, 1, 0], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const so = spring({frame: frame - B.outro, fps, config: {damping: 16}});
  const SHEET_W = 46 + W * cell + 16;
  const pacX = 46 + (s.px + 0.5) * cell, pacY = 58 + 44 + 30 + (s.py + 0.5) * cell;
  const zoom = interpolate(zIn, [0, 1], [1, 2.6]) * interpolate(so, [0, 1], [1, 0.6]);
  const ox = interpolate(zIn, [0, 1], [SHEET_W / 2, pacX]);
  const oy = interpolate(zIn, [0, 1], [0, pacY]);
  const sheetTop = 210 + interpolate(so, [0, 1], [0, -90]) + interpolate(zIn, [0, 1], [0, 380]);
  const flood = frame >= B.bfs && frame < B.resume;
  const lastEat = [...GHOSTS_EATEN].reverse().find((x) => x <= frame) ?? -99;
  const eatP = spring({frame: frame - lastEat, fps, config: {damping: 10}});
  const pelletFlash = PELLET.length ? interpolate(frame, [PELLET[0], PELLET[0] + 3, PELLET[0] + 16], [0, 0.45, 0], clamp) : 0;

  return (
    <AbsoluteFill style={{background: 'radial-gradient(120% 80% at 50% 35%, #2a0b3a 0%, #0b0412 55%, #000 100%)', overflow: 'hidden'}}>
      {/* neon floor grid */}
      <div style={{position: 'absolute', left: -400, right: -400, bottom: -200, height: 900, transform: 'perspective(700px) rotateX(64deg)', transformOrigin: '50% 100%',
        backgroundImage: `linear-gradient(${NEON}55 2px, transparent 2px), linear-gradient(90deg, ${NEON}55 2px, transparent 2px)`, backgroundSize: '90px 90px',
        backgroundPosition: `0 ${(frame * 3) % 90}px`, opacity: 0.55}} />

      {/* the sheet */}
      <div style={{position: 'absolute', left: '50%', top: sheetTop, translate: `${-ox}px ${-oy}px`, transform: `perspective(1600px) rotateX(${tiltX}deg) rotateZ(${tiltZ}deg)`,
        transformOrigin: '50% 0%'}}>
        <div style={{scale: `${zoom}`, transformOrigin: `${ox}px ${oy}px`}}>
          <Sheet f={frame} cell={cell} />
        </div>
      </div>

      {/* +points when a blue ghost is eaten */}
      {lastEat > 0 && frame - lastEat < 26 && !outro && (
        <div style={{position: 'absolute', left: 540 - 140, top: 640 - eatP * 60, width: 280, textAlign: 'center', fontFamily: 'Consolas, monospace', fontWeight: 900, fontSize: 90,
          color: CYAN, textShadow: `0 0 30px ${CYAN}`, opacity: interpolate(frame - lastEat, [16, 26], [1, 0], clamp)}}>+{100 * 2 ** SIM[tickAt(lastEat)].eaten}</div>
      )}

      {/* hook label */}
      {frame < B.reveal && (
        <div dir="rtl" style={{position: 'absolute', top: 92, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 62, color: '#fff',
          textShadow: `0 0 26px ${NEON}`, opacity: interpolate(frame, [10, 22, B.reveal - 8, B.reveal], [0, 1, 1, 0], clamp)}}>
          هذه خلايا Excel 🤯
        </div>
      )}
      {/* arrow keys */}
      {frame >= B.maze - 8 && frame < B.reveal + 4 && (
        <div style={{position: 'absolute', top: 1290, left: 540 - 192, opacity: interpolate(frame, [B.maze - 8, B.maze + 4, B.reveal - 6, B.reveal + 4], [0, 1, 1, 0], clamp)}}>
          <Arrows f={frame} />
        </div>
      )}
      {/* reveal: the loop */}
      {frame >= B.reveal && !outro && (
        <div style={{position: 'absolute', left: 90, top: 1300, opacity: interpolate(frame, [B.reveal, B.reveal + 12, B.outro - 8, B.outro], [0, 1, 1, 0], clamp),
          translate: `0 ${interpolate(frame, [B.reveal, B.reveal + 16], [120, 0], {...clamp, easing: Easing.out(Easing.cubic)})}px`}}>
          <Editor f={frame} />
        </div>
      )}
      {flood && (
        <div dir="rtl" style={{position: 'absolute', top: 96, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 54, color: CYAN, textShadow: `0 0 24px ${CYAN}`}}>
          كل رقم = عدد الخطوات إليك
        </div>
      )}

      {/* outro */}
      {outro && (
        <div dir="rtl" style={{position: 'absolute', top: 1010, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, opacity: so, translate: `0 ${(1 - so) * 80}px`}}>
          <div style={{display: 'inline-flex', alignItems: 'center', gap: 22, background: '#fff', borderRadius: 30, padding: '16px 34px', boxShadow: `0 0 60px ${NEON}66`}}>
            <div style={{width: 76, height: 92, borderRadius: 10, background: XL, color: '#fff', fontSize: 30, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8, fontFamily: 'Segoe UI, Arial'}}>xlsm</div>
            <div style={{textAlign: 'right'}}>
              <div style={{fontSize: 58, color: '#1a0b24'}}>اكتب «أريده» 📥</div>
              <div style={{fontSize: 30, color: '#6b5a78', fontWeight: 700}}>pacman.xlsm · مجاني · Excel على ويندوز</div>
            </div>
          </div><br />
          <div style={{display: 'inline-block', fontSize: 42, color: '#1a1020', background: '#ffd35a', borderRadius: 24, padding: '4px 30px', marginTop: 20,
            opacity: interpolate(frame, [B.outro + 10, B.outro + 20], [0, 1], clamp)}}>🔔 اشترك لتصلك اللعبة التالية</div><br />
          <div style={{display: 'inline-block', fontSize: 40, color: CYAN, border: `3px solid ${CYAN}`, borderRadius: 24, padding: '4px 28px', marginTop: 18, textShadow: `0 0 18px ${CYAN}`,
            opacity: interpolate(frame, [VOICE[4].at + 48, VOICE[4].at + 60], [0, 1], clamp)}}>الحلقة القادمة: لعبة فضاء أسطورية 👾</div>
        </div>
      )}

      {/* host */}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', translate: outro ? '-390px -250px' : '440px -790px', opacity: frame < B.reveal ? 0 : interpolate(frame, [B.reveal, B.reveal + 12], [0, 1], clamp)}}>
        <Mokaab frame={frame} scale={outro ? 0.24 : 0.2} y={0} mood={frame < B.bfs ? 'shock' : outro ? 'happy' : 'smirk'} wave={outro ? 1 : 0}
          lookX={-0.7} talk={speaking(LINES, frame)} rings={false} />
      </div>

      {/* CRT scanlines + vignette */}
      <AbsoluteFill style={{backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 2px, transparent 2px 5px)', pointerEvents: 'none'}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.65) 100%)', pointerEvents: 'none'}} />
      <AbsoluteFill style={{background: '#2840ff', opacity: pelletFlash, mixBlendMode: 'screen'}} />

      {VOICE.map((v, i) => <Caption key={v.src} line={v} top={i === 4 ? 1560 : i === 2 || i === 3 ? 1660 : 1530} accent={i === 3 ? NEON : i === 4 ? '#3ddc84' : YEL} />)}
      {outro && (
        <div dir="rtl" style={{position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 32, color: '#c9a8d8'}}>
          أسرار Excel · الحلقة 7 · تك عالماشي · خلّيك ذكي!
        </div>
      )}

      <VoiceTrack lines={LINES} />
      {DOTS.filter((x, i) => i % 2 === 0 && x < B.bfs).map((x) => <Sfx key={x} name="tick" at={x} volume={0.25} />)}
      {Array.from({length: 8}, (_, i) => <Sfx key={`r${i}`} name="blip" at={B.bfs + i * 4} volume={0.3} />)}
      {PELLET.map((x) => <Sfx key={`p${x}`} name="pop" at={x} volume={0.5} />)}
      {GHOSTS_EATEN.map((x) => <Sfx key={`g${x}`} name="ding" at={x} volume={0.45} />)}
      <Sfx name="whoosh" at={B.reveal - 2} volume={0.45} />
      <Sfx name="whoosh" at={B.bfs - 4} volume={0.35} />
      <Sfx name="pop" at={B.outro + 2} volume={0.45} />
    </AbsoluteFill>
  );
};
