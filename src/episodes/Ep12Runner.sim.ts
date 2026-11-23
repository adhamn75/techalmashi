// Same level and physics as files/platformer.bas (BuildLevel / StepGame), so what the video shows is what the file does.
export const W = 48, H = 27, LW = 200, HW = 2, HH = 3;
export const G = 0.22, JUMP = -1.8, RUN = 0.55, VMAX = 1.2;
// tiles: 0 air, 1 ground, 2 brick, 3 coin, 4 flag, 5 spike
export const makeLevel = (): Uint8Array[] => {
  const t = Array.from({length: LW}, () => new Uint8Array(H));
  const fill = (x0: number, y0: number, x1: number, y1: number, v: number) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (x >= 0 && x < LW && y >= 0 && y < H) t[x][y] = v;
  };
  fill(0, H - 3, LW - 1, H - 1, 1);
  for (const x of [30, 59, 92, 127, 160]) fill(x, H - 3, x + 3 + (x % 2), H - 1, 0);
  const P = [14, 19, 6, 24, 15, 5, 40, 18, 8, 52, 14, 6, 66, 19, 5, 74, 15, 7, 86, 12, 6,
    100, 18, 9, 114, 14, 6, 122, 10, 5, 138, 17, 7, 150, 13, 6, 168, 18, 8, 178, 14, 5];
  for (let i = 0; i < P.length; i += 3) {
    fill(P[i], P[i + 1], P[i] + P[i + 2] - 1, P[i + 1], 2);
    fill(P[i] + 1, P[i + 1] - 2, P[i] + P[i + 2] - 2, P[i + 1] - 2, 3);
    for (let x = P[i] + 2; x <= P[i] + P[i + 2] - 3; x += 2) t[x][P[i + 1] - 2] = 0;
  }
  for (const x of [46, 47, 80, 81, 108, 109, 145, 146, 186]) t[x][H - 4] = 5;
  for (const x of [30, 59, 92, 127, 160]) [0, 1, 2, 1, 0].forEach((o, i) => (t[x + i][H - 7 - o] = 3));
  fill(LW - 6, H - 14, LW - 6, H - 4, 4);
  return t;
};

export type State = {
  hx: number; hy: number; vx: number; vy: number; on: boolean; face: number; tick: number;
  score: number; coins: number; got: string[]; jumpStart: number; lives: number;
};

const solid = (t: Uint8Array[], x: number, y: number) => (x < 0 || x >= LW ? true : y < 0 || y >= H ? false : t[x][y] === 1 || t[x][y] === 2);
const hits = (t: Uint8Array[], x: number, y: number) => {
  for (let cx = Math.floor(x); cx <= Math.floor(x + HW - 0.001); cx++)
    for (let cy = Math.floor(y); cy <= Math.floor(y + HH - 0.001); cy++) if (solid(t, cx, cy)) return true;
  return false;
};

// autopilot: always runs right, jumps over pits/spikes and onto chosen platforms
const wantJump = (t: Uint8Array[], s: State, forced: Set<number>) => {
  if (!s.on) return false;
  if (forced.has(s.tick)) return true;
  const fx = Math.floor(s.hx + HW);
  for (let d = 1; d <= 2; d++) {
    const x = fx + d;
    if (x < LW && (t[x][H - 3] === 0 || t[x][H - 4] === 5)) return true;
  }
  return false;
};

export const simulate = (ticks: number, forced: number[] = []) => {
  const t = makeLevel();
  const F = new Set(forced);
  const s: State = {hx: 4, hy: H - 3 - HH, vx: 0, vy: 0, on: true, face: 1, tick: 0, score: 0, coins: 0, got: [], jumpStart: -1, lives: 3};
  const out: {s: State; tiles: Uint8Array[]}[] = [];
  const snapshot = () => ({s: {...s, got: [...s.got]}, tiles: t.map((c) => c.slice())});
  out.push(snapshot());
  for (let k = 0; k < ticks; k++) {
    s.tick++;
    s.vx = RUN; s.face = 1;
    if (wantJump(t, s, F)) {s.vy = JUMP; s.jumpStart = s.tick;}
    s.vy = Math.min(VMAX, s.vy + G);
    let nx = s.hx + s.vx;
    if (hits(t, nx, s.hy)) nx = s.vx > 0 ? Math.floor(nx + HW - 0.001) - HW : Math.floor(nx) + 1;
    s.hx = nx;
    let ny = s.hy + s.vy;
    s.on = false;
    if (hits(t, s.hx, ny)) {
      if (s.vy > 0) {ny = Math.floor(ny + HH - 0.001) - HH; s.on = true;} else ny = Math.floor(ny) + 1;
      s.vy = 0;
    }
    s.hy = ny;
    for (let cx = Math.floor(s.hx); cx <= Math.floor(s.hx + HW - 0.001); cx++)
      for (let cy = Math.floor(s.hy); cy <= Math.floor(s.hy + HH - 0.001); cy++)
        if (cx >= 0 && cx < LW && cy >= 0 && cy < H && t[cx][cy] === 3) {t[cx][cy] = 0; s.score += 10; s.coins++; s.got.push(`${s.tick}:${cx}:${cy}`);}
    if (s.hy > H) {s.lives--; s.hx = 4; s.hy = H - 3 - HH; s.vy = 0;}
    out.push(snapshot());
  }
  return out;
};
