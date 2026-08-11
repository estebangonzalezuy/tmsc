// What happens to a layer after it has been drawn.
//
// The club's screen used to be welded to the thing that drew the image: if
// you wanted the hard pixels you had to use the dithering family, and if you
// wanted a clean shader you couldn't have them. These run over a layer's
// finished canvas instead, so `pixelate` can be put on liquid metal and the
// metal comes out in the club's language.
//
// Every one of them is a pure function of the pixels and its own numbers —
// no time anywhere, not even in the grain, so a filter can never be the
// reason a loop stops closing.

import { BAYER4, screenAt } from "./generative";
import type { FilterSpec, Theme } from "@/lib/postlab";
import { tones } from "@/lib/postlab";

const num = (v: unknown, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : def;

/* One scratch canvas for the downsample step, reused across every layer and
   frame. */
let small: HTMLCanvasElement | null = null;
const scratch = (w: number, h: number) => {
  if (!small) small = document.createElement("canvas");
  if (small.width !== w) small.width = w;
  if (small.height !== h) small.height = h;
  return small;
};

/* Averages the layer into cells, thresholds each one against the club's
   screen, and draws it back at full size with hard edges. Working at cell
   resolution rather than per pixel is what makes this cheap enough to run
   every frame: a 1080x1350 layer at cell 6 is 180x225 decisions.

   Alpha is thresholded too, so a shader that drew nothing stays nothing and
   layers keep stacking without a blend mode. */
function pixelate(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  f: FilterSpec,
  ink: string,
) {
  const cell = Math.max(2, Math.round(num(f.cell, 6) * (w / 1080)));
  const amount = Math.max(0, Math.min(1, num(f.amount, 1)));
  if (amount <= 0) return;
  const kind = String(f.dtype ?? "4x4");
  const cw = Math.max(1, Math.ceil(w / cell));
  const chh = Math.max(1, Math.ceil(h / cell));

  const mini = scratch(cw, chh);
  const mctx = mini.getContext("2d", { willReadFrequently: true })!;
  mctx.clearRect(0, 0, cw, chh);
  mctx.imageSmoothingEnabled = true;
  mctx.drawImage(ctx.canvas, 0, 0, cw, chh); // per-cell average

  const img = mctx.getImageData(0, 0, cw, chh);
  const d = img.data;
  const inkR = parseInt(ink.slice(1, 3), 16);
  const inkG = parseInt(ink.slice(3, 5), 16);
  const inkB = parseInt(ink.slice(5, 7), 16);

  for (let cy = 0; cy < chh; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const o = (cy * cw + cx) * 4;
      const t = screenAt(kind, cx, cy);
      const alpha = d[o + 3] / 255;
      /* How much of the cell is covered, and how dark it is. A cell that is
         both present and dark is where the ink goes. */
      const lum = (0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) / 255;
      const value = alpha * (1 - lum);
      if (value > t) {
        /* At amount 1 the cell becomes flat ink; below that it keeps some of
           the colour it had, which is the way to pixelate a shader without
           throwing its palette away. */
        d[o] = inkR * amount + d[o] * (1 - amount);
        d[o + 1] = inkG * amount + d[o + 1] * (1 - amount);
        d[o + 2] = inkB * amount + d[o + 2] * (1 - amount);
        d[o + 3] = 255;
      } else {
        d[o + 3] = Math.round(d[o + 3] * (1 - amount));
      }
    }
  }
  mctx.putImageData(img, 0, 0);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mini, 0, 0, cw, chh, 0, 0, cw * cell, chh * cell);
  ctx.restore();
}

/* The per-pixel ones, all in a single pass over the buffer. */
function perPixel(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  list: FilterSpec[],
  theme: Theme,
) {
  if (!list.length) return;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const { ink, bg } = tones(theme);
  const inkLum =
    (0.299 * parseInt(ink.slice(1, 3), 16) +
      0.587 * parseInt(ink.slice(3, 5), 16) +
      0.114 * parseInt(ink.slice(5, 7), 16)) /
    255;
  const bgLum =
    (0.299 * parseInt(bg.slice(1, 3), 16) +
      0.587 * parseInt(bg.slice(3, 5), 16) +
      0.114 * parseInt(bg.slice(5, 7), 16)) /
    255;

  for (const f of list) {
    switch (f.type) {
      case "posterize": {
        const steps = Math.max(2, Math.round(num(f.steps, 4)));
        const q = 255 / (steps - 1);
        for (let i = 0; i < d.length; i += 4) {
          d[i] = Math.round(d[i] / q) * q;
          d[i + 1] = Math.round(d[i + 1] / q) * q;
          d[i + 2] = Math.round(d[i + 2] / q) * q;
        }
        break;
      }
      case "levels": {
        const b = num(f.brightness, 0) * 255;
        /* The usual contrast curve, pivoting on mid grey. */
        const c = num(f.contrast, 0);
        const k = (1.015 * (c + 1)) / (1.015 - c);
        for (let i = 0; i < d.length; i += 4) {
          for (let j = 0; j < 3; j++) {
            const v = k * (d[i + j] + b - 128) + 128;
            d[i + j] = v < 0 ? 0 : v > 255 ? 255 : v;
          }
        }
        break;
      }
      case "grain": {
        const amount = num(f.amount, 0.25);
        const size = Math.max(1, Math.round(num(f.size, 1)));
        if (amount <= 0) break;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            /* Sampled on a coarser grid when size > 1, so the grain has a
               shape rather than being one-pixel hiss. */
            const gx = Math.floor(x / size);
            const gy = Math.floor(y / size);
            const r = Math.sin(gx * 127.1 + gy * 311.7) * 43758.5453;
            const nz = (r - Math.floor(r) - 0.5) * 255 * amount;
            const i = (y * w + x) * 4;
            d[i] = Math.max(0, Math.min(255, d[i] + nz));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + nz));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + nz));
          }
        }
        break;
      }
      case "mono": {
        const amount = Math.max(0, Math.min(1, num(f.amount, 1)));
        for (let i = 0; i < d.length; i += 4) {
          const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
          /* Mapped between the slide's own two tones rather than to grey, so
             a monochrome filter on a dark slide goes dark. */
          const v = (bgLum + (inkLum - bgLum) * (1 - lum)) * 255;
          d[i] = d[i] * (1 - amount) + v * amount;
          d[i + 1] = d[i + 1] * (1 - amount) + v * amount;
          d[i + 2] = d[i + 2] * (1 - amount) + v * amount;
        }
        break;
      }
      case "invert": {
        const amount = Math.max(0, Math.min(1, num(f.amount, 1)));
        for (let i = 0; i < d.length; i += 4) {
          d[i] += (255 - 2 * d[i]) * amount;
          d[i + 1] += (255 - 2 * d[i + 1]) * amount;
          d[i + 2] += (255 - 2 * d[i + 2]) * amount;
        }
        break;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Run a layer's filters over its finished canvas, in order.
 *
 * `pixelate` is handled apart from the rest because it is the only one that
 * changes the resolution of the thing: it works on cells and redraws, where
 * everything else walks the pixels once.
 */
export function applyFilters(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  filters: FilterSpec[] | undefined,
  theme: Theme,
  ink: string,
) {
  if (!filters?.length) return;
  let pending: FilterSpec[] = [];
  for (const f of filters) {
    if (f.type === "pixelate") {
      perPixel(ctx, w, h, pending, theme);
      pending = [];
      pixelate(ctx, w, h, f, ink);
    } else {
      pending.push(f);
    }
  }
  perPixel(ctx, w, h, pending, theme);
}

/* Re-exported so the type renderer and the filter share one screen. */
export { BAYER4 };
