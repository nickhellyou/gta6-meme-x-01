import * as fs from "fs";
import * as zlib from "zlib";
import * as path from "path";

// ---------------------------------------------------------------------------
// LEONIDA MOBILE BILL — gta6-meme-x-01 iteration (23 Nov 2026)
// Concept: a monthly statement from LEONIDA MOBILE, the phone bill of one
// patient gamer. The joke is 13 years of waiting, itemized like a real
// bill: 8 charge rows, each one joke with specific numbers plus a second
// joke in the sub-line. The make.fun payoff is the document's own
// resolution: the bill is PAID IN FULL by the agent (red stamp + magenta
// ribbon), and the total due is exactly one copy of GTA VI, of which the
// gamer owns zero. The ghost is the operator's logo in the navy header
// and the mascot of the payoff ribbon — functional inside the document,
// not a pasted sticker.
// Originality check (23 Nov ~16:20 WIB, live board): no phone/mobile/
// cellular bill in the top 50. One same-title entry exists at rank 138
// ("Leonida Mobile Monthly Statement", muhamad-ozan, 87.81%, 11W/1D/0L,
// submitted 22 Nov 20:12 WIB, after the 22 Nov sweep) — a different
// execution of the same document type (13 rows, $10,226.73 total). This
// build is a separate execution: 8 rows, $79.99 total, the "exactly one
// copy, I own zero" punchline, and the -$250 agent top-up as the payoff
// row. Pay line at check time: rank 50 = 89.33%.
// Written from scratch in this session. Deterministic: Node stdlib only,
// no network, no wall clock, no randomness, and NO environment variable
// changes the picture — the X Premium entry died in validity with a
// STYLE=light|dark branch in its renderer, so this renderer has exactly
// one output, always. Only MAKEFUN_OUTPUT_DIR (where the file lands) and
// PREVIEW_480 (an extra downscaled copy) read the environment.
// Usage: MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out PREVIEW_480=1 node main.ts
// ---------------------------------------------------------------------------

const W = 1200;
const H = 1200;

type RGB = [number, number, number];

// ---------------------------------------------------------------------------
// 5x7 bitmap font. '#' = on, '.' = off. Rows top to bottom, 7 rows each.
// ---------------------------------------------------------------------------
const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "..##.", ".#...", "#....", "#####"],
  "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "..##.", "..#..", ".....", "..#.."],
  "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  _: [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
  "%": ["##..#", "##.#.", "....#", "...#.", "..#..", ".#.##", "#..##"],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
  "@": [".###.", "#...#", "#.###", "#.#.#", "#.##.", "#....", ".###."],
  '"': [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".##..", ".#..."],
};

// ---------------------------------------------------------------------------
// Canvas: RGB buffer + drawing primitives. All coordinates are integers;
// every helper clips to the canvas.
// ---------------------------------------------------------------------------
class Canvas {
  w: number;
  h: number;
  buf: Buffer;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.buf = Buffer.alloc(w * h * 3);
  }
  set(x: number, y: number, c: RGB): void {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return;
    const o = (yi * this.w + xi) * 3;
    this.buf[o] = c[0];
    this.buf[o + 1] = c[1];
    this.buf[o + 2] = c[2];
  }
  get(x: number, y: number): RGB {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return [0, 0, 0];
    const o = (yi * this.w + xi) * 3;
    return [this.buf[o], this.buf[o + 1], this.buf[o + 2]];
  }
  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.ceil(x + w));
    const y1 = Math.min(this.h, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const o = (yy * this.w + xx) * 3;
        this.buf[o] = c[0];
        this.buf[o + 1] = c[1];
        this.buf[o + 2] = c[2];
      }
    }
  }
  fillPoly(pts: [number, number][], c: RGB): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of pts) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.ceil(xs[k]);
        const xb = Math.floor(xs[k + 1]);
        for (let x = xa; x <= xb; x++) this.set(x, y, c);
      }
    }
  }
  fillCircle(cx: number, cy: number, r: number, c: RGB): void {
    const ri = Math.ceil(r);
    for (let y = -ri; y <= ri; y++) {
      for (let x = -ri; x <= ri; x++) {
        if (x * x + y * y <= r * r) this.set(cx + x, cy + y, c);
      }
    }
  }
  text(x: number, y: number, s: string, scale: number, c: RGB): void {
    let cx = Math.floor(x);
    const cy = Math.floor(y);
    for (const ch of s) {
      const g = FONT[ch] || FONT["?"];
      for (let r = 0; r < 7; r++) {
        for (let col = 0; col < 5; col++) {
          if (g[r][col] === "#") {
            this.fillRect(cx + col * scale, cy + r * scale, scale, scale, c);
          }
        }
      }
      cx += 6 * scale;
    }
  }
  textWidth(s: string, scale: number): number {
    return s.length * 6 * scale;
  }
  textRight(x1: number, y: number, s: string, scale: number, c: RGB): void {
    this.text(x1 - this.textWidth(s, scale), y, s, scale, c);
  }
  textCenter(cx: number, y: number, s: string, scale: number, c: RGB): void {
    this.text(cx - Math.floor(this.textWidth(s, scale) / 2), y, s, scale, c);
  }
  roundRect(x: number, y: number, w: number, h: number, r: number, c: RGB): void {
    this.fillRect(x + r, y, w - 2 * r, h, c);
    this.fillRect(x, y + r, w, h - 2 * r, c);
    this.fillCircle(x + r, y + r, r, c);
    this.fillCircle(x + w - r, y + r, r, c);
    this.fillCircle(x + r, y + h - r, r, c);
    this.fillCircle(x + w - r, y + h - r, r, c);
  }
}

// ---------------------------------------------------------------------------
// PNG encoding (deterministic: filter 0, zlib level 9).
// ---------------------------------------------------------------------------
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 0);
  crc.copy(out, 8 + data.length);
  return out;
}

function encodePNG(cv: Canvas): Buffer {
  const raw = Buffer.alloc((cv.w * 3 + 1) * cv.h);
  for (let y = 0; y < cv.h; y++) {
    const ro = y * (cv.w * 3 + 1);
    raw[ro] = 0;
    cv.buf.copy(raw, ro + 1, y * cv.w * 3, (y + 1) * cv.w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0);
  ihdr.writeUInt32BE(cv.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function downscale(cv: Canvas, size: number): Canvas {
  const out = new Canvas(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x * cv.w) / size);
      const sy = Math.floor((y * cv.h) / size);
      out.set(x, y, cv.get(sx, sy));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Palette: cream paper bill, navy operator header, red stamp, magenta
// make.fun payoff ribbon (brand color, same as previous iterations).
// ---------------------------------------------------------------------------
const PAPER: RGB = [250, 244, 228];
const NAVY: RGB = [18, 52, 86];
const RED: RGB = [198, 32, 32];
const BAND: RGB = [233, 30, 99];
const WHITE: RGB = [255, 255, 255];
const SUBGRAY: RGB = [96, 96, 96];
const ROWLINE: RGB = [212, 206, 194];

// ---------------------------------------------------------------------------
// Ghost: dome + 3 scallops, two eyes, a sparkle star on the chest.
// ---------------------------------------------------------------------------
function ghostPoints(cx: number, cy: number, s: number): [number, number][] {
  const pts: [number, number][] = [];
  // Dome: arc from the left (180 deg) over the top (270 deg) to the right
  // (360 deg). Screen coords: y grows down, so 270 deg is the top.
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const a = ((180 + (180 * i) / steps) * Math.PI) / 180;
    pts.push([
      Math.round(cx + s * Math.cos(a)),
      Math.round(cy + s * Math.sin(a)),
    ]);
  }
  // Right side down to the bottom edge.
  pts.push([Math.round(cx + s), Math.round(cy + 1.25 * s)]);
  // Bottom edge right to left with 3 scallop lobes bulging upward.
  const lobeW = (2 * s) / 3;
  for (let j = 0; j < 3; j++) {
    const ccx = cx + s - (j + 0.5) * lobeW;
    const r = lobeW / 2;
    for (let i = 0; i <= 8; i++) {
      const dx = -r + (2 * r * i) / 8;
      const dy = -Math.sqrt(Math.max(0, r * r - dx * dx));
      pts.push([Math.round(ccx + dx), Math.round(cy + 1.25 * s + dy)]);
    }
  }
  // Left side back up to the dome start.
  pts.push([Math.round(cx - s), Math.round(cy)]);
  return pts;
}

function drawGhost(
  cv: Canvas,
  cx: number,
  cy: number,
  s: number,
  fill: RGB,
  outline: RGB | null,
  eye: RGB,
  star: RGB
): void {
  if (outline) {
    cv.fillPoly(ghostPoints(cx, cy, s * 1.08), outline);
  }
  cv.fillPoly(ghostPoints(cx, cy, s), fill);
  cv.fillCircle(cx - Math.round(0.32 * s), cy - Math.round(0.1 * s), Math.max(2, Math.round(0.11 * s)), eye);
  cv.fillCircle(cx + Math.round(0.32 * s), cy - Math.round(0.1 * s), Math.max(2, Math.round(0.11 * s)), eye);
  // 4-point sparkle star on the chest.
  const sx = cx;
  const sy = cy + Math.round(0.55 * s);
  const r1 = Math.round(0.18 * s);
  const r2 = Math.round(0.05 * s);
  cv.fillPoly(
    [
      [sx, sy - r1],
      [sx + r2, sy - r2],
      [sx + r1, sy],
      [sx + r2, sy + r2],
      [sx, sy + r1],
      [sx - r2, sy + r2],
      [sx - r1, sy],
      [sx - r2, sy - r2],
    ],
    star
  );
}

// ---------------------------------------------------------------------------
// Rotated PAID stamp. Rendered on a small canvas, then blitted rotated.
// Black pixels on the source canvas are transparent.
// ---------------------------------------------------------------------------
function makeStamp(): Canvas {
  const sw = 370;
  const sh = 96;
  const cv = new Canvas(sw, sh);
  cv.fillRect(3, 3, sw - 6, 3, RED);
  cv.fillRect(3, sh - 6, sw - 6, 3, RED);
  cv.fillRect(3, 3, 3, sh - 6, RED);
  cv.fillRect(sw - 6, 3, 3, sh - 6, RED);
  cv.fillRect(9, 9, sw - 18, 2, RED);
  cv.fillRect(9, sh - 11, sw - 18, 2, RED);
  cv.fillRect(9, 9, 2, sh - 18, RED);
  cv.fillRect(sw - 11, 9, 2, sh - 18, RED);
  cv.textCenter(sw / 2, 14, "PAID", 5, RED);
  cv.textCenter(sw / 2, 62, "BY MY AI AGENT ON MAKE.FUN", 2, RED);
  return cv;
}

function blitRotated(
  dst: Canvas,
  src: Canvas,
  cx: number,
  cy: number,
  deg: number
): void {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const diag = Math.ceil(Math.sqrt(src.w * src.w + src.h * src.h));
  const x0 = Math.floor(cx - diag / 2);
  const x1 = Math.ceil(cx + diag / 2);
  const y0 = Math.floor(cy - diag / 2);
  const y1 = Math.ceil(cy + diag / 2);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      // Inverse rotation: source coords.
      const sx = cx + dx * cos + dy * sin - (cx - src.w / 2);
      const sy = cy - dx * sin + dy * cos - (cy - src.h / 2);
      const sxi = Math.floor(sx);
      const syi = Math.floor(sy);
      if (sxi < 0 || syi < 0 || sxi >= src.w || syi >= src.h) continue;
      const c = src.get(sxi, syi);
      if (c[0] === 0 && c[1] === 0 && c[2] === 0) continue;
      dst.set(x, y, c);
    }
  }
}

// ---------------------------------------------------------------------------
// Charge rows. Each row is a joke with specific numbers; the sub-line is
// a second joke, never filler. Numbers check out: 158 months = Sep 2013
// to Nov 2026; 4,811 days = Sep 17, 2013 to Nov 19, 2026.
// ---------------------------------------------------------------------------
interface BillRow {
  label: string;
  value: string;
  sub: string;
  valueColor: RGB;
}
const ROWS: BillRow[] = [
  { label: "MONTHLY PLAN - UNLIMITED PATIENCE", value: "$79.99", sub: "ONE PLAN. ONE GAME. STILL WAITING.", valueColor: NAVY },
  { label: "DATA - 214 GB, TRAILER 2 (87 VIEWS)", value: "$0.00", sub: "BUFFERED 13 YEARS. STILL LOADING.", valueColor: NAVY },
  { label: "CALLS TO ROCKSTAR SUPPORT - 4,811 CALLS", value: "$0.00", sub: "0 ANSWERED. 0 RETURNED.", valueColor: NAVY },
  { label: "TEXTS - \"IS GTA VI OUT YET?\"", value: "$0.00", sub: "SENT 4,811 TIMES. READ 0 TIMES.", valueColor: NAVY },
  { label: "ROAMING - VICE CITY, LEONIDA", value: "$0.00", sub: "SIGNAL: 0 BARS SINCE 2013.", valueColor: NAVY },
  { label: "LATE FEES - 2 DELAYS", value: "$0.00", sub: "NO EXTRA CHARGE. THE WAIT WAS.", valueColor: NAVY },
  { label: "VOICEMAIL - 1 MESSAGE, 13 YEARS OLD", value: "$0.00", sub: "FROM 15-YEAR-OLD ME. STILL HOPING.", valueColor: NAVY },
  { label: "TOP-UP - +$250 BOUNTY", value: "-$250.00", sub: "PAID BY MY AI AGENT ON MAKE.FUN.", valueColor: RED },
];

const FINEPRINT: string[] = [
  "NO REFUNDS ON 13 YEARS OF WAITING.",
  "SIGNAL NOT GUARANTEED.",
  "QUESTIONS? CALL SUPPORT.",
  "THEY WILL NOT ANSWER.",
];

// ---------------------------------------------------------------------------
// Render the phone bill.
// ---------------------------------------------------------------------------
function render(): Canvas {
  const cv = new Canvas(W, H);
  cv.fillRect(0, 0, W, H, PAPER);

  // Outer double frame.
  cv.fillRect(24, 24, 1152, 3, NAVY);
  cv.fillRect(24, 1173, 1152, 3, NAVY);
  cv.fillRect(24, 24, 3, 1152, NAVY);
  cv.fillRect(1173, 24, 3, 1152, NAVY);
  cv.fillRect(34, 34, 1132, 1, NAVY);
  cv.fillRect(34, 1165, 1132, 1, NAVY);
  cv.fillRect(34, 34, 1, 1132, NAVY);
  cv.fillRect(1165, 34, 1, 1132, NAVY);

  // ---- Navy header band: ghost operator logo + title + statement meta.
  cv.fillRect(36, 36, 1128, 150, NAVY);
  drawGhost(cv, 108, 111, 40, WHITE, null, NAVY, BAND);
  cv.text(178, 68, "LEONIDA MOBILE", 6, WHITE);
  cv.text(178, 120, "MONTHLY STATEMENT", 4, WHITE);
  cv.textRight(1164, 70, "STATEMENT NO. 000013", 2, WHITE);
  cv.textRight(1164, 110, "DUE: NOV 19, 2026", 3, WHITE);

  // ---- Account block.
  cv.text(60, 206, "ACCOUNT: ONE PATIENT GAMER", 3, NAVY);
  cv.textRight(1140, 206, "158 MONTHS ON THIS PLAN", 2, SUBGRAY);
  cv.text(60, 242, "PERIOD: SEP 17, 2013 - NOV 19, 2026", 3, NAVY);
  cv.fillRect(60, 286, 1080, 3, NAVY);

  // ---- Itemized charges.
  cv.text(60, 308, "ITEMIZED CHARGES", 3, NAVY);
  cv.textRight(1140, 308, "AMOUNT", 2, SUBGRAY);
  cv.fillRect(60, 342, 1080, 2, NAVY);
  let ry = 360;
  for (const r of ROWS) {
    cv.text(60, ry, r.label, 3, NAVY);
    cv.textRight(1140, ry, r.value, 3, r.valueColor);
    // Dotted leader between label and value.
    const lw = cv.textWidth(r.label, 3);
    const vw = cv.textWidth(r.value, 3);
    const gx0 = 60 + lw + 12;
    const gx1 = 1140 - vw - 12;
    for (let dx = gx0; dx <= gx1 - 3; dx += 14) {
      cv.fillRect(dx, ry + 11, 3, 3, SUBGRAY);
    }
    cv.text(60, ry + 26, r.sub, 2, SUBGRAY);
    cv.fillRect(60, ry + 44, 1080, 1, ROWLINE);
    ry += 56;
  }

  // ---- Total due.
  cv.fillRect(60, 818, 1080, 3, NAVY);
  cv.text(60, 836, "TOTAL DUE", 4, NAVY);
  cv.textRight(1140, 828, "$79.99", 7, RED);
  cv.text(60, 884, "EXACTLY ONE COPY OF GTA VI. I OWN ZERO.", 3, RED);

  // ---- Fine print (left column; the stamp owns the right side).
  let fy = 924;
  for (const line of FINEPRINT) {
    cv.text(60, fy, line, 2, SUBGRAY);
    fy += 22;
  }

  // ---- PAID stamp, rotated -8 degrees, right of the fine print.
  const stamp = makeStamp();
  blitRotated(cv, stamp, 905, 975, -8);

  // ---- Magenta payoff ribbon below the paper.
  cv.roundRect(36, 1054, 1128, 110, 16, BAND);
  drawGhost(cv, 150, 1109, 36, WHITE, NAVY, NAVY, BAND);
  cv.text(255, 1076, "PAID IN FULL BY MY AI AGENT", 4, WHITE);
  cv.text(255, 1116, "WITH A BOUNTY IT EARNED ON MAKE.FUN", 4, WHITE);

  return cv;
}

// ---------------------------------------------------------------------------
// Main. Output directory only changes WHERE the file lands, never WHAT the
// picture looks like; PREVIEW_480 only adds a downscaled copy. There is no
// STYLE switch and no other environment input.
// ---------------------------------------------------------------------------
function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  const preview = process.env.PREVIEW_480 === "1";
  const cv = render();
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "meme.png"), encodePNG(cv));
  if (preview) {
    fs.writeFileSync(
      path.join(outDir, "meme-480.png"),
      encodePNG(downscale(cv, 480))
    );
  }
}

main();
