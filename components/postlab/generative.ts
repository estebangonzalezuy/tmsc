// Dithered forms — the club's own ordered-dither renderer. A grayscale
// source pattern (rings, ramp, bars, giant type) is sampled at the dither
// cell size, bent through a flow field, thresholded against a Bayer 4x4
// matrix, and drawn as crisp pixels. Same visual language as the Paper
// Shaders dithering, with shapes it doesn't have.
//
// Loop contract: every pattern is periodic in `duration` seconds (speeds
// resolve to whole cycles per loop), so recorded reels loop seamlessly.

import { tones, type ShaderSpec, type Theme } from "@/lib/postlab";

const TAU = Math.PI * 2;

const num = (v: number | string | undefined, def: number) =>
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

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/* Reusable scratch canvases (glyph mask + low-res dither target). */
let maskCanvas: HTMLCanvasElement | null = null;
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
) {
  const { ink, bg } = tones(theme);
  const u = w / 1080;
  const D = Math.max(2, duration);
  const tt = (((t % D) + D) % D) / D;
  const cycles = Math.max(1, Math.round(num(spec.speed, 0.5) * 3));
  const ph = tt * cycles; // grows by an integer over one loop
  const warp = Math.max(0, Math.min(1, num(spec.warp, 0.2)));
  const density = num(spec.density, 8);
  const pattern = String(spec.pattern ?? "rings");
  const px = Math.max(2, Math.round(num(spec.pixel, 6) * u));
  const inkAlpha = Math.min(1, Math.max(0.1, num(spec.ink, 1)));

  const cw = Math.ceil(w / px);
  const chh = Math.ceil(h / px);

  /* Glyph mask for the "letter" pattern, rendered at cell resolution. */
  let mask: Uint8ClampedArray | null = null;
  if (pattern === "letter") {
    if (!maskCanvas) maskCanvas = document.createElement("canvas");
    maskCanvas.width = cw;
    maskCanvas.height = chh;
    const mctx = maskCanvas.getContext("2d", { willReadFrequently: true })!;
    mctx.clearRect(0, 0, cw, chh);
    const word = String(spec.word ?? "M");
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

  /* Grayscale source: darkness in [0,1] at a cell, coordinates normalized
     to the shorter side, centered. */
  const m = Math.min(cw, chh);
  const darkness = (cx: number, cy: number): number => {
    let x = (cx - cw / 2) / m;
    let y = (cy - chh / 2) / m;
    if (warp > 0) {
      const f = flow(x * 2.4, y * 2.4, ph);
      x += f.fx * warp * 0.18;
      y += f.fy * warp * 0.18;
    }
    switch (pattern) {
      case "ramp": {
        const a = TAU / 8;
        const proj = x * Math.cos(a) + y * Math.sin(a);
        return 0.5 + 0.5 * Math.sin(TAU * (ph - proj * (density * 0.25)));
      }
      case "bars": {
        const rows = Math.max(2, Math.round(density));
        const row = Math.floor((y + 0.75) * rows);
        const bw = 0.5 + 0.45 * Math.sin(TAU * (ph + row * 0.13));
        const edge = (x + 0.5) - bw;
        return Math.max(0, Math.min(1, 0.5 - edge * 14));
      }
      case "letter": {
        if (!mask) return 0;
        const ix =
          (Math.max(0, Math.min(cw - 1, Math.round(x * m + cw / 2))) +
            Math.max(0, Math.min(chh - 1, Math.round(y * m + chh / 2))) * cw) *
          4;
        return mask[ix + 3] / 255;
      }
      default: {
        // rings — concentric waves breathing outward from the center
        const r = Math.hypot(x, y);
        return 0.5 + 0.5 * Math.sin(TAU * (r * (density * 0.45) - ph));
      }
    }
  };

  /* Bayer-threshold the source into binary pixels at cell resolution. */
  if (!outCanvas) outCanvas = document.createElement("canvas");
  outCanvas.width = cw;
  outCanvas.height = chh;
  const octx = outCanvas.getContext("2d", { willReadFrequently: true })!;
  const img = octx.createImageData(cw, chh);
  const data = img.data;
  const inkR = parseInt(ink.slice(1, 3), 16);
  const inkG = parseInt(ink.slice(3, 5), 16);
  const inkB = parseInt(ink.slice(5, 7), 16);
  for (let cy = 0; cy < chh; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const d = darkness(cx, cy);
      const threshold = (BAYER4[cy % 4][cx % 4] + 0.5) / 16;
      if (d > threshold) {
        const o = (cy * cw + cx) * 4;
        data[o] = inkR;
        data[o + 1] = inkG;
        data[o + 2] = inkB;
        data[o + 3] = 255;
      }
    }
  }
  octx.putImageData(img, 0, 0);

  /* Composite: solid background, then the dithered pixels scaled up crisp,
     honoring the layer transform (drag / pinch / rotate). */
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const c2x = w / 2;
  const c2y = h / 2;
  ctx.translate(c2x + num(spec.offsetX, 0) * w, c2y + num(spec.offsetY, 0) * h);
  ctx.rotate((num(spec.rotation, 0) * Math.PI) / 180);
  const sc = Math.max(0.1, num(spec.scale, 1));
  ctx.scale(sc, sc);
  ctx.translate(-c2x, -c2y);

  ctx.globalAlpha = inkAlpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(outCanvas, 0, 0, cw * px, chh * px);
  ctx.restore();
}
