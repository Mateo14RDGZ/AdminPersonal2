import { writeFileSync, mkdirSync } from "fs";
import { deflateSync } from "zlib";
import { join } from "path";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
  }
  return ~c >>> 0;
}

function png(size, r, g, b) {
  const rowLen = 1 + size * 3;
  const raw = Buffer.alloc(size * rowLen);
  for (let y = 0; y < size; y++) {
    const off = y * rowLen;
    raw[off] = 0;
    for (let x = 0; x < size; x++) {
      const cx = x - size / 2;
      const cy = y - size / 2;
      const inCircle = cx * cx + cy * cy <= (size * 0.38) ** 2;
      const i = off + 1 + x * 3;
      if (inCircle) {
        raw[i] = r;
        raw[i + 1] = g;
        raw[i + 2] = b;
      } else {
        raw[i] = 245;
        raw[i + 1] = 245;
        raw[i + 2] = 247;
      }
    }
  }
  const compressed = deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  };
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dir = join(process.cwd(), "public", "icons");
mkdirSync(dir, { recursive: true });
const color = { r: 0x1d, g: 0x9e, b: 0x75 };
for (const size of [180, 192, 512]) {
  writeFileSync(
    join(dir, size === 180 ? "icon-180.png" : `icon-${size}.png`),
    png(size, color.r, color.g, color.b)
  );
}
console.log("Icons written to public/icons");
