// Geometry the canvas, NodeBox and Wire all have to agree on. Every node box
// in one graph is the same size (the thumbnail's aspect comes from the
// graph's own format, which is graph-wide) — which is what lets Wire compute
// a port's position from arithmetic alone, with no DOM measurement, and stay
// correct even mid-drag when the position comes from the imperative
// `positions` store instead of React state.

import { FORMATS, inputPorts, type GraphNode, type PostFormat } from "@/lib/postgraph";

export const NODE_WIDTH = 200;
export const TITLE_H = 32;
const PAD = 16;

export function nodeHeight(format: PostFormat): number {
  const base = FORMATS[format];
  const thumbW = NODE_WIDTH - PAD;
  const thumbH = (thumbW * base.h) / base.w;
  return TITLE_H + thumbH + PAD;
}

/** World-space centre of one port dot, relative to the node's own x/y. */
export function portOffset(node: GraphNode, port: string, format: PostFormat): { x: number; y: number } {
  const h = nodeHeight(format);
  if (port === "out") return { x: NODE_WIDTH, y: TITLE_H / 2 };
  const ports = inputPorts(node);
  const i = Math.max(0, ports.indexOf(port));
  const n = Math.max(1, ports.length);
  const y = TITLE_H + ((i + 0.5) / n) * (h - TITLE_H);
  return { x: 0, y };
}
