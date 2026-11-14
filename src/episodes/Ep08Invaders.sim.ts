// Space Invaders rules shared with files/invaders.bas (37 x 36 cells, one cell = one pixel).
// The video drives the cannon with an autopilot; the file reads the arrow keys and Space.

export const W = 37;
export const H = 36;
export const PY = 34;           // cannon rows 34-35
export const BUNKER_Y = 29;     // bunker rows 29-31
export const INV_COLS = 5;
export const INV_ROWS = 4;
export const SX = 7;            // invader spacing (5 wide + 2 gap)
export const SY = 4;            // 3 tall + 1 gap

// 5 x 3 sprites, two animation frames each. Row types: squid, crab, crab, octopus.
export const SPRITES: string[][][] = [
  [['..#..', '.###.', '#.#.#'], ['..#..', '.###.', '.#.#.']],
  [['.#.#.', '#####', '#...#'], ['.#.#.', '#####', '.#.#.']],
  [['.#.#.', '#####', '#...#'], ['.#.#.', '#####', '.#.#.']],
  [['#####', '#.#.#', '#...#'], ['#####', '#.#.#', '.#.#.']],
];
export const CANNON = ['..#..', '#####'];
export const UFO = ['.###.', '#.#.#'];
export const BUNKER = ['.####.', '######', '##..##'];
export const BUNKER_X = [3, 12, 20, 28];
export const POINTS = [30, 20, 20, 10];

export type Boom = {x: number; y: number; t: number; big: boolean};
export type State = {
  alive: boolean[];            // INV_ROWS * INV_COLS
  fx: number; fy: number; dir: number; anim: number;
  px: number;                  // cannon left column
  shot: {x: number; y: number} | null;
  bombs: {x: number; y: number}[];
  bunker: number[];            // hp per cell (W*H), 0 = gone
  ufo: number | null;          // left column of the saucer on row 1
  booms: Boom[];
  score: number; hits: number; tick: number;
  key: number;                 // -1 none, 0 left, 1 right
  fire: boolean;               // Space pressed this tick
  event: '' | 'kill' | 'ufo' | 'fire' | 'bunker';
};

const stepEvery = (n: number) => 3 + Math.floor(n / 3);

export const invaderCells = (s: State) => {
  const out: {x: number; y: number; r: number; c: number}[] = [];
  for (let r = 0; r < INV_ROWS; r++) for (let c = 0; c < INV_COLS; c++) {
    if (!s.alive[r * INV_COLS + c]) continue;
    const ox = s.fx + c * SX, oy = s.fy + r * SY;
    SPRITES[r][s.anim].forEach((row, dy) => row.split('').forEach((ch, dx) => {if (ch === '#') out.push({x: ox + dx, y: oy + dy, r, c});}));
  }
  return out;
};

const freshBunkers = () => {
  const b = new Array(W * H).fill(0);
  for (const bx of BUNKER_X) BUNKER.forEach((row, dy) => row.split('').forEach((ch, dx) => {if (ch === '#') b[(BUNKER_Y + dy) * W + bx + dx] = 2;}));
  return b;
};

export const simulate = (ticks: number): State[] => {
  let seed = 7;
  const rnd = (n: number) => {seed = (seed * 75 + 74) % 65537; return seed % n;};
  let s: State = {
    alive: new Array(INV_ROWS * INV_COLS).fill(true), fx: 2, fy: 4, dir: 1, anim: 0, px: 16, shot: null, bombs: [],
    bunker: freshBunkers(), ufo: null, booms: [], score: 0, hits: 0, tick: 0, key: -1, fire: false, event: '',
  };
  const out: State[] = [s];
  for (let t = 1; t <= ticks; t++) {
    const n: State = {...s, alive: [...s.alive], bombs: s.bombs.map((b) => ({...b})), bunker: [...s.bunker], shot: s.shot && {...s.shot},
      booms: s.booms.map((b) => ({...b, t: b.t + 1})).filter((b) => b.t < 6), tick: t, key: -1, fire: false, event: ''};
    const inv = invaderCells(n);
    const nAlive = n.alive.filter(Boolean).length;

    // --- autopilot (the file reads the keys here instead)
    const cx = n.px + 2;
    const danger = n.bombs.find((b) => b.y >= PY - 9 && b.x >= n.px - 1 && b.x <= n.px + 5);
    if (danger) n.key = danger.x >= cx ? (n.px > 0 ? 0 : 1) : (n.px < W - 5 ? 1 : 0);
    else if (inv.length) {
      // aim at the column of the lowest invader nearest to the cannon
      const low = Math.max(...inv.map((c) => c.y));
      const cand = inv.filter((c) => c.y >= low - 6);
      const tx = cand.reduce((a, c) => (Math.abs(c.x - cx) < Math.abs(a - cx) ? c.x : a), cand[0].x);
      if (tx < cx) n.key = 0; else if (tx > cx) n.key = 1;
      if (!n.shot && Math.abs(tx - cx) <= 1 && t % 2 === 0) n.fire = true;
    }
    if (!n.shot && n.ufo !== null && Math.abs(n.ufo + 2 - 16 - cx) <= 1) n.fire = true;

    // --- cannon
    if (n.key === 0 && n.px > 0) n.px--;
    if (n.key === 1 && n.px < W - 5) n.px++;
    if (n.fire && !n.shot) {n.shot = {x: n.px + 2, y: PY - 1}; n.event = 'fire';}

    // --- invaders march (edge check on living invaders only)
    if (t % stepEvery(nAlive) === 0 && inv.length) {
      const minX = Math.min(...inv.map((c) => c.x)), maxX = Math.max(...inv.map((c) => c.x));
      if ((n.dir > 0 && maxX + 1 >= W) || (n.dir < 0 && minX - 1 < 0)) {n.fy++; n.dir = -n.dir;}
      else n.fx += n.dir;
      n.anim = 1 - n.anim;
    }

    // --- saucer
    if (n.ufo === null && t % 120 === 60) n.ufo = W - 1;
    else if (n.ufo !== null) {n.ufo--; if (n.ufo < -5) n.ufo = null;}

    // --- bombs: from the bottom invader of a random column
    if (t % 9 === 0 && n.bombs.length < 3) {
      const cols = [...new Set(invaderCells(n).map((c) => c.c))];
      if (cols.length) {
        const col = cols[rnd(cols.length)];
        const cells = invaderCells(n).filter((c) => c.c === col);
        const by = Math.max(...cells.map((c) => c.y));
        n.bombs.push({x: n.fx + col * SX + 2, y: by + 1});
      }
    }
    n.bombs = n.bombs.filter((b) => {
      b.y++;
      if (b.y >= H) return false;
      const i = b.y * W + b.x;
      if (n.bunker[i] > 0) {n.bunker[i]--; return false;}
      return true;
    });

    // --- the shot: two cells per tick
    for (let k = 0; k < 2 && n.shot; k++) {
      n.shot.y--;
      const {x, y} = n.shot;
      if (y < 0) {n.shot = null; break;}
      const i = y * W + x;
      if (n.bunker[i] > 0) {n.bunker[i]--; n.shot = null; n.event = 'bunker'; break;}
      const hit = invaderCells(n).find((c) => c.x === x && c.y === y);
      if (hit) {
        n.alive[hit.r * INV_COLS + hit.c] = false;
        n.score += POINTS[hit.r]; n.hits++;
        n.booms.push({x: n.fx + hit.c * SX, y: n.fy + hit.r * SY, t: 0, big: false});
        n.shot = null; n.event = 'kill'; break;
      }
      if (n.ufo !== null && y <= 2 && y >= 1 && x >= n.ufo && x < n.ufo + 5) {
        n.score += 300; n.hits++;
        n.booms.push({x: n.ufo, y: 1, t: 0, big: true});
        n.ufo = null; n.shot = null; n.event = 'ufo'; break;
      }
      const bi = n.bombs.findIndex((b) => b.x === x && (b.y === y || b.y === y + 1));
      if (bi >= 0) {n.bombs.splice(bi, 1); n.shot = null; break;}
    }

    // --- new wave
    if (!n.alive.some(Boolean)) {n.alive = n.alive.map(() => true); n.fx = 2; n.fy = 4; n.dir = 1;}
    out.push(n);
    s = n;
  }
  return out;
};
