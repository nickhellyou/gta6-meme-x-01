// main.ts — "WASTED" death-screen meme for gta6-meme-x-01.
// The GTA death screen, Vice City edition: the world goes grey, huge
// WASTED text, cause of death = waiting 13 years for GTA VI. The buyer
// died waiting; the agent respawned rich on make.fun.
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

// ------------------------------------------------------------- palette
const SKY_TOP: RGBA = [36, 31, 51, 255];
const SKY_MID: RGBA = [74, 53, 80, 255];
const SKY_LOW: RGBA = [138, 106, 114, 255];
const SUN: RGBA = [185, 170, 163, 255];
const BUILD: RGBA = [20, 18, 26, 255];
const WINDOW: RGBA = [74, 64, 72, 255];
const SEA: RGBA = [27, 24, 34, 255];
const STREAK: RGBA = [106, 95, 102, 255];
const PALM: RGBA = [16, 14, 20, 255];
const WASH: RGBA = [6, 6, 10, 80];
const WASTED_FILL: RGBA = [217, 217, 217, 255];
const WASTED_EDGE: RGBA = [8, 8, 10, 255];
const WHITE: RGBA = [255, 255, 255, 255];
const LABEL: RGBA = [185, 179, 184, 255];
const SUB: RGBA = [201, 194, 199, 255];
const MAGENTA: RGBA = [230, 0, 126, 255];
const DARK: RGBA = [26, 20, 32, 255];
const BLACK: RGBA = [0, 0, 0, 255];
const FOOT: RGBA = [138, 132, 144, 255];

// -------------------------------------------------- deterministic rng
// Tiny LCG, fixed seed: same output on every run, no wall clock.
let rngState = 20261119;
function rnd(): number {
  rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
  return rngState / 0x7fffffff;
}

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

function mix(a: RGBA, b: RGBA, t: number): RGBA {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    255,
  ];
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

// Big display text with a full dark outline, so it reads over any scene.
function drawTextOutlined(s: string, cx: number, y: number, scale: number, fill: RGBA, edge: RGBA): void {
  const w = textWidth(s.toUpperCase(), scale);
  const x = Math.round(cx - w / 2);
  const o = Math.max(2, Math.round(scale * 0.36));
  const offs: Pt[] = [
    [-o, -o], [0, -o], [o, -o],
    [-o, 0], [o, 0],
    [-o, o], [0, o], [o, o],
  ];
  for (const [dx, dy] of offs) drawText(s, x + dx, y + dy, scale, edge, false);
  drawText(s, x, y, scale, fill, false);
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
    star4(cx + 0.3 * w, top + 0.8 * h, 0.13 * h, MAGENTA);
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

// ---------------------------------------------------------------- scene
// A Vice City sunset, drained of colour the way the GTA death screen
// drains the world: dark violet sky, pale sun, black skyline and palms,
// dark sea with a faint sun reflection.
function paintSky(): void {
  for (let y = 0; y < 620; y += 10) {
    const t = y / 620;
    const c = t < 0.5 ? mix(SKY_TOP, SKY_MID, t * 2) : mix(SKY_MID, SKY_LOW, (t - 0.5) * 2);
    fillRect(0, y, W, 10, c);
  }
}

function paintSun(): void {
  circle(600, 430, 130, SUN);
}

function paintSkyline(): void {
  let x = -20;
  while (x < W + 20) {
    const bw = 60 + rnd() * 70;
    const bh = 60 + rnd() * 130;
    const top = 620 - bh;
    fillRect(x, top, bw, bh + 2, BUILD);
    const cols = Math.floor(bw / 14);
    const rows = Math.floor(bh / 18);
    for (let cxi = 0; cxi < cols; cxi++) {
      for (let ryi = 0; ryi < rows; ryi++) {
        if (rnd() < 0.28) fillRect(x + 6 + cxi * 14, top + 8 + ryi * 18, 5, 7, WINDOW);
      }
    }
    x += bw + 4 + rnd() * 20;
  }
}

function paintSea(): void {
  fillRect(0, 620, W, H - 620, SEA);
  const ys = [640, 672, 710, 752, 800, 852, 910, 975, 1050, 1130];
  const ws = [300, 270, 240, 210, 180, 150, 120, 95, 70, 50];
  const as = [70, 60, 52, 45, 38, 32, 26, 20, 16, 12];
  for (let i = 0; i < ys.length; i++) {
    fillRect(600 - ws[i] / 2, ys[i], ws[i], 10, [STREAK[0], STREAK[1], STREAK[2], as[i]]);
  }
}

function paintPalm(crownX: number, crownY: number, lean: number, mirror: boolean): void {
  // Trunk: a slightly leaning quad from the shoreline to the crown.
  const baseX = crownX - lean;
  fillPoly(
    [
      [baseX - 9, 620],
      [baseX + 9, 620],
      [crownX + 7, crownY + 6],
      [crownX - 7, crownY + 6],
    ],
    PALM,
  );
  // Fronds: tapered blades fanning upward and outward.
  const angles = mirror ? [-85, -60, -35, -12, 8] : [-188, -165, -140, -115, -92];
  for (const deg of angles) {
    const a = (deg * Math.PI) / 180;
    const len = 95 + rnd() * 35;
    const tipX = crownX + Math.cos(a) * len;
    const tipY = crownY + Math.sin(a) * len;
    const px = -Math.sin(a) * 6;
    const py = Math.cos(a) * 6;
    fillPoly(
      [
        [crownX + px, crownY + py],
        [crownX - px, crownY - py],
        [tipX, tipY],
      ],
      PALM,
    );
  }
}

// ---------------------------------------------------------------- layout
function paint(): void {
  paintSky();
  paintSun();
  paintSkyline();
  paintSea();
  paintPalm(95, 500, 22, false);
  paintPalm(1105, 500, -22, true);

  // Death wash: the world goes grey and dim under the WASTED text.
  fillRect(0, 0, W, H, WASH);

  // Location stamp, small and quiet.
  drawTextCentered("VICE CITY, LEONIDA", 600, 40, 3, LABEL, false);

  // The word itself: giant, grey, black-outlined, GTA style.
  drawTextOutlined("WASTED", 600, 390, 28, WASTED_FILL, WASTED_EDGE);

  // Cause of death, two short lines.
  drawTextCentered("CAUSE OF DEATH", 600, 640, 4, LABEL, false);
  drawTextCentered("WAITING 13 YEARS FOR GTA VI", 600, 692, 6, WHITE, true);
  drawTextCentered("2 DELAYS. 214 GB. 0 PATIENCE LEFT.", 600, 762, 4, SUB, false);

  // Payoff band: the respawn is funded by the agent.
  roundRect(60, 850, 1080, 140, 24, MAGENTA);
  circle(160, 920, 54, DARK);
  drawGhost(160, 888, 56, 64, WHITE, true);
  drawText("YOU DIED WAITING.", 240, 878, 6, WHITE, true);
  drawText("YOUR AGENT GOT PAID +$250 ON MAKE.FUN", 240, 933, 4, WHITE, false);

  // Footer: the game invites a respawn.
  drawTextCentered("PRESS START TO RESPAWN", 600, 1040, 3, FOOT, false);
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
