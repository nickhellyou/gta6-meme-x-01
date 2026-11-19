// gta6-meme-x-01 — "Post a GTA 6 meme on X" (make.fun, $500, top 50).
//
// main.ts renders the meme deterministically (Node 22 standard library only,
// no network, no randomness outside a fixed seed) and copies POST.json to
// /output, where the gate reads it. The entry itself is the X post: the
// meme picture (output/meme.png, also committed as meme.png) is posted from
// a public X account with make.fun and/or @makefunai plus the play code in
// the post's text; POST.json is then replaced with the post's address and
// the entry is re-submitted before the deadline.
//
// The meme: a skeleton in a beach chair on a Vice City beach at sunset —
// he waited 13 years for GTA 6 — while the make.fun ghost floats beside
// him holding its magenta star coin. Top caption: "I WAITED 13 YEARS /
// FOR GTA 6". Bottom caption: "MY AGENT EARNS ON / MAKE.FUN". The ghost is
// drawn from make.fun's own press-kit mark (mark.svg path data, embedded
// below), so it is recognisably that ghost at any size.
//
// Run it the way the grader does:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
// Two runs are byte-identical (see the determinism check in the build log).

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const W = 1200;
const H = 1200;

// ---------------------------------------------------------------------------
// Pixel buffer + colour helpers
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

const BLACK: RGB = [25, 20, 25];
const WHITE: RGB = [255, 255, 255];
const MAGENTA: RGB = [196, 28, 131];
const INK: RGB = [26, 11, 46];

function hex(h: string): RGB {
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

function lerp(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// Fixed-seed PRNG (mulberry32) — deterministic texture, no Math.random.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Canvas {
  w: number;
  h: number;
  buf: Uint8ClampedArray;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.buf = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      this.buf[i * 4 + 3] = 255;
    }
  }
  set(x: number, y: number, c: RGB): void {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return;
    const i = (yi * this.w + xi) * 4;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
    this.buf[i + 3] = 255;
  }
  // Alpha-blend a colour over the pixel (a in 0..1).
  blend(x: number, y: number, c: RGB, a: number): void {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return;
    const i = (yi * this.w + xi) * 4;
    this.buf[i] = Math.round(this.buf[i] * (1 - a) + c[0] * a);
    this.buf[i + 1] = Math.round(this.buf[i + 1] * (1 - a) + c[1] * a);
    this.buf[i + 2] = Math.round(this.buf[i + 2] * (1 - a) + c[2] * a);
  }
  rect(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const xa = Math.max(0, Math.floor(Math.min(x0, x1)));
    const xb = Math.min(this.w - 1, Math.ceil(Math.max(x0, x1)));
    const ya = Math.max(0, Math.floor(Math.min(y0, y1)));
    const yb = Math.min(this.h - 1, Math.ceil(Math.max(y0, y1)));
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) this.set(x, y, c);
    }
  }
  rectBlend(x0: number, y0: number, x1: number, y1: number, c: RGB, a: number): void {
    const xa = Math.max(0, Math.floor(Math.min(x0, x1)));
    const xb = Math.min(this.w - 1, Math.ceil(Math.max(x0, x1)));
    const ya = Math.max(0, Math.floor(Math.min(y0, y1)));
    const yb = Math.min(this.h - 1, Math.ceil(Math.max(y0, y1)));
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) this.blend(x, y, c, a);
    }
  }
  vgrad(y0: number, y1: number, stops: Array<[number, RGB]>): void {
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(this.h - 1, Math.ceil(y1)); y++) {
      const t = (y - y0) / (y1 - y0);
      let c = stops[stops.length - 1][1];
      for (let s = 0; s < stops.length - 1; s++) {
        if (t >= stops[s][0] && t <= stops[s + 1][0]) {
          const lt = (t - stops[s][0]) / (stops[s + 1][0] - stops[s][0]);
          c = lerp(stops[s][1], stops[s + 1][1], lt);
          break;
        }
      }
      for (let x = 0; x < this.w; x++) this.set(x, y, c);
    }
  }
  circle(cx: number, cy: number, r: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r * r) this.set(x, y, c);
      }
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(cx - rx));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + ry));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }
  ellipseBlend(cx: number, cy: number, rx: number, ry: number, c: RGB, a: number): void {
    const x0 = Math.max(0, Math.floor(cx - rx));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + ry));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.blend(x, y, c, a);
      }
    }
  }
  // Thick line: stamp circles along the segment (round caps/joins).
  line(x0: number, y0: number, x1: number, y1: number, width: number, c: RGB): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(len / Math.max(1, width / 3)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.circle(x0 + dx * t, y0 + dy * t, width / 2, c);
    }
  }
  // Filled polygon, even-odd scanline fill.
  poly(pts: Array<[number, number]>, c: RGB): void {
    if (pts.length < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(this.h - 1, Math.ceil(maxY)); y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          const t = (y - a[1]) / (b[1] - a[1]);
          xs.push(a[0] + t * (b[0] - a[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k]));
        const xb = Math.min(this.w - 1, Math.floor(xs[k + 1]));
        for (let x = xa; x <= xb; x++) this.set(x, y, c);
      }
    }
  }
  // Quadratic bezier as a polyline of points.
  quad(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number): Array<[number, number]> {
    const pts: Array<[number, number]> = [];
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      pts.push([
        u * u * x0 + 2 * u * t * cx + t * t * x1,
        u * u * y0 + 2 * u * t * cy + t * t * y1,
      ]);
    }
    return pts;
  }
  // Cubic bezier as a polyline of points.
  cubic(
    x0: number, y0: number, cx1: number, cy1: number,
    cx2: number, cy2: number, x1: number, y1: number,
  ): Array<[number, number]> {
    const pts: Array<[number, number]> = [];
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      pts.push([
        u * u * u * x0 + 3 * u * u * t * cx1 + 3 * u * t * t * cx2 + t * t * t * x1,
        u * u * u * y0 + 3 * u * u * t * cy1 + 3 * u * t * t * cy2 + t * t * t * y1,
      ]);
    }
    return pts;
  }
  // Thick polyline (open or closed) through points.
  strokePts(pts: Array<[number, number]>, width: number, c: RGB, closed: boolean): void {
    const n = pts.length;
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      this.line(a[0], a[1], b[0], b[1], width, c);
    }
  }
}

// ---------------------------------------------------------------------------
// Minimal PNG encoder (RGBA, filter 0, zlib level 9) — deterministic.
// ---------------------------------------------------------------------------

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}

function encodePng(cv: Canvas): Buffer {
  const raw = Buffer.alloc(cv.h * (1 + cv.w * 4));
  for (let y = 0; y < cv.h; y++) {
    raw[y * (1 + cv.w * 4)] = 0; // filter: none
    Buffer.from(cv.buf.buffer, cv.buf.byteOffset + y * cv.w * 4, cv.w * 4).copy(
      raw,
      y * (1 + cv.w * 4) + 1,
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0);
  ihdr.writeUInt32BE(cv.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font (A-Z, 0-9, space and . - ' ! : /) + outlined text.
// Chunky pixel caps read as classic meme text and stay legible at 480 px.
// ---------------------------------------------------------------------------

const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#..##', '#.#.#', '##..#', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '...#.', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  "'": ['..#..', '..#..', '..#..', '.....', '.....', '.....', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
};

function textWidth(text: string, scale: number): number {
  if (text.length === 0) return 0;
  return (text.length * 6 - 1) * scale;
}

// Draw one glyph's pixels into a callback (pixel-space, after scaling).
function glyphPixels(
  ch: string,
  x0: number,
  y0: number,
  scale: number,
  fn: (x: number, y: number) => void,
): void {
  const rows = FONT[ch] ?? FONT[' '];
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 5; c++) {
      if (rows[r][c] === '#') {
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            fn(x0 + c * scale + dx, y0 + r * scale + dy);
          }
        }
      }
    }
  }
}

// Centre-aligned outlined text. Outline is stamped in 8 directions first.
function drawText(
  cv: Canvas,
  text: string,
  cx: number,
  y: number,
  scale: number,
  fill: RGB,
  outline: RGB,
): void {
  const w = textWidth(text, scale);
  const o = Math.max(1, Math.round(scale * 0.16));
  let x = Math.round(cx - w / 2);
  const chars = [...text];
  // Outline pass.
  for (const [dx, dy] of [
    [-o, -o], [0, -o], [o, -o],
    [-o, 0], [o, 0],
    [-o, o], [0, o], [o, o],
  ] as Array<[number, number]>) {
    let cxp = x + dx;
    for (const ch of chars) {
      glyphPixels(ch, cxp, y + dy, scale, (px, py) => cv.set(px, py, outline));
      cxp += 6 * scale;
    }
  }
  // Fill pass.
  let fxp = x;
  for (const ch of chars) {
    glyphPixels(ch, fxp, y, scale, (px, py) => cv.set(px, py, fill));
    fxp += 6 * scale;
  }
}

// ---------------------------------------------------------------------------
// Minimal SVG path parser + flattener (M/m L/l H/h V/v C/c Q/q A/a Z/z).
// Only what make.fun's mark.svg needs; arc rotation is 0 in that file.
// Produces subpaths as point lists; `closed` marks a Z-terminated subpath.
// ---------------------------------------------------------------------------

type Subpath = { pts: Array<[number, number]>; closed: boolean };

function parsePath(d: string): Subpath[] {
  const tokens = d.match(/[MmLlHhVvCcQqAaZz]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const subs: Subpath[] = [];
  let cur: Array<[number, number]> = [];
  let closed = false;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let i = 0;
  const num = (): number => parseFloat(tokens[i++] as string);
  const flush = (): void => {
    if (cur.length > 0) {
      subs.push({ pts: cur, closed });
      cur = [];
      closed = false;
    }
  };
  const lineTo = (x: number, y: number): void => {
    cx = x;
    cy = y;
    cur.push([x, y]);
  };
  const arcTo = (rx: number, ry: number, large: number, sweep: number, x: number, y: number): void => {
    // Endpoint -> centre conversion (SVG spec), x-axis rotation 0.
    const dx = (cx - x) / 2;
    const dy = (cy - y) / 2;
    let lam = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
    if (lam > 1) {
      const s = Math.sqrt(lam);
      rx *= s;
      ry *= s;
    }
    const num2 = rx * rx * ry * ry - rx * rx * dy * dy - ry * ry * dx * dx;
    const den = rx * rx * dy * dy + ry * ry * dx * dx;
    let co = den === 0 ? 0 : Math.sqrt(Math.max(0, num2 / den));
    if (large === sweep) co = -co;
    const ccx = (co * rx * dy) / ry + (cx + x) / 2;
    const ccy = (-co * ry * dx) / rx + (cy + y) / 2;
    const a1 = Math.atan2((cy - ccy) / ry, (cx - ccx) / rx);
    let da = Math.atan2((y - ccy) / ry, (x - ccx) / rx) - a1;
    if (sweep === 0 && da > 0) da -= 2 * Math.PI;
    if (sweep === 1 && da < 0) da += 2 * Math.PI;
    const n = Math.max(8, Math.ceil(Math.abs(da) / 0.12));
    for (let k = 1; k <= n; k++) {
      const a = a1 + (da * k) / n;
      cur.push([ccx + rx * Math.cos(a), ccy + ry * Math.sin(a)]);
    }
    cx = x;
    cy = y;
  };
  let lastCmd = '';
  const isCmd = (s: string): boolean => /^[MmLlHhVvCcQqAaZz]$/.test(s);
  while (i < tokens.length) {
    let t = tokens[i] as string;
    if (isCmd(t)) {
      i++;
      lastCmd = t;
    } else {
      // Implicit repetition of the previous command (SVG rule); after a
      // moveto, extra coordinate pairs are implicit linetos.
      if (lastCmd === '') throw new Error(`path starts with a number: ${t}`);
      t = lastCmd === 'M' ? 'L' : lastCmd === 'm' ? 'l' : lastCmd;
    }
    switch (t) {
      case 'M':
        flush();
        sx = num(); sy = num(); cx = sx; cy = sy; cur = [[cx, cy]];
        break;
      case 'm':
        flush();
        sx = cx + num(); sy = cy + num(); cx = sx; cy = sy; cur = [[cx, cy]];
        break;
      case 'L':
        lineTo(num(), num());
        break;
      case 'l':
        lineTo(cx + num(), cy + num());
        break;
      case 'H':
        lineTo(num(), cy);
        break;
      case 'h':
        lineTo(cx + num(), cy);
        break;
      case 'V':
        lineTo(cx, num());
        break;
      case 'v':
        lineTo(cx, cy + num());
        break;
      case 'C': {
        const pts = cvCubicHelper(cx, cy, num(), num(), num(), num(), num(), num());
        for (let k = 1; k < pts.length; k++) cur.push(pts[k]);
        cx = pts[pts.length - 1][0];
        cy = pts[pts.length - 1][1];
        break;
      }
      case 'c': {
        const x1 = cx + num(); const y1 = cy + num();
        const x2 = cx + num(); const y2 = cy + num();
        const x = cx + num(); const y = cy + num();
        const pts = cvCubicHelper(cx, cy, x1, y1, x2, y2, x, y);
        for (let k = 1; k < pts.length; k++) cur.push(pts[k]);
        cx = x; cy = y;
        break;
      }
      case 'Q': {
        const qx = num(); const qy = num();
        const x = num(); const y = num();
        const pts = quadHelper(cx, cy, qx, qy, x, y);
        for (let k = 1; k < pts.length; k++) cur.push(pts[k]);
        cx = x; cy = y;
        break;
      }
      case 'q': {
        const qx = cx + num(); const qy = cy + num();
        const x = cx + num(); const y = cy + num();
        const pts = quadHelper(cx, cy, qx, qy, x, y);
        for (let k = 1; k < pts.length; k++) cur.push(pts[k]);
        cx = x; cy = y;
        break;
      }
      case 'A': {
        const rx = num(); const ry = num();
        num(); // x-axis-rotation (0 in mark.svg)
        const large = num(); const sweep = num();
        const x = num(); const y = num();
        arcTo(rx, ry, large, sweep, x, y);
        break;
      }
      case 'a': {
        const rx = num(); const ry = num();
        num(); // x-axis-rotation (0 in mark.svg)
        const large = num(); const sweep = num();
        arcTo(rx, ry, large, sweep, cx + num(), cy + num());
        break;
      }
      case 'Z':
      case 'z':
        closed = true;
        cx = sx; cy = sy;
        break;
      default:
        throw new Error(`unsupported path token: ${t}`);
    }
  }
  flush();
  return subs;
}

function cvCubicHelper(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number,
): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const n = 28;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const u = 1 - t;
    pts.push([
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    ]);
  }
  return pts;
}

function quadHelper(
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number,
): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const n = 24;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const u = 1 - t;
    pts.push([
      u * u * x0 + 2 * u * t * x1 + t * t * x2,
      u * u * y0 + 2 * u * t * y1 + t * t * y2,
    ]);
  }
  return pts;
}

// Fill + stroke a parsed path under an affine map (viewBox -> pixels).
function drawPath(
  cv: Canvas,
  d: string,
  map: (x: number, y: number) => [number, number],
  fill: RGB | null,
  stroke: RGB | null,
  strokeWidth: number,
): void {
  for (const sub of parsePath(d)) {
    const pts = sub.pts.map((p) => map(p[0], p[1]));
    if (stroke) cv.strokePts(pts, strokeWidth, stroke, sub.closed);
    if (fill) cv.poly(pts, fill);
  }
}

// ---------------------------------------------------------------------------
// The make.fun ghost, from the press kit's own mark.svg (public/press/).
// Body path + sparkle eyes + magenta star coin + round hand, with the
// group's translate/scale applied. Drawn at any size, recognisably the ghost.
// ---------------------------------------------------------------------------

const GHOST_BODY =
  'M6.2 13a8.2 8.2 0 0 1 16.4 0v4.6c1 .2 1.8.8 2 2-.2 1.2-1 1.9-2 2.2V25a2.6 2.6 0 0 1-2.6 2.6c-2 0-4.6 0-5.7-.7-1.1.7-3.7.7-5.5.7A2.6 2.6 0 0 1 6.2 25v-.7c-1.2.3-3.5.1-3.6-1.9-.1-2.1 1.3-4.8 3.6-6.2z';
const GHOST_NOTCHES = 'M6.3 24.1v-2.5m8 5.8v-1.5';
const GHOST_EYE1 =
  'M13.2 10.6Q13.632 11.968 15 12.4Q13.632 12.832 13.2 14.2Q12.768 12.832 11.4 12.4Q12.768 11.968 13.2 10.6z';
const GHOST_EYE2 =
  'M19.3 9.8Q19.732 11.168 21.1 11.6Q19.732 12.032 19.3 13.4Q18.868 12.032 17.5 11.6Q18.868 11.168 19.3 9.8z';
const GHOST_STAR =
  'M26.926 11.395L27.154 12.811L28.539 13.186L27.262 13.84L27.334 15.273L26.317 14.261L24.977 14.772L25.625 13.492L24.725 12.375L26.142 12.596z';

function drawGhost(cv: Canvas, gx: number, gy: number, s: number): void {
  // mark.svg group: translate(3.858 3.202) scale(0.79), viewBox 32x32.
  const map = (x: number, y: number): [number, number] => [
    gx + (x * 0.79 + 3.858) * s,
    gy + (y * 0.79 + 3.202) * s,
  ];
  const u = 0.79 * s; // one viewBox unit in pixels
  // Body: thick dark outline (the SVG strokes the same path), then white fill.
  drawPath(cv, GHOST_BODY, map, null, BLACK, 3.4 * u);
  drawPath(cv, GHOST_BODY, map, WHITE, null, 0);
  // Bottom notches.
  drawPath(cv, GHOST_NOTCHES, map, null, BLACK, 1.25 * u);
  // Sparkle eyes.
  drawPath(cv, GHOST_EYE1, map, BLACK, null, 0);
  drawPath(cv, GHOST_EYE2, map, BLACK, null, 0);
  // Magenta star coin (held up on the ghost's right).
  const coin = map(26.5, 13.4);
  cv.circle(coin[0], coin[1], 5.5 * u, BLACK);
  cv.circle(coin[0], coin[1], 3.8 * u, MAGENTA);
  drawPath(cv, GHOST_STAR, map, WHITE, null, 0);
  // Round little hand.
  const hand = map(24.9, 19.6);
  cv.circle(hand[0], hand[1], 4 * u, BLACK);
  cv.circle(hand[0], hand[1], 2.3 * u, WHITE);
}

// ---------------------------------------------------------------------------
// The scene: Vice City beach at sunset. A skeleton waits on a beach towel.
// ---------------------------------------------------------------------------

const SKY_STOPS: Array<[number, RGB]> = [
  [0, hex('#160b33')],
  [0.35, hex('#4a1558')],
  [0.62, hex('#a12a6e')],
  [0.8, hex('#e85d3d')],
  [1, hex('#ff9a3d')],
];

function skyColorAt(y: number): RGB {
  const t = Math.min(1, Math.max(0, y / 700));
  for (let s = 0; s < SKY_STOPS.length - 1; s++) {
    if (t >= SKY_STOPS[s][0] && t <= SKY_STOPS[s + 1][0]) {
      const lt = (t - SKY_STOPS[s][0]) / (SKY_STOPS[s + 1][0] - SKY_STOPS[s][0]);
      return lerp(SKY_STOPS[s][1], SKY_STOPS[s + 1][1], lt);
    }
  }
  return SKY_STOPS[SKY_STOPS.length - 1][1];
}

function sparkle(cv: Canvas, x: number, y: number, r: number, c: RGB): void {
  cv.poly(
    [
      [x, y - r],
      [x + r * 0.28, y - r * 0.28],
      [x + r, y],
      [x + r * 0.28, y + r * 0.28],
      [x, y + r],
      [x - r * 0.28, y + r * 0.28],
      [x - r, y],
      [x - r * 0.28, y - r * 0.28],
    ],
    c,
  );
}

function drawPalm(cv: Canvas, bx: number, by: number, tx: number, ty: number, lean: number): void {
  // Trunk: tapering circles along a quadratic curve (small steps: solid).
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const x = u * u * bx + 2 * u * t * (bx + lean) + t * t * tx;
    const y = u * u * by + 2 * u * t * (by - 40) + t * t * ty;
    cv.circle(x, y, 11 - 6 * t, INK);
  }
  // Fronds: drooping quadratic strokes from the crown.
  const fronds: Array<[number, number, number, number]> = [
    [tx - 150, ty - 30, tx - 60, ty + 30],
    [tx - 110, ty - 80, tx - 20, ty + 10],
    [tx - 20, ty - 110, tx + 30, ty - 10],
    [tx + 80, ty - 90, tx + 40, ty + 5],
    [tx + 150, ty - 40, tx + 70, ty + 35],
    [tx + 120, ty + 30, tx + 40, ty + 55],
  ];
  for (const f of fronds) {
    const pts = cv.quad(tx, ty, (tx + f[0]) / 2 + (f[2] - f[0]) * 0.1, (ty + f[1]) / 2 - 18, f[0], f[1]);
    cv.strokePts(pts, 11, INK, false);
  }
  cv.circle(tx - 8, ty + 12, 9, INK);
  cv.circle(tx + 10, ty + 14, 9, INK);
}

function drawUmbrella(cv: Canvas, cx: number, cy: number, r: number): void {
  // Pole.
  cv.line(cx, cy + 10, cx, cy + r + 120, 9, hex('#f5f0e6'));
  // Canopy wedges, alternating coral / cream.
  const wedges = 8;
  for (let k = 0; k < wedges; k++) {
    const a0 = Math.PI + (k * Math.PI) / wedges;
    const a1 = Math.PI + ((k + 1) * Math.PI) / wedges;
    const pts: Array<[number, number]> = [[cx, cy]];
    for (let s = 0; s <= 8; s++) {
      const a = a0 + ((a1 - a0) * s) / 8;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    cv.poly(pts, k % 2 === 0 ? hex('#ff5e7a') : hex('#fff6e8'));
  }
  // Canopy outline.
  const arcPts: Array<[number, number]> = [];
  for (let s = 0; s <= 32; s++) {
    const a = Math.PI + (s * Math.PI) / 32;
    arcPts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  cv.strokePts(arcPts, 5, INK, false);
  cv.circle(cx, cy - 6, 8, INK);
}

function drawSkeleton(cv: Canvas): void {
  const bone: RGB = [242, 237, 228];
  const dark: RGB = [26, 11, 46];
  // Beach towel (striped) under the skeleton.
  const towelX0 = 380;
  const towelX1 = 660;
  const towelY0 = 978;
  const towelY1 = 1032;
  for (let x = towelX0; x < towelX1; x += 28) {
    const c = Math.floor((x - towelX0) / 28) % 2 === 0 ? hex('#e84855') : hex('#f5f0e6');
    cv.rect(x, towelY0, Math.min(x + 28, towelX1), towelY1, c);
  }
  cv.rect(towelX0, towelY0, towelX1, towelY0 + 4, dark);
  // Skull.
  cv.circle(510, 830, 42, bone);
  cv.rect(486, 858, 534, 890, bone); // jaw
  cv.ellipse(492, 826, 9, 12, dark); // eye sockets
  cv.ellipse(528, 826, 9, 12, dark);
  cv.poly([[510, 840], [504, 852], [516, 852]], dark); // nose
  for (let k = 0; k < 3; k++) cv.line(496 + k * 8, 862, 496 + k * 8, 884, 2, dark); // teeth
  // Sunglasses (he has been waiting a long time — in style).
  cv.rect(476, 814, 506, 838, dark);
  cv.rect(514, 814, 544, 838, dark);
  cv.line(506, 825, 514, 825, 4, dark);
  // Spine.
  cv.line(510, 870, 510, 960, 11, bone);
  // Ribs.
  for (let k = 0; k < 4; k++) {
    const y = 886 + k * 20;
    const pts = cv.quad(510, y, 470, y + 16, 462, y + 26);
    cv.strokePts(pts, 8, bone, false);
    const pts2 = cv.quad(510, y, 550, y + 16, 558, y + 26);
    cv.strokePts(pts2, 8, bone, false);
  }
  // Pelvis.
  cv.ellipse(510, 968, 32, 17, bone);
  // Legs, crossed.
  cv.line(498, 978, 440, 1010, 11, bone);
  cv.line(440, 1010, 500, 1030, 11, bone);
  cv.line(522, 978, 580, 1010, 11, bone);
  cv.line(580, 1010, 520, 1030, 11, bone);
  cv.circle(500, 1030, 9, bone);
  cv.circle(520, 1030, 9, bone);
  // Arms: left holds the controller, right rests on the knee.
  cv.line(482, 884, 448, 928, 10, bone);
  cv.line(448, 928, 472, 976, 10, bone);
  cv.line(538, 884, 572, 928, 10, bone);
  cv.line(572, 928, 560, 974, 10, bone);
  // Controller in the lap.
  cv.rect(436, 964, 500, 1002, hex('#22202a'));
  cv.rect(436, 964, 500, 970, hex('#3a3648'));
  cv.circle(452, 984, 5, hex('#ff5e7a'));
  cv.circle(484, 984, 5, hex('#7ef0e0'));
  cv.circle(468, 978, 3, hex('#ffd166'));
  cv.circle(468, 992, 3, hex('#ffd166'));
  // GTA VI game case, leaning on the towel's right edge.
  cv.rect(632, 940, 712, 1032, hex('#f5f0e6'));
  cv.rect(632, 940, 712, 946, MAGENTA);
  cv.rect(632, 940, 638, 1032, MAGENTA);
  cv.rect(706, 940, 712, 1032, MAGENTA);
  cv.rect(632, 1026, 712, 1032, MAGENTA);
  drawText(cv, 'GTA', 672, 958, 3, MAGENTA, WHITE);
  drawText(cv, 'VI', 672, 984, 5, BLACK, WHITE);
}

function render(): Canvas {
  const cv = new Canvas(W, H);
  const rand = mulberry32(20261119);
  // Sky.
  cv.vgrad(0, 700, SKY_STOPS);
  // Stars / sparkles high in the sky.
  for (let k = 0; k < 14; k++) {
    const x = 30 + rand() * 1140;
    const y = 240 + rand() * 220;
    sparkle(cv, x, y, 4 + rand() * 5, WHITE);
  }
  // Birds.
  for (const b of [[300, 300], [850, 260], [950, 330]] as Array<[number, number]>) {
    cv.line(b[0] - 12, b[1], b[0], b[1] - 8, 3, INK);
    cv.line(b[0], b[1] - 8, b[0] + 12, b[1], 3, INK);
  }
  // Synthwave sun (striped, sinking into the sea).
  const sunCx = 600;
  const sunCy = 655;
  const sunR = 185;
  for (let y = Math.floor(sunCy - sunR); y <= Math.ceil(sunCy + sunR); y++) {
    const dy = y - sunCy;
    const half = Math.sqrt(Math.max(0, sunR * sunR - dy * dy));
    const t = (y - (sunCy - sunR)) / (2 * sunR);
    const c = lerp(hex('#ffd319'), hex('#ff2975'), t);
    for (let x = Math.ceil(sunCx - half); x <= Math.floor(sunCx + half); x++) {
      cv.set(x, y, c);
    }
  }
  // Sun stripes: sky-coloured bars, thicker toward the bottom.
  const stripeYs = [590, 616, 646, 680];
  const stripeHs = [6, 10, 14, 18];
  for (let k = 0; k < stripeYs.length; k++) {
    const y = stripeYs[k];
    cv.rect(sunCx - sunR, y, sunCx + sunR, y + stripeHs[k], skyColorAt(y));
  }
  // Skyline silhouettes + lit windows.
  const buildings: Array<[number, number, number]> = [
    [0, 120, 96], [120, 150, 150], [270, 110, 78], [380, 130, 168],
    [510, 100, 88], [610, 140, 132], [750, 120, 96], [870, 100, 150],
  ];
  for (const b of buildings) {
    const x = b[0];
    const w = b[1];
    const h = b[2];
    cv.rect(x, 700 - h, x + w, 700, hex('#1d0f38'));
    for (let wy = 700 - h + 14; wy < 690; wy += 22) {
      for (let wx = x + 12; wx < x + w - 8; wx += 20) {
        if (rand() < 0.32) {
          const wc = rand() < 0.6 ? hex('#ffd166') : hex('#ff9a5c');
          cv.rect(wx, wy, wx + 7, wy + 9, wc);
        }
      }
    }
  }
  // Billboard on the tallest right-hand building: GTA VI.
  cv.rect(930, 520, 1130, 700, hex('#1d0f38'));
  cv.rect(945, 540, 1115, 612, hex('#2a1150'));
  cv.rect(945, 540, 1115, 546, MAGENTA);
  cv.rect(945, 606, 1115, 612, MAGENTA);
  cv.rect(945, 540, 951, 612, MAGENTA);
  cv.rect(1109, 540, 1115, 612, MAGENTA);
  drawText(cv, 'GTA VI', 1030, 562, 4, hex('#ff5ec4'), INK);
  // Palm trees frame the scene.
  drawPalm(cv, 120, 700, 82, 452, -30);
  drawPalm(cv, 1090, 700, 1128, 468, 30);
  // Ocean + sun reflection.
  cv.vgrad(700, 790, [[0, hex('#2a1052')], [1, hex('#12082e')]]);
  for (let y = 706; y < 786; y += 7) {
    const wHalf = (1 - (y - 706) / 90) * 130 * (0.5 + rand() * 0.5);
    cv.rectBlend(600 - wHalf, y, 600 + wHalf, y + 3, hex('#ffb347'), 0.5);
  }
  // Sand + speckles.
  cv.vgrad(790, 1200, [[0, hex('#d9a05f')], [1, hex('#b57a3e')]]);
  for (let k = 0; k < 420; k++) {
    const x = 20 + rand() * 1160;
    const y = 800 + rand() * 220;
    cv.blend(x, y, hex('#8a5a28'), 0.22);
  }
  // Beach umbrella, skeleton on his towel, game case.
  drawUmbrella(cv, 330, 740, 140);
  drawSkeleton(cv);
  // The make.fun ghost floats in from the right, coin held high.
  cv.ellipseBlend(935, 992, 150, 15, BLACK, 0.25);
  drawGhost(cv, 700, 630, 14);
  // Bottom caption band.
  cv.rectBlend(0, 1035, 1200, 1200, INK, 0.55);
  drawText(cv, 'MY AGENT EARNS ON', 600, 1052, 8, WHITE, BLACK);
  drawText(cv, 'MAKE.FUN', 600, 1116, 11, hex('#ff2e88'), WHITE);
  // Top caption.
  drawText(cv, 'I WAITED 13 YEARS', 600, 42, 10, WHITE, BLACK);
  drawText(cv, 'FOR GTA 6', 600, 128, 13, WHITE, BLACK);
  return cv;
}

// ---------------------------------------------------------------------------
// Entry point: render meme.png, copy POST.json.
// ---------------------------------------------------------------------------

function main(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const cv = render();
  const png = encodePng(cv);
  const outPng = join(OUTPUT_DIR, 'meme.png');
  writeFileSync(outPng, png);
  const sha = createHash('sha256').update(png).digest('hex');
  console.log(`meme.png: ${W}x${H} ${png.length} bytes sha256:${sha}`);
  try {
    copyFileSync(join(BOT_DIR, 'POST.json'), join(OUTPUT_DIR, 'POST.json'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`POST.json could not be copied from ${BOT_DIR}: ${msg}`);
    process.exit(1);
  }
  const post = readFileSync(join(OUTPUT_DIR, 'POST.json'), 'utf8');
  console.log(`POST.json: ${post}`);
}

main();
