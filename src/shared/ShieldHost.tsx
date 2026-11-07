import React, {useMemo} from 'react';
import * as THREE from 'three';
import {createShieldMascotModel} from '../shield/createShieldMascotModel';

export type Mood = 'smirk' | 'happy' | 'shock';

export type HostProps = {
  frame: number;
  mood?: Mood;
  wink?: number;   // 0..1 closes the character's right eye
  lookX?: number;  // -1..1 pupils
  tilt?: number;
  spin?: number;
  wave?: number;   // 0..1 right arm wave
  talk?: number;   // 0..1 mouth flap
  rings?: boolean; // orbit rings + data pixels
};

type Rest = Record<string, {p: THREE.Vector3; r: THREE.Euler; s: THREE.Vector3}>;

// The channel host: the "تك عالماشي" shield logo as a procedural 3D character (built by img2threejs).
// Each frame is posed from the captured rest transforms, so rendering is deterministic per frame.
export const ShieldHost: React.FC<HostProps> = ({
  frame: f, mood = 'happy', wink = 0, lookX = 0, tilt = 0, spin = 0, wave = 0, talk = 0, rings = true,
}) => {
  const rig = useMemo(() => {
    const model = createShieldMascotModel();
    const nodes = (model.userData.sculptRuntime?.nodes ?? {}) as Record<string, THREE.Object3D>;
    model.traverse((o) => {
      if (o.name === 'data-pixels') nodes['data-pixels'] = o;
    });
    const rest: Rest = {};
    for (const [k, n] of Object.entries(nodes)) rest[k] = {p: n.position.clone(), r: n.rotation.clone(), s: n.scale.clone()};
    const wrapper = new THREE.Group();
    wrapper.add(model);
    return {wrapper, nodes, rest};
  }, []);
  const {wrapper, nodes, rest} = rig;
  const n = (k: string) => {
    const node = nodes[k];
    const r = rest[k];
    if (!node || !r) return null;
    node.position.copy(r.p);
    node.rotation.copy(r.r);
    node.scale.copy(r.s);
    return node;
  };

  // body: bounce + squash, gentle sway
  const hop = Math.abs(Math.sin(f / 9)) * 0.1;
  const squash = Math.sin(f / 4.5) * 0.025;
  wrapper.position.set(0, hop, 0);
  wrapper.rotation.set(0.05, spin + Math.sin(f / 30) * 0.15, tilt + Math.sin(f / 22) * 0.035);
  wrapper.scale.set(1 - squash * 0.5, 1 + squash, 1 - squash * 0.5);

  const shock = mood === 'shock';
  const blink = f % 80 > 75 ? 0.08 : 1;
  for (const s of ['l', 'r'] as const) {
    const eye = n(`eye-${s}`);
    const closed = s === 'r' ? 1 - wink : 1;
    if (eye) {
      const big = shock ? 1.18 : 1;
      eye.scale.set(eye.scale.x * big, eye.scale.y * big * Math.max(0.06, blink * closed), eye.scale.z);
    }
    const pupil = n(`pupil-${s}`);
    if (pupil) {
      pupil.position.x += lookX * 0.07 + Math.sin(f / 14) * 0.02;
      if (shock) pupil.scale.multiplyScalar(0.8);
      if (s === 'r' && wink > 0.5) pupil.visible = false; else if (pupil) pupil.visible = true;
    }
    const brow = n(`brow-${s}`);
    if (brow) {
      // character's left (+X) brow is raised for the smirk
      const lift = shock ? 0.13 : mood === 'smirk' ? (s === 'l' ? 0.1 : -0.02) : 0.03;
      const roll = shock ? (s === 'l' ? -0.25 : 0.25) : mood === 'smirk' ? (s === 'l' ? -0.3 : 0.1) : 0;
      brow.position.y += lift;
      brow.rotation.z += roll;
    }
  }

  const mouth = n('mouth');
  if (mouth) {
    const flap = talk * Math.abs(Math.sin(f / 2.2));
    if (shock) {
      mouth.scale.x *= 2.6 + flap * 0.6;
      mouth.scale.y *= 0.75;
    } else {
      mouth.scale.x *= 1 + flap * 1.6;
      if (mood === 'happy') mouth.scale.y *= 1.25;
      if (mood === 'smirk') {
        mouth.rotation.z += 0.25;
        mouth.position.x += 0.06;
      }
    }
  }

  const armR = n('arm-r');
  if (armR) armR.rotation.z -= wave * (1.9 + Math.sin(f / 3) * 0.45);
  const armL = n('arm-l');
  if (armL) armL.rotation.z += Math.sin(f / 12) * 0.12 + (shock ? 0.6 : 0);
  if (shock && armR && wave < 0.5) armR.rotation.z -= 0.6;
  for (const [s, ph] of [['l', 0], ['r', Math.PI]] as const) {
    const leg = n(`leg-${s}`);
    if (leg) leg.rotation.x += Math.sin(f / 5 + ph) * 0.15;
  }

  for (const k of ['orbit-trail-a', 'orbit-trail-b', 'data-pixels']) {
    const node = n(k);
    if (node) node.visible = rings;
  }
  const ta = nodes['orbit-trail-a'];
  if (ta) ta.rotation.z += f / 40;
  const tb = nodes['orbit-trail-b'];
  if (tb) tb.rotation.z -= f / 34;
  const px = nodes['data-pixels'];
  if (px) {
    px.rotation.z += f / 90;
    px.scale.multiplyScalar(0.6); // keep the pixel ring close to the shield inside busy scenes
  }

  return <primitive object={wrapper} />;
};

export const ShieldLights: React.FC = () => (
  <>
    <ambientLight intensity={0.35} color="#223355" />
    <directionalLight position={[3, 5, 8]} intensity={1.3} />
    <pointLight position={[4, 3, 3]} intensity={60} color="#1f8bff" />
    <pointLight position={[-4, -3, 3]} intensity={45} color="#ff7a00" />
  </>
);
