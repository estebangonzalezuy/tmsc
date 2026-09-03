"use client";

// One committed edge, drawn as a cubic bezier between two port positions.
// Reads its endpoints from the imperative `positions` store rather than from
// the node's React `x`/`y` — so a wire follows the node it's attached to
// while that node is mid-drag, with no re-render on either end. The pending
// wire a fresh drag draws (from a port, following the pointer) uses the same
// `bezierPath` helper directly in NodeCanvas.tsx, imperatively too.

import { useEffect, useRef } from "react";
import type { GraphEdge, GraphNode, PostFormat } from "@/lib/postgraph";
import { wirePathProps } from "../toolcraft";
import { positions } from "./positions";
import { portOffset } from "./layout";

/** A gentle S-curve: control points pulled horizontally out from each
    endpoint, the standard node-graph wire shape. */
export function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export default function Wire({
  edge,
  nodes,
  format,
}: {
  edge: GraphEdge;
  nodes: Map<string, GraphNode>;
  format: PostFormat;
}) {
  const ref = useRef<SVGPathElement>(null);

  useEffect(() => {
    const from = nodes.get(edge.from.node);
    const to = nodes.get(edge.to.node);
    if (!from || !to) return;
    const draw = () => {
      const path = ref.current;
      if (!path) return;
      const p1 = positions.get(from.id, { x: from.x, y: from.y });
      const p2 = positions.get(to.id, { x: to.x, y: to.y });
      const o1 = portOffset(from, edge.from.port, format);
      const o2 = portOffset(to, edge.to.port, format);
      path.setAttribute("d", bezierPath(p1.x + o1.x, p1.y + o1.y, p2.x + o2.x, p2.y + o2.y));
    };
    draw();
    return positions.watch(draw);
  }, [edge.from.node, edge.from.port, edge.to.node, edge.to.port, nodes, format]);

  return <path ref={ref} d="" {...wirePathProps(false)} />;
}
