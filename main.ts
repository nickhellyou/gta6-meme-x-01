// gta6-meme-x-01 — REVISI KE-4: "GTA VI SIM" starter pack.
// Deterministic renderer, Node stdlib only. No network, no wall clock,
// no randomness beyond fixed constants. Run:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
// Writes out/meme.png (1200x1200) and copies POST.json to out/POST.json.
// With PREVIEW_480=1 also writes out/meme-480.png (the size the judge sees).
//
// Concept: a fake real-world document, like the top-10 winners — a SIM
// starter pack (kartu perdana) from LEONIDA MOBILE. The plan table is the
// joke engine: 7 rows, each one a joke, specific numbers everywhere.
// The ghost is the operator logo (header), the chip etching, and the
// payoff-band badge — functional inside the document, never a sticker.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1200;
const H = 1200;
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
const botDir = process.env.MAKEFUN_BOT_DIR || ".";
const preview480 = process.env.PREVIEW_480 === "1";

// ---------------------------------------------------------------------------
// Framebuffer
// ---------------------------------------------------------------------------

const fb = Buffer.alloc(W * H * 3);

type RGB = [number, number, number];

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  fb[i] = c[0];
  fb[i + 1] = c[1];
  fb[i + 2] = c[2];
}

function getPixel(x: number, y: number): RGB {
  const i = (y * W + x) * 3;
  return [fb[i], fb[i + 1], fb[i + 2]];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, c);
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let yy = cy - r; yy <= cy + r; yy++) {
    const dx = Math.floor(Math.sqrt(Math.max(0, r * r - (yy - cy) * (yy - cy))));
    for (let xx = cx - dx; xx <= cx + dx; xx++) setPixel(xx, yy, c);
  }
}

function fillRoundRect(x: number, y: number, w: number, h: number, r: number, c: RGB): void {
  fillRect(x + r, y, w - 2 * r, h, c);
  fillRect(x, y + r, w, h - 2 * r, c);
  fillCircle(x + r, y + r, r, c);
  fillCircle(x + w - r, y + r, r, c);
  fillCircle(x + r, y + h - r, r, c);
  fillCircle(x + w - r, y + h - r, r, c);
}

// Bresenham line.
function drawLine(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  let dx = Math.abs(x1 - x0);
  let dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPixel(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// Thick line: stamp filled circles along the Bresenham path.
function drawThickLine(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  const r = Math.max(1, Math.floor(t / 2));
  let dx = Math.abs(x1 - x0);
  let dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    fillCircle(x, y, r, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// 4-point sparkle (thin diamond).
function drawDiamond(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let yy = cy - ry; yy <= cy + ry; yy++) {
    const t = 1 - Math.abs(yy - cy) / ry;
    const dx = Math.max(0, Math.floor(rx * t));
    for (let xx = cx - dx; xx <= cx + dx; xx++) setPixel(xx, yy, c);
  }
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font (homemade). Each glyph: 7 rows of 5 bits.
// ---------------------------------------------------------------------------

const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
};

function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * 6 * scale - scale;
}

function drawText(s: string, x: number, y: number, scale: number, c: RGB): void {
  for (let i = 0; i < s.length; i++) {
    const g = FONT[s[i]] || FONT[" "];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") {
          fillRect(x + i * 6 * scale + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
  }
}

// Rotated text: the text block is centered on (cx, cy), rotated by angleDeg.
// Each font pixel is placed by rotating its sub-pixels around the center.
function drawTextRotated(s: string, cx: number, cy: number, angleDeg: number, scale: number, c: RGB): void {
  const tw = textWidth(s, scale);
  const th = 7 * scale;
  const a = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  for (let i = 0; i < s.length; i++) {
    const g = FONT[s[i]] || FONT[" "];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] !== "1") continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const lx = i * 6 * scale + col * scale + sx - tw / 2;
            const ly = r * scale + sy - th / 2;
            const rx = lx * cos - ly * sin;
            const ry = lx * sin + ly * cos;
            setPixel(Math.round(cx + rx), Math.round(cy + ry), c);
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// The make.fun ghost, drawn from primitives. (cx, cy) = center, h = height.
// cutColor must equal whatever the ghost sits on (it carves the wavy bottom).
// ---------------------------------------------------------------------------

function drawGhost(
  cx: number,
  cy: number,
  h: number,
  body: RGB,
  eye: RGB,
  cutColor: RGB,
  coin: RGB | null,
  star: RGB | null,
): void {
  const w = Math.round(h * 0.78);
  const top = cy - Math.floor(h / 2);
  const bottom = cy + Math.floor(h / 2);
  const rHead = Math.floor(w / 2);
  // Head + body.
  fillCircle(cx, top + rHead, rHead, body);
  fillRect(cx - rHead, top + Math.floor(rHead * 0.7), w, bottom - (top + Math.floor(rHead * 0.7)), body);
  // Wavy bottom: three notches carved in the background color.
  const sr = Math.max(4, Math.floor(w / 6));
  fillCircle(cx - Math.floor(w / 3), bottom, sr, cutColor);
  fillCircle(cx, bottom, sr, cutColor);
  fillCircle(cx + Math.floor(w / 3), bottom, sr, cutColor);
  // Sparkle eyes.
  const ey = top + Math.floor(h * 0.3);
  const ex = Math.floor(w * 0.18);
  drawDiamond(cx - ex, ey, Math.max(3, Math.floor(w * 0.07)), Math.max(3, Math.floor(h * 0.05)), eye);
  drawDiamond(cx + ex, ey, Math.max(3, Math.floor(w * 0.07)), Math.max(3, Math.floor(h * 0.05)), eye);
  // Coin with a star, held at the ghost's side.
  if (coin && star) {
    const cr = Math.max(6, Math.floor(w * 0.15));
    const ccx = cx + Math.floor(w * 0.45);
    const ccy = cy + Math.floor(h * 0.16);
    fillCircle(ccx, ccy, cr, coin);
    drawDiamond(ccx, ccy, Math.max(3, Math.floor(cr * 0.55)), Math.max(3, Math.floor(cr * 0.55)), star);
  }
}

// ---------------------------------------------------------------------------
// PNG encoder (stdlib zlib + homemade CRC32)
// ---------------------------------------------------------------------------

const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(w: number, h: number, pixels: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    pixels.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const NAVY: RGB = [14, 26, 56];
const INK: RGB = [18, 32, 63];
const MAGENTA: RGB = [230, 0, 126];
const MAGENTA_DARK: RGB = [122, 0, 69];
const CARD: RGB = [251, 250, 244];
const GOLD: RGB = [230, 179, 77];
const GOLD_LINE: RGB = [192, 138, 45];
const GOLD_DARK: RGB = [138, 109, 31];
const RED: RGB = [200, 16, 46];
const GRAY: RGB = [111, 111, 100];
const HAIR: RGB = [221, 216, 200];
const DOT: RGB = [185, 180, 164];
const FINE: RGB = [138, 138, 128];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [20, 20, 20];

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

// Background: dark plum vertical gradient.
for (let y = 0; y < H; y++) {
  const t = y / (H - 1);
  const c: RGB = [
    Math.round(42 + (20 - 42) * t),
    Math.round(22 + (10 - 22) * t),
    Math.round(80 + (40 - 80) * t),
  ];
  fillRect(0, y, W, 1, c);
}

// Card with a soft offset shadow.
fillRoundRect(68, 54, 1080, 1104, 36, [13, 6, 24]);
fillRoundRect(60, 46, 1080, 1104, 36, CARD);

// Header band (navy), top corners rounded, bottom corners square.
fillRoundRect(60, 46, 1080, 140, 36, NAVY);
fillRect(60, 120, 1080, 66, NAVY);

// Ghost as the operator logo.
drawGhost(146, 116, 92, WHITE, NAVY, NAVY, MAGENTA, WHITE);
drawText("LEONIDA MOBILE", 210, 82, 7, WHITE);
drawText("VICE CITY - EST. 2013", 210, 142, 3, WHITE);

// Title + plan subhead.
drawText("GTA VI SIM", 100, 214, 11, INK);
drawText("13-YEAR PLAN", 100, 308, 6, MAGENTA);

// SIM chip punch-out (gold), with contact traces and the ghost etched in.
fillRoundRect(872, 208, 216, 166, 22, [216, 210, 189]);
fillRoundRect(880, 216, 200, 150, 18, GOLD);
drawLine(892, 266, 1068, 266, GOLD_LINE);
drawLine(892, 316, 1068, 316, GOLD_LINE);
drawLine(946, 228, 946, 354, GOLD_LINE);
drawLine(1013, 228, 1013, 354, GOLD_LINE);
drawGhost(980, 291, 56, WHITE, GOLD_DARK, GOLD, null, null);

// Plan table: 7 rows, label left, dotted leader, value right-aligned.
const rows: Array<[string, string, number, RGB]> = [
  ["NUMBER", "2013-GTA-VI", 4, INK],
  ["PLAN", "UNLIMITED PATIENCE", 4, INK],
  ["DATA", "214 GB - TRAILER 2 (87 VIEWS)", 4, INK],
  ["SIGNAL", "0 BARS SINCE 2013", 4, INK],
  ["VALIDITY", "SEP 17, 2013 - NOV 19, 2026", 4, INK],
  ["DELAYS", "2 EXTENSIONS - NO EXTRA CHARGE", 4, INK],
  ["PRICE", "$79.99", 6, MAGENTA],
];
const tableTop = 400;
const rowH = 56;
for (let i = 0; i < rows.length; i++) {
  const [label, value, scale, vcol] = rows[i];
  const rowTop = tableTop + i * rowH;
  const textTop = rowTop + Math.floor((rowH - 7 * scale) / 2);
  const labelW = textWidth(label, 4);
  const valueW = textWidth(value, scale);
  drawText(label, 100, rowTop + Math.floor((rowH - 28) / 2), 4, GRAY);
  drawText(value, 1100 - valueW, textTop, scale, vcol);
  // Dotted leader between label and value.
  const dotY = rowTop + Math.floor(rowH / 2) - 1;
  const x0 = 100 + labelW + 14;
  const x1 = 1100 - valueW - 14;
  for (let x = x0; x < x1; x += 9) fillRect(x, dotY, 3, 3, DOT);
  // Hairline between rows.
  if (i < rows.length - 1) fillRect(100, rowTop + rowH - 1, 1000, 1, HAIR);
}

// Red stamp, rotated -10 degrees: ACTIVATED / NOV 19, 2026.
const stampCx = 940;
const stampCy = 880;
const stampAngle = -10;
const stampW = 360;
const stampH = 110;
const a = (stampAngle * Math.PI) / 180;
const cosA = Math.cos(a);
const sinA = Math.sin(a);
function rotPoint(lx: number, ly: number): [number, number] {
  return [
    Math.round(stampCx + lx * cosA - ly * sinA),
    Math.round(stampCy + lx * sinA + ly * cosA),
  ];
}
const corners: Array<[number, number]> = [
  rotPoint(-stampW / 2, -stampH / 2),
  rotPoint(stampW / 2, -stampH / 2),
  rotPoint(stampW / 2, stampH / 2),
  rotPoint(-stampW / 2, stampH / 2),
];
for (let i = 0; i < 4; i++) {
  const p = corners[i];
  const q = corners[(i + 1) % 4];
  drawThickLine(p[0], p[1], q[0], q[1], 4, RED);
}
const inner: Array<[number, number]> = [
  rotPoint(-stampW / 2 + 10, -stampH / 2 + 10),
  rotPoint(stampW / 2 - 10, -stampH / 2 + 10),
  rotPoint(stampW / 2 - 10, stampH / 2 - 10),
  rotPoint(-stampW / 2 + 10, stampH / 2 - 10),
];
for (let i = 0; i < 4; i++) {
  const p = inner[i];
  const q = inner[(i + 1) % 4];
  drawLine(p[0], p[1], q[0], q[1], RED);
}
drawTextRotated("ACTIVATED", stampCx, stampCy - 22, stampAngle, 6, RED);
drawTextRotated("NOV 19, 2026", stampCx, stampCy + 26, stampAngle, 4, RED);

// Barcode + ICCID, bottom-left of the card.
const barPattern = [3, 1, 2, 1, 1, 3, 2, 2, 1, 1, 4, 1, 2, 3, 1, 1, 2, 1, 3, 1, 1, 2, 4, 1, 1, 3, 2, 1, 1, 2, 1, 3, 1, 2, 1, 1, 4, 2, 1, 1, 3, 1, 2, 1, 1, 3, 2, 2, 1, 1];
let bx = 100;
let bi = 0;
while (bx < 560) {
  const bw = barPattern[bi % barPattern.length];
  if (bi % 2 === 0) fillRect(bx, 860, bw, 56, BLACK);
  bx += bw;
  bi++;
}
drawText("ICCID 8901 2013 1119 2026", 100, 930, 3, [74, 74, 66]);

// Fine print.
const fine = "COVERAGE NOT GUARANTEED. THIS SIM WAITED LONGER THAN ITS OWN VALIDITY.";
drawText(fine, Math.floor((W - textWidth(fine, 2)) / 2), 986, 2, FINE);

// Payoff band (magenta), bottom corners rounded, top corners square.
fillRoundRect(60, 1024, 1080, 126, 36, MAGENTA);
fillRect(60, 1024, 1080, 76, MAGENTA);
drawGhost(150, 1087, 84, WHITE, MAGENTA_DARK, MAGENTA, WHITE, MAGENTA);
const band1 = "TOPPED UP $250 BY MY AI AGENT";
const band2 = "ON MAKE.FUN";
drawText(band1, 200 + Math.floor((900 - textWidth(band1, 5)) / 2), 1042, 5, WHITE);
drawText(band2, 200 + Math.floor((900 - textWidth(band2, 5)) / 2), 1082, 5, WHITE);

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "meme.png"), encodePNG(W, H, fb));
fs.copyFileSync(path.join(botDir, "POST.json"), path.join(outDir, "POST.json"));

if (preview480) {
  const pw = 480;
  const ph = 480;
  const small = Buffer.alloc(pw * ph * 3);
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const sx = Math.floor((x * W) / pw);
      const sy = Math.floor((y * H) / ph);
      const si = (sy * W + sx) * 3;
      const di = (y * pw + x) * 3;
      small[di] = fb[si];
      small[di + 1] = fb[si + 1];
      small[di + 2] = fb[si + 2];
    }
  }
  fs.writeFileSync(path.join(outDir, "meme-480.png"), encodePNG(pw, ph, small));
}
