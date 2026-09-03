// `filter` — one filter, over its `in` port's finished canvas. The old
// `applyFilters` chained a whole array on one layer; here that's what wiring
// several `filter` nodes in series does, so this node represents exactly one
// filter (a `type` choice) with the union of every filter's own numeric
// params present but only the relevant subset read per `type` — unused ones
// just sit inert, the same way a `ShaderChoice`-driven inspector elsewhere
// already hides irrelevant controls by kind.
//
// Ported from filters.ts almost verbatim. `theme`/`ink` collapse to explicit
// `ink`/`ground` hex params (no Theme type in the node-graph model).
// Filters take no time as an input, ever — not even grain — so a filter can
// never be the reason a loop stops closing.

import type { NodeDef, NodeKindImpl, ParamValue } from "@/lib/postgraph";
import { hash01, screenAt } from "./dither";
import { num, str, clamp, clamp01, makeCanvas, hexToRgb } from "./util";

const TYPES = ["pixelate", "posterize", "levels", "grain", "mono", "invert"];
const DTYPES = ["4x4", "2x2", "8x8", "lines", "noise"];

export const def: NodeDef = {
  kind: "filter",
  label: "Filter",
  hint: "One effect over its input — pixelate, posterize, levels, grain, mono, invert. Chain several by wiring them in series.",
  inputs: ["in"],
  outputs: ["out"],
  controls: [
    { key: "cell", label: "cell", min: 2, max: 40, step: 1, def: 6 },
    { key: "amount", label: "amount", min: 0, max: 1, step: 0.01, def: 1 },
    { key: "steps", label: "steps", min: 2, max: 16, step: 1, def: 4 },
    { key: "brightness", label: "brightness", min: -1, max: 1, step: 0.01, def: 0 },
    { key: "contrast", label: "contrast", min: -1, max: 1, step: 0.01, def: 0 },
    { key: "size", label: "grain size", min: 1, max: 6, step: 1, def: 1 },
  ],
  choices: [
    { key: "type", label: "type", values: TYPES, def: "pixelate" },
    { key: "dtype", label: "screen", values: DTYPES, def: "4x4" },
  ],
};

function defaultParams(): Record<string, ParamValue> {
  return {
    type: "pixelate",
    cell: 6,
    amount: 1,
    dtype: "4x4",
    steps: 4,
    brightness: 0,
    contrast: 0,
    size: 1,
    ink: "#000000",
    ground: "#ffffff",
  };
}

/* One scratch canvas for the pixelate downsample, reused across calls. */
let small: HTMLCanvasElement | null = null;
const scratch = (w: number, h: number) => {
  if (!small) small = document.createElement("canvas");
  if (small.width !== w) small.width = w;
  if (small.height !== h) small.height = h;
  return small;
};

function pixelate(ctx: CanvasRenderingContext2D, w: number, h: number, params: Record<string, ParamValue>, ink: string) {
  const cell = Math.max(2, Math.round(num(params.cell, 6) * (w / 1080)));
  const amount = clamp01(num(params.amount, 1));
  if (amount <= 0) return;
  const kind = str(params.dtype, "4x4");
  const cw = Math.max(1, Math.ceil(w / cell));
  const chh = Math.max(1, Math.ceil(h / cell));

  const mini = scratch(cw, chh);
  const mctx = mini.getContext("2d", { willReadFrequently: true })!;
  mctx.clearRect(0, 0, cw, chh);
  mctx.imageSmoothingEnabled = true;
  mctx.drawImage(ctx.canvas, 0, 0, cw, chh);

  const img = mctx.getImageData(0, 0, cw, chh);
  const d = img.data;
  const [inkR, inkG, inkB] = hexToRgb(ink);

  for (let cy = 0; cy < chh; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const o = (cy * cw + cx) * 4;
      const t = screenAt(kind, cx, cy);
      const alpha = d[o + 3] / 255;
      const lum = (0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) / 255;
      const value = alpha * (1 - lum);
      if (value > t) {
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

function perPixel(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  type: string,
  params: Record<string, ParamValue>,
  ink: string,
  ground: string,
) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const [inkR, inkG, inkB] = hexToRgb(ink);
  const [bgR, bgG, bgB] = hexToRgb(ground);
  const inkLum = (0.299 * inkR + 0.587 * inkG + 0.114 * inkB) / 255;
  const bgLum = (0.299 * bgR + 0.587 * bgG + 0.114 * bgB) / 255;

  switch (type) {
    case "posterize": {
      const steps = clamp(Math.round(num(params.steps, 4)), 2, 16);
      const q = 255 / (steps - 1);
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.round(d[i] / q) * q;
        d[i + 1] = Math.round(d[i + 1] / q) * q;
        d[i + 2] = Math.round(d[i + 2] / q) * q;
      }
      break;
    }
    case "levels": {
      const b = num(params.brightness, 0) * 255;
      const c = num(params.contrast, 0);
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
      const amount = num(params.amount, 0.25);
      const size = Math.max(1, Math.round(num(params.size, 1)));
      if (amount > 0) {
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const gx = Math.floor(x / size);
            const gy = Math.floor(y / size);
            const nz = (hash01(gx, gy, 0) - 0.5) * 255 * amount;
            const i = (y * w + x) * 4;
            d[i] = Math.max(0, Math.min(255, d[i] + nz));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + nz));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + nz));
          }
        }
      }
      break;
    }
    case "mono": {
      const amount = clamp01(num(params.amount, 1));
      for (let i = 0; i < d.length; i += 4) {
        const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
        const v = (bgLum + (inkLum - bgLum) * (1 - lum)) * 255;
        d[i] = d[i] * (1 - amount) + v * amount;
        d[i + 1] = d[i + 1] * (1 - amount) + v * amount;
        d[i + 2] = d[i + 2] * (1 - amount) + v * amount;
      }
      break;
    }
    case "invert": {
      const amount = clamp01(num(params.amount, 1));
      for (let i = 0; i < d.length; i += 4) {
        d[i] += (255 - 2 * d[i]) * amount;
        d[i + 1] += (255 - 2 * d[i + 1]) * amount;
        d[i + 2] += (255 - 2 * d[i + 2]) * amount;
      }
      break;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function evaluate(
  params: Record<string, ParamValue>,
  inputs: Record<string, HTMLCanvasElement | null>,
  _p: number,
  w: number,
  h: number,
): HTMLCanvasElement {
  const out = makeCanvas(w, h);
  const ctx = out.getContext("2d")!;
  if (inputs.in) ctx.drawImage(inputs.in, 0, 0, w, h);

  const type = str(params.type, "pixelate");
  const ink = str(params.ink, "#000000");
  const ground = str(params.ground, "#ffffff");

  if (type === "pixelate") pixelate(ctx, w, h, params, ink);
  else perPixel(ctx, w, h, type, params, ink, ground);

  return out;
}

const filterNode: NodeKindImpl = { def, defaultParams, evaluate };
export default filterNode;
