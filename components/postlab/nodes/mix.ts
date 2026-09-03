// `mix` — composites `over` onto `base` with a blend mode and an opacity.
// New in the node model (no direct old-model equivalent — the closest
// ancestor is the layer stack's blend/opacity compositing in the old
// Stage.tsx/exporter.ts's drawLayers). A missing input draws nothing for
// that side, matching renderFrame's "inputs[port] is null" contract.

import type { NodeDef, NodeKindImpl, ParamValue } from "@/lib/postgraph";
import { num, str, clamp01, makeCanvas } from "./util";

export const BLENDS = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "difference",
  "exclusion",
];

const compositeOp = (blend: string): GlobalCompositeOperation =>
  blend === "normal" ? "source-over" : (blend as GlobalCompositeOperation);

export const def: NodeDef = {
  kind: "mix",
  label: "Mix",
  hint: "Composite one input over another — a blend mode and an opacity.",
  inputs: ["base", "over"],
  outputs: ["out"],
  controls: [{ key: "opacity", label: "opacity", min: 0, max: 1, step: 0.01, def: 1 }],
  choices: [{ key: "mode", label: "blend", values: BLENDS, def: "normal" }],
};

function defaultParams(): Record<string, ParamValue> {
  return { mode: "normal", opacity: 1 };
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
  if (inputs.base) ctx.drawImage(inputs.base, 0, 0, w, h);
  if (inputs.over) {
    ctx.save();
    ctx.globalCompositeOperation = compositeOp(str(params.mode, "normal"));
    ctx.globalAlpha = clamp01(num(params.opacity, 1));
    ctx.drawImage(inputs.over, 0, 0, w, h);
    ctx.restore();
  }
  return out;
}

const mixNode: NodeKindImpl = { def, defaultParams, evaluate };
export default mixNode;
