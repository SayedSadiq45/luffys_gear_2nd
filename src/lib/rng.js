/**
 * Seeded RNG. Every random-looking thing in this experience is generated from a
 * fixed seed so the scene is byte-identical on every render, and so any value
 * derived from scroll progress can be replayed backwards. `Math.random()` would
 * make the timeline non-reversible.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic "random" in [0,1) for an integer step. Used for strobe/flicker:
 * quantise progress into steps, look the step up here, and the flicker is both
 * chaotic-looking and perfectly repeatable when scrubbing back.
 */
export function hashStep(n, seed = 0) {
  let t = (Math.imul(n ^ seed, 0x9e3779b1) ^ (seed * 0x85ebca6b)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Midpoint-displacement fractal bolt between two points, returned as points.
 * Ported from the reference implementation, but fed a seeded RNG.
 */
export function boltPoints(x1, y1, x2, y2, rough, rand, iterations = 6) {
  let pts = [
    { x: x1, y: y1 },
    { x: x2, y: y2 },
  ];
  let off = rough;
  for (let it = 0; it < iterations; it++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      next.push({
        x: (a.x + b.x) / 2 + (rand() - 0.5) * off,
        y: (a.y + b.y) / 2 + (rand() - 0.5) * off * 0.35,
      });
      next.push(b);
    }
    pts = next;
    off *= 0.5;
  }
  return pts;
}

/** Build an SVG path `d` string from a point list. */
export function toPath(pts) {
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
  }
  return d;
}

/**
 * A main bolt plus a few forking branches, in a 0..100 viewBox space.
 * Mirrors buildStrike() from the reference.
 */
export function buildStrike(x1, y1, x2, y2, rough, rand) {
  const main = boltPoints(x1, y1, x2, y2, rough, rand);
  const branches = [];
  const total = Math.hypot(x2 - x1, y2 - y1);
  const n = 2 + Math.floor(rand() * 3);
  for (let b = 0; b < n; b++) {
    const i = Math.floor(main.length * (0.18 + rand() * 0.5));
    const p = main[i];
    const q = main[Math.min(main.length - 1, i + 6)];
    const ang =
      Math.atan2(q.y - p.y, q.x - p.x) + (rand() < 0.5 ? -1 : 1) * (0.35 + rand() * 0.55);
    const len = total * (0.14 + rand() * 0.2);
    branches.push(
      boltPoints(p.x, p.y, p.x + Math.cos(ang) * len, p.y + Math.sin(ang) * len, rough * 0.5, rand, 4)
    );
  }
  return { main, branches };
}
