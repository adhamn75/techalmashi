import React from 'react';
import {useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {AbuKhalye} from './AbuKhalye';
import {ShieldHost, ShieldLights} from './ShieldHost';

export const GREEN = '#21c46b';
export const BG = '#0b1410';
export const FONT = 'Cairo, sans-serif';

export type Mood = 'smirk' | 'happy' | 'shock';

type Props = {
  frame: number;      // local frame, drives idle motion + blink
  scale?: number;
  y?: number;         // world-space vertical offset
  mood?: Mood;
  wink?: number;      // 0..1 closes the right eye
  lookX?: number;     // -1..1 pupil direction
  tilt?: number;      // body z-rotation
  spin?: number;      // body y-rotation
  wave?: number;
  talk?: number;
  outfit?: 'tie' | 'shield';
};

// Original mascot "مكعّب": a green spreadsheet-cell cube with a face.
const Body: React.FC<Props> = ({frame, mood = 'smirk', wink = 0, lookX = 0, tilt = 0, spin = 0}) => {
  const bob = Math.sin(frame / 9) * 0.08;
  const blinkPhase = frame % 75;
  const blink = blinkPhase > 70 ? 0.1 : 1;
  const eyeY = 0.18;
  const pupilShift = lookX * 0.07;
  const shock = mood === 'shock';
  const eyeR = shock ? 0.24 : 0.2;

  return (
    <group position={[0, bob, 0]} rotation={[0.18, -0.35 + spin + Math.sin(frame / 25) * 0.08, tilt]}>
      {/* body */}
      <mesh>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color={GREEN} roughness={0.4} />
      </mesh>
      {/* grid lines on the front, like a spreadsheet cell block */}
      {[-0.34, 0.34].map((p) => (
        <React.Fragment key={p}>
          <mesh position={[p, 0, 1.005]}><planeGeometry args={[0.025, 2]} /><meshBasicMaterial color="#178f4e" /></mesh>
          <mesh position={[0, p, 1.005]}><planeGeometry args={[2, 0.025]} /><meshBasicMaterial color="#178f4e" /></mesh>
        </React.Fragment>
      ))}
      {/* eyes */}
      {[-0.42, 0.42].map((ex, i) => {
        const closed = i === 1 ? Math.max(0, 1 - wink) : 1;
        return (
          <group key={ex} position={[ex, eyeY, 1.02]} scale={[1, blink * closed + 0.05, 1]}>
            <mesh><sphereGeometry args={[eyeR, 32, 16]} /><meshStandardMaterial color="white" roughness={0.2} /></mesh>
            <mesh position={[pupilShift, -0.02, eyeR * 0.75]}>
              <sphereGeometry args={[eyeR * 0.45, 24, 12]} />
              <meshStandardMaterial color="#0b1410" roughness={0.1} />
            </mesh>
          </group>
        );
      })}
      {/* brows */}
      {[-0.42, 0.42].map((bx, i) => {
        const r = mood === 'smirk' ? (i === 0 ? 0.25 : -0.05) : shock ? (i === 0 ? -0.2 : 0.2) : 0;
        return (
          <mesh key={bx} position={[bx, eyeY + (shock ? 0.42 : 0.34), 1.03]} rotation={[0, 0, r]}>
            <boxGeometry args={[0.36, 0.07, 0.04]} />
            <meshStandardMaterial color="#0b3d22" />
          </mesh>
        );
      })}
      {/* mouth */}
      {shock ? (
        <mesh position={[0, -0.42, 1.02]}>
          <circleGeometry args={[0.16, 32]} />
          <meshBasicMaterial color="#0b3d22" />
        </mesh>
      ) : (
        <mesh
          position={[mood === 'smirk' ? 0.08 : 0, -0.32, 1.03]}
          rotation={[0, 0, mood === 'smirk' ? Math.PI + 0.35 : Math.PI]}
        >
          <torusGeometry args={[mood === 'happy' ? 0.32 : 0.24, 0.045, 12, 32, Math.PI]} />
          <meshStandardMaterial color="#0b3d22" />
        </mesh>
      )}
    </group>
  );
};

// Channel host. Now the animated shield ("تك عالماشي" logo); the old Abu Khalye body stays in AbuKhalye.tsx
// and can be brought back with legacy={true}. Same props, so every episode switches at once.
export const Mokaab: React.FC<Props & {legacy?: boolean; rings?: boolean}> = (props) => {
  const {width, height} = useVideoConfig();
  if (props.legacy) {
    return (
      <ThreeCanvas width={width} height={height} camera={{position: [0, 0, 10], fov: 40}}>
        <ambientLight intensity={0.65} />
        <directionalLight position={[4, 6, 8]} intensity={1.3} />
        <directionalLight position={[-6, -2, 3]} intensity={0.4} color={GREEN} />
        <group scale={props.scale ?? 1} position={[0, props.y ?? 0, 0]}>
          <AbuKhalye {...props} />
        </group>
      </ThreeCanvas>
    );
  }
  return (
    <ThreeCanvas width={width} height={height} camera={{position: [0, 0, 10], fov: 40}}>
      <ShieldLights />
      <group scale={(props.scale ?? 1) * 0.92} position={[0, (props.y ?? 0) + 0.15, 0]}>
        <ShieldHost {...props} />
      </group>
    </ThreeCanvas>
  );
};

export const Bubble: React.FC<{text: string; p: number; top: number}> = ({text, p, top}) => (
  <div
    style={{
      position: 'absolute', top, left: '50%', transform: `translateX(-50%) scale(${p})`,
      transformOrigin: 'bottom center', background: 'white', color: BG, fontFamily: FONT,
      fontWeight: 900, fontSize: 66, padding: '22px 50px', borderRadius: 50, direction: 'rtl',
      whiteSpace: 'nowrap', boxShadow: '0 14px 40px rgba(0,0,0,0.5)',
    }}
  >
    {text}
    <div style={{position: 'absolute', bottom: -26, left: '50%', marginLeft: -20, width: 0, height: 0,
      borderLeft: '20px solid transparent', borderRight: '20px solid transparent', borderTop: '30px solid white'}} />
  </div>
);

export const Key: React.FC<{label: string}> = ({label}) => (
  <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 80, color: BG, background: 'white',
    borderRadius: 22, padding: '10px 44px', boxShadow: '0 12px 0 #9ab3a6'}}>{label}</div>
);

export const SeriesTag: React.FC<{ep: number; o: number}> = ({ep, o}) => (
  <div style={{position: 'absolute', top: 70, width: '100%', textAlign: 'center', opacity: o,
    fontFamily: FONT, fontWeight: 700, fontSize: 40, color: '#9fb8ab', direction: 'rtl'}}>
    شغل ساعة بثانية · الحلقة {ep}
  </div>
);
