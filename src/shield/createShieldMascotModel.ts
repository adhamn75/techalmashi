import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

// THREE.CapsuleGeometry duplicates every UV-seam vertex (measured: 194 boundary
// edges on the default radius/segments below) -- same benign pattern as box/
// cylinder/sphere/torus, all of which weld cleanly to 0 given a CORRECT weld.
// (A naive vertex-only mergeVertices() reports 64 'non-manifold' edges here, but
// that is a counting artifact, not a real defect: it double-counts a handful of
// near-pole triangles that become degenerate once two of their three corners
// coincide -- confirmed by replicating subdivideCatmullClark's own degenerate-
// triangle-aware vertex identity, which finds a perfectly ordinary 2-manifold.)
// A capsule is the primary shape for skinned limbs/torso (PLAN_1.5), and skinning
// weight computation is O(vertices x bones), so fewer, guaranteed-simple vertices
// is worth having regardless -- authored as a deterministic, closed-by-
// construction mesh instead: shared pole vertices, and
// the radial index taken `% radialSegments` so the seam is never a duplicate
// vertex in the first place, rather than something to weld away afterward.
// Adapted from forge/stage5_rig/emit_rig.py's buildWatertightCapsule (verified
// there: 0 boundary edges, 0 non-manifold edges, deterministic across repeated
// runs) -- ported here rather than imported because this factory and the rig
// emitter are separate generated-output surfaces with no shared runtime module;
// see forge/tests/test_primitive_watertightness.py for the measured proof, and
// coordinate with the rig owner before changing either copy independently.
function buildWatertightCapsule(
  radius: number,
  cylLength: number,
  capSegments: number,
  radialSegments: number,
  heightSegments: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const halfCyl = cylLength / 2;
  const totalSpan = 2 * (Math.PI / 2 * radius) + Math.max(0, cylLength);
  const vOf = (fromBottom: number) => (totalSpan > 0 ? fromBottom / totalSpan : 0);

  const bottomPoleIndex = positions.length / 3;
  positions.push(0, -halfCyl - radius, 0);
  uvs.push(0.5, vOf(0));

  const ringStarts: number[] = [];
  const ringV: number[] = [];
  for (let ring = 1; ring <= capSegments; ring += 1) {
    const phi = (Math.PI / 2) * (ring / capSegments);
    const y = -halfCyl - radius * Math.cos(phi);
    const r = radius * Math.sin(phi);
    const start = positions.length / 3;
    ringStarts.push(start);
    ringV.push(vOf(radius * phi));
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const theta = (radial / radialSegments) * Math.PI * 2;
      positions.push(r * Math.cos(theta), y, r * Math.sin(theta));
      uvs.push(radial / radialSegments, vOf(radius * phi));
    }
  }

  const cylinderRingStarts: number[] = [];
  if (cylLength > 0) {
    for (let step = 1; step <= heightSegments; step += 1) {
      const y = -halfCyl + (cylLength * step) / heightSegments;
      const start = positions.length / 3;
      cylinderRingStarts.push(start);
      const v = vOf(radius * (Math.PI / 2) + halfCyl + y);
      for (let radial = 0; radial < radialSegments; radial += 1) {
        const theta = (radial / radialSegments) * Math.PI * 2;
        positions.push(radius * Math.cos(theta), y, radius * Math.sin(theta));
        uvs.push(radial / radialSegments, v);
      }
    }
  }

  const topRingStarts: number[] = [];
  for (let ring = capSegments - 1; ring >= 1; ring -= 1) {
    const phi = (Math.PI / 2) * (ring / capSegments);
    const y = halfCyl + radius * Math.cos(phi);
    const r = radius * Math.sin(phi);
    const start = positions.length / 3;
    topRingStarts.push(start);
    const v = vOf(radius * (Math.PI / 2) + Math.max(0, cylLength) + radius * (Math.PI / 2 - phi));
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const theta = (radial / radialSegments) * Math.PI * 2;
      positions.push(r * Math.cos(theta), y, r * Math.sin(theta));
      uvs.push(radial / radialSegments, v);
    }
  }

  const topPoleIndex = positions.length / 3;
  positions.push(0, halfCyl + radius, 0);
  uvs.push(0.5, vOf(totalSpan));

  const firstBottomRing = ringStarts[0];
  for (let radial = 0; radial < radialSegments; radial += 1) {
    const next = (radial + 1) % radialSegments;
    indices.push(bottomPoleIndex, firstBottomRing + radial, firstBottomRing + next);
  }

  const allRings = [...ringStarts, ...cylinderRingStarts, ...topRingStarts];
  for (let i = 0; i < allRings.length - 1; i += 1) {
    const a = allRings[i];
    const b = allRings[i + 1];
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const next = (radial + 1) % radialSegments;
      indices.push(a + radial, a + next, b + next);
      indices.push(a + radial, b + next, b + radial);
    }
  }

  const lastRing = allRings[allRings.length - 1];
  for (let radial = 0; radial < radialSegments; radial += 1) {
    const next = (radial + 1) % radialSegments;
    indices.push(topPoleIndex, lastRing + next, lastRing + radial);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// bevelEnabled defaults to true on THREE.ExtrudeGeometry and rounds every
// corner — sharp/pointed profiles (blades, fork tines, spikes) need
// bevelEnabled: false plus lineTo()-only path segments near the tip, since a
// curve command cannot produce a true converging point.
function buildExtrudeShape(points: [number, number][], holes?: [number, number][][]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  // Cutouts (e.g. an oval wire-cutter hole) as THREE.Path added to shape.holes —
  // dep-free boolean subtraction via the tessellator, no CSG library needed.
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// Build an N-gon oval loop (for hole authoring from a compact {cx,cy,rx,ry} descriptor).
function ovalLoop(cx: number, cy: number, rx: number, ry: number, seg = 24): [number, number][] {
  const loop: [number, number][] = [];
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}

function buildExtrudeGeometry(profile: { points: [number, number][]; depth: number; holes?: [number, number][][]; ovalHoles?: { cx: number; cy: number; rx: number; ry: number }[] }): THREE.ExtrudeGeometry {
  const holes = [...(profile.holes ?? []), ...((profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry)))];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1,
  });
}

function buildTubeGeometry(
  path: { points: [number, number, number][]; radius?: number; radialSegments?: number; closed?: boolean },
): THREE.TubeGeometry {
  const vectors = path.points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(vectors, path.closed ?? false);
  const tubularSegments = Math.max(8, path.points.length * 6);
  return new THREE.TubeGeometry(curve, tubularSegments, path.radius ?? 0.05, path.radialSegments ?? 8, path.closed ?? false);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  // setStyle with an explicit SRGBColorSpace, NOT the numeric constructor.
  //
  // `new THREE.Color(r, g, b)` treats its arguments as LINEAR working-space components,
  // while an authored `baseColor` hex is sRGB. Feeding one to the other skipped the
  // transfer function and lifted every dark albedo: #2e2a28, authored as a near-black
  // vinyl, rendered at roughly sRGB 0.46 — a mid grey. The error is largest exactly where
  // it matters most, because the transfer curve is steepest near black.
  return new THREE.Color().setStyle(source, THREE.SRGBColorSpace);
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions, denseComponent = false): THREE.MeshPhysicalMaterial {
  // A material that declares -- with evidence -- that its subject carries no texture
  // detail gets NO texture set. Synthesising one anyway is not a harmless default: the
  // branch below then forces color to white and roughness to 1 and reads both from the
  // generated maps, so the authored albedo and the reference-derived roughness are both
  // discarded, and the model gains mottling the reference does not have. Measured on the
  // tuxedo cat, whose black fur rendered as speckled grey-and-white from a palette that
  // only ever described two flat regions.
  const textureless = (spec.textureless as { declared?: boolean } | undefined)?.declared === true;
  const textures = textureless
    ? null
    : makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Shield Mascot
// Sculpt build pass: material-pass
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createShieldMascotModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Shield Mascot";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40.0, "aspect": 1.0, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0.0, 0.0, 3.0], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review."}, "approximationNotes": []};
  root.userData.materialPipeline = {"schemaVersion": 1, "status": "proceed", "registry": "/home/claude/img2threejs/docs/materials/material-reference.json", "analysisArtifact": "/root/shieldbot/material-analysis.json", "targetThreshold": 0.7, "unresolvedNotObservedMaterials": [], "regions": [{"componentId": "grid-plate", "regionId": "plate", "specMaterialId": "plate-green", "profileId": "plastic.glossy", "status": "proceed"}, {"componentId": "root", "regionId": "rim-outer", "specMaterialId": "rim-steel", "profileId": "metal.steel-polished", "status": "proceed"}, {"componentId": "rim-inner", "regionId": "rim-lip", "specMaterialId": "rim-ember", "profileId": "plastic.glossy", "status": "proceed"}, {"componentId": "keyhole-medallion", "regionId": "ring", "specMaterialId": "gold-ember", "profileId": "metal.gold", "status": "proceed"}, {"componentId": "orbit-trail-a", "regionId": "trail", "specMaterialId": "trail-cyan", "profileId": "plastic.glossy", "status": "proceed"}], "controlledViewsRequired": ["albedo-unlit", "environment-reflection", "grazing", "neutral-studio", "reference-beauty"]};
  root.userData.materialReferenceRegistry = "/home/claude/img2threejs/docs/materials/material-reference.json";

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["rim-steel"] = createSculptMaterial(
    "rim-steel",
    {"id": "rim-steel", "name": "Rim steel-blue metal", "type": "physical", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#0d4fb0", "color": "#0d4fb0", "albedo": {"dominant": "#0d4fb0", "secondary": ["#0d4fb0"], "samplingNotes": "solid albedo from the reference's flat-paint region (stylized illustration)"}, "colorVariation": {"palette": ["#0d4fb0"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.12, "variation": 0.04, "map": "uniform scalar (textureless flat paint)", "localResponse": "uniform glossy plastic"}, "metalness": {"base": 1.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "emissive": "#0b3a9e", "emissiveIntensity": 0.35, "clearcoat": 0.6, "clearcoatRoughness": 0.08, "referenceMaterialId": "metal.steel-polished", "materialFamily": "metal", "materialSubtype": "steel", "materialFinish": "polished", "materialReference": {"registry": "/home/claude/img2threejs/docs/materials/material-reference.json", "profileId": "metal.steel-polished", "method": "family-subtype-finish", "confidence": 0.793, "sourceRefs": ["three.mesh-standard", "three.pmrem", "gltf.2", "khronos.gltf-pbr", "adobe.pbr-guide-2", "google.filament-pbr"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "metalnessMap"], "validationViews": ["neutral-studio", "environment-reflection", "grazing", "reference-beauty"]}, "anisotropy": {"base": 0.0, "variation": 0.0}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#00347D", "#0167C7", "#014492", "#0A2558", "#141C3F"], "paletteHueRisk": [{"stop": "#00347D", "hueRisk": "blue-collapse", "suggestedRgb": [125, 52, 0]}, {"stop": "#0167C7", "hueRisk": "blue-collapse", "suggestedRgb": [199, 103, 1]}, {"stop": "#014492", "hueRisk": "blue-collapse", "suggestedRgb": [146, 68, 1]}, {"stop": "#0A2558", "hueRisk": "blue-collapse", "suggestedRgb": [88, 37, 10]}, {"stop": "#141C3F", "hueRisk": "blue-collapse", "suggestedRgb": [63, 28, 20]}], "gradientAxis": "vertical", "stats": {"meanLum": 54.4, "meanSaturation": 0.929, "gradientStrength": 0.286, "mottle": 0.008, "streakRatio": 0.84, "hueSpread": 0.008, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "root", "regionId": "rim-outer", "crop": {"path": "/root/shieldbot/material-evidence/01-rim-outer.png", "bbox": {"x": 996, "y": 380, "width": 16, "height": 80}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0008}, "observations": ["chromatic base-colour response", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "root", "regionId": "rim-outer", "materialId": null, "family": "metal", "subtype": "steel", "finish": "polished", "aliases": [], "confidence": 0.793, "source": "vision"}, "alternatives": []}, "needsEnvironment": true, "referencePbrEvidenceNote": "verified crop rim-outer bbox {'x': 996, 'y': 380, 'width': 16, 'height': 80} -> palette ['#013D8A', '#111D45', '#052963'] (confidence 0.793)", "textureless": {"declared": true, "evidence": ["ref/shield_logo.png: flat-shaded glowing illustration; solid colour regions with no grain, print or pores (see crops/sheet.png)", "stylized mascot additions (eyes, brows, mouth, limbs) are absent from the reference and are authored as flat toy paint by design", "verified crop rim-outer bbox {'x': 996, 'y': 380, 'width': 16, 'height': 80} -> palette ['#013D8A', '#111D45', '#052963'] (confidence 0.793)"]}},
    options
  );
  materialMap["rim-bevel-light"] = createSculptMaterial(
    "rim-bevel-light",
    {"id": "rim-bevel-light", "name": "Rim bevel highlight steel", "type": "physical", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#1f5fc8", "color": "#1f5fc8", "albedo": {"dominant": "#1f5fc8", "secondary": ["#1f5fc8"], "samplingNotes": "solid albedo from the reference's flat-paint region (stylized illustration)"}, "colorVariation": {"palette": ["#1f5fc8"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.2, "variation": 0.04, "map": "uniform scalar (textureless flat paint)", "localResponse": "uniform glossy plastic"}, "metalness": {"base": 0.3, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "emissive": "#0a3c9a", "emissiveIntensity": 0.5, "clearcoat": 0.8, "clearcoatRoughness": 0.08, "textureless": {"declared": true, "evidence": ["ref/shield_logo.png: flat-shaded glowing illustration; solid colour regions with no grain, print or pores (see crops/sheet.png)", "stylized mascot additions (eyes, brows, mouth, limbs) are absent from the reference and are authored as flat toy paint by design"]}},
    options
  );
  materialMap["rim-ember"] = createSculptMaterial(
    "rim-ember",
    {"id": "rim-ember", "name": "Rim inner emissive orange", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#b83a02", "color": "#b83a02", "albedo": {"dominant": "#b83a02", "secondary": ["#b83a02"], "samplingNotes": "solid albedo from the reference's flat-paint region (stylized illustration)"}, "colorVariation": {"palette": ["#b83a02"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.28, "variation": 0.04, "map": "uniform scalar (textureless flat paint)", "localResponse": "uniform glossy plastic"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "emissive": "#7a2200", "emissiveIntensity": 0.5, "referenceMaterialId": "plastic.glossy", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "glossy", "materialReference": {"registry": "/home/claude/img2threejs/docs/materials/material-reference.json", "profileId": "plastic.glossy", "method": "family-subtype-finish", "confidence": 0.825, "sourceRefs": ["three.mesh-physical", "three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap"], "validationViews": ["neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": {"base": 0.2, "variation": 0.0}, "clearcoatRoughness": {"base": 0.18, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#541907", "#762203", "#AA3601", "#D6741B", "#F4B31E"], "paletteHueRisk": [], "gradientAxis": "horizontal", "stats": {"meanLum": 97.4, "meanSaturation": 0.926, "gradientStrength": 0.554, "mottle": 0.011, "streakRatio": 1.23, "hueSpread": 0.027, "specularFraction": 0.046}}, "materialEvidence": {"componentId": "rim-inner", "regionId": "rim-lip", "crop": {"path": "/root/shieldbot/material-evidence/02-rim-lip.png", "bbox": {"x": 900, "y": 620, "width": 40, "height": 20}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0005}, "observations": ["chromatic base-colour response", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "rim-inner", "regionId": "rim-lip", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "glossy", "aliases": [], "confidence": 0.825, "source": "vision"}, "alternatives": []}, "referencePbrEvidenceNote": "verified crop rim-lip bbox {'x': 900, 'y': 620, 'width': 40, 'height': 20} -> palette ['#7D2401', '#4D1708', '#B53200'] (confidence 0.825)", "textureless": {"declared": true, "evidence": ["ref/shield_logo.png: flat-shaded glowing illustration; solid colour regions with no grain, print or pores (see crops/sheet.png)", "stylized mascot additions (eyes, brows, mouth, limbs) are absent from the reference and are authored as flat toy paint by design", "verified crop rim-lip bbox {'x': 900, 'y': 620, 'width': 40, 'height': 20} -> palette ['#7D2401', '#4D1708', '#B53200'] (confidence 0.825)"]}},
    options
  );
  materialMap["plate-green"] = createSculptMaterial(
    "plate-green",
    {"id": "plate-green", "name": "Grid plate glossy green", "type": "physical", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#138c2e", "color": "#138c2e", "albedo": {"dominant": "#138c2e", "secondary": ["#138c2e"], "samplingNotes": "solid albedo from the reference's flat-paint region (stylized illustration)"}, "colorVariation": {"palette": ["#138c2e"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.28, "variation": 0.04, "map": "uniform scalar (textureless flat paint)", "localResponse": "uniform glossy plastic"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "plate-gloss-hotspot", "region": "upper observer-left", "roughness": 0.1, "clearcoat": 1.0}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "emissive": "#0a5a18", "emissiveIntensity": 0.25, "clearcoat": {"base": 0.2, "variation": 0.0}, "clearcoatRoughness": {"base": 0.18, "variation": 0.0}, "referenceMaterialId": "plastic.glossy", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "glossy", "materialReference": {"registry": "/home/claude/img2threejs/docs/materials/material-reference.json", "profileId": "plastic.glossy", "method": "family-subtype-finish", "confidence": 0.829, "sourceRefs": ["three.mesh-physical", "three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap"], "validationViews": ["neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "ior": {"base": 1.5, "variation": 0.0}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#095B34", "#08591E", "#27FB86", "#086519", "#065C16"], "paletteHueRisk": [], "gradientAxis": "vertical", "stats": {"meanLum": 78.1, "meanSaturation": 0.931, "gradientStrength": 0.488, "mottle": 0.019, "streakRatio": 0.78, "hueSpread": 0.014, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "grid-plate", "regionId": "plate", "crop": {"path": "/root/shieldbot/material-evidence/00-plate.png", "bbox": {"x": 510, "y": 860, "width": 44, "height": 44}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0012}, "observations": ["chromatic base-colour response", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "grid-plate", "regionId": "plate", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "glossy", "aliases": [], "confidence": 0.829, "source": "vision"}, "alternatives": []}, "referencePbrEvidenceNote": "verified crop plate bbox {'x': 510, 'y': 860, 'width': 44, 'height': 44} -> palette ['#01490C', '#2BF57A', '#043F1B'] (confidence 0.829)", "textureless": {"declared": true, "evidence": ["ref/shield_logo.png: flat-shaded glowing illustration; solid colour regions with no grain, print or pores (see crops/sheet.png)", "stylized mascot additions (eyes, brows, mouth, limbs) are absent from the reference and are authored as flat toy paint by design", "verified crop plate bbox {'x': 510, 'y': 860, 'width': 44, 'height': 44} -> palette ['#01490C', '#2BF57A', '#043F1B'] (confidence 0.829)"]}},
    options
  );
  materialMap["grid-glow"] = createSculptMaterial(
    "grid-glow",
    {"id": "grid-glow", "name": "Grid line emissive green", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#48ff86", "color": "#48ff86", "albedo": {"dominant": "#48ff86", "secondary": ["#48ff86"], "samplingNotes": "solid albedo from the reference's flat-paint region (stylized illustration)"}, "colorVariation": {"palette": ["#48ff86"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.4, "variation": 0.04, "map": "uniform scalar (textureless flat paint)", "localResponse": "uniform glossy plastic"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "emissive": "#1fd35a", "emissiveIntensity": 0.45, "textureless": {"declared": true, "evidence": ["ref/shield_logo.png: flat-shaded glowing illustration; solid colour regions with no grain, print or pores (see crops/sheet.png)", "stylized mascot additions (eyes, brows, mouth, limbs) are absent from the reference and are authored as flat toy paint by design"]}},
    options
  );
  materialMap["gold-ember"] = createSculptMaterial(
    "gold-ember",
    {"id": "gold-ember", "name": "Keyhole ring gold emissive", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#ffb21f", "color": "#ffb21f", "albedo": {"dominant": "#ffb21f", "secondary": ["#ffb21f"], "samplingNotes": "solid albedo from the reference's flat-paint region (stylized illustration)"}, "colorVariation": {"palette": ["#ffb21f"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.22, "variation": 0.04, "map": "uniform scalar (textureless flat paint)", "localResponse": "uniform glossy plastic"}, "metalness": {"base": 1.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "emissive": "#b05a00", "emissiveIntensity": 0.5, "referenceMaterialId": "metal.gold", "materialFamily": "metal", "materialSubtype": "gold", "materialFinish": "polished", "materialReference": {"registry": "/home/claude/img2threejs/docs/materials/material-reference.json", "profileId": "metal.gold", "method": "family-subtype-finish", "confidence": 0.829, "sourceRefs": ["three.mesh-standard", "three.pmrem", "gltf.2", "khronos.gltf-pbr", "adobe.pbr-guide-2", "google.filament-pbr"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "metalnessMap"], "validationViews": ["albedo-unlit", "environment-reflection", "grazing", "reference-beauty"]}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#F9E224", "#E6A523", "#85470A", "#7C4006", "#AB6F0F"], "paletteHueRisk": [], "gradientAxis": "vertical", "stats": {"meanLum": 122.8, "meanSaturation": 0.916, "gradientStrength": 0.56, "mottle": 0.025, "streakRatio": 0.94, "hueSpread": 0.039, "specularFraction": 0.053}}, "materialEvidence": {"componentId": "keyhole-medallion", "regionId": "ring", "crop": {"path": "/root/shieldbot/material-evidence/03-ring.png", "bbox": {"x": 548, "y": 490, "width": 34, "height": 60}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0013}, "observations": ["chromatic base-colour response", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "keyhole-medallion", "regionId": "ring", "materialId": null, "family": "metal", "subtype": "gold", "finish": "polished", "aliases": [], "confidence": 0.829, "source": "vision"}, "alternatives": []}, "needsEnvironment": true, "referencePbrEvidenceNote": "verified crop ring bbox {'x': 548, 'y': 490, 'width': 34, 'height': 60} -> palette ['#FAD00D', '#330C01', '#DD7B04'] (confidence 0.829)", "textureless": {"declared": true, "evidence": ["ref/shield_logo.png: flat-shaded glowing illustration; solid colour regions with no grain, print or pores (see crops/sheet.png)", "stylized mascot additions (eyes, brows, mouth, limbs) are absent from the reference and are authored as flat toy paint by design", "verified crop ring bbox {'x': 548, 'y': 490, 'width': 34, 'height': 60} -> palette ['#FAD00D', '#330C01', '#DD7B04'] (confidence 0.829)"]}},
    options
  );
  materialMap["keyhole-dark"] = createSculptMaterial(
    "keyhole-dark",
    {"id": "keyhole-dark", "name": "Keyhole inlay dark amber", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#6a3302", "color": "#6a3302", "albedo": {"dominant": "#6a3302", "secondary": ["#6a3302"], "samplingNotes": "solid albedo from the reference's flat-paint region (stylized illustration)"}, "colorVariation": {"palette": ["#6a3302"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.6, "variation": 0.04, "map": "uniform scalar (textureless flat paint)", "localResponse": "uniform glossy plastic"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "emissive": "#3a1800", "emissiveIntensity": 0.4, "textureless": {"declared": true, "evidence": ["ref/shield_logo.png: flat-shaded glowing illustration; solid colour regions with no grain, print or pores (see crops/sheet.png)", "stylized mascot additions (eyes, brows, mouth, limbs) are absent from the reference and are authored as flat toy paint by design"]}},
    options
  );
  materialMap["chart-glow"] = createSculptMaterial(
    "chart-glow",
    {"id": "chart-glow", "name": "Chart emissive orange-yellow", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#ffd21a", "color": "#ffd21a", "albedo": {"dominant": "#ffd21a", "secondary": ["#ffd21a"], "samplingNotes": "solid albedo from the reference's flat-paint region (stylized illustration)"}, "colorVariation": {"palette": ["#ffd21a"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.3, "variation": 0.04, "map": "uniform scalar (textureless flat paint)", "localResponse": "uniform glossy plastic"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "emissive": "#e08a00", "emissiveIntensity": 0.55, "textureless": {"declared": true, "evidence": ["ref/shield_logo.png: flat-shaded glowing illustration; solid colour regions with no grain, print or pores (see crops/sheet.png)", "stylized mascot additions (eyes, brows, mouth, limbs) are absent from the reference and are authored as flat toy paint by design"]}},
    options
  );
  materialMap["play-dark"] = createSculptMaterial(
    "play-dark",
    {"id": "play-dark", "name": "Play glyph dark", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#0a0a12", "color": "#0a0a12", "albedo": {"dominant": "#0a0a12", "secondary": ["#0a0a12"], "samplingNotes": "solid albedo from the reference's flat-paint region (stylized illustration)"}, "colorVariation": {"palette": ["#0a0a12"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.35, "variation": 0.04, "map": "uniform scalar (textureless flat paint)", "localResponse": "uniform glossy plastic"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "textureless": {"declared": true, "evidence": ["ref/shield_logo.png: flat-shaded glowing illustration; solid colour regions with no grain, print or pores (see crops/sheet.png)", "stylized mascot additions (eyes, brows, mouth, limbs) are absent from the reference and are authored as flat toy paint by design"]}},
    options
  );
  materialMap["trail-cyan"] = createSculptMaterial(
    "trail-cyan",
    {"id": "trail-cyan", "name": "Orbit trail cyan emissive", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#14d8ff", "color": "#14d8ff", "albedo": {"dominant": "#14d8ff", "secondary": ["#14d8ff"], "samplingNotes": "solid albedo from the reference's flat-paint region (stylized illustration)"}, "colorVariation": {"palette": ["#14d8ff"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.28, "variation": 0.04, "map": "uniform scalar (textureless flat paint)", "localResponse": "uniform glossy plastic"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "emissive": "#0068d8", "emissiveIntensity": 0.6, "referenceMaterialId": "plastic.glossy", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "glossy", "materialReference": {"registry": "/home/claude/img2threejs/docs/materials/material-reference.json", "profileId": "plastic.glossy", "method": "family-subtype-finish", "confidence": 0.81, "sourceRefs": ["three.mesh-physical", "three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap"], "validationViews": ["neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": {"base": 0.2, "variation": 0.0}, "clearcoatRoughness": {"base": 0.18, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#29FBFC", "#34FCFD", "#03C6FD", "#008EFC", "#018EFC"], "paletteHueRisk": [{"stop": "#008EFC", "hueRisk": "blue-collapse", "suggestedRgb": [252, 142, 0]}, {"stop": "#018EFC", "hueRisk": "blue-collapse", "suggestedRgb": [252, 142, 1]}], "gradientAxis": "horizontal", "stats": {"meanLum": 150.1, "meanSaturation": 0.934, "gradientStrength": 0.321, "mottle": 0.009, "streakRatio": 2.52, "hueSpread": 0.024, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "orbit-trail-a", "regionId": "trail", "crop": {"path": "/root/shieldbot/material-evidence/04-trail.png", "bbox": {"x": 100, "y": 790, "width": 40, "height": 20}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0005}, "observations": ["chromatic base-colour response", "directional surface frequency", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "orbit-trail-a", "regionId": "trail", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "glossy", "aliases": [], "confidence": 0.81, "source": "vision"}, "alternatives": []}, "referencePbrEvidenceNote": "verified crop trail bbox {'x': 100, 'y': 790, 'width': 40, 'height': 20} -> palette ['#13FCFD', '#0087FC', '#019AFE'] (confidence 0.81)", "textureless": {"declared": true, "evidence": ["ref/shield_logo.png: flat-shaded glowing illustration; solid colour regions with no grain, print or pores (see crops/sheet.png)", "stylized mascot additions (eyes, brows, mouth, limbs) are absent from the reference and are authored as flat toy paint by design", "verified crop trail bbox {'x': 100, 'y': 790, 'width': 40, 'height': 20} -> palette ['#13FCFD', '#0087FC', '#019AFE'] (confidence 0.81)"]}},
    options
  );
  materialMap["trail-orange"] = createSculptMaterial(
    "trail-orange",
    {"id": "trail-orange", "name": "Orbit trail orange emissive", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#df4d01", "color": "#df4d01", "albedo": {"dominant": "#df4d01", "secondary": ["#df4d01"], "samplingNotes": "solid albedo from the reference's flat-paint region (stylized illustration)"}, "colorVariation": {"palette": ["#df4d01"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.3, "variation": 0.04, "map": "uniform scalar (textureless flat paint)", "localResponse": "uniform glossy plastic"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "emissive": "#c04000", "emissiveIntensity": 1.4, "textureless": {"declared": true, "evidence": ["ref/shield_logo.png: flat-shaded glowing illustration; solid colour regions with no grain, print or pores (see crops/sheet.png)", "stylized mascot additions (eyes, brows, mouth, limbs) are absent from the reference and are authored as flat toy paint by design"]}},
    options
  );
  materialMap["pixel-glow"] = createSculptMaterial(
    "pixel-glow",
    {"id": "pixel-glow", "name": "Data pixel emissive blue", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#6fc3ff", "color": "#6fc3ff", "albedo": {"dominant": "#6fc3ff", "secondary": ["#6fc3ff"], "samplingNotes": "solid albedo from the reference's flat-paint region (stylized illustration)"}, "colorVariation": {"palette": ["#6fc3ff"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.3, "variation": 0.04, "map": "uniform scalar (textureless flat paint)", "localResponse": "uniform glossy plastic"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "pixel-instances", "region": "data-pixels repetition system", "emissiveIntensity": 1.6}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "emissive": "#2f8fff", "emissiveIntensity": 1.6, "textureless": {"declared": true, "evidence": ["ref/shield_logo.png: flat-shaded glowing illustration; solid colour regions with no grain, print or pores (see crops/sheet.png)", "stylized mascot additions (eyes, brows, mouth, limbs) are absent from the reference and are authored as flat toy paint by design"]}},
    options
  );
  materialMap["eye-white"] = createSculptMaterial(
    "eye-white",
    {"id": "eye-white", "name": "Eye white gloss", "type": "physical", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#ffffff", "color": "#ffffff", "albedo": {"dominant": "#ffffff", "secondary": ["#ffffff"], "samplingNotes": "solid albedo from the reference's flat-paint region (stylized illustration)"}, "colorVariation": {"palette": ["#ffffff"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.15, "variation": 0.04, "map": "uniform scalar (textureless flat paint)", "localResponse": "uniform glossy plastic"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": 1.0, "clearcoatRoughness": 0.08, "textureless": {"declared": true, "evidence": ["ref/shield_logo.png: flat-shaded glowing illustration; solid colour regions with no grain, print or pores (see crops/sheet.png)", "stylized mascot additions (eyes, brows, mouth, limbs) are absent from the reference and are authored as flat toy paint by design"]}},
    options
  );
  materialMap["pupil-black"] = createSculptMaterial(
    "pupil-black",
    {"id": "pupil-black", "name": "Pupil / brow / mouth black", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#0b0b14", "color": "#0b0b14", "albedo": {"dominant": "#0b0b14", "secondary": ["#0b0b14"], "samplingNotes": "solid albedo from the reference's flat-paint region (stylized illustration)"}, "colorVariation": {"palette": ["#0b0b14"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.3, "variation": 0.04, "map": "uniform scalar (textureless flat paint)", "localResponse": "uniform glossy plastic"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "textureless": {"declared": true, "evidence": ["ref/shield_logo.png: flat-shaded glowing illustration; solid colour regions with no grain, print or pores (see crops/sheet.png)", "stylized mascot additions (eyes, brows, mouth, limbs) are absent from the reference and are authored as flat toy paint by design"]}},
    options
  );
  materialMap["limb-blue"] = createSculptMaterial(
    "limb-blue",
    {"id": "limb-blue", "name": "Limb steel-blue", "type": "physical", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#2f6be0", "color": "#2f6be0", "albedo": {"dominant": "#2f6be0", "secondary": ["#2f6be0"], "samplingNotes": "solid albedo from the reference's flat-paint region (stylized illustration)"}, "colorVariation": {"palette": ["#2f6be0"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.3, "variation": 0.04, "map": "uniform scalar (textureless flat paint)", "localResponse": "uniform glossy plastic"}, "metalness": {"base": 0.15, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "emissive": "#0b3a9e", "emissiveIntensity": 0.3, "clearcoat": 0.5, "clearcoatRoughness": 0.08, "textureless": {"declared": true, "evidence": ["ref/shield_logo.png: flat-shaded glowing illustration; solid colour regions with no grain, print or pores (see crops/sheet.png)", "stylized mascot additions (eyes, brows, mouth, limbs) are absent from the reference and are authored as flat toy paint by design"]}},
    options
  );
  materialMap["glove-white"] = createSculptMaterial(
    "glove-white",
    {"id": "glove-white", "name": "Glove white", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#f4f6fb", "color": "#f4f6fb", "albedo": {"dominant": "#f4f6fb", "secondary": ["#f4f6fb"], "samplingNotes": "solid albedo from the reference's flat-paint region (stylized illustration)"}, "colorVariation": {"palette": ["#f4f6fb"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.35, "variation": 0.04, "map": "uniform scalar (textureless flat paint)", "localResponse": "uniform glossy plastic"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "textureless": {"declared": true, "evidence": ["ref/shield_logo.png: flat-shaded glowing illustration; solid colour regions with no grain, print or pores (see crops/sheet.png)", "stylized mascot additions (eyes, brows, mouth, limbs) are absent from the reference and are authored as flat toy paint by design"]}},
    options
  );
  materialMap["shoe-dark"] = createSculptMaterial(
    "shoe-dark",
    {"id": "shoe-dark", "name": "Shoe dark", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#141820", "color": "#141820", "albedo": {"dominant": "#141820", "secondary": ["#141820"], "samplingNotes": "solid albedo from the reference's flat-paint region (stylized illustration)"}, "colorVariation": {"palette": ["#141820"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.35, "variation": 0.04, "map": "uniform scalar (textureless flat paint)", "localResponse": "uniform glossy plastic"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "textureless": {"declared": true, "evidence": ["ref/shield_logo.png: flat-shaded glowing illustration; solid colour regions with no grain, print or pores (see crops/sheet.png)", "stylized mascot additions (eyes, brows, mouth, limbs) are absent from the reference and are authored as flat toy paint by design"]}},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const endpoint_root_0 = makeAttachmentEndpoint(null);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "Shield body (outer rim shell)__pivot";
  node_root_0.scale.set(1, 1, 1);
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "Shield body (outer rim shell)", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Heater-shield silhouette is a planar outline with uniform thickness: an extruded profile, bilateral.", "geometryDescriptor": {"topologyIntent": "extrude part for Shield body (outer rim shell)", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.04, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[-0.95, 1.12], [-0.97, 0.55], [-0.9, 0.0], [-0.72, -0.5], [-0.42, -0.92], [0.0, -1.28], [0.42, -0.92], [0.72, -0.5], [0.9, 0.0], [0.97, 0.55], [0.95, 1.12], [0.5, 1.2], [0.0, 1.24], [-0.5, 1.2]], "depth": 0.34}}, "parent": null, "attachment": null, "dimensions": {"width": 2.0, "height": 2.5, "depth": 0.34, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "rim-steel"}}, "material": "rim-steel", "materialLayers": ["rim-steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "rim-bevel", "type": "bevel", "kind": "bevel", "description": "chamfered outer lip catches rim light", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.04, "segments": 3}}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(1, 70, 155, 1.0)", "secondaryAlbedo": "rgba(11, 39, 92, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/root.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/root.png; its material-class guess (plastic, 0.578) was overridden by visual analysis"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "rim-steel"}, "materialRegions": [{"regionId": "rim-outer", "materialId": "rim-steel", "profileId": "metal.steel-polished", "crop": {"path": "/root/shieldbot/material-evidence/01-rim-outer.png", "bbox": {"x": 996, "y": 380, "width": 16, "height": 80}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0008}}]};
  node_root_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "rim-steel"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 16, 6)
    : buildExtrudeGeometry({"points": [[-0.95, 1.12], [-0.97, 0.55], [-0.9, 0.0], [-0.72, -0.5], [-0.42, -0.92], [0.0, -1.28], [0.42, -0.92], [0.72, -0.5], [0.9, 0.0], [0.97, 0.55], [0.95, 1.12], [0.5, 1.2], [0.0, 1.24], [-0.5, 1.2]], "depth": 0.34});
  if (!endpoint_root_0) {
    mesh_root_0Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["rim-steel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "Shield body (outer rim shell)";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "Shield body (outer rim shell)", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Heater-shield silhouette is a planar outline with uniform thickness: an extruded profile, bilateral.", "geometryDescriptor": {"topologyIntent": "extrude part for Shield body (outer rim shell)", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.04, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[-0.95, 1.12], [-0.97, 0.55], [-0.9, 0.0], [-0.72, -0.5], [-0.42, -0.92], [0.0, -1.28], [0.42, -0.92], [0.72, -0.5], [0.9, 0.0], [0.97, 0.55], [0.95, 1.12], [0.5, 1.2], [0.0, 1.24], [-0.5, 1.2]], "depth": 0.34}}, "parent": null, "attachment": null, "dimensions": {"width": 2.0, "height": 2.5, "depth": 0.34, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "rim-steel"}}, "material": "rim-steel", "materialLayers": ["rim-steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "rim-bevel", "type": "bevel", "kind": "bevel", "description": "chamfered outer lip catches rim light", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.04, "segments": 3}}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(1, 70, 155, 1.0)", "secondaryAlbedo": "rgba(11, 39, 92, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/root.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/root.png; its material-class guess (plastic, 0.578) was overridden by visual analysis"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "rim-steel"}, "materialRegions": [{"regionId": "rim-outer", "materialId": "rim-steel", "profileId": "metal.steel-polished", "crop": {"path": "/root/shieldbot/material-evidence/01-rim-outer.png", "bbox": {"x": 996, "y": 380, "width": 16, "height": 80}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0008}}]};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);

  const endpoint_rim_highlight_1 = makeAttachmentEndpoint(null);
  const node_rim_highlight_1 = new THREE.Group();
  node_rim_highlight_1.name = "Rim bevel highlight lip__pivot";
  node_rim_highlight_1.scale.set(1, 1, 1);
  if (endpoint_rim_highlight_1) {
    node_rim_highlight_1.position.copy(endpoint_rim_highlight_1.start);
    node_rim_highlight_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_rim_highlight_1.position.set(0.0, 0.0, 0.3);
    node_rim_highlight_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_rim_highlight_1.userData.sculptComponent = {"id": "rim-highlight", "name": "Rim bevel highlight lip", "level": "micro", "role": "trim", "importance": 0.4, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Generator ignores edgeTreatment on extrudes (bevelEnabled is hardcoded false), so the chamfer highlight from the reference is realised as a lighter steel front lip: the outer 7% band of the outline shows in front of the rim shell.", "geometryDescriptor": {"topologyIntent": "extrude part for Rim bevel highlight lip", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[-0.95, 1.12], [-0.97, 0.55], [-0.9, 0.0], [-0.72, -0.5], [-0.42, -0.92], [0.0, -1.28], [0.42, -0.92], [0.72, -0.5], [0.9, 0.0], [0.97, 0.55], [0.95, 1.12], [0.5, 1.2], [0.0, 1.24], [-0.5, 1.2]], "depth": 0.05}}, "parent": "root", "attachment": {"parentSocket": "root-surface", "parentId": "root", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on root; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 2.0, "height": 2.5, "depth": 0.05, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0, 0.3], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "rim-highlight", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "rim-bevel-light"}}, "material": "rim-bevel-light", "materialLayers": ["rim-bevel-light"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "rim-bevel-geometry", "type": "bevel", "kind": "bevel", "description": "bright chamfer lip as geometry"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(5, 26, 71, 1.0)", "secondaryAlbedo": "rgba(3, 44, 107, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/rim-highlight.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/rim-highlight.png; its material-class guess (plastic, 0.578) was overridden by visual analysis"}};
  node_rim_highlight_1.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "rim-highlight", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "rim-bevel-light"}};
  (nodes["root"] ?? root).add(node_rim_highlight_1);
  nodes["rim-highlight"] = node_rim_highlight_1;
  const mesh_rim_highlight_1Geometry = endpoint_rim_highlight_1
    ? new THREE.CylinderGeometry(endpoint_rim_highlight_1.endRadius, endpoint_rim_highlight_1.baseRadius, endpoint_rim_highlight_1.length, 16, 6)
    : buildExtrudeGeometry({"points": [[-0.95, 1.12], [-0.97, 0.55], [-0.9, 0.0], [-0.72, -0.5], [-0.42, -0.92], [0.0, -1.28], [0.42, -0.92], [0.72, -0.5], [0.9, 0.0], [0.97, 0.55], [0.95, 1.12], [0.5, 1.2], [0.0, 1.24], [-0.5, 1.2]], "depth": 0.05});
  if (!endpoint_rim_highlight_1) {
    mesh_rim_highlight_1Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_rim_highlight_1 = new THREE.Mesh(
    mesh_rim_highlight_1Geometry,
    materialMap["rim-bevel-light"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_rim_highlight_1.name = "Rim bevel highlight lip";
  if (endpoint_rim_highlight_1) {
    mesh_rim_highlight_1.position.copy(endpoint_rim_highlight_1.midpoint);
    mesh_rim_highlight_1.quaternion.copy(endpoint_rim_highlight_1.quaternion);
  }
  mesh_rim_highlight_1.castShadow = options.castShadow ?? true;
  mesh_rim_highlight_1.receiveShadow = options.receiveShadow ?? true;
  mesh_rim_highlight_1.userData.sculptComponent = {"id": "rim-highlight", "name": "Rim bevel highlight lip", "level": "micro", "role": "trim", "importance": 0.4, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Generator ignores edgeTreatment on extrudes (bevelEnabled is hardcoded false), so the chamfer highlight from the reference is realised as a lighter steel front lip: the outer 7% band of the outline shows in front of the rim shell.", "geometryDescriptor": {"topologyIntent": "extrude part for Rim bevel highlight lip", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[-0.95, 1.12], [-0.97, 0.55], [-0.9, 0.0], [-0.72, -0.5], [-0.42, -0.92], [0.0, -1.28], [0.42, -0.92], [0.72, -0.5], [0.9, 0.0], [0.97, 0.55], [0.95, 1.12], [0.5, 1.2], [0.0, 1.24], [-0.5, 1.2]], "depth": 0.05}}, "parent": "root", "attachment": {"parentSocket": "root-surface", "parentId": "root", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on root; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 2.0, "height": 2.5, "depth": 0.05, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0, 0.3], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "rim-highlight", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "rim-bevel-light"}}, "material": "rim-bevel-light", "materialLayers": ["rim-bevel-light"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "rim-bevel-geometry", "type": "bevel", "kind": "bevel", "description": "bright chamfer lip as geometry"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(5, 26, 71, 1.0)", "secondaryAlbedo": "rgba(3, 44, 107, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/rim-highlight.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/rim-highlight.png; its material-class guess (plastic, 0.578) was overridden by visual analysis"}};
  node_rim_highlight_1.add(mesh_rim_highlight_1);
  meshes["rim-highlight"] = mesh_rim_highlight_1;
  colliders["rim-highlight"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["rim-highlight"] ??= [];
  destructionGroups["rim-highlight"].push(node_rim_highlight_1);

  const endpoint_rim_inner_2 = makeAttachmentEndpoint(null);
  const node_rim_inner_2 = new THREE.Group();
  node_rim_inner_2.name = "Inner rim lip (emissive orange)__pivot";
  node_rim_inner_2.scale.set(1, 1, 1);
  if (endpoint_rim_inner_2) {
    node_rim_inner_2.position.copy(endpoint_rim_inner_2.start);
    node_rim_inner_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_rim_inner_2.position.set(0.0, 0.0, 0.34);
    node_rim_inner_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_rim_inner_2.userData.sculptComponent = {"id": "rim-inner", "name": "Inner rim lip (emissive orange)", "level": "meso", "role": "trim", "importance": 0.7, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Inner rim lip (emissive orange) is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "extrude part for Inner rim lip (emissive orange)", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[-0.8835, 1.0416], [-0.9021, 0.5115], [-0.837, 0.0], [-0.6696, -0.465], [-0.3906, -0.8556], [0.0, -1.1904], [0.3906, -0.8556], [0.6696, -0.465], [0.837, 0.0], [0.9021, 0.5115], [0.8835, 1.0416], [0.465, 1.116], [0.0, 1.1532], [-0.465, 1.116]], "depth": 0.04}}, "parent": "root", "attachment": {"parentSocket": "root-surface", "parentId": "root", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on root; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.86, "height": 2.33, "depth": 0.04, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0, 0.34], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "rim-inner", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "rim-ember"}}, "material": "rim-ember", "materialLayers": ["rim-ember"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "rim-inner-emissive-lip", "type": "contour", "kind": "contour", "description": "warm emissive inner lip between steel rim and plate"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(98, 29, 5, 1.0)", "secondaryAlbedo": "rgba(204, 65, 1, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/rim-inner.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/rim-inner.png; its material-class guess (plastic, 0.512) was overridden by visual analysis"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "rim-ember"}, "materialRegions": [{"regionId": "rim-lip", "materialId": "rim-ember", "profileId": "plastic.glossy", "crop": {"path": "/root/shieldbot/material-evidence/02-rim-lip.png", "bbox": {"x": 900, "y": 620, "width": 40, "height": 20}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0005}}]};
  node_rim_inner_2.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "rim-inner", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "rim-ember"}};
  (nodes["root"] ?? root).add(node_rim_inner_2);
  nodes["rim-inner"] = node_rim_inner_2;
  const mesh_rim_inner_2Geometry = endpoint_rim_inner_2
    ? new THREE.CylinderGeometry(endpoint_rim_inner_2.endRadius, endpoint_rim_inner_2.baseRadius, endpoint_rim_inner_2.length, 16, 6)
    : buildExtrudeGeometry({"points": [[-0.8835, 1.0416], [-0.9021, 0.5115], [-0.837, 0.0], [-0.6696, -0.465], [-0.3906, -0.8556], [0.0, -1.1904], [0.3906, -0.8556], [0.6696, -0.465], [0.837, 0.0], [0.9021, 0.5115], [0.8835, 1.0416], [0.465, 1.116], [0.0, 1.1532], [-0.465, 1.116]], "depth": 0.04});
  if (!endpoint_rim_inner_2) {
    mesh_rim_inner_2Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_rim_inner_2 = new THREE.Mesh(
    mesh_rim_inner_2Geometry,
    materialMap["rim-ember"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_rim_inner_2.name = "Inner rim lip (emissive orange)";
  if (endpoint_rim_inner_2) {
    mesh_rim_inner_2.position.copy(endpoint_rim_inner_2.midpoint);
    mesh_rim_inner_2.quaternion.copy(endpoint_rim_inner_2.quaternion);
  }
  mesh_rim_inner_2.castShadow = options.castShadow ?? true;
  mesh_rim_inner_2.receiveShadow = options.receiveShadow ?? true;
  mesh_rim_inner_2.userData.sculptComponent = {"id": "rim-inner", "name": "Inner rim lip (emissive orange)", "level": "meso", "role": "trim", "importance": 0.7, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Inner rim lip (emissive orange) is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "extrude part for Inner rim lip (emissive orange)", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[-0.8835, 1.0416], [-0.9021, 0.5115], [-0.837, 0.0], [-0.6696, -0.465], [-0.3906, -0.8556], [0.0, -1.1904], [0.3906, -0.8556], [0.6696, -0.465], [0.837, 0.0], [0.9021, 0.5115], [0.8835, 1.0416], [0.465, 1.116], [0.0, 1.1532], [-0.465, 1.116]], "depth": 0.04}}, "parent": "root", "attachment": {"parentSocket": "root-surface", "parentId": "root", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on root; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.86, "height": 2.33, "depth": 0.04, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0, 0.34], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "rim-inner", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "rim-ember"}}, "material": "rim-ember", "materialLayers": ["rim-ember"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "rim-inner-emissive-lip", "type": "contour", "kind": "contour", "description": "warm emissive inner lip between steel rim and plate"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(98, 29, 5, 1.0)", "secondaryAlbedo": "rgba(204, 65, 1, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/rim-inner.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/rim-inner.png; its material-class guess (plastic, 0.512) was overridden by visual analysis"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "rim-ember"}, "materialRegions": [{"regionId": "rim-lip", "materialId": "rim-ember", "profileId": "plastic.glossy", "crop": {"path": "/root/shieldbot/material-evidence/02-rim-lip.png", "bbox": {"x": 900, "y": 620, "width": 40, "height": 20}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0005}}]};
  node_rim_inner_2.add(mesh_rim_inner_2);
  meshes["rim-inner"] = mesh_rim_inner_2;
  colliders["rim-inner"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["rim-inner"] ??= [];
  destructionGroups["rim-inner"].push(node_rim_inner_2);

  const endpoint_grid_plate_3 = makeAttachmentEndpoint(null);
  const node_grid_plate_3 = new THREE.Group();
  node_grid_plate_3.name = "Green grid plate__pivot";
  node_grid_plate_3.scale.set(1, 1, 1);
  if (endpoint_grid_plate_3) {
    node_grid_plate_3.position.copy(endpoint_grid_plate_3.start);
    node_grid_plate_3.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_grid_plate_3.position.set(0.0, 0.0, 0.36);
    node_grid_plate_3.rotation.set(0.0, 0.0, 0.0);
  }
  node_grid_plate_3.userData.sculptComponent = {"id": "grid-plate", "name": "Green grid plate", "level": "meso", "role": "panel", "importance": 0.7, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Green grid plate is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "extrude part for Green grid plate", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[-0.817, 0.9632], [-0.8342, 0.473], [-0.774, 0.0], [-0.6192, -0.43], [-0.3612, -0.7912], [0.0, -1.1008], [0.3612, -0.7912], [0.6192, -0.43], [0.774, 0.0], [0.8342, 0.473], [0.817, 0.9632], [0.43, 1.032], [0.0, 1.0664], [-0.43, 1.032]], "depth": 0.06}}, "parent": "root", "attachment": {"parentSocket": "root-surface", "parentId": "root", "contactType": "embed", "embedDepth": 0.02, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on root; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.72, "height": 2.15, "depth": 0.06, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0, 0.36], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-plate", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plate-green"}}, "material": "plate-green", "materialLayers": ["plate-green"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "grid-lines", "type": "linework", "kind": "linework", "description": "emissive divider lines realised as micro components grid-v-* / grid-h-*"}, {"id": "plate-gloss", "type": "gloss", "kind": "gloss", "description": "clearcoat hotspot upper observer-left", "roughness": 0.12}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(4, 86, 17, 1.0)", "secondaryAlbedo": "rgba(53, 240, 118, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-plate.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-plate.png; its material-class guess (plastic, 0.568) was overridden by visual analysis"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "plate-green"}, "materialRegions": [{"regionId": "plate", "materialId": "plate-green", "profileId": "plastic.glossy", "crop": {"path": "/root/shieldbot/material-evidence/00-plate.png", "bbox": {"x": 510, "y": 860, "width": 44, "height": 44}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0012}}]};
  node_grid_plate_3.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-plate", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plate-green"}};
  (nodes["root"] ?? root).add(node_grid_plate_3);
  nodes["grid-plate"] = node_grid_plate_3;
  const mesh_grid_plate_3Geometry = endpoint_grid_plate_3
    ? new THREE.CylinderGeometry(endpoint_grid_plate_3.endRadius, endpoint_grid_plate_3.baseRadius, endpoint_grid_plate_3.length, 16, 6)
    : buildExtrudeGeometry({"points": [[-0.817, 0.9632], [-0.8342, 0.473], [-0.774, 0.0], [-0.6192, -0.43], [-0.3612, -0.7912], [0.0, -1.1008], [0.3612, -0.7912], [0.6192, -0.43], [0.774, 0.0], [0.8342, 0.473], [0.817, 0.9632], [0.43, 1.032], [0.0, 1.0664], [-0.43, 1.032]], "depth": 0.06});
  if (!endpoint_grid_plate_3) {
    mesh_grid_plate_3Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_grid_plate_3 = new THREE.Mesh(
    mesh_grid_plate_3Geometry,
    materialMap["plate-green"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_grid_plate_3.name = "Green grid plate";
  if (endpoint_grid_plate_3) {
    mesh_grid_plate_3.position.copy(endpoint_grid_plate_3.midpoint);
    mesh_grid_plate_3.quaternion.copy(endpoint_grid_plate_3.quaternion);
  }
  mesh_grid_plate_3.castShadow = options.castShadow ?? true;
  mesh_grid_plate_3.receiveShadow = options.receiveShadow ?? true;
  mesh_grid_plate_3.userData.sculptComponent = {"id": "grid-plate", "name": "Green grid plate", "level": "meso", "role": "panel", "importance": 0.7, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Green grid plate is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "extrude part for Green grid plate", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[-0.817, 0.9632], [-0.8342, 0.473], [-0.774, 0.0], [-0.6192, -0.43], [-0.3612, -0.7912], [0.0, -1.1008], [0.3612, -0.7912], [0.6192, -0.43], [0.774, 0.0], [0.8342, 0.473], [0.817, 0.9632], [0.43, 1.032], [0.0, 1.0664], [-0.43, 1.032]], "depth": 0.06}}, "parent": "root", "attachment": {"parentSocket": "root-surface", "parentId": "root", "contactType": "embed", "embedDepth": 0.02, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on root; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.72, "height": 2.15, "depth": 0.06, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0, 0.36], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-plate", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "plate-green"}}, "material": "plate-green", "materialLayers": ["plate-green"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "grid-lines", "type": "linework", "kind": "linework", "description": "emissive divider lines realised as micro components grid-v-* / grid-h-*"}, {"id": "plate-gloss", "type": "gloss", "kind": "gloss", "description": "clearcoat hotspot upper observer-left", "roughness": 0.12}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(4, 86, 17, 1.0)", "secondaryAlbedo": "rgba(53, 240, 118, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-plate.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-plate.png; its material-class guess (plastic, 0.568) was overridden by visual analysis"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "plate-green"}, "materialRegions": [{"regionId": "plate", "materialId": "plate-green", "profileId": "plastic.glossy", "crop": {"path": "/root/shieldbot/material-evidence/00-plate.png", "bbox": {"x": 510, "y": 860, "width": 44, "height": 44}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0012}}]};
  node_grid_plate_3.add(mesh_grid_plate_3);
  meshes["grid-plate"] = mesh_grid_plate_3;
  colliders["grid-plate"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["grid-plate"] ??= [];
  destructionGroups["grid-plate"].push(node_grid_plate_3);

  const endpoint_grid_v_0_4 = makeAttachmentEndpoint(null);
  const node_grid_v_0_4 = new THREE.Group();
  node_grid_v_0_4.name = "Grid vertical line 0__pivot";
  node_grid_v_0_4.scale.set(1, 1, 1);
  if (endpoint_grid_v_0_4) {
    node_grid_v_0_4.position.copy(endpoint_grid_v_0_4.start);
    node_grid_v_0_4.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_grid_v_0_4.position.set(-0.6, 0.315, 0.065);
    node_grid_v_0_4.rotation.set(0.0, 0.0, 0.0);
  }
  node_grid_v_0_4.userData.sculptComponent = {"id": "grid-v-0", "name": "Grid vertical line 0", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid vertical line 0 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid vertical line 0", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.022, "height": 1.31, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.6, 0.315, 0.065], "rotation": [0, 0, 0], "scale": [0.022, 1.31, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-v-0", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_v_0_4.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-v-0", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}};
  (nodes["grid-plate"] ?? root).add(node_grid_v_0_4);
  nodes["grid-v-0"] = node_grid_v_0_4;
  const mesh_grid_v_0_4Geometry = endpoint_grid_v_0_4
    ? new THREE.CylinderGeometry(endpoint_grid_v_0_4.endRadius, endpoint_grid_v_0_4.baseRadius, endpoint_grid_v_0_4.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_grid_v_0_4) {
    mesh_grid_v_0_4Geometry.scale(0.022, 1.31, 0.012);
  }
  const mesh_grid_v_0_4 = new THREE.Mesh(
    mesh_grid_v_0_4Geometry,
    materialMap["grid-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_grid_v_0_4.name = "Grid vertical line 0";
  if (endpoint_grid_v_0_4) {
    mesh_grid_v_0_4.position.copy(endpoint_grid_v_0_4.midpoint);
    mesh_grid_v_0_4.quaternion.copy(endpoint_grid_v_0_4.quaternion);
  }
  mesh_grid_v_0_4.castShadow = options.castShadow ?? true;
  mesh_grid_v_0_4.receiveShadow = options.receiveShadow ?? true;
  mesh_grid_v_0_4.userData.sculptComponent = {"id": "grid-v-0", "name": "Grid vertical line 0", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid vertical line 0 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid vertical line 0", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.022, "height": 1.31, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.6, 0.315, 0.065], "rotation": [0, 0, 0], "scale": [0.022, 1.31, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-v-0", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_v_0_4.add(mesh_grid_v_0_4);
  meshes["grid-v-0"] = mesh_grid_v_0_4;
  colliders["grid-v-0"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["grid-v-0"] ??= [];
  destructionGroups["grid-v-0"].push(node_grid_v_0_4);

  const endpoint_grid_v_1_5 = makeAttachmentEndpoint(null);
  const node_grid_v_1_5 = new THREE.Group();
  node_grid_v_1_5.name = "Grid vertical line 1__pivot";
  node_grid_v_1_5.scale.set(1, 1, 1);
  if (endpoint_grid_v_1_5) {
    node_grid_v_1_5.position.copy(endpoint_grid_v_1_5.start);
    node_grid_v_1_5.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_grid_v_1_5.position.set(-0.36, 0.125, 0.065);
    node_grid_v_1_5.rotation.set(0.0, 0.0, 0.0);
  }
  node_grid_v_1_5.userData.sculptComponent = {"id": "grid-v-1", "name": "Grid vertical line 1", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid vertical line 1 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid vertical line 1", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.022, "height": 1.69, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.36, 0.125, 0.065], "rotation": [0, 0, 0], "scale": [0.022, 1.69, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-v-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_v_1_5.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-v-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}};
  (nodes["grid-plate"] ?? root).add(node_grid_v_1_5);
  nodes["grid-v-1"] = node_grid_v_1_5;
  const mesh_grid_v_1_5Geometry = endpoint_grid_v_1_5
    ? new THREE.CylinderGeometry(endpoint_grid_v_1_5.endRadius, endpoint_grid_v_1_5.baseRadius, endpoint_grid_v_1_5.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_grid_v_1_5) {
    mesh_grid_v_1_5Geometry.scale(0.022, 1.69, 0.012);
  }
  const mesh_grid_v_1_5 = new THREE.Mesh(
    mesh_grid_v_1_5Geometry,
    materialMap["grid-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_grid_v_1_5.name = "Grid vertical line 1";
  if (endpoint_grid_v_1_5) {
    mesh_grid_v_1_5.position.copy(endpoint_grid_v_1_5.midpoint);
    mesh_grid_v_1_5.quaternion.copy(endpoint_grid_v_1_5.quaternion);
  }
  mesh_grid_v_1_5.castShadow = options.castShadow ?? true;
  mesh_grid_v_1_5.receiveShadow = options.receiveShadow ?? true;
  mesh_grid_v_1_5.userData.sculptComponent = {"id": "grid-v-1", "name": "Grid vertical line 1", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid vertical line 1 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid vertical line 1", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.022, "height": 1.69, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.36, 0.125, 0.065], "rotation": [0, 0, 0], "scale": [0.022, 1.69, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-v-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_v_1_5.add(mesh_grid_v_1_5);
  meshes["grid-v-1"] = mesh_grid_v_1_5;
  colliders["grid-v-1"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["grid-v-1"] ??= [];
  destructionGroups["grid-v-1"].push(node_grid_v_1_5);

  const endpoint_grid_v_2_6 = makeAttachmentEndpoint(null);
  const node_grid_v_2_6 = new THREE.Group();
  node_grid_v_2_6.name = "Grid vertical line 2__pivot";
  node_grid_v_2_6.scale.set(1, 1, 1);
  if (endpoint_grid_v_2_6) {
    node_grid_v_2_6.position.copy(endpoint_grid_v_2_6.start);
    node_grid_v_2_6.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_grid_v_2_6.position.set(-0.12, 0.01, 0.065);
    node_grid_v_2_6.rotation.set(0.0, 0.0, 0.0);
  }
  node_grid_v_2_6.userData.sculptComponent = {"id": "grid-v-2", "name": "Grid vertical line 2", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid vertical line 2 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid vertical line 2", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.022, "height": 1.92, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.12, 0.01, 0.065], "rotation": [0, 0, 0], "scale": [0.022, 1.92, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-v-2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_v_2_6.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-v-2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}};
  (nodes["grid-plate"] ?? root).add(node_grid_v_2_6);
  nodes["grid-v-2"] = node_grid_v_2_6;
  const mesh_grid_v_2_6Geometry = endpoint_grid_v_2_6
    ? new THREE.CylinderGeometry(endpoint_grid_v_2_6.endRadius, endpoint_grid_v_2_6.baseRadius, endpoint_grid_v_2_6.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_grid_v_2_6) {
    mesh_grid_v_2_6Geometry.scale(0.022, 1.92, 0.012);
  }
  const mesh_grid_v_2_6 = new THREE.Mesh(
    mesh_grid_v_2_6Geometry,
    materialMap["grid-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_grid_v_2_6.name = "Grid vertical line 2";
  if (endpoint_grid_v_2_6) {
    mesh_grid_v_2_6.position.copy(endpoint_grid_v_2_6.midpoint);
    mesh_grid_v_2_6.quaternion.copy(endpoint_grid_v_2_6.quaternion);
  }
  mesh_grid_v_2_6.castShadow = options.castShadow ?? true;
  mesh_grid_v_2_6.receiveShadow = options.receiveShadow ?? true;
  mesh_grid_v_2_6.userData.sculptComponent = {"id": "grid-v-2", "name": "Grid vertical line 2", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid vertical line 2 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid vertical line 2", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.022, "height": 1.92, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.12, 0.01, 0.065], "rotation": [0, 0, 0], "scale": [0.022, 1.92, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-v-2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_v_2_6.add(mesh_grid_v_2_6);
  meshes["grid-v-2"] = mesh_grid_v_2_6;
  colliders["grid-v-2"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["grid-v-2"] ??= [];
  destructionGroups["grid-v-2"].push(node_grid_v_2_6);

  const endpoint_grid_v_3_7 = makeAttachmentEndpoint(null);
  const node_grid_v_3_7 = new THREE.Group();
  node_grid_v_3_7.name = "Grid vertical line 3__pivot";
  node_grid_v_3_7.scale.set(1, 1, 1);
  if (endpoint_grid_v_3_7) {
    node_grid_v_3_7.position.copy(endpoint_grid_v_3_7.start);
    node_grid_v_3_7.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_grid_v_3_7.position.set(0.12, 0.01, 0.065);
    node_grid_v_3_7.rotation.set(0.0, 0.0, 0.0);
  }
  node_grid_v_3_7.userData.sculptComponent = {"id": "grid-v-3", "name": "Grid vertical line 3", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid vertical line 3 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid vertical line 3", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.022, "height": 1.92, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.12, 0.01, 0.065], "rotation": [0, 0, 0], "scale": [0.022, 1.92, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-v-3", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_v_3_7.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-v-3", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}};
  (nodes["grid-plate"] ?? root).add(node_grid_v_3_7);
  nodes["grid-v-3"] = node_grid_v_3_7;
  const mesh_grid_v_3_7Geometry = endpoint_grid_v_3_7
    ? new THREE.CylinderGeometry(endpoint_grid_v_3_7.endRadius, endpoint_grid_v_3_7.baseRadius, endpoint_grid_v_3_7.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_grid_v_3_7) {
    mesh_grid_v_3_7Geometry.scale(0.022, 1.92, 0.012);
  }
  const mesh_grid_v_3_7 = new THREE.Mesh(
    mesh_grid_v_3_7Geometry,
    materialMap["grid-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_grid_v_3_7.name = "Grid vertical line 3";
  if (endpoint_grid_v_3_7) {
    mesh_grid_v_3_7.position.copy(endpoint_grid_v_3_7.midpoint);
    mesh_grid_v_3_7.quaternion.copy(endpoint_grid_v_3_7.quaternion);
  }
  mesh_grid_v_3_7.castShadow = options.castShadow ?? true;
  mesh_grid_v_3_7.receiveShadow = options.receiveShadow ?? true;
  mesh_grid_v_3_7.userData.sculptComponent = {"id": "grid-v-3", "name": "Grid vertical line 3", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid vertical line 3 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid vertical line 3", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.022, "height": 1.92, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.12, 0.01, 0.065], "rotation": [0, 0, 0], "scale": [0.022, 1.92, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-v-3", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_v_3_7.add(mesh_grid_v_3_7);
  meshes["grid-v-3"] = mesh_grid_v_3_7;
  colliders["grid-v-3"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["grid-v-3"] ??= [];
  destructionGroups["grid-v-3"].push(node_grid_v_3_7);

  const endpoint_grid_v_4_8 = makeAttachmentEndpoint(null);
  const node_grid_v_4_8 = new THREE.Group();
  node_grid_v_4_8.name = "Grid vertical line 4__pivot";
  node_grid_v_4_8.scale.set(1, 1, 1);
  if (endpoint_grid_v_4_8) {
    node_grid_v_4_8.position.copy(endpoint_grid_v_4_8.start);
    node_grid_v_4_8.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_grid_v_4_8.position.set(0.36, 0.125, 0.065);
    node_grid_v_4_8.rotation.set(0.0, 0.0, 0.0);
  }
  node_grid_v_4_8.userData.sculptComponent = {"id": "grid-v-4", "name": "Grid vertical line 4", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid vertical line 4 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid vertical line 4", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.022, "height": 1.69, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.36, 0.125, 0.065], "rotation": [0, 0, 0], "scale": [0.022, 1.69, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-v-4", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_v_4_8.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-v-4", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}};
  (nodes["grid-plate"] ?? root).add(node_grid_v_4_8);
  nodes["grid-v-4"] = node_grid_v_4_8;
  const mesh_grid_v_4_8Geometry = endpoint_grid_v_4_8
    ? new THREE.CylinderGeometry(endpoint_grid_v_4_8.endRadius, endpoint_grid_v_4_8.baseRadius, endpoint_grid_v_4_8.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_grid_v_4_8) {
    mesh_grid_v_4_8Geometry.scale(0.022, 1.69, 0.012);
  }
  const mesh_grid_v_4_8 = new THREE.Mesh(
    mesh_grid_v_4_8Geometry,
    materialMap["grid-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_grid_v_4_8.name = "Grid vertical line 4";
  if (endpoint_grid_v_4_8) {
    mesh_grid_v_4_8.position.copy(endpoint_grid_v_4_8.midpoint);
    mesh_grid_v_4_8.quaternion.copy(endpoint_grid_v_4_8.quaternion);
  }
  mesh_grid_v_4_8.castShadow = options.castShadow ?? true;
  mesh_grid_v_4_8.receiveShadow = options.receiveShadow ?? true;
  mesh_grid_v_4_8.userData.sculptComponent = {"id": "grid-v-4", "name": "Grid vertical line 4", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid vertical line 4 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid vertical line 4", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.022, "height": 1.69, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.36, 0.125, 0.065], "rotation": [0, 0, 0], "scale": [0.022, 1.69, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-v-4", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_v_4_8.add(mesh_grid_v_4_8);
  meshes["grid-v-4"] = mesh_grid_v_4_8;
  colliders["grid-v-4"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["grid-v-4"] ??= [];
  destructionGroups["grid-v-4"].push(node_grid_v_4_8);

  const endpoint_grid_v_5_9 = makeAttachmentEndpoint(null);
  const node_grid_v_5_9 = new THREE.Group();
  node_grid_v_5_9.name = "Grid vertical line 5__pivot";
  node_grid_v_5_9.scale.set(1, 1, 1);
  if (endpoint_grid_v_5_9) {
    node_grid_v_5_9.position.copy(endpoint_grid_v_5_9.start);
    node_grid_v_5_9.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_grid_v_5_9.position.set(0.6, 0.315, 0.065);
    node_grid_v_5_9.rotation.set(0.0, 0.0, 0.0);
  }
  node_grid_v_5_9.userData.sculptComponent = {"id": "grid-v-5", "name": "Grid vertical line 5", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid vertical line 5 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid vertical line 5", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.022, "height": 1.31, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.6, 0.315, 0.065], "rotation": [0, 0, 0], "scale": [0.022, 1.31, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-v-5", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_v_5_9.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-v-5", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}};
  (nodes["grid-plate"] ?? root).add(node_grid_v_5_9);
  nodes["grid-v-5"] = node_grid_v_5_9;
  const mesh_grid_v_5_9Geometry = endpoint_grid_v_5_9
    ? new THREE.CylinderGeometry(endpoint_grid_v_5_9.endRadius, endpoint_grid_v_5_9.baseRadius, endpoint_grid_v_5_9.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_grid_v_5_9) {
    mesh_grid_v_5_9Geometry.scale(0.022, 1.31, 0.012);
  }
  const mesh_grid_v_5_9 = new THREE.Mesh(
    mesh_grid_v_5_9Geometry,
    materialMap["grid-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_grid_v_5_9.name = "Grid vertical line 5";
  if (endpoint_grid_v_5_9) {
    mesh_grid_v_5_9.position.copy(endpoint_grid_v_5_9.midpoint);
    mesh_grid_v_5_9.quaternion.copy(endpoint_grid_v_5_9.quaternion);
  }
  mesh_grid_v_5_9.castShadow = options.castShadow ?? true;
  mesh_grid_v_5_9.receiveShadow = options.receiveShadow ?? true;
  mesh_grid_v_5_9.userData.sculptComponent = {"id": "grid-v-5", "name": "Grid vertical line 5", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid vertical line 5 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid vertical line 5", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.022, "height": 1.31, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.6, 0.315, 0.065], "rotation": [0, 0, 0], "scale": [0.022, 1.31, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-v-5", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_v_5_9.add(mesh_grid_v_5_9);
  meshes["grid-v-5"] = mesh_grid_v_5_9;
  colliders["grid-v-5"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["grid-v-5"] ??= [];
  destructionGroups["grid-v-5"].push(node_grid_v_5_9);

  const endpoint_grid_h_0_10 = makeAttachmentEndpoint(null);
  const node_grid_h_0_10 = new THREE.Group();
  node_grid_h_0_10.name = "Grid horizontal line 0__pivot";
  node_grid_h_0_10.scale.set(1, 1, 1);
  if (endpoint_grid_h_0_10) {
    node_grid_h_0_10.position.copy(endpoint_grid_h_0_10.start);
    node_grid_h_0_10.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_grid_h_0_10.position.set(0.0, 0.8, 0.066);
    node_grid_h_0_10.rotation.set(0.0, 0.0, 0.0);
  }
  node_grid_h_0_10.userData.sculptComponent = {"id": "grid-h-0", "name": "Grid horizontal line 0", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid horizontal line 0 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid horizontal line 0", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.545, "height": 0.022, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.8, 0.066], "rotation": [0, 0, 0], "scale": [1.545, 0.022, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-0", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_h_0_10.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-0", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}};
  (nodes["grid-plate"] ?? root).add(node_grid_h_0_10);
  nodes["grid-h-0"] = node_grid_h_0_10;
  const mesh_grid_h_0_10Geometry = endpoint_grid_h_0_10
    ? new THREE.CylinderGeometry(endpoint_grid_h_0_10.endRadius, endpoint_grid_h_0_10.baseRadius, endpoint_grid_h_0_10.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_grid_h_0_10) {
    mesh_grid_h_0_10Geometry.scale(1.545, 0.022, 0.012);
  }
  const mesh_grid_h_0_10 = new THREE.Mesh(
    mesh_grid_h_0_10Geometry,
    materialMap["grid-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_grid_h_0_10.name = "Grid horizontal line 0";
  if (endpoint_grid_h_0_10) {
    mesh_grid_h_0_10.position.copy(endpoint_grid_h_0_10.midpoint);
    mesh_grid_h_0_10.quaternion.copy(endpoint_grid_h_0_10.quaternion);
  }
  mesh_grid_h_0_10.castShadow = options.castShadow ?? true;
  mesh_grid_h_0_10.receiveShadow = options.receiveShadow ?? true;
  mesh_grid_h_0_10.userData.sculptComponent = {"id": "grid-h-0", "name": "Grid horizontal line 0", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid horizontal line 0 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid horizontal line 0", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.545, "height": 0.022, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.8, 0.066], "rotation": [0, 0, 0], "scale": [1.545, 0.022, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-0", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_h_0_10.add(mesh_grid_h_0_10);
  meshes["grid-h-0"] = mesh_grid_h_0_10;
  colliders["grid-h-0"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["grid-h-0"] ??= [];
  destructionGroups["grid-h-0"].push(node_grid_h_0_10);

  const endpoint_grid_h_1_11 = makeAttachmentEndpoint(null);
  const node_grid_h_1_11 = new THREE.Group();
  node_grid_h_1_11.name = "Grid horizontal line 1__pivot";
  node_grid_h_1_11.scale.set(1, 1, 1);
  if (endpoint_grid_h_1_11) {
    node_grid_h_1_11.position.copy(endpoint_grid_h_1_11.start);
    node_grid_h_1_11.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_grid_h_1_11.position.set(0.0, 0.6, 0.066);
    node_grid_h_1_11.rotation.set(0.0, 0.0, 0.0);
  }
  node_grid_h_1_11.userData.sculptComponent = {"id": "grid-h-1", "name": "Grid horizontal line 1", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid horizontal line 1 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid horizontal line 1", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.559, "height": 0.022, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.6, 0.066], "rotation": [0, 0, 0], "scale": [1.559, 0.022, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_h_1_11.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}};
  (nodes["grid-plate"] ?? root).add(node_grid_h_1_11);
  nodes["grid-h-1"] = node_grid_h_1_11;
  const mesh_grid_h_1_11Geometry = endpoint_grid_h_1_11
    ? new THREE.CylinderGeometry(endpoint_grid_h_1_11.endRadius, endpoint_grid_h_1_11.baseRadius, endpoint_grid_h_1_11.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_grid_h_1_11) {
    mesh_grid_h_1_11Geometry.scale(1.559, 0.022, 0.012);
  }
  const mesh_grid_h_1_11 = new THREE.Mesh(
    mesh_grid_h_1_11Geometry,
    materialMap["grid-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_grid_h_1_11.name = "Grid horizontal line 1";
  if (endpoint_grid_h_1_11) {
    mesh_grid_h_1_11.position.copy(endpoint_grid_h_1_11.midpoint);
    mesh_grid_h_1_11.quaternion.copy(endpoint_grid_h_1_11.quaternion);
  }
  mesh_grid_h_1_11.castShadow = options.castShadow ?? true;
  mesh_grid_h_1_11.receiveShadow = options.receiveShadow ?? true;
  mesh_grid_h_1_11.userData.sculptComponent = {"id": "grid-h-1", "name": "Grid horizontal line 1", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid horizontal line 1 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid horizontal line 1", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.559, "height": 0.022, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.6, 0.066], "rotation": [0, 0, 0], "scale": [1.559, 0.022, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_h_1_11.add(mesh_grid_h_1_11);
  meshes["grid-h-1"] = mesh_grid_h_1_11;
  colliders["grid-h-1"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["grid-h-1"] ??= [];
  destructionGroups["grid-h-1"].push(node_grid_h_1_11);

  const endpoint_grid_h_2_12 = makeAttachmentEndpoint(null);
  const node_grid_h_2_12 = new THREE.Group();
  node_grid_h_2_12.name = "Grid horizontal line 2__pivot";
  node_grid_h_2_12.scale.set(1, 1, 1);
  if (endpoint_grid_h_2_12) {
    node_grid_h_2_12.position.copy(endpoint_grid_h_2_12.start);
    node_grid_h_2_12.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_grid_h_2_12.position.set(0.0, 0.4, 0.066);
    node_grid_h_2_12.rotation.set(0.0, 0.0, 0.0);
  }
  node_grid_h_2_12.userData.sculptComponent = {"id": "grid-h-2", "name": "Grid horizontal line 2", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid horizontal line 2 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid horizontal line 2", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.55, "height": 0.022, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.4, 0.066], "rotation": [0, 0, 0], "scale": [1.55, 0.022, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_h_2_12.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}};
  (nodes["grid-plate"] ?? root).add(node_grid_h_2_12);
  nodes["grid-h-2"] = node_grid_h_2_12;
  const mesh_grid_h_2_12Geometry = endpoint_grid_h_2_12
    ? new THREE.CylinderGeometry(endpoint_grid_h_2_12.endRadius, endpoint_grid_h_2_12.baseRadius, endpoint_grid_h_2_12.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_grid_h_2_12) {
    mesh_grid_h_2_12Geometry.scale(1.55, 0.022, 0.012);
  }
  const mesh_grid_h_2_12 = new THREE.Mesh(
    mesh_grid_h_2_12Geometry,
    materialMap["grid-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_grid_h_2_12.name = "Grid horizontal line 2";
  if (endpoint_grid_h_2_12) {
    mesh_grid_h_2_12.position.copy(endpoint_grid_h_2_12.midpoint);
    mesh_grid_h_2_12.quaternion.copy(endpoint_grid_h_2_12.quaternion);
  }
  mesh_grid_h_2_12.castShadow = options.castShadow ?? true;
  mesh_grid_h_2_12.receiveShadow = options.receiveShadow ?? true;
  mesh_grid_h_2_12.userData.sculptComponent = {"id": "grid-h-2", "name": "Grid horizontal line 2", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid horizontal line 2 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid horizontal line 2", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.55, "height": 0.022, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.4, 0.066], "rotation": [0, 0, 0], "scale": [1.55, 0.022, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_h_2_12.add(mesh_grid_h_2_12);
  meshes["grid-h-2"] = mesh_grid_h_2_12;
  colliders["grid-h-2"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["grid-h-2"] ??= [];
  destructionGroups["grid-h-2"].push(node_grid_h_2_12);

  const endpoint_grid_h_3_13 = makeAttachmentEndpoint(null);
  const node_grid_h_3_13 = new THREE.Group();
  node_grid_h_3_13.name = "Grid horizontal line 3__pivot";
  node_grid_h_3_13.scale.set(1, 1, 1);
  if (endpoint_grid_h_3_13) {
    node_grid_h_3_13.position.copy(endpoint_grid_h_3_13.start);
    node_grid_h_3_13.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_grid_h_3_13.position.set(0.0, 0.2, 0.066);
    node_grid_h_3_13.rotation.set(0.0, 0.0, 0.0);
  }
  node_grid_h_3_13.userData.sculptComponent = {"id": "grid-h-3", "name": "Grid horizontal line 3", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid horizontal line 3 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid horizontal line 3", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.499, "height": 0.022, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.2, 0.066], "rotation": [0, 0, 0], "scale": [1.499, 0.022, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-3", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_h_3_13.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-3", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}};
  (nodes["grid-plate"] ?? root).add(node_grid_h_3_13);
  nodes["grid-h-3"] = node_grid_h_3_13;
  const mesh_grid_h_3_13Geometry = endpoint_grid_h_3_13
    ? new THREE.CylinderGeometry(endpoint_grid_h_3_13.endRadius, endpoint_grid_h_3_13.baseRadius, endpoint_grid_h_3_13.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_grid_h_3_13) {
    mesh_grid_h_3_13Geometry.scale(1.499, 0.022, 0.012);
  }
  const mesh_grid_h_3_13 = new THREE.Mesh(
    mesh_grid_h_3_13Geometry,
    materialMap["grid-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_grid_h_3_13.name = "Grid horizontal line 3";
  if (endpoint_grid_h_3_13) {
    mesh_grid_h_3_13.position.copy(endpoint_grid_h_3_13.midpoint);
    mesh_grid_h_3_13.quaternion.copy(endpoint_grid_h_3_13.quaternion);
  }
  mesh_grid_h_3_13.castShadow = options.castShadow ?? true;
  mesh_grid_h_3_13.receiveShadow = options.receiveShadow ?? true;
  mesh_grid_h_3_13.userData.sculptComponent = {"id": "grid-h-3", "name": "Grid horizontal line 3", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid horizontal line 3 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid horizontal line 3", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.499, "height": 0.022, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.2, 0.066], "rotation": [0, 0, 0], "scale": [1.499, 0.022, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-3", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_h_3_13.add(mesh_grid_h_3_13);
  meshes["grid-h-3"] = mesh_grid_h_3_13;
  colliders["grid-h-3"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["grid-h-3"] ??= [];
  destructionGroups["grid-h-3"].push(node_grid_h_3_13);

  const endpoint_grid_h_4_14 = makeAttachmentEndpoint(null);
  const node_grid_h_4_14 = new THREE.Group();
  node_grid_h_4_14.name = "Grid horizontal line 4__pivot";
  node_grid_h_4_14.scale.set(1, 1, 1);
  if (endpoint_grid_h_4_14) {
    node_grid_h_4_14.position.copy(endpoint_grid_h_4_14.start);
    node_grid_h_4_14.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_grid_h_4_14.position.set(0.0, 0.0, 0.066);
    node_grid_h_4_14.rotation.set(0.0, 0.0, 0.0);
  }
  node_grid_h_4_14.userData.sculptComponent = {"id": "grid-h-4", "name": "Grid horizontal line 4", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid horizontal line 4 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid horizontal line 4", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.448, "height": 0.022, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.0, 0.066], "rotation": [0, 0, 0], "scale": [1.448, 0.022, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-4", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_h_4_14.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-4", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}};
  (nodes["grid-plate"] ?? root).add(node_grid_h_4_14);
  nodes["grid-h-4"] = node_grid_h_4_14;
  const mesh_grid_h_4_14Geometry = endpoint_grid_h_4_14
    ? new THREE.CylinderGeometry(endpoint_grid_h_4_14.endRadius, endpoint_grid_h_4_14.baseRadius, endpoint_grid_h_4_14.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_grid_h_4_14) {
    mesh_grid_h_4_14Geometry.scale(1.448, 0.022, 0.012);
  }
  const mesh_grid_h_4_14 = new THREE.Mesh(
    mesh_grid_h_4_14Geometry,
    materialMap["grid-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_grid_h_4_14.name = "Grid horizontal line 4";
  if (endpoint_grid_h_4_14) {
    mesh_grid_h_4_14.position.copy(endpoint_grid_h_4_14.midpoint);
    mesh_grid_h_4_14.quaternion.copy(endpoint_grid_h_4_14.quaternion);
  }
  mesh_grid_h_4_14.castShadow = options.castShadow ?? true;
  mesh_grid_h_4_14.receiveShadow = options.receiveShadow ?? true;
  mesh_grid_h_4_14.userData.sculptComponent = {"id": "grid-h-4", "name": "Grid horizontal line 4", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid horizontal line 4 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid horizontal line 4", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.448, "height": 0.022, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.0, 0.066], "rotation": [0, 0, 0], "scale": [1.448, 0.022, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-4", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_h_4_14.add(mesh_grid_h_4_14);
  meshes["grid-h-4"] = mesh_grid_h_4_14;
  colliders["grid-h-4"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["grid-h-4"] ??= [];
  destructionGroups["grid-h-4"].push(node_grid_h_4_14);

  const endpoint_grid_h_5_15 = makeAttachmentEndpoint(null);
  const node_grid_h_5_15 = new THREE.Group();
  node_grid_h_5_15.name = "Grid horizontal line 5__pivot";
  node_grid_h_5_15.scale.set(1, 1, 1);
  if (endpoint_grid_h_5_15) {
    node_grid_h_5_15.position.copy(endpoint_grid_h_5_15.start);
    node_grid_h_5_15.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_grid_h_5_15.position.set(0.0, -0.2, 0.066);
    node_grid_h_5_15.rotation.set(0.0, 0.0, 0.0);
  }
  node_grid_h_5_15.userData.sculptComponent = {"id": "grid-h-5", "name": "Grid horizontal line 5", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid horizontal line 5 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid horizontal line 5", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.304, "height": 0.022, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.2, 0.066], "rotation": [0, 0, 0], "scale": [1.304, 0.022, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-5", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_h_5_15.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-5", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}};
  (nodes["grid-plate"] ?? root).add(node_grid_h_5_15);
  nodes["grid-h-5"] = node_grid_h_5_15;
  const mesh_grid_h_5_15Geometry = endpoint_grid_h_5_15
    ? new THREE.CylinderGeometry(endpoint_grid_h_5_15.endRadius, endpoint_grid_h_5_15.baseRadius, endpoint_grid_h_5_15.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_grid_h_5_15) {
    mesh_grid_h_5_15Geometry.scale(1.304, 0.022, 0.012);
  }
  const mesh_grid_h_5_15 = new THREE.Mesh(
    mesh_grid_h_5_15Geometry,
    materialMap["grid-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_grid_h_5_15.name = "Grid horizontal line 5";
  if (endpoint_grid_h_5_15) {
    mesh_grid_h_5_15.position.copy(endpoint_grid_h_5_15.midpoint);
    mesh_grid_h_5_15.quaternion.copy(endpoint_grid_h_5_15.quaternion);
  }
  mesh_grid_h_5_15.castShadow = options.castShadow ?? true;
  mesh_grid_h_5_15.receiveShadow = options.receiveShadow ?? true;
  mesh_grid_h_5_15.userData.sculptComponent = {"id": "grid-h-5", "name": "Grid horizontal line 5", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid horizontal line 5 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid horizontal line 5", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.304, "height": 0.022, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.2, 0.066], "rotation": [0, 0, 0], "scale": [1.304, 0.022, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-5", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_h_5_15.add(mesh_grid_h_5_15);
  meshes["grid-h-5"] = mesh_grid_h_5_15;
  colliders["grid-h-5"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["grid-h-5"] ??= [];
  destructionGroups["grid-h-5"].push(node_grid_h_5_15);

  const endpoint_grid_h_6_16 = makeAttachmentEndpoint(null);
  const node_grid_h_6_16 = new THREE.Group();
  node_grid_h_6_16.name = "Grid horizontal line 6__pivot";
  node_grid_h_6_16.scale.set(1, 1, 1);
  if (endpoint_grid_h_6_16) {
    node_grid_h_6_16.position.copy(endpoint_grid_h_6_16.start);
    node_grid_h_6_16.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_grid_h_6_16.position.set(0.0, -0.4, 0.066);
    node_grid_h_6_16.rotation.set(0.0, 0.0, 0.0);
  }
  node_grid_h_6_16.userData.sculptComponent = {"id": "grid-h-6", "name": "Grid horizontal line 6", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid horizontal line 6 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid horizontal line 6", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.16, "height": 0.022, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.4, 0.066], "rotation": [0, 0, 0], "scale": [1.16, 0.022, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-6", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_h_6_16.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-6", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}};
  (nodes["grid-plate"] ?? root).add(node_grid_h_6_16);
  nodes["grid-h-6"] = node_grid_h_6_16;
  const mesh_grid_h_6_16Geometry = endpoint_grid_h_6_16
    ? new THREE.CylinderGeometry(endpoint_grid_h_6_16.endRadius, endpoint_grid_h_6_16.baseRadius, endpoint_grid_h_6_16.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_grid_h_6_16) {
    mesh_grid_h_6_16Geometry.scale(1.16, 0.022, 0.012);
  }
  const mesh_grid_h_6_16 = new THREE.Mesh(
    mesh_grid_h_6_16Geometry,
    materialMap["grid-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_grid_h_6_16.name = "Grid horizontal line 6";
  if (endpoint_grid_h_6_16) {
    mesh_grid_h_6_16.position.copy(endpoint_grid_h_6_16.midpoint);
    mesh_grid_h_6_16.quaternion.copy(endpoint_grid_h_6_16.quaternion);
  }
  mesh_grid_h_6_16.castShadow = options.castShadow ?? true;
  mesh_grid_h_6_16.receiveShadow = options.receiveShadow ?? true;
  mesh_grid_h_6_16.userData.sculptComponent = {"id": "grid-h-6", "name": "Grid horizontal line 6", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid horizontal line 6 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid horizontal line 6", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.16, "height": 0.022, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.4, 0.066], "rotation": [0, 0, 0], "scale": [1.16, 0.022, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-6", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_h_6_16.add(mesh_grid_h_6_16);
  meshes["grid-h-6"] = mesh_grid_h_6_16;
  colliders["grid-h-6"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["grid-h-6"] ??= [];
  destructionGroups["grid-h-6"].push(node_grid_h_6_16);

  const endpoint_grid_h_7_17 = makeAttachmentEndpoint(null);
  const node_grid_h_7_17 = new THREE.Group();
  node_grid_h_7_17.name = "Grid horizontal line 7__pivot";
  node_grid_h_7_17.scale.set(1, 1, 1);
  if (endpoint_grid_h_7_17) {
    node_grid_h_7_17.position.copy(endpoint_grid_h_7_17.start);
    node_grid_h_7_17.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_grid_h_7_17.position.set(0.0, -0.6, 0.066);
    node_grid_h_7_17.rotation.set(0.0, 0.0, 0.0);
  }
  node_grid_h_7_17.userData.sculptComponent = {"id": "grid-h-7", "name": "Grid horizontal line 7", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid horizontal line 7 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid horizontal line 7", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.896, "height": 0.022, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.6, 0.066], "rotation": [0, 0, 0], "scale": [0.896, 0.022, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-7", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_h_7_17.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-7", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}};
  (nodes["grid-plate"] ?? root).add(node_grid_h_7_17);
  nodes["grid-h-7"] = node_grid_h_7_17;
  const mesh_grid_h_7_17Geometry = endpoint_grid_h_7_17
    ? new THREE.CylinderGeometry(endpoint_grid_h_7_17.endRadius, endpoint_grid_h_7_17.baseRadius, endpoint_grid_h_7_17.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_grid_h_7_17) {
    mesh_grid_h_7_17Geometry.scale(0.896, 0.022, 0.012);
  }
  const mesh_grid_h_7_17 = new THREE.Mesh(
    mesh_grid_h_7_17Geometry,
    materialMap["grid-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_grid_h_7_17.name = "Grid horizontal line 7";
  if (endpoint_grid_h_7_17) {
    mesh_grid_h_7_17.position.copy(endpoint_grid_h_7_17.midpoint);
    mesh_grid_h_7_17.quaternion.copy(endpoint_grid_h_7_17.quaternion);
  }
  mesh_grid_h_7_17.castShadow = options.castShadow ?? true;
  mesh_grid_h_7_17.receiveShadow = options.receiveShadow ?? true;
  mesh_grid_h_7_17.userData.sculptComponent = {"id": "grid-h-7", "name": "Grid horizontal line 7", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid horizontal line 7 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid horizontal line 7", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.896, "height": 0.022, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.6, 0.066], "rotation": [0, 0, 0], "scale": [0.896, 0.022, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-7", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_h_7_17.add(mesh_grid_h_7_17);
  meshes["grid-h-7"] = mesh_grid_h_7_17;
  colliders["grid-h-7"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["grid-h-7"] ??= [];
  destructionGroups["grid-h-7"].push(node_grid_h_7_17);

  const endpoint_grid_h_8_18 = makeAttachmentEndpoint(null);
  const node_grid_h_8_18 = new THREE.Group();
  node_grid_h_8_18.name = "Grid horizontal line 8__pivot";
  node_grid_h_8_18.scale.set(1, 1, 1);
  if (endpoint_grid_h_8_18) {
    node_grid_h_8_18.position.copy(endpoint_grid_h_8_18.start);
    node_grid_h_8_18.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_grid_h_8_18.position.set(0.0, -0.8, 0.066);
    node_grid_h_8_18.rotation.set(0.0, 0.0, 0.0);
  }
  node_grid_h_8_18.userData.sculptComponent = {"id": "grid-h-8", "name": "Grid horizontal line 8", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid horizontal line 8 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid horizontal line 8", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.602, "height": 0.022, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.8, 0.066], "rotation": [0, 0, 0], "scale": [0.602, 0.022, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-8", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_h_8_18.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-8", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}};
  (nodes["grid-plate"] ?? root).add(node_grid_h_8_18);
  nodes["grid-h-8"] = node_grid_h_8_18;
  const mesh_grid_h_8_18Geometry = endpoint_grid_h_8_18
    ? new THREE.CylinderGeometry(endpoint_grid_h_8_18.endRadius, endpoint_grid_h_8_18.baseRadius, endpoint_grid_h_8_18.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_grid_h_8_18) {
    mesh_grid_h_8_18Geometry.scale(0.602, 0.022, 0.012);
  }
  const mesh_grid_h_8_18 = new THREE.Mesh(
    mesh_grid_h_8_18Geometry,
    materialMap["grid-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_grid_h_8_18.name = "Grid horizontal line 8";
  if (endpoint_grid_h_8_18) {
    mesh_grid_h_8_18.position.copy(endpoint_grid_h_8_18.midpoint);
    mesh_grid_h_8_18.quaternion.copy(endpoint_grid_h_8_18.quaternion);
  }
  mesh_grid_h_8_18.castShadow = options.castShadow ?? true;
  mesh_grid_h_8_18.receiveShadow = options.receiveShadow ?? true;
  mesh_grid_h_8_18.userData.sculptComponent = {"id": "grid-h-8", "name": "Grid horizontal line 8", "level": "micro", "role": "linework", "importance": 0.4, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Grid horizontal line 8 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "box part for Grid horizontal line 8", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.004, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.602, "height": 0.022, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.8, 0.066], "rotation": [0, 0, 0], "scale": [0.602, 0.022, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "grid-h-8", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "grid-glow"}}, "material": "grid-glow", "materialLayers": ["grid-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(7, 94, 20, 1.0)", "secondaryAlbedo": "rgba(1, 62, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/grid-v-2.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/grid-v-2.png; its material-class guess (plastic, 0.518) was overridden by visual analysis"}};
  node_grid_h_8_18.add(mesh_grid_h_8_18);
  meshes["grid-h-8"] = mesh_grid_h_8_18;
  colliders["grid-h-8"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["grid-h-8"] ??= [];
  destructionGroups["grid-h-8"].push(node_grid_h_8_18);

  const endpoint_keyhole_medallion_19 = makeAttachmentEndpoint(null);
  const node_keyhole_medallion_19 = new THREE.Group();
  node_keyhole_medallion_19.name = "Keyhole medallion ring__pivot";
  node_keyhole_medallion_19.scale.set(1, 1, 1);
  if (endpoint_keyhole_medallion_19) {
    node_keyhole_medallion_19.position.copy(endpoint_keyhole_medallion_19.start);
    node_keyhole_medallion_19.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_keyhole_medallion_19.position.set(0.0, -0.08, 0.09);
    node_keyhole_medallion_19.rotation.set(0.0, 0.0, 0.0);
  }
  node_keyhole_medallion_19.userData.sculptComponent = {"id": "keyhole-medallion", "name": "Keyhole medallion ring", "level": "meso", "role": "emblem", "importance": 0.7, "confidence": 0.8, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "Keyhole medallion ring is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "torus part for Keyhole medallion ring", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "torusTubeRatio": 0.22}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.02, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.44, "height": 0.44, "depth": 0.44, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.08, 0.09], "rotation": [0, 0, 0], "scale": [0.44, 0.44, 0.44]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "keyhole-medallion", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "gold-ember"}}, "material": "gold-ember", "materialLayers": ["gold-ember"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "keyhole-cavity", "type": "inlay", "kind": "fastener", "description": "flat dark keyhole inlay (reference shows a flat dark silhouette)"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(62, 19, 2, 1.0)", "secondaryAlbedo": "rgba(254, 219, 68, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/keyhole-medallion.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/keyhole-medallion.png; its material-class guess (plastic, 0.534) was overridden by visual analysis"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "gold-ember"}, "materialRegions": [{"regionId": "ring", "materialId": "gold-ember", "profileId": "metal.gold", "crop": {"path": "/root/shieldbot/material-evidence/03-ring.png", "bbox": {"x": 548, "y": 490, "width": 34, "height": 60}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0013}}]};
  node_keyhole_medallion_19.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "keyhole-medallion", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "gold-ember"}};
  (nodes["grid-plate"] ?? root).add(node_keyhole_medallion_19);
  nodes["keyhole-medallion"] = node_keyhole_medallion_19;
  const mesh_keyhole_medallion_19Geometry = endpoint_keyhole_medallion_19
    ? new THREE.CylinderGeometry(endpoint_keyhole_medallion_19.endRadius, endpoint_keyhole_medallion_19.baseRadius, endpoint_keyhole_medallion_19.length, 16, 6)
    : new THREE.TorusGeometry(0.45, 0.099, 12, 48);
  if (!endpoint_keyhole_medallion_19) {
    mesh_keyhole_medallion_19Geometry.scale(0.44, 0.44, 0.44);
  }
  const mesh_keyhole_medallion_19 = new THREE.Mesh(
    mesh_keyhole_medallion_19Geometry,
    materialMap["gold-ember"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_keyhole_medallion_19.name = "Keyhole medallion ring";
  if (endpoint_keyhole_medallion_19) {
    mesh_keyhole_medallion_19.position.copy(endpoint_keyhole_medallion_19.midpoint);
    mesh_keyhole_medallion_19.quaternion.copy(endpoint_keyhole_medallion_19.quaternion);
  }
  mesh_keyhole_medallion_19.castShadow = options.castShadow ?? true;
  mesh_keyhole_medallion_19.receiveShadow = options.receiveShadow ?? true;
  mesh_keyhole_medallion_19.userData.sculptComponent = {"id": "keyhole-medallion", "name": "Keyhole medallion ring", "level": "meso", "role": "emblem", "importance": 0.7, "confidence": 0.8, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "Keyhole medallion ring is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "torus part for Keyhole medallion ring", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "torusTubeRatio": 0.22}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.02, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.44, "height": 0.44, "depth": 0.44, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.08, 0.09], "rotation": [0, 0, 0], "scale": [0.44, 0.44, 0.44]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "keyhole-medallion", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "gold-ember"}}, "material": "gold-ember", "materialLayers": ["gold-ember"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "keyhole-cavity", "type": "inlay", "kind": "fastener", "description": "flat dark keyhole inlay (reference shows a flat dark silhouette)"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(62, 19, 2, 1.0)", "secondaryAlbedo": "rgba(254, 219, 68, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/keyhole-medallion.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/keyhole-medallion.png; its material-class guess (plastic, 0.534) was overridden by visual analysis"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "gold-ember"}, "materialRegions": [{"regionId": "ring", "materialId": "gold-ember", "profileId": "metal.gold", "crop": {"path": "/root/shieldbot/material-evidence/03-ring.png", "bbox": {"x": 548, "y": 490, "width": 34, "height": 60}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0013}}]};
  node_keyhole_medallion_19.add(mesh_keyhole_medallion_19);
  meshes["keyhole-medallion"] = mesh_keyhole_medallion_19;
  colliders["keyhole-medallion"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["keyhole-medallion"] ??= [];
  destructionGroups["keyhole-medallion"].push(node_keyhole_medallion_19);

  const attachment_keyhole_inlay_head_20 = {"parentSocket": "keyhole-medallion-surface", "parentId": "keyhole-medallion", "contactType": "embed", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on keyhole-medallion; zero-length endpoints keep the authored primitive"};
  const endpoint_keyhole_inlay_head_20 = makeAttachmentEndpoint(attachment_keyhole_inlay_head_20);
  const node_keyhole_inlay_head_20 = new THREE.Group();
  node_keyhole_inlay_head_20.name = "Keyhole inlay round__pivot";
  node_keyhole_inlay_head_20.scale.set(1, 1, 1);
  if (endpoint_keyhole_inlay_head_20) {
    node_keyhole_inlay_head_20.position.copy(endpoint_keyhole_inlay_head_20.start);
    node_keyhole_inlay_head_20.rotation.set(1.5707963267948966, 0.0, 0.0);
  } else {
    node_keyhole_inlay_head_20.position.set(0.0, 0.05, -0.01);
    node_keyhole_inlay_head_20.rotation.set(1.5707963267948966, 0.0, 0.0);
  }
  node_keyhole_inlay_head_20.userData.sculptComponent = {"id": "keyhole-inlay-head", "name": "Keyhole inlay round", "level": "micro", "role": "inlay", "importance": 0.4, "confidence": 0.8, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Flat dark painted inlay in a stylized illustration (no visible depth in the reference).", "geometryDescriptor": {"topologyIntent": "cylinder part for Keyhole inlay round", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "keyhole-medallion", "attachment": {"parentSocket": "keyhole-medallion-surface", "parentId": "keyhole-medallion", "contactType": "embed", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on keyhole-medallion; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.15, "height": 0.03, "depth": 0.15, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.05, -0.01], "rotation": [1.5707963267948966, 0, 0], "scale": [0.15, 0.03, 0.15]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "keyhole-inlay-head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "keyhole-dark"}}, "material": "keyhole-dark", "materialLayers": ["keyhole-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(93, 44, 1, 1.0)", "secondaryAlbedo": "rgba(105, 53, 1, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/keyhole-inlay-head.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/keyhole-inlay-head.png; its material-class guess (fabric, 0.592) was overridden by visual analysis"}};
  node_keyhole_inlay_head_20.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "keyhole-inlay-head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "keyhole-dark"}};
  (nodes["keyhole-medallion"] ?? root).add(node_keyhole_inlay_head_20);
  nodes["keyhole-inlay-head"] = node_keyhole_inlay_head_20;
  const mesh_keyhole_inlay_head_20Geometry = endpoint_keyhole_inlay_head_20
    ? new THREE.CylinderGeometry(endpoint_keyhole_inlay_head_20.endRadius, endpoint_keyhole_inlay_head_20.baseRadius, endpoint_keyhole_inlay_head_20.length, 16, 6)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 8);
  if (!endpoint_keyhole_inlay_head_20) {
    mesh_keyhole_inlay_head_20Geometry.scale(0.15, 0.03, 0.15);
  }
  const mesh_keyhole_inlay_head_20 = new THREE.Mesh(
    mesh_keyhole_inlay_head_20Geometry,
    materialMap["keyhole-dark"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_keyhole_inlay_head_20.name = "Keyhole inlay round";
  if (endpoint_keyhole_inlay_head_20) {
    mesh_keyhole_inlay_head_20.position.copy(endpoint_keyhole_inlay_head_20.midpoint);
    mesh_keyhole_inlay_head_20.quaternion.copy(endpoint_keyhole_inlay_head_20.quaternion);
  }
  mesh_keyhole_inlay_head_20.castShadow = options.castShadow ?? true;
  mesh_keyhole_inlay_head_20.receiveShadow = options.receiveShadow ?? true;
  mesh_keyhole_inlay_head_20.userData.sculptComponent = {"id": "keyhole-inlay-head", "name": "Keyhole inlay round", "level": "micro", "role": "inlay", "importance": 0.4, "confidence": 0.8, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Flat dark painted inlay in a stylized illustration (no visible depth in the reference).", "geometryDescriptor": {"topologyIntent": "cylinder part for Keyhole inlay round", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "keyhole-medallion", "attachment": {"parentSocket": "keyhole-medallion-surface", "parentId": "keyhole-medallion", "contactType": "embed", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on keyhole-medallion; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.15, "height": 0.03, "depth": 0.15, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.05, -0.01], "rotation": [1.5707963267948966, 0, 0], "scale": [0.15, 0.03, 0.15]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "keyhole-inlay-head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "keyhole-dark"}}, "material": "keyhole-dark", "materialLayers": ["keyhole-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(93, 44, 1, 1.0)", "secondaryAlbedo": "rgba(105, 53, 1, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/keyhole-inlay-head.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/keyhole-inlay-head.png; its material-class guess (fabric, 0.592) was overridden by visual analysis"}};
  node_keyhole_inlay_head_20.add(mesh_keyhole_inlay_head_20);
  meshes["keyhole-inlay-head"] = mesh_keyhole_inlay_head_20;
  colliders["keyhole-inlay-head"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["keyhole-inlay-head"] ??= [];
  destructionGroups["keyhole-inlay-head"].push(node_keyhole_inlay_head_20);

  const endpoint_keyhole_inlay_slot_21 = makeAttachmentEndpoint(null);
  const node_keyhole_inlay_slot_21 = new THREE.Group();
  node_keyhole_inlay_slot_21.name = "Keyhole inlay slot__pivot";
  node_keyhole_inlay_slot_21.scale.set(1, 1, 1);
  if (endpoint_keyhole_inlay_slot_21) {
    node_keyhole_inlay_slot_21.position.copy(endpoint_keyhole_inlay_slot_21.start);
    node_keyhole_inlay_slot_21.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_keyhole_inlay_slot_21.position.set(0.0, 0.02, -0.015);
    node_keyhole_inlay_slot_21.rotation.set(0.0, 0.0, 0.0);
  }
  node_keyhole_inlay_slot_21.userData.sculptComponent = {"id": "keyhole-inlay-slot", "name": "Keyhole inlay slot", "level": "micro", "role": "inlay", "importance": 0.4, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Flat dark painted inlay in a stylized illustration: trapezoid profile widening downward.", "geometryDescriptor": {"topologyIntent": "extrude part for Keyhole inlay slot", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[-0.035, 0.0], [0.035, 0.0], [0.08, -0.2], [-0.08, -0.2]], "depth": 0.02}}, "parent": "keyhole-medallion", "attachment": {"parentSocket": "keyhole-medallion-surface", "parentId": "keyhole-medallion", "contactType": "embed", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on keyhole-medallion; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.16, "height": 0.2, "depth": 0.02, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.02, -0.015], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "keyhole-inlay-slot", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "keyhole-dark"}}, "material": "keyhole-dark", "materialLayers": ["keyhole-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(93, 44, 1, 1.0)", "secondaryAlbedo": "rgba(105, 53, 1, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/keyhole-inlay-head.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/keyhole-inlay-head.png; its material-class guess (fabric, 0.592) was overridden by visual analysis"}};
  node_keyhole_inlay_slot_21.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "keyhole-inlay-slot", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "keyhole-dark"}};
  (nodes["keyhole-medallion"] ?? root).add(node_keyhole_inlay_slot_21);
  nodes["keyhole-inlay-slot"] = node_keyhole_inlay_slot_21;
  const mesh_keyhole_inlay_slot_21Geometry = endpoint_keyhole_inlay_slot_21
    ? new THREE.CylinderGeometry(endpoint_keyhole_inlay_slot_21.endRadius, endpoint_keyhole_inlay_slot_21.baseRadius, endpoint_keyhole_inlay_slot_21.length, 16, 6)
    : buildExtrudeGeometry({"points": [[-0.035, 0.0], [0.035, 0.0], [0.08, -0.2], [-0.08, -0.2]], "depth": 0.02});
  if (!endpoint_keyhole_inlay_slot_21) {
    mesh_keyhole_inlay_slot_21Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_keyhole_inlay_slot_21 = new THREE.Mesh(
    mesh_keyhole_inlay_slot_21Geometry,
    materialMap["keyhole-dark"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_keyhole_inlay_slot_21.name = "Keyhole inlay slot";
  if (endpoint_keyhole_inlay_slot_21) {
    mesh_keyhole_inlay_slot_21.position.copy(endpoint_keyhole_inlay_slot_21.midpoint);
    mesh_keyhole_inlay_slot_21.quaternion.copy(endpoint_keyhole_inlay_slot_21.quaternion);
  }
  mesh_keyhole_inlay_slot_21.castShadow = options.castShadow ?? true;
  mesh_keyhole_inlay_slot_21.receiveShadow = options.receiveShadow ?? true;
  mesh_keyhole_inlay_slot_21.userData.sculptComponent = {"id": "keyhole-inlay-slot", "name": "Keyhole inlay slot", "level": "micro", "role": "inlay", "importance": 0.4, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Flat dark painted inlay in a stylized illustration: trapezoid profile widening downward.", "geometryDescriptor": {"topologyIntent": "extrude part for Keyhole inlay slot", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[-0.035, 0.0], [0.035, 0.0], [0.08, -0.2], [-0.08, -0.2]], "depth": 0.02}}, "parent": "keyhole-medallion", "attachment": {"parentSocket": "keyhole-medallion-surface", "parentId": "keyhole-medallion", "contactType": "embed", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on keyhole-medallion; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.16, "height": 0.2, "depth": 0.02, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.02, -0.015], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "keyhole-inlay-slot", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "keyhole-dark"}}, "material": "keyhole-dark", "materialLayers": ["keyhole-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(93, 44, 1, 1.0)", "secondaryAlbedo": "rgba(105, 53, 1, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/keyhole-inlay-head.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/keyhole-inlay-head.png; its material-class guess (fabric, 0.592) was overridden by visual analysis"}};
  node_keyhole_inlay_slot_21.add(mesh_keyhole_inlay_slot_21);
  meshes["keyhole-inlay-slot"] = mesh_keyhole_inlay_slot_21;
  colliders["keyhole-inlay-slot"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["keyhole-inlay-slot"] ??= [];
  destructionGroups["keyhole-inlay-slot"].push(node_keyhole_inlay_slot_21);

  const attachment_chart_line_22 = {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"};
  const endpoint_chart_line_22 = makeAttachmentEndpoint(attachment_chart_line_22);
  const node_chart_line_22 = new THREE.Group();
  node_chart_line_22.name = "Rising chart polyline__pivot";
  node_chart_line_22.scale.set(1, 1, 1);
  if (endpoint_chart_line_22) {
    node_chart_line_22.position.copy(endpoint_chart_line_22.start);
    node_chart_line_22.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_chart_line_22.position.set(0.0, 0.0, 0.24);
    node_chart_line_22.rotation.set(0.0, 0.0, 0.0);
  }
  node_chart_line_22.userData.sculptComponent = {"id": "chart-line", "name": "Rising chart polyline", "level": "meso", "role": "overlay", "importance": 0.7, "confidence": 0.8, "primitive": "tube", "topologyClass": "fiber-strand", "topologyRationale": "A thin swept stroke along a measured polyline: tube along a CatmullRom path.", "geometryDescriptor": {"topologyIntent": "tube part for Rising chart polyline", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "tubePath": {"points": [[-0.72, -0.62, 0.0], [-0.675, -0.58, 0.0], [-0.63, -0.54, 0.0], [-0.585, -0.5, 0.0], [-0.54, -0.46, 0.0], [-0.495, -0.42, 0.0], [-0.45, -0.38, 0.0], [-0.4083, -0.32, 0.0], [-0.3667, -0.26, 0.0], [-0.325, -0.2, 0.0], [-0.2833, -0.14, 0.0], [-0.2417, -0.08, 0.0], [-0.2, -0.02, 0.0], [-0.1583, -0.0033, 0.0], [-0.1167, 0.0133, 0.0], [-0.075, 0.03, 0.0], [-0.0333, 0.0467, 0.0], [0.0083, 0.0633, 0.0], [0.05, 0.08, 0.0], [0.0883, 0.1167, 0.0], [0.1267, 0.1533, 0.0], [0.165, 0.19, 0.0], [0.2033, 0.2267, 0.0], [0.2417, 0.2633, 0.0], [0.28, 0.3, 0.0], [0.3117, 0.26, 0.0], [0.3433, 0.22, 0.0], [0.375, 0.18, 0.0], [0.4067, 0.14, 0.0], [0.4383, 0.1, 0.0], [0.47, 0.06, 0]], "radius": 0.028, "closed": false}}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.3, "height": 1.1, "depth": 0.05, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0, 0.24], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chart-line", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "chart-glow"}}, "material": "chart-glow", "materialLayers": ["chart-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "chart-node-beads", "type": "fastener", "kind": "fastener", "description": "emissive node beads realised as chart-bead-*"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 241, 52, 1.0)", "secondaryAlbedo": "rgba(248, 163, 6, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/chart-line.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/chart-line.png; its material-class guess (fabric, 0.458) was overridden by visual analysis"}};
  node_chart_line_22.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chart-line", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "chart-glow"}};
  (nodes["grid-plate"] ?? root).add(node_chart_line_22);
  nodes["chart-line"] = node_chart_line_22;
  const mesh_chart_line_22Geometry = endpoint_chart_line_22
    ? new THREE.CylinderGeometry(endpoint_chart_line_22.endRadius, endpoint_chart_line_22.baseRadius, endpoint_chart_line_22.length, 16, 6)
    : buildTubeGeometry({"points": [[-0.72, -0.62, 0.0], [-0.675, -0.58, 0.0], [-0.63, -0.54, 0.0], [-0.585, -0.5, 0.0], [-0.54, -0.46, 0.0], [-0.495, -0.42, 0.0], [-0.45, -0.38, 0.0], [-0.4083, -0.32, 0.0], [-0.3667, -0.26, 0.0], [-0.325, -0.2, 0.0], [-0.2833, -0.14, 0.0], [-0.2417, -0.08, 0.0], [-0.2, -0.02, 0.0], [-0.1583, -0.0033, 0.0], [-0.1167, 0.0133, 0.0], [-0.075, 0.03, 0.0], [-0.0333, 0.0467, 0.0], [0.0083, 0.0633, 0.0], [0.05, 0.08, 0.0], [0.0883, 0.1167, 0.0], [0.1267, 0.1533, 0.0], [0.165, 0.19, 0.0], [0.2033, 0.2267, 0.0], [0.2417, 0.2633, 0.0], [0.28, 0.3, 0.0], [0.3117, 0.26, 0.0], [0.3433, 0.22, 0.0], [0.375, 0.18, 0.0], [0.4067, 0.14, 0.0], [0.4383, 0.1, 0.0], [0.47, 0.06, 0]], "radius": 0.028, "closed": false});
  if (!endpoint_chart_line_22) {
    mesh_chart_line_22Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_chart_line_22 = new THREE.Mesh(
    mesh_chart_line_22Geometry,
    materialMap["chart-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_chart_line_22.name = "Rising chart polyline";
  if (endpoint_chart_line_22) {
    mesh_chart_line_22.position.copy(endpoint_chart_line_22.midpoint);
    mesh_chart_line_22.quaternion.copy(endpoint_chart_line_22.quaternion);
  }
  mesh_chart_line_22.castShadow = options.castShadow ?? true;
  mesh_chart_line_22.receiveShadow = options.receiveShadow ?? true;
  mesh_chart_line_22.userData.sculptComponent = {"id": "chart-line", "name": "Rising chart polyline", "level": "meso", "role": "overlay", "importance": 0.7, "confidence": 0.8, "primitive": "tube", "topologyClass": "fiber-strand", "topologyRationale": "A thin swept stroke along a measured polyline: tube along a CatmullRom path.", "geometryDescriptor": {"topologyIntent": "tube part for Rising chart polyline", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "tubePath": {"points": [[-0.72, -0.62, 0.0], [-0.675, -0.58, 0.0], [-0.63, -0.54, 0.0], [-0.585, -0.5, 0.0], [-0.54, -0.46, 0.0], [-0.495, -0.42, 0.0], [-0.45, -0.38, 0.0], [-0.4083, -0.32, 0.0], [-0.3667, -0.26, 0.0], [-0.325, -0.2, 0.0], [-0.2833, -0.14, 0.0], [-0.2417, -0.08, 0.0], [-0.2, -0.02, 0.0], [-0.1583, -0.0033, 0.0], [-0.1167, 0.0133, 0.0], [-0.075, 0.03, 0.0], [-0.0333, 0.0467, 0.0], [0.0083, 0.0633, 0.0], [0.05, 0.08, 0.0], [0.0883, 0.1167, 0.0], [0.1267, 0.1533, 0.0], [0.165, 0.19, 0.0], [0.2033, 0.2267, 0.0], [0.2417, 0.2633, 0.0], [0.28, 0.3, 0.0], [0.3117, 0.26, 0.0], [0.3433, 0.22, 0.0], [0.375, 0.18, 0.0], [0.4067, 0.14, 0.0], [0.4383, 0.1, 0.0], [0.47, 0.06, 0]], "radius": 0.028, "closed": false}}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 1.3, "height": 1.1, "depth": 0.05, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0, 0.24], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chart-line", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "chart-glow"}}, "material": "chart-glow", "materialLayers": ["chart-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "chart-node-beads", "type": "fastener", "kind": "fastener", "description": "emissive node beads realised as chart-bead-*"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 241, 52, 1.0)", "secondaryAlbedo": "rgba(248, 163, 6, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/chart-line.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/chart-line.png; its material-class guess (fabric, 0.458) was overridden by visual analysis"}};
  node_chart_line_22.add(mesh_chart_line_22);
  meshes["chart-line"] = mesh_chart_line_22;
  colliders["chart-line"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["chart-line"] ??= [];
  destructionGroups["chart-line"].push(node_chart_line_22);

  const endpoint_chart_bead_0_23 = makeAttachmentEndpoint(null);
  const node_chart_bead_0_23 = new THREE.Group();
  node_chart_bead_0_23.name = "Chart node bead 0__pivot";
  node_chart_bead_0_23.scale.set(1, 1, 1);
  if (endpoint_chart_bead_0_23) {
    node_chart_bead_0_23.position.copy(endpoint_chart_bead_0_23.start);
    node_chart_bead_0_23.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_chart_bead_0_23.position.set(-0.72, -0.62, 0.0);
    node_chart_bead_0_23.rotation.set(0.0, 0.0, 0.0);
  }
  node_chart_bead_0_23.userData.sculptComponent = {"id": "chart-bead-0", "name": "Chart node bead 0", "level": "micro", "role": "fastener", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Chart node bead 0 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "sphere part for Chart node bead 0", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "chart-line", "attachment": {"parentSocket": "chart-line-surface", "parentId": "chart-line", "contactType": "socket", "embedDepth": 0.03, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on chart-line; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.09, "height": 0.09, "depth": 0.09, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.72, -0.62, 0.0], "rotation": [0, 0, 0], "scale": [0.09, 0.09, 0.09]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chart-bead-0", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "chart-glow"}}, "material": "chart-glow", "materialLayers": ["chart-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 241, 52, 1.0)", "secondaryAlbedo": "rgba(248, 163, 6, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/chart-line.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/chart-line.png; its material-class guess (fabric, 0.458) was overridden by visual analysis"}};
  node_chart_bead_0_23.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chart-bead-0", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "chart-glow"}};
  (nodes["chart-line"] ?? root).add(node_chart_bead_0_23);
  nodes["chart-bead-0"] = node_chart_bead_0_23;
  const mesh_chart_bead_0_23Geometry = endpoint_chart_bead_0_23
    ? new THREE.CylinderGeometry(endpoint_chart_bead_0_23.endRadius, endpoint_chart_bead_0_23.baseRadius, endpoint_chart_bead_0_23.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_chart_bead_0_23) {
    mesh_chart_bead_0_23Geometry.scale(0.09, 0.09, 0.09);
  }
  const mesh_chart_bead_0_23 = new THREE.Mesh(
    mesh_chart_bead_0_23Geometry,
    materialMap["chart-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_chart_bead_0_23.name = "Chart node bead 0";
  if (endpoint_chart_bead_0_23) {
    mesh_chart_bead_0_23.position.copy(endpoint_chart_bead_0_23.midpoint);
    mesh_chart_bead_0_23.quaternion.copy(endpoint_chart_bead_0_23.quaternion);
  }
  mesh_chart_bead_0_23.castShadow = options.castShadow ?? true;
  mesh_chart_bead_0_23.receiveShadow = options.receiveShadow ?? true;
  mesh_chart_bead_0_23.userData.sculptComponent = {"id": "chart-bead-0", "name": "Chart node bead 0", "level": "micro", "role": "fastener", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Chart node bead 0 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "sphere part for Chart node bead 0", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "chart-line", "attachment": {"parentSocket": "chart-line-surface", "parentId": "chart-line", "contactType": "socket", "embedDepth": 0.03, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on chart-line; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.09, "height": 0.09, "depth": 0.09, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.72, -0.62, 0.0], "rotation": [0, 0, 0], "scale": [0.09, 0.09, 0.09]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chart-bead-0", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "chart-glow"}}, "material": "chart-glow", "materialLayers": ["chart-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 241, 52, 1.0)", "secondaryAlbedo": "rgba(248, 163, 6, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/chart-line.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/chart-line.png; its material-class guess (fabric, 0.458) was overridden by visual analysis"}};
  node_chart_bead_0_23.add(mesh_chart_bead_0_23);
  meshes["chart-bead-0"] = mesh_chart_bead_0_23;
  colliders["chart-bead-0"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["chart-bead-0"] ??= [];
  destructionGroups["chart-bead-0"].push(node_chart_bead_0_23);

  const endpoint_chart_bead_1_24 = makeAttachmentEndpoint(null);
  const node_chart_bead_1_24 = new THREE.Group();
  node_chart_bead_1_24.name = "Chart node bead 1__pivot";
  node_chart_bead_1_24.scale.set(1, 1, 1);
  if (endpoint_chart_bead_1_24) {
    node_chart_bead_1_24.position.copy(endpoint_chart_bead_1_24.start);
    node_chart_bead_1_24.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_chart_bead_1_24.position.set(-0.45, -0.38, 0.0);
    node_chart_bead_1_24.rotation.set(0.0, 0.0, 0.0);
  }
  node_chart_bead_1_24.userData.sculptComponent = {"id": "chart-bead-1", "name": "Chart node bead 1", "level": "micro", "role": "fastener", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Chart node bead 1 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "sphere part for Chart node bead 1", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "chart-line", "attachment": {"parentSocket": "chart-line-surface", "parentId": "chart-line", "contactType": "socket", "embedDepth": 0.03, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on chart-line; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.09, "height": 0.09, "depth": 0.09, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.45, -0.38, 0.0], "rotation": [0, 0, 0], "scale": [0.09, 0.09, 0.09]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chart-bead-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "chart-glow"}}, "material": "chart-glow", "materialLayers": ["chart-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 241, 52, 1.0)", "secondaryAlbedo": "rgba(248, 163, 6, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/chart-line.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/chart-line.png; its material-class guess (fabric, 0.458) was overridden by visual analysis"}};
  node_chart_bead_1_24.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chart-bead-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "chart-glow"}};
  (nodes["chart-line"] ?? root).add(node_chart_bead_1_24);
  nodes["chart-bead-1"] = node_chart_bead_1_24;
  const mesh_chart_bead_1_24Geometry = endpoint_chart_bead_1_24
    ? new THREE.CylinderGeometry(endpoint_chart_bead_1_24.endRadius, endpoint_chart_bead_1_24.baseRadius, endpoint_chart_bead_1_24.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_chart_bead_1_24) {
    mesh_chart_bead_1_24Geometry.scale(0.09, 0.09, 0.09);
  }
  const mesh_chart_bead_1_24 = new THREE.Mesh(
    mesh_chart_bead_1_24Geometry,
    materialMap["chart-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_chart_bead_1_24.name = "Chart node bead 1";
  if (endpoint_chart_bead_1_24) {
    mesh_chart_bead_1_24.position.copy(endpoint_chart_bead_1_24.midpoint);
    mesh_chart_bead_1_24.quaternion.copy(endpoint_chart_bead_1_24.quaternion);
  }
  mesh_chart_bead_1_24.castShadow = options.castShadow ?? true;
  mesh_chart_bead_1_24.receiveShadow = options.receiveShadow ?? true;
  mesh_chart_bead_1_24.userData.sculptComponent = {"id": "chart-bead-1", "name": "Chart node bead 1", "level": "micro", "role": "fastener", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Chart node bead 1 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "sphere part for Chart node bead 1", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "chart-line", "attachment": {"parentSocket": "chart-line-surface", "parentId": "chart-line", "contactType": "socket", "embedDepth": 0.03, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on chart-line; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.09, "height": 0.09, "depth": 0.09, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.45, -0.38, 0.0], "rotation": [0, 0, 0], "scale": [0.09, 0.09, 0.09]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chart-bead-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "chart-glow"}}, "material": "chart-glow", "materialLayers": ["chart-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 241, 52, 1.0)", "secondaryAlbedo": "rgba(248, 163, 6, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/chart-line.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/chart-line.png; its material-class guess (fabric, 0.458) was overridden by visual analysis"}};
  node_chart_bead_1_24.add(mesh_chart_bead_1_24);
  meshes["chart-bead-1"] = mesh_chart_bead_1_24;
  colliders["chart-bead-1"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["chart-bead-1"] ??= [];
  destructionGroups["chart-bead-1"].push(node_chart_bead_1_24);

  const endpoint_chart_bead_2_25 = makeAttachmentEndpoint(null);
  const node_chart_bead_2_25 = new THREE.Group();
  node_chart_bead_2_25.name = "Chart node bead 2__pivot";
  node_chart_bead_2_25.scale.set(1, 1, 1);
  if (endpoint_chart_bead_2_25) {
    node_chart_bead_2_25.position.copy(endpoint_chart_bead_2_25.start);
    node_chart_bead_2_25.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_chart_bead_2_25.position.set(-0.2, -0.02, 0.0);
    node_chart_bead_2_25.rotation.set(0.0, 0.0, 0.0);
  }
  node_chart_bead_2_25.userData.sculptComponent = {"id": "chart-bead-2", "name": "Chart node bead 2", "level": "micro", "role": "fastener", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Chart node bead 2 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "sphere part for Chart node bead 2", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "chart-line", "attachment": {"parentSocket": "chart-line-surface", "parentId": "chart-line", "contactType": "socket", "embedDepth": 0.03, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on chart-line; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.09, "height": 0.09, "depth": 0.09, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.2, -0.02, 0.0], "rotation": [0, 0, 0], "scale": [0.09, 0.09, 0.09]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chart-bead-2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "chart-glow"}}, "material": "chart-glow", "materialLayers": ["chart-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 241, 52, 1.0)", "secondaryAlbedo": "rgba(248, 163, 6, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/chart-line.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/chart-line.png; its material-class guess (fabric, 0.458) was overridden by visual analysis"}};
  node_chart_bead_2_25.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chart-bead-2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "chart-glow"}};
  (nodes["chart-line"] ?? root).add(node_chart_bead_2_25);
  nodes["chart-bead-2"] = node_chart_bead_2_25;
  const mesh_chart_bead_2_25Geometry = endpoint_chart_bead_2_25
    ? new THREE.CylinderGeometry(endpoint_chart_bead_2_25.endRadius, endpoint_chart_bead_2_25.baseRadius, endpoint_chart_bead_2_25.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_chart_bead_2_25) {
    mesh_chart_bead_2_25Geometry.scale(0.09, 0.09, 0.09);
  }
  const mesh_chart_bead_2_25 = new THREE.Mesh(
    mesh_chart_bead_2_25Geometry,
    materialMap["chart-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_chart_bead_2_25.name = "Chart node bead 2";
  if (endpoint_chart_bead_2_25) {
    mesh_chart_bead_2_25.position.copy(endpoint_chart_bead_2_25.midpoint);
    mesh_chart_bead_2_25.quaternion.copy(endpoint_chart_bead_2_25.quaternion);
  }
  mesh_chart_bead_2_25.castShadow = options.castShadow ?? true;
  mesh_chart_bead_2_25.receiveShadow = options.receiveShadow ?? true;
  mesh_chart_bead_2_25.userData.sculptComponent = {"id": "chart-bead-2", "name": "Chart node bead 2", "level": "micro", "role": "fastener", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Chart node bead 2 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "sphere part for Chart node bead 2", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "chart-line", "attachment": {"parentSocket": "chart-line-surface", "parentId": "chart-line", "contactType": "socket", "embedDepth": 0.03, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on chart-line; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.09, "height": 0.09, "depth": 0.09, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.2, -0.02, 0.0], "rotation": [0, 0, 0], "scale": [0.09, 0.09, 0.09]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chart-bead-2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "chart-glow"}}, "material": "chart-glow", "materialLayers": ["chart-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 241, 52, 1.0)", "secondaryAlbedo": "rgba(248, 163, 6, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/chart-line.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/chart-line.png; its material-class guess (fabric, 0.458) was overridden by visual analysis"}};
  node_chart_bead_2_25.add(mesh_chart_bead_2_25);
  meshes["chart-bead-2"] = mesh_chart_bead_2_25;
  colliders["chart-bead-2"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["chart-bead-2"] ??= [];
  destructionGroups["chart-bead-2"].push(node_chart_bead_2_25);

  const endpoint_chart_bead_4_26 = makeAttachmentEndpoint(null);
  const node_chart_bead_4_26 = new THREE.Group();
  node_chart_bead_4_26.name = "Chart node bead 4__pivot";
  node_chart_bead_4_26.scale.set(1, 1, 1);
  if (endpoint_chart_bead_4_26) {
    node_chart_bead_4_26.position.copy(endpoint_chart_bead_4_26.start);
    node_chart_bead_4_26.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_chart_bead_4_26.position.set(0.28, 0.3, 0.0);
    node_chart_bead_4_26.rotation.set(0.0, 0.0, 0.0);
  }
  node_chart_bead_4_26.userData.sculptComponent = {"id": "chart-bead-4", "name": "Chart node bead 4", "level": "micro", "role": "fastener", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Chart node bead 4 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "sphere part for Chart node bead 4", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "chart-line", "attachment": {"parentSocket": "chart-line-surface", "parentId": "chart-line", "contactType": "socket", "embedDepth": 0.03, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on chart-line; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.09, "height": 0.09, "depth": 0.09, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.28, 0.3, 0.0], "rotation": [0, 0, 0], "scale": [0.09, 0.09, 0.09]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chart-bead-4", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "chart-glow"}}, "material": "chart-glow", "materialLayers": ["chart-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 241, 52, 1.0)", "secondaryAlbedo": "rgba(248, 163, 6, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/chart-line.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/chart-line.png; its material-class guess (fabric, 0.458) was overridden by visual analysis"}};
  node_chart_bead_4_26.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chart-bead-4", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "chart-glow"}};
  (nodes["chart-line"] ?? root).add(node_chart_bead_4_26);
  nodes["chart-bead-4"] = node_chart_bead_4_26;
  const mesh_chart_bead_4_26Geometry = endpoint_chart_bead_4_26
    ? new THREE.CylinderGeometry(endpoint_chart_bead_4_26.endRadius, endpoint_chart_bead_4_26.baseRadius, endpoint_chart_bead_4_26.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_chart_bead_4_26) {
    mesh_chart_bead_4_26Geometry.scale(0.09, 0.09, 0.09);
  }
  const mesh_chart_bead_4_26 = new THREE.Mesh(
    mesh_chart_bead_4_26Geometry,
    materialMap["chart-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_chart_bead_4_26.name = "Chart node bead 4";
  if (endpoint_chart_bead_4_26) {
    mesh_chart_bead_4_26.position.copy(endpoint_chart_bead_4_26.midpoint);
    mesh_chart_bead_4_26.quaternion.copy(endpoint_chart_bead_4_26.quaternion);
  }
  mesh_chart_bead_4_26.castShadow = options.castShadow ?? true;
  mesh_chart_bead_4_26.receiveShadow = options.receiveShadow ?? true;
  mesh_chart_bead_4_26.userData.sculptComponent = {"id": "chart-bead-4", "name": "Chart node bead 4", "level": "micro", "role": "fastener", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Chart node bead 4 is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "sphere part for Chart node bead 4", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "chart-line", "attachment": {"parentSocket": "chart-line-surface", "parentId": "chart-line", "contactType": "socket", "embedDepth": 0.03, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on chart-line; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.09, "height": 0.09, "depth": 0.09, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.28, 0.3, 0.0], "rotation": [0, 0, 0], "scale": [0.09, 0.09, 0.09]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chart-bead-4", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "chart-glow"}}, "material": "chart-glow", "materialLayers": ["chart-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 241, 52, 1.0)", "secondaryAlbedo": "rgba(248, 163, 6, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/chart-line.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/chart-line.png; its material-class guess (fabric, 0.458) was overridden by visual analysis"}};
  node_chart_bead_4_26.add(mesh_chart_bead_4_26);
  meshes["chart-bead-4"] = mesh_chart_bead_4_26;
  colliders["chart-bead-4"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["chart-bead-4"] ??= [];
  destructionGroups["chart-bead-4"].push(node_chart_bead_4_26);

  const endpoint_play_glyph_27 = makeAttachmentEndpoint(null);
  const node_play_glyph_27 = new THREE.Group();
  node_play_glyph_27.name = "Play triangle glyph__pivot";
  node_play_glyph_27.scale.set(1, 1, 1);
  if (endpoint_play_glyph_27) {
    node_play_glyph_27.position.copy(endpoint_play_glyph_27.start);
    node_play_glyph_27.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_play_glyph_27.position.set(0.66, 0.02, 0.16);
    node_play_glyph_27.rotation.set(0.0, 0.0, 0.0);
  }
  node_play_glyph_27.userData.sculptComponent = {"id": "play-glyph", "name": "Play triangle glyph", "level": "meso", "role": "emblem", "importance": 0.7, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Play triangle glyph is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "extrude part for Play triangle glyph", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[-0.18, -0.22], [0.24, 0.0], [-0.18, 0.22]], "depth": 0.05}}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.42, "height": 0.44, "depth": 0.05, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.66, 0.02, 0.16], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "play-glyph", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "play-dark"}}, "material": "play-dark", "materialLayers": ["play-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "play-outline", "type": "contour", "kind": "contour", "description": "emissive outline realised by play-outline-tube"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(12, 7, 15, 1.0)", "secondaryAlbedo": "rgba(10, 10, 22, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/play-glyph.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/play-glyph.png; its material-class guess (stone, 0.45) was overridden by visual analysis"}};
  node_play_glyph_27.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "play-glyph", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "play-dark"}};
  (nodes["grid-plate"] ?? root).add(node_play_glyph_27);
  nodes["play-glyph"] = node_play_glyph_27;
  const mesh_play_glyph_27Geometry = endpoint_play_glyph_27
    ? new THREE.CylinderGeometry(endpoint_play_glyph_27.endRadius, endpoint_play_glyph_27.baseRadius, endpoint_play_glyph_27.length, 16, 6)
    : buildExtrudeGeometry({"points": [[-0.18, -0.22], [0.24, 0.0], [-0.18, 0.22]], "depth": 0.05});
  if (!endpoint_play_glyph_27) {
    mesh_play_glyph_27Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_play_glyph_27 = new THREE.Mesh(
    mesh_play_glyph_27Geometry,
    materialMap["play-dark"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_play_glyph_27.name = "Play triangle glyph";
  if (endpoint_play_glyph_27) {
    mesh_play_glyph_27.position.copy(endpoint_play_glyph_27.midpoint);
    mesh_play_glyph_27.quaternion.copy(endpoint_play_glyph_27.quaternion);
  }
  mesh_play_glyph_27.castShadow = options.castShadow ?? true;
  mesh_play_glyph_27.receiveShadow = options.receiveShadow ?? true;
  mesh_play_glyph_27.userData.sculptComponent = {"id": "play-glyph", "name": "Play triangle glyph", "level": "meso", "role": "emblem", "importance": 0.7, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Play triangle glyph is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "extrude part for Play triangle glyph", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[-0.18, -0.22], [0.24, 0.0], [-0.18, 0.22]], "depth": 0.05}}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.42, "height": 0.44, "depth": 0.05, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.66, 0.02, 0.16], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "play-glyph", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "play-dark"}}, "material": "play-dark", "materialLayers": ["play-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "play-outline", "type": "contour", "kind": "contour", "description": "emissive outline realised by play-outline-tube"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(12, 7, 15, 1.0)", "secondaryAlbedo": "rgba(10, 10, 22, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/play-glyph.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/play-glyph.png; its material-class guess (stone, 0.45) was overridden by visual analysis"}};
  node_play_glyph_27.add(mesh_play_glyph_27);
  meshes["play-glyph"] = mesh_play_glyph_27;
  colliders["play-glyph"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["play-glyph"] ??= [];
  destructionGroups["play-glyph"].push(node_play_glyph_27);

  const attachment_play_outline_tube_28 = {"parentSocket": "play-glyph-surface", "parentId": "play-glyph", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on play-glyph; zero-length endpoints keep the authored primitive"};
  const endpoint_play_outline_tube_28 = makeAttachmentEndpoint(attachment_play_outline_tube_28);
  const node_play_outline_tube_28 = new THREE.Group();
  node_play_outline_tube_28.name = "Play glyph emissive outline__pivot";
  node_play_outline_tube_28.scale.set(1, 1, 1);
  if (endpoint_play_outline_tube_28) {
    node_play_outline_tube_28.position.copy(endpoint_play_outline_tube_28.start);
    node_play_outline_tube_28.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_play_outline_tube_28.position.set(0.0, 0.0, 0.06);
    node_play_outline_tube_28.rotation.set(0.0, 0.0, 0.0);
  }
  node_play_outline_tube_28.userData.sculptComponent = {"id": "play-outline-tube", "name": "Play glyph emissive outline", "level": "micro", "role": "trim", "importance": 0.4, "confidence": 0.8, "primitive": "tube", "topologyClass": "fiber-strand", "topologyRationale": "Closed thin stroke around the triangle.", "geometryDescriptor": {"topologyIntent": "tube part for Play glyph emissive outline", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "tubePath": {"points": [[-0.2, -0.25, 0.0], [-0.14, -0.2188, 0.0], [-0.08, -0.1875, 0.0], [-0.02, -0.1562, 0.0], [0.04, -0.125, 0.0], [0.1, -0.0938, 0.0], [0.16, -0.0625, 0.0], [0.22, -0.0312, 0.0], [0.28, 0.0, 0.0], [0.22, 0.0312, 0.0], [0.16, 0.0625, 0.0], [0.1, 0.0938, 0.0], [0.04, 0.125, 0.0], [-0.02, 0.1562, 0.0], [-0.08, 0.1875, 0.0], [-0.14, 0.2188, 0.0], [-0.2, 0.25, 0.0], [-0.2, 0.1875, 0.0], [-0.2, 0.125, 0.0], [-0.2, 0.0625, 0.0], [-0.2, 0.0, 0.0], [-0.2, -0.0625, 0.0], [-0.2, -0.125, 0.0], [-0.2, -0.1875, 0.0]], "radius": 0.03, "closed": true}}, "parent": "play-glyph", "attachment": {"parentSocket": "play-glyph-surface", "parentId": "play-glyph", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on play-glyph; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.46, "height": 0.5, "depth": 0.05, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.0, 0.0, 0.06], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "play-outline-tube", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "chart-glow"}}, "material": "chart-glow", "materialLayers": ["chart-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 241, 52, 1.0)", "secondaryAlbedo": "rgba(248, 163, 6, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/chart-line.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/chart-line.png; its material-class guess (fabric, 0.458) was overridden by visual analysis"}};
  node_play_outline_tube_28.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "play-outline-tube", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "chart-glow"}};
  (nodes["play-glyph"] ?? root).add(node_play_outline_tube_28);
  nodes["play-outline-tube"] = node_play_outline_tube_28;
  const mesh_play_outline_tube_28Geometry = endpoint_play_outline_tube_28
    ? new THREE.CylinderGeometry(endpoint_play_outline_tube_28.endRadius, endpoint_play_outline_tube_28.baseRadius, endpoint_play_outline_tube_28.length, 16, 6)
    : buildTubeGeometry({"points": [[-0.2, -0.25, 0.0], [-0.14, -0.2188, 0.0], [-0.08, -0.1875, 0.0], [-0.02, -0.1562, 0.0], [0.04, -0.125, 0.0], [0.1, -0.0938, 0.0], [0.16, -0.0625, 0.0], [0.22, -0.0312, 0.0], [0.28, 0.0, 0.0], [0.22, 0.0312, 0.0], [0.16, 0.0625, 0.0], [0.1, 0.0938, 0.0], [0.04, 0.125, 0.0], [-0.02, 0.1562, 0.0], [-0.08, 0.1875, 0.0], [-0.14, 0.2188, 0.0], [-0.2, 0.25, 0.0], [-0.2, 0.1875, 0.0], [-0.2, 0.125, 0.0], [-0.2, 0.0625, 0.0], [-0.2, 0.0, 0.0], [-0.2, -0.0625, 0.0], [-0.2, -0.125, 0.0], [-0.2, -0.1875, 0.0]], "radius": 0.03, "closed": true});
  if (!endpoint_play_outline_tube_28) {
    mesh_play_outline_tube_28Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_play_outline_tube_28 = new THREE.Mesh(
    mesh_play_outline_tube_28Geometry,
    materialMap["chart-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_play_outline_tube_28.name = "Play glyph emissive outline";
  if (endpoint_play_outline_tube_28) {
    mesh_play_outline_tube_28.position.copy(endpoint_play_outline_tube_28.midpoint);
    mesh_play_outline_tube_28.quaternion.copy(endpoint_play_outline_tube_28.quaternion);
  }
  mesh_play_outline_tube_28.castShadow = options.castShadow ?? true;
  mesh_play_outline_tube_28.receiveShadow = options.receiveShadow ?? true;
  mesh_play_outline_tube_28.userData.sculptComponent = {"id": "play-outline-tube", "name": "Play glyph emissive outline", "level": "micro", "role": "trim", "importance": 0.4, "confidence": 0.8, "primitive": "tube", "topologyClass": "fiber-strand", "topologyRationale": "Closed thin stroke around the triangle.", "geometryDescriptor": {"topologyIntent": "tube part for Play glyph emissive outline", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "tubePath": {"points": [[-0.2, -0.25, 0.0], [-0.14, -0.2188, 0.0], [-0.08, -0.1875, 0.0], [-0.02, -0.1562, 0.0], [0.04, -0.125, 0.0], [0.1, -0.0938, 0.0], [0.16, -0.0625, 0.0], [0.22, -0.0312, 0.0], [0.28, 0.0, 0.0], [0.22, 0.0312, 0.0], [0.16, 0.0625, 0.0], [0.1, 0.0938, 0.0], [0.04, 0.125, 0.0], [-0.02, 0.1562, 0.0], [-0.08, 0.1875, 0.0], [-0.14, 0.2188, 0.0], [-0.2, 0.25, 0.0], [-0.2, 0.1875, 0.0], [-0.2, 0.125, 0.0], [-0.2, 0.0625, 0.0], [-0.2, 0.0, 0.0], [-0.2, -0.0625, 0.0], [-0.2, -0.125, 0.0], [-0.2, -0.1875, 0.0]], "radius": 0.03, "closed": true}}, "parent": "play-glyph", "attachment": {"parentSocket": "play-glyph-surface", "parentId": "play-glyph", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on play-glyph; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.46, "height": 0.5, "depth": 0.05, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.0, 0.0, 0.06], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "play-outline-tube", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "chart-glow"}}, "material": "chart-glow", "materialLayers": ["chart-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 241, 52, 1.0)", "secondaryAlbedo": "rgba(248, 163, 6, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/chart-line.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/chart-line.png; its material-class guess (fabric, 0.458) was overridden by visual analysis"}};
  node_play_outline_tube_28.add(mesh_play_outline_tube_28);
  meshes["play-outline-tube"] = mesh_play_outline_tube_28;
  colliders["play-outline-tube"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["play-outline-tube"] ??= [];
  destructionGroups["play-outline-tube"].push(node_play_outline_tube_28);

  const endpoint_orbit_trail_a_29 = makeAttachmentEndpoint(null);
  const node_orbit_trail_a_29 = new THREE.Group();
  node_orbit_trail_a_29.name = "Orbit trail (cyan)__pivot";
  node_orbit_trail_a_29.scale.set(1, 1, 1);
  if (endpoint_orbit_trail_a_29) {
    node_orbit_trail_a_29.position.copy(endpoint_orbit_trail_a_29.start);
    node_orbit_trail_a_29.rotation.set(-1.2, 0.0, -0.25);
  } else {
    node_orbit_trail_a_29.position.set(0.0, -0.35, 0.17);
    node_orbit_trail_a_29.rotation.set(-1.2, 0.0, -0.25);
  }
  node_orbit_trail_a_29.userData.sculptComponent = {"id": "orbit-trail-a", "name": "Orbit trail (cyan)", "level": "macro", "role": "effect", "importance": 1.0, "confidence": 0.8, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "Orbit trail (cyan) is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "torus part for Orbit trail (cyan)", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "torusTubeRatio": 0.03}, "parent": "root", "attachment": {"parentSocket": "root-surface", "parentId": "root", "contactType": "none", "embedDepth": 0.001, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on root; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 3.7, "height": 3.7, "depth": 3.7, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.35, 0.17], "rotation": [-1.2, 0.0, -0.25], "scale": [3.7, 3.7, 3.7]}, "actionProfile": {"animationRole": "effect-loop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "orbit-trail-a", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "trail-cyan"}}, "material": "trail-cyan", "materialLayers": ["trail-cyan"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "trail-additive-core", "type": "gloss", "kind": "gloss", "description": "white-hot emissive core with halo"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(45, 251, 253, 1.0)", "secondaryAlbedo": "rgba(2, 138, 253, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/orbit-trail-a.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/orbit-trail-a.png; its material-class guess (plastic, 0.494) was overridden by visual analysis"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "trail-cyan"}, "materialRegions": [{"regionId": "trail", "materialId": "trail-cyan", "profileId": "plastic.glossy", "crop": {"path": "/root/shieldbot/material-evidence/04-trail.png", "bbox": {"x": 100, "y": 790, "width": 40, "height": 20}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0005}}]};
  node_orbit_trail_a_29.userData.actionProfile = {"animationRole": "effect-loop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "orbit-trail-a", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "trail-cyan"}};
  (nodes["root"] ?? root).add(node_orbit_trail_a_29);
  nodes["orbit-trail-a"] = node_orbit_trail_a_29;
  const mesh_orbit_trail_a_29Geometry = endpoint_orbit_trail_a_29
    ? new THREE.CylinderGeometry(endpoint_orbit_trail_a_29.endRadius, endpoint_orbit_trail_a_29.baseRadius, endpoint_orbit_trail_a_29.length, 16, 6)
    : new THREE.TorusGeometry(0.45, 0.0135, 12, 48);
  if (!endpoint_orbit_trail_a_29) {
    mesh_orbit_trail_a_29Geometry.scale(3.7, 3.7, 3.7);
  }
  const mesh_orbit_trail_a_29 = new THREE.Mesh(
    mesh_orbit_trail_a_29Geometry,
    materialMap["trail-cyan"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_orbit_trail_a_29.name = "Orbit trail (cyan)";
  if (endpoint_orbit_trail_a_29) {
    mesh_orbit_trail_a_29.position.copy(endpoint_orbit_trail_a_29.midpoint);
    mesh_orbit_trail_a_29.quaternion.copy(endpoint_orbit_trail_a_29.quaternion);
  }
  mesh_orbit_trail_a_29.castShadow = options.castShadow ?? true;
  mesh_orbit_trail_a_29.receiveShadow = options.receiveShadow ?? true;
  mesh_orbit_trail_a_29.userData.sculptComponent = {"id": "orbit-trail-a", "name": "Orbit trail (cyan)", "level": "macro", "role": "effect", "importance": 1.0, "confidence": 0.8, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "Orbit trail (cyan) is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "torus part for Orbit trail (cyan)", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "torusTubeRatio": 0.03}, "parent": "root", "attachment": {"parentSocket": "root-surface", "parentId": "root", "contactType": "none", "embedDepth": 0.001, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on root; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 3.7, "height": 3.7, "depth": 3.7, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.35, 0.17], "rotation": [-1.2, 0.0, -0.25], "scale": [3.7, 3.7, 3.7]}, "actionProfile": {"animationRole": "effect-loop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "orbit-trail-a", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "trail-cyan"}}, "material": "trail-cyan", "materialLayers": ["trail-cyan"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "trail-additive-core", "type": "gloss", "kind": "gloss", "description": "white-hot emissive core with halo"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(45, 251, 253, 1.0)", "secondaryAlbedo": "rgba(2, 138, 253, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/orbit-trail-a.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/orbit-trail-a.png; its material-class guess (plastic, 0.494) was overridden by visual analysis"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "trail-cyan"}, "materialRegions": [{"regionId": "trail", "materialId": "trail-cyan", "profileId": "plastic.glossy", "crop": {"path": "/root/shieldbot/material-evidence/04-trail.png", "bbox": {"x": 100, "y": 790, "width": 40, "height": 20}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0005}}]};
  node_orbit_trail_a_29.add(mesh_orbit_trail_a_29);
  meshes["orbit-trail-a"] = mesh_orbit_trail_a_29;
  colliders["orbit-trail-a"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["orbit-trail-a"] ??= [];
  destructionGroups["orbit-trail-a"].push(node_orbit_trail_a_29);

  const endpoint_orbit_trail_b_30 = makeAttachmentEndpoint(null);
  const node_orbit_trail_b_30 = new THREE.Group();
  node_orbit_trail_b_30.name = "Orbit trail (orange)__pivot";
  node_orbit_trail_b_30.scale.set(1, 1, 1);
  if (endpoint_orbit_trail_b_30) {
    node_orbit_trail_b_30.position.copy(endpoint_orbit_trail_b_30.start);
    node_orbit_trail_b_30.rotation.set(-1.0, 0.0, 0.3);
  } else {
    node_orbit_trail_b_30.position.set(0.0, 0.05, 0.17);
    node_orbit_trail_b_30.rotation.set(-1.0, 0.0, 0.3);
  }
  node_orbit_trail_b_30.userData.sculptComponent = {"id": "orbit-trail-b", "name": "Orbit trail (orange)", "level": "macro", "role": "effect", "importance": 1.0, "confidence": 0.8, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "Orbit trail (orange) is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "torus part for Orbit trail (orange)", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "torusTubeRatio": 0.03}, "parent": "root", "attachment": {"parentSocket": "root-surface", "parentId": "root", "contactType": "none", "embedDepth": 0.001, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on root; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 3.5, "height": 3.5, "depth": 3.5, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.05, 0.17], "rotation": [-1.0, 0.0, 0.3], "scale": [3.5, 3.5, 3.5]}, "actionProfile": {"animationRole": "effect-loop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "orbit-trail-b", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "trail-orange"}}, "material": "trail-orange", "materialLayers": ["trail-orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(223, 77, 1, 1.0)", "secondaryAlbedo": "rgba(125, 35, 2, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/orbit-trail-b.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/orbit-trail-b.png; its material-class guess (plastic, 0.441) was overridden by visual analysis"}};
  node_orbit_trail_b_30.userData.actionProfile = {"animationRole": "effect-loop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "orbit-trail-b", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "trail-orange"}};
  (nodes["root"] ?? root).add(node_orbit_trail_b_30);
  nodes["orbit-trail-b"] = node_orbit_trail_b_30;
  const mesh_orbit_trail_b_30Geometry = endpoint_orbit_trail_b_30
    ? new THREE.CylinderGeometry(endpoint_orbit_trail_b_30.endRadius, endpoint_orbit_trail_b_30.baseRadius, endpoint_orbit_trail_b_30.length, 16, 6)
    : new THREE.TorusGeometry(0.45, 0.0135, 12, 48);
  if (!endpoint_orbit_trail_b_30) {
    mesh_orbit_trail_b_30Geometry.scale(3.5, 3.5, 3.5);
  }
  const mesh_orbit_trail_b_30 = new THREE.Mesh(
    mesh_orbit_trail_b_30Geometry,
    materialMap["trail-orange"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_orbit_trail_b_30.name = "Orbit trail (orange)";
  if (endpoint_orbit_trail_b_30) {
    mesh_orbit_trail_b_30.position.copy(endpoint_orbit_trail_b_30.midpoint);
    mesh_orbit_trail_b_30.quaternion.copy(endpoint_orbit_trail_b_30.quaternion);
  }
  mesh_orbit_trail_b_30.castShadow = options.castShadow ?? true;
  mesh_orbit_trail_b_30.receiveShadow = options.receiveShadow ?? true;
  mesh_orbit_trail_b_30.userData.sculptComponent = {"id": "orbit-trail-b", "name": "Orbit trail (orange)", "level": "macro", "role": "effect", "importance": 1.0, "confidence": 0.8, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "Orbit trail (orange) is a discrete hard-surface part assembled onto the shield, not a continuous sculpt.", "geometryDescriptor": {"topologyIntent": "torus part for Orbit trail (orange)", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "torusTubeRatio": 0.03}, "parent": "root", "attachment": {"parentSocket": "root-surface", "parentId": "root", "contactType": "none", "embedDepth": 0.001, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on root; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 3.5, "height": 3.5, "depth": 3.5, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.05, 0.17], "rotation": [-1.0, 0.0, 0.3], "scale": [3.5, 3.5, 3.5]}, "actionProfile": {"animationRole": "effect-loop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "orbit-trail-b", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "trail-orange"}}, "material": "trail-orange", "materialLayers": ["trail-orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(223, 77, 1, 1.0)", "secondaryAlbedo": "rgba(125, 35, 2, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.7, "evidenceRef": "part-crops/orbit-trail-b.png", "notes": "colours measured by extract_part_color_recipe.py from part-crops/orbit-trail-b.png; its material-class guess (plastic, 0.441) was overridden by visual analysis"}};
  node_orbit_trail_b_30.add(mesh_orbit_trail_b_30);
  meshes["orbit-trail-b"] = mesh_orbit_trail_b_30;
  colliders["orbit-trail-b"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["orbit-trail-b"] ??= [];
  destructionGroups["orbit-trail-b"].push(node_orbit_trail_b_30);

  const endpoint_eye_l_31 = makeAttachmentEndpoint(null);
  const node_eye_l_31 = new THREE.Group();
  node_eye_l_31.name = "Eye l (stylized addition)__pivot";
  node_eye_l_31.scale.set(1, 1, 1);
  if (endpoint_eye_l_31) {
    node_eye_l_31.position.copy(endpoint_eye_l_31.start);
    node_eye_l_31.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_eye_l_31.position.set(0.34, 0.56, 0.11);
    node_eye_l_31.rotation.set(0.0, 0.0, 0.0);
  }
  node_eye_l_31.userData.sculptComponent = {"id": "eye-l", "name": "Eye l (stylized addition)", "level": "meso", "role": "face", "importance": 0.7, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "sphere part for Eye l (stylized addition)", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.05, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.44, "height": 0.5, "depth": 0.26, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.34, 0.56, 0.11], "rotation": [0, 0, 0], "scale": [0.44, 0.5, 0.26]}, "actionProfile": {"animationRole": "blink", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye-white"}}, "material": "eye-white", "materialLayers": ["eye-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 255, 255, 1.0)", "secondaryAlbedo": "rgba(255, 255, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_eye_l_31.userData.actionProfile = {"animationRole": "blink", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye-white"}};
  (nodes["grid-plate"] ?? root).add(node_eye_l_31);
  nodes["eye-l"] = node_eye_l_31;
  const mesh_eye_l_31Geometry = endpoint_eye_l_31
    ? new THREE.CylinderGeometry(endpoint_eye_l_31.endRadius, endpoint_eye_l_31.baseRadius, endpoint_eye_l_31.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_eye_l_31) {
    mesh_eye_l_31Geometry.scale(0.44, 0.5, 0.26);
  }
  const mesh_eye_l_31 = new THREE.Mesh(
    mesh_eye_l_31Geometry,
    materialMap["eye-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_eye_l_31.name = "Eye l (stylized addition)";
  if (endpoint_eye_l_31) {
    mesh_eye_l_31.position.copy(endpoint_eye_l_31.midpoint);
    mesh_eye_l_31.quaternion.copy(endpoint_eye_l_31.quaternion);
  }
  mesh_eye_l_31.castShadow = options.castShadow ?? true;
  mesh_eye_l_31.receiveShadow = options.receiveShadow ?? true;
  mesh_eye_l_31.userData.sculptComponent = {"id": "eye-l", "name": "Eye l (stylized addition)", "level": "meso", "role": "face", "importance": 0.7, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "sphere part for Eye l (stylized addition)", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.05, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.44, "height": 0.5, "depth": 0.26, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.34, 0.56, 0.11], "rotation": [0, 0, 0], "scale": [0.44, 0.5, 0.26]}, "actionProfile": {"animationRole": "blink", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye-white"}}, "material": "eye-white", "materialLayers": ["eye-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 255, 255, 1.0)", "secondaryAlbedo": "rgba(255, 255, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_eye_l_31.add(mesh_eye_l_31);
  meshes["eye-l"] = mesh_eye_l_31;
  colliders["eye-l"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["eye-l"] ??= [];
  destructionGroups["eye-l"].push(node_eye_l_31);

  const endpoint_pupil_l_32 = makeAttachmentEndpoint(null);
  const node_pupil_l_32 = new THREE.Group();
  node_pupil_l_32.name = "Pupil l__pivot";
  node_pupil_l_32.scale.set(1, 1, 1);
  if (endpoint_pupil_l_32) {
    node_pupil_l_32.position.copy(endpoint_pupil_l_32.start);
    node_pupil_l_32.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_pupil_l_32.position.set(0.01, -0.02, 0.14);
    node_pupil_l_32.rotation.set(0.0, 0.0, 0.0);
  }
  node_pupil_l_32.userData.sculptComponent = {"id": "pupil-l", "name": "Pupil l", "level": "micro", "role": "face", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "sphere part for Pupil l", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "eye-l", "attachment": {"parentSocket": "eye-l-surface", "parentId": "eye-l", "contactType": "embed", "embedDepth": 0.02, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on eye-l; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.2, "height": 0.23, "depth": 0.08, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.01, -0.02, 0.14], "rotation": [0, 0, 0], "scale": [0.2, 0.23, 0.08]}, "actionProfile": {"animationRole": "look", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pupil-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pupil-black"}}, "material": "pupil-black", "materialLayers": ["pupil-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(11, 11, 20, 1.0)", "secondaryAlbedo": "rgba(11, 11, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_pupil_l_32.userData.actionProfile = {"animationRole": "look", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pupil-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pupil-black"}};
  (nodes["eye-l"] ?? root).add(node_pupil_l_32);
  nodes["pupil-l"] = node_pupil_l_32;
  const mesh_pupil_l_32Geometry = endpoint_pupil_l_32
    ? new THREE.CylinderGeometry(endpoint_pupil_l_32.endRadius, endpoint_pupil_l_32.baseRadius, endpoint_pupil_l_32.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_pupil_l_32) {
    mesh_pupil_l_32Geometry.scale(0.2, 0.23, 0.08);
  }
  const mesh_pupil_l_32 = new THREE.Mesh(
    mesh_pupil_l_32Geometry,
    materialMap["pupil-black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pupil_l_32.name = "Pupil l";
  if (endpoint_pupil_l_32) {
    mesh_pupil_l_32.position.copy(endpoint_pupil_l_32.midpoint);
    mesh_pupil_l_32.quaternion.copy(endpoint_pupil_l_32.quaternion);
  }
  mesh_pupil_l_32.castShadow = options.castShadow ?? true;
  mesh_pupil_l_32.receiveShadow = options.receiveShadow ?? true;
  mesh_pupil_l_32.userData.sculptComponent = {"id": "pupil-l", "name": "Pupil l", "level": "micro", "role": "face", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "sphere part for Pupil l", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "eye-l", "attachment": {"parentSocket": "eye-l-surface", "parentId": "eye-l", "contactType": "embed", "embedDepth": 0.02, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on eye-l; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.2, "height": 0.23, "depth": 0.08, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.01, -0.02, 0.14], "rotation": [0, 0, 0], "scale": [0.2, 0.23, 0.08]}, "actionProfile": {"animationRole": "look", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pupil-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pupil-black"}}, "material": "pupil-black", "materialLayers": ["pupil-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(11, 11, 20, 1.0)", "secondaryAlbedo": "rgba(11, 11, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_pupil_l_32.add(mesh_pupil_l_32);
  meshes["pupil-l"] = mesh_pupil_l_32;
  colliders["pupil-l"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["pupil-l"] ??= [];
  destructionGroups["pupil-l"].push(node_pupil_l_32);

  const attachment_brow_l_33 = {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"};
  const endpoint_brow_l_33 = makeAttachmentEndpoint(attachment_brow_l_33);
  const node_brow_l_33 = new THREE.Group();
  node_brow_l_33.name = "Brow l__pivot";
  node_brow_l_33.scale.set(1, 1, 1);
  if (endpoint_brow_l_33) {
    node_brow_l_33.position.copy(endpoint_brow_l_33.start);
    node_brow_l_33.rotation.set(0.0, 0.0, 1.5707963267948966);
  } else {
    node_brow_l_33.position.set(0.33, 0.88, 0.14);
    node_brow_l_33.rotation.set(0.0, 0.0, 1.5707963267948966);
  }
  node_brow_l_33.userData.sculptComponent = {"id": "brow-l", "name": "Brow l", "level": "micro", "role": "face", "importance": 0.4, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "capsule part for Brow l", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.26, "height": 0.24, "depth": 0.16, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.33, 0.88, 0.14], "rotation": [0, 0, 1.5707963267948966], "scale": [0.26, 0.24, 0.16]}, "actionProfile": {"animationRole": "emote", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "brow-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pupil-black"}}, "material": "pupil-black", "materialLayers": ["pupil-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(11, 11, 20, 1.0)", "secondaryAlbedo": "rgba(11, 11, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_brow_l_33.userData.actionProfile = {"animationRole": "emote", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "brow-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pupil-black"}};
  (nodes["grid-plate"] ?? root).add(node_brow_l_33);
  nodes["brow-l"] = node_brow_l_33;
  const mesh_brow_l_33Geometry = endpoint_brow_l_33
    ? new THREE.CylinderGeometry(endpoint_brow_l_33.endRadius, endpoint_brow_l_33.baseRadius, endpoint_brow_l_33.length, 16, 6)
    : buildWatertightCapsule(0.35, 0.7, 8, 16, 1);
  if (!endpoint_brow_l_33) {
    mesh_brow_l_33Geometry.scale(0.26, 0.24, 0.16);
  }
  const mesh_brow_l_33 = new THREE.Mesh(
    mesh_brow_l_33Geometry,
    materialMap["pupil-black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_brow_l_33.name = "Brow l";
  if (endpoint_brow_l_33) {
    mesh_brow_l_33.position.copy(endpoint_brow_l_33.midpoint);
    mesh_brow_l_33.quaternion.copy(endpoint_brow_l_33.quaternion);
  }
  mesh_brow_l_33.castShadow = options.castShadow ?? true;
  mesh_brow_l_33.receiveShadow = options.receiveShadow ?? true;
  mesh_brow_l_33.userData.sculptComponent = {"id": "brow-l", "name": "Brow l", "level": "micro", "role": "face", "importance": 0.4, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "capsule part for Brow l", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.26, "height": 0.24, "depth": 0.16, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.33, 0.88, 0.14], "rotation": [0, 0, 1.5707963267948966], "scale": [0.26, 0.24, 0.16]}, "actionProfile": {"animationRole": "emote", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "brow-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pupil-black"}}, "material": "pupil-black", "materialLayers": ["pupil-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(11, 11, 20, 1.0)", "secondaryAlbedo": "rgba(11, 11, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_brow_l_33.add(mesh_brow_l_33);
  meshes["brow-l"] = mesh_brow_l_33;
  colliders["brow-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["brow-l"] ??= [];
  destructionGroups["brow-l"].push(node_brow_l_33);

  const attachment_arm_l_34 = {"parentSocket": "root-surface", "parentId": "root", "contactType": "socket", "embedDepth": 0.04, "gapTolerance": 0.01, "localStart": [1.0, 0.1, 0.17], "localEnd": [1.4, -0.35, 0.17], "notes": "limb spans socket on root", "baseRadius": 0.075, "endRadius": 0.07};
  const endpoint_arm_l_34 = makeAttachmentEndpoint(attachment_arm_l_34);
  const node_arm_l_34 = new THREE.Group();
  node_arm_l_34.name = "Arm l__pivot";
  node_arm_l_34.scale.set(1, 1, 1);
  if (endpoint_arm_l_34) {
    node_arm_l_34.position.copy(endpoint_arm_l_34.start);
    node_arm_l_34.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_arm_l_34.position.set(1.0, 0.1, 0.17);
    node_arm_l_34.rotation.set(0.0, 0.0, 0.0);
  }
  node_arm_l_34.userData.sculptComponent = {"id": "arm-l", "name": "Arm l", "level": "meso", "role": "limb", "importance": 0.7, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "capsule part for Arm l", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentSocket": "root-surface", "parentId": "root", "contactType": "socket", "embedDepth": 0.04, "gapTolerance": 0.01, "localStart": [1.0, 0.1, 0.17], "localEnd": [1.4, -0.35, 0.17], "notes": "limb spans socket on root", "baseRadius": 0.075, "endRadius": 0.07}, "dimensions": {"width": 0.14, "height": 0.62, "depth": 0.14, "units": "relative", "confidence": 0.8}, "transform": {"position": [1.0, 0.1, 0.17], "rotation": [0, 0, 0], "scale": [0.14, 0.62, 0.14]}, "actionProfile": {"animationRole": "wave", "pivot": {"mode": "endpoint", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "arm-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "limb-blue"}}, "material": "limb-blue", "materialLayers": ["limb-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 107, 224, 1.0)", "secondaryAlbedo": "rgba(11, 58, 158, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_arm_l_34.userData.actionProfile = {"animationRole": "wave", "pivot": {"mode": "endpoint", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "arm-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "limb-blue"}};
  (nodes["root"] ?? root).add(node_arm_l_34);
  nodes["arm-l"] = node_arm_l_34;
  const mesh_arm_l_34Geometry = endpoint_arm_l_34
    ? new THREE.CylinderGeometry(endpoint_arm_l_34.endRadius, endpoint_arm_l_34.baseRadius, endpoint_arm_l_34.length, 16, 6)
    : buildWatertightCapsule(0.35, 0.7, 8, 16, 1);
  if (!endpoint_arm_l_34) {
    mesh_arm_l_34Geometry.scale(0.14, 0.62, 0.14);
  }
  const mesh_arm_l_34 = new THREE.Mesh(
    mesh_arm_l_34Geometry,
    materialMap["limb-blue"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_arm_l_34.name = "Arm l";
  if (endpoint_arm_l_34) {
    mesh_arm_l_34.position.copy(endpoint_arm_l_34.midpoint);
    mesh_arm_l_34.quaternion.copy(endpoint_arm_l_34.quaternion);
  }
  mesh_arm_l_34.castShadow = options.castShadow ?? true;
  mesh_arm_l_34.receiveShadow = options.receiveShadow ?? true;
  mesh_arm_l_34.userData.sculptComponent = {"id": "arm-l", "name": "Arm l", "level": "meso", "role": "limb", "importance": 0.7, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "capsule part for Arm l", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentSocket": "root-surface", "parentId": "root", "contactType": "socket", "embedDepth": 0.04, "gapTolerance": 0.01, "localStart": [1.0, 0.1, 0.17], "localEnd": [1.4, -0.35, 0.17], "notes": "limb spans socket on root", "baseRadius": 0.075, "endRadius": 0.07}, "dimensions": {"width": 0.14, "height": 0.62, "depth": 0.14, "units": "relative", "confidence": 0.8}, "transform": {"position": [1.0, 0.1, 0.17], "rotation": [0, 0, 0], "scale": [0.14, 0.62, 0.14]}, "actionProfile": {"animationRole": "wave", "pivot": {"mode": "endpoint", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "arm-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "limb-blue"}}, "material": "limb-blue", "materialLayers": ["limb-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 107, 224, 1.0)", "secondaryAlbedo": "rgba(11, 58, 158, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_arm_l_34.add(mesh_arm_l_34);
  meshes["arm-l"] = mesh_arm_l_34;
  colliders["arm-l"] = {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["arm-l"] ??= [];
  destructionGroups["arm-l"].push(node_arm_l_34);

  const endpoint_hand_l_35 = makeAttachmentEndpoint(null);
  const node_hand_l_35 = new THREE.Group();
  node_hand_l_35.name = "Glove l__pivot";
  node_hand_l_35.scale.set(1, 1, 1);
  if (endpoint_hand_l_35) {
    node_hand_l_35.position.copy(endpoint_hand_l_35.start);
    node_hand_l_35.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_hand_l_35.position.set(0.45, -0.52, 0.0);
    node_hand_l_35.rotation.set(0.0, 0.0, 0.0);
  }
  node_hand_l_35.userData.sculptComponent = {"id": "hand-l", "name": "Glove l", "level": "micro", "role": "limb", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "sphere part for Glove l", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "arm-l", "attachment": {"parentSocket": "arm-l-surface", "parentId": "arm-l", "contactType": "socket", "embedDepth": 0.03, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on arm-l; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.25, "height": 0.25, "depth": 0.25, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.45, -0.52, 0.0], "rotation": [0, 0, 0], "scale": [0.25, 0.25, 0.25]}, "actionProfile": {"animationRole": "wave", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hand-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "glove-white"}}, "material": "glove-white", "materialLayers": ["glove-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 246, 251, 1.0)", "secondaryAlbedo": "rgba(244, 246, 251, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_hand_l_35.userData.actionProfile = {"animationRole": "wave", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hand-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "glove-white"}};
  (nodes["arm-l"] ?? root).add(node_hand_l_35);
  nodes["hand-l"] = node_hand_l_35;
  const mesh_hand_l_35Geometry = endpoint_hand_l_35
    ? new THREE.CylinderGeometry(endpoint_hand_l_35.endRadius, endpoint_hand_l_35.baseRadius, endpoint_hand_l_35.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_hand_l_35) {
    mesh_hand_l_35Geometry.scale(0.25, 0.25, 0.25);
  }
  const mesh_hand_l_35 = new THREE.Mesh(
    mesh_hand_l_35Geometry,
    materialMap["glove-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_hand_l_35.name = "Glove l";
  if (endpoint_hand_l_35) {
    mesh_hand_l_35.position.copy(endpoint_hand_l_35.midpoint);
    mesh_hand_l_35.quaternion.copy(endpoint_hand_l_35.quaternion);
  }
  mesh_hand_l_35.castShadow = options.castShadow ?? true;
  mesh_hand_l_35.receiveShadow = options.receiveShadow ?? true;
  mesh_hand_l_35.userData.sculptComponent = {"id": "hand-l", "name": "Glove l", "level": "micro", "role": "limb", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "sphere part for Glove l", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "arm-l", "attachment": {"parentSocket": "arm-l-surface", "parentId": "arm-l", "contactType": "socket", "embedDepth": 0.03, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on arm-l; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.25, "height": 0.25, "depth": 0.25, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.45, -0.52, 0.0], "rotation": [0, 0, 0], "scale": [0.25, 0.25, 0.25]}, "actionProfile": {"animationRole": "wave", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hand-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "glove-white"}}, "material": "glove-white", "materialLayers": ["glove-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 246, 251, 1.0)", "secondaryAlbedo": "rgba(244, 246, 251, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_hand_l_35.add(mesh_hand_l_35);
  meshes["hand-l"] = mesh_hand_l_35;
  colliders["hand-l"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["hand-l"] ??= [];
  destructionGroups["hand-l"].push(node_hand_l_35);

  const attachment_leg_l_36 = {"parentSocket": "root-surface", "parentId": "root", "contactType": "socket", "embedDepth": 0.04, "gapTolerance": 0.01, "localStart": [0.2, -1.0, 0.17], "localEnd": [0.22, -1.5, 0.17], "notes": "limb spans socket on root", "baseRadius": 0.07, "endRadius": 0.065};
  const endpoint_leg_l_36 = makeAttachmentEndpoint(attachment_leg_l_36);
  const node_leg_l_36 = new THREE.Group();
  node_leg_l_36.name = "Leg l__pivot";
  node_leg_l_36.scale.set(1, 1, 1);
  if (endpoint_leg_l_36) {
    node_leg_l_36.position.copy(endpoint_leg_l_36.start);
    node_leg_l_36.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_leg_l_36.position.set(0.2, -1.0, 0.17);
    node_leg_l_36.rotation.set(0.0, 0.0, 0.0);
  }
  node_leg_l_36.userData.sculptComponent = {"id": "leg-l", "name": "Leg l", "level": "meso", "role": "limb", "importance": 0.7, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "capsule part for Leg l", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentSocket": "root-surface", "parentId": "root", "contactType": "socket", "embedDepth": 0.04, "gapTolerance": 0.01, "localStart": [0.2, -1.0, 0.17], "localEnd": [0.22, -1.5, 0.17], "notes": "limb spans socket on root", "baseRadius": 0.07, "endRadius": 0.065}, "dimensions": {"width": 0.13, "height": 0.5, "depth": 0.13, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.2, -1.0, 0.17], "rotation": [0, 0, 0], "scale": [0.13, 0.5, 0.13]}, "actionProfile": {"animationRole": "walk", "pivot": {"mode": "endpoint", "localPosition": [0, 0, 0], "axis": [1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "leg-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "limb-blue"}}, "material": "limb-blue", "materialLayers": ["limb-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 107, 224, 1.0)", "secondaryAlbedo": "rgba(11, 58, 158, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_leg_l_36.userData.actionProfile = {"animationRole": "walk", "pivot": {"mode": "endpoint", "localPosition": [0, 0, 0], "axis": [1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "leg-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "limb-blue"}};
  (nodes["root"] ?? root).add(node_leg_l_36);
  nodes["leg-l"] = node_leg_l_36;
  const mesh_leg_l_36Geometry = endpoint_leg_l_36
    ? new THREE.CylinderGeometry(endpoint_leg_l_36.endRadius, endpoint_leg_l_36.baseRadius, endpoint_leg_l_36.length, 16, 6)
    : buildWatertightCapsule(0.35, 0.7, 8, 16, 1);
  if (!endpoint_leg_l_36) {
    mesh_leg_l_36Geometry.scale(0.13, 0.5, 0.13);
  }
  const mesh_leg_l_36 = new THREE.Mesh(
    mesh_leg_l_36Geometry,
    materialMap["limb-blue"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_leg_l_36.name = "Leg l";
  if (endpoint_leg_l_36) {
    mesh_leg_l_36.position.copy(endpoint_leg_l_36.midpoint);
    mesh_leg_l_36.quaternion.copy(endpoint_leg_l_36.quaternion);
  }
  mesh_leg_l_36.castShadow = options.castShadow ?? true;
  mesh_leg_l_36.receiveShadow = options.receiveShadow ?? true;
  mesh_leg_l_36.userData.sculptComponent = {"id": "leg-l", "name": "Leg l", "level": "meso", "role": "limb", "importance": 0.7, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "capsule part for Leg l", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentSocket": "root-surface", "parentId": "root", "contactType": "socket", "embedDepth": 0.04, "gapTolerance": 0.01, "localStart": [0.2, -1.0, 0.17], "localEnd": [0.22, -1.5, 0.17], "notes": "limb spans socket on root", "baseRadius": 0.07, "endRadius": 0.065}, "dimensions": {"width": 0.13, "height": 0.5, "depth": 0.13, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.2, -1.0, 0.17], "rotation": [0, 0, 0], "scale": [0.13, 0.5, 0.13]}, "actionProfile": {"animationRole": "walk", "pivot": {"mode": "endpoint", "localPosition": [0, 0, 0], "axis": [1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "leg-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "limb-blue"}}, "material": "limb-blue", "materialLayers": ["limb-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 107, 224, 1.0)", "secondaryAlbedo": "rgba(11, 58, 158, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_leg_l_36.add(mesh_leg_l_36);
  meshes["leg-l"] = mesh_leg_l_36;
  colliders["leg-l"] = {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["leg-l"] ??= [];
  destructionGroups["leg-l"].push(node_leg_l_36);

  const endpoint_shoe_l_37 = makeAttachmentEndpoint(null);
  const node_shoe_l_37 = new THREE.Group();
  node_shoe_l_37.name = "Shoe l__pivot";
  node_shoe_l_37.scale.set(1, 1, 1);
  if (endpoint_shoe_l_37) {
    node_shoe_l_37.position.copy(endpoint_shoe_l_37.start);
    node_shoe_l_37.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_shoe_l_37.position.set(0.03, -0.56, 0.09);
    node_shoe_l_37.rotation.set(0.0, 0.0, 0.0);
  }
  node_shoe_l_37.userData.sculptComponent = {"id": "shoe-l", "name": "Shoe l", "level": "micro", "role": "limb", "importance": 0.4, "confidence": 0.8, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "ellipsoid part for Shoe l", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "leg-l", "attachment": {"parentSocket": "leg-l-surface", "parentId": "leg-l", "contactType": "socket", "embedDepth": 0.03, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on leg-l; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.3, "height": 0.16, "depth": 0.44, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.03, -0.56, 0.09], "rotation": [0, 0, 0], "scale": [0.3, 0.16, 0.44]}, "actionProfile": {"animationRole": "walk", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shoe-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoe-dark"}}, "material": "shoe-dark", "materialLayers": ["shoe-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(20, 24, 32, 1.0)", "secondaryAlbedo": "rgba(20, 24, 32, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_shoe_l_37.userData.actionProfile = {"animationRole": "walk", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shoe-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoe-dark"}};
  (nodes["leg-l"] ?? root).add(node_shoe_l_37);
  nodes["shoe-l"] = node_shoe_l_37;
  const mesh_shoe_l_37Geometry = endpoint_shoe_l_37
    ? new THREE.CylinderGeometry(endpoint_shoe_l_37.endRadius, endpoint_shoe_l_37.baseRadius, endpoint_shoe_l_37.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_shoe_l_37) {
    mesh_shoe_l_37Geometry.scale(0.3, 0.16, 0.44);
  }
  const mesh_shoe_l_37 = new THREE.Mesh(
    mesh_shoe_l_37Geometry,
    materialMap["shoe-dark"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_shoe_l_37.name = "Shoe l";
  if (endpoint_shoe_l_37) {
    mesh_shoe_l_37.position.copy(endpoint_shoe_l_37.midpoint);
    mesh_shoe_l_37.quaternion.copy(endpoint_shoe_l_37.quaternion);
  }
  mesh_shoe_l_37.castShadow = options.castShadow ?? true;
  mesh_shoe_l_37.receiveShadow = options.receiveShadow ?? true;
  mesh_shoe_l_37.userData.sculptComponent = {"id": "shoe-l", "name": "Shoe l", "level": "micro", "role": "limb", "importance": 0.4, "confidence": 0.8, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "ellipsoid part for Shoe l", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "leg-l", "attachment": {"parentSocket": "leg-l-surface", "parentId": "leg-l", "contactType": "socket", "embedDepth": 0.03, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on leg-l; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.3, "height": 0.16, "depth": 0.44, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.03, -0.56, 0.09], "rotation": [0, 0, 0], "scale": [0.3, 0.16, 0.44]}, "actionProfile": {"animationRole": "walk", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shoe-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoe-dark"}}, "material": "shoe-dark", "materialLayers": ["shoe-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(20, 24, 32, 1.0)", "secondaryAlbedo": "rgba(20, 24, 32, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_shoe_l_37.add(mesh_shoe_l_37);
  meshes["shoe-l"] = mesh_shoe_l_37;
  colliders["shoe-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["shoe-l"] ??= [];
  destructionGroups["shoe-l"].push(node_shoe_l_37);

  const endpoint_eye_r_38 = makeAttachmentEndpoint(null);
  const node_eye_r_38 = new THREE.Group();
  node_eye_r_38.name = "Eye r (stylized addition)__pivot";
  node_eye_r_38.scale.set(1, 1, 1);
  if (endpoint_eye_r_38) {
    node_eye_r_38.position.copy(endpoint_eye_r_38.start);
    node_eye_r_38.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_eye_r_38.position.set(-0.34, 0.56, 0.11);
    node_eye_r_38.rotation.set(0.0, 0.0, 0.0);
  }
  node_eye_r_38.userData.sculptComponent = {"id": "eye-r", "name": "Eye r (stylized addition)", "level": "meso", "role": "face", "importance": 0.7, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "sphere part for Eye r (stylized addition)", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.05, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.44, "height": 0.5, "depth": 0.26, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.34, 0.56, 0.11], "rotation": [0, 0, 0], "scale": [0.44, 0.5, 0.26]}, "actionProfile": {"animationRole": "blink", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye-white"}}, "material": "eye-white", "materialLayers": ["eye-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 255, 255, 1.0)", "secondaryAlbedo": "rgba(255, 255, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_eye_r_38.userData.actionProfile = {"animationRole": "blink", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye-white"}};
  (nodes["grid-plate"] ?? root).add(node_eye_r_38);
  nodes["eye-r"] = node_eye_r_38;
  const mesh_eye_r_38Geometry = endpoint_eye_r_38
    ? new THREE.CylinderGeometry(endpoint_eye_r_38.endRadius, endpoint_eye_r_38.baseRadius, endpoint_eye_r_38.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_eye_r_38) {
    mesh_eye_r_38Geometry.scale(0.44, 0.5, 0.26);
  }
  const mesh_eye_r_38 = new THREE.Mesh(
    mesh_eye_r_38Geometry,
    materialMap["eye-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_eye_r_38.name = "Eye r (stylized addition)";
  if (endpoint_eye_r_38) {
    mesh_eye_r_38.position.copy(endpoint_eye_r_38.midpoint);
    mesh_eye_r_38.quaternion.copy(endpoint_eye_r_38.quaternion);
  }
  mesh_eye_r_38.castShadow = options.castShadow ?? true;
  mesh_eye_r_38.receiveShadow = options.receiveShadow ?? true;
  mesh_eye_r_38.userData.sculptComponent = {"id": "eye-r", "name": "Eye r (stylized addition)", "level": "meso", "role": "face", "importance": 0.7, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "sphere part for Eye r (stylized addition)", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "embed", "embedDepth": 0.05, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.44, "height": 0.5, "depth": 0.26, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.34, 0.56, 0.11], "rotation": [0, 0, 0], "scale": [0.44, 0.5, 0.26]}, "actionProfile": {"animationRole": "blink", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye-white"}}, "material": "eye-white", "materialLayers": ["eye-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 255, 255, 1.0)", "secondaryAlbedo": "rgba(255, 255, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_eye_r_38.add(mesh_eye_r_38);
  meshes["eye-r"] = mesh_eye_r_38;
  colliders["eye-r"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["eye-r"] ??= [];
  destructionGroups["eye-r"].push(node_eye_r_38);

  const endpoint_pupil_r_39 = makeAttachmentEndpoint(null);
  const node_pupil_r_39 = new THREE.Group();
  node_pupil_r_39.name = "Pupil r__pivot";
  node_pupil_r_39.scale.set(1, 1, 1);
  if (endpoint_pupil_r_39) {
    node_pupil_r_39.position.copy(endpoint_pupil_r_39.start);
    node_pupil_r_39.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_pupil_r_39.position.set(-0.01, -0.02, 0.14);
    node_pupil_r_39.rotation.set(0.0, 0.0, 0.0);
  }
  node_pupil_r_39.userData.sculptComponent = {"id": "pupil-r", "name": "Pupil r", "level": "micro", "role": "face", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "sphere part for Pupil r", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "eye-r", "attachment": {"parentSocket": "eye-r-surface", "parentId": "eye-r", "contactType": "embed", "embedDepth": 0.02, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on eye-r; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.2, "height": 0.23, "depth": 0.08, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.01, -0.02, 0.14], "rotation": [0, 0, 0], "scale": [0.2, 0.23, 0.08]}, "actionProfile": {"animationRole": "look", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pupil-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pupil-black"}}, "material": "pupil-black", "materialLayers": ["pupil-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(11, 11, 20, 1.0)", "secondaryAlbedo": "rgba(11, 11, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_pupil_r_39.userData.actionProfile = {"animationRole": "look", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pupil-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pupil-black"}};
  (nodes["eye-r"] ?? root).add(node_pupil_r_39);
  nodes["pupil-r"] = node_pupil_r_39;
  const mesh_pupil_r_39Geometry = endpoint_pupil_r_39
    ? new THREE.CylinderGeometry(endpoint_pupil_r_39.endRadius, endpoint_pupil_r_39.baseRadius, endpoint_pupil_r_39.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_pupil_r_39) {
    mesh_pupil_r_39Geometry.scale(0.2, 0.23, 0.08);
  }
  const mesh_pupil_r_39 = new THREE.Mesh(
    mesh_pupil_r_39Geometry,
    materialMap["pupil-black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pupil_r_39.name = "Pupil r";
  if (endpoint_pupil_r_39) {
    mesh_pupil_r_39.position.copy(endpoint_pupil_r_39.midpoint);
    mesh_pupil_r_39.quaternion.copy(endpoint_pupil_r_39.quaternion);
  }
  mesh_pupil_r_39.castShadow = options.castShadow ?? true;
  mesh_pupil_r_39.receiveShadow = options.receiveShadow ?? true;
  mesh_pupil_r_39.userData.sculptComponent = {"id": "pupil-r", "name": "Pupil r", "level": "micro", "role": "face", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "sphere part for Pupil r", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "eye-r", "attachment": {"parentSocket": "eye-r-surface", "parentId": "eye-r", "contactType": "embed", "embedDepth": 0.02, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on eye-r; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.2, "height": 0.23, "depth": 0.08, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.01, -0.02, 0.14], "rotation": [0, 0, 0], "scale": [0.2, 0.23, 0.08]}, "actionProfile": {"animationRole": "look", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pupil-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pupil-black"}}, "material": "pupil-black", "materialLayers": ["pupil-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(11, 11, 20, 1.0)", "secondaryAlbedo": "rgba(11, 11, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_pupil_r_39.add(mesh_pupil_r_39);
  meshes["pupil-r"] = mesh_pupil_r_39;
  colliders["pupil-r"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["pupil-r"] ??= [];
  destructionGroups["pupil-r"].push(node_pupil_r_39);

  const attachment_brow_r_40 = {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"};
  const endpoint_brow_r_40 = makeAttachmentEndpoint(attachment_brow_r_40);
  const node_brow_r_40 = new THREE.Group();
  node_brow_r_40.name = "Brow r__pivot";
  node_brow_r_40.scale.set(1, 1, 1);
  if (endpoint_brow_r_40) {
    node_brow_r_40.position.copy(endpoint_brow_r_40.start);
    node_brow_r_40.rotation.set(0.0, 0.0, 1.5707963267948966);
  } else {
    node_brow_r_40.position.set(-0.33, 0.88, 0.14);
    node_brow_r_40.rotation.set(0.0, 0.0, 1.5707963267948966);
  }
  node_brow_r_40.userData.sculptComponent = {"id": "brow-r", "name": "Brow r", "level": "micro", "role": "face", "importance": 0.4, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "capsule part for Brow r", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.26, "height": 0.24, "depth": 0.16, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.33, 0.88, 0.14], "rotation": [0, 0, 1.5707963267948966], "scale": [0.26, 0.24, 0.16]}, "actionProfile": {"animationRole": "emote", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "brow-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pupil-black"}}, "material": "pupil-black", "materialLayers": ["pupil-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(11, 11, 20, 1.0)", "secondaryAlbedo": "rgba(11, 11, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_brow_r_40.userData.actionProfile = {"animationRole": "emote", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "brow-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pupil-black"}};
  (nodes["grid-plate"] ?? root).add(node_brow_r_40);
  nodes["brow-r"] = node_brow_r_40;
  const mesh_brow_r_40Geometry = endpoint_brow_r_40
    ? new THREE.CylinderGeometry(endpoint_brow_r_40.endRadius, endpoint_brow_r_40.baseRadius, endpoint_brow_r_40.length, 16, 6)
    : buildWatertightCapsule(0.35, 0.7, 8, 16, 1);
  if (!endpoint_brow_r_40) {
    mesh_brow_r_40Geometry.scale(0.26, 0.24, 0.16);
  }
  const mesh_brow_r_40 = new THREE.Mesh(
    mesh_brow_r_40Geometry,
    materialMap["pupil-black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_brow_r_40.name = "Brow r";
  if (endpoint_brow_r_40) {
    mesh_brow_r_40.position.copy(endpoint_brow_r_40.midpoint);
    mesh_brow_r_40.quaternion.copy(endpoint_brow_r_40.quaternion);
  }
  mesh_brow_r_40.castShadow = options.castShadow ?? true;
  mesh_brow_r_40.receiveShadow = options.receiveShadow ?? true;
  mesh_brow_r_40.userData.sculptComponent = {"id": "brow-r", "name": "Brow r", "level": "micro", "role": "face", "importance": 0.4, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "capsule part for Brow r", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.26, "height": 0.24, "depth": 0.16, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.33, 0.88, 0.14], "rotation": [0, 0, 1.5707963267948966], "scale": [0.26, 0.24, 0.16]}, "actionProfile": {"animationRole": "emote", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "brow-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pupil-black"}}, "material": "pupil-black", "materialLayers": ["pupil-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(11, 11, 20, 1.0)", "secondaryAlbedo": "rgba(11, 11, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_brow_r_40.add(mesh_brow_r_40);
  meshes["brow-r"] = mesh_brow_r_40;
  colliders["brow-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["brow-r"] ??= [];
  destructionGroups["brow-r"].push(node_brow_r_40);

  const attachment_arm_r_41 = {"parentSocket": "root-surface", "parentId": "root", "contactType": "socket", "embedDepth": 0.04, "gapTolerance": 0.01, "localStart": [-1.0, 0.1, 0.17], "localEnd": [-1.4, -0.35, 0.17], "notes": "limb spans socket on root", "baseRadius": 0.075, "endRadius": 0.07};
  const endpoint_arm_r_41 = makeAttachmentEndpoint(attachment_arm_r_41);
  const node_arm_r_41 = new THREE.Group();
  node_arm_r_41.name = "Arm r__pivot";
  node_arm_r_41.scale.set(1, 1, 1);
  if (endpoint_arm_r_41) {
    node_arm_r_41.position.copy(endpoint_arm_r_41.start);
    node_arm_r_41.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_arm_r_41.position.set(-1.0, 0.1, 0.17);
    node_arm_r_41.rotation.set(0.0, 0.0, 0.0);
  }
  node_arm_r_41.userData.sculptComponent = {"id": "arm-r", "name": "Arm r", "level": "meso", "role": "limb", "importance": 0.7, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "capsule part for Arm r", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentSocket": "root-surface", "parentId": "root", "contactType": "socket", "embedDepth": 0.04, "gapTolerance": 0.01, "localStart": [-1.0, 0.1, 0.17], "localEnd": [-1.4, -0.35, 0.17], "notes": "limb spans socket on root", "baseRadius": 0.075, "endRadius": 0.07}, "dimensions": {"width": 0.14, "height": 0.62, "depth": 0.14, "units": "relative", "confidence": 0.8}, "transform": {"position": [-1.0, 0.1, 0.17], "rotation": [0, 0, 0], "scale": [0.14, 0.62, 0.14]}, "actionProfile": {"animationRole": "wave", "pivot": {"mode": "endpoint", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "arm-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "limb-blue"}}, "material": "limb-blue", "materialLayers": ["limb-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 107, 224, 1.0)", "secondaryAlbedo": "rgba(11, 58, 158, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_arm_r_41.userData.actionProfile = {"animationRole": "wave", "pivot": {"mode": "endpoint", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "arm-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "limb-blue"}};
  (nodes["root"] ?? root).add(node_arm_r_41);
  nodes["arm-r"] = node_arm_r_41;
  const mesh_arm_r_41Geometry = endpoint_arm_r_41
    ? new THREE.CylinderGeometry(endpoint_arm_r_41.endRadius, endpoint_arm_r_41.baseRadius, endpoint_arm_r_41.length, 16, 6)
    : buildWatertightCapsule(0.35, 0.7, 8, 16, 1);
  if (!endpoint_arm_r_41) {
    mesh_arm_r_41Geometry.scale(0.14, 0.62, 0.14);
  }
  const mesh_arm_r_41 = new THREE.Mesh(
    mesh_arm_r_41Geometry,
    materialMap["limb-blue"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_arm_r_41.name = "Arm r";
  if (endpoint_arm_r_41) {
    mesh_arm_r_41.position.copy(endpoint_arm_r_41.midpoint);
    mesh_arm_r_41.quaternion.copy(endpoint_arm_r_41.quaternion);
  }
  mesh_arm_r_41.castShadow = options.castShadow ?? true;
  mesh_arm_r_41.receiveShadow = options.receiveShadow ?? true;
  mesh_arm_r_41.userData.sculptComponent = {"id": "arm-r", "name": "Arm r", "level": "meso", "role": "limb", "importance": 0.7, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "capsule part for Arm r", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentSocket": "root-surface", "parentId": "root", "contactType": "socket", "embedDepth": 0.04, "gapTolerance": 0.01, "localStart": [-1.0, 0.1, 0.17], "localEnd": [-1.4, -0.35, 0.17], "notes": "limb spans socket on root", "baseRadius": 0.075, "endRadius": 0.07}, "dimensions": {"width": 0.14, "height": 0.62, "depth": 0.14, "units": "relative", "confidence": 0.8}, "transform": {"position": [-1.0, 0.1, 0.17], "rotation": [0, 0, 0], "scale": [0.14, 0.62, 0.14]}, "actionProfile": {"animationRole": "wave", "pivot": {"mode": "endpoint", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "arm-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "limb-blue"}}, "material": "limb-blue", "materialLayers": ["limb-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 107, 224, 1.0)", "secondaryAlbedo": "rgba(11, 58, 158, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_arm_r_41.add(mesh_arm_r_41);
  meshes["arm-r"] = mesh_arm_r_41;
  colliders["arm-r"] = {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["arm-r"] ??= [];
  destructionGroups["arm-r"].push(node_arm_r_41);

  const endpoint_hand_r_42 = makeAttachmentEndpoint(null);
  const node_hand_r_42 = new THREE.Group();
  node_hand_r_42.name = "Glove r__pivot";
  node_hand_r_42.scale.set(1, 1, 1);
  if (endpoint_hand_r_42) {
    node_hand_r_42.position.copy(endpoint_hand_r_42.start);
    node_hand_r_42.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_hand_r_42.position.set(-0.45, -0.52, 0.0);
    node_hand_r_42.rotation.set(0.0, 0.0, 0.0);
  }
  node_hand_r_42.userData.sculptComponent = {"id": "hand-r", "name": "Glove r", "level": "micro", "role": "limb", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "sphere part for Glove r", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "arm-r", "attachment": {"parentSocket": "arm-r-surface", "parentId": "arm-r", "contactType": "socket", "embedDepth": 0.03, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on arm-r; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.25, "height": 0.25, "depth": 0.25, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.45, -0.52, 0.0], "rotation": [0, 0, 0], "scale": [0.25, 0.25, 0.25]}, "actionProfile": {"animationRole": "wave", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hand-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "glove-white"}}, "material": "glove-white", "materialLayers": ["glove-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 246, 251, 1.0)", "secondaryAlbedo": "rgba(244, 246, 251, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_hand_r_42.userData.actionProfile = {"animationRole": "wave", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hand-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "glove-white"}};
  (nodes["arm-r"] ?? root).add(node_hand_r_42);
  nodes["hand-r"] = node_hand_r_42;
  const mesh_hand_r_42Geometry = endpoint_hand_r_42
    ? new THREE.CylinderGeometry(endpoint_hand_r_42.endRadius, endpoint_hand_r_42.baseRadius, endpoint_hand_r_42.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_hand_r_42) {
    mesh_hand_r_42Geometry.scale(0.25, 0.25, 0.25);
  }
  const mesh_hand_r_42 = new THREE.Mesh(
    mesh_hand_r_42Geometry,
    materialMap["glove-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_hand_r_42.name = "Glove r";
  if (endpoint_hand_r_42) {
    mesh_hand_r_42.position.copy(endpoint_hand_r_42.midpoint);
    mesh_hand_r_42.quaternion.copy(endpoint_hand_r_42.quaternion);
  }
  mesh_hand_r_42.castShadow = options.castShadow ?? true;
  mesh_hand_r_42.receiveShadow = options.receiveShadow ?? true;
  mesh_hand_r_42.userData.sculptComponent = {"id": "hand-r", "name": "Glove r", "level": "micro", "role": "limb", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "sphere part for Glove r", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "arm-r", "attachment": {"parentSocket": "arm-r-surface", "parentId": "arm-r", "contactType": "socket", "embedDepth": 0.03, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on arm-r; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.25, "height": 0.25, "depth": 0.25, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.45, -0.52, 0.0], "rotation": [0, 0, 0], "scale": [0.25, 0.25, 0.25]}, "actionProfile": {"animationRole": "wave", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hand-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "glove-white"}}, "material": "glove-white", "materialLayers": ["glove-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 246, 251, 1.0)", "secondaryAlbedo": "rgba(244, 246, 251, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_hand_r_42.add(mesh_hand_r_42);
  meshes["hand-r"] = mesh_hand_r_42;
  colliders["hand-r"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["hand-r"] ??= [];
  destructionGroups["hand-r"].push(node_hand_r_42);

  const attachment_leg_r_43 = {"parentSocket": "root-surface", "parentId": "root", "contactType": "socket", "embedDepth": 0.04, "gapTolerance": 0.01, "localStart": [-0.2, -1.0, 0.17], "localEnd": [-0.22, -1.5, 0.17], "notes": "limb spans socket on root", "baseRadius": 0.07, "endRadius": 0.065};
  const endpoint_leg_r_43 = makeAttachmentEndpoint(attachment_leg_r_43);
  const node_leg_r_43 = new THREE.Group();
  node_leg_r_43.name = "Leg r__pivot";
  node_leg_r_43.scale.set(1, 1, 1);
  if (endpoint_leg_r_43) {
    node_leg_r_43.position.copy(endpoint_leg_r_43.start);
    node_leg_r_43.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_leg_r_43.position.set(-0.2, -1.0, 0.17);
    node_leg_r_43.rotation.set(0.0, 0.0, 0.0);
  }
  node_leg_r_43.userData.sculptComponent = {"id": "leg-r", "name": "Leg r", "level": "meso", "role": "limb", "importance": 0.7, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "capsule part for Leg r", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentSocket": "root-surface", "parentId": "root", "contactType": "socket", "embedDepth": 0.04, "gapTolerance": 0.01, "localStart": [-0.2, -1.0, 0.17], "localEnd": [-0.22, -1.5, 0.17], "notes": "limb spans socket on root", "baseRadius": 0.07, "endRadius": 0.065}, "dimensions": {"width": 0.13, "height": 0.5, "depth": 0.13, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.2, -1.0, 0.17], "rotation": [0, 0, 0], "scale": [0.13, 0.5, 0.13]}, "actionProfile": {"animationRole": "walk", "pivot": {"mode": "endpoint", "localPosition": [0, 0, 0], "axis": [1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "leg-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "limb-blue"}}, "material": "limb-blue", "materialLayers": ["limb-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 107, 224, 1.0)", "secondaryAlbedo": "rgba(11, 58, 158, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_leg_r_43.userData.actionProfile = {"animationRole": "walk", "pivot": {"mode": "endpoint", "localPosition": [0, 0, 0], "axis": [1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "leg-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "limb-blue"}};
  (nodes["root"] ?? root).add(node_leg_r_43);
  nodes["leg-r"] = node_leg_r_43;
  const mesh_leg_r_43Geometry = endpoint_leg_r_43
    ? new THREE.CylinderGeometry(endpoint_leg_r_43.endRadius, endpoint_leg_r_43.baseRadius, endpoint_leg_r_43.length, 16, 6)
    : buildWatertightCapsule(0.35, 0.7, 8, 16, 1);
  if (!endpoint_leg_r_43) {
    mesh_leg_r_43Geometry.scale(0.13, 0.5, 0.13);
  }
  const mesh_leg_r_43 = new THREE.Mesh(
    mesh_leg_r_43Geometry,
    materialMap["limb-blue"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_leg_r_43.name = "Leg r";
  if (endpoint_leg_r_43) {
    mesh_leg_r_43.position.copy(endpoint_leg_r_43.midpoint);
    mesh_leg_r_43.quaternion.copy(endpoint_leg_r_43.quaternion);
  }
  mesh_leg_r_43.castShadow = options.castShadow ?? true;
  mesh_leg_r_43.receiveShadow = options.receiveShadow ?? true;
  mesh_leg_r_43.userData.sculptComponent = {"id": "leg-r", "name": "Leg r", "level": "meso", "role": "limb", "importance": 0.7, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "capsule part for Leg r", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentSocket": "root-surface", "parentId": "root", "contactType": "socket", "embedDepth": 0.04, "gapTolerance": 0.01, "localStart": [-0.2, -1.0, 0.17], "localEnd": [-0.22, -1.5, 0.17], "notes": "limb spans socket on root", "baseRadius": 0.07, "endRadius": 0.065}, "dimensions": {"width": 0.13, "height": 0.5, "depth": 0.13, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.2, -1.0, 0.17], "rotation": [0, 0, 0], "scale": [0.13, 0.5, 0.13]}, "actionProfile": {"animationRole": "walk", "pivot": {"mode": "endpoint", "localPosition": [0, 0, 0], "axis": [1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "leg-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "limb-blue"}}, "material": "limb-blue", "materialLayers": ["limb-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 107, 224, 1.0)", "secondaryAlbedo": "rgba(11, 58, 158, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_leg_r_43.add(mesh_leg_r_43);
  meshes["leg-r"] = mesh_leg_r_43;
  colliders["leg-r"] = {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["leg-r"] ??= [];
  destructionGroups["leg-r"].push(node_leg_r_43);

  const endpoint_shoe_r_44 = makeAttachmentEndpoint(null);
  const node_shoe_r_44 = new THREE.Group();
  node_shoe_r_44.name = "Shoe r__pivot";
  node_shoe_r_44.scale.set(1, 1, 1);
  if (endpoint_shoe_r_44) {
    node_shoe_r_44.position.copy(endpoint_shoe_r_44.start);
    node_shoe_r_44.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_shoe_r_44.position.set(-0.03, -0.56, 0.09);
    node_shoe_r_44.rotation.set(0.0, 0.0, 0.0);
  }
  node_shoe_r_44.userData.sculptComponent = {"id": "shoe-r", "name": "Shoe r", "level": "micro", "role": "limb", "importance": 0.4, "confidence": 0.8, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "ellipsoid part for Shoe r", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "leg-r", "attachment": {"parentSocket": "leg-r-surface", "parentId": "leg-r", "contactType": "socket", "embedDepth": 0.03, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on leg-r; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.3, "height": 0.16, "depth": 0.44, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.03, -0.56, 0.09], "rotation": [0, 0, 0], "scale": [0.3, 0.16, 0.44]}, "actionProfile": {"animationRole": "walk", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shoe-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoe-dark"}}, "material": "shoe-dark", "materialLayers": ["shoe-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(20, 24, 32, 1.0)", "secondaryAlbedo": "rgba(20, 24, 32, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_shoe_r_44.userData.actionProfile = {"animationRole": "walk", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shoe-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoe-dark"}};
  (nodes["leg-r"] ?? root).add(node_shoe_r_44);
  nodes["shoe-r"] = node_shoe_r_44;
  const mesh_shoe_r_44Geometry = endpoint_shoe_r_44
    ? new THREE.CylinderGeometry(endpoint_shoe_r_44.endRadius, endpoint_shoe_r_44.baseRadius, endpoint_shoe_r_44.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_shoe_r_44) {
    mesh_shoe_r_44Geometry.scale(0.3, 0.16, 0.44);
  }
  const mesh_shoe_r_44 = new THREE.Mesh(
    mesh_shoe_r_44Geometry,
    materialMap["shoe-dark"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_shoe_r_44.name = "Shoe r";
  if (endpoint_shoe_r_44) {
    mesh_shoe_r_44.position.copy(endpoint_shoe_r_44.midpoint);
    mesh_shoe_r_44.quaternion.copy(endpoint_shoe_r_44.quaternion);
  }
  mesh_shoe_r_44.castShadow = options.castShadow ?? true;
  mesh_shoe_r_44.receiveShadow = options.receiveShadow ?? true;
  mesh_shoe_r_44.userData.sculptComponent = {"id": "shoe-r", "name": "Shoe r", "level": "micro", "role": "limb", "importance": 0.4, "confidence": 0.8, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "ellipsoid part for Shoe r", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "leg-r", "attachment": {"parentSocket": "leg-r-surface", "parentId": "leg-r", "contactType": "socket", "embedDepth": 0.03, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on leg-r; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.3, "height": 0.16, "depth": 0.44, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.03, -0.56, 0.09], "rotation": [0, 0, 0], "scale": [0.3, 0.16, 0.44]}, "actionProfile": {"animationRole": "walk", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shoe-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoe-dark"}}, "material": "shoe-dark", "materialLayers": ["shoe-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(20, 24, 32, 1.0)", "secondaryAlbedo": "rgba(20, 24, 32, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_shoe_r_44.add(mesh_shoe_r_44);
  meshes["shoe-r"] = mesh_shoe_r_44;
  colliders["shoe-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["shoe-r"] ??= [];
  destructionGroups["shoe-r"].push(node_shoe_r_44);

  const attachment_mouth_45 = {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"};
  const endpoint_mouth_45 = makeAttachmentEndpoint(attachment_mouth_45);
  const node_mouth_45 = new THREE.Group();
  node_mouth_45.name = "Mouth (stylized addition)__pivot";
  node_mouth_45.scale.set(1, 1, 1);
  if (endpoint_mouth_45) {
    node_mouth_45.position.copy(endpoint_mouth_45.start);
    node_mouth_45.rotation.set(0.0, 0.0, 1.5707963267948966);
  } else {
    node_mouth_45.position.set(0.0, -0.55, 0.11);
    node_mouth_45.rotation.set(0.0, 0.0, 1.5707963267948966);
  }
  node_mouth_45.userData.sculptComponent = {"id": "mouth", "name": "Mouth (stylized addition)", "level": "micro", "role": "face", "importance": 0.4, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "capsule part for Mouth (stylized addition)", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.2, "height": 0.26, "depth": 0.14, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.55, 0.11], "rotation": [0, 0, 1.5707963267948966], "scale": [0.2, 0.26, 0.14]}, "actionProfile": {"animationRole": "talk", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "mouth", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pupil-black"}}, "material": "pupil-black", "materialLayers": ["pupil-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(11, 11, 20, 1.0)", "secondaryAlbedo": "rgba(11, 11, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_mouth_45.userData.actionProfile = {"animationRole": "talk", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "mouth", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pupil-black"}};
  (nodes["grid-plate"] ?? root).add(node_mouth_45);
  nodes["mouth"] = node_mouth_45;
  const mesh_mouth_45Geometry = endpoint_mouth_45
    ? new THREE.CylinderGeometry(endpoint_mouth_45.endRadius, endpoint_mouth_45.baseRadius, endpoint_mouth_45.length, 16, 6)
    : buildWatertightCapsule(0.35, 0.7, 8, 16, 1);
  if (!endpoint_mouth_45) {
    mesh_mouth_45Geometry.scale(0.2, 0.26, 0.14);
  }
  const mesh_mouth_45 = new THREE.Mesh(
    mesh_mouth_45Geometry,
    materialMap["pupil-black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_mouth_45.name = "Mouth (stylized addition)";
  if (endpoint_mouth_45) {
    mesh_mouth_45.position.copy(endpoint_mouth_45.midpoint);
    mesh_mouth_45.quaternion.copy(endpoint_mouth_45.quaternion);
  }
  mesh_mouth_45.castShadow = options.castShadow ?? true;
  mesh_mouth_45.receiveShadow = options.receiveShadow ?? true;
  mesh_mouth_45.userData.sculptComponent = {"id": "mouth", "name": "Mouth (stylized addition)", "level": "micro", "role": "face", "importance": 0.4, "confidence": 0.8, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "Stylized addition requested by the user (not in the reference image).", "geometryDescriptor": {"topologyIntent": "capsule part for Mouth (stylized addition)", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "grid-plate", "attachment": {"parentSocket": "grid-plate-surface", "parentId": "grid-plate", "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "notes": "seated on grid-plate; zero-length endpoints keep the authored primitive"}, "dimensions": {"width": 0.2, "height": 0.26, "depth": 0.14, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.55, 0.11], "rotation": [0, 0, 1.5707963267948966], "scale": [0.2, 0.26, 0.14]}, "actionProfile": {"animationRole": "talk", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "mouth", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pupil-black"}}, "material": "pupil-black", "materialLayers": ["pupil-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(11, 11, 20, 1.0)", "secondaryAlbedo": "rgba(11, 11, 20, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "evidenceRef": "authored", "notes": "stylized addition not present in the reference; authored toy paint"}};
  node_mouth_45.add(mesh_mouth_45);
  meshes["mouth"] = mesh_mouth_45;
  colliders["mouth"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "proxy"};
  destructionGroups["mouth"] ??= [];
  destructionGroups["mouth"].push(node_mouth_45);

  // repetition system: data-pixels (InstancedMesh, radial, count=36, level=micro)
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
    const mat = materialMap["pixel-glow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    // Contract (PLAN_1.5 WS-E): instanceScale is ABSOLUTE, in the parent pivot's
    // local units -- it is never multiplied by the parent component's own declared
    // dimensional scale. This falls out of the same fix as componentTree: the pivot
    // Group this cluster is parented to always carries identity scale (dimensions are
    // baked into that component's OWN geometry, not exposed on the Group), so an
    // instanced fastener/tooth/spoke sized [0.05, 0.05, 0.05] renders at exactly that
    // size regardless of how non-uniformly its host component is shaped, and a
    // `radial` ring's placement stays circular instead of being squashed into an
    // ellipse by a non-uniform host.
    const scl = [0.07, 0.07, 0.02];
    const axis = new THREE.Vector3(0.0, 0.0, 1.0).normalize();
    const radius = 6.2;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    // One InstancedMesh = one draw call for all repeated parts (teeth/fasteners/spokes),
    // replacing the former per-instance Mesh clone loop (real-time perf principle).
    const cluster = new THREE.InstancedMesh(geo, mat, 36);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 36; i++) {
      const ang = ((5.0) + (i * 360) / 36) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "data-pixels";
    parent.add(cluster);
  }

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createShieldMascotLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Shield Mascot look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [{"id": "key", "type": "directional", "role": "key", "direction": [3, 5, 8], "color": "#ffffff", "intensity": 1.3, "evidence": "specular hotspots on upper observer-left of plate"}, {"id": "fill-blue", "type": "point", "role": "fill", "position": [4, 3, 3], "color": "#1f8bff", "intensity": 60, "evidence": "blue glow wash on rim and right side"}, {"id": "rim-orange", "type": "point", "role": "rim", "position": [-4, -3, 3], "color": "#ff7a00", "intensity": 45, "evidence": "orange glow along lower edges"}, {"id": "ambient", "type": "ambient", "role": "environment", "color": "#223355", "intensity": 0.35, "evidence": "dark navy backdrop"}, {"id": "exposure", "type": "renderer", "role": "exposure", "toneMapping": "ACES filmic tone mapping, exposure 1.0; emissive parts read as glow against a dark backdrop", "shadow": "floating emblem, no ground plane; contact shadow under shoes only when a floor is shown; ambient occlusion via darker keyhole inlay"}];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createShieldMascotEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameShieldMascotCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createShieldMascotPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureShieldMascotRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createShieldMascotInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
