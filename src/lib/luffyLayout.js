/**
 * Measurements taken off /public/images/luffy-gear2.png (1536x1024) by
 * overlaying a percentage grid and reading the artwork.
 *
 * The figure is NOT centred in its own canvas: Luffy's body sits between
 * x≈45%–92%, and a long dark smoke tail trails off to the left down to x≈15%.
 * So "centre the image" and "centre Luffy" are two different things — we always
 * want the latter, and the hat has to land on his head, not on the frame centre.
 *
 * Scene3D and LuffyCutout both derive their positions from luffyLayout() so the
 * 3D hat and the 2D artwork can never drift out of alignment.
 */
export const LUFFY_IMG = {
  // First (calm) state. luffy-gear2.png is the SAME pose erupting with steam —
  // it crossfades in on impact, so both share this one set of coordinates.
  src: '/images/a.png',
  naturalWidth: 1536,
  naturalHeight: 1024,
  aspect: 1536 / 1024,

  // Normalised coordinates *within the image*.
  headX: 0.675, // centre of the black hair mass
  headY: 0.3, // crown of the hair
  // Where the straw hat comes to rest: on his arched upper back, just behind the
  // nape, since in this hunched pose the back is the surface facing the sky.
  backX: 0.73,
  backY: 0.5,
  bodyCenterX: 0.685, // horizontal centre of the character (ignoring the smoke tail)
  bodyBottomY: 0.89, // planted fist / sandals
};

/** The Gear Second reveal — same figure, now steaming. */
export const GEAR2_SRC = '/images/luffy-gear2.png';

/** How much of the viewport height the artwork occupies. */
const IMG_HEIGHT_VH = 0.92;
/** Where the character's feet sit vertically on screen. */
const FEET_AT_VH = 0.9;

/**
 * Given a viewport size in CSS px, return where to place the image and where
 * Luffy's head ends up on screen.
 */
export function luffyLayout(vw, vh) {
  const imgH = vh * IMG_HEIGHT_VH;
  const imgW = imgH * LUFFY_IMG.aspect;

  // Put the character's centre — not the image's centre — at mid-screen.
  const left = vw * 0.5 - LUFFY_IMG.bodyCenterX * imgW;
  const top = vh * FEET_AT_VH - LUFFY_IMG.bodyBottomY * imgH;

  return {
    imgW,
    imgH,
    left,
    top,
    headX: left + LUFFY_IMG.headX * imgW,
    headY: top + LUFFY_IMG.headY * imgH,
    /** Where the hat lands: on his back. */
    backX: left + LUFFY_IMG.backX * imgW,
    backY: top + LUFFY_IMG.backY * imgH,
    /** Approx. width of the head in px — used to size the hat. */
    headW: imgW * 0.11,
  };
}
