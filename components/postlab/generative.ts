// Dithered forms — the club's own ordered-dither renderer. A grayscale
// source form (rings, ramp, bars, giant type, spirals, lattices, metaballs,
// tunnels, clouds, moiré) is sampled at the dither cell size, optionally
// mixed with a second form, bent through a flow field, mirrored, thresholded
// against a screen, and drawn as crisp pixels. Same visual language as the
// Paper Shaders dithering, with shapes it doesn't have.
//
// Everything combines before the threshold. That is the rule that keeps this
// a dithering instrument rather than a pile of effects: two forms mix as
// grayscale and the result is dithered once, so the output is always the
// same hard-edged ink-or-nothing pixels.
//
// Loop contract: every form is periodic in `duration` seconds (speeds and
// colour rotations resolve to whole cycles per loop), so recorded reels loop
// seamlessly.

import {
  PALETTE,
  resolveLayer,
  tones,
  type FilterSpec,
  type LayerSpec,
  type PostFormat,
  type ShaderSpec,
  type Theme,
} from "@/lib/postlab";
import { drawKineticLayer } from "@/components/kinetics/asLayer";
import { drawTileLayer } from "@/components/tiles/asLayer";
import type { SceneId } from "@/lib/kinetics";
import { photo } from "./photos";
import { clip, frameAt } from "./clips";
import { applyFilters } from "./filters";

const TAU = Math.PI * 2;

const num = (v: unknown, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : def;

/* Smooth pseudo-noise flow field in ~[-1,1]²; time only enters as sin/cos of
   TAU·ph so ph=0 and ph=cycles produce identical fields. */
function flow(nx: number, ny: number, ph: number): { fx: number; fy: number } {
  const t = TAU * ph;
  const fx =
    (Math.sin(nx * 3.1 + Math.cos(ny * 2.3 + t) + t) +
      0.5 * Math.sin(ny * 5.7 - t + 1.3)) /
    1.5;
  const fy =
    (Math.cos(ny * 2.9 + Math.sin(nx * 3.7 - t) - t) +
      0.5 * Math.cos(nx * 4.9 + t + 2.1)) /
    1.5;
  return { fx, fy };
}

export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const BAYER2 = [
  [0, 2],
  [3, 1],
];

/* The Bayer matrices are self-similar: doubling one is four copies of it,
   each nudged by the 2x2. Building 8x8 rather than typing it keeps the two
   in step. */
const BAYER8 = Array.from({ length: 8 }, (_, y) =>
  Array.from(
    { length: 8 },
    (_, x) => 4 * BAYER4[y % 4][x % 4] + BAYER2[Math.floor(y / 4)][Math.floor(x / 4)],
  ),
);

const hash01 = (a: number, b: number, c: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return x - Math.floor(x);
};

/* The screen a cell is measured against. Ordered matrices give the classic
   cross-hatch; "lines" is a one-dimensional screen (engraving); "noise" is
   a fixed random screen (grainier, no visible grid). */
export function screenAt(kind: string, cx: number, cy: number): number {
  switch (kind) {
    case "2x2":
      return (BAYER2[cy % 2][cx % 2] + 0.5) / 4;
    case "8x8":
      return (BAYER8[cy % 8][cx % 8] + 0.5) / 64;
    case "lines":
      return ((cy % 4) + 0.5) / 4;
    case "noise":
      return hash01(cx, cy, 7.7);
    default:
      return (BAYER4[cy % 4][cx % 4] + 0.5) / 16;
  }
}

/* Mirror the sampling coordinates before the form is evaluated, so any form
   can be made symmetrical without stacking a second layer. */
function foldXY(kind: string, x: number, y: number): { x: number; y: number } {
  switch (kind) {
    case "x":
      return { x: Math.abs(x), y };
    case "y":
      return { x, y: Math.abs(y) };
    case "quad":
      return { x: Math.abs(x), y: Math.abs(y) };
    case "radial": {
      // Six-fold kaleidoscope: the angle is folded into one wedge.
      const r = Math.hypot(x, y);
      const w = TAU / 6;
      const a = Math.abs((((Math.atan2(y, x) % w) + w) % w) - w / 2);
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    }
    default:
      return { x, y };
  }
}

/* Combine two grayscale forms before the threshold. Everything downstream
   still sees one source, so the result dithers exactly like a single form. */
function combine(mode: string, a: number, b: number): number {
  switch (mode) {
    case "add":
      return Math.min(1, a + b);
    case "sub":
      return Math.max(0, a - b);
    case "mul":
      return a * b;
    case "diff":
      return Math.abs(a - b);
    case "max":
      return Math.max(a, b);
    case "min":
      return Math.min(a, b);
    default:
      return a;
  }
}

/* Reusable scratch canvases (glyph mask, photo sample, dither target). */
let maskCanvas: HTMLCanvasElement | null = null;
let picCanvas: HTMLCanvasElement | null = null;
let outCanvas: HTMLCanvasElement | null = null;

let cachedFont: string | null = null;
const uiFont = () => {
  if (!cachedFont && typeof document !== "undefined")
    cachedFont = getComputedStyle(document.body).fontFamily;
  return cachedFont || "sans-serif";
};

export function drawGenerative(
  ctx: CanvasRenderingContext2D,
  spec: ShaderSpec,
  theme: Theme,
  t: number,
  duration: number,
  w: number,
  h: number,
  color?: {
    ink?: string;
    seed: number;
    palette?: readonly string[];
    /** Only for `ink: "mix"` — see the mixing block below. */
    inks?: readonly string[];
    mixMode?: string;
    mixScale?: number;
    mixSpeed?: number;
  },
  /** The post's format, which the Kinetics needs to measure design units. */
  format?: PostFormat,
  /* The slide's headline, for the one layer type whose subject is the words.
     Passed in rather than read from anywhere, because a layer has no idea
     which slide it is on. */
  words = "",
) {
  if (spec.type === "tiles") {
    const named = String(spec.tpalette ?? "own");
    drawTileLayer(ctx, String(spec.tile ?? "spokes"), t, w, h, {
      format: format ?? "portrait",
      duration,
      density: num(spec.tdensity, 0.5),
      hand: num(spec.thand, 0.4),
      boil: num(spec.tboil, 3),
      palette: named === "own" ? undefined : named,
      /* Only when the layer was told to mix. A tile's own inks are part of
         what it is, so the post's palette has to be asked for. */
      inks: color?.ink === "mix" ? (color.inks ?? color.palette) : undefined,
    });
    return;
  }
  if (spec.type === "kinetics") {
    drawKineticLayer(ctx, String(spec.scene ?? "stagger") as SceneId, t, w, h, {
      words,
      format: format ?? "portrait",
      duration,
      theme,
      density: num(spec.density, 0.45),
      blot: num(spec.kblot, 0),
      face: String(spec.kface ?? "sans") as "sans" | "serif" | "gothic",
      weight: num(spec.kweight, 800),
      ink: color?.ink,
      palette: color?.ink === "mix" ? (color.inks ?? color.palette) : undefined,
    });
    return;
  }
  const { ink } = tones(theme);
  const u = w / 1080;
  const D = Math.max(2, duration);
  const tt = (((t % D) + D) % D) / D;
  /* Any parameter given a wave is resolved to the number it holds at this
     point in the loop, once, here — so the preview and the exporter run the
     same arithmetic and there is only one place that knows about motion.
     Every wave returns to its start at tt=1, so this can't open a seam. */
  const s = resolveLayer(spec as LayerSpec, tt);
  const cycles = Math.max(1, Math.round(num(s.speed, 0.5) * 3));
  const ph = tt * cycles; // grows by an integer over one loop
  const warp = Math.max(0, Math.min(1, num(s.warp, 0.2)));
  const density = num(s.density, 8);
  const pattern = String(s.pattern ?? "rings");
  /* All three default to "off", so a layer written before they existed
     renders exactly as it always did. */
  const pattern2 = String(s.pattern2 ?? "none");
  const mix = String(s.mix ?? "solo");
  const fold = String(s.fold ?? "none");
  const dtype = String(s.dtype ?? "4x4");
  const px = Math.max(2, Math.round(num(s.pixel, 6) * u));
  const inkAlpha = Math.min(1, Math.max(0.1, num(s.ink, 1)));

  const cw = Math.ceil(w / px);
  const chh = Math.ceil(h / px);

  /* Luminance of the layer's picture, sampled once at cell resolution. The
     photo is a grayscale source like every other form here: it meets the
     same threshold and comes out in the same pixels, so it can be mixed,
     folded and inked exactly like a drawn one. */
  let pic: Float32Array | null = null;
  if (pattern === "photo" || pattern2 === "photo") {
    const src = typeof s.src === "string" ? s.src : undefined;
    const gamma = Math.max(0.2, num(s.exposure, 1));
    const film = clip(src);
    if (film) {
      /* A clip is already grayscale at sample resolution, so it skips the
         canvas: nearest-neighbour straight into the cell grid. Which frame is
         a whole number of trips through the clip over the loop, so a film can
         no more open a seam than a travelling number can. */
      const frame = frameAt(film, tt, num(s.clipCycles, 1));
      const contain = s.fit === "contain";
      const k = contain
        ? Math.min(cw / film.w, chh / film.h)
        : Math.max(cw / film.w, chh / film.h);
      const dw = film.w * k;
      const dh = film.h * k;
      const ox = (cw - dw) / 2;
      const oy = (chh - dh) / 2;
      pic = new Float32Array(cw * chh);
      for (let y = 0; y < chh; y++) {
        const sy = Math.floor((y - oy) / k);
        for (let x = 0; x < cw; x++) {
          const sx = Math.floor((x - ox) / k);
          if (sx < 0 || sy < 0 || sx >= film.w || sy >= film.h) continue;
          /* Darkness, not brightness: everywhere else in here 1 means ink. */
          pic[y * cw + x] = Math.pow(1 - frame[sy * film.w + sx] / 255, gamma);
        }
      }
    }
    const img = film ? null : photo(src);
    if (img && img.width && img.height) {
      if (!picCanvas) picCanvas = document.createElement("canvas");
      picCanvas.width = cw;
      picCanvas.height = chh;
      const pctx = picCanvas.getContext("2d", { willReadFrequently: true })!;
      pctx.clearRect(0, 0, cw, chh);
      /* Cover by default: a background with a letterbox in it is not a
         background. */
      const contain = s.fit === "contain";
      const k = contain
        ? Math.min(cw / img.width, chh / img.height)
        : Math.max(cw / img.width, chh / img.height);
      const dw = img.width * k;
      const dh = img.height * k;
      pctx.drawImage(img, (cw - dw) / 2, (chh - dh) / 2, dw, dh);
      const px4 = pctx.getImageData(0, 0, cw, chh).data;
      pic = new Float32Array(cw * chh);
      for (let j = 0; j < pic.length; j++) {
        const o = j * 4;
        /* Darkness, not brightness: everywhere else in here 1 means ink. */
        const lum =
          (0.299 * px4[o] + 0.587 * px4[o + 1] + 0.114 * px4[o + 2]) / 255;
        pic[j] = Math.pow(1 - lum, gamma) * (px4[o + 3] / 255);
      }
    }
  }

  /* Glyph mask for the "letter" pattern, rendered at cell resolution. */
  let mask: Uint8ClampedArray | null = null;
  if (pattern === "letter") {
    if (!maskCanvas) maskCanvas = document.createElement("canvas");
    maskCanvas.width = cw;
    maskCanvas.height = chh;
    const mctx = maskCanvas.getContext("2d", { willReadFrequently: true })!;
    mctx.clearRect(0, 0, cw, chh);
    const word = String(s.word ?? "M");
    const pulse = 1 + 0.12 * Math.sin(TAU * ph);
    const size =
      (word.length > 1 ? (cw / word.length) * 1.6 : Math.min(cw, chh) * 0.95) *
      pulse;
    mctx.font = `700 ${size}px ${uiFont()}`;
    mctx.textAlign = "center";
    mctx.textBaseline = "middle";
    mctx.fillStyle = "#fff";
    mctx.fillText(word, cw / 2, chh / 2);
    mask = mctx.getImageData(0, 0, cw, chh).data;
  }

  /* Grayscale source: darkness in [0,1] at a point, coordinates normalized
     to the shorter side, centered. Every form is periodic in `p` — time only
     ever enters as sin/cos of TAU·p — which is what lets a recorded reel
     loop without a seam. */
  const m = Math.min(cw, chh);
  const form = (kind: string, x: number, y: number, p: number): number => {
    switch (kind) {
      case "ramp": {
        const a = TAU / 8;
        const proj = x * Math.cos(a) + y * Math.sin(a);
        return 0.5 + 0.5 * Math.sin(TAU * (p - proj * (density * 0.25)));
      }
      case "bars": {
        const rows = Math.max(2, Math.round(density));
        const row = Math.floor((y + 0.75) * rows);
        const bw = 0.5 + 0.45 * Math.sin(TAU * (p + row * 0.13));
        const edge = x + 0.5 - bw;
        return Math.max(0, Math.min(1, 0.5 - edge * 14));
      }
      case "photo": {
        if (!pic) return 0;
        const ix = Math.max(0, Math.min(cw - 1, Math.round(x * m + cw / 2)));
        const iy = Math.max(0, Math.min(chh - 1, Math.round(y * m + chh / 2)));
        return pic[iy * cw + ix];
      }
      case "letter": {
        if (!mask) return 0;
        const ix =
          (Math.max(0, Math.min(cw - 1, Math.round(x * m + cw / 2))) +
            Math.max(0, Math.min(chh - 1, Math.round(y * m + chh / 2))) * cw) *
          4;
        return mask[ix + 3] / 255;
      }
      case "spiral": {
        // Arms winding out of the centre; an integer arm count keeps the
        // seam at ±π invisible.
        const r = Math.hypot(x, y);
        const arms = Math.max(1, Math.round(density / 3));
        const a = Math.atan2(y, x);
        return 0.5 + 0.5 * Math.sin(TAU * ((a * arms) / TAU + r * density * 0.35 - p));
      }
      case "grid": {
        // Two crossed wave trains — a lattice that pulses cell by cell.
        const k = Math.max(1, density * 0.6);
        return (
          0.5 +
          0.5 * Math.sin(TAU * (x * k - p)) * Math.sin(TAU * (y * k + p))
        );
      }
      case "blobs": {
        // Metaballs on circular orbits, so the whole field is periodic.
        // Density buys more of them, each proportionally smaller, so the
        // frame stays about as full either way.
        const count = Math.max(2, Math.min(8, Math.round(density / 3)));
        const rr = 0.3 / Math.sqrt(count);
        let f = 0;
        for (let i = 0; i < count; i++) {
          const a = TAU * (p * (i % 2 ? 1 : -1) + i / count);
          /* Orbits wide enough that the balls meet and part rather than
             sitting permanently merged in the middle. */
          const orbit = 0.22 + 0.16 * ((i % 3) / 2);
          const bx = Math.cos(a) * orbit;
          const by = Math.sin(a + i) * orbit;
          f += (rr * rr) / ((x - bx) ** 2 + (y - by) ** 2 + 1e-5);
        }
        // f = 1 is the classic metaball surface; the slope sets how soft it
        // reads once the dither has had it.
        return Math.max(0, Math.min(1, (f - 1) * 2 + 0.5));
      }
      case "tunnel": {
        // Square rings on a log scale — reads as depth rushing past.
        const d = Math.max(Math.abs(x), Math.abs(y)) + 0.02;
        return 0.5 + 0.5 * Math.sin(TAU * (Math.log(d) * (density * 0.28) + p));
      }
      case "noise": {
        // Layered sines standing in for value noise: cloudy, never repeating
        // visibly, still exactly periodic in p. Each octave is phase-shifted
        // by the one before it, which is what stops it reading as a ramp.
        // k counts cycles across half the frame, like every other form here.
        const t = TAU * p;
        const k = 0.5 + density * 0.22;
        const n =
          Math.sin(TAU * x * k + Math.cos(TAU * y * k * 0.7 + t)) +
          0.8 * Math.sin(TAU * y * k * 1.3 - t + Math.sin(TAU * x * k * 0.5)) +
          0.6 * Math.sin(TAU * (x + y) * k * 0.9 + t * 2);
        return Math.max(0, Math.min(1, 0.5 + n / 3.4));
      }
      case "moire": {
        // Two nearly-aligned wave trains beating against each other.
        const k = 4 + density * 1.2;
        const a1 = Math.sin(TAU * (x * k + p));
        const a2 = Math.sin(
          TAU * ((x * Math.cos(0.18) + y * Math.sin(0.18)) * k * 1.06 - p),
        );
        return Math.max(0, Math.min(1, 0.5 + 0.5 * a1 * a2));
      }
      default: {
        // rings — concentric waves breathing outward from the center
        const r = Math.hypot(x, y);
        return 0.5 + 0.5 * Math.sin(TAU * (r * (density * 0.45) - p));
      }
    }
  };

  const darkness = (cx: number, cy: number): number => {
    let x = (cx - cw / 2) / m;
    let y = (cy - chh / 2) / m;
    if (warp > 0) {
      const f = flow(x * 2.4, y * 2.4, ph);
      x += f.fx * warp * 0.18;
      y += f.fy * warp * 0.18;
    }
    if (fold !== "none") ({ x, y } = foldXY(fold, x, y));
    const a = form(pattern, x, y, ph);
    if (pattern2 === "none" || mix === "solo") return a;
    /* The second form is sampled slightly bigger and half a cycle out of
       step. Aligned copies would just cancel or double; offset ones beat
       against each other, which is the whole point of mixing two. */
    return combine(mix, a, form(pattern2, x * 1.27, y * 1.27, ph + 0.5));
  };

  /* Bayer-threshold the source into binary pixels at cell resolution. */
  if (!outCanvas) outCanvas = document.createElement("canvas");
  outCanvas.width = cw;
  outCanvas.height = chh;
  const octx = outCanvas.getContext("2d", { willReadFrequently: true })!;
  const img = octx.createImageData(cw, chh);
  const data = img.data;
  /* One ink, or the palette moving across the pixels. A pixel starts on a
     colour and then travels through the list, but neighbours are offset in
     phase, so the mosaic shifts continuously instead of flashing over all at
     once. The travel completes a whole number of rounds per loop, which is
     what keeps a recorded export looping seamlessly.

     Four things are adjustable and all four are absent by default, so a
     layer written before they existed renders exactly as it did:
       inks     — which colours this layer may use (default: all of them)
       mixMode  — how colour is handed out across the pixels
       mixScale — how big one patch of colour is, in cells
       mixSpeed — how fast colour travels, as a multiple of motion speed
   */
  const rgb = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const list = color?.inks?.length
    ? color.inks
    : color?.palette?.length
      ? color.palette
      : PALETTE;
  /* One colour, a chosen set of them, or the theme's ink. */
  const inks = color?.ink === "mix" ? list.map(rgb) : [rgb(color?.ink || ink)];
  const seed = color?.seed ?? 1;
  const mixMode = color?.mixMode ?? "blocks";
  /* Coarser than one cell: colour moves in patches, which reads as a mosaic
     rather than as noise. */
  const block = Math.max(1, Math.round(color?.mixScale ?? 3));
  /* Whole rounds of the palette per loop — an integer, so colour lands back
     where it started at the end. 0 freezes it. */
  const mixSpeed = color?.mixSpeed ?? 1;
  const rots =
    /* Deliberately the layer's base speed, not the resolved one: this has to
       be the same whole number on every frame or the colours jump. */
    mixSpeed <= 0 ? 0 : Math.max(1, Math.round(num(spec.speed, 0.5) * 2 * mixSpeed));
  const n = inks.length;
  const cx0 = cw / 2;
  const cy0 = chh / 2;

  /* Where in the list a pixel starts, and how far out of step it is with its
     neighbours. The mode picks both, which is what makes one setting read as
     confetti and another as bands sweeping through. */
  const pickInk = (cx: number, cy: number, d: number): number => {
    if (n <= 1) return 0;
    let base: number;
    let offset: number;
    switch (mixMode) {
      case "bands": {
        const b = cy / block;
        base = Math.floor(b);
        offset = b - Math.floor(b);
        break;
      }
      case "radial": {
        const r = Math.hypot(cx - cx0, cy - cy0) / block;
        base = Math.floor(r);
        offset = r - Math.floor(r);
        break;
      }
      case "source": {
        // Colour follows the form's own shading, so shape and colour agree.
        base = Math.floor(d * n);
        offset = d;
        break;
      }
      case "noise": {
        base = Math.floor(hash01(cx, cy, seed) * n);
        offset = hash01(cx, cy, seed + 17);
        break;
      }
      default: {
        const bx = Math.floor(cx / block);
        const by = Math.floor(cy / block);
        base = Math.floor(hash01(bx, by, seed) * n);
        offset = hash01(bx, by, seed + 17);
      }
    }
    const step = rots ? Math.floor((tt + offset) * n * rots) : 0;
    return (((base + step) % n) + n) % n;
  };

  for (let cy = 0; cy < chh; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const d = darkness(cx, cy);
      if (d > screenAt(dtype, cx, cy)) {
        const [r, g, bb] = inks[pickInk(cx, cy, d)];
        const o = (cy * cw + cx) * 4;
        data[o] = r;
        data[o + 1] = g;
        data[o + 2] = bb;
        data[o + 3] = 255;
      }
    }
  }
  octx.putImageData(img, 0, 0);

  /* Composite the dithered pixels scaled up crisp, honoring the layer
     transform (drag / pinch / rotate). Nothing fills the background: the
     canvas stays transparent where the dither is off, so stacked layers
     combine on their own and the slide's background shows through without
     anyone having to reach for a blend mode. */
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.globalAlpha = 1;

  const c2x = w / 2;
  const c2y = h / 2;
  ctx.translate(c2x + num(s.offsetX, 0) * w, c2y + num(s.offsetY, 0) * h);
  ctx.rotate((num(s.rotation, 0) * Math.PI) / 180);
  const sc = Math.max(0.1, num(s.scale, 1));
  ctx.scale(sc, sc);
  ctx.translate(-c2x, -c2y);

  ctx.globalAlpha = inkAlpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(outCanvas, 0, 0, cw * px, chh * px);
  ctx.restore();

  /* Filters run over the finished layer, the same chain the clean families
     get. Dithered pixels can be posterised, grained or inverted like
     anything else. */
  applyFilters(ctx, w, h, s.filters as FilterSpec[] | undefined, theme, ink);
}
