/**
 * One scroll-progress value (0→1) drives the whole experience. Everything below
 * is expressed in that space so forward and reverse scroll stay in sync.
 *
 * Total scroll distance is 560vh, pinned:
 *   0.00 – 0.18  Hero      (title, hat idling at the top)
 *   0.18 – 0.92  Falling   (hat descends, kanji trail past)
 *   0.92 – 1.00  Impact    (hat lands, thunder fires, aftermath)
 *
 * The fall deliberately owns the bulk of the timeline: 0.74 of 560vh ≈ 414vh of
 * scroll, so the descent is a long, weighty drop rather than a quick drop-in.
 */
export const SCROLL_VH = 560;

export const HERO_END = 0.18;
export const FALL_START = 0.18;

/** The frame the hat touches down on. Spec: ~90–95% of scroll progress. */
export const LAND = 0.92;

/**
 * Thunder fires on CONTACT — not before it. IMPACT_START is deliberately equal
 * to LAND so the strike, the white-out and the Gear Second crossfade all land on
 * the exact frame the hat touches him, and the hit reads as cause and effect.
 */
export const IMPACT_START = LAND;

/** Luffy fades up through this window, before the hat arrives. */
export const LUFFY_IN_START = 0.58;
export const LUFFY_IN_END = 0.78;

/** Map global progress → 0..1 across the fall. */
export const fallT = (p) => {
  const t = (p - FALL_START) / (LAND - FALL_START);
  return t < 0 ? 0 : t > 1 ? 1 : t;
};

/** Map global progress → 0..1 across the impact + aftermath. */
export const impactT = (p) => {
  const t = (p - IMPACT_START) / (1 - IMPACT_START);
  return t < 0 ? 0 : t > 1 ? 1 : t;
};
