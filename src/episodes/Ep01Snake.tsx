import React from 'react';
import {AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {BG, FONT, GREEN, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// ---------- deterministic snake simulation ----------
const W = 16, H = 18;
type P = [number, number];
type State = {body: P[]; apple: P; score: number; dead: boolean};

const simulate = (steps: number): State[] => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  let body: P[] = [[5, 9], [4, 9], [3, 9]];
  const free = (p: P, b: P[]) => p[0] >= 0 && p[0] < W && p[1] >= 0 && p[1] < H && !b.some((q) => q[0] === p[0] && q[1] === p[1]);
  const newApple = (b: P[]): P => {
    for (;;) {
      const a: P = [Math.floor(rnd() * W), Math.floor(rnd() * H)];
      if (free(a, b)) return a;
    }
  };
  let apple = newApple(body);
  let score = 0;
  const out: State[] = [{body, apple, score, dead: false}];
  const dirs: P[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (let s = 0; s < steps; s++) {
    const head = body[0];
    const opts = dirs
      .map((d) => [head[0] + d[0], head[1] + d[1]] as P)
      .filter((p) => free(p, body.slice(0, -1)))
      .map((p) => {
        const nb = [p, ...body.slice(0, -1)];
        const room = dirs.filter((d) => free([p[0] + d[0], p[1] + d[1]], nb)).length;
        return {p, score: Math.abs(p[0] - apple[0]) + Math.abs(p[1] - apple[1]) - room * 0.6};
      })
      .sort((a, b) => a.score - b.score);
    if (!opts.length) break;
    const next = opts[0].p;
    const ate = next[0] === apple[0] && next[1] === apple[1];
    body = [next, ...(ate ? body : body.slice(0, -1))];
    if (ate) {
      score += 1;
      apple = newApple(body);
    }
    out.push({body, apple, score, dead: false});
  }
  return out;
};
const STATES = simulate(90);
const STEP = 3; // frames per move -> 10 moves/sec

// ---------- the fake-but-faithful Excel window ----------
const CELL = 58, HDR_W = 52, HDR_H = 40;
const COLS = 'ABCDEFGHIJKLMNOP'.split('');

const ExcelWindow: React.FC<{state: State; pulse: number}> = ({state, pulse}) => {
  const lookup = new Map<string, number>();
  state.body.forEach((p, i) => lookup.set(`${p[0]},${p[1]}`, i));
  return (
    <div style={{width: HDR_W + CELL * W, borderRadius: 18, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.6)', background: '#fff'}}>
      <div style={{height: 64, background: '#1d6f42', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14}}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <div key={c} style={{width: 20, height: 20, borderRadius: 10, background: c}} />
        ))}
        <div style={{flex: 1, textAlign: 'center', color: 'white', fontFamily: 'sans-serif', fontWeight: 700, fontSize: 30}}>
          snake.xlsm
        </div>
      </div>
      <div style={{height: 60, display: 'flex', alignItems: 'center', borderBottom: '2px solid #d6d6d6', fontFamily: 'sans-serif', fontSize: 30, color: '#333'}}>
        <div style={{width: 120, textAlign: 'center', borderRight: '2px solid #d6d6d6'}}>Q1</div>
        <div style={{padding: '0 18px', fontStyle: 'italic', color: '#888'}}>fx</div>
        <div style={{fontFamily: 'monospace'}}>
          =SCORE() → <b style={{color: '#1d6f42', fontSize: 34 + pulse * 10}}>{state.score}</b>
        </div>
      </div>
      <div style={{display: 'flex', background: '#f3f3f3', height: HDR_H}}>
        <div style={{width: HDR_W}} />
        {COLS.map((c) => (
          <div key={c} style={{width: CELL, textAlign: 'center', lineHeight: `${HDR_H}px`, fontFamily: 'sans-serif', fontSize: 22, color: '#666', borderLeft: '1px solid #ddd'}}>{c}</div>
        ))}
      </div>
      {Array.from({length: H}).map((_, y) => (
        <div key={y} style={{display: 'flex'}}>
          <div style={{width: HDR_W, height: CELL, background: '#f3f3f3', textAlign: 'center', lineHeight: `${CELL}px`, fontFamily: 'sans-serif', fontSize: 20, color: '#666', borderTop: '1px solid #ddd'}}>{y + 1}</div>
          {Array.from({length: W}).map((__, x) => {
            const idx = lookup.get(`${x},${y}`);
            const isApple = state.apple[0] === x && state.apple[1] === y;
            let bg = '#fff';
            if (idx !== undefined) bg = idx === 0 ? '#0e7a3d' : idx % 2 ? GREEN : '#1bb05f';
            if (isApple) bg = '#e5383b';
            return (
              <div key={x} style={{width: CELL, height: CELL, boxSizing: 'border-box', background: bg,
                borderTop: '1px solid #e2e2e2', borderLeft: '1px solid #e2e2e2', position: 'relative',
                borderRadius: isApple ? 14 : 0, outline: idx === 0 ? '3px solid #0b5c2e' : undefined, outlineOffset: -3}}>
                {idx === 0 && (
                  <>
                    <div style={{position: 'absolute', top: 14, left: 12, width: 11, height: 11, borderRadius: 6, background: 'white'}} />
                    <div style={{position: 'absolute', top: 14, right: 12, width: 11, height: 11, borderRadius: 6, background: 'white'}} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ---------- 1. The game (hook is the game itself) ----------
const Game: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const i = Math.min(STATES.length - 1, Math.floor(f / STEP));
  const state = STATES[i];
  const prevScore = i > 0 ? STATES[i - 1].score : 0;
  const pulse = state.score > prevScore ? 1 : 0;
  const winIn = spring({frame: f, fps, config: {damping: 14}});
  const mk = spring({frame: f - 10, fps, config: {damping: 10}});

  const caps: [number, string][] = [[0, 'هيدا... Excel؟؟'], [75, 'مش فيديو. لعبة حقيقية'], [150, 'كل خلية = بكسل']];
  const cap = [...caps].reverse().find(([t]) => f >= t)!;
  const capIn = interpolate(f - cap[0], [0, 8], [0, 1], clamp);

  return (
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 120, width: '100%', textAlign: 'center', direction: 'rtl',
        fontFamily: FONT, fontWeight: 900, fontSize: 88, color: 'white', opacity: capIn,
        transform: `translateY(${(1 - capIn) * 25}px)`}}>{cap[1]}</div>
      <div style={{position: 'absolute', top: 290, transform: `scale(${0.92 * winIn})`, transformOrigin: 'top center'}}>
        <ExcelWindow state={state} pulse={pulse} />
      </div>
      <AbsoluteFill>
        <Mokaab frame={f} scale={mk * 0.4} y={-2.8} mood={f < 120 ? 'shock' : 'happy'} lookX={Math.sin(f / 12)} talk={f < 120 ? 1 : 0} wave={f >= 120 ? 1 : 0} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- 2. The reveal: it's just VBA ----------
const CODE = [
  'Sub Snake()',
  '  Do While Alive',
  '    MoveHead dx, dy',
  '    If Cells(y, x) = Apple Then Grow',
  '    Cells(y, x).Interior.Color = vbGreen',
  '    DoEvents: Sleep 100',
  '  Loop',
  'End Sub',
];
const Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: f, fps, config: {damping: 14}});
  return (
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 220, fontFamily: FONT, fontWeight: 900, fontSize: 88, color: 'white', direction: 'rtl', opacity: p}}>
        السر؟ شوية <span style={{color: GREEN}}>VBA</span>
      </div>
      <div style={{position: 'absolute', top: 470, width: 940, background: '#0f1a15', border: `3px solid #24352c`,
        borderRadius: 24, padding: '40px 44px', transform: `scale(${0.9 + 0.1 * p})`, opacity: p, direction: 'ltr'}}>
        {CODE.map((line, i) => {
          const o = interpolate(f, [6 + i * 6, 12 + i * 6], [0, 1], clamp);
          const kw = /^(\s*)(Sub|Do While|If|Loop|End Sub|DoEvents)/.exec(line);
          return (
            <div key={i} style={{fontFamily: 'monospace', fontSize: 33, lineHeight: 1.75, color: '#d6efe0', opacity: o, whiteSpace: 'pre'}}>
              {kw ? (<>{kw[1]}<span style={{color: GREEN, fontWeight: 700}}>{kw[2]}</span>{line.slice(kw[0].length)}</>) : line}
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', top: 1260, fontFamily: FONT, fontWeight: 700, fontSize: 56, color: '#9fb8ab', direction: 'rtl',
        opacity: interpolate(f, [55, 65], [0, 1], clamp)}}>
        لوب بيلوّن الخلايا 10 مرات بالثانية
      </div>
    </AbsoluteFill>
  );
};

// ---------- 3. Outro / CTA ----------
const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = spring({frame: f, fps, config: {damping: 11}});
  const b = spring({frame: f - 14, fps, config: {damping: 13}});
  return (
    <AbsoluteFill>
      <AbsoluteFill><Mokaab frame={f} scale={a * 0.72} y={1.45} mood="smirk" wave={1} wink={interpolate(f, [30, 34, 42, 46], [0, 1, 1, 0], clamp)} /></AbsoluteFill>
      <div style={{position: 'absolute', top: 1080, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, color: 'white', direction: 'rtl'}}>
        <div style={{fontSize: 96, transform: `scale(${a})`}}>بدك الملف؟</div>
        <div style={{fontSize: 66, marginTop: 30, opacity: b, transform: `translateY(${(1 - b) * 40}px)`}}>
          اكتب <span style={{color: GREEN}}>«بدي»</span> بالكومنتات
        </div>
        <div style={{fontSize: 40, marginTop: 70, color: '#9fb8ab', fontWeight: 700, opacity: b}}>أسرار Excel · الحلقة 1</div>
        <div style={{fontSize: 44, marginTop: 14, color: '#ffffff', fontWeight: 900, direction: 'ltr', opacity: b}}>@tech3almashi</div>
      </div>
    </AbsoluteFill>
  );
};

export const EP01_FRAMES = 240 + 90 + 80;

const EAT_FRAMES = STATES.map((s, i) => (i > 0 && s.score > STATES[i - 1].score ? i * STEP : -1)).filter((x) => x >= 0 && x < 240);

export const Ep01Snake: React.FC = () => (
  <AbsoluteFill style={{background: `radial-gradient(circle at 50% 35%, #12261c 0%, ${BG} 70%)`}}>
    <Sequence durationInFrames={240}><Game /></Sequence>
    <Sequence from={240} durationInFrames={90}><Reveal /></Sequence>
    <Sequence from={330} durationInFrames={80}><Outro /></Sequence>
    {EAT_FRAMES.map((f) => <Sfx key={f} name="blip" at={f} />)}
    <Sfx name="whoosh" at={240} />
    {CODE.map((_, i) => <Sfx key={`t${i}`} name="tick" at={246 + i * 6} />)}
    <Sfx name="whoosh" at={328} />
    <Sfx name="pop" at={332} />
  </AbsoluteFill>
);


