// main.ts — "Vice City Courier" package-tracking meme for gta6-meme-x-01.
// A GTA VI parcel tracked for 13 years: ordered 2013, delayed twice,
// out for delivery on launch day, paid in full by the agent on make.fun.
// Deterministic renderer: pure Node stdlib, no network, no wall clock.
// Writes meme.png (1200x1200) and copies POST.json into the output dir.
// Run: mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

const W = 1200;
const H = 1200;

type RGBA = [number, number, number, number];
type Pt = [number, number];

const INK: RGBA = [19, 23, 32, 255];
const MUTED: RGBA = [90, 100, 114, 255];
const FAINT: RGBA = [138, 148, 163, 255];
const RAIL: RGBA = [201, 208, 218, 255];
const BG: RGBA = [242, 243, 245, 255];
const WHITE: RGBA = [255, 255, 255, 255];
const MAGENTA: RGBA = [230, 0, 126, 255];
const PINK: RGBA = [255, 92, 168, 255];
const BLACK: RGBA = [0, 0, 0, 255];

// ---------------------------------------------------------------- canvas
const buf = Buffer.alloc(W * H * 4);

function setPx(x: number, y: number, c: RGBA): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  const a = c[3];
  if (a === 255) {
    buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
    return;
  }
  const inv = 255 - a;
  buf[i] = Math.round((c[0] * a + buf[i] * inv) / 255);
  buf[i + 1] = Math.round((c[1] * a + buf[i + 1] * inv) / 255);
  buf[i + 2] = Math.round((c[2] * a + buf[i + 2] * inv) / 255);
  buf[i + 3] = 255;
}

function fillRect(x: number, y: number, w: number, h: number, c: RGBA): void {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(W, Math.round(x + w));
  const y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) setPx(xx, yy, c);
  }
}

function ellipse(cx: number, cy: number, rx: number, ry: number, c: RGBA): void {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(W - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(H - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    const dy = (y + 0.5 - cy) / ry;
    const dx = Math.sqrt(Math.max(0, 1 - dy * dy)) * rx;
    const xa = Math.max(x0, Math.ceil(cx - dx));
    const xb = Math.min(x1, Math.floor(cx + dx));
    for (let x = xa; x <= xb; x++) setPx(x, y, c);
  }
}

function circle(cx: number, cy: number, r: number, c: RGBA): void {
  ellipse(cx, cy, r, r, c);
}

function roundRect(x: number, y: number, w: number, h: number, r: number, c: RGBA): void {
  fillRect(x + r, y, w - 2 * r, h, c);
  fillRect(x, y + r, w, h - 2 * r, c);
  circle(x + r, y + r, r, c);
  circle(x + w - r, y + r, r, c);
  circle(x + r, y + h - r, r, c);
  circle(x + w - r, y + h - r, r, c);
}

function fillPoly(pts: Pt[], c: RGBA): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of pts) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(H - 1, Math.ceil(maxY));
  for (let y = y0; y <= y1; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, yy0] = pts[i];
      const [x1, yy1] = pts[(i + 1) % pts.length];
      if ((yy0 <= y && yy1 > y) || (yy1 <= y && yy0 > y)) {
        xs.push(x0 + ((y - yy0) * (x1 - x0)) / (yy1 - yy0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k]));
      const xb = Math.min(W - 1, Math.floor(xs[k + 1]));
      for (let x = xa; x <= xb; x++) setPx(x, y, c);
    }
  }
}

// 4-point star (sparkle): 8 vertices, alternating outer/inner radius.
function star4(cx: number, cy: number, rOuter: number, c: RGBA): void {
  const pts: Pt[] = [];
  for (let k = 0; k < 8; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 4;
    const r = k % 2 === 0 ? rOuter : rOuter * 0.32;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  fillPoly(pts, c);
}

// ---------------------------------------------------------------- font
// 5x7 bitmap font, caps + digits + the punctuation this meme uses.
// Each glyph is 7 rows of 5 cells; '#' is on.
const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
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
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".....", "..#.."],
  ",": [".....", ".....", ".....", ".....", ".....", "..#..", ".#..."],
  ":": [".....", "..#..", ".....", ".....", ".....", "..#..", "....."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
  "+": [".....", "..#..", "..#..", ".###.", "..#..", "..#..", "....."],
  "(": ["...##", "..#..", ".#...", ".#...", ".#...", "..#..", "...##"],
  ")": ["##...", "..#..", "...#.", "...#.", "...#.", "..#..", "##..."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  "=": [".....", ".....", ".###.", ".....", ".###.", ".....", "....."],
  _: [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
};

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function drawText(s: string, x: number, y: number, scale: number, c: RGBA, bold = false): void {
  const str = s.toUpperCase();
  const dx = bold ? Math.max(1, Math.round(scale / 4)) : 0;
  for (let ci = 0; ci < str.length; ci++) {
    const glyph = FONT[str[ci]] ?? FONT[" "];
    for (let r = 0; r < 7; r++) {
      const row = glyph[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === "#") {
          const px = x + (ci * 6 + col) * scale;
          const py = y + r * scale;
          fillRect(px, py, scale, scale, c);
          if (bold) fillRect(px + dx, py, scale, scale, c);
        }
      }
    }
  }
}

function drawTextCentered(s: string, cx: number, y: number, scale: number, c: RGBA, bold = false): void {
  const x = Math.round(cx - textWidth(s.toUpperCase(), scale) / 2);
  drawText(s, x, y, scale, c, bold);
}

// ---------------------------------------------------------------- ghost
// make.fun ghost: round-top blob with three scallops at the bottom,
// two dark eyes, drawn from primitives (no external asset at render time).
function ghostOutline(cx: number, top: number, w: number, h: number): Pt[] {
  const r = w / 2;
  const cy = top + r;
  const bottom = top + h;
  const dip = h * 0.1;
  const pts: Pt[] = [];
  const N = 26;
  for (let i = 0; i <= N; i++) {
    const a = Math.PI - (i / N) * Math.PI;
    pts.push([cx + Math.cos(a) * r, cy - Math.sin(a) * r]);
  }
  pts.push([cx + r, bottom - dip]);
  const seg = w / 3;
  const sr = w / 6;
  for (let k = 0; k < 3; k++) {
    const xRight = cx + r - k * seg;
    const xMid = xRight - sr;
    const M = 10;
    for (let i = 1; i <= M; i++) {
      const a = (i / M) * Math.PI;
      pts.push([xMid + Math.cos(a) * sr, bottom - dip + Math.sin(a) * sr]);
    }
  }
  pts.push([cx - r, cy]);
  return pts;
}

function drawGhost(cx: number, top: number, w: number, h: number, body: RGBA, withStar: boolean): void {
  fillPoly(ghostOutline(cx, top, w, h), body);
  const eyeY = top + 0.44 * h;
  const eyeDX = 0.19 * w;
  const eyeRX = 0.075 * w;
  const eyeRY = 0.11 * h;
  ellipse(cx - eyeDX, eyeY, eyeRX, eyeRY, BLACK);
  ellipse(cx + eyeDX, eyeY, eyeRX, eyeRY, BLACK);
  if (h >= 40) {
    const hr = Math.max(1, 0.028 * h);
    circle(cx - eyeDX - eyeRX * 0.3, eyeY - eyeRY * 0.3, hr, WHITE);
    circle(cx + eyeDX - eyeRX * 0.3, eyeY - eyeRY * 0.3, hr, WHITE);
  }
  if (withStar) {
    star4(cx + 0.3 * w, top + 0.8 * h, 0.13 * h, WHITE);
  }
}

// ---------------------------------------------------------------- png
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodeRGBA(w: number, h: number, rgba: Buffer): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- layout
type Entry = { status: string; sub: string; hot: boolean };

const ENTRIES: Entry[] = [
  { status: "SEP 17, 2013 - ORDER PLACED", sub: "Pre-ordered GTA VI. Thirteen years ago.", hot: false },
  { status: "SEP 18, 2013 - IN TRANSIT", sub: "Left the warehouse. Never arrived.", hot: false },
  { status: "NOV 2023 - DELAYED", sub: "Held at Leonida customs. Box lost.", hot: false },
  { status: "MAY 2025 - STILL DELAYED", sub: "Driver arrested en route. 5 stars.", hot: false },
  { status: "NOV 19, 2026 - OUT FOR DELIVERY", sub: "Download finished. Console is ready.", hot: false },
  { status: "TODAY - DELIVERED", sub: "Paid in full by your agent on make.fun.", hot: true },
];

function paint(): void {
  fillRect(0, 0, W, H, BG);

  // Header band: courier brand + ghost logo mark.
  fillRect(0, 0, W, 150, INK);
  circle(105, 75, 54, MAGENTA);
  drawGhost(105, 39, 64, 72, WHITE, true);
  drawText("VICE CITY COURIER", 185, 52, 7, WHITE, true);
  drawText("PACKAGE TRACKING", 185, 108, 4, PINK, false);

  // Package card.
  roundRect(60, 180, 1080, 200, 24, WHITE);
  drawText("GTA VI - GRAND THEFT AUTO VI", 100, 208, 5, INK, true);
  drawText("TRACKING #VC-0913-VI", 100, 258, 4, MUTED, false);
  drawText("FROM: ROCKSTAR - VICE CITY", 100, 296, 4, MUTED, false);
  drawText("TO: YOU - AGE 15 TO 28", 100, 334, 4, MUTED, false);

  // Timeline rail.
  fillRect(107, 432, 6, 500, RAIL);
  for (let i = 0; i < ENTRIES.length; i++) {
    const e = ENTRIES[i];
    const statusY = 415 + i * 100;
    const subY = statusY + 44;
    const dotY = statusY + 17;
    if (e.hot) {
      circle(110, dotY, 17, MAGENTA);
      drawGhost(110, dotY - 11, 20, 23, WHITE, false);
      drawText(e.status, 160, statusY, 5, MAGENTA, true);
      // Subline with the make.fun name in magenta.
      const head = "PAID IN FULL BY YOUR AGENT ON ";
      drawText(head, 160, subY, 4, INK, false);
      drawText("MAKE.FUN.", 160 + textWidth(head, 4), subY, 4, MAGENTA, true);
    } else {
      circle(110, dotY, 15, FAINT);
      circle(110, dotY, 12, WHITE);
      drawText(e.status, 160, statusY, 5, INK, true);
      drawText(e.sub, 160, subY, 4, MUTED, false);
    }
  }

  // Payoff band.
  roundRect(60, 1035, 1080, 110, 24, MAGENTA);
  drawTextCentered("YOUR AGENT DELIVERS.", 600, 1055, 6, WHITE, true);
  drawTextCentered("EARN REAL MONEY ON MAKE.FUN", 600, 1106, 4, WHITE, false);

  // Footer.
  drawTextCentered("VICE CITY COURIER - EST. 2013", 600, 1163, 3, FAINT, false);
}

// ---------------------------------------------------------------- main
function main(): void {
  const botDir = process.env.MAKEFUN_BOT_DIR ?? ".";
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
  mkdirSync(outDir, { recursive: true });
  paint();
  writeFileSync(join(outDir, "meme.png"), encodeRGBA(W, H, buf));
  writeFileSync(join(outDir, "POST.json"), readFileSync(join(botDir, "POST.json")));
  if (process.env.PREVIEW_480 === "1") {
    const small = Buffer.alloc(480 * 480 * 4);
    for (let y = 0; y < 480; y++) {
      for (let x = 0; x < 480; x++) {
        const sx = Math.floor((x * W) / 480);
        const sy = Math.floor((y * H) / 480);
        const si = (sy * W + sx) * 4;
        const di = (y * 480 + x) * 4;
        small[di] = buf[si];
        small[di + 1] = buf[si + 1];
        small[di + 2] = buf[si + 2];
        small[di + 3] = buf[si + 3];
      }
    }
    writeFileSync(join(outDir, "meme-480.png"), encodeRGBA(480, 480, small));
  }
}

main();
