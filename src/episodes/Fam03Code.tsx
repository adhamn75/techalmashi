import React from 'react';
import {AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import TL from './Fam03Code.timeline.json';

// Family ep 3: «أرسل لي الكود» — the WhatsApp verification-code takeover, for parents.
// Look: dark teal, floating cards (no phone frame like ep1), a spreading contact network (no map like ep2).

const LINES: Line[] = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const B = TL.beats;
export const FAMILY03_FRAMES = TL.frames;

const BG = '#041c1c';
const MINT = '#2ee6a6';
const RED = '#ff3b4e';
const SAND = '#ffe7b3';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const sp = (f: number, d = 0, damping = 14, stiffness = 160) => spring({frame: f - d, fps: 30, config: {damping, stiffness}});

const Cap: React.FC<{f: number; at: number; children: React.ReactNode; top?: number; size?: number; color?: string}> = ({f, at, children, top = 120, size = 80, color = '#fff'}) => {
  const p = sp(f, at, 15, 170);
  return (
    <div style={{position: 'absolute', top, left: 40, right: 40, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size,
      lineHeight: 1.3, color, opacity: p, transform: `translateY(${(1 - p) * 26}px)`, textShadow: '0 6px 30px rgba(0,0,0,.6)'}}>{children}</div>
  );
};

const CODE = '482913';
const Digits: React.FC<{f: number; size?: number; color?: string}> = ({f, size = 96, color = '#fff'}) => (
  <div style={{display: 'flex', gap: size * 0.14, direction: 'ltr', justifyContent: 'center'}}>
    {CODE.split('').map((d, i) => {
      const p = sp(f, 6 + i * 3, 12, 220);
      return (
        <React.Fragment key={i}>
          {i === 3 && <div style={{fontFamily: 'monospace', fontSize: size, color: '#6b8f8a', fontWeight: 900}}>-</div>}
          <div style={{width: size * 0.82, height: size * 1.15, borderRadius: size * 0.16, background: 'rgba(255,255,255,.08)', border: `3px solid ${color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 900, fontSize: size, color,
            transform: `translateY(${(1 - p) * -40}px)`, opacity: p}}>{d}</div>
        </React.Fragment>
      );
    })}
  </div>
);

// ---------- 1. hook: the code arrives, the "friend" asks for it ----------
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const sms = sp(f, -8, 13, 180);
  const chat = sp(f, 20, 12, 170);
  const typing = f > 12 && f < 22;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 150, left: 70, right: 70, background: '#0d2f2d', border: '2px solid #1d4c48', borderRadius: 36, padding: '30px 36px 40px',
        transform: `translateY(${(1 - sms) * -300}px)`, boxShadow: '0 30px 80px rgba(0,0,0,.5)'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', direction: 'rtl', fontFamily: FONT, fontWeight: 700, fontSize: 36, color: '#8fb8b2'}}>
          <span>💬 رسالة نصية</span><span style={{direction: 'ltr'}}>now</span>
        </div>
        <div style={{direction: 'rtl', fontFamily: FONT, fontWeight: 700, fontSize: 44, color: '#fff', margin: '16px 0 26px'}}>رمز تفعيل واتساب الخاص بك:</div>
        <Digits f={f + 30} />
        <div style={{direction: 'rtl', fontFamily: FONT, fontWeight: 700, fontSize: 36, color: SAND, marginTop: 26}}>لا تشارك هذا الرمز مع أحد.</div>
      </div>
      <div style={{position: 'absolute', top: 760, right: 70, display: 'flex', flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 22}}>
        <div style={{width: 120, height: 120, borderRadius: 60, background: '#ffc56b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 70,
          transform: `scale(${sp(f, 10)})`}}>🙂</div>
        <div style={{direction: 'rtl'}}>
          <div style={{fontFamily: FONT, fontWeight: 700, fontSize: 34, color: '#8fb8b2', marginBottom: 8, opacity: sp(f, 10)}}>سامي · صديق المدرسة</div>
          {typing ? (
            <div style={{background: '#fff', borderRadius: 34, borderTopRightRadius: 8, padding: '22px 34px', fontSize: 50, color: '#888', letterSpacing: 6}}>•••</div>
          ) : f >= 22 && (
            <div style={{maxWidth: 660, background: '#fff', borderRadius: 34, borderTopRightRadius: 8, padding: '24px 36px', fontFamily: FONT, fontWeight: 900, fontSize: 54,
              color: '#111', lineHeight: 1.35, transform: `scale(${chat})`, transformOrigin: 'right top', boxShadow: '0 20px 60px rgba(0,0,0,.4)'}}>
              أرسلتُ لك كودًا بالخطأ… <span style={{color: RED}}>أرسله لي بسرعة!</span> 🙏
            </div>
          )}
        </div>
      </div>
      <Cap f={f} at={60} top={1200} size={70} color={SAND}>رسالة عادية من صديق… صح؟</Cap>
    </AbsoluteFill>
  );
};

// ---------- 2. it isn't him ----------
const Hood: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 200 200">
    <path d="M100 18 C48 18 26 66 28 112 C30 150 22 178 14 196 L186 196 C178 178 170 150 172 112 C174 66 152 18 100 18 Z" fill="#0b0b0f" />
    <ellipse cx="100" cy="112" rx="44" ry="54" fill="#000" />
    <circle cx="84" cy="106" r="6" fill={RED} /><circle cx="116" cy="106" r="6" fill={RED} />
  </svg>
);
const NotHim: React.FC = () => {
  const f = useCurrentFrame();
  const flip = interpolate(f, [10, 26], [0, 180], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const shake = f > 26 && f < 40 ? Math.sin(f * 2.7) * 10 : 0;
  return (
    <AbsoluteFill>
      <Cap f={f} at={0} top={170}>صديق ابنك؟</Cap>
      <div style={{position: 'absolute', top: 430, left: 540 - 260, width: 520, height: 640, perspective: 1600, transform: `translateX(${shake}px)`}}>
        <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateY(${flip}deg)`}}>
          <div style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden', background: '#0d2f2d', border: '3px solid #1d4c48', borderRadius: 44,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30}}>
            <div style={{width: 300, height: 300, borderRadius: 150, background: '#ffc56b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 190}}>🙂</div>
            <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 60, color: '#fff'}}>سامي</div>
          </div>
          <div style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: '#1a0508', border: `4px solid ${RED}`, borderRadius: 44,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, boxShadow: `0 0 80px rgba(255,59,78,.45)`}}>
            <Hood size={360} />
            <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 56, color: RED}}>حساب مسروق</div>
          </div>
        </div>
      </div>
      <Cap f={f} at={34} top={1180} size={96} color={RED}>ليست منه!</Cap>
      <Cap f={f} at={50} top={1330} size={50} color="#bcd6d2">حسابه سُرق… واللص يكلّم أصدقاءه</Cap>
    </AbsoluteFill>
  );
};

// ---------- 3. the code is the key ----------
const Key: React.FC = () => {
  const f = useCurrentFrame();
  const slide = interpolate(f, [8, 30], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const open = interpolate(f, [34, 44], [0, 1], {...clamp, easing: Easing.out(Easing.back(2))});
  return (
    <AbsoluteFill>
      <Cap f={f} at={0} top={170}>هذا الكود = <span style={{color: MINT}}>مفتاح الحساب</span></Cap>
      <div style={{position: 'absolute', top: 470, width: '100%', transform: `translateX(${-slide * 120}px) scale(${1 - slide * 0.35})`}}>
        <Digits f={f + 20} size={100} color={MINT} />
      </div>
      <svg width={420} height={520} viewBox="0 0 200 250" style={{position: 'absolute', top: 760, left: 330}}>
        <path d={`M55 110 V70 a45 45 0 0 1 90 0 V${110 - open * 0}`} stroke={open > 0.5 ? MINT : '#cfe5e1'} strokeWidth="18" fill="none"
          transform={`translate(0 ${-open * 34})`} strokeLinecap="round" />
        <rect x="30" y="105" width="140" height="120" rx="22" fill={open > 0.5 ? MINT : '#cfe5e1'} />
        <circle cx="100" cy="155" r="16" fill={BG} /><rect x="93" y="160" width="14" height="34" rx="6" fill={BG} />
      </svg>
      <Cap f={f} at={40} top={1330} size={64} color={MINT}>من يملكه… يفتح واتساب ابنك</Cap>
    </AbsoluteFill>
  );
};

// ---------- 4. it spreads to every friend ----------
const NODES = Array.from({length: 12}, (_, i) => {
  const a = (i / 12) * Math.PI * 2 + 0.2, r = i % 2 ? 360 : 260;
  return {x: 540 + Math.cos(a) * r, y: 900 + Math.sin(a) * r * 1.15, d: 14 + (i % 6) * 9 + Math.floor(i / 6) * 4};
});
const Spread: React.FC = () => {
  const f = useCurrentFrame();
  const c = sp(f, 0, 12);
  return (
    <AbsoluteFill>
      <Cap f={f} at={0} top={150}>يسرق الحساب…</Cap>
      <Cap f={f} at={40} top={260} color={RED}>ويراسل كل أصدقائه</Cap>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        {NODES.map((n, i) => {
          const t = interpolate(f, [n.d, n.d + 12], [0, 1], clamp);
          return <line key={i} x1={540} y1={900} x2={540 + (n.x - 540) * t} y2={900 + (n.y - 900) * t} stroke={RED} strokeWidth={5} strokeOpacity={0.7} strokeDasharray="14 10" strokeDashoffset={-f * 3} />;
        })}
      </svg>
      {NODES.map((n, i) => {
        const hit = f >= n.d + 12;
        const p = sp(f, n.d + 12, 9, 220);
        return (
          <div key={i} style={{position: 'absolute', left: n.x - 60, top: n.y - 60, width: 120, height: 120, borderRadius: 60,
            background: hit ? '#3a0a12' : '#0d2f2d', border: `5px solid ${hit ? RED : '#2d6a63'}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 62, transform: `scale(${0.85 + (hit ? p * 0.15 : 0)})`, boxShadow: hit ? '0 0 40px rgba(255,59,78,.5)' : 'none'}}>
            {hit ? '💬' : ['👦', '👧', '👨', '👩', '👵', '👴'][i % 6]}
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 540 - 95, top: 900 - 95, width: 190, height: 190, borderRadius: 95, background: '#1a0508', border: `6px solid ${RED}`,
        transform: `scale(${c})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 ${50 + Math.sin(f / 4) * 20}px rgba(255,59,78,.6)`}}>
        <Hood size={150} />
      </div>
      <div style={{position: 'absolute', top: 1470, left: 120, right: 120, background: '#fff', borderRadius: 30, padding: '18px 30px', direction: 'rtl', fontFamily: FONT,
        fontWeight: 900, fontSize: 46, color: '#111', textAlign: 'center', opacity: sp(f, 60), transform: `scale(${sp(f, 60)})`}}>
        «أرسلتُ لك كودًا بالخطأ…» 🔁
      </div>
    </AbsoluteFill>
  );
};

// ---------- 5. the rule ----------
const Rule: React.FC = () => {
  const f = useCurrentFrame();
  const stamp = sp(f, 4, 8, 260);
  const fa = sp(f, 66, 12);
  const share = sp(f, 100, 13);
  return (
    <AbsoluteFill>
      <Cap f={f} at={0} top={140} size={64} color={MINT}>القاعدة الذهبية</Cap>
      <div style={{position: 'absolute', top: 280, left: 70, right: 70, background: '#fff', borderRadius: 40, padding: '40px 30px', textAlign: 'center',
        direction: 'rtl', fontFamily: FONT, fontWeight: 900, color: '#0b1f1e', transform: `scale(${1.6 - stamp * 0.6}) rotate(${(1 - stamp) * -8}deg)`, opacity: Math.min(1, stamp * 2),
        boxShadow: '0 30px 90px rgba(0,0,0,.5)'}}>
        <div style={{fontSize: 92, lineHeight: 1.25}}>الكود لا يُرسَل لأحد</div>
        <div style={{fontSize: 120, color: RED, lineHeight: 1.2}}>أبدًا.</div>
        <div style={{fontSize: 40, color: '#4d6b67', fontWeight: 700, marginTop: 8}}>لا لصديق، ولا لقريب، ولا لـ«الدعم الفني»</div>
      </div>
      <div style={{position: 'absolute', top: 860, right: 70, left: 70, direction: 'rtl', fontFamily: FONT, fontWeight: 900, color: '#fff', textAlign: 'center'}}>
        <div style={{fontSize: 52, background: '#0d2f2d', border: `3px solid ${MINT}`, borderRadius: 26, padding: '20px 26px', transform: `scale(${fa})`, transformOrigin: 'right center'}}>
          🔐 + فعّل <span style={{color: MINT}}>التحقق بخطوتين</span>
          <div style={{fontSize: 34, color: '#a9c9c4', fontWeight: 700, marginTop: 8}}>الإعدادات ← الحساب ← التحقق بخطوتين</div>
        </div>
        <div style={{fontSize: 48, marginTop: 40, color: SAND, opacity: share, transform: `translateY(${(1 - share) * 30}px)`}}>📲 أرسل الفيديو لمجموعة العائلة</div>
      </div>
      <AbsoluteFill><Mokaab frame={f} scale={0.5} y={-2.2} mood="smirk" wave={f > 60 ? 1 : 0} lookX={0.5} talk={speaking(LINES, f + B.rule)} rings={false} /></AbsoluteFill>
      <div style={{position: 'absolute', top: 1800, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 36, color: '#7fa7a1', direction: 'rtl', opacity: share}}>
        احمِ أطفالك على الإنترنت · <span style={{direction: 'ltr', display: 'inline-block'}}>@tech3almashi</span>
      </div>
    </AbsoluteFill>
  );
};

export const Family03Code: React.FC = () => {
  const f = useCurrentFrame();
  const glow = f >= B.spread && f < B.rule ? 'rgba(255,59,78,.16)' : 'rgba(46,230,166,.10)';
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 50% 40%, ${glow} 0%, rgba(0,0,0,0) 60%), ${BG}`, overflow: 'hidden'}}>
      <Sequence durationInFrames={B.nothim}><Hook /></Sequence>
      <Sequence from={B.nothim} durationInFrames={B.key - B.nothim}><NotHim /></Sequence>
      <Sequence from={B.key} durationInFrames={B.spread - B.key}><Key /></Sequence>
      <Sequence from={B.spread} durationInFrames={B.rule - B.spread}><Spread /></Sequence>
      <Sequence from={B.rule}><Rule /></Sequence>
      <VoiceTrack lines={LINES} />
      <Sfx name="ding" at={0} volume={0.45} />
      <Sfx name="pop" at={22} volume={0.5} />
      <Sfx name="whoosh" at={B.nothim + 10} volume={0.5} />
      <Sfx name="buzz" at={B.nothim + 27} volume={0.45} />
      <Sfx name="whoosh" at={B.key + 8} volume={0.45} />
      <Sfx name="click" at={B.key + 36} volume={0.55} />
      {NODES.map((n, i) => (i % 2 === 0 ? <Sfx key={i} name="blip" at={B.spread + n.d + 12} volume={0.4} /> : null))}
      <Sfx name="buzz" at={B.rule + 4} volume={0.5} />
      <Sfx name="pop" at={B.rule + 66} volume={0.5} />
      <Sfx name="pop" at={B.rule + 100} volume={0.45} />
    </AbsoluteFill>
  );
};
