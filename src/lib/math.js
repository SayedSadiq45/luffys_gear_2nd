export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

export const lerp = (a, b, t) => a + (b - a) * t;

/** Normalise v from the range [a,b] into [0,1], clamped. */
export const range = (v, a, b) => clamp((v - a) / (b - a || 1));

/** Hermite smoothstep between two edges. */
export const smoothstep = (a, b, v) => {
  const t = range(v, a, b);
  return t * t * (3 - 2 * t);
};

/** Gravity-ish ease used for the fall. Matches GSAP's power2.in. */
export const easeInQuad = (t) => t * t;

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/**
 * A 0→1→0 pulse. Rises over `attack`, holds, then falls over `release`.
 * Deterministic in t, so it scrubs backwards perfectly.
 */
export const pulse = (t, start, attack, hold, release) => {
  const up = range(t, start, start + attack);
  const down = 1 - range(t, start + attack + hold, start + attack + hold + release);
  return clamp(Math.min(up, down));
};
