import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import TL from './Ep13Racer.timeline.json';
import {simulate, W, H, RL, LANES, LW, CW, CH, overlap} from './Ep13Racer.sim';

// Episode 13 of أسرار Excel: top-down traffic racer in cells (files/racing.xlsm, rules in files/racing.bas; the same rules
// run in Ep13Racer.sim.ts, so the video plays what the file plays).
// Look: NOT ep 12's side-scrolling dusk sky. A vertical road that fills the sheet, charcoal + racing red/white kerbs,
// tilted back in perspective like a racing game during the hook; real row numbers scroll down with the road.
// Reveal: the tilt flattens to a plain sheet, ×0.25 slow motion, collision boxes drawn around the cars, the 4-line loop.
// Outro: the sheet parks on the left at 42 %, the CTA stack on the right. No real car brands — plain cell cars.

type Word = {w: string; start: number; end: number};
type V = {src: string; at: number; sec: number; words: Word[]};
const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const B = TL.beats;
export const EP13_FRAMES = TL.frames;

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const XL = '#107c41', INK = '#121318', RED = '#ff3b4e', GOLD = '#ffd23c';

const START = 300, SLOW = 4;
const RUN = simulate(START + TL.frames + 10, 99);
const REPLAY_FROM = START + B.reveal - 30;
// game tick shown at video frame f
const tickAt = (f: number) =>
  f < B.reveal ? START + f : f < B.outro ? REPLAY_FROM + Math.floor((f - B.reveal) / SLOW) : START + B.reveal + (f - B.outro);

const CS = 36, GX = 72, GY = 306;
const colName = (n: number) => {let s = ''; n++; while (n > 0) {const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26);} return s;};

const Road: React.FC<{g: number; boxes: number}> = ({g, boxes}) => {
  const s = RUN[Math.min(g, RUN.length - 1)];
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < H; y++) {
    const sy = y - Math.floor(s.roadY) + 1080;
    for (let x = 0; x < W; x++) {
      let c: string, edge = '';
      if (x < RL - 1 || x > RL + LANES * LW) {
        c = (Math.floor(sy / 3) + x) % 5 === 0 ? '#289640' : '#32af46';
        if ((x === 0 || x === W - 1) && Math.floor(sy / 6) % 3 === 0) c = '#1e6e2d';
      } else if (x === RL - 1 || x === RL + LANES * LW) {
        c = Math.floor(sy / 2) % 2 === 0 ? '#e62828' : '#f5f5f5';
      } else {
        c = '#3e4048';
        if ((x - RL) % LW === 0 && x > RL && sy % 6 < 3) {c = '#f0f0f0'; edge = 'inset 0 0 0 8px #3e4048';}
      }
      cells.push(<div key={`${x}-${y}`} style={{position: 'absolute', left: x * CS, top: y * CS, width: CS, height: CS, background: c, boxShadow: edge}} />);
    }
  }
  const car = (cx: number, cy: number, body: string, player: boolean, key: string) => {
    const px: [number, number, string][] = [];
    for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) px.push([i, j, body]);
    px.push([1, 1, '#19233c'], [1, 3, '#3c465f'], [-1, 1, '#0f0f0f'], [CW, 1, '#0f0f0f'], [-1, 3, '#0f0f0f'], [CW, 3, '#0f0f0f']);
    if (player) px.push([0, 0, '#fffabe'], [2, 0, '#fffabe']); else px.push([0, CH - 1, '#ff2828'], [2, CH - 1, '#ff2828']);
    return px.filter(([i, j]) => cy + j >= 0 && cy + j < H).map(([i, j, c], k) => (
      <div key={`${key}${k}`} style={{position: 'absolute', left: (cx + i) * CS, top: (cy + j) * CS, width: CS, height: CS, background: c,
        boxShadow: c === body ? 'inset 0 -5px 0 rgba(0,0,0,.22), inset 4px 0 0 rgba(255,255,255,.18)' : 'none'}} />
    ));
  };
  // nearest car ahead of the player (for the collision boxes)
  const ahead = s.cars.filter((c) => c.on && c.y < s.py).sort((a, b) => b.y - a.y).slice(0, 2);
  const box = (x: number, y: number, col: string, label: string, k: string, left = false) => (
    <div key={k} style={{position: 'absolute', left: x * CS - 6, top: y * CS - 6, width: CW * CS + 12, height: CH * CS + 12, border: `5px dashed ${col}`, borderRadius: 6, opacity: boxes}}>
      <div style={{position: 'absolute', ...(left ? {left: -10, top: CH * CS + 16} : {left: CW * CS + 18, top: 8}), whiteSpace: 'nowrap', fontFamily: 'Consolas, monospace', fontWeight: 700, fontSize: 30, color: col,
        textShadow: `0 0 6px ${INK}, 0 0 3px ${INK}`, direction: 'ltr'}}>{label}</div>
    </div>
  );
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W * CS, height: H * CS, overflow: 'hidden'}}>
      {cells}
      {s.cars.filter((c) => c.on).map((c) => car(c.x, Math.floor(c.y), c.c, false, `t${c.id}-`))}
      {car(s.px, s.py, '#e61e32', true, 'p')}
      <div style={{position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.14) 1px, transparent 1px)',
        backgroundSize: `${CS}px ${CS}px`}} />
      {boxes > 0 && (
        <>
          {box(s.px, s.py, RED, 'px, py', 'bp', true)}
          {ahead.map((c) => box(c.x, Math.floor(c.y), '#ffffff', overlap(s.px, s.py, c.x, c.y) ? 'Overlap = True' : 'Overlap = False', `b${c.id}`))}
        </>
      )}
    </div>
  );
};

const CODE: {t: string; c: string; at: number}[] = [
  {t: 'speed = speed + 0.0009', c: '#dcdcaa', at: 0},
  {t: 'roadY = roadY + speed', c: '#9cdcfe', at: 18},
  {t: 'ty(i) = ty(i) + speed * 0.62', c: '#9cdcfe', at: 999},
  {t: 'If Overlap(px, py, tx(i), ty(i)) Then', c: '#c586c0', at: 72},
  {t: '    crashed = True', c: '#ff8080', at: 999},
];
const Editor: React.FC<{f: number}> = ({f}) => {
  const t = f - B.reveal;
  const chars = Math.max(0, (t - 4) * 8);
  let used = 0;
  return (
    <div style={{width: 1000, borderRadius: 16, overflow: 'hidden', background: '#1e1e1e', boxShadow: '0 30px 80px rgba(0,0,0,.7)', border: `3px solid ${RED}`}}>
      <div style={{height: 46, background: '#2b0d12', display: 'flex', alignItems: 'center', padding: '0 20px', fontFamily: 'Segoe UI, Arial', fontSize: 23, color: '#ffb3ba', fontWeight: 700, direction: 'ltr'}}>
        VBA — RacingGame · Do While running … Loop
      </div>
      <div style={{padding: '8px 24px', fontFamily: 'Consolas, monospace', fontSize: 31, lineHeight: '48px', direction: 'ltr'}}>
        {CODE.map((l, i) => {
          const show = Math.max(0, Math.min(l.t.length, chars - used));
          used += l.t.length;
          const on = t >= l.at + 20 && (i === 1 ? t < 72 : i === 3 || i === 4 ? t >= 92 : t < 40);
          const hl = i === 1 ? t >= 38 && t < 92 : i >= 3 ? t >= 92 : false;
          return (
            <div key={i} style={{display: 'flex', whiteSpace: 'pre', color: l.c, margin: '0 -10px', padding: '0 10px', borderRadius: 6,
              background: hl ? '#ff3b4e30' : 'transparent', outline: hl ? `3px solid ${RED}` : 'none', opacity: on || hl || t < 30 ? 1 : 0.75}}>
              <span style={{color: '#5a5a5a', width: 44, flexShrink: 0}}>{i + 1}</span><span>{l.t.slice(0, show)}</span>
            </div>
          );
        })}
      </div>
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
    <div dir="rtl" lang="ar" style={{position: 'absolute', top: 24, left: 30, right: 30, minHeight: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
      textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: ws.length > 7 ? 60 : 72, lineHeight: 1.3,
      opacity: interpolate(t, [-0.1, 0.05, line.sec + 0.15, line.sec + 0.35], [0, 1, 1, 0], clamp)}}>
      {ws.map((w, i) => {
        const said = t >= w.start;
        const on = said && t < (ws[i + 1]?.start ?? w.end + 0.3);
        const pop = on ? interpolate(t - w.start, [0, 0.06, 0.16], [1, 1.12, 1.04], clamp) : 1;
        return (
          <span key={i} dir={/[A-Za-z]/.test(w.w) ? 'ltr' : undefined} style={{display: 'inline-block', unicodeBidi: 'isolate', margin: '0 0.14em', scale: `${pop}`,
            color: on ? RED : said ? '#fff' : 'rgba(255,255,255,.4)', WebkitTextStroke: `10px ${INK}`, paintOrder: 'stroke fill'}}>{w.w}</span>
        );
      })}
    </div>
  );
};

const Gauge: React.FC<{g: number}> = ({g}) => {
  const s = RUN[Math.min(g, RUN.length - 1)];
  const kmh = Math.floor(s.speed * 100);
  const a = interpolate(s.speed, [0.45, 1.6], [-120, 120], clamp);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 26, direction: 'ltr'}}>
      <div style={{position: 'relative', width: 150, height: 150, borderRadius: 75, background: '#1d1f27', border: `5px solid ${RED}`}}>
        {Array.from({length: 9}, (_, i) => (
          <div key={i} style={{position: 'absolute', left: 72, top: 8, width: 6, height: 18, background: i > 6 ? RED : '#888', transformOrigin: '3px 67px', rotate: `${-120 + i * 30}deg`}} />
        ))}
        <div style={{position: 'absolute', left: 71, top: 14, width: 8, height: 62, borderRadius: 4, background: GOLD, transformOrigin: '4px 61px', rotate: `${a}deg`}} />
        <div style={{position: 'absolute', left: 63, top: 63, width: 24, height: 24, borderRadius: 12, background: '#fff'}} />
      </div>
      <div style={{fontFamily: 'Segoe UI, Arial', color: '#fff'}}>
        <div style={{fontSize: 24, fontWeight: 700, color: '#9aa0b4'}}>SPEED</div>
        <div style={{fontSize: 64, fontWeight: 900, lineHeight: 1}}>{kmh}<span style={{fontSize: 28, color: '#9aa0b4'}}> km/h</span></div>
      </div>
      <div style={{fontFamily: 'Segoe UI, Arial', color: '#fff', marginLeft: 20}}>
        <div style={{fontSize: 24, fontWeight: 700, color: '#9aa0b4'}}>SCORE</div>
        <div style={{fontSize: 64, fontWeight: 900, lineHeight: 1, color: GOLD}}>{s.score}</div>
      </div>
    </div>
  );
};

export const Ep13Racer: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const g = tickAt(frame);
  const s = RUN[Math.min(g, RUN.length - 1)];
  const reveal = frame >= B.reveal && frame < B.outro;
  const outro = frame >= B.outro;
  const so = spring({frame: frame - B.outro, fps, config: {damping: 16}});
  const ro = interpolate(frame, [B.reveal, B.reveal + 10, B.outro - 8, B.outro], [0, 1, 1, 0], clamp);
  // tilt: a racing-game perspective in the hook, flat sheet for the reveal, slight again in the outro
  const tilt = interpolate(frame, [0, B.reveal - 6, B.reveal + 8, B.outro, B.outro + 14], [15, 12, 0, 0, 8], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const sc = interpolate(so, [0, 1], [1, 0.42]);
  // near miss = a car passes right beside the player this frame
  const nearAt = (f: number) => {
    const a = RUN[tickAt(f)], b = RUN[Math.max(0, tickAt(f) - 1)];
    return a.cars.some((c) => c.on && Math.abs(c.x - a.px) <= CW + 2 && c.y > a.py - 1 && b.cars.find((d) => d.id === c.id && d.y <= b.py - 1));
  };
  const near: number[] = [];
  for (let f = 1; f < B.reveal; f++) if (nearAt(f) && (near.length === 0 || f - near[near.length - 1] > 10)) near.push(f);
  for (let f = B.outro + 1; f < TL.frames; f++) if (nearAt(f) && (near.length === 0 || f - near[near.length - 1] > 10)) near.push(f);
  const lastNear = near.filter((f) => f <= frame).pop() ?? -99;
  const shake = !reveal && frame - lastNear < 6 ? Math.sin((frame - lastNear) * 2.6) * (6 - (frame - lastNear)) * 2 : 0;
  const rows0 = Math.floor(s.dist);

  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 20%, #2a1218 0%, ${INK} 60%)`, overflow: 'hidden'}}>
      {/* the sheet: title bar, column letters, scrolling row numbers, the road */}
      <AbsoluteFill style={{transformOrigin: outro ? '40px 236px' : '540px 1750px', scale: `${sc}`, translate: `${shake}px ${outro ? so * 100 : 0}px`}}>
        <div style={{position: 'absolute', inset: 0, transformOrigin: '540px 1750px', transform: `perspective(1700px) rotateX(${tilt}deg)`}}>
          <div style={{position: 'absolute', left: 0, top: 236, width: 1080, height: 42, background: XL, display: 'flex', alignItems: 'center', padding: '0 18px', gap: 12,
            color: '#fff', fontFamily: 'Segoe UI, Arial', fontSize: 22, fontWeight: 700, direction: 'ltr'}}>
            <div style={{width: 26, height: 26, borderRadius: 5, background: '#fff', color: XL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900}}>X</div>
            racing.xlsm — Excel
            <div style={{marginLeft: 'auto', fontSize: 19, opacity: 0.9}}>TRAFFIC RACER</div>
          </div>
          <div style={{position: 'absolute', left: 0, top: 278, width: 1080, height: 28, background: '#e9eef5', borderBottom: '1px solid #c8c8c8'}}>
            {Array.from({length: W}, (_, i) => (
              <div key={i} style={{position: 'absolute', left: GX + i * CS, width: CS, top: 0, height: 28, lineHeight: '28px', textAlign: 'center', fontFamily: 'Segoe UI, Arial',
                fontSize: 15, color: '#666', borderRight: '1px solid #d4d4d4'}}>{colName(1 + i)}</div>
            ))}
          </div>
          <div style={{position: 'absolute', left: 0, top: GY, width: GX, height: H * CS, background: '#e9eef5', overflow: 'hidden', borderRight: '1px solid #c8c8c8'}}>
            {Array.from({length: H + 1}, (_, i) => {
              // row numbers ride with the road: the sheet itself is moving down
              const yy = i * CS + ((s.dist % 1) * CS);
              return <div key={i} style={{position: 'absolute', left: 0, width: GX, top: yy - CS, height: CS, lineHeight: `${CS}px`, textAlign: 'center', fontFamily: 'Segoe UI, Arial',
                fontSize: 15, color: reveal ? XL : '#666', fontWeight: reveal ? 700 : 400, borderBottom: '1px solid #d4d4d4'}}>{i - rows0 + 1000}</div>;
            })}
          </div>
          <div style={{position: 'absolute', left: GX, top: GY, width: W * CS, height: H * CS}}>
            <Road g={g} boxes={ro} />
          </div>
          {/* night falloff toward the horizon while tilted */}
          <div style={{position: 'absolute', left: 0, top: 236, width: 1080, height: 520, background: `linear-gradient(${INK}, transparent)`, opacity: tilt / 30}} />
        </div>
      </AbsoluteFill>

      {!outro && (
        <div style={{position: 'absolute', left: 44, top: 1756, opacity: 1 - ro}}><Gauge g={g} /></div>
      )}
      {ro > 0 && (
        <>
          <div style={{position: 'absolute', right: 34, top: 1176, fontFamily: 'Segoe UI, Arial', fontWeight: 900, fontSize: 38, color: '#fff', background: RED, borderRadius: 12,
            padding: '2px 18px', opacity: ro, direction: 'ltr'}}>SLOW ×0.25</div>
          <div style={{position: 'absolute', left: 40, top: 300, opacity: ro, translate: `0 ${(1 - ro) * -200}px`}}><Editor f={frame} /></div>
        </>
      )}

      {outro && (
        <div dir="rtl" style={{position: 'absolute', top: 330, right: 36, width: 560, textAlign: 'center', fontFamily: FONT, fontWeight: 900, opacity: so, translate: `${(1 - so) * 120}px 0`}}>
          <div style={{background: '#fff', borderRadius: 26, padding: '18px 20px', boxShadow: '0 20px 60px rgba(255,59,78,.35)', border: `5px solid ${RED}`}}>
            <div style={{fontSize: 30, color: XL, fontFamily: 'Segoe UI, Arial', fontWeight: 900, direction: 'ltr'}}>racing.xlsm</div>
            <div style={{fontSize: 62, color: INK, lineHeight: 1.25}}>اكتب «أريده» 📥</div>
            <div style={{fontSize: 28, color: '#555', fontWeight: 700}}>الملف مجاني · ويندوز</div>
          </div>
          <div style={{fontSize: 33, color: INK, background: GOLD, borderRadius: 24, padding: '8px 18px', marginTop: 26,
            opacity: interpolate(frame, [B.outro + 46, B.outro + 56], [0, 1], clamp), scale: `${interpolate(frame, [B.outro + 46, B.outro + 52, B.outro + 58], [0.8, 1.06, 1], clamp)}`}}>🔔 اشترك لتصلك اللعبة التالية</div>
          <div style={{fontSize: 40, color: '#fff', border: `3px solid ${RED}`, borderRadius: 24, padding: '8px 16px', marginTop: 24, lineHeight: 1.35,
            opacity: interpolate(frame, [B.next - 2, B.next + 8], [0, 1], clamp), translate: `0 ${interpolate(frame, [B.next - 2, B.next + 8], [24, 0], clamp)}px`}}>الحلقة القادمة: لعبةٌ لن تهزمَ فيها Excel ⭕</div>
        </div>
      )}

      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', translate: outro ? '270px 600px' : '400px 760px',
        opacity: frame < 20 || ro > 0.05 ? 0 : interpolate(frame, [20, 32], [0, 1], clamp)}}>
        <Mokaab frame={frame} scale={outro ? 0.2 : 0.15} y={0} mood={outro ? 'happy' : 'shock'} wave={outro ? 1 : 0} lookX={-0.5} talk={speaking(LINES, frame)} rings={false} />
      </div>

      {VOICE.map((v) => <Caption key={v.src} line={v} />)}
      {outro && (
        <div dir="rtl" style={{position: 'absolute', bottom: 70, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 30, color: '#c9cbd6'}}>
          أسرار Excel · الحلقة 13 · تك عالماشي · خلّيك ذكي!
        </div>
      )}

      <VoiceTrack lines={LINES} />
      {near.map((f) => <Sfx key={`n${f}`} name="whoosh" at={f} volume={0.4} />)}
      <Sfx name="whoosh" at={B.reveal} volume={0.5} />
      <Sfx name="ding" at={B.reveal + 38} volume={0.5} />
      <Sfx name="buzz" at={B.reveal + 92} volume={0.4} />
      <Sfx name="pop" at={B.outro + 2} volume={0.45} />
      <Sfx name="ding" at={B.outro + 46} volume={0.4} />
    </AbsoluteFill>
  );
};
