import sharp from 'sharp';

const src = process.argv[2];
const img = sharp(src);
const meta = await img.metadata();
console.log('meta:', meta.width, meta.height, 'channels:', meta.channels, 'hasAlpha:', meta.hasAlpha);

const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

const at = (x, y) => {
  const i = (y * W + x) * C;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
};

let opaque = 0, transparent = 0, partial = 0;
for (let i = 3; i < data.length; i += C) {
  const a = data[i];
  if (a === 255) opaque++;
  else if (a === 0) transparent++;
  else partial++;
}
console.log('alpha -> opaque:', opaque, 'transparent:', transparent, 'partial:', partial);

console.log('\ncorners & edges:');
for (const [lx, ly] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1], [W >> 1, 0], [W >> 1, H - 1], [0, H >> 1], [W - 1, H >> 1]]) {
  console.log(`  (${lx},${ly}) =`, at(lx, ly).join(','));
}

console.log('\ngrid (11x7 sample of RGB):');
for (let gy = 0; gy < 7; gy++) {
  const y = Math.round((gy / 6) * (H - 1));
  const row = [];
  for (let gx = 0; gx < 11; gx++) {
    const x = Math.round((gx / 10) * (W - 1));
    const [r, g, b] = at(x, y);
    row.push(String(r).padStart(3) + '/' + String(g).padStart(3) + '/' + String(b).padStart(3));
  }
  console.log(`  y=${String(y).padStart(4)}`, row.join('  '));
}
