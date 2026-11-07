import React, {useMemo} from 'react';
import * as THREE from 'three';

// "أبو خلية" — an original mascot: a chubby green spreadsheet-cell office guy
// with googly eyes behind round glasses, a big moustache, a red tie and tiny limbs.
// Everything is primitive geometry, no image or AI asset.

export type Mood = 'smirk' | 'happy' | 'shock';
export type BodyKind = 'egg' | 'cube' | 'hex' | 'monitor';

export type MascotProps = {
  frame: number;
  mood?: Mood;
  wink?: number;   // 0..1 closes right eye
  lookX?: number;  // -1..1
  tilt?: number;
  spin?: number;
  wave?: number;   // 0..1 right arm waving
  talk?: number;   // 0..1 mouth/moustache flap
  outfit?: 'tie' | 'shield';
  body?: BodyKind;
  palette?: 'green' | 'fire';
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


const Shield: React.FC = () => {
  const shape = useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0.36);
    sh.quadraticCurveTo(0.22, 0.36, 0.34, 0.27);
    sh.lineTo(0.31, -0.04);
    sh.quadraticCurveTo(0.26, -0.3, 0, -0.44);
    sh.quadraticCurveTo(-0.26, -0.3, -0.31, -0.04);
    sh.lineTo(-0.34, 0.27);
    sh.quadraticCurveTo(-0.22, 0.36, 0, 0.36);
    return sh;
  }, []);
  return (
    <group position={[0, -0.58, 0.82]} rotation={[0.5, 0, 0]} scale={1.15}>
      <mesh>
        <extrudeGeometry args={[shape, {depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3}]} />
        <meshStandardMaterial color="#3a86ff" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* check mark */}
      <mesh position={[-0.1, -0.05, 0.13]} rotation={[0, 0, 0.8]}><boxGeometry args={[0.07, 0.18, 0.03]} /><meshStandardMaterial color="white" /></mesh>
      <mesh position={[0.05, 0.02, 0.13]} rotation={[0, 0, -0.65]}><boxGeometry args={[0.07, 0.34, 0.03]} /><meshStandardMaterial color="white" /></mesh>
    </group>
  );
};



const PALETTES = {
  green: {body: '#21c46b', emissive: '#000000', ei: 0, nose: '#17a359', mouth: '#0b3d22', line: '#178f4e', screen: '#e9fff2', tie: '#e5383b'},
  fire: {body: '#ff9a1f', emissive: '#ff4d00', ei: 0.28, nose: '#ff5e00', mouth: '#5a1e00', line: '#e06a00', screen: '#fff3e0', tie: '#1f6bff'},
};
type Pal = typeof PALETTES.green;
const PalCtx = React.createContext<Pal>(PALETTES.green);
const BodyMat: React.FC<{gloss?: boolean}> = ({gloss}) => {
  const c = React.useContext(PalCtx);
  return gloss
    ? <meshPhysicalMaterial color={c.body} emissive={c.emissive} emissiveIntensity={c.ei} roughness={0.22} clearcoat={1} clearcoatRoughness={0.08} />
    : <meshStandardMaterial color={c.body} emissive={c.emissive} emissiveIntensity={c.ei} roughness={0.4} />;
};

const roundedRect = (w: number, h: number, r: number) => {
  const sh = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  sh.moveTo(x + r, y);
  sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r);
  sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r);
  sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
  return sh;
};
const hexagon = (r: number) => {
  const sh = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) sh.moveTo(px, py); else sh.lineTo(px, py);
  }
  sh.closePath();
  return sh;
};

const BODY_CFG: Record<BodyKind, {dz: number; brow: number; armX: number; legY: number; hairY: number; tieRot: number}> = {
  egg: {dz: 0, brow: 0, armX: 1.0, legY: -1.15, hairY: 1.28, tieRot: 0.55},
  cube: {dz: 0.15, brow: 0.15, armX: 1.3, legY: -1.3, hairY: 1.47, tieRot: 0.1},
  hex: {dz: 0.15, brow: 0.15, armX: 1.38, legY: -1.27, hairY: 1.42, tieRot: 0.1},
  monitor: {dz: 0.15, brow: 0.15, armX: 1.5, legY: -1.12, hairY: 1.3, tieRot: 0.1},
};

const BodyShape: React.FC<{kind: BodyKind}> = ({kind}) => {
  const pc = React.useContext(PalCtx);
  const geo = useMemo(() => {
    if (kind === 'cube') return {shape: roundedRect(2.1, 2.3, 0.5), depth: 1.5, bevel: 0.2};
    if (kind === 'hex') return {shape: hexagon(1.38), depth: 1.5, bevel: 0.2};
    if (kind === 'monitor') return {shape: roundedRect(2.6, 1.9, 0.28), depth: 1.5, bevel: 0.2};
    return null;
  }, [kind]);
  if (!geo) {
    return (
      <mesh scale={[1.05, 1.2, 0.95]}>
        <sphereGeometry args={[1, 48, 32]} />
        <BodyMat gloss />
      </mesh>
    );
  }
  return (
    <group>
      <mesh position={[0, 0, -geo.depth / 2]}>
        <extrudeGeometry args={[geo.shape, {depth: geo.depth, bevelEnabled: true, bevelSize: geo.bevel, bevelThickness: geo.bevel, bevelSegments: 8, curveSegments: 24}]} />
        <BodyMat gloss />
      </mesh>
      {kind === 'monitor' && (
        <mesh position={[0, 0.02, 0.96]}>
          <shapeGeometry args={[roundedRect(2.3, 1.62, 0.18)]} />
          <meshStandardMaterial color={pc.screen} roughness={0.25} />
        </mesh>
      )}
      {kind === 'cube' && [-0.35, 0.35].map((p) => (
        <mesh key={p} position={[p, -0.62, 0.955]}><planeGeometry args={[0.025, 0.5]} /><meshBasicMaterial color={pc.line} /></mesh>
      ))}
    </group>
  );
};

export const AbuKhalye: React.FC<MascotProps> = ({
  frame, mood = 'happy', wink = 0, lookX = 0, tilt = 0, spin = 0, wave = 0, talk = 0, outfit = 'tie', body = 'egg', palette = 'green',
}) => {
  const cfg = BODY_CFG[body];
  const pal = PALETTES[palette];
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
    <PalCtx.Provider value={pal}>
    <group position={[0, hop, 0]} rotation={[0.12, -0.25 + spin + Math.sin(frame / 22) * 0.1, tilt]}>
      {/* body, with squash & stretch */}
      <group scale={[1 - squash * 0.5, 1 + squash, 1 - squash * 0.5]}>
        <BodyShape kind={body} />

        {/* a single silly hair curl */}
        <mesh position={[0.05, cfg.hairY, 0]} rotation={[0, 0, 0.4 + Math.sin(frame / 6) * 0.25]}>
          <torusGeometry args={[0.13, 0.03, 8, 24, Math.PI * 1.5]} />
          <meshStandardMaterial color={STACHE} />
        </mesh>

        <group position={[0, 0, cfg.dz]}>
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
            <mesh key={s} position={[s * 0.36, shock ? 0.92 : 0.84, 0.72 + cfg.brow]} rotation={[0, 0, r]}>
              <boxGeometry args={[0.34, 0.08, 0.08]} />
              <meshStandardMaterial color={STACHE} />
            </mesh>
          );
        })}

        {/* nose */}
        <mesh position={[0, 0.14, 0.98]}>
          <sphereGeometry args={[0.15, 24, 16]} />
          <meshStandardMaterial color={pal.nose} roughness={0.3} />
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
            <meshBasicMaterial color={pal.mouth} />
          </mesh>
        ) : (
          <mesh position={[mood === 'smirk' ? 0.08 : 0, -0.22, 0.93]} rotation={[0.3, 0, mood === 'smirk' ? Math.PI + 0.35 : Math.PI]}>
            <torusGeometry args={[0.2, 0.04, 10, 28, Math.PI]} />
            <meshStandardMaterial color={pal.mouth} />
          </mesh>
        )}

        {outfit === 'shield' ? <Shield /> : (
          <>
        {/* tie */}
        <group position={[0, -0.6, 0.85]} rotation={[cfg.tieRot, 0, 0]} scale={1.3}>
          <mesh><boxGeometry args={[0.16, 0.13, 0.08]} /><meshStandardMaterial color={pal.tie} /></mesh>
          <mesh position={[0, -0.3, 0]} rotation={[0, Math.PI / 4, Math.PI]} scale={[1, 1, 0.35]}>
            <coneGeometry args={[0.17, 0.5, 4]} />
            <meshStandardMaterial color={pal.tie} />
          </mesh>
        </group>
          </>
        )}
        </group>
      </group>

      {/* arms */}
      {[-1, 1].map((s) => {
        const raise = s > 0 ? waveAngle : 0;
        return (
          <group key={s} position={[s * cfg.armX, -0.15, 0]} rotation={[0, 0, s * (0.5 + raise * 2.3)]}>
            <mesh position={[0, -0.32, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 0.64, 10]} />
              <BodyMat />
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
        <group key={s} position={[s * 0.38, cfg.legY, 0]}>
          <mesh position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.3, 10]} />
            <BodyMat />
          </mesh>
          <mesh position={[0, -0.3, 0.1]} scale={[0.17, 0.09, 0.27]}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
    </PalCtx.Provider>
  );
};
