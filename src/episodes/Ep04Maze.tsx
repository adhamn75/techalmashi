import React from 'react';
import {AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import TL from './Ep04Maze.timeline.json';

// Episode 4 of أسرار Excel: a first-person 3D maze (raycaster) drawn in cells, arrows to walk.
// The renderer below is the same DDA as files/maze3d.bas (54 x 40 cells, same map, same shading),
// so every frame of the video is what the sheet would show. Look: night-blue scene, sky-blue accents.

const LINES: Line[] = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const B = TL.beats;
export const EP04_FRAMES = TL.frames;

const NIGHT = '#081026';
const SKY = '#5cc8ff';
const ORANGE = '#ff9a3c';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// ---------- the map and the raycaster (mirror of maze3d.bas) ----------
const MAP = ['############', '#..#.......#', '#..#.##.##.#', '#....#...#.#', '####.#.#.#.#', '#....#.#...#',
  '#.####.###.#', '#......#...#', '#.##.#.#.###', '#..#.#...#.E', '#..#.#.#...#', '############'];
const tile = (x: number, y: number) => (x < 0 || y < 0 || x > 11 || y > 11 ? '#' : MAP[y][x]);
const VW = 54, VH = 40;
type Col = {top: number; bot: number; color: string; dist: number; hitX: number; hitY: number};
const shade = (r: number, g: number, b: number, k: number) => {
  const q = Math.max(0.12, Math.min(1, k));
  return `rgb(${Math.round(r * q)},${Math.round(g * q)},${Math.round(b * q)})`;
};
const cast = (px: number, py: number, ang: number): Col[] => {
  const dx = Math.cos(ang), dy = Math.sin(ang), plx = -dy * 0.66, ply = dx * 0.66;
  const out: Col[] = [];
  for (let c = 0; c < VW; c++) {
    const cam = (2 * c) / VW - 1;
    const rx = dx + plx * cam, ry = dy + ply * cam;
    let mx = Math.floor(px), my = Math.floor(py);
    const ddx = rx === 0 ? 1e30 : Math.abs(1 / rx), ddy = ry === 0 ? 1e30 : Math.abs(1 / ry);
    const sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1;
    let sdx = rx < 0 ? (px - mx) * ddx : (mx + 1 - px) * ddx;
    let sdy = ry < 0 ? (py - my) * ddy : (my + 1 - py) * ddy;
    let side = 0, t = '.';
    for (let n = 0; n < 64 && t === '.'; n++) {
      if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
      t = tile(mx, my);
    }
    const dist = Math.max(0.05, side === 0 ? sdx - ddx : sdy - ddy);
    const h = Math.round(VH / dist);
    const top = Math.max(0, Math.floor((VH - h) / 2)), bot = Math.min(VH - 1, Math.floor((VH - h) / 2) + h - 1);
    let k = 1.15 / (1 + dist * 0.35);
    if (side === 1) k *= 0.72;
    out.push({top, bot, dist, color: t === 'E' ? shade(40, 230, 110, k) : shade(255, 150, 60, k), hitX: px + rx * dist, hitY: py + ry * dist});
  }
  return out;
};

// camera path: [frame, x, y, angle(deg)] — real corridors of the map
type Key = [number, number, number, number];
const WALK: Key[] = [[0, 4.5, 1.5, 0], [64, 9.4, 1.5, 0], [92, 10.4, 1.7, 90], [150, 10.5, 4.6, 90], [B.rays, 10.5, 5.4, 90]];
const EXIT: Key[] = [[0, 8.3, 10.5, 0], [26, 9.9, 10.5, 0], [46, 10.4, 10.3, -90], [62, 10.5, 9.7, -90], [80, 10.5, 9.6, 0], [96, 10.75, 9.5, 0]];
const pose = (keys: Key[], f: number) => {
  let i = 0;
  while (i < keys.length - 2 && f >= keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1];
  const t = interpolate(f, [a[0], b[0]], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
  return {x: a[1] + (b[1] - a[1]) * t, y: a[2] + (b[2] - a[2]) * t, ang: ((a[3] + (b[3] - a[3]) * t) * Math.PI) / 180};
};

// ---------- the sheet ----------
const CELL = 18;
const View: React.FC<{cols: Col[]; hl?: number[]; dim?: number}> = ({cols, hl = [], dim = 0}) => (
  <div style={{display: 'flex', width: VW * CELL, height: VH * CELL, position: 'relative'}}>
    {cols.map((c, x) => (
      <div key={x} style={{width: CELL, height: VH * CELL, position: 'relative', opacity: hl.length && !hl.includes(x) ? 1 - dim : 1}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: c.top * CELL, background: '#0e0c18'}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: c.top * CELL, height: (c.bot - c.top + 1) * CELL, background: c.color,
          outline: hl.includes(x) ? `3px solid ${SKY}` : 'none', zIndex: hl.includes(x) ? 2 : 0}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: (c.bot + 1) * CELL, bottom: 0, background: '#28221e'}} />
      </div>
    ))}
    {/* cell grid lines: it IS a sheet */}
    <div style={{position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(0,0,0,.28) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.28) 1px, transparent 1px)`,
      backgroundSize: `${CELL}px ${CELL}px`, zIndex: 3}} />
  </div>
);

const Window: React.FC<{children: React.ReactNode; formula: React.ReactNode}> = ({children, formula}) => (
  <div style={{width: VW * CELL + 40, borderRadius: 18, overflow: 'hidden', background: '#11162a', boxShadow: '0 0 0 3px #1f2846, 0 40px 120px rgba(0,0,0,.7)'}}>
    <div style={{height: 56, background: '#1a2140', display: 'flex', alignItems: 'center', padding: '0 22px', gap: 12}}>
      {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{width: 18, height: 18, borderRadius: 9, background: c}} />)}
      <div style={{flex: 1, textAlign: 'center', color: '#e8ecff', fontFamily: 'sans-serif', fontWeight: 700, fontSize: 28}}>maze3d.xlsm</div>
    </div>
    <div style={{height: 50, display: 'flex', alignItems: 'center', borderBottom: '2px solid #1f2846', fontFamily: 'sans-serif', fontSize: 25, color: '#b9c3e6'}}>
      <div style={{width: 96, textAlign: 'center', borderRight: '2px solid #1f2846'}}>B3</div>
      <div style={{padding: '0 14px', fontStyle: 'italic', color: '#6d7aa6'}}>fx</div>
      <div style={{fontFamily: 'monospace', whiteSpace: 'nowrap'}}>{formula}</div>
    </div>
    <div style={{padding: 20}}>{children}</div>
  </div>
);

const Mini: React.FC<{x: number; y: number; ang: number; size: number; rays?: Col[]; hl?: number[]}> = ({x, y, ang, size, rays, hl = []}) => {
  const s = size / 12;
  return (
    <svg width={size} height={size} style={{display: 'block'}}>
      {MAP.map((row, j) => row.split('').map((t, i) => (
        <rect key={`${i}-${j}`} x={i * s} y={j * s} width={s - 1} height={s - 1} fill={t === '#' ? '#96582a' : t === 'E' ? '#28e66e' : '#16182a'} />
      )))}
      {rays?.map((r, i) => (
        <line key={i} x1={x * s} y1={y * s} x2={r.hitX * s} y2={r.hitY * s} stroke={hl.includes(i) ? SKY : 'rgba(255,230,160,.35)'} strokeWidth={hl.includes(i) ? 5 : 1.5} />
      ))}
      <circle cx={x * s} cy={y * s} r={s * 0.3} fill={SKY} />
      <line x1={x * s} y1={y * s} x2={(x + Math.cos(ang) * 0.6) * s} y2={(y + Math.sin(ang) * 0.6) * s} stroke={SKY} strokeWidth={4} />
    </svg>
  );
};

const Cap: React.FC<{f: number; at: number; children: React.ReactNode; top?: number; size?: number}> = ({f, at, children, top = 110, size = 80}) => {
  const p = spring({frame: f - at, fps: 30, config: {damping: 15, stiffness: 170}});
  return (
    <div style={{position: 'absolute', top, left: 30, right: 30, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size,
      color: '#fff', whiteSpace: 'nowrap', opacity: p, transform: `translateY(${(1 - p) * 26}px)`, textShadow: '0 6px 30px rgba(0,0,0,.7)'}}>{children}</div>
  );
};

// ---------- 1. walking the maze, from frame 0 ----------
const Walk: React.FC = () => {
  const f = useCurrentFrame();
  const p = pose(WALK, f);
  const bob = Math.sin(f / 4) * 0.02;
  const cols = cast(p.x, p.y + bob * 0, p.ang);
  const keys = [{k: '▲', on: f < 64 || (f > 92 && f < 150)}, {k: '▶', on: f >= 64 && f <= 92}];
  return (
    <AbsoluteFill>
      {f < B.walk2 ? <Cap f={f} at={-10} size={78}>لعبة 3D… داخل <span style={{color: SKY}}>Excel</span>!</Cap>
        : <Cap f={f} at={B.walk2}>تمشي بالأسهم ⬆️</Cap>}
      <div style={{position: 'absolute', top: 280, left: '50%', transform: `translateX(-50%) translateY(${bob * 120}px)`}}>
        <Window formula={<>=RAYCAST(<span style={{color: ORANGE}}>x</span>, <span style={{color: ORANGE}}>y</span>, <span style={{color: ORANGE}}>angle</span>)</>}>
          <div style={{position: 'relative'}}>
            <View cols={cols} />
            <div style={{position: 'absolute', right: 10, bottom: 10, padding: 6, background: 'rgba(8,10,20,.8)', borderRadius: 10, zIndex: 5}}>
              <Mini x={p.x} y={p.y} ang={p.ang} size={190} />
            </div>
          </div>
        </Window>
      </div>
      <div style={{position: 'absolute', top: 1270, width: '100%', display: 'flex', justifyContent: 'center', gap: 20}}>
        {keys.map(({k, on}) => (
          <div key={k} style={{width: 110, height: 110, borderRadius: 22, background: on ? SKY : '#1a2140', color: on ? NIGHT : '#6d7aa6', fontSize: 56,
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: on ? `0 0 40px ${SKY}, 0 8px 0 #2a7aa8` : '0 8px 0 #0d1226',
            transform: `translateY(${on ? 6 : 0}px)`}}>{k}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---------- 2. each column is a ray ----------
const Rays: React.FC = () => {
  const f = useCurrentFrame();
  const p = pose(WALK, B.rays);
  const cols = cast(p.x, p.y, p.ang);
  const sweep = Math.floor(interpolate(f, [8, 56], [4, VW - 5], clamp));
  const a = spring({frame: f, fps: 30, config: {damping: 14}});
  return (
    <AbsoluteFill>
      <Cap f={f} at={0}>كل عمود = <span style={{color: SKY}}>شعاع ضوء</span></Cap>
      <div style={{position: 'absolute', top: 270, left: '50%', transform: `translateX(-50%) scale(${0.86 + a * 0.06})`, transformOrigin: 'top center'}}>
        <View cols={cols} hl={[sweep]} dim={0.55} />
      </div>
      <div style={{position: 'absolute', top: 1000, left: '50%', marginLeft: -310, padding: 10, background: '#0d1226', borderRadius: 18, border: '3px solid #1f2846', opacity: a}}>
        <Mini x={p.x} y={p.y} ang={p.ang} size={600} rays={cols} hl={[sweep]} />
      </div>
    </AbsoluteFill>
  );
};

// ---------- 3. farther = shorter and darker ----------
const Depth: React.FC = () => {
  const f = useCurrentFrame();
  const p = pose(WALK, B.rays);
  const cols = cast(p.x, p.y, p.ang);
  let near = 0, far = 0;
  cols.forEach((c, i) => { if (c.dist < cols[near].dist) near = i; if (c.dist > cols[far].dist) far = i; });
  const a = spring({frame: f - 6, fps: 30, config: {damping: 12}});
  const b = spring({frame: f - 22, fps: 30, config: {damping: 12}});
  const S = 0.9;
  const tag = (i: number, label: string, o: number) => (
    <div style={{position: 'absolute', left: Math.min(VW * CELL * S - 100, Math.max(100, (i + 0.5) * CELL * S)), top: (cols[i].bot + 1) * CELL * S + 16, transform: `translateX(-50%) scale(${o})`, textAlign: 'center',
      fontFamily: FONT, fontWeight: 900, fontSize: 40, color: '#fff', background: '#1a2140', border: `3px solid ${SKY}`, borderRadius: 14, padding: '2px 16px', whiteSpace: 'nowrap', direction: 'rtl', zIndex: 6}}>
      {label}<div style={{fontFamily: 'monospace', fontSize: 30, color: ORANGE, direction: 'ltr'}}>d = {cols[i].dist.toFixed(1)}</div>
    </div>
  );
  return (
    <AbsoluteFill>
      <Cap f={f} at={0}>أبعد = <span style={{color: SKY}}>أقصر وأظلم</span></Cap>
      <div style={{position: 'absolute', top: 290, left: '50%', width: VW * CELL * S, marginLeft: -(VW * CELL * S) / 2}}>
        <div style={{transform: `scale(${S})`, transformOrigin: 'top left'}}><View cols={cols} hl={[near, far]} dim={0.6} /></div>
        {tag(near, 'قريب', a)}
        {tag(far, 'بعيد', b)}
      </div>
      <div style={{position: 'absolute', top: 1180, width: '100%', textAlign: 'center', opacity: b}}>
        <div style={{display: 'inline-block', fontFamily: 'monospace', fontSize: 54, color: '#fff', background: '#0d1226', border: `3px solid ${ORANGE}`, borderRadius: 20, padding: '18px 36px', direction: 'ltr'}}>
          height = 40 / <span style={{color: ORANGE}}>d</span>
        </div>
        <div style={{fontFamily: FONT, fontWeight: 700, fontSize: 46, color: '#b9c3e6', marginTop: 22, direction: 'rtl'}}>ولون الخلية يخفت مع المسافة</div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- 4. escape + CTA ----------
const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const p = pose(EXIT, f);
  const cols = cast(p.x, p.y, p.ang);
  const win = spring({frame: f - 96, fps: 30, config: {damping: 11}});
  const shrink = interpolate(f, [100, 118], [1, 0.62], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const cta = spring({frame: f - 108, fps: 30, config: {damping: 13}});
  return (
    <AbsoluteFill>
      <Cap f={f} at={0} size={70}>اعثر على <span style={{color: '#28e66e'}}>الجدار الأخضر</span>…</Cap>
      <div style={{position: 'absolute', top: 260, left: '50%', transform: `translateX(-50%) scale(${shrink})`, transformOrigin: 'top center'}}>
        <View cols={cols} />
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 8}}>
          <div style={{fontFamily: 'sans-serif', fontWeight: 900, fontSize: 110, color: '#fff', letterSpacing: 4, transform: `scale(${win})`, opacity: win,
            textShadow: '0 0 30px #28e66e, 0 8px 0 #0a5a2a'}}>ESCAPED!</div>
        </div>
      </div>
      <AbsoluteFill><Mokaab frame={f + 300} scale={cta * 0.48} y={-0.7} mood="happy" wave={1} talk={speaking(LINES, f + B.outro)} rings={false} /></AbsoluteFill>
      <div style={{position: 'absolute', top: 1580, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, color: '#fff', direction: 'rtl', opacity: cta,
        transform: `translateY(${(1 - cta) * 40}px)`}}>
        <div style={{fontSize: 66}}>الملف مجاني: اكتب <span style={{color: SKY}}>«أريده»</span></div>
        <div style={{fontSize: 38, marginTop: 18, color: '#8a96c4', fontWeight: 700}}>أسرار Excel · الحلقة 4 · <span style={{direction: 'ltr', display: 'inline-block'}}>@tech3almashi</span></div>
      </div>
    </AbsoluteFill>
  );
};

export const Ep04Maze: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 25%, #16224a 0%, ${NIGHT} 70%)`, overflow: 'hidden'}}>
      {/* faint stars */}
      {Array.from({length: 40}, (_, i) => (
        <div key={i} style={{position: 'absolute', left: (i * 263) % 1080, top: (i * 451) % 1920, width: 3, height: 3, borderRadius: 2, background: '#cfe3ff',
          opacity: 0.15 + 0.25 * Math.abs(Math.sin(f / 20 + i))}} />
      ))}
      <Sequence durationInFrames={B.rays}><Walk /></Sequence>
      <Sequence from={B.rays} durationInFrames={B.depth - B.rays}><Rays /></Sequence>
      <Sequence from={B.depth} durationInFrames={B.outro - B.depth}><Depth /></Sequence>
      <Sequence from={B.outro}><Outro /></Sequence>
      {f < B.outro && (
        <AbsoluteFill><Mokaab frame={f} scale={0.3} y={-3.1} mood={f < 40 ? 'shock' : 'smirk'} lookX={0.6} talk={speaking(LINES, f)} rings={false} /></AbsoluteFill>
      )}
      <VoiceTrack lines={LINES} />
      {Array.from({length: 9}, (_, i) => <Sfx key={i} name="tick" at={i * 16} volume={0.3} />)}
      <Sfx name="whoosh" at={64} volume={0.4} />
      <Sfx name="whoosh" at={B.rays} volume={0.5} />
      {Array.from({length: 8}, (_, i) => <Sfx key={`r${i}`} name="blip" at={B.rays + 8 + i * 6} volume={0.35} />)}
      <Sfx name="whoosh" at={B.depth} volume={0.5} />
      <Sfx name="pop" at={B.depth + 6} volume={0.45} />
      <Sfx name="pop" at={B.depth + 22} volume={0.45} />
      <Sfx name="whoosh" at={B.outro} volume={0.45} />
      <Sfx name="ding" at={B.outro + 96} volume={0.55} />
      <Sfx name="pop" at={B.outro + 108} volume={0.5} />
    </AbsoluteFill>
  );
};
