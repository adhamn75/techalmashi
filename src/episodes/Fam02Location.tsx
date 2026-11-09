import React from 'react';
import {AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame} from 'remotion';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import {FONT, Mokaab} from '../shared/Mascot';
import {Sfx} from '../shared/Sfx';
import {VoiceTrack, speaking, Line} from '../shared/Voice';

// Family series, episode 2: location sharing left on (live-location apps + GPS saved in photos).

// measured, trimmed voice lengths in seconds (public/voice/family02/<n>.wav)
const SEC = [2.05, 2.51, 2.38, 1.59, 2.11, 1.64];
const GAP = 8;
const starts: number[] = [];
SEC.forEach((s, i) => starts.push(i === 0 ? 6 : starts[i - 1] + Math.round(SEC[i - 1] * 30) + GAP));
const LINES: Line[] = SEC.map((s, i) => ({at: starts[i], dur: Math.round(s * 30), src: `voice/family02/${i}.wav`}));

const S_APPS = starts[1] - 4;
const S_PHOTO = starts[2] - 4;
const S_FIX = starts[3] - 6;
const S_END = starts[5] - 4;
export const FAMILY02_FRAMES = starts[5] + Math.round(SEC[5] * 30) + 32;

const SAND = '#f3ead6';
const ROAD = '#ffffff';
const PARK = '#cfe6bf';
const WATER = '#bcdcee';
const INK = '#1f2a37';
const ORANGE = '#ff7a1a';
const KID = '#2563eb';
const RED = '#e11d48';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const KX = 540, KY = 900; // the child's pin on the map

// ---------- the city map, drawn in SVG ----------
const CityMap: React.FC<{zoom: number; blur?: number}> = ({zoom, blur = 0}) => (
  <svg width={1080} height={1920} style={{position: 'absolute', transform: `scale(${zoom})`, transformOrigin: `${KX}px ${KY}px`, filter: `blur(${blur}px)`}}>
    <rect width={1080} height={1920} fill={SAND} />
    <path d="M0 1500 C 250 1440 420 1600 700 1540 S 1000 1480 1080 1520 L1080 1920 L0 1920 Z" fill={WATER} />
    <rect x={640} y={300} width={300} height={260} rx={30} fill={PARK} />
    <rect x={90} y={1080} width={260} height={220} rx={30} fill={PARK} />
    {[200, 470, 760, 1040, 1300].map((y) => <rect key={y} x={0} y={y} width={1080} height={34} fill={ROAD} />)}
    {[160, 420, 600, 880].map((x) => <rect key={x} x={x} y={0} width={34} height={1480} fill={ROAD} />)}
    <path d="M0 640 L1080 1180" stroke="#ffd9a8" strokeWidth={46} />
    {/* blocks */}
    {[[230, 260], [480, 520], [230, 820], [660, 820], [480, 1100], [700, 1100], [930, 640], [60, 520]].map(([x, y], i) => (
      <rect key={i} x={x} y={y} width={150} height={120} rx={14} fill="#e6dac0" />
    ))}
  </svg>
);

const KidPin: React.FC<{f: number; p: number}> = ({f, p}) => {
  const ring = (f % 40) / 40;
  return (
    <div style={{position: 'absolute', left: KX, top: KY, transform: `translate(-50%,-50%) scale(${p})`}}>
      <div style={{position: 'absolute', left: -90, top: -90, width: 180, height: 180, borderRadius: 90, border: `6px solid ${KID}`,
        transform: `scale(${0.5 + ring * 1.4})`, opacity: 1 - ring}} />
      <div style={{width: 120, height: 120, borderRadius: 60, background: KID, border: '8px solid white', boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64}}>🧒</div>
      <div style={{position: 'absolute', top: 132, left: '50%', transform: 'translateX(-50%)', background: KID, color: 'white',
        fontFamily: FONT, fontWeight: 900, fontSize: 38, padding: '2px 22px', borderRadius: 20, whiteSpace: 'nowrap'}}>ابنك</div>
    </div>
  );
};

const STRANGERS = [{x: 170, y: 520, at: 18}, {x: 900, y: 600, at: 28}, {x: 150, y: 1280, at: 38}, {x: 930, y: 1250, at: 48}];
const Strangers: React.FC<{f: number}> = ({f}) => (
  <>
    <svg width={1080} height={1920} style={{position: 'absolute'}}>
      {STRANGERS.map((s, i) => {
        const k = interpolate(f, [s.at, s.at + 12], [0, 1], clamp);
        return <line key={i} x1={s.x} y1={s.y} x2={s.x + (KX - s.x) * k} y2={s.y + (KY - s.y) * k} stroke={RED}
          strokeWidth={6} strokeDasharray="18 14" strokeDashoffset={-f * 2} opacity={0.8} />;
      })}
    </svg>
    {STRANGERS.map((s, i) => {
      const p = spring({frame: f - s.at, fps: 30, config: {damping: 10}});
      return (
        <div key={i} style={{position: 'absolute', left: s.x, top: s.y, transform: `translate(-50%,-50%) scale(${p})`, width: 104, height: 104,
          borderRadius: 52, background: '#475569', border: `6px solid ${RED}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: FONT, fontWeight: 900, fontSize: 60, color: 'white'}}>؟</div>
      );
    })}
  </>
);

const Caption: React.FC<{children: React.ReactNode; p?: number; top?: number; bg?: string}> = ({children, p = 1, top = 110, bg = INK}) => (
  <div style={{position: 'absolute', top, width: '100%', display: 'flex', justifyContent: 'center', opacity: p, transform: `translateY(${(1 - p) * -30}px)`}}>
    <div style={{background: bg, color: 'white', fontFamily: FONT, fontWeight: 900, fontSize: 70, lineHeight: 1.3, padding: '18px 44px',
      borderRadius: 34, direction: 'rtl', textAlign: 'center', maxWidth: 940, boxShadow: '0 16px 40px rgba(0,0,0,0.3)'}}>{children}</div>
  </div>
);

// ---------- 1 + 2: the map, strangers, live sharing ----------
const MapScene: React.FC = () => {
  const f = useCurrentFrame();
  const zoom = interpolate(f, [0, S_PHOTO], [1.08, 1], clamp);
  const pin = spring({frame: f, fps: 30, config: {damping: 11}, from: 0.6});
  const apps = f >= S_APPS;
  const card = spring({frame: f - S_APPS, fps: 30, config: {damping: 13}});
  return (
    <AbsoluteFill>
      <CityMap zoom={zoom} />
      <Strangers f={f} />
      <KidPin f={f} p={pin} />
      {!apps && <Caption>هل يعرف <span style={{color: '#fca5a5'}}>الغرباء</span><br />أين ابنك الآن؟</Caption>}
      {apps && (
        <>
          <Caption p={card}>تطبيقات تشارك<br />موقعه <span style={{color: ORANGE}}>المباشر</span></Caption>
          <div style={{position: 'absolute', top: 1090, left: '50%', transform: `translateX(-50%) scale(${card})`, background: 'white', borderRadius: 30,
            padding: '20px 34px', display: 'flex', alignItems: 'center', gap: 22, direction: 'rtl', boxShadow: '0 18px 40px rgba(0,0,0,0.25)'}}>
            <div style={{width: 26, height: 26, borderRadius: 13, background: RED, opacity: f % 20 < 12 ? 1 : 0.3}} />
            <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 46, color: INK}}>الموقع المباشر: <span style={{color: RED}}>مُفعَّل</span></div>
          </div>
        </>
      )}
      <AbsoluteFill><Mokaab frame={f} scale={0.34} y={-2.95} mood={f < 40 ? 'happy' : 'shock'} talk={speaking(LINES, f)} lookX={0.4} /></AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- 3: the photo carries GPS ----------
const Photo: React.FC = () => {
  const f = useCurrentFrame();
  const g = f + S_PHOTO;
  const ph = spring({frame: f, fps: 30, config: {damping: 12}});
  const info = spring({frame: f - 22, fps: 30, config: {damping: 13}});
  const pinFly = interpolate(f, [34, 56], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <CityMap zoom={1} blur={10} />
      <AbsoluteFill style={{background: 'rgba(31,42,55,0.35)'}} />
      <Caption>الصورة قد تحفظ <span style={{color: ORANGE}}>الموقع</span></Caption>
      {/* polaroid with a simple drawn scene: a kid in front of the house */}
      <div style={{position: 'absolute', top: 340, left: 170, width: 740, background: 'white', padding: '26px 26px 90px', borderRadius: 12,
        transform: `rotate(${-4 * ph}deg) scale(${ph})`, boxShadow: '0 30px 70px rgba(0,0,0,0.4)'}}>
        <svg width={688} height={560}>
          <rect width={688} height={560} fill="#9bd3f5" />
          <circle cx={570} cy={110} r={60} fill="#ffd166" />
          <rect y={420} width={688} height={140} fill="#8bc34a" />
          <rect x={120} y={240} width={300} height={200} fill="#f4a261" />
          <polygon points="100,250 270,130 440,250" fill="#c0392b" />
          <rect x={240} y={330} width={70} height={110} fill="#6d4c41" />
          <rect x={150} y={280} width={60} height={50} fill="#e0f2fe" />
          <circle cx={520} cy={330} r={40} fill="#f1c27d" />
          <rect x={485} y={370} width={70} height={110} rx={20} fill={KID} />
        </svg>
      </div>
      {/* metadata panel */}
      <div style={{position: 'absolute', top: 1110, left: 110, right: 110, background: INK, borderRadius: 28, padding: '26px 36px',
        opacity: info, transform: `translateY(${(1 - info) * 60}px)`, fontFamily: 'monospace', fontSize: 40, color: '#e5e7eb', direction: 'ltr', lineHeight: 1.6}}>
        <div style={{color: '#94a3b8'}}>IMG_2048.jpg · info</div>
        <div>📍 GPS <span style={{color: ORANGE}}>33.8938, 35.5018</span></div>
        <div style={{color: '#94a3b8'}}>Camera · 17:42</div>
      </div>
      {/* the pin leaving the photo */}
      <div style={{position: 'absolute', left: 540 + pinFly * 220, top: 700 - pinFly * 420, fontSize: 110, opacity: pinFly > 0 ? 1 : 0,
        transform: `translate(-50%,-50%) scale(${0.6 + pinFly * 0.6})`}}>📍</div>
      <AbsoluteFill><Mokaab frame={g} scale={0.34} y={-2.95} mood="shock" talk={speaking(LINES, g)} lookX={-0.4} /></AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- 4: the fix, two switches ----------
const Toggle: React.FC<{label: string; on: number; icon: string; good: boolean; p: number}> = ({label, on, icon, good, p}) => (
  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', direction: 'rtl', background: 'white', borderRadius: 34,
    padding: '30px 40px', boxShadow: '0 16px 40px rgba(0,0,0,0.18)', opacity: p, transform: `translateX(${(1 - p) * 200}px)`,
    outline: good ? '6px solid #22c55e' : 'none'}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
      <div style={{fontSize: 70}}>{icon}</div>
      <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 54, color: INK}}>{label}</div>
    </div>
    <div style={{width: 170, height: 96, borderRadius: 48, background: on > 0.5 ? '#22c55e' : '#cbd5e1', position: 'relative', direction: 'ltr'}}>
      <div style={{position: 'absolute', top: 8, left: 8 + on * 74, width: 80, height: 80, borderRadius: 40, background: 'white', boxShadow: '0 4px 10px rgba(0,0,0,0.25)'}} />
    </div>
  </div>
);

const Fix: React.FC = () => {
  const f = useCurrentFrame();
  const g = f + S_FIX;
  const t2 = starts[4] - S_FIX;
  const cam = interpolate(f, [22, 32], [1, 0], clamp);
  const ghost = interpolate(f, [t2 + 18, t2 + 28], [0, 1], clamp);
  const a = spring({frame: f, fps: 30, config: {damping: 13}});
  const b = spring({frame: f - t2 + 6, fps: 30, config: {damping: 13}});
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg, #fff7ec 0%, #ffe8cc 100%)'}}>
      <Caption bg={ORANGE}>الحلّ في دقيقة ✅</Caption>
      <div style={{position: 'absolute', top: 420, left: 70, right: 70, display: 'flex', flexDirection: 'column', gap: 50}}>
        <Toggle label="الموقع للكاميرا" icon="📷" on={cam} good={cam < 0.5} p={a} />
        <Toggle label="وضع الشبح" icon="👻" on={ghost} good={ghost > 0.5} p={b} />
      </div>
      <div style={{position: 'absolute', top: 1000, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 50, color: '#7c4a1a', direction: 'rtl',
        opacity: b}}>في سناب شات: الخريطة ← الإعدادات</div>
      <AbsoluteFill><Mokaab frame={g} scale={0.44} y={-2.4} mood="happy" talk={speaking(LINES, g)} wave={ghost} /></AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- 5: CTA ----------
const End: React.FC = () => {
  const f = useCurrentFrame();
  const g = f + S_END;
  const a = spring({frame: f, fps: 30, config: {damping: 11}});
  const b = spring({frame: f - 12, fps: 30, config: {damping: 13}});
  return (
    <AbsoluteFill>
      <CityMap zoom={1} blur={6} />
      <AbsoluteFill style={{background: 'rgba(255,247,236,0.55)'}} />
      <AbsoluteFill><Mokaab frame={g} scale={a * 0.66} y={0.9} mood="happy" wave={1} talk={speaking(LINES, g)} /></AbsoluteFill>
      <div style={{position: 'absolute', top: 1150, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: FONT, fontWeight: 900}}>
        <div style={{display: 'inline-block', background: KID, color: 'white', fontSize: 66, padding: '18px 54px', borderRadius: 70,
          transform: `scale(${a})`, boxShadow: '0 16px 40px rgba(37,99,235,0.4)'}}>أرسله لمجموعة العائلة</div>
        <div style={{marginTop: 40, fontSize: 46, color: INK, opacity: b}}>تك عالماشي · خلّيك ذكي!</div>
        <div style={{marginTop: 14, fontSize: 40, color: '#64748b', direction: 'ltr', opacity: b}}>@tech3almashi</div>
      </div>
    </AbsoluteFill>
  );
};

export const Family02Location: React.FC = () => (
  <AbsoluteFill style={{background: SAND}}>
    <Sequence durationInFrames={S_PHOTO}><MapScene /></Sequence>
    <Sequence from={S_PHOTO} durationInFrames={S_FIX - S_PHOTO}><Photo /></Sequence>
    <Sequence from={S_FIX} durationInFrames={S_END - S_FIX}><Fix /></Sequence>
    <Sequence from={S_END} durationInFrames={FAMILY02_FRAMES - S_END}><End /></Sequence>
    <VoiceTrack lines={LINES} />
    {STRANGERS.map((s) => <Sfx key={s.at} name="blip" at={s.at} volume={0.45} />)}
    <Sfx name="buzz" at={S_APPS + 4} volume={0.45} />
    <Sfx name="whoosh" at={S_PHOTO} volume={0.5} />
    <Sfx name="pop" at={S_PHOTO + 34} volume={0.5} />
    <Sfx name="click" at={S_FIX + 22} volume={0.6} />
    <Sfx name="click" at={starts[4] - S_FIX + S_FIX + 18} volume={0.6} />
    <Sfx name="ding" at={S_END + 4} volume={0.5} />
  </AbsoluteFill>
);
