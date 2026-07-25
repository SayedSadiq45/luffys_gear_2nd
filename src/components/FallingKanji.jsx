import { useMemo } from 'react';
import { mulberry32 } from '../lib/rng';
import { lerp } from '../lib/math';

/**
 * Kanji falling alongside the hat, at simulated depth.
 *
 * NOTE ON REACT BITS: their <FallingText/> is a matter.js physics sim. A physics
 * sim integrates forward in time and cannot be scrubbed backwards, which would
 * break the "perfectly reversible, in sync with scroll" requirement. So position
 * here is driven by the master GSAP timeline (fully reversible).
 *
 * The glyph itself is plain Japanese text (no glitch treatment). The only
 * per-glyph animation is a cheap transform/opacity sway on the inner span — no
 * animated filters or background-clip, since those repaint every frame and
 * dragged the scroll. The static blur also sits on that span (the element that
 * transforms) so its layer is rasterised once and merely moved, never reblurred
 * per frame.
 */

const WORDS = [
  { jp: '二段' },
  { jp: '麦わら' },
  { jp: '嵐' },
  { jp: '覇気' },
  { jp: '力' },
  { jp: '海賊王' },
  { jp: 'ゴムゴム' },
  { jp: '疾風' },
  { jp: '解放' },
  { jp: '鼓動' },
  { jp: '蒸気' },
  { jp: '雷鳴' },
];

const COUNT = 18;

/**
 * Depth bands. `z` 0 = far (small, blurred, slow), 1 = near (large, sharp, fast).
 * Everything visual keys off this one number so the trail reads as a volume
 * rather than a flat sheet of text.
 */
function buildGlyphs() {
  const rand = mulberry32(0xa17e);
  return Array.from({ length: COUNT }, (_, i) => {
    const z = rand();
    const w = WORDS[Math.floor(rand() * WORDS.length)];
    return {
      id: i,
      z,
      // simple Japanese text only
      text: w.jp,
      // keep the middle of the screen clearer so the hat stays readable
      x: rand() < 0.5 ? lerp(2, 34, rand()) : lerp(64, 96, rand()),
      size: lerp(14, 82, z * z),
      blur: lerp(3, 0, z),
      opacity: lerp(0.16, 0.72, z),
      // near glyphs travel further per unit scroll → parallax
      travel: lerp(48, 165, z),
      start: rand(), // stagger
      drift: (rand() - 0.5) * 12,
      rot: (rand() - 0.5) * 16,
      vertical: rand() < 0.55,
      // per-glyph cadence for the cheap sway (clock-driven, cosmetic)
      swayDur: lerp(2.8, 5.2, rand()),
      swayDelay: -rand() * 5,
    };
  });
}

export default function FallingKanji() {
  const glyphs = useMemo(buildGlyphs, []);

  return (
    <div className="kanji" aria-hidden="true">
      {glyphs.map((g) => (
        <div
          key={g.id}
          className="kanji__item"
          data-kanji
          data-start={g.start}
          data-travel={g.travel}
          data-drift={g.drift}
          data-depth={g.z}
          style={{
            left: `${g.x}%`,
            fontSize: `${g.size}px`,
            // rendered opacity is (depth opacity) x (timeline opacity)
            '--kanji-opacity': g.opacity,
            transform: `rotate(${g.rot}deg)`,
            writingMode: g.vertical ? 'vertical-rl' : 'horizontal-tb',
            zIndex: Math.round(g.z * 10),
          }}
        >
          <span
            className="kanji__glyph"
            style={{
              filter: `blur(${g.blur}px)`,
              animationDuration: `${g.swayDur}s`,
              animationDelay: `${g.swayDelay}s`,
            }}
          >
            {g.text}
          </span>
        </div>
      ))}
    </div>
  );
}
