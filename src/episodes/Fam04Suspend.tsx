import React from 'react';
import {AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, Easing} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';
import TL from './Fam04Suspend.timeline.json';

// Family ep 4: the fake «account suspended» message (phishing by fear + countdown), for parents.
// Look: charcoal + hazard-tape yellow, a giant alert screen, magnifier on the link, a fishing hook stealing the password.

const LINES: Line[] = TL.voice.map((v) => ({at: v.at, dur: Math.round(v.sec * 30), src: v.src}));
const B = TL.beats;
export const FAMILY04_FRAMES = TL.frames;

const COAL = '#121212';
const HAZ = '#ffc21a';
const RED = '#ff3d3d';
const OK = '#3ddc84';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const sp = (f: number, d = 0, damping = 14, stiffness = 170) => spring({frame: f - d, fps: 30, config: {damping, stiffness}});

const Tape: React.FC<{top: number; rot: number; f: number}> = ({top, rot, f}) => (
  <div style={{position: 'absolute', left: -200, right: -200, top, height: 64, transform: `rotate(${rot}deg)`,
    background: `repeating-linear-gradient(45deg, ${HAZ} 0 40px, #111 40px 80px)`, backgroundPosition: `${f * 3}px 0`, opacity: 0.9, boxShadow: '0 10px 30px rgba(0,0,0,.6)'}} />
);

const Cap: React.FC<{f: number; at: number; children: React.ReactNode; top?: number; size?: number; color?: string}> = ({f, at, children, top = 150, size = 76, color = '#fff'}) => {
  const p = sp(f, at, 15, 170);
  return (
    <div style={{position: 'absolute', top, left: 40, right: 40, textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.3,
      color, opacity: p, transform: `translateY(${(1 - p) * 26}px)`, textShadow: '0 6px 24px rgba(0,0,0,.7)'}}>{children}</div>
  );
};

const AlertCard: React.FC<{f: number; scale?: number; pulse?: boolean}> = ({f, scale = 1, pulse = true}) => {
  const secs = 3599 - Math.floor(f / 30);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0'), ss = String(secs % 60).padStart(2, '0');
  const beat = pulse ? 1 + Math.max(0, Math.sin(f / 4)) * 0.04 : 1;
  return (
    <div style={{width: 860, background: '#1c1c1c', borderRadius: 40, border: `5px solid ${RED}`, padding: '46px 40px', boxSizing: 'border-box', textAlign: 'center', direction: 'rtl',
      transform: `scale(${scale})`, boxShadow: `0 0 ${60 + Math.sin(f / 4) * 25}px rgba(255,61,61,.45)`}}>
      <div style={{fontSize: 120, lineHeight: 1}}>⚠️</div>
      <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 82, color: '#fff', marginTop: 16}}>تمّ إيقاف حسابك!</div>
      <div style={{fontFamily: FONT, fontWeight: 700, fontSize: 40, color: '#c9c9c9', marginTop: 10}}>سيُحذف حسابك نهائيًا إذا لم تؤكّد بياناتك خلال:</div>
      <div style={{fontFamily: 'monospace', fontWeight: 900, fontSize: 110, color: RED, marginTop: 14, direction: 'ltr'}}>00:{mm}:{ss}</div>
      <div style={{marginTop: 26, display: 'inline-block', background: RED, color: '#fff', fontFamily: FONT, fontWeight: 900, fontSize: 56, borderRadius: 26, padding: '16px 60px',
        transform: `scale(${beat})`}}>استعادة الحساب الآن</div>
    </div>
  );
};

// ---------- 1. the alert itself, from frame 0 ----------
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const shake = f < 18 ? Math.sin(f * 2.2) * (18 - f) * 0.8 : 0;
  return (
    <AbsoluteFill>
      <Tape top={150} rot={-6} f={f} />
      <Tape top={1660} rot={5} f={-f} />
      <div style={{position: 'absolute', top: 420, left: 110, transform: `translateX(${shake}px)`}}><AlertCard f={f} /></div>
      <Cap f={f} at={30} top={1330} size={58} color={HAZ}>وصلت هذه الرسالة لهاتف ابنك…</Cap>
    </AbsoluteFill>
  );
};

// ---------- 2. fear makes him click ----------
const Fear: React.FC = () => {
  const f = useCurrentFrame();
  const fx = interpolate(f, [6, 44], [880, 560], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const fy = interpolate(f, [6, 44], [1700, 1265], {...clamp, easing: Easing.inOut(Easing.cubic)});
  return (
    <AbsoluteFill>
      <Cap f={f} at={0} top={170}>تُخيفه… <span style={{color: RED}}>ليضغط بسرعة</span></Cap>
      <div style={{position: 'absolute', top: 420, left: 110, filter: `saturate(${1 + f / 60})`}}><AlertCard f={f + B.fear} /></div>
      <div style={{position: 'absolute', left: fx, top: fy, fontSize: 150, transform: 'rotate(-20deg)', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,.6))'}}>👆</div>
      <div style={{position: 'absolute', top: 1560, width: '100%', display: 'flex', justifyContent: 'center', gap: 24, direction: 'rtl'}}>
        {['خوف', '+', 'عدّاد', '=', 'ضغطة'].map((t, i) => (
          <div key={i} style={{fontFamily: FONT, fontWeight: 900, fontSize: 60, color: t === 'ضغطة' ? COAL : '#fff', background: t === 'ضغطة' ? HAZ : 'transparent',
            borderRadius: 16, padding: '0 22px', transform: `scale(${sp(f, 20 + i * 6, 11, 220)})`}}>{t}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---------- 3. the link is not theirs ----------
const LinkCheck: React.FC = () => {
  const f = useCurrentFrame();
  const mag = interpolate(f, [4, 30], [560, 95], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const bad = sp(f, 30, 9, 240);
  const URL = 'acc0unt-security-check.co/login';
  return (
    <AbsoluteFill>
      <Cap f={f} at={0} top={170}>الرابط <span style={{color: RED}}>ليس من الشركة</span></Cap>
      <div style={{position: 'absolute', top: 560, left: 60, right: 60, height: 150, background: '#1f1f1f', borderRadius: 75, border: '3px solid #333',
        display: 'flex', alignItems: 'center', padding: '0 50px', gap: 22, direction: 'ltr', overflow: 'hidden'}}>
        <div style={{fontSize: 56}}>🔒</div>
        <div style={{fontFamily: 'monospace', fontSize: 40, color: '#ddd', whiteSpace: 'nowrap'}}>
          {URL.split('').map((ch, i) => <span key={i} style={{color: i === 3 && bad > 0.5 ? RED : undefined, fontWeight: i === 3 ? 900 : 400}}>{ch}</span>)}
        </div>
      </div>
      {/* magnifier */}
      <div style={{position: 'absolute', top: 470, left: 60 + mag, width: 330, height: 330, borderRadius: '50%', border: `16px solid ${HAZ}`, boxSizing: 'border-box',
        background: 'radial-gradient(circle, rgba(255,255,255,.08), rgba(255,255,255,0))', boxShadow: '0 20px 60px rgba(0,0,0,.6)'}}>
        <div style={{position: 'absolute', right: -90, bottom: -70, width: 140, height: 34, borderRadius: 17, background: HAZ, transform: 'rotate(45deg)'}} />
      </div>
      <div style={{position: 'absolute', top: 900, width: '100%', textAlign: 'center', direction: 'rtl', transform: `scale(${bad})`}}>
        <div style={{display: 'inline-block', fontFamily: FONT, fontWeight: 900, fontSize: 64, color: '#fff', background: '#2a1212', border: `4px solid ${RED}`, borderRadius: 24, padding: '14px 40px'}}>
          صفر <span style={{fontFamily: 'monospace', color: RED}}>0</span> مكان حرف <span style={{fontFamily: 'monospace', color: OK}}>o</span>
        </div>
        <div style={{fontFamily: FONT, fontWeight: 700, fontSize: 46, color: '#bbb', marginTop: 30}}>والقفل 🔒 لا يعني أنّ الموقع آمن</div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- 4. the page steals the password ----------
const Steal: React.FC = () => {
  const f = useCurrentFrame();
  const typed = Math.min(8, Math.floor(f / 3));
  const pull = interpolate(f, [28, 48], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  return (
    <AbsoluteFill>
      <Cap f={f} at={0} top={170}>والصفحة <span style={{color: RED}}>تسرق كلمة السر</span></Cap>
      <div style={{position: 'absolute', top: 470, left: 140, width: 800, background: '#f3f3f3', borderRadius: 34, padding: '44px 46px', boxSizing: 'border-box', direction: 'rtl'}}>
        <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 52, color: '#111', marginBottom: 26}}>تسجيل الدخول</div>
        <div style={{height: 96, borderRadius: 18, background: '#fff', border: '3px solid #ccc', marginBottom: 22, display: 'flex', alignItems: 'center', padding: '0 26px',
          fontFamily: 'monospace', fontSize: 40, color: '#333', direction: 'ltr'}}>ali_2013</div>
        <div style={{height: 96, borderRadius: 18, background: '#fff', border: `3px solid ${pull > 0 ? RED : '#ccc'}`, display: 'flex', alignItems: 'center', padding: '0 26px',
          fontSize: 54, color: '#111', letterSpacing: 8, direction: 'ltr', transform: `translate(${pull * 260}px, ${-pull * 700}px) rotate(${pull * 25}deg)`, opacity: 1 - pull * 0.2}}>
          {'•'.repeat(typed)}
        </div>
      </div>
      {/* fishing hook coming down */}
      <svg width={260} height={760} viewBox="0 0 260 760" style={{position: 'absolute', left: 640, top: -760 + interpolate(f, [8, 28], [0, 1], clamp) * 1240 - pull * 700}}>
        <line x1={130} y1={0} x2={130} y2={640} stroke="#ddd" strokeWidth={4} />
        <path d="M130 640 L130 700 C130 760 60 760 60 700 L60 680" stroke={HAZ} strokeWidth={14} fill="none" strokeLinecap="round" />
        <path d="M60 680 L44 700 M60 680 L78 696" stroke={HAZ} strokeWidth={10} strokeLinecap="round" />
      </svg>
      <div style={{position: 'absolute', top: 1300, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 58, color: HAZ, direction: 'rtl', opacity: sp(f, 34)}}>
        🎣 اسمها: تصيّد (Phishing)
      </div>
    </AbsoluteFill>
  );
};

// ---------- 5. the rule ----------
const Rule: React.FC = () => {
  const f = useCurrentFrame();
  const a = sp(f, 2, 10, 220), b = sp(f, 50, 12), share = sp(f, 110, 13);
  return (
    <AbsoluteFill>
      <Tape top={110} rot={-3} f={f} />
      <div style={{position: 'absolute', top: 260, left: 60, right: 60, display: 'flex', gap: 30, direction: 'rtl'}}>
        <div style={{flex: 1, background: '#2a1212', border: `5px solid ${RED}`, borderRadius: 34, padding: '34px 20px', textAlign: 'center', transform: `scale(${a})`}}>
          <div style={{fontSize: 110}}>🔗</div>
          <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 58, color: RED}}>لا تدخل من الرابط</div>
        </div>
        <div style={{flex: 1, background: '#10261a', border: `5px solid ${OK}`, borderRadius: 34, padding: '34px 20px', textAlign: 'center', transform: `scale(${b})`}}>
          <div style={{fontSize: 110}}>📱</div>
          <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 58, color: OK}}>افتح التطبيق بنفسك</div>
        </div>
      </div>
      <div style={{position: 'absolute', top: 760, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 44, color: '#cfcfcf', direction: 'rtl', opacity: b}}>
        إن كان الحساب موقوفًا فعلًا… ستجد التنبيه داخل التطبيق
      </div>
      <AbsoluteFill><Mokaab frame={f} scale={0.55} y={-1.3} mood="smirk" wave={f > 40 ? 1 : 0} talk={speaking(LINES, f + B.rule)} rings={false} /></AbsoluteFill>
      <div style={{position: 'absolute', top: 1620, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 50, color: HAZ, direction: 'rtl', opacity: share,
        transform: `translateY(${(1 - share) * 30}px)`}}>📲 أرسله لمجموعة العائلة</div>
      <div style={{position: 'absolute', top: 1720, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 34, color: '#8a8a8a', direction: 'rtl', opacity: share}}>
        احمِ أطفالك على الإنترنت · الحلقة 4 · <span style={{direction: 'ltr', display: 'inline-block'}}>@tech3almashi</span>
      </div>
    </AbsoluteFill>
  );
};

export const Family04Suspend: React.FC = () => {
  const f = useCurrentFrame();
  const redWash = f < B.link ? 0.14 + Math.max(0, Math.sin(f / 4)) * 0.06 : 0.04;
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 50% 40%, rgba(255,61,61,${redWash}) 0%, rgba(0,0,0,0) 65%), ${COAL}`, overflow: 'hidden'}}>
      <Sequence durationInFrames={B.fear}><Hook /></Sequence>
      <Sequence from={B.fear} durationInFrames={B.link - B.fear}><Fear /></Sequence>
      <Sequence from={B.link} durationInFrames={B.steal - B.link}><LinkCheck /></Sequence>
      <Sequence from={B.steal} durationInFrames={B.rule - B.steal}><Steal /></Sequence>
      <Sequence from={B.rule}><Rule /></Sequence>
      <VoiceTrack lines={LINES} />
      <Sfx name="buzz" at={0} volume={0.5} />
      {Array.from({length: 6}, (_, i) => <Sfx key={i} name="tick" at={30 + i * 30} volume={0.35} />)}
      {[0, 1, 2, 3, 4].map((i) => <Sfx key={`e${i}`} name="pop" at={B.fear + 20 + i * 6} volume={0.4} />)}
      <Sfx name="click" at={B.fear + 44} volume={0.55} />
      <Sfx name="whoosh" at={B.link + 4} volume={0.45} />
      <Sfx name="buzz" at={B.link + 30} volume={0.45} />
      {Array.from({length: 8}, (_, i) => <Sfx key={`k${i}`} name="tick" at={B.steal + i * 3} volume={0.3} />)}
      <Sfx name="whoosh" at={B.steal + 28} volume={0.5} />
      <Sfx name="pop" at={B.rule + 2} volume={0.5} />
      <Sfx name="ding" at={B.rule + 50} volume={0.5} />
      <Sfx name="pop" at={B.rule + 110} volume={0.45} />
    </AbsoluteFill>
  );
};
