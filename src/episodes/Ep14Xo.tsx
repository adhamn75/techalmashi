import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import TL from './Ep14Xo.timeline.json';

// Episode 14 of أسرار Excel: tic-tac-toe where Excel (O) never loses (files/tictactoe.xlsm, rules in files/tictactoe.bas).
// The filmed game and every score on screen come from Ep14Xo.sim.py (same minimax as the file):
// X corner → O centre (all else −4) → X opposite corner (the fork trap: corners −6) → O edge → X blunders → O wins (+9).
// Look: NOT ep 13's dark-red racing road. A deep navy "night chalkboard", one big 3×3 sheet range in the middle,
// neon coral X vs cyan O drawn as strokes, Excel's minimax scores written INSIDE the empty squares.
// Reveal: board rises, a VBA editor slides up under it. Outro: board shrinks to the top with a WIN stamp, CTA stack below.

type Word = {w: string; start: number; end: number};
type V = {src: string; at: number; sec: number; words: Word[]};
const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const B = TL.beats;
const MOVES = TL.moves as [number, number, number][];
type Phase = {from: number; to: number; step: number; order: number[]; s: Record<string, number>; games: number};
const PH = TL.scores as Phase[];
export const EP14_FRAMES = TL.frames;

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const XL = '#107c41', NAVY = '#0c1630', INK = '#0a0f1f', XC = '#ff6b5b', OC = '#3fd0ff', GOOD = '#4be38a', BAD = '#ff5470', GOLD = '#ffd23c';
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

const SQ = 240, BW = SQ * 3;

const XMark: React.FC<{p: number}> = ({p}) => {
  const a = interpolate(p, [0, 0.5], [0, 1], clamp), b = interpolate(p, [0.45, 1], [0, 1], clamp);
  const L = 200;
  return (
    <svg width={SQ} height={SQ} style={{position: 'absolute', inset: 0, filter: `drop-shadow(0 0 18px ${XC})`}}>
      <line x1={58} y1={58} x2={182} y2={182} stroke={XC} strokeWidth={30} strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - a)} />
      <line x1={182} y1={58} x2={58} y2={182} stroke={XC} strokeWidth={30} strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - b)} />
    </svg>
  );
};
const OMark: React.FC<{p: number}> = ({p}) => {
  const L = 2 * Math.PI * 66;
  return (
    <svg width={SQ} height={SQ} style={{position: 'absolute', inset: 0, filter: `drop-shadow(0 0 18px ${OC})`}}>
      <circle cx={120} cy={120} r={66} fill="none" stroke={OC} strokeWidth={28} strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - p)}
        transform="rotate(-90 120 120)" />
    </svg>
  );
};

// tiny "possible future" boards that fan out of a square while Excel tries it
const Futures: React.FC<{t: number; seed: number}> = ({t, seed}) => {
  if (t < 0 || t > 16) return null;
  return (
    <>
      {[0, 1, 2].map((k) => {
        const ang = (-60 + k * 60 + seed * 37) * (Math.PI / 180);
        const d = interpolate(t, [0, 14], [0, 120], {...clamp, easing: easeOut});
        const o = interpolate(t, [0, 3, 10, 16], [0, 0.9, 0.7, 0], clamp);
        return (
          <div key={k} style={{position: 'absolute', left: 120 - 30 + Math.cos(ang) * d, top: 120 - 30 + Math.sin(ang) * d - d * 0.4, width: 60, height: 60, opacity: o,
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, background: '#ffffff40', padding: 2, borderRadius: 4}}>
            {Array.from({length: 9}, (_, j) => {
              const v = (j * 7 + k * 5 + seed * 3) % 5;
              return <div key={j} style={{background: v === 0 ? XC : v === 1 ? OC : '#18254a'}} />;
            })}
          </div>
        );
      })}
    </>
  );
};

const Board: React.FC<{f: number}> = ({f}) => {
  const {fps} = useVideoConfig();
  const placed = MOVES.filter(([, , at]) => f >= at);
  const occ = new Map(placed.map(([i, p, at]) => [i, {p, at}]));
  const phase = PH.find((p) => f >= p.from && f < p.to);
  const best = phase ? Math.max(...phase.order.map((i) => phase.s[String(i)])) : 0;
  const allIn = phase ? f >= phase.from + phase.step * (phase.order.length - 1) + 6 : false;
  const win = f >= MOVES[MOVES.length - 1][2] + 4;
  const wl = interpolate(f, [MOVES[MOVES.length - 1][2] + 4, MOVES[MOVES.length - 1][2] + 14], [0, 1], {...clamp, easing: easeOut});
  return (
    <div style={{position: 'relative', width: BW, height: BW}}>
      {Array.from({length: 9}, (_, i) => {
        const x = (i % 3) * SQ, y = Math.floor(i / 3) * SQ;
        const m = occ.get(i);
        const k = phase ? phase.order.indexOf(i) : -1;
        const at = phase && k >= 0 ? phase.from + k * phase.step : 0;
        const sc = phase && k >= 0 && !m ? phase.s[String(i)] : undefined;
        const sp = sc !== undefined ? spring({frame: f - at, fps, config: {damping: 10, stiffness: 220, mass: 0.7}}) : 0;
        const isBest = sc !== undefined && allIn && sc === best;
        const trap = phase === PH[1] && sc !== undefined && sc < 0 && f >= 200;
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y, width: SQ, height: SQ, borderRadius: 18,
            background: isBest ? '#1b3b2c' : trap ? '#3a1424' : '#13204099', boxShadow: isBest ? `inset 0 0 0 5px ${GOOD}` : trap ? `inset 0 0 0 5px ${BAD}` : 'inset 0 0 0 2px #2a3a66'}}>
            {phase && k >= 0 && !m && <Futures t={f - at + 12} seed={i} />}
            {sc !== undefined && f >= at && (
              <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, Arial, sans-serif', fontWeight: 900,
                fontSize: 96, color: sc > 0 ? GOOD : sc < 0 ? BAD : '#e8ecf8', scale: `${sp}`, direction: 'ltr', textShadow: '0 4px 0 #0008'}}>{sc > 0 ? `+${sc}` : sc}</div>
            )}
            {trap && (
              <div dir="rtl" style={{position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 38, color: BAD,
                opacity: interpolate(f, [200, 206], [0, 1], clamp)}}>فخّ!</div>
            )}
            {m && m.p === 1 && <XMark p={interpolate(f - m.at, [0, 9], [0, 1], {...clamp, easing: easeOut})} />}
            {m && m.p === 2 && <OMark p={interpolate(f - m.at, [0, 11], [0, 1], {...clamp, easing: easeOut})} />}
          </div>
        );
      })}
      {/* grid lines like a thick-bordered sheet range */}
      {[1, 2].map((k) => (
        <React.Fragment key={k}>
          <div style={{position: 'absolute', left: k * SQ - 4, top: 6, width: 8, height: BW - 12, borderRadius: 4, background: '#8fa3d9'}} />
          <div style={{position: 'absolute', top: k * SQ - 4, left: 6, height: 8, width: BW - 12, borderRadius: 4, background: '#8fa3d9'}} />
        </React.Fragment>
      ))}
      {win && (
        <div style={{position: 'absolute', left: SQ * 1.5 - 12, top: 40, width: 24, height: (BW - 80) * wl, borderRadius: 12, background: GOLD, boxShadow: `0 0 40px ${GOLD}`}} />
      )}
    </div>
  );
};

const Counter: React.FC<{f: number}> = ({f}) => {
  const phase = PH.find((p) => f >= p.from - 4 && f < p.to);
  if (!phase) return null;
  const end = phase.from + phase.step * (phase.order.length - 1) + 4;
  const n = Math.round(interpolate(f, [phase.from, end], [0, phase.games], {...clamp, easing: Easing.out(Easing.quad)}));
  return (
    <div dir="rtl" style={{display: 'inline-flex', alignItems: 'center', gap: 16, background: '#0a1226', border: `3px solid ${OC}`, borderRadius: 40, padding: '6px 30px',
      fontFamily: FONT, fontWeight: 900, fontSize: 44, color: '#fff'}}>
      <span>Excel جرّب</span>
      <span style={{fontFamily: 'Consolas, monospace', color: OC, direction: 'ltr', minWidth: 170, textAlign: 'center'}}>{n.toLocaleString('en-US')}</span>
      <span>مباراة</span>
    </div>
  );
};

const CODE: {t: string; c: string}[] = [
  {t: 'Function Minimax(turn, depth)', c: '#dcdcaa'},
  {t: '  If Winner() = 2 Then Minimax = 10 - depth', c: '#9cdcfe'},
  {t: '  If Winner() = 1 Then Minimax = depth - 10', c: '#9cdcfe'},
  {t: '  For i = 0 To 8: b(i) = turn', c: '#c586c0'},
  {t: '    s = Minimax(3 - turn, depth + 1)', c: '#ffd479'},
  {t: '  If s > best Then best = s: pick = i', c: '#4be38a'},
];
const Editor: React.FC<{f: number}> = ({f}) => {
  const t = f - B.reveal;
  const chars = Math.max(0, (t - 4) * 9);
  let used = 0;
  return (
    <div style={{width: 1000, borderRadius: 18, overflow: 'hidden', background: '#1e1e1e', boxShadow: '0 30px 80px rgba(0,0,0,.7)', border: `3px solid ${OC}`}}>
      <div style={{height: 48, background: '#0f2a3a', display: 'flex', alignItems: 'center', padding: '0 20px', fontFamily: 'Segoe UI, Arial', fontSize: 23, color: '#a8e8ff', fontWeight: 700, direction: 'ltr'}}>
        VBA — TicTacToeGame · Minimax calls itself
      </div>
      <div style={{padding: '10px 24px', fontFamily: 'Consolas, monospace', fontSize: 30, lineHeight: '50px', direction: 'ltr'}}>
        {CODE.map((l, i) => {
          const show = Math.max(0, Math.min(l.t.length, chars - used));
          used += l.t.length;
          const hl = i === 4 ? f >= 259 && f < 296 : i === 5 ? f >= 296 : false;
          const col = i === 5 ? GOOD : '#ffd479';
          return (
            <div key={i} style={{display: 'flex', whiteSpace: 'pre', color: l.c, margin: '0 -10px', padding: '0 10px', borderRadius: 6,
              background: hl ? `${col}26` : 'transparent', outline: hl ? `3px solid ${col}` : 'none'}}>
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
    <div dir="rtl" lang="ar" style={{position: 'absolute', top: 40, left: 30, right: 30, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
      textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: ws.length > 7 ? 62 : 74, lineHeight: 1.3,
      opacity: interpolate(t, [-0.1, 0.05, line.sec + 0.15, line.sec + 0.35], [0, 1, 1, 0], clamp)}}>
      {ws.map((w, i) => {
        const said = t >= w.start;
        const on = said && t < (ws[i + 1]?.start ?? w.end + 0.3);
        const pop = on ? interpolate(t - w.start, [0, 0.06, 0.16], [1, 1.12, 1.04], clamp) : 1;
        return (
          <span key={i} dir={/[A-Za-z]/.test(w.w) ? 'ltr' : undefined} style={{display: 'inline-block', unicodeBidi: 'isolate', margin: '0 0.14em', scale: `${pop}`,
            color: on ? OC : said ? '#fff' : 'rgba(255,255,255,.4)', WebkitTextStroke: `10px ${INK}`, paintOrder: 'stroke fill'}}>{w.w}</span>
        );
      })}
    </div>
  );
};

export const Ep14Xo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reveal = frame >= B.reveal && frame < B.outro;
  const outro = frame >= B.outro;
  const ri = interpolate(frame, [B.reveal - 6, B.reveal + 12], [0, 1], {...clamp, easing: easeInOut});
  const so = spring({frame: frame - B.outro, fps, config: {damping: 16, stiffness: 140}});
  // board: centred in the hook, rises for the editor, shrinks to the top in the outro
  const bScale = outro ? interpolate(so, [0, 1], [0.8, 0.56]) : interpolate(ri, [0, 1], [1, 0.8]);
  const bTop = outro ? interpolate(so, [0, 1], [370, 340]) : interpolate(ri, [0, 1], [560, 370]);
  // hook push-in: starts a touch big and settles (no dead-still frame 0)
  const hookZ = interpolate(frame, [0, 40], [1.06, 1], {...clamp, easing: easeOut});
  const lastMove = MOVES.filter(([, , at]) => at <= frame).pop();
  const jolt = lastMove && frame - lastMove[2] < 8 ? Math.sin((frame - lastMove[2]) * 2.4) * (8 - (frame - lastMove[2])) * 1.2 : 0;
  const winAt = MOVES[MOVES.length - 1][2] + 4;
  const stamp = spring({frame: frame - (B.outro + 4), fps, config: {damping: 8, stiffness: 200}});
  const drift = frame * 0.6;

  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 38%, #18295a 0%, ${NAVY} 55%, ${INK} 100%)`, overflow: 'hidden'}}>
      <AbsoluteFill style={{backgroundImage: 'radial-gradient(#ffffff16 2px, transparent 2px)', backgroundSize: '44px 44px', backgroundPosition: `${drift}px ${drift * 0.5}px`}} />

      {/* the sheet: title bar + column letters + row numbers around the board range */}
      <div style={{position: 'absolute', left: 540, top: bTop, translate: `${-BW / 2 + jolt}px 0`, transformOrigin: `${BW / 2}px 0`, scale: `${bScale * hookZ}`}}>
        <div style={{position: 'absolute', left: -70, top: -122, width: BW + 70, height: 44, background: XL, borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center',
          padding: '0 18px', gap: 12, color: '#fff', fontFamily: 'Segoe UI, Arial', fontSize: 24, fontWeight: 700, direction: 'ltr'}}>
          <div style={{width: 28, height: 28, borderRadius: 5, background: '#fff', color: XL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900}}>X</div>
          tictactoe.xlsm — Excel
          <div style={{marginLeft: 'auto', fontSize: 20, opacity: 0.9}}>YOU = X · EXCEL = O</div>
        </div>
        <div style={{position: 'absolute', left: -70, top: -78, width: BW + 70, height: 50, background: '#e9eef5', display: 'flex'}}>
          <div style={{width: 70}} />
          {['B', 'C', 'D'].map((c) => (
            <div key={c} style={{width: SQ, textAlign: 'center', lineHeight: '50px', fontFamily: 'Segoe UI, Arial', fontSize: 24, color: '#555', borderLeft: '1px solid #c8c8c8'}}>{c}</div>
          ))}
        </div>
        <div style={{position: 'absolute', left: -70, top: -28, width: 70, height: BW + 28, background: '#e9eef5', borderRadius: '0 0 0 12px'}}>
          {[5, 6, 7].map((r, k) => (
            <div key={r} style={{position: 'absolute', top: 28 + k * SQ, width: 70, height: SQ, lineHeight: `${SQ}px`, textAlign: 'center', fontFamily: 'Segoe UI, Arial', fontSize: 24,
              color: '#555', borderTop: '1px solid #c8c8c8'}}>{r}</div>
          ))}
        </div>
        <div style={{position: 'absolute', left: 0, top: -28, width: BW, height: BW + 28, background: '#101b38', borderRadius: '0 0 12px 0'}} />
        <div style={{position: 'absolute', left: 0, top: 0}}><Board f={frame} /></div>
        {outro && (
          <div style={{position: 'absolute', left: BW / 2, top: BW / 2, translate: '-50% -50%', rotate: '-10deg', scale: `${interpolate(stamp, [0, 1], [2.2, 1])}`, opacity: Math.min(1, stamp * 1.5),
            fontFamily: 'Segoe UI, Arial', fontWeight: 900, fontSize: 118, color: GOLD, border: `10px solid ${GOLD}`, borderRadius: 24, padding: '0 34px', background: '#0a0f1fcc',
            whiteSpace: 'nowrap', direction: 'ltr', textShadow: `0 0 30px ${GOLD}`}}>EXCEL WINS</div>
        )}
      </div>

      {!outro && (
        <div style={{position: 'absolute', left: 0, right: 0, top: reveal ? 960 : 1360, textAlign: 'center', opacity: frame < 8 ? 0 : 1 - ri * 0.0}}>
          <Counter f={frame} />
        </div>
      )}
      {!outro && !reveal && frame >= 214 && (
        <div dir="rtl" style={{position: 'absolute', left: 0, right: 0, top: 1460, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 46, color: '#e8ecf8',
          opacity: interpolate(frame, [214, 222], [0, 1], clamp)}}>
          <span style={{color: GOOD}}>0</span> = تعادل · <span style={{color: BAD}}>سالب</span> = Excel يخسر
        </div>
      )}
      {reveal && (
        <div style={{position: 'absolute', left: 40, top: 1080, opacity: ri, translate: `0 ${(1 - ri) * 300}px`}}><Editor f={frame} /></div>
      )}

      {outro && (
        <div dir="rtl" style={{position: 'absolute', top: 830, left: 80, right: 80, textAlign: 'center', fontFamily: FONT, fontWeight: 900, opacity: so, translate: `0 ${(1 - so) * 160}px`}}>
          <div style={{background: '#fff', borderRadius: 28, padding: '18px 20px', boxShadow: `0 20px 60px ${OC}55`, border: `5px solid ${OC}`}}>
            <div style={{fontSize: 32, color: XL, fontFamily: 'Segoe UI, Arial', fontWeight: 900, direction: 'ltr'}}>tictactoe.xlsm</div>
            <div style={{fontSize: 70, color: INK, lineHeight: 1.25}}>اكتب «أريده» 📥</div>
            <div style={{fontSize: 30, color: '#555', fontWeight: 700}}>الملف مجاني · جرّب أن تهزمه</div>
          </div>
          <div style={{display: 'inline-block', fontSize: 38, color: INK, background: GOLD, borderRadius: 30, padding: '8px 26px', marginTop: 30,
            opacity: interpolate(frame, [395, 403], [0, 1], clamp), scale: `${interpolate(frame, [395, 400, 406], [0.8, 1.06, 1], clamp)}`}}>🔔 اشترك لتصلك اللعبة التالية</div>
          <div style={{fontSize: 42, color: '#fff', border: `4px solid ${OC}`, borderRadius: 28, padding: '10px 18px', marginTop: 30, lineHeight: 1.35, background: '#0a1226',
            opacity: interpolate(frame, [B.next - 2, B.next + 8], [0, 1], clamp), translate: `0 ${interpolate(frame, [B.next - 2, B.next + 8], [24, 0], clamp)}px`}}>الحلقة القادمة: أوّلُ لعبةِ فيديو في التاريخ 🕹️</div>
        </div>
      )}

      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', translate: outro ? '360px 760px' : '390px 760px',
        opacity: frame < 20 || reveal ? 0 : interpolate(frame, [20, 32], [0, 1], clamp)}}>
        <Mokaab frame={frame} scale={outro ? 0.17 : 0.14} y={0} mood={outro ? 'happy' : frame >= 200 ? 'shock' : 'smirk'} wave={outro ? 1 : 0} lookX={-0.6} talk={speaking(LINES, frame)} rings={false} />
      </div>

      {VOICE.map((v) => <Caption key={v.src} line={v} />)}
      {outro && (
        <div dir="rtl" style={{position: 'absolute', bottom: 60, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 30, color: '#9fb0d8'}}>
          أسرار Excel · الحلقة 14 · تك عالماشي · خلّيك ذكي!
        </div>
      )}

      <VoiceTrack lines={LINES} />
      {MOVES.map(([i, p, at]) => <Sfx key={`m${i}`} name={p === 1 ? 'click' : 'pop'} at={at} volume={0.5} />)}
      {PH.flatMap((ph, n) => ph.order.map((i, k) => <Sfx key={`s${n}-${i}`} name="tick" at={ph.from + k * ph.step} volume={0.4} />))}
      <Sfx name="buzz" at={200} volume={0.4} />
      <Sfx name="whoosh" at={B.reveal - 4} volume={0.5} />
      <Sfx name="ding" at={winAt} volume={0.55} />
      <Sfx name="pop" at={B.outro + 4} volume={0.45} />
      <Sfx name="ding" at={395} volume={0.4} />
    </AbsoluteFill>
  );
};
