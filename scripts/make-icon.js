// Generates a 1024x1024 source app icon (icon.png) with no dependencies:
// an indigo rounded square with a white checkmark.
const zlib = require("zlib");
const fs = require("fs");

const W = 1024,
  H = 1024;
const buf = Buffer.alloc(W * H * 4);

function set(x, y, r, g, b, a) {
  const i = (y * W + x) * 4;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = a;
}

const radius = 200;
function inRounded(x, y) {
  const minx = radius,
    maxx = W - 1 - radius,
    miny = radius,
    maxy = H - 1 - radius;
  let cx = x,
    cy = y;
  if (x < minx) cx = minx;
  else if (x > maxx) cx = maxx;
  if (y < miny) cy = miny;
  else if (y > maxy) cy = maxy;
  const dx = x - cx,
    dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function distSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1,
    dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

const thick = 66;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!inRounded(x, y)) {
      set(x, y, 0, 0, 0, 0);
      continue;
    }
    const d = Math.min(
      distSeg(x, y, 320, 560, 452, 700),
      distSeg(x, y, 452, 700, 730, 350)
    );
    if (d <= thick) set(x, y, 255, 255, 255, 255);
    else set(x, y, 79, 70, 229, 255);
  }
}

// --- encode PNG (RGBA, 8-bit) ---
const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(b) {
  let c = ~0;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const raw = Buffer.alloc((W * 4 + 1) * H);
let p = 0;
for (let y = 0; y < H; y++) {
  raw[p++] = 0;
  buf.copy(raw, p, y * W * 4, (y + 1) * W * 4);
  p += W * 4;
}
const idat = zlib.deflateSync(raw, { level: 9 });

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const png = Buffer.concat([
  sig,
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);

fs.writeFileSync(__dirname + "/../icon.png", png);
console.log("wrote icon.png");
