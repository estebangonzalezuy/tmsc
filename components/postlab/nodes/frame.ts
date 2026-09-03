// `frame` — terminal, one carousel slide. Just passes its input through; a
// `label` is nearly free and lets the showreel's ordering UI show something
// better than a node id.

import type { NodeDef, NodeKindImpl, ParamValue } from "@/lib/postgraph";
import { str, makeCanvas } from "./util";

export const def: NodeDef = {
  kind: "frame",
  label: "Frame",
  hint: "One slide of the carousel — wire this into a showreel to put it in order.",
  inputs: ["in"],
  outputs: ["out"],
  controls: [],
  texts: [{ key: "label", label: "label" }],
};

function defaultParams(): Record<string, ParamValue> {
  return { label: "" };
}

function evaluate(
  _params: Record<string, ParamValue>,
  inputs: Record<string, HTMLCanvasElement | null>,
  _p: number,
  w: number,
  h: number,
): HTMLCanvasElement {
  if (inputs.in) return inputs.in;
  return makeCanvas(w, h);
}

const frameNode: NodeKindImpl = { def, defaultParams, evaluate };
export default frameNode;

export const frameLabel = (params: Record<string, ParamValue>): string => str(params.label, "");
