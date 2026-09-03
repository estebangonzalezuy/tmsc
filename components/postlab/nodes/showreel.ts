// `showreel` — the carousel: N `frame` outputs as ordered input ports
// (`in-1`, `in-2`, ...). Carousel order is structural (port order), not a
// separate flat array — postgraph.ts's `inputPorts`/`showreelFrames` already
// do that work.
//
// The interesting behavior (sequencing an export across every frame) lives
// in the exporter, not here — this node's own `evaluate` is only ever asked
// for a single still image, so it keeps to the simplest correct answer: draw
// whichever frame is wired into the first slot. The studio's own
// filmstrip/slide-switcher (not this node) is what lets a person look at the
// other slides.

import type { NodeDef, NodeKindImpl, ParamValue } from "@/lib/postgraph";
import { clamp, num, makeCanvas } from "./util";

export const def: NodeDef = {
  kind: "showreel",
  label: "Showreel",
  hint: "The carousel — every frame wired in, in order. This is what exports as the post.",
  inputs: [],
  outputs: ["out"],
  controls: [{ key: "slots", label: "slides", min: 1, max: 12, step: 1, def: 1 }],
  dynamicInputs: true,
};

function defaultParams(): Record<string, ParamValue> {
  return { slots: 1 };
}

function evaluate(
  _params: Record<string, ParamValue>,
  inputs: Record<string, HTMLCanvasElement | null>,
  _p: number,
  w: number,
  h: number,
): HTMLCanvasElement {
  if (inputs["in-1"]) return inputs["in-1"];
  return makeCanvas(w, h);
}

const showreelNode: NodeKindImpl = { def, defaultParams, evaluate };
export default showreelNode;

export const clampSlots = (n: number) => clamp(Math.round(num(n, 1)), 1, 12);
