import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import TL from './Ep06Flappy.timeline.json';
import {simulate, State, W, H, GROUND, BIRDX, PIPEW, GAP, NP} from './Ep06Flappy.sim';

// Episode 6 of أسرار Excel: Flappy Bird played inside the cells (files/flappy.xlsm).
// The simulation below uses the same rules as files/flappy.bas (36 x 32 cells, gravity 0.11, flap -1.05,
// pipes 4 wide with a 9-row gap scrolling half a cell per frame), driven by an autopilot, so the picture is
// what the sheet shows. Look: warm sunset backdrop (orange to plum) — unlike the graphite/navy of eps 3–5 —
// a tight push-out from one cell at frame 0, then a split with a VBA editor that types itself.

type Word = {w: string; start: number; end: number};
type V = {src: string; at: number; sec: number; words: Word[]};
const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const B = TL.beats;
export const EP06_FRAMES = TL.frames;

const XL = '#107c41';
const SUN = '#ffb627';
const PLUM = '#2a0f3a';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// ---------- the game (mirror of flappy.bas) ----------
const SIM: State[] = simulate(600, B.crash - 30);
const DEATH = SIM.findIndex((s) => s.dead);
const FLAPS = SIM.map((s, i) => (s.flap ? i : -1)).filter((i) => i >= 0);

const rgb = (r: number, g: number, b: number) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
const picture = (s: State, hurt: boolean): string[] => {
  const px: string[] = new Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let c: string;
      if (y < GROUND) {const t = y / GROUND; c = rgb(40 + 70 * t, 150 + 50 * t, 230 - 10 * t);}
      else if (y === GROUND) c = Math.floor((x + s.tick) / 2) % 2 === 0 ? 'rgb(120,220,70)' : 'rgb(95,195,55)';
      else c = 'rgb(222,200,140)';
      px[y * W + x] = c;
    }
  }
  for (let k = 0; k < 2; k++) {
    const cx = W + 6 - ((Math.floor(s.tick / 6) + k * 19) % (W + 12)) - 6;
    const cy = 4 + k * 6;
    for (let y = cy; y <= cy + 1; y++) for (let x = cx; x <= cx + 4 - (y - cy) * 2 + 1; x++) if (x >= 0 && x < W) px[y * W + x] = 'rgb(245,250,255)';
  }
  for (let i = 0; i < NP; i++) {
    for (let x = 0; x < PIPEW; x++) {
      const col = Math.floor(s.px[i]) + x;
      if (col < 0 || col >= W) continue;
      const edge = x === 0 ? 'rgb(30,120,40)' : x === PIPEW - 1 ? 'rgb(40,140,50)' : 'rgb(90,200,80)';
      for (let y = 0; y < GROUND; y++) {
        if (y < s.gap[i] || y >= s.gap[i] + GAP) px[y * W + col] = y === s.gap[i] - 1 || y === s.gap[i] + GAP ? 'rgb(60,170,60)' : edge;
      }
    }
  }
  const by = Math.floor(s.birdY);
  const plot = (x: number, y: number, c: string) => {if (x >= 0 && x < W && y >= 0 && y < H) px[y * W + x] = c;};
  plot(BIRDX, by, hurt ? 'rgb(255,60,60)' : 'rgb(255,210,0)');
  plot(BIRDX + 1, by, 'rgb(255,255,255)');
  plot(BIRDX, by + 1, hurt ? 'rgb(220,40,40)' : 'rgb(255,170,0)');
  plot(BIRDX + 1, by + 1, hurt ? 'rgb(255,80,80)' : 'rgb(255,200,0)');
  plot(BIRDX + 2, by + 1, 'rgb(255,80,30)');
  if (s.vy < 0) plot(BIRDX - 1, by, 'rgb(255,240,150)'); else plot(BIRDX - 1, by + 1, 'rgb(255,240,150)');
  return px;
};

const colName = (i: number) => {
  let n = i + 1, s = '';
  while (n > 0) {const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26);}
  return s;
};

// ---------- Excel window with the game in its cells ----------
const Sheet: React.FC<{f: number; cell: number}> = ({f, cell}) => {
  const s = SIM[Math.min(f, SIM.length - 1)];
  const hurt = DEATH >= 0 && f >= DEATH;
  const cells = picture(s, hurt);
  const HEAD = 30, ROWW = 46;
  return (
    <div style={{background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 40px 90px rgba(0,0,0,.55)', width: ROWW + W * cell + 16}}>
      <div style={{height: 58, background: XL, display: 'flex', alignItems: 'center', padding: '0 22px', gap: 14, color: '#fff', fontFamily: 'Segoe UI, Arial', fontSize: 26, fontWeight: 700}}>
        <div style={{width: 34, height: 34, borderRadius: 6, background: '#fff', color: XL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900}}>X</div>
        flappy.xlsm — Excel
        <div style={{marginLeft: 'auto', background: 'rgba(255,255,255,.18)', borderRadius: 8, padding: '2px 14px', fontSize: 24}}>SCORE {s.score}</div>
      </div>
      <div style={{height: 44, background: '#f3f3f3', borderBottom: '1px solid #d4d4d4', display: 'flex', alignItems: 'center', fontFamily: 'Consolas, monospace', fontSize: 22, color: '#333'}}>
        <div style={{width: 90, textAlign: 'center', borderRight: '1px solid #d4d4d4'}}>J{3 + Math.floor(s.birdY)}</div>
        <div style={{padding: '0 14px', color: '#777'}}>fx</div>
        <div style={{color: '#111'}}>=Interior.Color</div>
      </div>
      <div style={{display: 'flex', paddingRight: 16, paddingBottom: 12, background: '#fff'}}>
        <div style={{width: ROWW}}>
          <div style={{height: HEAD}} />
          {Array.from({length: H}, (_, y) => (
            <div key={y} style={{height: cell, fontSize: Math.min(15, cell * 0.55), fontFamily: 'Segoe UI, Arial', color: '#666', textAlign: 'center', lineHeight: `${cell}px`,
              background: Math.floor(s.birdY) === y || Math.floor(s.birdY) + 1 === y ? '#d3f0df' : '#f3f3f3', borderBottom: '1px solid #e2e2e2'}}>{y + 3}</div>
          ))}
        </div>
        <div>
          <div style={{display: 'flex', height: HEAD}}>
            {Array.from({length: W}, (_, x) => (
              <div key={x} style={{width: cell, fontSize: Math.min(13, cell * 0.5), fontFamily: 'Segoe UI, Arial', color: '#666', textAlign: 'center', lineHeight: `${HEAD}px`,
                background: x >= BIRDX - 1 && x <= BIRDX + 2 ? '#d3f0df' : '#f3f3f3', borderRight: '1px solid #e2e2e2'}}>{colName(x + 1)}</div>
            ))}
          </div>
          <div style={{display: 'grid', gridTemplateColumns: `repeat(${W}, ${cell}px)`, gridAutoRows: cell}}>
            {cells.map((c, i) => <div key={i} style={{background: c, boxShadow: 'inset -1px -1px 0 rgba(0,0,0,.12)'}} />)}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- VBA editor that types itself ----------
const CODE: {t: string; c: string; hl?: 'g' | 'h'}[] = [
  {t: 'Do While alive', c: '#569cd6'},
  {t: '  If FlapPressed() Then vy = FLAP', c: '#dcdcaa'},
  {t: "  ' gravity", c: '#6a9955'},
  {t: '  vy = vy + GRAVITY', c: '#9cdcfe', hl: 'g'},
  {t: '  birdY = birdY + vy', c: '#9cdcfe'},
  {t: '  MovePipes', c: '#dcdcaa'},
  {t: "  ' collision", c: '#6a9955'},
  {t: '  If Hit() Then alive = False', c: '#c586c0', hl: 'h'},
  {t: '  DrawFrame   \' repaint changed cells', c: '#dcdcaa'},
  {t: 'Loop', c: '#569cd6'},
];
const Editor: React.FC<{f: number}> = ({f}) => {
  const k = f - B.reveal;
  const chars = Math.max(0, k * 5);
  let used = 0;
  return (
    <div style={{width: 960, borderRadius: 20, overflow: 'hidden', background: '#1e1e1e', boxShadow: '0 30px 80px rgba(0,0,0,.6)', border: '2px solid #3a3a3a'}}>
      <div style={{height: 50, background: '#2d2d30', display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', fontFamily: 'Segoe UI, Arial', fontSize: 22, color: '#ccc'}}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{width: 16, height: 16, borderRadius: 8, background: c}} />)}
        <span style={{marginLeft: 10}}>VBA — Module1 · Sub Flappy()</span>
      </div>
      <div style={{padding: '18px 26px', fontFamily: 'Consolas, monospace', fontSize: 34, lineHeight: '50px', direction: 'ltr'}}>
        {CODE.map((l, i) => {
          const show = Math.max(0, Math.min(l.t.length, chars - used));
          used += l.t.length;
          const hlOn = (l.hl === 'g' && f >= B.physics && f < B.physics + 60) || (l.hl === 'h' && f >= B.physics + 56 && f < B.outro);
          const hlCol = l.hl === 'g' ? SUN : '#ff4d5e';
          return (
            <div key={i} style={{display: 'flex', whiteSpace: 'pre', color: l.c, borderRadius: 8, margin: '0 -10px', padding: '0 10px',
              background: hlOn ? `${hlCol}33` : 'transparent', outline: hlOn ? `3px solid ${hlCol}` : 'none'}}>
              <span style={{color: '#5a5a5a', width: 60, flexShrink: 0}}>{i + 1}</span>
              <span style={{direction: l.t.includes("'") && /[؀-ۿ]/.test(l.t) ? 'ltr' : 'ltr'}}>{l.t.slice(0, show)}</span>
              {show > 0 && show < l.t.length && <span style={{width: 3, background: '#fff', marginLeft: 2}} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SpaceKey: React.FC<{f: number}> = ({f}) => {
  const last = [...FLAPS].reverse().find((x) => x <= f) ?? -99;
  const down = f - last < 4;
  return (
    <div style={{width: 420, height: 110, borderRadius: 24, background: down ? SUN : '#fff', boxShadow: down ? `0 2px 0 #b37400, 0 0 50px ${SUN}` : '0 12px 0 #c9b9a6',
      translate: `0 ${down ? 10 : 0}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, Arial', fontWeight: 800, fontSize: 46, color: PLUM, letterSpacing: 4}}>
      SPACE
    </div>
  );
};

const Caption: React.FC<{line: V; top: number; accent: string}> = ({line, top, accent}) => {
  const frame = useCurrentFrame();
  const t = (frame - line.at) / 30;
  if (t < -0.1 || t > line.sec + 0.4) return null;
  return (
    <div dir="rtl" lang="ar" style={{position: 'absolute', top, left: 40, right: 40, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 70, lineHeight: 1.35,
      opacity: interpolate(t, [line.sec + 0.15, line.sec + 0.4], [1, 0], clamp)}}>
      {line.words.map((w, i) => {
        const said = t >= w.start;
        const on = said && t < (line.words[i + 1]?.start ?? w.end + 0.3);
        return (
          <span key={i} style={{display: 'inline-block', margin: '0 0.16em', color: on ? accent : said ? '#fff' : 'rgba(255,255,255,.3)',
            translate: `0 ${said ? 0 : 12}px`, scale: on ? '1.08' : '1', textShadow: on ? `0 0 28px ${accent}, 0 4px 10px rgba(0,0,0,.8)` : '0 4px 14px rgba(0,0,0,.85), 0 0 4px rgba(0,0,0,.9)'}}>{w.w}</span>
        );
      })}
    </div>
  );
};

export const Ep06Flappy: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const split = frame >= B.reveal;
  const outro = frame >= B.outro;
  // hook: start glued to the bird (cells huge), pull out to the whole sheet
  const pull = interpolate(frame, [0, 46], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const sp = spring({frame: frame - B.reveal, fps, config: {damping: 16, mass: 0.9}});
  const so = spring({frame: frame - B.outro, fps, config: {damping: 15}});
  const cell = 26;
  const zoom = interpolate(pull, [0, 1], [3.4, 1]) * interpolate(sp, [0, 1], [1, 0.62]) * interpolate(so, [0, 1], [1, 1.12]);
  const sheetTop = interpolate(sp, [0, 1], [300, 70]) + interpolate(so, [0, 1], [0, 90]);
  const birdFocusX = interpolate(pull, [0, 1], [780, 0]);
  const birdFocusY = interpolate(pull, [0, 1], [-1000, 0]);
  const crashFlash = DEATH > 0 ? interpolate(frame, [DEATH, DEATH + 2, DEATH + 14], [0, 0.55, 0], clamp) : 0;
  const shake = DEATH > 0 && frame >= DEATH && frame < DEATH + 14 ? Math.sin(frame * 9) * 12 : 0;
  const over = DEATH > 0 && frame >= DEATH + 8 && frame < B.outro;
  const ov = spring({frame: frame - DEATH - 8, fps, config: {damping: 11}});

  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, #ff7a3d 0%, #c2416b 45%, ${PLUM} 100%)`, overflow: 'hidden'}}>
      {/* sunset sun + stripes */}
      <div style={{position: 'absolute', left: 140, top: 1180, width: 800, height: 800, borderRadius: 400, background: `radial-gradient(circle, ${SUN} 0%, rgba(255,182,39,0) 70%)`, opacity: 0.5}} />
      <AbsoluteFill style={{backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,.08) 0 3px, transparent 3px 26px)'}} />

      {/* the sheet */}
      <div style={{position: 'absolute', left: '50%', top: sheetTop, translate: `calc(-50% + ${birdFocusX + shake}px) ${birdFocusY}px`, scale: `${zoom}`, transformOrigin: '50% 0%'}}>
        <Sheet f={frame} cell={cell} />
      </div>

      {/* game over box, Excel MsgBox style */}
      {over && (
        <div style={{position: 'absolute', left: 230, top: 330, width: 620, background: '#fff', borderRadius: 14, overflow: 'hidden', scale: `${ov}`, boxShadow: '0 30px 70px rgba(0,0,0,.5)'}}>
          <div style={{height: 50, background: '#f0f0f0', fontFamily: 'Segoe UI, Arial', fontSize: 24, padding: '10px 18px', color: '#222'}}>Flappy Bird</div>
          <div style={{padding: '24px 30px', fontFamily: 'Segoe UI, Arial', fontSize: 36, color: '#111', fontWeight: 700}}>Game over!<br /><span style={{fontWeight: 400, fontSize: 30}}>Score: {SIM[DEATH].score}</span></div>
        </div>
      )}

      {/* hook: the space key that makes it flap */}
      {frame >= B.flap - 6 && !split && (
        <div style={{position: 'absolute', top: 1290, left: 330, opacity: interpolate(frame, [B.flap - 6, B.flap + 4, B.reveal - 6, B.reveal], [0, 1, 1, 0], clamp)}}>
          <SpaceKey f={frame} />
        </div>
      )}
      {!split && (
        <div dir="rtl" style={{position: 'absolute', top: 120, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 64, color: '#fff',
          textShadow: '0 6px 24px rgba(0,0,0,.4)', opacity: interpolate(frame, [30, 44], [0, 1], clamp)}}>
          هذه خلايا Excel 🤯
        </div>
      )}

      {/* reveal: the VBA loop */}
      {split && !outro && (
        <div style={{position: 'absolute', left: 60, top: 820, translate: `0 ${(1 - sp) * 500}px`, opacity: sp}}>
          <Editor f={frame} />
        </div>
      )}

      {/* outro: file CTA */}
      {outro && (
        <div dir="rtl" style={{position: 'absolute', top: 1270, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, opacity: so}}>
          <div style={{display: 'inline-flex', alignItems: 'center', gap: 22, background: '#fff', borderRadius: 30, padding: '18px 36px', boxShadow: '0 20px 50px rgba(0,0,0,.35)'}}>
            <div style={{width: 76, height: 92, borderRadius: 10, background: XL, color: '#fff', fontSize: 30, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8, fontFamily: 'Segoe UI, Arial'}}>xlsm</div>
            <div style={{textAlign: 'right'}}>
              <div style={{fontSize: 58, color: PLUM}}>اكتب «أريده» 📥</div>
              <div style={{fontSize: 32, color: '#7a5a6a', fontWeight: 700}}>flappy.xlsm · مجاني · Excel على ويندوز</div>
            </div>
          </div>
        </div>
      )}

      {/* host */}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', translate: outro ? '0px 120px' : '410px -600px', opacity: frame < B.reveal ? 0 : sp}}>
        <Mokaab frame={frame} scale={outro ? 0.3 : 0.24} y={0} mood={frame < B.physics ? 'shock' : outro ? 'happy' : 'smirk'} wave={outro ? 1 : 0}
          lookX={-0.6} talk={speaking(LINES, frame)} rings={false} />
      </div>

      <AbsoluteFill style={{background: '#ff3030', opacity: crashFlash, mixBlendMode: 'screen'}} />

      {VOICE.map((v, i) => <Caption key={v.src} line={v} top={i < 2 ? 1530 : outro ? 1560 : 1640} accent={i === 3 ? SUN : i === 4 ? '#3ddc84' : '#ffe08a'} />)}
      {outro && (
        <div dir="rtl" style={{position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 32, color: '#d9b8c8'}}>
          أسرار Excel · الحلقة 6 · تك عالماشي · خلّيك ذكي!
        </div>
      )}

      <VoiceTrack lines={LINES} />
      {FLAPS.filter((x) => x < B.reveal).map((x) => <Sfx key={x} name="blip" at={x} volume={0.4} />)}
      {SIM.map((s, i) => (i > 0 && s.score > SIM[i - 1].score && i < DEATH ? <Sfx key={`s${i}`} name="ding" at={i} volume={0.35} /> : null))}
      <Sfx name="whoosh" at={B.reveal - 4} volume={0.45} />
      {Array.from({length: 10}, (_, i) => <Sfx key={`t${i}`} name="tick" at={B.reveal + 6 + i * 9} volume={0.3} />)}
      <Sfx name="pop" at={B.physics} volume={0.45} />
      {DEATH > 0 && <Sfx name="buzz" at={DEATH} volume={0.55} />}
      <Sfx name="pop" at={B.outro + 2} volume={0.45} />
    </AbsoluteFill>
  );
};
