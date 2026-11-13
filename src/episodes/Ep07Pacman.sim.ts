// The Pac-Man rules of files/pacman.bas (19 x 21 tiles, one cell per tile), with an autopilot that plays
// it for the video. Same maze, same speeds, same ghost brain: every tick a breadth-first search floods the
// maze from Pac-Man (distance in steps written into every open cell) and each ghost steps to the neighbour
// with the smallest number — the shortest path to you. Frightened ghosts take the biggest number instead.
export const MAZE = [
  '###################',
  '#........#........#',
  '#o##.###.#.###.##o#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.###.#.###.####',
  '   #.#.......#.#   ',
  '####.#.##-##.#.####',
  '......##GGG##......',
  '####.#.#####.#.####',
  '   #.#.......#.#   ',
  '####.#.#####.#.####',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o.#.....P.....#.o#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '#.######.#.######.#',
  '#.................#',
  '###################',
];
export const W = 19, H = 21;
export const FRIGHT = 40;           // ticks the ghosts stay blue after a power pellet
const RELEASE = [0, 12, 30, 50];   // tick each ghost leaves the house
const START_G = [[9, 7], [8, 9], [9, 9], [10, 9]];
const START_P = [9, 15];
const HOME = [9, 9];
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1]; // 0 right, 1 down, 2 left, 3 up (same order as the VBA)

export type Ghost = {x: number; y: number; d: number; mode: 'house' | 'chase' | 'fright' | 'eyes'; slow: number};
export type State = {
  px: number; py: number; pd: number; dots: string[]; score: number; lives: number; tick: number;
  fright: number; ghosts: Ghost[]; dist: number[]; eaten: number; event: '' | 'dot' | 'pellet' | 'ghost' | 'death';
};

const wall = (x: number, y: number) => y < 0 || y >= H || MAZE[y][(x + W) % W] === '#';
const pacOpen = (x: number, y: number) => !wall(x, y) && !'-G'.includes(MAZE[y][(x + W) % W]);
const wrap = (x: number) => (x + W) % W;

// Breadth-first flood from (sx, sy): steps to every tile a ghost can stand on. -1 = unreachable.
export const flood = (sx: number, sy: number): number[] => {
  const d = new Array(W * H).fill(-1);
  const q: number[] = [sy * W + sx];
  d[sy * W + sx] = 0;
  for (let h = 0; h < q.length; h++) {
    const x = q[h] % W, y = Math.floor(q[h] / W);
    for (let k = 0; k < 4; k++) {
      const nx = wrap(x + DX[k]), ny = y + DY[k];
      if (wall(nx, ny) || d[ny * W + nx] >= 0) continue;
      d[ny * W + nx] = d[y * W + x] + 1;
      q.push(ny * W + nx);
    }
  }
  return d;
};
const HOMEDIST = flood(HOME[0], HOME[1]);

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

const initial = (): State => {
  const dots: string[] = MAZE.map((r) => r.replace(/[PG\-]/g, (c) => (c === '-' ? '-' : ' ')));
  return {
    px: START_P[0], py: START_P[1], pd: 2, dots, score: 0, lives: 3, tick: 0, fright: 0,
    ghosts: START_G.map(([x, y], i) => ({x, y, d: 3, mode: i === 0 ? 'chase' : 'house', slow: 0})),
    dist: flood(START_P[0], START_P[1]), eaten: 0, event: '',
  };
};

// Ghost step: among the open neighbours (no U-turn unless stuck) take the smallest distance to Pac-Man,
// or the largest when frightened, or the way home when only the eyes are left.
const moveGhost = (g: Ghost, i: number, dist: number[]): Ghost => {
  if (g.mode === 'house') return g;
  if (g.mode === 'fright' && (g.slow = 1 - g.slow) === 1) return g; // blue ghosts move every other tick
  const field = g.mode === 'eyes' ? HOMEDIST : dist;
  let best = -1, bestV = g.mode === 'fright' ? -1 : 1e9;
  const opts: number[] = [];
  for (let k = 0; k < 4; k++) {
    const nx = wrap(g.x + DX[k]), ny = g.y + DY[k];
    if (wall(nx, ny)) continue;
    if (g.mode !== 'eyes' && MAZE[ny][nx] === '-' && DY[k] > 0) continue; // never back into the house
    if ((k + 2) % 4 === g.d) continue;
    opts.push(k);
    const v = field[ny * W + nx];
    if (g.mode === 'fright' ? v > bestV : v < bestV) {bestV = v; best = k;}
  }
  if (opts.length === 0) best = (g.d + 2) % 4;
  else if (i > 0 && g.mode === 'chase' && rnd() < 0.2) best = opts[Math.floor(rnd() * opts.length)]; // a little personality
  const x = wrap(g.x + DX[best]), y = g.y + DY[best];
  let mode = g.mode;
  if (mode === 'eyes' && x === HOME[0] && y === HOME[1]) mode = 'chase';
  return {...g, x, y, d: best, mode};
};

// One tick of the game. want = the arrow key held (0..3) or -1.
export const step = (s0: State, want: number): State => {
  const s: State = {...s0, ghosts: s0.ghosts.map((g) => ({...g})), dots: [...s0.dots], event: '', tick: s0.tick + 1};
  if (want >= 0 && pacOpen(s.px + DX[want], s.py + DY[want])) s.pd = want;
  if (pacOpen(s.px + DX[s.pd], s.py + DY[s.pd])) {s.px = wrap(s.px + DX[s.pd]); s.py += DY[s.pd];}
  const c = s.dots[s.py][s.px];
  if (c === '.' || c === 'o') {
    s.dots[s.py] = s.dots[s.py].slice(0, s.px) + ' ' + s.dots[s.py].slice(s.px + 1);
    s.score += c === '.' ? 10 : 50;
    s.event = c === '.' ? 'dot' : 'pellet';
    if (c === 'o') {
      s.fright = FRIGHT; s.eaten = 0;
      s.ghosts.forEach((g) => {if (g.mode === 'chase') {g.mode = 'fright'; g.d = (g.d + 2) % 4; g.slow = 0;}});
    }
  }
  if (s.fright > 0 && --s.fright === 0) s.ghosts.forEach((g) => {if (g.mode === 'fright') g.mode = 'chase';});
  s.ghosts.forEach((g, i) => {if (g.mode === 'house' && s.tick >= RELEASE[i]) {g.mode = 'chase'; g.x = 9; g.y = 7; g.d = 2;}});
  const prev = s.ghosts.map((g) => [g.x, g.y]);
  s.dist = flood(s.px, s.py);
  s.ghosts = s.ghosts.map((g, i) => moveGhost(g, i, s.dist));
  // collisions: same tile, or Pac-Man and a ghost swapped tiles this tick
  for (let i = 0; i < 4; i++) {
    const g = s.ghosts[i];
    const hit = (g.x === s.px && g.y === s.py) || (prev[i][0] === s.px && prev[i][1] === s.py && g.x === s0.px && g.y === s0.py);
    if (!hit || g.mode === 'eyes' || g.mode === 'house') continue;
    if (g.mode === 'fright') {s.eaten++; s.score += 100 * 2 ** s.eaten; g.mode = 'eyes'; s.event = 'ghost';}
    else {
      s.lives--; s.event = 'death';
      s.px = START_P[0]; s.py = START_P[1]; s.pd = 2; s.fright = 0;
      s.ghosts = START_G.map(([x, y], j) => ({x, y, d: 3, mode: j === 0 ? 'chase' : 'house', slow: 0}));
      s.tick = 0;
      break;
    }
  }
  if (!s.dots.some((r) => /[.o]/.test(r))) s.dots = initial().dots;
  return s;
};

// Autopilot for the video: BFS to the nearest dot (or the nearest blue ghost) that does not walk next to a
// chasing ghost.
const pilot = (s: State): number => {
  const danger = new Set<number>();
  s.ghosts.forEach((g) => {
    if (g.mode !== 'chase') return;
    danger.add(g.y * W + g.x);
    for (let k = 0; k < 4; k++) danger.add((g.y + DY[k]) * W + wrap(g.x + DX[k]));
  });
  const first = new Array(W * H).fill(-1);
  const seen = new Array(W * H).fill(false);
  const q: number[] = [];
  seen[s.py * W + s.px] = true;
  for (let k = 0; k < 4; k++) {
    const nx = wrap(s.px + DX[k]), ny = s.py + DY[k];
    if (!pacOpen(nx, ny) || danger.has(ny * W + nx)) continue;
    seen[ny * W + nx] = true; first[ny * W + nx] = k; q.push(ny * W + nx);
  }
  const blue = new Set(s.ghosts.filter((g) => g.mode === 'fright').map((g) => g.y * W + g.x));
  for (let h = 0; h < q.length; h++) {
    const x = q[h] % W, y = Math.floor(q[h] / W);
    const c = s.dots[y][x];
    if (blue.size ? blue.has(q[h]) : c === '.' || c === 'o') return first[q[h]];
    for (let k = 0; k < 4; k++) {
      const nx = wrap(x + DX[k]), ny = y + DY[k];
      if (!pacOpen(nx, ny) || seen[ny * W + nx] || danger.has(ny * W + nx)) continue;
      seen[ny * W + nx] = true; first[ny * W + nx] = first[q[h]]; q.push(ny * W + nx);
    }
  }
  return q.length ? first[q[0]] : -1;
};

export const simulate = (ticks: number): {states: State[]; keys: number[]} => {
  seed = 7;
  const states = [initial()];
  const keys: number[] = [-1];
  for (let i = 0; i < ticks; i++) {
    const k = pilot(states[i]);
    keys.push(k);
    states.push(step(states[i], k));
  }
  return {states, keys};
};
