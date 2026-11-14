import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import TL from './Fam09Qr.timeline.json';

// Family ep 9: the QR scam ("quishing"). A sticker promising free gems, the phone camera scans it, a fake login
// page eats the password. Fix: read the link the camera shows BEFORE opening, and never type a password after
// scanning a code. The QR drawn here is a random pattern (not scannable on purpose).
// Look: DAYLIGHT street wall — warm concrete, paper poster, masking tape, a phone viewfinder with a laser sweep —
// the first bright, real-world family episode (ep 8 was a night game lobby). Motion: the camera view racks focus
// onto the sticker at frame 0, a magnifier slides along the URL chip, the rule lands as a stamped street sign.

type Word = {w: string; start: number; end: number};
type V = {src: string; at: number; sec: number; words: Word[]};
const VOICE = TL.voice as V[];
const LINES: Line[] = VOICE.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const B = TL.beats;
export const FAMILY09_FRAMES = TL.frames;

const INK = '#1b1a17';
const WALL = '#d9cfbf';
const RED = '#e5322d';
const YEL = '#ffd23f';
const GRN = '#1fb85a';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// ---------- a QR-looking pattern (random modules + 3 finder squares), deterministic
const N = 25;
const QR_CELLS = (() => {
  const out: boolean[] = [];
  let seed = 11;
  const finder = (x: number, y: number) => {
    for (const [fx, fy] of [[0, 0], [N - 7, 0], [0, N - 7]]) {
      const dx = x - fx, dy = y - fy;
      if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) {
        if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return 0;
        const ring = Math.min(dx, dy, 6 - dx, 6 - dy);
        return ring === 1 ? 0 : 1;
      }
    }
    return -1;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const f = finder(x, y);
    seed = (seed * 75 + 74) % 65537;
    out.push(f === -1 ? seed % 100 < 48 : f === 1);
  }
  return out;
})();
const QR: React.FC<{size: number}> = ({size}) => (
  <div style={{width: size, height: size, background: '#fff', padding: size * 0.06, boxSizing: 'border-box', display: 'grid', gridTemplateColumns: `repeat(${N}, 1fr)`}}>
    {QR_CELLS.map((c, i) => <div key={i} style={{background: c ? INK : '#fff'}} />)}
  </div>
);

// ---------- the poster on the wall
const Poster: React.FC<{f: number}> = ({f}) => (
  <div dir="rtl" style={{width: 700, background: '#fbf6ea', padding: '34px 40px 40px', boxShadow: '0 18px 40px rgba(0,0,0,.25)', rotate: '-2deg', position: 'relative', textAlign: 'center', fontFamily: FONT}}>
    {[[-30, -18, -8], [610, -14, 10]].map(([l, t, r], i) => (
      <div key={i} style={{position: 'absolute', left: l, top: t, width: 120, height: 42, background: 'rgba(240,220,160,.85)', rotate: `${r}deg`}} />
    ))}
    <div style={{fontWeight: 900, fontSize: 64, color: '#7a2cff', lineHeight: 1.15}}>💎 1000 جوهرة مجانًا!</div>
    <div style={{fontWeight: 700, fontSize: 36, color: '#555', marginTop: 6}}>امسح الرمز وسجّل دخولك</div>
    <div style={{margin: '26px auto 0', width: 440, position: 'relative'}}>
      <QR size={440} />
      {/* the sticker edge: a code stuck on top of the poster */}
      <div style={{position: 'absolute', right: -14, bottom: -14, width: 70, height: 70, background: 'linear-gradient(135deg, #fff 50%, #cfc6b6 50%)',
        boxShadow: '-4px -4px 8px rgba(0,0,0,.15)', opacity: interpolate(f, [B.check - 10, B.check], [0, 1], clamp)}} />
    </div>
  </div>
);

// ---------- phone camera viewfinder over the poster
const Viewfinder: React.FC<{f: number; chip: number; mag: number}> = ({f, chip, mag}) => {
  const sweep = (f * 14) % 520;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {/* focus brackets */}
      {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y], i) => (
        <div key={i} style={{position: 'absolute', left: 100 + x * 420, top: 560 + y * 420, width: 80, height: 80,
          borderTop: y ? 'none' : `10px solid ${YEL}`, borderBottom: y ? `10px solid ${YEL}` : 'none',
          borderLeft: x ? 'none' : `10px solid ${YEL}`, borderRight: x ? `10px solid ${YEL}` : 'none', borderRadius: 14}} />
      ))}
      <div style={{position: 'absolute', left: 110, top: 560 + sweep * 0.95, width: 480, height: 6, background: RED, boxShadow: `0 0 24px ${RED}`, opacity: chip > 0.5 ? 0 : 0.9}} />
      {/* the link preview chip that every phone camera shows */}
      <div style={{position: 'absolute', left: 50, right: 50, top: 150, scale: `${chip}`, display: 'flex', alignItems: 'center', gap: 16, background: YEL, borderRadius: 40,
        padding: '18px 26px', boxShadow: '0 12px 30px rgba(0,0,0,.35)', direction: 'ltr', fontFamily: 'Segoe UI, Arial', fontWeight: 700, fontSize: 30, color: INK}}>
        <span style={{fontSize: 34}}>🌐</span>
        <span>
          <span style={{background: mag > 0.5 ? '#fff' : 'transparent', borderRadius: 8, padding: '0 4px'}}>free-gems</span>
          <span>.</span>
          <span style={{background: mag > 0.5 ? RED : 'transparent', color: mag > 0.5 ? '#fff' : INK, borderRadius: 8, padding: '0 4px'}}>login-xyz.top</span>
          <span style={{opacity: 0.6}}>/acc</span>
        </span>
      </div>
    </div>
  );
};

// ---------- the fake login page
const FakeLogin: React.FC<{f: number}> = ({f}) => {
  const typed = Math.max(0, Math.min(10, Math.floor((f - B.bait - 30) / 3)));
  const hook = interpolate(f, [B.bait + 70, B.bait + 96], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const stamp = spring({frame: f - B.bait - 92, fps: 30, config: {damping: 9, mass: 0.6}});
  return (
    <div dir="rtl" style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #6d28ff, #b145ff)', padding: '120px 50px', fontFamily: FONT, textAlign: 'center'}}>
      <div style={{fontSize: 92}}>🎮</div>
      <div style={{fontWeight: 900, fontSize: 52, color: '#fff'}}>سجّل الدخول لتستلم جواهرك</div>
      {['اسم المستخدم', 'كلمة السر'].map((label, i) => (
        <div key={i} style={{marginTop: 34, background: '#fff', borderRadius: 22, padding: '20px 26px', textAlign: 'right', fontSize: 36, fontWeight: 700, color: '#888', position: 'relative'}}>
          {i === 0 ? <span style={{color: INK}}>ahmad_2015</span> : typed ? <span style={{color: INK, letterSpacing: 6}}>{'•'.repeat(typed)}</span> : label}
          {i === 1 && typed > 0 && (
            <div style={{position: 'absolute', left: 40, top: 8, translate: `${interpolate(hook, [0, 1], [0, -500])}px ${interpolate(hook, [0, 1], [0, -760])}px`,
              fontSize: 70, rotate: `${hook * -30}deg`, opacity: hook > 0 ? 1 : 0}}>🪝</div>
          )}
        </div>
      ))}
      <div style={{marginTop: 40, background: YEL, borderRadius: 22, padding: '16px 0', fontWeight: 900, fontSize: 44, color: INK}}>دخول</div>
      <div style={{position: 'absolute', left: 60, right: 60, top: 760, scale: `${stamp}`, rotate: '-12deg', border: `10px solid ${RED}`, color: RED, borderRadius: 20, background: 'rgba(255,255,255,.92)',
        fontWeight: 900, fontSize: 70, whiteSpace: 'nowrap', padding: '6px 0', opacity: stamp > 0.02 ? 1 : 0}}>صفحة مزيّفة!</div>
    </div>
  );
};

// ---------- the phone frame
const Phone: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{width: 700, height: 1340, borderRadius: 90, background: '#111', padding: 22, boxShadow: '0 40px 90px rgba(0,0,0,.45), inset 0 0 0 4px #333'}}>
    <div style={{width: '100%', height: '100%', borderRadius: 70, overflow: 'hidden', position: 'relative', background: '#000'}}>
      {children}
      <div style={{position: 'absolute', top: 22, left: '50%', marginLeft: -70, width: 140, height: 40, borderRadius: 20, background: '#000'}} />
    </div>
  </div>
);

const groupLatin = (ws: Word[]) => ws.reduce<Word[]>((a, w) => {
  const prev = a[a.length - 1];
  if (prev && /^[A-Za-z]/.test(prev.w) && /^[A-Za-z]/.test(w.w)) {a[a.length - 1] = {w: `${prev.w} ${w.w}`, start: prev.start, end: w.end}; return a;}
  a.push(w); return a;
}, []);

const Caption: React.FC<{line: V; top: number; accent: string}> = ({line, top, accent}) => {
  const frame = useCurrentFrame();
  const t = (frame - line.at) / 30;
  if (t < -0.1 || t > line.sec + 0.4) return null;
  return (
    <div dir="rtl" lang="ar" style={{position: 'absolute', top, left: 40, right: 40, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 68, lineHeight: 1.35,
      opacity: interpolate(t, [line.sec + 0.15, line.sec + 0.4], [1, 0], clamp)}}>
      <span style={{background: INK, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', padding: '2px 18px', borderRadius: 16, lineHeight: 1.55}}>
        {groupLatin(line.words).map((w, i, ws) => {
          const said = t >= w.start;
          const on = said && t < (ws[i + 1]?.start ?? w.end + 0.3);
          return (
            <span key={i} dir={/[A-Za-z]/.test(w.w) ? 'ltr' : undefined} style={{display: 'inline-block', unicodeBidi: 'isolate', margin: '0 0.13em',
              color: on ? accent : said ? '#fff' : 'rgba(255,255,255,.35)', scale: on ? '1.06' : '1'}}>{w.w}</span>
          );
        })}
      </span>
    </div>
  );
};

export const Family09Qr: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const outro = frame >= B.outro;
  const inPhone = frame < B.never;
  const showLogin = frame >= B.bait && frame < B.check;
  // rack focus onto the sticker at frame 0
  const blur = interpolate(frame, [0, 16], [10, 0], clamp);
  const camZoom = interpolate(frame, [0, 40], [1.25, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const chip = spring({frame: frame - 34, fps, config: {damping: 12}}) * (frame < B.bait ? 1 : 0) + (frame >= B.check ? spring({frame: frame - B.check, fps, config: {damping: 12}}) : 0);
  const mag = interpolate(frame, [B.check + 14, B.check + 40], [0, 1], clamp);
  const phoneIn = interpolate(frame, [0, 22], [180, 0], {...clamp, easing: Easing.out(Easing.cubic)});
  const sign = spring({frame: frame - B.never, fps, config: {damping: 10, mass: 0.7}});
  const so = spring({frame: frame - B.outro, fps, config: {damping: 15}});
  const phoneScale = interpolate(so, [0, 1], [1, 0.5]);

  return (
    <AbsoluteFill style={{background: WALL, overflow: 'hidden'}}>
      {/* concrete wall texture */}
      <AbsoluteFill style={{backgroundImage: 'radial-gradient(rgba(0,0,0,.06) 1px, transparent 1.5px), radial-gradient(rgba(255,255,255,.25) 1px, transparent 1.5px)',
        backgroundSize: '9px 9px, 13px 13px', backgroundPosition: '0 0, 4px 6px'}} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(255,240,210,.5), transparent 40%, rgba(0,0,0,.18))'}} />

      {/* phone */}
      <div style={{position: 'absolute', left: 190, top: 330 + phoneIn, scale: `${phoneScale}`, transformOrigin: '50% 0%',
        opacity: frame >= B.never && !outro ? 0 : 1, translate: outro ? `0 ${so * 20}px` : '0 0'}}>
        <Phone>
          {(inPhone || outro) && !showLogin && (
            <div style={{position: 'absolute', inset: 0, background: '#8f877a', overflow: 'hidden'}}>
              <div style={{position: 'absolute', left: -20, top: 300, scale: `${camZoom * 0.92}`, filter: `blur(${blur}px)`, transformOrigin: '50% 40%'}}>
                <Poster f={frame} />
              </div>
              <Viewfinder f={frame} chip={outro ? 0 : chip} mag={outro ? 0 : mag} />
              {/* shutter row */}
              <div style={{position: 'absolute', bottom: 40, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
                <div style={{width: 110, height: 110, borderRadius: 60, border: '8px solid #fff', background: 'rgba(255,255,255,.3)'}} />
              </div>
            </div>
          )}
          {showLogin && <FakeLogin f={frame} />}
        </Phone>
      </div>

      {/* magnifier on the link */}
      {frame >= B.check + 6 && frame < B.never && (
        <div style={{position: 'absolute', left: interpolate(frame, [B.check + 6, B.check + 40], [210, 560], {...clamp, easing: Easing.inOut(Easing.cubic)}), top: 420,
          width: 210, height: 210, borderRadius: '50%', border: `16px solid ${INK}`, boxShadow: 'inset 0 0 0 6px rgba(255,255,255,.6), 0 14px 30px rgba(0,0,0,.35)'}}>
          <div style={{position: 'absolute', right: -86, bottom: -86, width: 110, height: 34, background: INK, borderRadius: 16, rotate: '45deg'}} />
        </div>
      )}
      {frame >= B.check + 40 && frame < B.never && (
        <div dir="rtl" style={{position: 'absolute', top: 1720, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 50, color: INK}}>
          ليس موقع اللعبة ❌
        </div>
      )}

      {/* the rule: a stamped street sign */}
      {frame >= B.never && !outro && (
        <div dir="rtl" style={{position: 'absolute', left: 90, right: 90, top: 560, scale: `${sign}`, rotate: `${(1 - sign) * 14 - 3}deg`, background: '#fff', border: `14px solid ${RED}`,
          borderRadius: 40, padding: '40px 30px', textAlign: 'center', fontFamily: FONT, boxShadow: '0 30px 60px rgba(0,0,0,.3)'}}>
          <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 30, direction: 'ltr'}}>
            <div style={{transform: 'scale(.62)', transformOrigin: 'center', margin: -80}}><QR size={260} /></div>
            <div style={{fontSize: 90, color: INK}}>→</div>
            <div style={{position: 'relative', fontSize: 120}}>🔑
              <div style={{position: 'absolute', left: -20, right: -20, top: '48%', height: 18, background: RED, rotate: '-35deg', borderRadius: 9}} />
            </div>
          </div>
          <div style={{fontWeight: 900, fontSize: 74, color: RED, marginTop: 20}}>لا كلمة سرّ</div>
          <div style={{fontWeight: 700, fontSize: 46, color: INK}}>بعد مسح أي رمز</div>
        </div>
      )}

      {/* outro */}
      {outro && (
        <div dir="rtl" style={{position: 'absolute', top: 1050, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, opacity: so, translate: `0 ${(1 - so) * 80}px`}}>
          <div style={{display: 'inline-block', background: INK, color: '#fff', borderRadius: 30, padding: '16px 40px', fontSize: 52}}>📤 أرسله لكل أب وأم</div><br />
          <div style={{display: 'inline-block', fontSize: 44, color: INK, background: YEL, borderRadius: 26, padding: '6px 32px', marginTop: 22,
            opacity: interpolate(frame, [B.outro + 10, B.outro + 20], [0, 1], clamp)}}>🔔 اشترك ليصلك الدرس التالي</div><br />
          <div style={{display: 'inline-block', fontSize: 42, color: '#fff', background: '#2a5bd7', borderRadius: 26, padding: '6px 30px', marginTop: 20,
            opacity: interpolate(frame, [VOICE[4].at + 6, VOICE[4].at + 18], [0, 1], clamp)}}>الحلقة القادمة: Wi-Fi مجاني… فخّ؟ 📶</div>
        </div>
      )}

      {/* host */}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', translate: outro ? '-340px 700px' : '360px 640px',
        opacity: interpolate(frame, [B.bait - 10, B.bait + 4], [0, 1], clamp)}}>
        <Mokaab frame={frame} scale={0.22} y={0} mood={frame < B.check ? 'shock' : outro ? 'happy' : 'smirk'} wave={outro ? 1 : 0}
          lookX={outro ? 0.6 : -0.7} talk={speaking(LINES, frame)} rings={false} />
      </div>

      {VOICE.map((v, i) => <Caption key={v.src} line={v} top={120} accent={i === 3 ? '#ff6b66' : i === 4 ? '#8fb3ff' : YEL} />)}
      {outro && (
        <div dir="rtl" style={{position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 32, color: '#5c5547'}}>
          احمِ أطفالك على الإنترنت · الحلقة 9 · تك عالماشي · خلّيك ذكي!
        </div>
      )}

      <VoiceTrack lines={LINES} />
      <Sfx name="click" at={2} volume={0.45} />
      <Sfx name="blip" at={34} volume={0.45} />
      <Sfx name="whoosh" at={B.bait - 4} volume={0.45} />
      {Array.from({length: 10}, (_, i) => <Sfx key={i} name="tick" at={B.bait + 30 + i * 3} volume={0.3} />)}
      <Sfx name="whoosh" at={B.bait + 70} volume={0.4} />
      <Sfx name="buzz" at={B.bait + 92} volume={0.5} />
      <Sfx name="blip" at={B.check} volume={0.4} />
      <Sfx name="buzz" at={B.check + 40} volume={0.35} />
      <Sfx name="pop" at={B.never} volume={0.5} />
      <Sfx name="ding" at={B.outro + 2} volume={0.45} />
    </AbsoluteFill>
  );
};
