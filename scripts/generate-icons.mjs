import { deflateSync, inflateSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
mkdirSync(publicDir, { recursive: true });

const CHARCOAL = [8, 8, 8];

function crc32(buf) {
  let c;
  const table =
    crc32.table ||
    (crc32.table = (() => {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
      }
      return t;
    })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function readPngRgba(filePath) {
  const buf = readFileSync(filePath);
  let offset = 8;
  let idat = [];
  let w, h;
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    if (type === "IHDR") {
      w = buf.readUInt32BE(offset + 8);
      h = buf.readUInt32BE(offset + 12);
    }
    if (type === "IDAT") idat.push(buf.subarray(offset + 8, offset + 8 + len));
    offset += 8 + len + 4;
    if (type === "IEND") break;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[pos++];
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[pos++];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let val;
      if (filter === 0) val = rawByte;
      else if (filter === 1) val = (rawByte + a) & 0xff;
      else if (filter === 2) val = (rawByte + b) & 0xff;
      else if (filter === 3) val = (rawByte + Math.floor((a + b) / 2)) & 0xff;
      else {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        val = (rawByte + pr) & 0xff;
      }
      out[y * stride + x] = val;
    }
  }
  return { width: w, height: h, data: out };
}

function writePngRgb(pixelsRgb, w, h, filePath) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    raw[pos++] = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      raw[pos++] = pixelsRgb[i];
      raw[pos++] = pixelsRgb[i + 1];
      raw[pos++] = pixelsRgb[i + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB, opaque - required for apple-touch-icon and safest for favicons
  const idat = deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  writeFileSync(
    filePath,
    Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))])
  );
}

// bilinear-sample the source RGBA mark at normalized (u, v) in [0, 1]
function sampleBilinear(src, u, v) {
  const x = u * (src.width - 1);
  const y = v * (src.height - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, src.width - 1);
  const y1 = Math.min(y0 + 1, src.height - 1);
  const fx = x - x0;
  const fy = y - y0;

  const at = (px, py, c) => src.data[(py * src.width + px) * 4 + c];
  const lerp = (a, b, t) => a + (b - a) * t;

  const out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const top = lerp(at(x0, y0, c), at(x1, y0, c), fx);
    const bottom = lerp(at(x0, y1, c), at(x1, y1, c), fx);
    out[c] = lerp(top, bottom, fy);
  }
  return out;
}

function renderIcon(mark, size, markCoverage) {
  const pixels = Buffer.alloc(size * size * 3);
  const scale = (size * markCoverage) / Math.max(mark.width, mark.height);
  const drawW = mark.width * scale;
  const drawH = mark.height * scale;
  const offsetX = (size - drawW) / 2;
  const offsetY = (size - drawH) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = CHARCOAL[0];
      let g = CHARCOAL[1];
      let b = CHARCOAL[2];

      const mx = x - offsetX;
      const my = y - offsetY;
      if (mx >= 0 && mx < drawW && my >= 0 && my < drawH) {
        const [mr, mg, mb, ma] = sampleBilinear(mark, mx / drawW, my / drawH);
        const alpha = ma / 255;
        r = Math.round(mr * alpha + r * (1 - alpha));
        g = Math.round(mg * alpha + g * (1 - alpha));
        b = Math.round(mb * alpha + b * (1 - alpha));
      }

      const idx = (y * size + x) * 3;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
    }
  }
  return pixels;
}

const mark = readPngRgba(path.join(publicDir, "cristalux-mark.png"));

const targets = [
  ["icon-192.png", 192, 0.72],
  ["icon-512.png", 512, 0.72],
  ["apple-touch-icon.png", 180, 0.62],
];

for (const [name, size, coverage] of targets) {
  const pixels = renderIcon(mark, size, coverage);
  writePngRgb(pixels, size, size, path.join(publicDir, name));
  console.log(`Generated ${name} (${size}x${size})`);
}
