import React from 'react';

// "أبو خلية" — an original mascot: a chubby green spreadsheet-cell office guy
// with googly eyes behind round glasses, a big moustache, a red tie and tiny limbs.
// Everything is primitive geometry, no image or AI asset.

export type Mood = 'smirk' | 'happy' | 'shock';

export type MascotProps = {
  frame: number;
  mood?: Mood;
  wink?: number;   // 0..1 closes right eye
  lookX?: number;  // -1..1
  tilt?: number;
  spin?: number;
  wave?: number;   // 0..1 right arm waving
  talk?: number;   // 0..1 mouth/moustache flap
};

const GREEN = '#21c46b';
const DARK = '#0b3d22';
const STACHE = '#2a1a10';
const TIE = '#e5383b';

const Eye: React.FC<{x: number; r: number; open: number; pupilX: number; pupilY: number}> = ({x, r, open, pupilX, pupilY}) => (
  <group position={[x, 0.45, 0.8]}>
    <group scale={[1, Math.max(0.06, open), 1]}>
      <mesh><sphereGeometry args={[r, 32, 16]} /><meshStandardMaterial color="white" roughness={0.15} /></mesh>
      <mesh position={[pupilX, pupilY, r * 0.8]}>
        <sphereGeometry args={[r * 0.42, 24, 12]} />
        <meshStandardMaterial color="#111" roughness={0.1} />
      </mesh>
    </group>
    {/* glasses rim */}
    <mesh position={[0, 0, r * 0.55]}>
      <torusGeometry args={[r + 0.05, 0.035, 12, 40]} />
      <meshStandardMaterial color="#1a1a1a" roughness={0.3} />
    </mesh>
  </group>
);

export const AbuKhalye: React.FC<MascotProps> = ({
  frame, mood = 'happy', wink = 0, lookX = 0, tilt = 0, spin = 0, wave = 0, talk = 0,
}) => {
  const squash = Math.sin(frame / 5) * 0.045;
  const hop = Math.abs(Math.sin(frame / 10)) * 0.12;
  const blink = frame % 80 > 76 ? 0.08 : 1;
  const shock = mood === 'shock';
  const eyeR = shock ? 0.3 : 0.25;
  // googly pupils lag behind with a little wobble
  const px = lookX * 0.08 + Math.sin(frame / 3.3) * 0.025;
  const py = Math.cos(frame / 4.1) * 0.02 - 0.02;
  const flap = talk * Math.abs(Math.sin(frame / 2.2));
  const waveAngle = wave * (0.9 + Math.sin(frame / 3) * 0.5);

  return (
    <group position={[0, hop, 0]} rotation={[0.12, -0.25 + spin + Math.sin(frame / 22) * 0.1, tilt]}>
      {/* body, with squash & stretch */}
      <group scale={[1 - squash * 0.5, 1 + squash, 1 - squash * 0.5]}>
        <mesh scale={[1.05, 1.2, 0.95]}>
          <sphereGeometry args={[1, 48, 32]} />
          <meshStandardMaterial color={GREEN} roughness={0.45} />
        </mesh>

        {/* a single silly hair curl */}
        <mesh position={[0.05, 1.28, 0]} rotation={[0, 0, 0.4 + Math.sin(frame / 6) * 0.25]}>
          <torusGeometry args={[0.13, 0.03, 8, 24, Math.PI * 1.5]} />
          <meshStandardMaterial color={STACHE} />
        </mesh>

        <Eye x={-0.36} r={eyeR} open={blink} pupilX={px} pupilY={py} />
        <Eye x={0.36} r={eyeR} open={blink * (1 - wink)} pupilX={px} pupilY={py} />
        {/* glasses bridge */}
        <mesh position={[0, 0.47, 0.98]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 0.16, 8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>

        {/* eyebrows */}
        {[-1, 1].map((s) => {
          const r = shock ? s * 0.25 : mood === 'smirk' ? (s < 0 ? 0.35 : -0.1) : s * -0.08;
          return (
            <mesh key={s} position={[s * 0.36, shock ? 0.92 : 0.84, 0.72]} rotation={[0, 0, r]}>
              <boxGeometry args={[0.34, 0.08, 0.08]} />
              <meshStandardMaterial color={STACHE} />
            </mesh>
          );
        })}

        {/* nose */}
        <mesh position={[0, 0.14, 0.98]}>
          <sphereGeometry args={[0.15, 24, 16]} />
          <meshStandardMaterial color="#17a359" roughness={0.3} />
        </mesh>

        {/* the moustache */}
        <group position={[0, -0.04 + flap * 0.04, 0.95]}>
          {[-1, 1].map((s) => (
            <React.Fragment key={s}>
              <mesh position={[s * 0.2, 0, 0]} rotation={[0, 0, s * (0.28 + flap * 0.15)]} scale={[0.3, 0.1, 0.12]}>
                <sphereGeometry args={[1, 24, 12]} />
                <meshStandardMaterial color={STACHE} roughness={0.6} />
              </mesh>
              <mesh position={[s * 0.47, 0.08 + flap * 0.03, -0.04]}>
                <sphereGeometry args={[0.065, 12, 8]} />
                <meshStandardMaterial color={STACHE} roughness={0.6} />
              </mesh>
            </React.Fragment>
          ))}
        </group>

        {/* mouth */}
        {shock ? (
          <mesh position={[0, -0.3, 0.93]} scale={[1, 1 + flap * 0.4, 1]}>
            <circleGeometry args={[0.13, 32]} />
            <meshBasicMaterial color={DARK} />
          </mesh>
        ) : (
          <mesh position={[mood === 'smirk' ? 0.08 : 0, -0.22, 0.93]} rotation={[0.3, 0, mood === 'smirk' ? Math.PI + 0.35 : Math.PI]}>
            <torusGeometry args={[0.2, 0.04, 10, 28, Math.PI]} />
            <meshStandardMaterial color={DARK} />
          </mesh>
        )}

        {/* tie */}
        <group position={[0, -0.6, 0.85]} rotation={[0.55, 0, 0]} scale={1.3}>
          <mesh><boxGeometry args={[0.16, 0.13, 0.08]} /><meshStandardMaterial color={TIE} /></mesh>
          <mesh position={[0, -0.3, 0]} rotation={[0, Math.PI / 4, Math.PI]} scale={[1, 1, 0.35]}>
            <coneGeometry args={[0.17, 0.5, 4]} />
            <meshStandardMaterial color={TIE} />
          </mesh>
        </group>
      </group>

      {/* arms */}
      {[-1, 1].map((s) => {
        const raise = s > 0 ? waveAngle : 0;
        return (
          <group key={s} position={[s * 1.0, -0.15, 0]} rotation={[0, 0, s * (0.5 + raise * 2.3)]}>
            <mesh position={[0, -0.32, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 0.64, 10]} />
              <meshStandardMaterial color={GREEN} roughness={0.45} />
            </mesh>
            <mesh position={[0, -0.68, 0]}>
              <sphereGeometry args={[0.14, 16, 12]} />
              <meshStandardMaterial color="white" roughness={0.3} />
            </mesh>
          </group>
        );
      })}

      {/* legs + shoes */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.38, -1.15, 0]}>
          <mesh position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.3, 10]} />
            <meshStandardMaterial color={GREEN} />
          </mesh>
          <mesh position={[0, -0.3, 0.1]} scale={[0.17, 0.09, 0.27]}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
};
