// `field` — the centerpiece node, and the new tool's visual identity: a
// dithered, radial field of rings, lobed by angle, quantized into flat
// bands, with a quiet centre where nothing prints. It's the club's own
// organic-ring renderer, no PostSpec/layer-stack dependency at all — a pure
// function of its params and the loop position `p`.
//
// Every travelling quantity here is `waveAt(wave, loopLength * p)` — an
// integer number of trips over the loop — so `movement` can never open a
// seam: frame 0 and the frame at p=1 are identical.

import type { NodeDef, NodeKindImpl, ParamValue } from "@/lib/postgraph";
import { FIELD_PRESET_RAMPS, cleanInks } from "@/lib/palette";
import { hash01, screenAt } from "./dither";
import { num, str, clamp, clamp01, makeCanvas, hexToRgb, WAVES, waveAt, type Wave } from "./util";

const TAU = Math.PI * 2;

const DTYPES = ["4x4", "2x2", "8x8", "lines", "noise"];

export const def: NodeDef = {
  kind: "field",
  label: "Field",
  hint: "A dithered radial field — rings, lobed and quantized, breathing or rippling out from a quiet centre.",
  inputs: [],
  outputs: ["out"],
  controls: [
    { key: "pixelsAcross", label: "cells across", min: 8, max: 64, step: 1, def: 28 },
    { key: "rings", label: "rings", min: 2, max: 24, step: 1, def: 8 },
    { key: "distortion", label: "lobing", min: 0, max: 1, step: 0.01, def: 0.25 },
    { key: "grain", label: "grain", min: 0, max: 1, step: 0.01, def: 0.08 },
    { key: "quantize", label: "quantize", min: 2, max: 16, step: 1, def: 6 },
    { key: "quietCentre", label: "quiet centre", min: 0, max: 1, step: 0.01, def: 0.12 },
    { key: "rotationOffset", label: "rotation", min: 0, max: 360, step: 1, def: 0 },
    { key: "amount", label: "movement amount", min: 0, max: 1, step: 0.01, def: 0.3 },
    { key: "loopLength", label: "loop trips", min: 1, max: 8, step: 1, def: 1 },
    { key: "seed", label: "seed", min: -999, max: 999, step: 1, def: 1 },
  ],
  choices: [
    { key: "movement", label: "movement", values: ["none", "ripple", "breathe"], def: "ripple" },
    { key: "wave", label: "wave", values: [...WAVES], def: "sin" },
    { key: "dtype", label: "screen", values: DTYPES, def: "4x4" },
  ],
};

function defaultParams(): Record<string, ParamValue> {
  return {
    pixelsAcross: 28,
    rings: 8,
    distortion: 0.25,
    grain: 0.08,
    quantize: 6,
    quietCentre: 0.12,
    seed: 1,
    rotationOffset: 0,
    movement: "ripple",
    amount: 0.3,
    loopLength: 1,
    wave: "sin",
    dtype: "4x4",
    inks: [...FIELD_PRESET_RAMPS[0].inks],
  };
}

function evaluate(
  params: Record<string, ParamValue>,
  _inputs: Record<string, HTMLCanvasElement | null>,
  p: number,
  w: number,
  h: number,
): HTMLCanvasElement {
  const pixelsAcross = clamp(Math.round(num(params.pixelsAcross, 28)), 8, 64);
  const rings = clamp(Math.round(num(params.rings, 8)), 2, 24);
  const distortion = clamp01(num(params.distortion, 0.25));
  const grain = clamp01(num(params.grain, 0.08));
  const quantize = clamp(Math.round(num(params.quantize, 6)), 2, 16);
  const quietCentre = clamp01(num(params.quietCentre, 0.12));
  const seed = num(params.seed, 1);
  const rotationOffset = num(params.rotationOffset, 0);
  const movement = str(params.movement, "ripple");
  const amount = clamp01(num(params.amount, 0.3));
  const loopLength = clamp(Math.round(num(params.loopLength, 1)), 1, 8);
  const waveRaw = str(params.wave, "sin");
  const wave: Wave = (WAVES as readonly string[]).includes(waveRaw) ? (waveRaw as Wave) : "sin";
  const dtype = str(params.dtype, "4x4");
  const inks = cleanInks(params.inks);

  const cell = Math.max(2, Math.round(Math.min(w, h) / pixelsAcross));
  const cw = Math.max(1, Math.ceil(w / cell));
  const ch = Math.max(1, Math.ceil(h / cell));
  const cx0 = cw / 2;
  const cy0 = ch / 2;
  const m = Math.max(1, Math.min(cw, ch) / 2);

  const k = movement === "none" ? 0 : waveAt(wave, loopLength * p);
  const rot = (rotationOffset * Math.PI) / 180;
  const ca = Math.cos(rot);
  const sa = Math.sin(rot);

  const small = makeCanvas(cw, ch);
  const sctx = small.getContext("2d")!;
  const img = sctx.createImageData(cw, ch);
  const data = img.data;

  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const x0 = (cx - cx0) / m;
      const y0 = (cy - cy0) / m;
      const rx = x0 * ca - y0 * sa;
      const ry = x0 * sa + y0 * ca;
      let r = Math.hypot(rx, ry);
      const a = Math.atan2(ry, rx);

      if (movement === "ripple") r += amount * 0.15 * Math.sin(TAU * (rings * 0.5 * r - k));

      /* Lobing bends the ring index by angle — three lobes, so the ±π seam
         where atan2 wraps stays invisible (sin(a*3) is continuous there). */
      let ringPos = r * rings * (1 + distortion * Math.sin(a * 3));
      if (movement === "breathe") ringPos += amount * Math.sin(TAU * k);

      let d = 0.5 + 0.5 * Math.sin(TAU * ringPos);
      if (grain > 0) d += (hash01(cx, cy, seed) - 0.5) * grain;
      d = Math.round(clamp01(d) * quantize) / quantize;
      if (r < quietCentre) d = 0;

      const o = (cy * cw + cx) * 4;
      if (d > screenAt(dtype, cx, cy)) {
        /* Deepest ink at the centre, palest at the edge — the ramp's own
           order (see lib/palette.ts), so picking a preset always reads as
           ink pooling in the middle and thinning toward the frame. */
        const idx = clamp(Math.floor(r * inks.length), 0, inks.length - 1);
        const [rr, gg, bb] = hexToRgb(inks[idx]);
        data[o] = rr;
        data[o + 1] = gg;
        data[o + 2] = bb;
        data[o + 3] = 255;
      }
    }
  }
  sctx.putImageData(img, 0, 0);

  const out = makeCanvas(w, h);
  const octx = out.getContext("2d")!;
  octx.imageSmoothingEnabled = false;
  /* The source rect has to match `small`'s actual size (cw x ch, one pixel
     per grid cell) — asking for cw*cell x ch*cell here (the field's size in
     output pixels) requests a source rectangle far bigger than the image
     actually is, which the canvas spec clips to what's really there and
     shrinks the destination rect by the same proportion: the field rendered
     into a postage-stamp corner of the box instead of filling it. */
  octx.drawImage(small, 0, 0, cw, ch, 0, 0, w, h);
  return out;
}

const field: NodeKindImpl = { def, defaultParams, evaluate };
export default field;
