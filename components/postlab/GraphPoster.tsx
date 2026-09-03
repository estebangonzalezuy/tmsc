"use client";

// A small live picture of one node's output — the studio's shared renderer
// for "show me what's here right now". Used by both NodeBox's per-node
// thumbnail (targeting that node's own id, so every stage of the pipeline
// previews itself) and by SpecBlock's Learn embeds (targeting the showreel).
//
// Same throttled-to-~8fps-when-live, redraw-only-when-something-actually-
// moves pattern as the old Poster.tsx, now calling renderFrame directly
// instead of paintPoster — the graph already produced the final composited
// image, so there's no separate "layers then type" step left to do.

import { useEffect, useRef } from "react";
import { FORMATS, ancestorSubgraph, renderFrame, type PostGraph } from "@/lib/postgraph";
import { clock } from "./clock";

export default function GraphPoster({
  graph,
  targetId,
  width,
  t = 0,
  live = false,
  className = "",
}: {
  graph: PostGraph;
  targetId: string;
  /** CSS pixels wide; the canvas is drawn at exactly this size. */
  width: number;
  t?: number;
  /** Follow the playhead instead of holding one frame. */
  live?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const format = graph.format;
  const base = FORMATS[format];
  const w = Math.max(8, Math.round(width));
  const h = Math.max(8, Math.round((width * base.h) / base.w));

  const ancestors = ancestorSubgraph(graph, targetId);
  const key = JSON.stringify(ancestors.map((n) => [n.id, n.kind, n.params, n.motion, n.mute]));
  /* True whenever any ancestor has a travelling number or is a kind known to
     animate on its own (a field node with movement set) — conservative on
     purpose; a still ancestor subgraph never repaints at all. */
  const moves = ancestors.some(
    (n) =>
      !n.mute &&
      ((n.motion && Object.keys(n.motion).length > 0) ||
        (n.kind === "field" && n.params.movement !== "none") ||
        // `kinetic` has no "movement" toggle — every scene is always animating
        // (the old studio's own "nothing shipped is still" rule), so a
        // kinetic ancestor always keeps the poster ticking.
        n.kind === "kinetic"),
  );

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = (p: number) => {
      const frame = renderFrame(graph, targetId, p, w, h);
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, w, h);
      ctx?.drawImage(frame, 0, 0, w, h);
    };
    draw(live ? clock.get() / Math.max(2, graph.duration) : t);
    if (!live || !moves) return;
    let last = -1;
    return clock.watch((now) => {
      if (now - last < 1 / 8 && now > last) return;
      last = now;
      draw(now / Math.max(2, graph.duration));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, targetId, format, graph.duration, w, h, t, live, moves]);

  return <canvas ref={ref} width={w} height={h} className={`block w-full h-auto ${className}`} />;
}
