// A TypeScript port of files/breakout.bas (same grid, same bounce rules), driven by an autopilot paddle,
// so what the video shows is exactly what the free file does.
export const W = 40, H = 36, BR = 6, BC = 10, BW = 4, BH = 2, BY0 = 4, PY = 33, PW = 7;
export const ROWCOL = ['#ff4060', '#ff8c32', '#ffd23c', '#50dc6e', '#3cbeff', '#aa6eff'];

export type Hit = {r: number; c: number};
export type State = {bricks: boolean[]; bx: number; by: number; dx: number; dy: number; px: number; stuck: boolean;
  score: number; key: number; hit: Hit | null; bounce: 'wall' | 'brick' | 'paddle' | null};

const brickAt = (b: boolean[], x: number, y: number) => {
  if (y < BY0 || y >= BY0 + BR * BH || x < 0 || x >= W) return -1;
  const id = Math.floor((y - BY0) / BH) * BC + Math.floor(x / BW);
  return b[id] ? id : -1;
};
const solid = (x: number, y: number) => x < 0 || x >= W || y < 0;

export const simulate = (ticks: number, launchAt = 6): State[] => {
  let s: State = {bricks: new Array(BR * BC).fill(true), bx: 0, by: PY - 1, dx: 1, dy: -1, px: Math.floor((W - PW) / 2), stuck: true,
    score: 0, key: -1, hit: null, bounce: null};
  s.bx = s.px + Math.floor(PW / 2);
  const out: State[] = [s];
  for (let t = 1; t <= ticks; t++) {
    const n: State = {...s, bricks: [...s.bricks], hit: null, bounce: null};
    // autopilot: aim so the ball meets the paddle off-centre, which changes its direction now and then
    const aim = n.bx + n.dx * (n.dy > 0 ? Math.max(0, PY - n.by - 1) : 0) - (t % 3 === 0 ? 1 : t % 3 === 1 ? 5 : 3);
    n.key = n.stuck ? -1 : aim < n.px - 1 ? 0 : aim > n.px + 1 ? 1 : -1;
    if (n.key === 0) n.px -= 2;
    if (n.key === 1) n.px += 2;
    n.px = Math.max(0, Math.min(W - PW, n.px));
    if (n.stuck) {
      n.bx = n.px + Math.floor(PW / 2); n.by = PY - 1;
      if (t >= launchAt) n.stuck = false;
      out.push(n); s = n; continue;
    }
    const kill = (id: number) => {n.bricks[id] = false; n.score += 10 * (BR - Math.floor(id / BC)); n.hit = {r: Math.floor(id / BC), c: id % BC}; n.bounce = 'brick';};
    let hx = false, hy = false;
    const nx = n.bx + n.dx;
    if (solid(nx, n.by)) {n.dx = -n.dx; hx = true; n.bounce = 'wall';}
    else {const id = brickAt(n.bricks, nx, n.by); if (id >= 0) {kill(id); n.dx = -n.dx; hx = true;}}
    const ny = n.by + n.dy;
    if (solid(n.bx, ny)) {n.dy = -n.dy; hy = true; n.bounce = n.bounce ?? 'wall';}
    else {const id = brickAt(n.bricks, n.bx, ny); if (id >= 0) {kill(id); n.dy = -n.dy; hy = true;}}
    if (!hx && !hy) {const id = brickAt(n.bricks, n.bx + n.dx, n.by + n.dy); if (id >= 0) {kill(id); n.dx = -n.dx; n.dy = -n.dy;}}
    if (n.dy === 1 && n.by + n.dy === PY && n.bx + n.dx >= n.px && n.bx + n.dx < n.px + PW) {
      const off = n.bx + n.dx - n.px;
      if (off <= 1) n.dx = -1; else if (off >= PW - 2) n.dx = 1;
      n.dy = -1; n.bounce = 'paddle';
    }
    n.bx = Math.max(0, Math.min(W - 1, n.bx + n.dx));
    n.by = Math.max(0, n.by + n.dy);
    if (n.by >= H - 1) {n.stuck = true; n.bx = n.px + Math.floor(PW / 2); n.by = PY - 1; n.dx = 1; n.dy = -1;}
    out.push(n); s = n;
  }
  return out;
};
