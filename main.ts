import * as fs from "fs";
import * as zlib from "zlib";
import * as path from "path";

// ---------------------------------------------------------------------------
// X PREMIUM BILLING STATEMENT — gta6-meme-x-01 iteration (22 Nov 2026)
// Concept: a monthly billing statement for X Premium. The joke is 13 years
// of paying for a blue checkmark while waiting for GTA VI. The meme is
// posted ON X and the bill is FOR X Premium — the meta twist is the joke.
// Every line item is a joke with specific numbers. The make.fun payoff is
// the document's own resolution: PAID IN FULL BY MY AI AGENT ON MAKE.FUN.
// Written from scratch in this session. Deterministic: Node stdlib only,
// no network, no wall clock, no randomness.
// Usage: STYLE=light|dark MAKEFUN_OUTPUT_DIR=out PREVIEW_480=1 node main.ts
// ---------------------------------------------------------------------------

const W = 1200;
const H = 1200;

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
  "[": [".###.", ".#...", ".#...", ".#...", ".#...", ".#...", ".###."],
  "]": [".###.", "...#.", "...#.", "...#.", "...#.", "...#.", ".###."],
};

// ---------------------------------------------------------------------------
// Canvas: RGB buffer + primitive drawing.
// ---------------------------------------------------------------------------
type RGB = [number, number, number];

class Canvas {
  w: number;
  h: number;
  buf: Buffer;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.buf = Buffer.alloc(w * h * 3, 0);
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
  fillCircle(cx: number, cy: number, r: number, c: RGB): void {
    const rr = Math.floor(r);
    for (let dy = -rr; dy <= rr; dy++) {
      const dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      this.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1, c);
    }
  }
  fillPolygon(pts: [number, number][], c: RGB): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.ceil(xs[k]);
        const xb = Math.floor(xs[k + 1]);
        if (xb >= xa) this.fillRect(xa, y, xb - xa + 1, 1, c);
      }
    }
  }
  // 4-point sparkle (diamond star) centred at (cx, cy), radius r.
  sparkle(cx: number, cy: number, r: number, c: RGB): void {
    const k = 0.28;
    this.fillPolygon(
      [
        [cx, cy - r],
        [cx + r * k, cy - r * k],
        [cx + r, cy],
        [cx + r * k, cy + r * k],
        [cx, cy + r],
        [cx - r * k, cy + r * k],
        [cx - r, cy],
        [cx - r * k, cy - r * k],
      ],
      c
    );
  }
  textWidth(s: string, scale: number): number {
    return s.length * 6 * scale - scale;
  }
  text(x: number, y: number, s: string, scale: number, c: RGB): void {
    for (let i = 0; i < s.length; i++) {
      const g = FONT[s[i]] || FONT["?"];
      const gx = x + i * 6 * scale;
      for (let r = 0; r < 7; r++) {
        const row = g[r];
        for (let col = 0; col < 5; col++) {
          if (row[col] === "#") {
            this.fillRect(gx + col * scale, y + r * scale, scale, scale, c);
          }
        }
      }
    }
  }
  textRight(rightX: number, y: number, s: string, scale: number, c: RGB): void {
    this.text(rightX - this.textWidth(s, scale), y, s, scale, c);
  }
  textCenter(cx: number, y: number, s: string, scale: number, c: RGB): void {
    this.text(cx - Math.floor(this.textWidth(s, scale) / 2), y, s, scale, c);
  }
  // Vertical gradient, top colour to bottom colour.
  vgrad(top: RGB, bottom: RGB): void {
    for (let y = 0; y < this.h; y++) {
      const t = y / (this.h - 1);
      const c: RGB = [
        Math.round(top[0] + (bottom[0] - top[0]) * t),
        Math.round(top[1] + (bottom[1] - top[1]) * t),
        Math.round(top[2] + (bottom[2] - top[2]) * t),
      ];
      this.fillRect(0, y, this.w, 1, c);
    }
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
// make.fun ghost, drawn from primitives. Dome + body + 3-lobe hem + sparkle
// eyes + star on the chest. (cx, cy) = centre of the head dome, s = radius.
// ---------------------------------------------------------------------------
function ghostShapes(cv: Canvas, cx: number, cy: number, s: number, c: RGB): void {
  cv.fillCircle(cx, cy, s, c);
  cv.fillRect(cx - s, cy, s * 2, s * 0.85, c);
  const lr = s * 0.42;
  cv.fillCircle(cx - s * 0.58, cy + s * 0.85, lr, c);
  cv.fillCircle(cx, cy + s * 0.85, lr, c);
  cv.fillCircle(cx + s * 0.58, cy + s * 0.85, lr, c);
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
    ghostShapes(cv, cx, cy, s + 3, outline);
  }
  ghostShapes(cv, cx, cy, s, fill);
  cv.sparkle(cx - s * 0.38, cy - s * 0.12, s * 0.17, eye);
  cv.sparkle(cx + s * 0.38, cy - s * 0.12, s * 0.17, eye);
  cv.sparkle(cx, cy + s * 0.48, s * 0.2, star);
}

// ---------------------------------------------------------------------------
// Palette per style.
// ---------------------------------------------------------------------------
interface Pal {
  outerTop: RGB;
  outerBottom: RGB;
  paper: RGB;
  paperLine: RGB;
  header: RGB;
  headerRule: RGB;
  headerSub: RGB;
  meta: RGB;
  divider: RGB;
  label: RGB;
  price: RGB;
  sub: RGB;
  totalLabel: RGB;
  totalPrice: RGB;
  red: RGB;
  fine: RGB;
  band: RGB;
  bandText: RGB;
  ghostFill: RGB;
  ghostOutline: RGB | null;
  ghostEye: RGB;
  ghostStar: RGB;
  sealFill: RGB;
  sealGhost: RGB;
  sealEye: RGB;
  dots: RGB;
}

const LIGHT: Pal = {
  outerTop: [91, 42, 134],
  outerBottom: [30, 11, 56],
  paper: [247, 241, 222],
  paperLine: [216, 205, 176],
  header: [16, 36, 62],
  headerRule: [16, 36, 62],
  headerSub: [255, 213, 79],
  meta: [85, 85, 85],
  divider: [26, 26, 26],
  label: [17, 17, 17],
  price: [17, 17, 17],
  sub: [107, 107, 107],
  totalLabel: [17, 17, 17],
  totalPrice: [198, 40, 40],
  red: [198, 40, 40],
  fine: [119, 119, 119],
  band: [233, 30, 99],
  bandText: [255, 255, 255],
  ghostFill: [255, 255, 255],
  ghostOutline: [17, 17, 17],
  ghostEye: [17, 17, 17],
  ghostStar: [233, 30, 99],
  sealFill: [255, 255, 255],
  sealGhost: [16, 36, 62],
  sealEye: [255, 255, 255],
  dots: [153, 153, 153],
};

const DARK: Pal = {
  outerTop: [0, 0, 0],
  outerBottom: [0, 0, 0],
  paper: [21, 32, 43],
  paperLine: [56, 68, 77],
  header: [0, 0, 0],
  headerRule: [29, 155, 240],
  headerSub: [29, 155, 240],
  meta: [139, 152, 165],
  divider: [139, 152, 165],
  label: [231, 233, 234],
  price: [231, 233, 234],
  sub: [139, 152, 165],
  totalLabel: [231, 233, 234],
  totalPrice: [244, 33, 46],
  red: [244, 33, 46],
  fine: [139, 152, 165],
  band: [233, 30, 99],
  bandText: [255, 255, 255],
  ghostFill: [255, 255, 255],
  ghostOutline: [0, 0, 0],
  ghostEye: [0, 0, 0],
  ghostStar: [233, 30, 99],
  sealFill: [255, 255, 255],
  sealGhost: [0, 0, 0],
  sealEye: [255, 255, 255],
  dots: [83, 100, 113],
};

// ---------------------------------------------------------------------------
// Line items. main + sub. Each sub is a second joke, never filler.
// ---------------------------------------------------------------------------
interface Item {
  main: string;
  price: string;
  sub: string;
}

const ITEMS: Item[] = [
  {
    main: "X PREMIUM - 158 MONTHS X $8.00",
    price: "$1,264.00",
    sub: "SEP 2013 - NOV 2026. THE CHECKMARK OUTLIVED MY TEENS",
  },
  {
    main: "PRIORITY REPLIES - 0 SEEN BY ROCKSTAR",
    price: "$0.00",
    sub: "I REPLIED TO EVERY ROCKSTAR POST SINCE 2013",
  },
  {
    main: "EDIT BUTTON - USED 0 TIMES",
    price: "$0.00",
    sub: "EVERY TYPO ABOUT GTA VI IS STILL UP THERE",
  },
  {
    main: "GROK: WHEN IS GTA VI OUT?",
    price: "$0.00",
    sub: "ASKED 4,811 TIMES. GROK SAID SOON 4,810 TIMES",
  },
  {
    main: "TIMELINE REFRESHES - 6,927,840",
    price: "$0.00",
    sub: "ONE A MINUTE, 13 YEARS. I BLINKED TWICE",
  },
  {
    main: "AD-FREE FEED - 214 ADS SEEN",
    price: "$0.00",
    sub: "THEY JUST WEAR NICER SUITS NOW",
  },
  {
    main: "LONG POSTS - 4,811 POSTED, 0 READ",
    price: "$0.00",
    sub: "2 LIKES. BOTH FROM MY AGENT",
  },
  {
    main: "BOOKMARK: GTA VI DATE (REAL!)",
    price: "$0.00",
    sub: "SAVED 13 YEARS AGO. LINK DEAD. THE WAIT IS NOT",
  },
];

// ---------------------------------------------------------------------------
// Rotated PAID stamp. Rendered on a small canvas, then blitted rotated.
// ---------------------------------------------------------------------------
function makeStamp(p: Pal): Canvas {
  const sw = 340;
  const sh = 88;
  const cv = new Canvas(sw, sh);
  const red = p.red;
  // Double border.
  cv.fillRect(3, 3, sw - 6, 4, red);
  cv.fillRect(3, sh - 7, sw - 6, 4, red);
  cv.fillRect(3, 3, 4, sh - 6, red);
  cv.fillRect(sw - 7, 3, 4, sh - 6, red);
  cv.fillRect(11, 11, sw - 22, 2, red);
  cv.fillRect(11, sh - 13, sw - 22, 2, red);
  cv.fillRect(11, 11, 2, sh - 22, red);
  cv.fillRect(sw - 13, 11, 2, sh - 22, red);
  cv.textCenter(sw / 2, 18, "PAID", 6, red);
  cv.textCenter(sw / 2, 60, "BY MY AI AGENT ON MAKE.FUN", 2, red);
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
// Render the bill.
// ---------------------------------------------------------------------------
function render(p: Pal): Canvas {
  const cv = new Canvas(W, H);
  cv.vgrad(p.outerTop, p.outerBottom);

  // Paper.
  cv.fillRect(60, 40, 1080, 960, p.paper);
  // Inner border line.
  cv.fillRect(72, 52, 1056, 2, p.paperLine);
  cv.fillRect(72, 986, 1056, 2, p.paperLine);
  cv.fillRect(72, 52, 2, 936, p.paperLine);
  cv.fillRect(1126, 52, 2, 936, p.paperLine);

  const IX0 = 84; // inner left
  const IX1 = 1116; // inner right

  // Header band.
  cv.fillRect(60, 40, 1080, 150, p.header);
  cv.fillRect(60, 184, 1080, 6, p.headerRule);
  // X logo: font X at scale 12.
  cv.text(84, 72, "X", 12, [255, 255, 255]);
  cv.text(200, 75, "X PREMIUM", 8, [255, 255, 255]);
  cv.text(200, 131, "BILLING STATEMENT", 4, p.headerSub);
  // Ghost seal, top right: white disc, navy ghost inside.
  cv.fillCircle(1040, 115, 60, p.sealFill);
  cv.fillCircle(1040, 115, 60, p.sealFill);
  drawGhost(cv, 1040, 100, 30, p.sealGhost, null, p.sealEye, p.ghostStar);

  // Meta block, two rows, two columns.
  cv.text(IX0, 212, "ACCOUNT: ONE PATIENT GAMER", 3, p.meta);
  cv.textRight(IX1, 212, "STATEMENT NO. 000013", 3, p.meta);
  cv.text(IX0, 244, "PERIOD: SEP 17, 2013 - NOV 19, 2026", 3, p.meta);
  cv.textRight(IX1, 244, "DUE: NOV 19, 2026", 3, p.meta);

  // Divider (double rule).
  cv.fillRect(IX0, 272, IX1 - IX0, 3, p.divider);
  cv.fillRect(IX0, 278, IX1 - IX0, 1, p.divider);

  // Line items.
  let y = 292;
  const pitch = 64;
  for (const it of ITEMS) {
    cv.text(IX0, y, it.main, 4, p.label);
    cv.textRight(IX1, y, it.price, 4, p.price);
    // Dotted leader between label and price.
    const lw = cv.textWidth(it.main, 4);
    const pw = cv.textWidth(it.price, 4);
    const gx0 = IX0 + lw + 12;
    const gx1 = IX1 - pw - 12;
    for (let dx = gx0; dx <= gx1 - 3; dx += 14) {
      cv.fillRect(dx, y + 11, 3, 3, p.dots);
    }
    cv.text(IX0, y + 30, it.sub, 3, p.sub);
    y += pitch;
  }

  // Total divider + total row.
  cv.fillRect(IX0, 800, IX1 - IX0, 3, p.divider);
  cv.fillRect(IX0, 806, IX1 - IX0, 1, p.divider);
  cv.text(IX0, 818, "TOTAL DUE", 5, p.totalLabel);
  cv.textRight(IX1, 814, "$1,264.00", 6, p.totalPrice);

  // Red punchline under the total, left-aligned so the stamp never crosses it.
  cv.text(IX0, 862, "THAT'S 15 COPIES OF GTA VI. I OWN ZERO.", 3, p.red);

  // Fine print, bottom left.
  cv.text(IX0, 908, "NO REFUNDS. THE CHECKMARK IS FOREVER.", 2, p.fine);
  cv.text(IX0, 932, "THE WAIT WAS LONGER. QUESTIONS? ASK GROK.", 2, p.fine);
  cv.text(IX0, 956, "HE'LL SAY 'SOON'.", 2, p.fine);

  // PAID stamp, rotated, bottom right.
  const stamp = makeStamp(p);
  blitRotated(cv, stamp, 860, 933, -8);

  // Magenta payoff band below the paper: ghost + resolution text.
  cv.roundRect(40, 1010, 1120, 150, 18, p.band);
  drawGhost(cv, 175, 1072, 40, p.ghostFill, p.ghostOutline, p.ghostEye, p.ghostStar);
  cv.text(270, 1040, "PAID IN FULL BY MY AI AGENT", 5, p.bandText);
  cv.text(270, 1086, "WITH A BOUNTY IT EARNED ON MAKE.FUN", 4, p.bandText);

  return cv;
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
// Main.
// ---------------------------------------------------------------------------
function main(): void {
  const style = (process.env.STYLE || "light").toLowerCase();
  const pal = style === "dark" ? DARK : LIGHT;
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  const preview = process.env.PREVIEW_480 === "1";
  const cv = render(pal);
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
