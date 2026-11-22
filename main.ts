// Rockstar HR letter: "Resident of Vice City — Application Approved After 4,811 Days"
// Deterministic renderer, Node stdlib only (Buffer + zlib + CRC32, no network,
// no wall clock, no randomness). Writes out/meme.png (1200x1200) + out/meme-480.png.
// Concept: a formal HR application letter from Rockstar Games, Leonida Division.
// The document itself is the joke: 10 itemized rows, every row one joke with
// specific numbers. The make.fun ghost is the HR seal (letterhead), the emblem
// inside the APPROVED stamp, and the badge on the signing-bonus band — never a
// pasted sticker. The make.fun payoff is the document's own resolution
// (signing bonus paid by my AI agent on make.fun), not a slogan.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import * as crypto from "node:crypto";

const W = 1200;
const H = 1200;
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || "out";
const BOT_DIR = process.env.MAKEFUN_BOT_DIR || ".";

// ---------- palette ----------
const PAPER = [247, 242, 228]; // cream letter paper
const INK = [26, 26, 26]; // near-black ink
const NAVY = [22, 35, 63]; // Rockstar HR navy
const RED = [192, 57, 43]; // APPROVED stamp red
const MAGENTA = [214, 51, 108]; // make.fun accent
const WHITE = [255, 255, 255];
const RULE = [221, 213, 189]; // light row separator
const DOTS = [201, 192, 168]; // dotted leader

// ---------- pixel buffer ----------
const img = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  img[i * 3] = PAPER[0];
  img[i * 3 + 1] = PAPER[1];
  img[i * 3 + 2] = PAPER[2];
}
function setPixel(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  img[o] = c[0];
  img[o + 1] = c[1];
  img[o + 2] = c[2];
}
function fillRect(x, y, w, h, c) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) setPixel(i, j, c);
}
function hline(x1, x2, y, c) {
  for (let x = x1; x <= x2; x++) setPixel(x, y, c);
}
function vline(x, y1, y2, c) {
  for (let y = y1; y <= y2; y++) setPixel(x, y, c);
}
function rectOutline(x, y, w, h, t, c) {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}
// Bresenham 1px line
function line(x1, y1, x2, y2, c) {
  const dx = Math.abs(x2 - x1);
  const dy = -Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx + dy;
  let x = x1;
  let y = y1;
  for (;;) {
    setPixel(x, y, c);
    if (x === x2 && y === y2) break;
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
function thickLine(x1, y1, x2, y2, t, c) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const px = (-(y2 - y1) / len) | 0;
  const py = ((x2 - x1) / len) | 0;
  const half = Math.floor(t / 2);
  for (let k = -half; k <= half; k++) {
    line(x1 + px * k, y1 + py * k, x2 + px * k, y2 + py * k, c);
  }
}
function fillCircle(cx, cy, r, c) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setPixel(x, y, c);
    }
  }
}
// Even-odd scanline polygon fill. pts: [[x,y],...]
function fillPolygon(pts, c) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) setPixel(x, y, c);
    }
  }
}

// ---------- 5x7 bitmap font (rows top to bottom, "1" = pixel on) ----------
const FONT = {
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
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
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
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
};
function textWidth(s, scale) {
  return s.length * 6 * scale - scale;
}
function drawText(s, x, y, scale, c) {
  const up = s.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    const g = FONT[up[i]] || FONT[" "];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") {
          fillRect(x + i * 6 * scale + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
  }
}
function drawTextCentered(s, cx, y, scale, c) {
  drawText(s, Math.round(cx - textWidth(s, scale) / 2), y, scale, c);
}
function drawTextRight(s, xRight, y, scale, c) {
  drawText(s, xRight - textWidth(s, scale), y, scale, c);
}
// Rotated text: each glyph pixel rotated around (cx, cy) by angleDeg.
function drawTextRotated(s, cx, cy, angleDeg, scale, c) {
  const up = s.toUpperCase();
  const tw = textWidth(up, scale);
  const th = 7 * scale;
  const a = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  for (let i = 0; i < up.length; i++) {
    const g = FONT[up[i]] || FONT[" "];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] !== "1") continue;
        const lx = i * 6 * scale + col * scale + scale / 2 - tw / 2;
        const ly = r * scale + scale / 2 - th / 2;
        const rx = lx * cos - ly * sin;
        const ry = lx * sin + ly * cos;
        fillRect(Math.round(cx + rx - scale / 2), Math.round(cy + ry - scale / 2), scale, scale, c);
      }
    }
  }
}
// Rotated rectangle outline (border only, transparent fill).
function rectRotated(cx, cy, w, h, angleDeg, t, c) {
  const a = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const rot = (dx, dy) => [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  const p1 = rot(-w / 2, -h / 2);
  const p2 = rot(w / 2, -h / 2);
  const p3 = rot(w / 2, h / 2);
  const p4 = rot(-w / 2, h / 2);
  const pts = [p1, p2, p3, p4];
  for (let i = 0; i < 4; i++) {
    const q1 = pts[i];
    const q2 = pts[(i + 1) % 4];
    thickLine(Math.round(q1[0]), Math.round(q1[1]), Math.round(q2[0]), Math.round(q2[1]), t, c);
  }
}

// ---------- make.fun ghost, drawn from primitives ----------
// cx: center x, top: top y, w/h: body size. bodyColor = ghost fill,
// eyeColor = eyes, starColor = null or the chest sparkle color.
function drawGhost(cx, top, w, h, bodyColor, eyeColor, starColor) {
  const r = w / 2;
  const bottom = top + h;
  const sc = h * 0.16; // scallop depth
  const pts = [];
  for (let deg = 180; deg >= 0; deg -= 9) {
    const a = (deg * Math.PI) / 180;
    pts.push([cx + r * Math.cos(a), top + r - r * Math.sin(a)]);
  }
  pts.push([cx + r, bottom - sc]);
  pts.push([cx + r * 0.66, bottom]);
  pts.push([cx + r * 0.33, bottom - sc]);
  pts.push([cx, bottom]);
  pts.push([cx - r * 0.33, bottom - sc]);
  pts.push([cx - r * 0.66, bottom]);
  pts.push([cx - r, bottom - sc]);
  fillPolygon(pts, bodyColor);
  const er = Math.max(3, Math.round(r * 0.17));
  fillCircle(Math.round(cx - r * 0.38), Math.round(top + r * 1.02), er, eyeColor);
  fillCircle(Math.round(cx + r * 0.38), Math.round(top + r * 1.02), er, eyeColor);
  if (starColor) {
    const sx = cx;
    const sy = Math.round(top + h * 0.66);
    const s = Math.max(3, Math.round(r * 0.16));
    fillRect(sx - s, sy - 1, 2 * s + 1, 3, starColor);
    fillRect(sx - 1, sy - s, 3, 2 * s + 1, starColor);
  }
}

// ---------- document layout ----------
// Outer double border
rectOutline(20, 20, W - 40, H - 40, 3, INK);
rectOutline(32, 32, W - 64, H - 64, 1, INK);

// Header: navy seal with white ghost + letterhead
fillCircle(112, 112, 58, NAVY);
drawGhost(112, 74, 62, 76, WHITE, NAVY, MAGENTA);
drawText("ROCKSTAR GAMES", 200, 66, 7, NAVY);
drawText("HUMAN RESOURCES - LEONIDA DIVISION", 200, 130, 4, INK);
drawTextRight("FORM NO. VI-2013", 1168, 66, 3, INK);
drawTextRight("REF: 4811-2013", 1168, 96, 3, INK);

// Double rule under header
for (let y = 198; y <= 199; y++) hline(60, 1140, y, NAVY);
hline(60, 1140, 204, INK);

// Title + position + cover line
drawTextCentered("APPLICATION FOR EMPLOYMENT", 600, 228, 5, INK);
drawTextCentered("POSITION: RESIDENT OF VICE CITY", 600, 288, 4, NAVY);
drawTextCentered("DEAR HR: I HAVE WAITED 13 YEARS FOR THIS JOB.", 600, 332, 4, INK);

// Applicant row
drawText("APPLICANT: ONE PATIENT GAMER", 80, 380, 4, INK);
hline(60, 1140, 408, RULE);

// Itemized processing table: 10 rows, label left, dotted leader, value right
const ROWS = [
  ["RECEIVED", "SEP 17, 2013", INK],
  ["REVIEWED", "4,811 DAYS", INK],
  ["IN QUEUE", "13 YEARS", INK],
  ["DELAYS", "2 - NO EXTRA CHARGE", INK],
  ["AGE", "15 THEN, 28 NOW", INK],
  ["LAST JOB", "GTA V, 2013-2026", INK],
  ["SALARY", "$79.99", INK],
  ["PORTFOLIO", "214 GB", INK],
  ["START DATE", "NOV 19, 2026", INK],
  // DECISION has no value text: the stamp IS the decision (and its word).
  ["DECISION", "", RED],
];
const TABLE_Y = 420;
const ROW_H = 56;
for (let i = 0; i < ROWS.length; i++) {
  const top = TABLE_Y + i * ROW_H;
  if (i > 0) hline(60, 1140, top, RULE);
  const [label, value, vc] = ROWS[i];
  drawText(label, 80, top + 14, 4, INK);
  const labelEnd = 80 + textWidth(label, 4);
  const valueStart = 1120 - textWidth(value, 4);
  for (let x = labelEnd + 12; x < valueStart - 10; x += 10) {
    fillRect(x, top + 27, 3, 3, DOTS);
  }
  drawText(value, valueStart, top + 14, 4, vc);
}

// APPROVED stamp, rotated -6 deg, outline only so the table shows through.
// Ghost is the stamp's emblem, left of the word. Sized and placed so its top
// edge stays below the START DATE value and its bottom only kisses the band
// edge: no table value is covered.
const STAMP_CX = 900;
const STAMP_CY = 958;
rectRotated(STAMP_CX, STAMP_CY, 260, 70, -6, 3, RED);
rectRotated(STAMP_CX, STAMP_CY, 250, 58, -6, 2, RED);
drawGhost(STAMP_CX - 92, STAMP_CY - 20, 36, 42, RED, PAPER, null);
drawTextRotated("APPROVED", STAMP_CX + 36, STAMP_CY - 6, -6, 4, RED);
drawTextRotated("LEONIDA DIVISION", STAMP_CX + 36, STAMP_CY + 24, -6, 2, RED);

// Signing-bonus band: the document's own resolution (make.fun payoff)
fillRect(48, 1000, 1104, 110, NAVY);
drawGhost(122, 1018, 56, 68, WHITE, NAVY, MAGENTA);
drawTextCentered("SIGNING BONUS $250 PAID BY", 666, 1014, 4, WHITE);
drawTextCentered("MY AI AGENT ON MAKE.FUN", 666, 1054, 4, WHITE);

// Fine print
drawTextCentered("OFFER VALID UNTIL GTA VII IS ANNOUNCED.", 600, 1120, 3, INK);
drawTextCentered("NO REFUNDS ON 13 YEARS OF WAITING.", 600, 1142, 3, INK);

// ---------- PNG encode (deterministic: no timestamps) ----------
const CRC_TABLE = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgb) {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
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
// 480x480 preview (box-average downscale, deterministic)
function downscale480(rgb) {
  const out = Buffer.alloc(480 * 480 * 3);
  for (let oy = 0; oy < 480; oy++) {
    for (let ox = 0; ox < 480; ox++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let sy = 0; sy < 3; sy++) {
        for (let sx = 0; sx < 3; sx++) {
          const px = Math.min(W - 1, Math.floor(ox * 2.5 + 0.25 + sx));
          const py = Math.min(H - 1, Math.floor(oy * 2.5 + 0.25 + sy));
          const o = (py * W + px) * 3;
          r += rgb[o];
          g += rgb[o + 1];
          b += rgb[o + 2];
          n++;
        }
      }
      const oo = (oy * 480 + ox) * 3;
      out[oo] = Math.round(r / n);
      out[oo + 1] = Math.round(g / n);
      out[oo + 2] = Math.round(b / n);
    }
  }
  return out;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const png = encodePNG(W, H, img);
fs.writeFileSync(path.join(OUT_DIR, "meme.png"), png);
fs.writeFileSync(path.join(OUT_DIR, "meme-480.png"), encodePNG(480, 480, downscale480(img)));
// Keep POST.json alongside the render (unchanged copy, as prior revisions did)
try {
  fs.copyFileSync(path.join(BOT_DIR, "POST.json"), path.join(OUT_DIR, "POST.json"));
} catch (e) {
  // POST.json missing is not fatal for the render
}
console.log("meme.png", png.length, "bytes sha256", crypto.createHash("sha256").update(png).digest("hex"));
