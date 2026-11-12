// The Flappy Bird rules of files/flappy.bas (36 x 32 cells), with an autopilot that plays it for the video.
export const W = 36, H = 32, GROUND = 28, BIRDX = 8, PIPEW = 4, GAP = 9, SPACING = 14, NP = 3;
const GRAVITY = 0.11, FLAP = -1.05, MAXFALL = 1.3;
const GAPS = [11, 8, 12, 9, 13, 10, 7, 11, 14, 10, 12, 8];

export type State = {birdY: number; vy: number; px: number[]; gap: number[]; passed: boolean[]; score: number; tick: number; dead: boolean; flap: boolean; next: number};

const step = (s: State, flap: boolean): State => {
  if (s.dead) return {...s, flap: false};
  const px = [...s.px], gap = [...s.gap], passed = [...s.passed];
  let {birdY, vy, score, next} = s;
  let dead = false;
  if (flap) vy = FLAP;
  vy = Math.min(MAXFALL, vy + GRAVITY);
  birdY += vy;
  for (let i = 0; i < NP; i++) {
    px[i] -= 0.5;
    if (px[i] < -PIPEW) {px[i] += NP * SPACING; gap[i] = GAPS[next++ % GAPS.length]; passed[i] = false;}
    if (!passed[i] && px[i] + PIPEW < BIRDX) {passed[i] = true; score++;}
  }
  const by = Math.floor(birdY);
  if (by < 0 || by + 1 >= GROUND) dead = true;
  for (let i = 0; i < NP; i++) {
    const col = Math.floor(px[i]);
    if (BIRDX + 2 >= col && BIRDX <= col + PIPEW - 1) {
      for (let yy = by; yy <= by + 1; yy++) if (yy < gap[i] || yy >= gap[i] + GAP) dead = true;
    }
  }
  return {birdY, vy, px, gap, passed, score, tick: s.tick + 1, dead, flap, next};
};

// can the bird stay alive for n more frames from s? (a flap needs 4 frames of rest; no flap is tried first)
const alive = (s: State, n: number, rest: number): boolean => {
  if (s.dead) return false;
  if (n === 0) return true;
  if (alive(step(s, false), n - 1, Math.max(0, rest - 1))) return true;
  return rest === 0 && alive(step(s, true), n - 1, 4);
};
export const simulate = (frames: number, stopHelpingAt: number): State[] => {
  let s: State = {birdY: 12, vy: 0, px: [W + 2 - 20, W + 2 - 6, W + 2 + 8], gap: [GAPS[0], GAPS[1], GAPS[2]], passed: [false, false, false],
    score: 0, tick: 0, dead: false, flap: false, next: 3};
  const out: State[] = [];
  for (let f = 0; f < frames; f++) {
    let flap = false;
    if (f < stopHelpingAt && !s.dead) {
      flap = !alive(step(s, false), 36, 0) && alive(step(s, true), 36, 4);
    }
    s = step(s, flap);
    out.push(s);
  }
  return out;
};
