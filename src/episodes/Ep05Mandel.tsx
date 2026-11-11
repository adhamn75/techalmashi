import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import TL from './Ep05Mandel.timeline.json';

// Episode 5 of أسرار Excel: the Mandelbrot fractal drawn in cells, double-click to dive in.
// The renderer below is the same loop and palette as files/mandelbrot.bas (120 x 160 cells, z = z² + c,
// colour = escape step), so every frame is what the sheet shows. Look: light Excel window on graphite,
// fractal "ice and fire" colours, Excel-green selection; a deep zoom instead of a game.

type Word = {w: string; start: number; end: number};
type V = {src: string; at: number; sec: number; words: Word[]};
const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const B = TL.beats;
export const EP05_FRAMES = TL.frames;

const GRAPHITE = '#16181d';
const XL = '#107c41';
const FIRE = '#ffb347';
const ICE = '#5aa9ff';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// ---------- the fractal (mirror of mandelbrot.bas) ----------
const GW = 120, GH = 160;
const PAL: [number, number, number][] = Array.from({length: 64}, (_, i) => {
  const t = i / 64;
  const r = Math.max(0, Math.min(255, 9 * (1 - t) * t ** 3 * 255 + 40 * Math.sin(t * 6.283)));
  const g = Math.min(255, 15 * (1 - t) ** 2 * t * t * 255);
  const b = Math.min(255, 8.5 * (1 - t) ** 3 * t * 255);
  return [Math.round(r), Math.round(g), Math.round(b)];
});
const maxIter = (w: number) => Math.max(100, 100 + Math.round((40 * Math.log(3.2 / w)) / Math.log(3)));
const escape = (x: number, y: number, mi: number) => {
  let zx = 0, zy = 0, zx2 = 0, zy2 = 0, n = 0;
  while (n < mi && zx2 + zy2 <= 4) {
    zy = 2 * zx * zy + y;
    zx = zx2 - zy2 + x;
    zx2 = zx * zx;
    zy2 = zy * zy;
    n++;
  }
  return n;
};
const cellColor = (n: number, mi: number) => (n >= mi ? [0, 0, 0] : PAL[(n * 2) % 64]);
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

// zoom path: start view -> Seahorse Valley
const START = {cx: -0.6, cy: 0, w: 3.2};
const DEEP = {cx: -0.743643887, cy: 0.131825904, w: 3.2 / 3 ** 6};

const Fractal: React.FC<{cx: number; cy: number; w: number; cell: number; grid?: number}> = ({cx, cy, w, cell, grid = 0}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(GW, GH);
    const px = w / GW, h = px * GH, mi = maxIter(w);
    for (let r = 0; r < GH; r++) {
      const y = cy + h / 2 - (r + 0.5) * px;
      for (let c = 0; c < GW; c++) {
        const x = cx - w / 2 + (c + 0.5) * px;
        const col = cellColor(escape(x, y, mi), mi);
        const k = (r * GW + c) * 4;
        img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [cx, cy, w]);
  return (
    <div style={{position: 'relative', width: GW * cell, height: GH * cell}}>
      <canvas ref={ref} width={GW} height={GH} style={{width: GW * cell, height: GH * cell, imageRendering: 'pixelated', display: 'block'}} />
      {grid > 0 && (
        <div style={{position: 'absolute', inset: 0, opacity: grid,
          backgroundImage: `linear-gradient(to right, rgba(0,0,0,.55) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.55) 1px, transparent 1px)`,
          backgroundSize: `${cell}px ${cell}px`}} />
      )}
    </div>
  );
};

// ---------- word-by-word captions (Arabic: whole words, dir rtl, letters stay joined) ----------
const Caption: React.FC<{line: V; top: number; accent: string}> = ({line, top, accent}) => {
  const frame = useCurrentFrame();
  const t = (frame - line.at) / 30;
  if (t < -0.1 || t > line.sec + 0.5) return null;
  return (
    <div dir="rtl" lang="ar" style={{position: 'absolute', top, left: 50, right: 50, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 72, lineHeight: 1.4,
      opacity: interpolate(t, [line.sec + 0.2, line.sec + 0.5], [1, 0], clamp)}}>
      {line.words.map((w, i) => {
        const said = t >= w.start;
        const on = said && t < (line.words[i + 1]?.start ?? w.end + 0.3);
        return (
          <span key={i} style={{display: 'inline-block', margin: '0 0.18em', color: on ? accent : said ? '#fff' : 'rgba(255,255,255,.25)',
            translate: `0 ${said ? 0 : 12}px`, scale: on ? '1.08' : '1', textShadow: on ? `0 0 30px ${accent}` : '0 4px 16px rgba(0,0,0,.7)'}}>{w.w}</span>
        );
      })}
    </div>
  );
};

// ---------- Excel window chrome ----------
const CELL = 7;
const COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const Window: React.FC<{children: React.ReactNode; formula: string; name: string}> = ({children, formula, name}) => (
  <div style={{width: GW * CELL + 44, background: '#f3f3f3', borderRadius: 18, overflow: 'hidden', boxShadow: '0 40px 120px rgba(0,0,0,.6)'}}>
    <div style={{height: 54, background: XL, display: 'flex', alignItems: 'center', padding: '0 22px', gap: 14, color: '#fff', fontFamily: 'Segoe UI, Arial', fontWeight: 700, fontSize: 26}}>
      <div style={{width: 34, height: 34, borderRadius: 6, background: '#fff', color: XL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900}}>X</div>
      mandelbrot.xlsm
    </div>
    <div style={{height: 50, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', borderBottom: '1px solid #d0d0d0', fontFamily: 'Consolas, monospace', fontSize: 24, color: '#222', direction: 'ltr'}}>
      <div style={{width: 110, border: '1px solid #c8c8c8', background: '#fff', padding: '2px 8px'}}>{name}</div>
      <div style={{color: '#888', fontStyle: 'italic'}}>fx</div>
      <div style={{flex: 1, border: '1px solid #c8c8c8', background: '#fff', padding: '2px 8px', whiteSpace: 'nowrap', overflow: 'hidden'}}>{formula}</div>
    </div>
    <div style={{display: 'flex', direction: 'ltr'}}>
      <div style={{width: 44, background: '#e9e9e9'}} />
      <div style={{flex: 1, height: 26, background: '#e9e9e9', display: 'flex', fontFamily: 'Segoe UI, Arial', fontSize: 15, color: '#666'}}>
        {Array.from({length: 30}, (_, i) => <div key={i} style={{width: CELL * 4, textAlign: 'center'}}>{i < 26 ? COLS[i] : 'A' + COLS[i - 26]}</div>)}
      </div>
    </div>
    <div style={{display: 'flex', direction: 'ltr'}}>
      <div style={{width: 44, background: '#e9e9e9', fontFamily: 'Segoe UI, Arial', fontSize: 13, color: '#777', textAlign: 'center'}}>
        {Array.from({length: 40}, (_, i) => <div key={i} style={{height: CELL * 4, lineHeight: `${CELL * 4}px`}}>{i * 4 + 3}</div>)}
      </div>
      {children}
    </div>
  </div>
);

// ---------- the orbit of one cell: z -> z² + c ----------
const Orbit: React.FC<{c: [number, number]; steps: number; color: string}> = ({c, steps, color}) => {
  const pts: [number, number][] = [];
  let zx = 0, zy = 0;
  for (let i = 0; i < steps; i++) {
    const nx = zx * zx - zy * zy + c[0];
    zy = 2 * zx * zy + c[1];
    zx = nx;
    pts.push([zx, zy]);
    if (zx * zx + zy * zy > 16) break;
  }
  const S = 120; // px per unit
  const P = (p: [number, number]) => `${300 + Math.max(-2.4, Math.min(2.4, p[0])) * S},${300 - Math.max(-2.4, Math.min(2.4, p[1])) * S}`;
  return (
    <svg width={600} height={600} viewBox="0 0 600 600">
      <circle cx={300} cy={300} r={2 * S} fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.5)" strokeWidth={3} strokeDasharray="10 10" />
      <line x1={0} y1={300} x2={600} y2={300} stroke="rgba(255,255,255,.15)" strokeWidth={2} />
      <line x1={300} y1={0} x2={300} y2={600} stroke="rgba(255,255,255,.15)" strokeWidth={2} />
      <text x={300 + 2 * S + 8} y={290} fill="rgba(255,255,255,.6)" fontSize={28} fontFamily="Consolas, monospace">|z|=2</text>
      <polyline points={pts.map(P).join(' ')} fill="none" stroke={color} strokeWidth={3} opacity={0.8} />
      {pts.map((p, i) => <circle key={i} cx={P(p).split(',')[0]} cy={P(p).split(',')[1]} r={i === pts.length - 1 ? 12 : 5} fill={i === pts.length - 1 ? '#fff' : color} />)}
    </svg>
  );
};

export const Ep05Mandel: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // view: slow dive during the hook, back to the full set for the explanation, deep dive on "double-click"
  const hookZ = interpolate(frame, [0, B.iterate], [1.6, 0], clamp);
  const dive = interpolate(frame, [B.dive + 24, B.outro + 40], [0, 1], {...clamp, easing: Easing.bezier(0.45, 0, 0.55, 1)});
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const z = frame < B.dive ? hookZ : dive * 6; // powers of 3
  const tgt = frame < B.dive ? {cx: -0.7453, cy: 0.1127} : DEEP;
  const k = frame < B.dive ? Math.min(1, hookZ / 1.6) : Math.min(1, dive * 3);
  const view = {cx: lerp(START.cx, tgt.cx, k), cy: lerp(START.cy, tgt.cy, k), w: 3.2 / 3 ** z};

  // camera on the window: starts pushed into the cells (hook), pulls out to reveal Excel
  const reveal = interpolate(frame, [B.reveal - 20, B.reveal + 20], [0, 1], {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)});
  const camScale = lerp(2.3, 1, reveal);
  const explain = frame >= B.iterate && frame < B.dive;
  const winScale = explain ? interpolate(frame, [B.iterate, B.iterate + 14], [1, 0.52], {...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1)})
    : frame >= B.dive ? interpolate(frame, [B.dive, B.dive + 14], [0.52, 1], {...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1)}) : 1;
  const outro = frame >= B.outro;
  const winY = outro ? interpolate(frame, [B.outro, B.outro + 20], [0, -220], clamp) : 0;
  const outroS = outro ? interpolate(frame, [B.outro, B.outro + 20], [1, 0.85], clamp) : 1;

  // the two demo cells: one inside (never escapes), one outside (escapes)
  const inside: [number, number] = [-0.12, 0.6];
  const outside: [number, number] = [-0.745, 0.155];
  const escN = escape(outside[0], outside[1], 100);
  const iterSteps = Math.round(interpolate(frame, [B.iterate + 16, B.escape - 14], [1, 100], clamp));
  const escSteps = Math.round(interpolate(frame, [B.escape + 6, B.escape + 50], [1, escN], clamp));
  const isEscape = frame >= B.escape;
  const steps = isEscape ? escSteps : iterSteps;
  const demoC = isEscape ? outside : inside;
  const doneColor = isEscape && escSteps >= escN ? rgb(cellColor(escN, 100)) : isEscape ? FIRE : '#000';
  const panel = spring({frame: frame - B.iterate - 6, fps, config: {damping: 14}});

  // double-click cursor
  const clickA = interpolate(frame, [B.dive + 4, B.dive + 10, B.dive + 14, B.dive + 20], [0, 1, 0, 1], clamp);
  const zoomLabel = Math.round(3 ** z);

  const formula = explain
    ? (isEscape ? `n = ${steps}  →  colour #${(steps * 2) % 64}` : `z = z² + c   (step ${steps} / 100)`)
    : `x=${view.cx.toFixed(6)} y=${view.cy.toFixed(6)} zoom x${zoomLabel.toLocaleString('en-US')}`;

  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 50% 40%, #262a33 0%, ${GRAPHITE} 70%)`, overflow: 'hidden'}}>
      {/* the sheet */}
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div style={{scale: `${camScale * winScale * outroS}`, translate: `${explain ? -0 : 0}px ${(explain ? -330 : -40) * (explain ? 1 : 1) + winY}px`, transformOrigin: '50% 50%'}}>
          <Window formula={formula} name={explain ? 'BQ41' : 'B3'}>
            <div style={{position: 'relative'}}>
              <Fractal {...view} cell={CELL} grid={reveal * 0.9} />
              {explain && (
                <div style={{position: 'absolute', left: ((demoC[0] - (START.cx - START.w / 2)) / (START.w / GW)) * CELL, top: ((START.w / GW * GH) / 2 - (demoC[1] - START.cy)) / (START.w / GW) * CELL,
                  width: CELL * 5, height: CELL * 5, border: `5px solid ${XL}`, boxShadow: '0 0 0 3px #fff, 0 0 30px #fff', translate: '-50% -50%'}} />
              )}
            </div>
          </Window>
        </div>
      </AbsoluteFill>

      {/* hook stamp */}
      {frame < B.iterate && (
        <div dir="rtl" style={{position: 'absolute', top: 70, left: 200, right: 20, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 62, color: '#fff',
          opacity: interpolate(frame, [B.reveal, B.reveal + 12], [0, 1], clamp), textShadow: '0 6px 24px rgba(0,0,0,.8)'}}>
          ١٩٢٠٠ خلية = <span style={{color: FIRE}}>لوحة واحدة</span>
        </div>
      )}

      {/* explanation panel: one cell, one equation */}
      {explain && (
        <div style={{position: 'absolute', top: 985, left: 60, right: 60, height: 570, borderRadius: 40, background: 'rgba(10,12,16,.92)', border: '2px solid #333',
          scale: `${panel}`, display: 'flex', alignItems: 'center', gap: 20, padding: 20, direction: 'ltr'}}>
          <Orbit c={demoC} steps={steps} color={isEscape ? FIRE : ICE} />
          <div style={{flex: 1, textAlign: 'center', fontFamily: 'Consolas, monospace', color: '#fff'}}>
            <div style={{fontSize: 46, fontWeight: 700, whiteSpace: 'nowrap'}}>z → z² + c</div>
            <div style={{fontSize: 120, fontWeight: 700, color: isEscape ? FIRE : ICE, marginTop: 10}}>{steps}</div>
            <div style={{fontSize: 30, color: '#999'}}>{isEscape ? 'escaped at step' : 'steps / 100'}</div>
            <div style={{width: 120, height: 120, margin: '24px auto 0', background: doneColor, border: `6px solid ${XL}`, boxShadow: '0 0 0 3px #fff'}} />
            {isEscape && (
              <div style={{display: 'flex', height: 26, marginTop: 22, borderRadius: 6, overflow: 'hidden'}}>
                {PAL.map((c, i) => <div key={i} style={{flex: 1, background: rgb(c), outline: i === (escSteps * 2) % 64 ? '3px solid #fff' : 'none'}} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* double-click + zoom counter */}
      {frame >= B.dive && frame < B.outro && (
        <>
          <div style={{position: 'absolute', left: 520, top: 760, fontSize: 110, opacity: interpolate(frame, [B.dive, B.dive + 6, B.dive + 40, B.dive + 50], [0, 1, 1, 0], clamp),
            scale: `${1 - clickA * 0.15}`, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.7))'}}>🖱️</div>
          <div style={{position: 'absolute', top: 60, width: '100%', textAlign: 'center', fontFamily: 'Consolas, monospace', fontWeight: 700, fontSize: 86, color: FIRE,
            textShadow: '0 0 30px rgba(255,140,40,.7)', direction: 'ltr', opacity: interpolate(frame, [B.dive + 20, B.dive + 30], [0, 1], clamp)}}>
            zoom ×{zoomLabel.toLocaleString('en-US')}
          </div>
        </>
      )}

      {/* outro: file CTA */}
      {outro && (
        <div dir="rtl" style={{position: 'absolute', top: 1360, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900,
          opacity: interpolate(frame, [B.outro + 10, B.outro + 24], [0, 1], clamp)}}>
          <div style={{display: 'inline-block', background: XL, color: '#fff', fontSize: 70, borderRadius: 26, padding: '6px 44px'}}>اكتب «أريده» 📥</div>
          <div style={{fontSize: 38, color: '#b9c0cc', fontWeight: 700, marginTop: 14}}>mandelbrot.xlsm · مجاني · Excel على ويندوز</div>
        </div>
      )}

      {/* host */}
      <div style={{position: 'absolute', inset: 0, translate: outro ? '-410px 440px' : explain ? '-400px -520px' : '-420px -790px', pointerEvents: 'none',
        opacity: frame < B.reveal ? 0 : 1}}>
        <Mokaab frame={frame} scale={outro ? 0.3 : 0.24} y={0} mood={frame < B.iterate ? 'shock' : outro ? 'happy' : 'smirk'} wave={outro ? 1 : 0}
          lookX={0.6} talk={speaking(LINES, frame)} rings={false} />
      </div>

      {/* captions */}
      {VOICE.map((v, i) => <Caption key={v.src} line={v} top={outro ? 1560 : explain ? 1590 : 1640} accent={i === 3 ? FIRE : i === 4 ? '#3ddc84' : ICE} />)}
      {outro && (
        <div dir="rtl" style={{position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 32, color: '#8b93a1'}}>
          أسرار Excel · الحلقة 5 · تك عالماشي · خلّيك ذكي!
        </div>
      )}

      <VoiceTrack lines={LINES} />
      <Sfx name="whoosh" at={B.reveal - 18} volume={0.45} />
      <Sfx name="pop" at={B.iterate + 6} volume={0.45} />
      {Array.from({length: 8}, (_, i) => <Sfx key={i} name="tick" at={B.iterate + 20 + i * 9} volume={0.4} />)}
      <Sfx name="ding" at={B.escape + 50} volume={0.5} />
      <Sfx name="click" at={B.dive + 6} volume={0.55} />
      <Sfx name="click" at={B.dive + 15} volume={0.55} />
      <Sfx name="whoosh" at={B.dive + 24} volume={0.45} />
      <Sfx name="ding" at={B.outro + 10} volume={0.5} />
    </AbsoluteFill>
  );
};
