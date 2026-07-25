import sharp from 'sharp';

const src = process.argv[2];
const out = process.argv[3];

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

// --- alpha bounding box + head/body measurements -------------------------
const A = (x, y) => data[(y * W + x) * C + 3];

let minX = W, maxX = -1, minY = H, maxY = -1;
// column/row alpha mass, ignoring the very faint glow fringe
const colMass = new Float64Array(W);
const rowMass = new Float64Array(H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const a = A(x, y);
    if (a > 24) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (a > 128) {
      colMass[x] += 1;
      rowMass[y] += 1;
    }
  }
}
console.log('size:', W, 'x', H);
console.log('alpha bbox (a>24): x', minX, '->', maxX, ' y', minY, '->', maxY);
console.log('  normalised: x', (minX / W).toFixed(3), '->', (maxX / W).toFixed(3),
  ' y', (minY / H).toFixed(3), '->', (maxY / H).toFixed(3));

// solid bbox (a>128)
let sMinX = W, sMaxX = -1, sMinY = H, sMaxY = -1;
for (let x = 0; x < W; x++) if (colMass[x] > 0) { if (x < sMinX) sMinX = x; if (x > sMaxX) sMaxX = x; }
for (let y = 0; y < H; y++) if (rowMass[y] > 0) { if (y < sMinY) sMinY = y; if (y > sMaxY) sMaxY = y; }
console.log('solid bbox (a>128): x', sMinX, '->', sMaxX, ' y', sMinY, '->', sMaxY);
console.log('  normalised: x', (sMinX / W).toFixed(3), '->', (sMaxX / W).toFixed(3),
  ' y', (sMinY / H).toFixed(3), '->', (sMaxY / H).toFixed(3));

// centroid of solid alpha
let cx = 0, cy = 0, n = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) > 128) { cx += x; cy += y; n++; }
console.log('solid centroid:', (cx / n / W).toFixed(3), (cy / n / H).toFixed(3));

// --- dark hair mass (the head): near-black opaque pixels in the top half ---
let hx = 0, hy = 0, hn = 0;
let hMinX = W, hMaxX = -1, hMinY = H, hMaxY = -1;
for (let y = 0; y < H * 0.6; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * C;
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a > 180 && r < 60 && g < 60 && b < 70) {
      hx += x; hy += y; hn++;
      if (x < hMinX) hMinX = x;
      if (x > hMaxX) hMaxX = x;
      if (y < hMinY) hMinY = y;
      if (y > hMaxY) hMaxY = y;
    }
  }
}
console.log('\nhair mass px:', hn);
console.log('hair bbox: x', hMinX, '->', hMaxX, ' y', hMinY, '->', hMaxY);
console.log('  normalised: x', (hMinX / W).toFixed(3), '->', (hMaxX / W).toFixed(3),
  ' y', (hMinY / H).toFixed(3), '->', (hMaxY / H).toFixed(3));
console.log('hair centroid normalised:', (hx / hn / W).toFixed(3), (hy / hn / H).toFixed(3));
console.log('hair width normalised:', ((hMaxX - hMinX) / W).toFixed(3));

// --- write a preview composited over the stage colour ---------------------
if (out) {
  await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 8, g: 7, b: 14, alpha: 1 } },
  })
    .composite([{ input: src }])
    .png()
    .toFile(out);
  console.log('\npreview ->', out);
}
