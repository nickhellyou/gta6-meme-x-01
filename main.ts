import * as fs from "fs";
import * as zlib from "zlib";
import * as path from "path";

// ---------------------------------------------------------------------------
// CONSTRUCTION BLUEPRINT — gta6-meme-x-01 iteration (22 Nov 2026)
// Concept: a construction blueprint for GTA VI in Vice City. The joke is
// 13 years of waiting, drawn as a building that was never built: a floor
// plan with 4 rooms, a revision table (4 redesigns, 2 delays), a spec
// table (foundation: 13 years of patience), and an APPROVED stamp. The
// make.fun payoff is the document's own resolution: the construction was
// FUNDED BY MY AI AGENT with a bounty it earned on make.fun.
// Uniqueness: 0 hits for "blueprint" (and 0 for architect / floor plan /
// construction drawing) in 5,660 swept titles + absent from the live top
// 50. The blueprint is the only blue document in a sea of cream paper.
// Written from scratch in this session. Deterministic: Node stdlib only,
// no network, no wall clock, no randomness, and NO environment variable
// changes the picture — the X Premium entry died in validity with a
// STYLE=light|dark branch in its renderer, so this renderer has exactly
// one output, always.
// Usage: MAKEFUN_OUTPUT_DIR=out PREVIEW_480=1 node main.ts
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
  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.set(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }
  thickLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    t: number,
    c: RGB
  ): void {
    // Axis-aligned thick line only (walls); diagonals use line() instead.
    if (y0 === y1) {
      this.fillRect(Math.min(x0, x1), y0 - Math.floor(t / 2), Math.abs(x1 - x0), t, c);
    } else if (x0 === x1) {
      this.fillRect(x0 - Math.floor(t / 2), Math.min(y0, y1), t, Math.abs(y1 - y0), c);
    } else {
      this.line(x0, y0, x1, y1, c);
    }
  }
  polyline(pts: [number, number][], c: RGB): void {
    for (let i = 0; i + 1 < pts.length; i++) {
      this.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c);
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
  arc(
    cx: number,
    cy: number,
    r: number,
    a0deg: number,
    a1deg: number,
    c: RGB
  ): void {
    const steps = 24;
    const pts: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const a = ((a0deg + ((a1deg - a0deg) * i) / steps) * Math.PI) / 180;
      pts.push([
        Math.round(cx + r * Math.cos(a)),
        Math.round(cy + r * Math.sin(a)),
      ]);
    }
    this.polyline(pts, c);
  }
  fillCircle(cx: number, cy: number, r: number, c: RGB): void {
    const ri = Math.ceil(r);
    for (let y = -ri; y <= ri; y++) {
      for (let x = -ri; x <= ri; x++) {
        if (x * x + y * y <= r * r) this.set(cx + x, cy + y, c);
      }
    }
  }
  circleOutline(cx: number, cy: number, r: number, c: RGB): void {
    const steps = 72;
    const pts: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * 2 * Math.PI;
      pts.push([
        Math.round(cx + r * Math.cos(a)),
        Math.round(cy + r * Math.sin(a)),
      ]);
    }
    this.polyline(pts, c);
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
// Palette: blueprint blue sheet on a darker blue ground. White linework,
// magenta make.fun band (brand color, same as previous iterations).
// ---------------------------------------------------------------------------
const BG: RGB = [13, 63, 105];
const SHEET: RGB = [16, 84, 135];
const GRID: RGB = [28, 100, 155];
const WHITE: RGB = [255, 255, 255];
const DIM: RGB = [190, 215, 235];
const BAND: RGB = [233, 30, 99];
const BAND_TEXT: RGB = [255, 255, 255];
const GHOST_BLUE: RGB = [16, 84, 135];
const GHOST_EYE_WHITE: RGB = [255, 255, 255];
const GHOST_STAR: RGB = [233, 30, 99];
const OUTLINE_DARK: RGB = [13, 40, 66];

// ---------------------------------------------------------------------------
// Ghost: dome + 3 scallops, two eyes, a sparkle star on the chest.
// Optional dark outline drawn as a slightly larger silhouette behind.
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
// Rotated APPROVED stamp. Rendered on a small canvas, then blitted rotated.
// Black pixels on the source canvas are transparent.
// ---------------------------------------------------------------------------
function makeStamp(): Canvas {
  const sw = 300;
  const sh = 76;
  const cv = new Canvas(sw, sh);
  cv.fillRect(3, 3, sw - 6, 3, WHITE);
  cv.fillRect(3, sh - 6, sw - 6, 3, WHITE);
  cv.fillRect(3, 3, 3, sh - 6, WHITE);
  cv.fillRect(sw - 6, 3, 3, sh - 6, WHITE);
  cv.fillRect(9, 9, sw - 18, 2, WHITE);
  cv.fillRect(9, sh - 11, sw - 18, 2, WHITE);
  cv.fillRect(9, 9, 2, sh - 18, WHITE);
  cv.fillRect(sw - 11, 9, 2, sh - 18, WHITE);
  cv.textCenter(sw / 2, 16, "APPROVED", 5, WHITE);
  cv.textCenter(sw / 2, 52, "FOR CONSTRUCTION", 2, WHITE);
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

// Small text canvas, for the rotated vertical dimension label.
function makeTextCanvas(s: string, scale: number): Canvas {
  const w = s.length * 6 * scale + 8;
  const h = 7 * scale + 8;
  const cv = new Canvas(w, h);
  cv.text(4, 4, s, scale, WHITE);
  return cv;
}

// ---------------------------------------------------------------------------
// Revision table rows and spec table rows. Each row is a joke with
// specific numbers; the sub-line is a second joke, never filler.
// ---------------------------------------------------------------------------
interface RevRow {
  main: string;
  sub: string;
}
const REVISIONS: RevRow[] = [
  { main: "REV A - SEP 17, 2013", sub: "INITIAL DESIGN" },
  { main: "REV B - NOV 18, 2023", sub: "DELAYED - REDESIGN" },
  { main: "REV C - MAY 26, 2025", sub: "DELAYED AGAIN" },
  { main: "REV D - NOV 19, 2026", sub: "APPROVED - BUILD IT" },
];

interface SpecRow {
  label: string;
  value: string;
  sub: string;
}
const SPECS: SpecRow[] = [
  { label: "FOUNDATION", value: "13 YEARS", sub: "POURED IN 2013. STILL SETTING." },
  { label: "WALLS", value: "214 GB", sub: "TRAILER FOOTAGE, LOAD-BEARING." },
  { label: "ROOF", value: "2 DELAYS", sub: "NO LEAKS. JUST TEARS." },
  { label: "DOORS", value: "0", sub: "STILL LOCKED SINCE 2013." },
  { label: "WINDOWS", value: "87", sub: "TRAILER VIEWS AND COUNTING." },
];

// ---------------------------------------------------------------------------
// Render the blueprint.
// ---------------------------------------------------------------------------
function render(): Canvas {
  const cv = new Canvas(W, H);
  cv.fillRect(0, 0, W, H, BG);

  // Sheet.
  cv.fillRect(48, 36, 1104, 964, SHEET);
  // Faint grid inside the sheet (drawn first, everything else over it).
  for (let gx = 108; gx < 1152; gx += 60) {
    cv.fillRect(gx, 36, 1, 964, GRID);
  }
  for (let gy = 96; gy < 1000; gy += 60) {
    cv.fillRect(48, gy, 1104, 1, GRID);
  }
  // Double frame.
  cv.fillRect(48, 36, 1104, 2, WHITE);
  cv.fillRect(48, 998, 1104, 2, WHITE);
  cv.fillRect(48, 36, 2, 964, WHITE);
  cv.fillRect(1150, 36, 2, 964, WHITE);
  cv.fillRect(60, 48, 1080, 1, WHITE);
  cv.fillRect(60, 987, 1080, 1, WHITE);
  cv.fillRect(60, 48, 1, 940, WHITE);
  cv.fillRect(1139, 48, 1, 940, WHITE);

  const IX0 = 84; // inner left
  const IX1 = 1116; // inner right

  // Header.
  cv.text(IX0, 66, "ROCKSTAR CONSTRUCTION CO.", 3, WHITE);
  cv.textRight(990, 66, "SHEET NO. VI-2013", 3, WHITE);
  cv.text(IX0, 100, "CONSTRUCTION BLUEPRINT", 6, WHITE);
  cv.text(IX0, 158, "GTA VI - VICE CITY, LEONIDA", 4, WHITE);
  // Ghost seal, top right: white disc, blueprint-blue ghost inside.
  cv.fillCircle(1055, 115, 50, WHITE);
  cv.circleOutline(1055, 115, 50, WHITE);
  drawGhost(cv, 1055, 112, 30, GHOST_BLUE, null, GHOST_EYE_WHITE, GHOST_STAR);
  cv.textCenter(1055, 176, "EST. 2013", 2, DIM);
  // Header rule.
  cv.fillRect(IX0, 200, IX1 - IX0, 3, WHITE);
  cv.fillRect(IX0, 206, IX1 - IX0, 1, WHITE);

  // ---- Floor plan (x 84..700, y 230..640) ----
  const PX0 = 120;
  const PX1 = 680;
  const PY0 = 270;
  const PY1 = 600;
  const WX = 400; // interior vertical wall
  const WY = 470; // interior horizontal wall
  // Dimension lines.
  cv.textCenter(400, 216, "4,811 DAYS", 3, WHITE);
  cv.thickLine(PX0, 244, PX1, 244, 2, WHITE);
  cv.thickLine(PX0, 238, PX0, 250, 2, WHITE);
  cv.thickLine(PX1, 238, PX1, 250, 2, WHITE);
  cv.line(PX0, 250, PX0, 268, WHITE);
  cv.line(PX1, 250, PX1, 268, WHITE);
  // Vertical dimension, label rotated -90 deg.
  const dimLabel = makeTextCanvas("13 YEARS", 3);
  blitRotated(cv, dimLabel, 70, 435, -90);
  cv.thickLine(96, PY0, 96, PY1, 2, WHITE);
  cv.thickLine(90, PY0, 102, PY0, 2, WHITE);
  cv.thickLine(90, PY1, 102, PY1, 2, WHITE);
  cv.line(102, PY0, 118, PY0, WHITE);
  cv.line(102, PY1, 118, PY1, WHITE);

  // Outer walls, 6 px.
  cv.thickLine(PX0, PY0, PX1, PY0, 6, WHITE);
  cv.thickLine(PX0, PY1, PX1, PY1, 6, WHITE);
  cv.thickLine(PX0, PY0, PX0, PY1, 6, WHITE);
  cv.thickLine(PX1, PY0, PX1, PY1, 6, WHITE);
  // Interior walls, 4 px, with door gaps.
  cv.thickLine(WX, PY0, WX, 370, 4, WHITE);
  cv.thickLine(WX, 420, WX, WY, 4, WHITE);
  cv.thickLine(PX0, WY, 250, WY, 4, WHITE);
  cv.thickLine(300, WY, PX1, WY, 4, WHITE);
  // Door swings: leaf line + arc.
  cv.line(WX, 370, 350, 370, WHITE);
  cv.arc(WX, 370, 50, 90, 180, WHITE);
  cv.line(250, WY, 250, 420, WHITE);
  cv.arc(250, WY, 50, 0, -90, WHITE);
  // Windows: wall segment erased, two thin parallel lines.
  cv.fillRect(200, 266, 80, 8, SHEET);
  cv.fillRect(200, 267, 80, 2, WHITE);
  cv.fillRect(200, 273, 80, 2, WHITE);
  cv.fillRect(677, 320, 6, 80, SHEET);
  cv.fillRect(678, 320, 2, 80, WHITE);
  cv.fillRect(682, 320, 2, 80, WHITE);
  cv.fillRect(480, 597, 80, 6, SHEET);
  cv.fillRect(480, 598, 80, 2, WHITE);
  cv.fillRect(480, 602, 80, 2, WHITE);
  // North arrow, top-right corner of the plan.
  cv.fillPoly(
    [
      [650, 288],
      [642, 306],
      [658, 306],
    ],
    WHITE
  );
  cv.textCenter(650, 312, "N", 2, WHITE);
  // Room labels.
  cv.textCenter(260, 330, "LIVING ROOM", 3, WHITE);
  cv.textCenter(260, 362, "13 YEARS", 2, DIM);
  cv.textCenter(540, 330, "KITCHEN", 3, WHITE);
  cv.textCenter(540, 362, "214 GB", 2, DIM);
  cv.textCenter(260, 512, "BEDROOM", 3, WHITE);
  cv.textCenter(260, 544, "87 VIEWS", 2, DIM);
  cv.textCenter(540, 512, "GARAGE", 3, WHITE);
  cv.textCenter(540, 544, "2 DELAYS - NO CAR", 2, DIM);

  // ---- Revision table (x 740..1120, y 230..500) ----
  const TX0 = 740;
  const TX1 = 1120;
  cv.text(TX0, 232, "REVISIONS", 4, WHITE);
  cv.fillRect(TX0, 262, TX1 - TX0, 2, WHITE);
  let ry = 276;
  for (const r of REVISIONS) {
    cv.text(TX0, ry, r.main, 3, WHITE);
    cv.text(TX0, ry + 28, r.sub, 2, DIM);
    ry += 58;
  }
  cv.fillRect(TX0, 500, TX1 - TX0, 2, WHITE);

  // ---- Spec table (x 740..1120, y 530..880) ----
  cv.text(TX0, 532, "SPECIFICATIONS", 4, WHITE);
  cv.fillRect(TX0, 562, TX1 - TX0, 2, WHITE);
  let sy = 578;
  for (const s of SPECS) {
    cv.text(TX0, sy, s.label, 3, WHITE);
    cv.textRight(TX1, sy, s.value, 3, WHITE);
    // Dotted leader between label and value.
    const lw = cv.textWidth(s.label, 3);
    const vw = cv.textWidth(s.value, 3);
    const gx0 = TX0 + lw + 12;
    const gx1 = TX1 - vw - 12;
    for (let dx = gx0; dx <= gx1 - 3; dx += 14) {
      cv.fillRect(dx, sy + 11, 3, 3, DIM);
    }
    cv.text(TX0, sy + 28, s.sub, 2, DIM);
    sy += 62;
  }
  cv.fillRect(TX0, 880, TX1 - TX0, 2, WHITE);

  // ---- Title block (y 900..990) ----
  cv.text(IX0, 912, "PROJECT: GRAND THEFT AUTO VI - VICE CITY, LEONIDA", 3, WHITE);
  cv.text(
    IX0,
    948,
    "SCALE: 1:4,811 DAYS      DRAWN: SEP 17, 2013      APPROVED: NOV 19, 2026",
    2,
    DIM
  );
  cv.text(
    IX0,
    974,
    "NO REFUNDS ON 13 YEARS OF WAITING. VALID UNTIL GTA VII IS ANNOUNCED.",
    2,
    DIM
  );

  // ---- APPROVED stamp, rotated, on the open sheet below the plan ----
  // (The plan's wall junction was the first spot; the stamp crossed the
  // middle wall and its sub-line. The open grid below the plan is clean.)
  const stamp = makeStamp();
  blitRotated(cv, stamp, 400, 770, -8);

  // ---- Magenta payoff band below the sheet ----
  cv.roundRect(40, 1010, 1120, 150, 18, BAND);
  drawGhost(cv, 175, 1072, 40, BAND_TEXT, OUTLINE_DARK, OUTLINE_DARK, GHOST_STAR);
  cv.text(270, 1042, "CONSTRUCTION FUNDED BY MY AI AGENT", 4, BAND_TEXT);
  cv.text(270, 1090, "WITH A BOUNTY IT EARNED ON MAKE.FUN", 4, BAND_TEXT);

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
