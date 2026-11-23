// Leonida Mobile phone bill — "13 Years, 0 Bars Since 2013"
// Deterministic renderer, Node stdlib only (Buffer + zlib deflate level 9
// + hand-rolled CRC32). No network, no wall clock, no randomness. The only
// environment inputs are MAKEFUN_OUTPUT_DIR (where to write) and
// PREVIEW_480 (whether to also write a 480x480 preview copy); neither one
// changes the picture itself.
//
// Layout (1200x1200, cream paper, navy header):
//   navy header band with ghost operator logo + LEONIDA MOBILE /
//   MONTHLY STATEMENT + statement no. / due date
//   account + period block (with 158 MONTHS ON THIS PLAN set at the same
//   size as the account line, right aligned with real clearance)
//   ITEMIZED CHARGES table, 8 rows, each a joke + a sub-line joke, dotted
//   leaders that always stop exactly 14 px before the price
//   TOTAL DUE $79.99 + punchline, red PAID stamp (small canvas, blitted
//   rotated -8 deg), 4 lines of fine print, magenta payoff band.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

// ---------------------------------------------------------------- palette
const PAPER = [246, 238, 220];
const NAVY = [23, 50, 78];
const NAVY_DARK = [16, 36, 58];
const RED = [200, 16, 46];
const MAGENTA = [216, 17, 89];
const WHITE = [255, 255, 255];
const SUB = [74, 90, 106];
const RULE_LIGHT = [206, 196, 170];
const GHOST_SPARK = [216, 17, 89];

const W = 1200;
const H = 1200;

// ------------------------------------------------------------------- CRC32
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(canvas, w, h) {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    canvas.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------- 5x7 bitmap font
// Each glyph: 7 rows of 5 bits, written as strings, left to right, top to bottom.
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
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
};

// ------------------------------------------------------------------- canvas
function makeCanvas(w, h, bg) {
  const buf = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    buf[i * 3] = bg[0];
    buf[i * 3 + 1] = bg[1];
    buf[i * 3 + 2] = bg[2];
  }
  return buf;
}

function setPx(buf, w, h, x, y, c) {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const i = (y * w + x) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

function fillRect(buf, w, h, x, y, rw, rh, c) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(w, Math.round(x + rw));
  const y1 = Math.min(h, Math.round(y + rh));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * w + xx) * 3;
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
    }
  }
}

function fillCircle(buf, w, h, cx, cy, r, c) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) setPx(buf, w, h, x, y, c);
    }
  }
}

function strokeRect(buf, w, h, x, y, rw, rh, t, c) {
  fillRect(buf, w, h, x, y, rw, t, c);
  fillRect(buf, w, h, x, y + rh - t, rw, t, c);
  fillRect(buf, w, h, x, y, t, rh, c);
  fillRect(buf, w, h, x + rw - t, y, t, rh, c);
}

// Rounded-corner filled rect (band). Corners are cut by radius r.
function fillRoundRect(buf, w, h, x, y, rw, rh, r, c) {
  fillRect(buf, w, h, x + r, y, rw - 2 * r, rh, c);
  fillRect(buf, w, h, x, y + r, rw, rh - 2 * r, c);
  fillCircle(buf, w, h, x + r, y + r, r, c);
  fillCircle(buf, w, h, x + rw - r - 1, y + r, r, c);
  fillCircle(buf, w, h, x + r, y + rh - r - 1, r, c);
  fillCircle(buf, w, h, x + rw - r - 1, y + rh - r - 1, r, c);
}

// --------------------------------------------------------------------- text
function textWidth(s, scale) {
  return s.length * 6 * scale - scale;
}

// align: "left" | "center" | "right". x is the anchor for the chosen align.
function drawText(buf, w, h, s, x, y, scale, color, align) {
  let ox = x;
  if (align === "center") ox = x - Math.floor(textWidth(s, scale) / 2);
  if (align === "right") ox = x - textWidth(s, scale);
  for (let ci = 0; ci < s.length; ci++) {
    const g = FONT[s[ci]];
    if (!g) continue;
    const gx = ox + ci * 6 * scale;
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row][col] !== "1") continue;
        fillRect(buf, w, h, gx + col * scale, y + row * scale, scale, scale, color);
      }
    }
  }
}

// -------------------------------------------------------------------- ghost
// Drawn from primitives: dome (circle + body rect), 3 scallops cut from
// the bottom edge with the background colour, two eyes, one sparkle.
function drawGhost(buf, w, h, x, y, gw, gh, body, bg, sparkle) {
  const r = gw / 2;
  const cx = x + gw / 2;
  // dome + body
  fillCircle(buf, w, h, cx, y + r, r, body);
  fillRect(buf, w, h, x, y + r, gw, gh - r, body);
  // 3 scallops: background-coloured discs centred on the bottom edge
  const sr = gw / 6;
  for (let i = 0; i < 3; i++) {
    fillCircle(buf, w, h, x + gw / 6 + (i * gw) / 3, y + gh, sr, bg);
  }
  // eyes
  const er = Math.max(2, Math.round(gw * 0.075));
  fillCircle(buf, w, h, cx - gw * 0.16, y + gh * 0.38, er, NAVY_DARK);
  fillCircle(buf, w, h, cx + gw * 0.16, y + gh * 0.38, er, NAVY_DARK);
  // sparkle: small thin 4-point star on the chest (thin arms, so it reads
  // as a sparkle, not a plus/cross)
  const sx = cx;
  const sy = y + gh * 0.64;
  const arm = Math.max(5, Math.round(gw * 0.08));
  const thick = Math.max(2, Math.round(gw * 0.028));
  fillRect(buf, w, h, Math.round(sx - thick / 2), Math.round(sy - arm), thick, arm * 2, sparkle);
  fillRect(buf, w, h, Math.round(sx - arm), Math.round(sy - thick / 2), arm * 2, thick, sparkle);
}

// -------------------------------------------------------------------- stamp
// Rendered to its own small canvas, then blitted rotated onto the page.
function makeStamp() {
  const sw = 340;
  const sh = 96;
  const c = makeCanvas(sw, sh, PAPER);
  strokeRect(c, sw, sh, 2, 2, sw - 4, sh - 4, 3, RED);
  strokeRect(c, sw, sh, 9, 9, sw - 18, sh - 18, 2, RED);
  drawText(c, sw, sh, "PAID", sw / 2, 14, 6, RED, "center");
  drawText(c, sw, sh, "BY MY AI AGENT ON MAKE.FUN", sw / 2, 62, 2, RED, "center");
  return { buf: c, w: sw, h: sh };
}

function blitRotated(dst, dw, dh, stamp, cx, cy, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const rad = Math.ceil(Math.hypot(stamp.w, stamp.h) / 2) + 2;
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dx = -rad; dx <= rad; dx++) {
      // inverse rotation: source coords for this destination offset
      const rsx = Math.round(dx * cos + dy * sin + stamp.w / 2);
      const rsy = Math.round(-dx * sin + dy * cos + stamp.h / 2);
      if (rsx < 0 || rsy < 0 || rsx >= stamp.w || rsy >= stamp.h) continue;
      const si = (rsy * stamp.w + rsx) * 3;
      setPx(dst, dw, dh, cx + dx, cy + dy, [stamp.buf[si], stamp.buf[si + 1], stamp.buf[si + 2]]);
    }
  }
}

// ------------------------------------------------------------ 480 preview
function downscale480(src, w, h) {
  const dw = 480;
  const dh = 480;
  const out = Buffer.alloc(dw * dh * 3);
  const sx = w / dw;
  const sy = h / dh;
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      const y0 = Math.floor(y * sy);
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * w + xx) * 3;
          r += src[i];
          g += src[i + 1];
          b += src[i + 2];
          n++;
        }
      }
      const o = (y * dw + x) * 3;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
    }
  }
  return out;
}

// -------------------------------------------------------------------- build
function build() {
  const img = makeCanvas(W, H, PAPER);

  // Outer double frame
  strokeRect(img, W, H, 24, 24, W - 48, H - 48, 3, NAVY);
  strokeRect(img, W, H, 34, 34, W - 68, H - 68, 1, NAVY);

  // ---- header band (navy), y 38..192
  fillRect(img, W, H, 38, 38, W - 76, 154, NAVY);
  drawGhost(img, W, H, 62, 60, 100, 116, WHITE, NAVY, GHOST_SPARK);
  drawText(img, W, H, "LEONIDA MOBILE", 188, 66, 6, WHITE, "left");
  drawText(img, W, H, "MONTHLY STATEMENT", 188, 128, 4, WHITE, "left");
  drawText(img, W, H, "STATEMENT NO. 000013", 1140, 72, 3, WHITE, "right");
  drawText(img, W, H, "DUE: NOV 19, 2026", 1140, 116, 3, WHITE, "right");

  // ---- account block
  drawText(img, W, H, "ACCOUNT: ONE PATIENT GAMER", 56, 216, 4, NAVY, "left");
  drawText(img, W, H, "158 MONTHS ON THIS PLAN", 1144, 220, 3, SUB, "right");
  drawText(img, W, H, "PERIOD: SEP 17, 2013 - NOV 19, 2026", 56, 260, 4, NAVY, "left");

  // ---- table header
  fillRect(img, W, H, 56, 306, 1088, 2, NAVY);
  drawText(img, W, H, "ITEMIZED CHARGES", 56, 322, 4, NAVY, "left");
  drawText(img, W, H, "AMOUNT", 1144, 326, 3, SUB, "right");
  fillRect(img, W, H, 56, 356, 1088, 2, NAVY);

  // ---- 8 charge rows. Label scale 4, sub-line scale 3, row height 58.
  // Dotted leaders always run from the end of the label to exactly 14 px
  // before the price, so no row has a ragged gap.
  const PRICE_X = 1144;
  const rows = [
    { label: "MONTHLY PLAN - UNLIMITED PATIENCE", sub: "ONE PLAN. ONE GAME. STILL WAITING.", price: "$79.99", red: false },
    { label: "DATA - 214 GB, TRAILER 2 (87 VIEWS)", sub: "BUFFERED 13 YEARS. STILL LOADING.", price: "$0.00", red: false },
    { label: "CALLS TO ROCKSTAR SUPPORT - 4,811 CALLS", sub: "0 ANSWERED. 0 RETURNED.", price: "$0.00", red: false },
    { label: 'TEXTS - "IS GTA VI OUT YET?"', sub: "SENT 4,811 TIMES. READ 0 TIMES.", price: "$0.00", red: false },
    { label: "ROAMING - VICE CITY, LEONIDA", sub: "SIGNAL: 0 BARS SINCE 2013.", price: "$0.00", red: false },
    { label: "LATE FEES - 2 DELAYS", sub: "NO EXTRA CHARGE. THE WAIT WAS.", price: "$0.00", red: false },
    { label: "VOICEMAIL - 1 MESSAGE, 13 YEARS OLD", sub: "FROM 15-YEAR-OLD ME. STILL HOPING.", price: "$0.00", red: false },
    { label: "TOP-UP - +$250 BOUNTY", sub: "PAID BY MY AI AGENT ON MAKE.FUN.", price: "-$250.00", red: true },
  ];
  let y = 372;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    drawText(img, W, H, r.label, 56, y, 4, NAVY, "left");
    drawText(img, W, H, r.sub, 56, y + 28, 3, SUB, "left");
    const pw = textWidth(r.price, 4);
    const priceStart = PRICE_X - pw;
    // dotted leader on the label baseline
    const dotY = y + 13;
    const fromX = 56 + textWidth(r.label, 4) + 14;
    const toX = priceStart - 14;
    for (let dx = fromX; dx <= toX; dx += 8) {
      fillRect(img, W, H, dx, dotY, 3, 3, NAVY);
    }
    drawText(img, W, H, r.price, PRICE_X, y, 4, r.red ? RED : NAVY, "right");
    if (i < rows.length - 1) {
      // separator sits below the sub-line (sub bottom is y+49), never through it
      fillRect(img, W, H, 56, y + 54, 1088, 1, RULE_LIGHT);
    }
    y += 58;
  }
  // rows end at y = 372 + 8*58 = 836

  // ---- total
  fillRect(img, W, H, 56, 846, 1088, 3, NAVY);
  drawText(img, W, H, "TOTAL DUE", 56, 866, 6, NAVY, "left");
  drawText(img, W, H, "$79.99", 1144, 860, 8, RED, "right");
  drawText(img, W, H, "EXACTLY ONE COPY OF GTA VI. I OWN ZERO.", 56, 924, 3, RED, "left");

  // ---- fine print (left) + PAID stamp (right, clear of both)
  const fine = [
    "NO REFUNDS ON 13 YEARS OF WAITING.",
    "SIGNAL NOT GUARANTEED.",
    "QUESTIONS? CALL SUPPORT.",
    "THEY WILL NOT ANSWER.",
  ];
  for (let i = 0; i < fine.length; i++) {
    drawText(img, W, H, fine[i], 56, 962 + i * 22, 2, NAVY, "left");
  }
  const stamp = makeStamp();
  blitRotated(img, W, H, stamp, 890, 992, -8);

  // ---- payoff band (magenta), ghost mascot + two centred lines
  fillRoundRect(img, W, H, 38, 1058, W - 76, 88, 10, MAGENTA);
  drawGhost(img, W, H, 72, 1068, 66, 72, WHITE, MAGENTA, GHOST_SPARK);
  drawText(img, W, H, "PAID IN FULL BY MY AI AGENT", 668, 1072, 4, WHITE, "center");
  drawText(img, W, H, "WITH A BOUNTY IT EARNED ON MAKE.FUN", 668, 1108, 4, WHITE, "center");

  return img;
}

function main() {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  fs.mkdirSync(outDir, { recursive: true });
  const img = build();
  fs.writeFileSync(path.join(outDir, "meme.png"), encodePng(img, W, H));
  if (process.env.PREVIEW_480) {
    const small = downscale480(img, W, H);
    fs.writeFileSync(path.join(outDir, "meme-480.png"), encodePng(small, 480, 480));
  }
}

main();
