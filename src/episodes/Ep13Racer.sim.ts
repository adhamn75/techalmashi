// Same road, traffic and rules as files/racing.bas (StepGame / Spawn / Compose), so the video plays what the file plays.
// Only Rnd is replaced by a seeded generator, and an autopilot holds Left/Right the way a player would.
export const W = 26, H = 40, RL = 3, LANES = 4, LW = 5, CW = 3, CH = 5, NT = 8;
export const V0 = 0.45, ACC = 0.0009, VMAX = 1.6;

export type Car = {x: number; y: number; c: string; on: boolean; id: number};
export type State = {px: number; py: number; speed: number; roadY: number; dist: number; score: number; tick: number;
  cars: Car[]; crashed: boolean; key: number; passed: number};

export const laneX = (l: number) => RL + l * LW + 1;
export const overlap = (ax: number, ay: number, bx: number, by: number) => ax < bx + CW && bx < ax + CW && ay < by + CH && by < ay + CH;
const COLS = ['#3c8cff', '#ffc828', '#965ae6', '#28c896', '#ff8228', '#ebebeb'];

const rng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// autopilot: steer toward the lane whose next car is farthest away (what a player does with the arrows)
const pilot = (s: State): number => {
  const gapIn = (lx: number) => {
    let g = 999;
    for (const c of s.cars) if (c.on && c.x === lx && c.y < s.py + CH) g = Math.min(g, s.py - (c.y + CH));
    return g;
  };
  const busyBeside = (lx: number) => s.cars.some((c) => c.on && c.x === lx && c.y > s.py - CH - 4 && c.y < s.py + CH + 1);
  const cur = Math.max(0, Math.min(LANES - 1, Math.round((s.px - RL - 1) / LW)));
  const score = (l: number) => gapIn(laneX(l)) - Math.abs(l - 1.5) * 2 - Math.abs(l - cur) * 3;
  let best = cur;
  if (gapIn(laneX(cur)) < 22 || s.px !== laneX(cur)) {
    for (let l = 0; l < LANES; l++) {
      let ok = true;
      for (let m = Math.min(l, cur); m <= Math.max(l, cur); m++) if (m !== cur && busyBeside(laneX(m))) ok = false;
      if (ok && score(l) > score(best)) best = l;
    }
  }
  const tx = laneX(best);
  const side = (dx: number) => s.cars.some((c) => c.on && overlap(s.px + dx, s.py, c.x, c.y));
  if (tx < s.px && !side(-1)) return 0;
  if (tx > s.px && !side(1)) return 1;
  return -1;
};

export const simulate = (n: number, seed = 13): State[] => {
  const r = rng(seed);
  let id = 0;
  const s: State = {px: laneX(1), py: H - CH - 3, speed: V0, roadY: 0, dist: 0, score: 0, tick: 0,
    cars: Array.from({length: NT}, () => ({x: 0, y: 0, c: '', on: false, id: -1})), crashed: false, key: -1, passed: 0};
  let nextSpawn = 4;
  const spawn = () => {
    const i = s.cars.findIndex((c) => !c.on);
    if (i < 0) return;
    for (let tries = 0; tries < 6; tries++) {
      const lane = Math.floor(r() * LANES);
      let ok = true, free = 0;
      for (const c of s.cars) if (c.on && c.y < CH * 2) {if (c.x === laneX(lane)) ok = false; free++;}
      if (ok && free < LANES - 1) {s.cars[i] = {on: true, x: laneX(lane), y: -CH, c: COLS[Math.floor(r() * 6)], id: id++}; return;}
    }
  };
  const out: State[] = [];
  for (let k = 0; k < n; k++) {
    out.push({...s, cars: s.cars.map((c) => ({...c}))});
    if (s.crashed) continue;
    const key = pilot(s);
    s.key = key;
    s.tick++;
    s.speed = Math.min(VMAX, s.speed + ACC);
    if (key === 0 && s.px > RL) s.px--;
    if (key === 1 && s.px < RL + LANES * LW - CW) s.px++;
    s.roadY += s.speed;
    if (s.roadY >= 720) s.roadY -= 720;
    s.dist += s.speed;
    s.score = Math.floor(s.dist) + s.passed * 5;
    for (const c of s.cars) if (c.on) {
      c.y += s.speed * 0.62;
      if (c.y > H) {c.on = false; s.passed++;}
      if (overlap(s.px, s.py, c.x, c.y)) s.crashed = true;
    }
    if (s.dist >= nextSpawn) {spawn(); nextSpawn = s.dist + 16 + r() * 14 - s.speed * 4;}
  }
  return out;
};
