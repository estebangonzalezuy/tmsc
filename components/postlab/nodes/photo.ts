// `photo` — a picture, in full colour, composited into the frame. A film or
// a GIF is the same node: `clip:<id>` samples a decoded frame the same way
// `local:<id>`/`/path` samples a decoded image.
//
// This node's job is just "produce the picture" — cover/contain composited
// at w×h, full colour, no thresholding. Turning it into a dithered source is
// downstream work (a `filter` node's `pixelate`, or a future `field` mixing
// mode), which is a real simplification versus the old tightly-coupled
// photo-as-dither-input path: the graph composes nodes instead of baking
// "photo becomes dither input" into one giant function.

import type { NodeDef, NodeKindImpl, ParamValue } from "@/lib/postgraph";
import { photo } from "../photos";
import { clip, frameAt } from "../clips";
import { num, str, clamp, makeCanvas } from "./util";

export const def: NodeDef = {
  kind: "photo",
  label: "Photo",
  hint: "A picture, a film, or a GIF — dropped in the source panel, composited in full colour.",
  inputs: [],
  outputs: ["out"],
  controls: [
    { key: "exposure", label: "exposure", min: 0.2, max: 3, step: 0.05, def: 1 },
    { key: "clipCycles", label: "loop trips", min: 1, max: 8, step: 1, def: 1 },
  ],
  choices: [{ key: "fit", label: "fit", values: ["cover", "contain"], def: "cover" }],
  media: true,
};

function defaultParams(): Record<string, ParamValue> {
  return { src: "", fit: "cover", exposure: 1, clipCycles: 1 };
}

function applyExposure(ctx: CanvasRenderingContext2D, w: number, h: number, gamma: number) {
  if (Math.abs(gamma - 1) < 0.001) return;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const g = 1 / Math.max(0.2, gamma);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 * Math.pow(d[i] / 255, g);
    d[i + 1] = 255 * Math.pow(d[i + 1] / 255, g);
    d[i + 2] = 255 * Math.pow(d[i + 2] / 255, g);
  }
  ctx.putImageData(img, 0, 0);
}

function evaluate(
  params: Record<string, ParamValue>,
  _inputs: Record<string, HTMLCanvasElement | null>,
  p: number,
  w: number,
  h: number,
): HTMLCanvasElement {
  const out = makeCanvas(w, h);
  const ctx = out.getContext("2d")!;
  const src = str(params.src, "");
  const fit = str(params.fit, "cover");
  const exposure = num(params.exposure, 1);
  const clipCycles = clamp(Math.round(num(params.clipCycles, 1)), 1, 8);
  if (!src) return out;

  const place = (sw: number, sh: number, draw: (dx: number, dy: number, dw: number, dh: number) => void) => {
    const contain = fit === "contain";
    const k = contain ? Math.min(w / sw, h / sh) : Math.max(w / sw, h / sh);
    const dw = sw * k;
    const dh = sh * k;
    draw((w - dw) / 2, (h - dh) / 2, dw, dh);
  };

  const film = clip(src);
  if (film) {
    const frame = frameAt(film, p, clipCycles);
    const small = makeCanvas(film.w, film.h);
    const sctx = small.getContext("2d")!;
    const img = sctx.createImageData(film.w, film.h);
    for (let i = 0; i < frame.length; i++) {
      const o = i * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = frame[i];
      img.data[o + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    place(film.w, film.h, (dx, dy, dw, dh) => ctx.drawImage(small, dx, dy, dw, dh));
    applyExposure(ctx, w, h, exposure);
    return out;
  }

  const img = photo(src);
  if (img && img.width && img.height) {
    place(img.width, img.height, (dx, dy, dw, dh) => ctx.drawImage(img, dx, dy, dw, dh));
    applyExposure(ctx, w, h, exposure);
  }
  return out;
}

const photoNode: NodeKindImpl = { def, defaultParams, evaluate };
export default photoNode;
