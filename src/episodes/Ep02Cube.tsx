import React from 'react';
import {AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';

// Episode 2 of أسرار Excel: a wireframe 3D cube that spins using formulas only
// (8 corner points rotated with COS/SIN, drawn by an XY scatter chart, angle from a scroll-bar cell).

// measured, trimmed voice lengths in seconds (public/voice/excel02/<n>.wav)
const SEC = [2.24, 2.71, 2.61, 1.64, 1.69, 2.25];
const GAP = 8;
const starts: number[] = [];
SEC.forEach((s, i) => starts.push(i === 0 ? 6 : starts[i - 1] + Math.round(SEC[i - 1] * 30) + GAP));
const LINES: Line[] = SEC.map((s, i) => ({at: starts[i], dur: Math.round(s * 30), src: `voice/excel02/${i}.wav`}));

// scene boundaries follow the voice
const S_HOOK = 0;
const S_CODE = starts[1] - 4;
const S_TABLE = starts[2] - 4;
const S_CHART = starts[3] - 4;
const S_SPIN = starts[4] - 4;
const S_END = starts[5] - 4;
export const EP02_FRAMES = starts[5] + Math.round(SEC[5] * 30) + 30;

const BG1 = '#140c2e';
const BG2 = '#2b1660';
const CYAN = '#22d3ee';
const PINK = '#f472b6';
const LIME = '#a3e635';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// ---------- geometry: exactly what the sheet computes ----------
const PTS: [number, number, number][] = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
];
const EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
const TILT = 0.45; // radians, the fixed "camera" tilt cell
const project = (p: [number, number, number], t: number) => {
  const [x, y, z] = p;
  const x1 = x * Math.cos(t) - z * Math.sin(t);
  const z1 = x * Math.sin(t) + z * Math.cos(t);
  const y1 = y * Math.cos(TILT) - z1 * Math.sin(TILT);
  return [x1, y1] as [number, number];
};

// angle (radians) over the whole video: steady spin, then a "drag the slider" burst
const angleAt = (f: number) => {
  const base = f * 0.035;
  const burst = interpolate(f, [S_SPIN + 6, S_SPIN + 50], [0, Math.PI * 2], {...clamp, easing: Easing.inOut(Easing.cubic)});
  return base + burst;
};

// ---------- the chart card ----------
const Chart: React.FC<{f: number; size: number; drawLines?: number; dots?: number; glow?: number}> = ({f, size, drawLines = 1, dots = 0, glow = 0}) => {
  const t = angleAt(f);
  const P = PTS.map((p) => project(p, t));
  const sc = size * 0.26;
  const c = size / 2;
  const X = (v: number) => c + v * sc;
  const Y = (v: number) => c - v * sc;
  return (
    <div style={{width: size, height: size + 70, background: '#fbfbfe', borderRadius: 26, overflow: 'hidden',
      boxShadow: `0 30px 80px rgba(0,0,0,0.55), 0 0 ${60 * glow}px ${CYAN}`}}>
      <div style={{height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif',
        fontSize: 30, color: '#555', borderBottom: '2px solid #e5e5ee'}}>Chart 1 · XY (Scatter) with Straight Lines</div>
      <svg width={size} height={size}>
        {/* gridlines + axes like an Excel chart */}
        {[-3, -2, -1, 0, 1, 2, 3].map((g) => (
          <React.Fragment key={g}>
            <line x1={X(g * 0.5)} x2={X(g * 0.5)} y1={20} y2={size - 20} stroke={g === 0 ? '#9aa' : '#e6e6ef'} strokeWidth={g === 0 ? 3 : 2} />
            <line y1={Y(g * 0.5)} y2={Y(g * 0.5)} x1={20} x2={size - 20} stroke={g === 0 ? '#9aa' : '#e6e6ef'} strokeWidth={g === 0 ? 3 : 2} />
          </React.Fragment>
        ))}
        {EDGES.map(([a, b], i) => {
          const len = Math.hypot(X(P[a][0]) - X(P[b][0]), Y(P[a][1]) - Y(P[b][1]));
          const k = Math.max(0, Math.min(1, drawLines * EDGES.length - i));
          return (
            <line key={i} x1={X(P[a][0])} y1={Y(P[a][1])} x2={X(P[b][0])} y2={Y(P[b][1])}
              stroke={i < 4 ? PINK : i < 8 ? CYAN : '#7c3aed'} strokeWidth={10} strokeLinecap="round"
              strokeDasharray={len} strokeDashoffset={len * (1 - k)} />
          );
        })}
        {P.map((p, i) => {
          const s = Math.max(0, Math.min(1, dots * 8 - i));
          return <circle key={i} cx={X(p[0])} cy={Y(p[1])} r={16 * s} fill="#1e1b4b" stroke="white" strokeWidth={4} />;
        })}
      </svg>
    </div>
  );
};

const Caption: React.FC<{children: React.ReactNode; top?: number; p?: number; size?: number}> = ({children, top = 120, p = 1, size = 88}) => (
  <div style={{position: 'absolute', top, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: FONT,
    fontWeight: 900, fontSize: size, color: 'white', lineHeight: 1.25, opacity: p, transform: `translateY(${(1 - p) * 30}px)`,
    textShadow: '0 6px 24px rgba(0,0,0,0.5)', padding: '0 50px', boxSizing: 'border-box'}}>{children}</div>
);

// ---------- 1. hook: the cube is already spinning ----------
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const pop = spring({frame: f, fps: 30, config: {damping: 12}, from: 0.85});
  return (
    <AbsoluteFill>
      <Caption>مكعّب <span style={{color: CYAN}}>3D</span> يدور<br />داخل <span style={{color: LIME}}>Excel</span>؟!</Caption>
      <div style={{position: 'absolute', top: 400, left: 140, transform: `scale(${pop})`}}><Chart f={f} size={800} glow={0.6} /></div>
      <AbsoluteFill><Mokaab frame={f} scale={0.36} y={-2.95} mood="shock" talk={speaking(LINES, f)} lookX={0.5} /></AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- 2. no code ----------
const NoCode: React.FC = () => {
  const f = useCurrentFrame();
  const g = f + S_CODE;
  const strike = interpolate(f, [8, 20], [0, 1], clamp);
  const stamp = spring({frame: f - 22, fps: 30, config: {damping: 9}});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 470, left: 290, opacity: 0.35, transform: 'scale(0.6)', transformOrigin: 'top left'}}><Chart f={g} size={800} /></div>
      <div style={{position: 'absolute', top: 200, width: '100%', display: 'flex', justifyContent: 'center', gap: 40, direction: 'ltr'}}>
        {['VBA', 'Macro', 'Add-in'].map((w, i) => (
          <div key={w} style={{position: 'relative', fontFamily: 'monospace', fontSize: 64, color: '#c4b5fd', padding: '10px 26px',
            border: '4px solid #6d5bd0', borderRadius: 18, opacity: interpolate(f, [i * 3, i * 3 + 6], [0, 1], clamp)}}>
            {w}
            <div style={{position: 'absolute', left: -10, top: '50%', height: 10, width: `${strike * 112}%`, background: '#ef4444', borderRadius: 5, transform: 'rotate(-8deg)'}} />
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', top: 1180, width: '100%', textAlign: 'center', transform: `scale(${stamp}) rotate(-4deg)`}}>
        <span style={{fontFamily: FONT, fontWeight: 900, fontSize: 120, color: BG1, background: LIME, padding: '6px 60px', borderRadius: 30, direction: 'rtl'}}>معادلات فقط!</span>
      </div>
      <AbsoluteFill><Mokaab frame={g} scale={0.36} y={-2.95} mood="smirk" talk={speaking(LINES, g)} /></AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- 3. the table of 8 points with the rotation formula ----------
const Table: React.FC = () => {
  const f = useCurrentFrame();
  const g = f + S_TABLE;
  const t = angleAt(g);
  const typed = Math.floor(interpolate(f, [4, 40], [0, 1], clamp) * 26);
  const formula = '=B3*COS($H$1)-D3*SIN($H$1)'.slice(0, typed);
  const HEAD = ['2', 'x', 'y', 'z', "x'", "y'"];
  const colW = [70, 120, 120, 120, 170, 170];
  return (
    <AbsoluteFill>
      <Caption size={74}>8 نقاط تدور بـ <span style={{direction: 'ltr', display: 'inline-block'}}><span style={{color: PINK}}>COS</span> & <span style={{color: CYAN}}>SIN</span></span></Caption>
      <div style={{position: 'absolute', top: 330, left: 70, right: 70, background: 'white', borderRadius: 22, overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(0,0,0,0.5)', fontFamily: 'Consolas, monospace', direction: 'ltr'}}>
        <div style={{display: 'flex', alignItems: 'center', height: 76, borderBottom: '3px solid #ddd', fontSize: 34}}>
          <div style={{width: 110, textAlign: 'center', borderRight: '3px solid #ddd', color: '#333'}}>E3</div>
          <div style={{padding: '0 16px', color: '#999', fontStyle: 'italic'}}>fx</div>
          <div style={{color: '#1d4ed8', fontWeight: 700}}>{formula}<span style={{opacity: f % 16 < 8 ? 1 : 0}}>|</span></div>
        </div>
        <div style={{display: 'flex', background: '#f3f0ff', fontSize: 30, color: '#555', height: 52, alignItems: 'center'}}>
          {['', 'B', 'C', 'D', 'E', 'F'].map((h, i) => <div key={i} style={{width: colW[i], textAlign: 'center'}}>{h}</div>)}
          <div style={{flex: 1, textAlign: 'right', paddingRight: 20, color: '#6d28d9', fontWeight: 700, whiteSpace: 'nowrap', fontSize: 28}}>H1 θ = {(t % (2 * Math.PI)).toFixed(2)}</div>
        </div>
        {[HEAD, ...PTS.map((p) => p)].map((row, r) => {
          const pr = r === 0 ? null : project(PTS[r - 1], t);
          const cells = r === 0 ? ['2', ...HEAD.slice(1)] : ['' + (r + 2), ...PTS[r - 1].map(String), pr![0].toFixed(2), pr![1].toFixed(2)];
          const show = interpolate(f, [r * 2, r * 2 + 5], [0, 1], clamp);
          return (
            <div key={r} style={{display: 'flex', height: 64, alignItems: 'center', borderTop: '2px solid #eee', fontSize: 38, opacity: show,
              background: r === 1 ? 'rgba(34,211,238,0.12)' : 'transparent'}}>
              {cells.map((c, i) => (
                <div key={i} style={{width: colW[i], textAlign: 'center', color: i === 0 ? '#888' : r === 0 ? '#6d28d9' : i >= 4 ? '#be185d' : '#222',
                  fontWeight: r === 0 || i >= 4 ? 700 : 400, fontSize: i === 0 ? 28 : 38,
                  outline: r === 1 && i === 4 ? '5px solid #16a34a' : 'none', outlineOffset: -5}}>{c}</div>
              ))}
            </div>
          );
        })}
      </div>
      <AbsoluteFill><Mokaab frame={g} scale={0.36} y={-2.95} mood="happy" talk={speaking(LINES, g)} lookX={-0.6} /></AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- 4. the scatter chart joins them ----------
const Draw: React.FC = () => {
  const f = useCurrentFrame();
  const g = f + S_CHART;
  const dots = interpolate(f, [0, 14], [0, 1], clamp);
  const lines = interpolate(f, [12, 44], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Caption size={80}>مخطط <span style={{color: CYAN, direction: 'ltr', display: 'inline-block'}}>XY</span> يصلها</Caption>
      <div style={{position: 'absolute', top: 360, left: 140}}><Chart f={g} size={800} dots={dots} drawLines={lines} /></div>
      <AbsoluteFill><Mokaab frame={g} scale={0.36} y={-2.95} mood="happy" talk={speaking(LINES, g)} /></AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- 5. drag the angle ----------
const Spin: React.FC = () => {
  const f = useCurrentFrame();
  const g = f + S_SPIN;
  const knob = interpolate(f, [6, 50], [0.1, 0.92], {...clamp, easing: Easing.inOut(Easing.cubic)});
  return (
    <AbsoluteFill>
      <Caption size={84}>غيّر <span style={{color: LIME}}>الزاوية</span>...</Caption>
      <div style={{position: 'absolute', top: 320, left: 140}}><Chart f={g} size={800} glow={interpolate(f, [6, 30, 60], [0, 1, 0.4], clamp)} /></div>
      {/* scroll-bar form control linked to H1 */}
      <div style={{position: 'absolute', top: 1280, left: 140, width: 800, height: 70, background: '#e5e7eb', borderRadius: 12, border: '3px solid #9ca3af'}}>
        <div style={{position: 'absolute', left: knob * 720, top: 4, width: 80, height: 56, background: '#6d28d9', borderRadius: 10}} />
        <div style={{position: 'absolute', top: 84, width: '100%', textAlign: 'center', fontFamily: 'monospace', fontSize: 34, color: '#c4b5fd'}}>Scroll Bar → H1</div>
      </div>
      <AbsoluteFill><Mokaab frame={g} scale={0.32} y={-3.05} mood="shock" talk={speaking(LINES, g)} lookX={-0.3} /></AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- 6. CTA ----------
const End: React.FC = () => {
  const f = useCurrentFrame();
  const g = f + S_END;
  const a = spring({frame: f, fps: 30, config: {damping: 11}});
  const b = spring({frame: f - 14, fps: 30, config: {damping: 13}});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 140, left: 340, transform: 'scale(0.5)', transformOrigin: 'top left', opacity: 0.9}}><Chart f={g} size={800} /></div>
      <AbsoluteFill><Mokaab frame={g} scale={a * 0.62} y={-0.35} mood="happy" wave={1} talk={speaking(LINES, g)} /></AbsoluteFill>
      <div style={{position: 'absolute', top: 1330, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900}}>
        <div style={{fontSize: 96, color: 'white', transform: `scale(${a})`}}>جرّبها بنفسك 🔁</div>
        <div style={{marginTop: 26, display: 'inline-block', background: PINK, color: BG1, fontSize: 52, padding: '14px 46px', borderRadius: 60,
          opacity: b, transform: `scale(${0.8 + 0.2 * b})`}}>تابعنا للمزيد من أسرار Excel</div>
        <div style={{marginTop: 30, fontSize: 40, color: '#c4b5fd', opacity: b}}>تك عالماشي · خلّيك ذكي!</div>
      </div>
    </AbsoluteFill>
  );
};

export const Ep02Cube: React.FC = () => (
  <AbsoluteFill style={{background: `linear-gradient(160deg, ${BG2} 0%, ${BG1} 60%, #0a0618 100%)`}}>
    {/* faint isometric dots */}
    <AbsoluteFill style={{backgroundImage: 'radial-gradient(rgba(196,181,253,0.18) 2px, transparent 2px)', backgroundSize: '48px 48px'}} />
    <Sequence from={S_HOOK} durationInFrames={S_CODE}><Hook /></Sequence>
    <Sequence from={S_CODE} durationInFrames={S_TABLE - S_CODE}><NoCode /></Sequence>
    <Sequence from={S_TABLE} durationInFrames={S_CHART - S_TABLE}><Table /></Sequence>
    <Sequence from={S_CHART} durationInFrames={S_SPIN - S_CHART}><Draw /></Sequence>
    <Sequence from={S_SPIN} durationInFrames={S_END - S_SPIN}><Spin /></Sequence>
    <Sequence from={S_END} durationInFrames={EP02_FRAMES - S_END}><End /></Sequence>
    <VoiceTrack lines={LINES} />
    <Sfx name="whoosh" at={2} volume={0.5} />
    <Sfx name="buzz" at={S_CODE + 12} volume={0.45} />
    <Sfx name="pop" at={S_CODE + 24} volume={0.6} />
    {Array.from({length: 8}).map((_, i) => <Sfx key={i} name="tick" at={S_TABLE + 4 + i * 4} volume={0.4} />)}
    {Array.from({length: 6}).map((_, i) => <Sfx key={`d${i}`} name="blip" at={S_CHART + 12 + i * 5} volume={0.4} />)}
    <Sfx name="whoosh" at={S_SPIN + 8} volume={0.6} />
    <Sfx name="ding" at={S_END + 4} volume={0.55} />
  </AbsoluteFill>
);
