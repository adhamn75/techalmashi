import React, {useMemo} from 'react';
import * as THREE from 'three';

// ShieldBuddy: a redesigned, toy-like version of the channel's shield logo.
// Puffy beveled body, blue rim with a glowing orange edge, a subtle spreadsheet grid,
// big glossy eyes, an open smile, chunky limbs and an additive glow behind it.

export type BuddyMood = 'happy' | 'shock' | 'smirk';
export type BuddyProps = {
  frame: number;
  mood?: BuddyMood;
  wave?: number;
  talk?: number;
  wink?: number;
  lookX?: number;
  spin?: number;
  legs?: boolean;   // false = floating badge with small arms
  chart?: boolean;  // the logo's rising chart + play glyph on the belly
  rings?: boolean;
};

const GREEN = '#1fd14a';
const GREEN_DEEP = '#0f9a32';
const BLUE = '#1f6bff';
const ORANGE = '#ff8a1f';

const shieldShape = (s = 1) => {
  const sh = new THREE.Shape();
  sh.moveTo(-1.0 * s, 1.05 * s);
  sh.quadraticCurveTo(0, 1.32 * s, 1.0 * s, 1.05 * s);
  sh.lineTo(1.02 * s, 0.35 * s);
  sh.quadraticCurveTo(0.98 * s, -0.62 * s, 0, -1.32 * s);
  sh.quadraticCurveTo(-0.98 * s, -0.62 * s, -1.02 * s, 0.35 * s);
  sh.closePath();
  return sh;
};

const outlineCurve = (s: number, z: number) => {
  const pts = shieldShape(s).getSpacedPoints(80).map((p) => new THREE.Vector3(p.x, p.y, z));
  return new THREE.CatmullRomCurve3(pts, true);
};

const radialTexture = (inner: string, outer: string) => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, inner);
  gr.addColorStop(1, outer);
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

const Eye: React.FC<{x: number; open: number; look: number; shock: boolean; f: number}> = ({x, open, look, shock, f}) => {
  const r = shock ? 0.36 : 0.32;
  const px = look * 0.06 + Math.sin(f / 15) * 0.015;
  return (
    <group position={[x, 0.42, 0.62]} scale={[1, Math.max(0.05, open), 1]}>
      <mesh scale={[1, 1.12, 0.55]}>
        <sphereGeometry args={[r, 40, 24]} />
        <meshPhysicalMaterial color="#ffffff" roughness={0.12} clearcoat={1} />
      </mesh>
      <mesh position={[px, -0.03, r * 0.5]} scale={[1, 1.1, 0.4]}>
        <sphereGeometry args={[r * 0.6, 32, 16]} />
        <meshPhysicalMaterial color="#1b4fd6" roughness={0.2} clearcoat={1} />
      </mesh>
      <mesh position={[px, -0.03, r * 0.62]} scale={[1, 1.1, 0.4]}>
        <sphereGeometry args={[r * (shock ? 0.26 : 0.34), 24, 12]} />
        <meshBasicMaterial color="#05070d" />
      </mesh>
      <mesh position={[px + r * 0.18, r * 0.2, r * 0.72]}>
        <sphereGeometry args={[r * 0.13, 16, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[px - r * 0.15, -r * 0.22, r * 0.7]}>
        <sphereGeometry args={[r * 0.06, 12, 6]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
};

export const ShieldBuddy: React.FC<BuddyProps> = ({
  frame: f, mood = 'happy', wave = 0, talk = 0, wink = 0, lookX = 0, spin = 0, legs = true, chart = false, rings = true,
}) => {
  const geo = useMemo(() => {
    const ext = (s: number, depth: number, bevel: number) =>
      new THREE.ExtrudeGeometry(shieldShape(s), {depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel * 1.3, bevelSegments: 12, curveSegments: 48});
    const smile = new THREE.Shape();
    smile.moveTo(-0.26, 0);
    smile.quadraticCurveTo(0, -0.42, 0.26, 0);
    smile.quadraticCurveTo(0, -0.06, -0.26, 0);
    const o = new THREE.Shape();
    o.absellipse(0, 0, 0.14, 0.18, 0, Math.PI * 2, false, 0);
    const tri = new THREE.Shape();
    tri.moveTo(-0.1, -0.12); tri.lineTo(0.14, 0); tri.lineTo(-0.1, 0.12); tri.closePath();
    return {
      back: ext(1.1, 0.3, 0.14),
      front: ext(0.95, 0.2, 0.2),
      edge: new THREE.TubeGeometry(outlineCurve(1.0, 0.5), 200, 0.035, 8, true),
      smile: new THREE.ShapeGeometry(smile, 24),
      oMouth: new THREE.ShapeGeometry(o, 32),
      tri: new THREE.ShapeGeometry(tri),
      glow: radialTexture('rgba(40,140,255,0.85)', 'rgba(40,140,255,0)'),
      glowWarm: radialTexture('rgba(255,140,30,0.55)', 'rgba(255,140,30,0)'),
    };
  }, []);

  const shock = mood === 'shock';
  const blink = f % 84 > 79 ? 0.08 : 1;
  const hop = legs ? Math.abs(Math.sin(f / 9)) * 0.1 : Math.sin(f / 14) * 0.12;
  const squash = Math.sin(f / 4.5) * (legs ? 0.025 : 0.012);
  const flap = talk * Math.abs(Math.sin(f / 2.3));
  const waveA = wave * (2.3 + Math.sin(f / 3) * 0.45);
  const step = legs ? Math.sin(f / 5) * 0.2 : 0;

  // chart polyline (logo detail) on the lower belly, below the mouth
  const chartPts = [[-0.5, -0.78], [-0.3, -0.62], [-0.1, -0.7], [0.1, -0.48], [0.3, -0.56]];

  return (
    <group position={[0, hop, 0]} rotation={[0.06, spin + Math.sin(f / 30) * 0.15, Math.sin(f / 22) * 0.03]}>
      {/* glow behind */}
      <mesh position={[0, 0, -0.6]} scale={5.2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={geo.glow} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.7, -0.55]} scale={3.2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={geo.glowWarm} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      <group scale={[1 - squash * 0.5, 1 + squash, 1 - squash * 0.5]}>
        {/* blue rim body */}
        <mesh geometry={geo.back} position={[0, 0, -0.25]}>
          <meshPhysicalMaterial color={BLUE} metalness={0.35} roughness={0.25} clearcoat={1} clearcoatRoughness={0.1} emissive="#0a2a8a" emissiveIntensity={0.35} />
        </mesh>
        {/* glowing orange edge between rim and face */}
        <mesh geometry={geo.edge}>
          <meshBasicMaterial color={ORANGE} toneMapped={false} />
        </mesh>
        {/* puffy green front */}
        <mesh geometry={geo.front} position={[0, 0, 0.12]}>
          <meshPhysicalMaterial color={GREEN} roughness={0.2} clearcoat={1} clearcoatRoughness={0.06} emissive={GREEN_DEEP} emissiveIntensity={0.25} />
        </mesh>
        {/* subtle grid */}
        {[-0.45, 0, 0.45].map((x) => (
          <mesh key={`v${x}`} position={[x, -0.05, 0.535]}><boxGeometry args={[0.018, 1.7 - Math.abs(x) * 0.9, 0.01]} />
            <meshBasicMaterial color="#b9ffc8" transparent opacity={0.35} /></mesh>
        ))}
        {[0.75, 0.15, -0.45].map((y) => (
          <mesh key={`h${y}`} position={[0, y, 0.535]}><boxGeometry args={[y > 0 ? 1.65 : 1.2, 0.018, 0.01]} />
            <meshBasicMaterial color="#b9ffc8" transparent opacity={0.35} /></mesh>
        ))}

        {/* face */}
        <Eye x={-0.36} open={blink} look={lookX} shock={shock} f={f} />
        <Eye x={0.36} open={blink * (1 - wink)} look={lookX} shock={shock} f={f} />
        {[-1, 1].map((s) => {
          const lift = shock ? 0.16 : mood === 'smirk' ? (s > 0 ? 0.12 : 0) : 0.05;
          const rot = shock ? -s * 0.2 : mood === 'smirk' ? (s > 0 ? -0.35 : 0.08) : s * 0.12;
          return (
            <mesh key={s} position={[s * 0.36, 0.86 + lift, 0.66]} rotation={[0, 0, rot]}>
              <capsuleGeometry args={[0.045, 0.2, 6, 12]} />
              <meshBasicMaterial color="#06240f" />
            </mesh>
          );
        })}
        {/* cheeks */}
        {[-1, 1].map((s) => (
          <mesh key={`c${s}`} position={[s * 0.6, 0.08, 0.6]} scale={[1, 0.6, 1]}>
            <circleGeometry args={[0.13, 24]} />
            <meshBasicMaterial color="#ff7a8a" transparent opacity={0.45} />
          </mesh>
        ))}
        {/* mouth */}
        {shock ? (
          <group position={[0, -0.12, 0.665]} scale={[1, 1 + flap * 0.3, 1]}>
            <mesh geometry={geo.oMouth}><meshBasicMaterial color="#3a0d0d" /></mesh>
          </group>
        ) : (
          <group position={[mood === 'smirk' ? 0.05 : 0, 0.0, 0.665]} rotation={[0, 0, mood === 'smirk' ? 0.18 : 0]}
            scale={[1, 1 + flap * 0.9, 1]}>
            <mesh geometry={geo.smile}><meshBasicMaterial color="#3a0d0d" /></mesh>
            <mesh position={[0, -0.16, 0.002]} scale={[1, 0.55, 1]}>
              <circleGeometry args={[0.09, 24]} />
              <meshBasicMaterial color="#ff6b7a" />
            </mesh>
          </group>
        )}

        {/* keyhole badge (logo detail) */}
        <group position={[0, chart ? -0.98 : -0.62, 0.6]} scale={chart ? 0.7 : 1}>
          <mesh><torusGeometry args={[0.14, 0.04, 16, 40]} />
            <meshPhysicalMaterial color="#ffb21f" metalness={0.6} roughness={0.2} emissive="#b05a00" emissiveIntensity={0.6} /></mesh>
          <mesh position={[0, 0.02, 0.01]}><circleGeometry args={[0.05, 20]} /><meshBasicMaterial color="#2a1200" /></mesh>
          <mesh position={[0, -0.05, 0.01]}><planeGeometry args={[0.04, 0.09]} /><meshBasicMaterial color="#2a1200" /></mesh>
        </group>

        {chart && (
          <group position={[0, 0.02, 0.6]}>
            {chartPts.map(([x, y], i) => i < chartPts.length - 1 && (() => {
              const [x2, y2] = chartPts[i + 1];
              const len = Math.hypot(x2 - x, y2 - y);
              return (
                <mesh key={i} position={[(x + x2) / 2, (y + y2) / 2, 0]} rotation={[0, 0, Math.atan2(y2 - y, x2 - x)]}>
                  <boxGeometry args={[len, 0.035, 0.02]} />
                  <meshBasicMaterial color="#ffc93a" toneMapped={false} />
                </mesh>
              );
            })())}
            {chartPts.map(([x, y], i) => (
              <mesh key={`b${i}`} position={[x, y, 0.01]}><sphereGeometry args={[0.04, 12, 8]} /><meshBasicMaterial color="#fff2b0" /></mesh>
            ))}
            <mesh geometry={geo.tri} position={[0.48, -0.56, 0.01]}><meshBasicMaterial color="#ffc93a" toneMapped={false} /></mesh>
          </group>
        )}
      </group>

      {/* arms */}
      {[-1, 1].map((s) => {
        const raise = s < 0 ? waveA : (shock ? 1.6 : 0);
        const base = legs ? 0.55 : 0.75;
        return (
          <group key={s} position={[s * 1.02, 0.05, 0.05]} rotation={[0, 0, s * (base + raise)]}>
            <mesh position={[0, -0.27, 0]}><capsuleGeometry args={[legs ? 0.1 : 0.08, legs ? 0.36 : 0.26, 8, 16]} />
              <meshPhysicalMaterial color={BLUE} roughness={0.3} clearcoat={1} /></mesh>
            <mesh position={[0, legs ? -0.6 : -0.5, 0]}><sphereGeometry args={[legs ? 0.17 : 0.14, 24, 16]} />
              <meshPhysicalMaterial color="#ffffff" roughness={0.35} clearcoat={0.6} /></mesh>
          </group>
        );
      })}

      {/* legs + sneakers */}
      {legs && [-1, 1].map((s, i) => (
        <group key={s} position={[s * 0.32, -1.05, 0.05]} rotation={[(i ? -1 : 1) * step, 0, 0]}>
          <mesh position={[0, -0.18, 0]}><capsuleGeometry args={[0.1, 0.22, 8, 16]} />
            <meshPhysicalMaterial color={BLUE} roughness={0.3} clearcoat={1} /></mesh>
          <mesh position={[0, -0.42, 0.1]} scale={[0.2, 0.12, 0.3]}><sphereGeometry args={[1, 24, 16]} />
            <meshPhysicalMaterial color={ORANGE} roughness={0.3} clearcoat={1} /></mesh>
          <mesh position={[0, -0.5, 0.1]} scale={[0.21, 0.04, 0.31]}><sphereGeometry args={[1, 24, 8]} />
            <meshStandardMaterial color="#ffffff" /></mesh>
        </group>
      ))}

      {/* orbit rings */}
      {rings && (
        <>
          {[[3.0, '#2fd2ff', -1.2, -0.25, 1], [2.8, '#ff8a1f', -1.0, 0.3, -1]].map(([r, c, rx, rz, dir], i) => (
            <group key={i} rotation={[rx as number, 0, (rz as number) + (dir as number) * f / 40]} position={[0, i ? 0.05 : -0.35, 0]}>
              {[1, 3, 6].map((w, k) => (
                <mesh key={w}><torusGeometry args={[(r as number) / 2, 0.012 * w, 10, 160, Math.PI * 1.4]} />
                  <meshBasicMaterial color={c as string} transparent opacity={[1, 0.3, 0.1][k]} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
              ))}
            </group>
          ))}
        </>
      )}
    </group>
  );
};
