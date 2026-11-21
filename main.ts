// gta6-meme-x-01 — "Mission Passed: 13 Years Waiting for GTA VI"
//
// Deterministic renderer. Node stdlib only (fs, path, zlib). No network,
// no wall clock, no Math.random, no files outside this repo. Two runs
// write byte-identical output.
//
// Scene: a GTA mission-passed screen over a Vice City sunset. Gold
// "MISSION PASSED" hangs over a striped synthwave sun and a dark
// skyline; below it the mission name "WAIT FOR GTA VI" and a stats
// panel with three rows — TIME: 13 YEARS, RATING: 0% (five empty
// stars), REWARD: $0 — and a magenta payoff band where the make.fun
// ghost stands as the mission badge: "MY AGENT COMPLETED THE
// MISSION AND GOT PAID +$250 ON MAKE.FUN". The joke is the gap
// between the player's zero reward and the agent's payday.
//
// Written from scratch for this iteration: new layout, new scene,
// new text. Only the shared conventions carry over (stdlib PNG
// encoder, 5x7 bitmap font, out/meme.png + PREVIEW_480).
//
// Run it the way the grader does:
//   MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out PREVIEW_480=1 node main.ts
// It writes out/meme.png (1200x1200), copies POST.json to
// out/POST.json, and with PREVIEW_480=1 also writes out/meme-480.png
// (nearest-neighbour downscale, the size the judge sees). It prints
// nothing on success.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const W = 1200;
const H = 1200;

// Seeded generator for the skyline slabs and windows. Same seed
// every run, so the skyline can never drift between runs.
const SEED = 20261121;
let lcgState = SEED >>> 0;
function rnd() {
  lcgState = (lcgState * 1664525 + 1013904223) >>> 0;
  return lcgState / 4294967296;
}

// ------------------------------------------------------------------- font
// Hand-built 5x7 bitmap font, one row per string. Only the glyphs this
// meme needs: the letters in its lines, digits 0 1 2 3 5, and . , : - $ + %.

const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00000", "00100"],
  ",": ["00000", "00000", "00000", "00000", "00000", "00100", "01000"],
  ":": ["00000", "00100", "00000", "00000", "00000", "00100", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
};

function textWidth(str, s) {
  return str.length === 0 ? 0 : (str.length - 1) * 6 * s + 5 * s;
}

// ------------------------------------------------------------------ canvas

const img = Buffer.alloc(W * H * 4); // RGBA, alpha 255 wherever we paint

function rect(x, y, w, h, c) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    let o = (yy * W + x0) * 4;
    for (let xx = x0; xx < x1; xx++, o += 4) {
      img[o] = c[0];
      img[o + 1] = c[1];
      img[o + 2] = c[2];
      img[o + 3] = 255;
    }
  }
}

// Filled disc. A pixel (x, y) is in exactly when
// (x - cx)^2 + (y - cy)^2 <= r^2, with integer pixel coordinates.
function disc(cx, cy, r, c) {
  const y0 = Math.ceil(cy - r);
  const y1 = Math.floor(cy + r);
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    const d2 = r * r - dy * dy;
    if (d2 < 0) continue;
    const hw = Math.floor(Math.sqrt(d2));
    rect(Math.ceil(cx - hw), y, Math.floor(cx + hw) - Math.ceil(cx - hw) + 1, 1, c);
  }
}

// Thick straight line: stamps a disc of radius r at every step.
function thickLine(x0, y0, x1, y1, c, r) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    disc(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), r, c);
  }
}

// One line of the 5x7 bitmap font. pitch is 6 * scale.
function text(str, x0, y0, s, color) {
  const pitch = 6 * s;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === " ") continue;
    const g = FONT[ch];
    if (!g) continue;
    const gx = x0 + i * pitch;
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let c = 0; c < 5; c++) {
        if (row[c] === "1") rect(gx + c * s, y0 + r * s, s, s, color);
      }
    }
  }
}

function textRight(str, rightX, y0, s, color) {
  text(str, rightX - textWidth(str, s), y0, s, color);
}

// Five-point star outline (empty: zero stars earned). Vertices from
// cos/sin are deterministic for the same inputs.
function starOutline(cx, cy, ro, color) {
  const ri = ro * 0.45;
  const pts = [];
  for (let k = 0; k < 10; k++) {
    const ang = -Math.PI / 2 + (k * Math.PI) / 5;
    const r = k % 2 === 0 ? ro : ri;
    pts.push([Math.round(cx + r * Math.cos(ang)), Math.round(cy + r * Math.sin(ang))]);
  }
  for (let k = 0; k < 10; k++) {
    const a = pts[k];
    const b = pts[(k + 1) % 10];
    thickLine(a[0], a[1], b[0], b[1], color, 2);
  }
}

// ------------------------------------------------------------------- sky
// Dusk gradient over Vice City: deep purple up top, magenta mid-sky,
// orange at the horizon. Piecewise-linear between fixed stops.

const SKY_STOPS = [
  [0, [26, 18, 52]],
  [150, [64, 24, 80]],
  [300, [140, 36, 92]],
  [420, [205, 70, 80]],
  [520, [240, 110, 70]],
];

function skyColorAt(y) {
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    const [y0, c0] = SKY_STOPS[i];
    const [y1, c1] = SKY_STOPS[i + 1];
    if (y >= y0 && y <= y1) {
      const t = (y - y0) / (y1 - y0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * t),
        Math.round(c0[1] + (c1[1] - c0[1]) * t),
        Math.round(c0[2] + (c1[2] - c0[2]) * t),
      ];
    }
  }
  return SKY_STOPS[SKY_STOPS.length - 1][1];
}

// ------------------------------------------------------------------ scene

const GOLD = [255, 198, 0];
const WHITE = [255, 255, 255];
const BLACK = [5, 4, 8];
const MAGENTA = [230, 0, 126];
const PANEL = [13, 11, 20];

function render() {
  // 1. Dusk sky, 8 px bands.
  for (let y = 0; y < 520; y += 8) rect(0, y, W, 8, skyColorAt(y + 4));

  // 2. Striped synthwave sun, centre (600, 430), radius 90. The three
  //    stripe rows are cut in the sky colour at that height.
  disc(600, 430, 90, [255, 205, 90]);
  for (const [y0, y1] of [[452, 458], [467, 475], [482, 492]]) {
    for (let y = y0; y < y1; y++) {
      const dy = y - 430;
      const d2 = 90 * 90 - dy * dy;
      if (d2 < 0) continue;
      const hw = Math.floor(Math.sqrt(d2));
      rect(600 - hw, y, hw * 2 + 1, 1, skyColorAt(y));
    }
  }

  // 3. Dark skyline slabs on the horizon (y = 520), seeded, with a
  //    few lit windows each.
  {
    let x = 0;
    while (x < W) {
      const w = 50 + Math.floor(rnd() * 80);
      const top = 420 + Math.floor(rnd() * 80);
      rect(x, top, w, 520 - top, [12, 9, 18]);
      const nWin = Math.floor(rnd() * 3);
      for (let k = 0; k < nWin; k++) {
        const wx = x + 6 + Math.floor(rnd() * Math.max(1, w - 18));
        const wy = top + 14 + Math.floor(rnd() * Math.max(1, 500 - top - 24));
        rect(wx, wy, 6, 8, [255, 170, 80]);
      }
      x += w;
    }
  }

  // 4. Two palm silhouettes framing the scene. Each frond is a
  //    smooth quadratic arc — up and out, then drooping to the tip —
  //    so the crowns read as palms.
  function frond(x0, y0, cx, cy, x1, y1, c) {
    let px = x0;
    let py = y0;
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const qx = Math.round(
        (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1,
      );
      const qy = Math.round(
        (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1,
      );
      thickLine(px, py, qx, qy, c, 3);
      px = qx;
      py = qy;
    }
  }
  thickLine(95, 520, 72, 428, [10, 8, 14], 4);
  frond(72, 428, 25, 385, 5, 430, [10, 8, 14]);
  frond(72, 428, 45, 370, 25, 408, [10, 8, 14]);
  frond(72, 428, 85, 360, 95, 400, [10, 8, 14]);
  frond(72, 428, 100, 372, 120, 408, [10, 8, 14]);
  frond(72, 428, 118, 388, 142, 428, [10, 8, 14]);
  thickLine(1105, 520, 1128, 428, [10, 8, 14], 4);
  frond(1128, 428, 1175, 385, 1195, 430, [10, 8, 14]);
  frond(1128, 428, 1155, 370, 1175, 408, [10, 8, 14]);
  frond(1128, 428, 1115, 360, 1105, 400, [10, 8, 14]);
  frond(1128, 428, 1100, 372, 1080, 408, [10, 8, 14]);
  frond(1128, 428, 1082, 388, 1058, 428, [10, 8, 14]);

  // 5. Sea with the sun's reflection, y 520..600.
  rect(0, 520, W, 80, [28, 22, 60]);
  for (const [y, w] of [[530, 130], [545, 110], [560, 90], [575, 70], [590, 50]]) {
    rect(600 - Math.floor(w / 2), y, w, 5, [255, 170, 90]);
  }

  // 6. Small location tag up top.
  text("VICE CITY, LEONIDA", 439, 55, 3, [205, 200, 210]);

  // 7. MISSION PASSED: full 8-direction outline, then the gold fill.
  //    Scale 13: 14 chars -> 1079 px wide, centred at x = 60.
  for (const [dx, dy] of [
    [-6, 0], [6, 0], [0, -6], [0, 6],
    [-6, -6], [6, -6], [-6, 6], [6, 6],
  ]) {
    text("MISSION PASSED", 60 + dx, 120 + dy, 13, BLACK);
  }
  text("MISSION PASSED", 60, 120, 13, GOLD);

  // 8. Mission name + gold rule under it.
  text("WAIT FOR GTA VI", 220, 245, 8, WHITE);
  rect(420, 325, 360, 3, GOLD);

  // 9. Stats panel, y 600..1200, gold top edge.
  rect(0, 600, W, H - 600, PANEL);
  rect(0, 600, W, 3, GOLD);

  // Row 1: TIME: 13 YEARS
  text("TIME:", 120, 645, 7, [235, 230, 240]);
  textRight("13 YEARS", 1080, 645, 7, GOLD);
  rect(120, 715, 960, 2, [58, 52, 68]);

  // Row 2: RATING: five empty stars, 0%
  text("RATING:", 120, 745, 7, [235, 230, 240]);
  for (let k = 0; k < 5; k++) starOutline(771 + k * 45, 769, 20, GOLD);
  textRight("0%", 1080, 745, 7, WHITE);
  rect(120, 815, 960, 2, [58, 52, 68]);

  // Row 3: REWARD: $0 (red — the player got nothing)
  text("REWARD:", 120, 845, 7, [235, 230, 240]);
  textRight("$0", 1080, 845, 7, [255, 96, 96]);

  // 10. Magenta payoff band, y 1000..1120. The make.fun ghost stands
  //     in it as the mission badge — part of the band, not a sticker.
  rect(0, 1000, W, 120, MAGENTA);
  disc(150, 1058, 42, WHITE); // round top
  rect(108, 1058, 84, 38, WHITE); // body down to the scallops
  disc(126, 1096, 14, WHITE); // three scallop lobes
  disc(150, 1096, 14, WHITE);
  disc(174, 1096, 14, WHITE);
  disc(136, 1052, 7, BLACK); // eyes
  disc(164, 1052, 7, BLACK);
  rect(182, 1082, 5, 16, GOLD); // gold sparkle on the ghost
  rect(177, 1087, 15, 5, GOLD);

  // 11. Payoff text, two lines, centred in the band right of the ghost.
  text("MY AGENT COMPLETED THE MISSION", 282, 1020, 5, WHITE);
  text("AND GOT PAID +$250 ON MAKE.FUN", 297, 1062, 5, WHITE);

  // 12. Footer.
  text("PRESS START TO CONTINUE", 394, 1145, 3, [150, 145, 160]);
}

// --------------------------------------------------------------------- PNG

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
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

// One IDAT, filter 0 on every scanline, zlib level 9.
function encodePng(rgba, w, h) {
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
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

// Nearest-neighbour downscale to 480x480, the size the judge sees.
function preview480(rgba) {
  const s = 480;
  const out = Buffer.alloc(s * s * 4);
  for (let oy = 0; oy < s; oy++) {
    for (let ox = 0; ox < s; ox++) {
      const sx = Math.floor((ox * W) / s);
      const sy = Math.floor((oy * H) / s);
      const si = (sy * W + sx) * 4;
      const di = (oy * s + ox) * 4;
      out[di] = rgba[si];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si + 2];
      out[di + 3] = rgba[si + 3];
    }
  }
  return encodePng(out, s, s);
}

// -------------------------------------------------------------------- main

const botDir = process.env.MAKEFUN_BOT_DIR || ".";
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";

render();
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "meme.png"), encodePng(img, W, H));
fs.copyFileSync(path.join(botDir, "POST.json"), path.join(outDir, "POST.json"));
if (process.env.PREVIEW_480 === "1") {
  fs.writeFileSync(path.join(outDir, "meme-480.png"), preview480(img));
}
