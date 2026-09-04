"use client";

// The world: an empty-canvas pan/zoom surface holding every node and wire.
// The world div's own transform is written straight to the DOM inside a
// `viewport.watch` callback — never through React state — so panning and
// zooming never re-render the node list. The graph itself (nodes, edges,
// params) stays ordinary React state; only the gesture-rate stuff (pan,
// zoom, an in-progress drag) lives outside it.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { addEdge, type GraphEdge, type PostGraph } from "@/lib/postgraph";
import { wirePathProps } from "../toolcraft";
import NodeBox from "./NodeBox";
import Wire, { bezierPath } from "./Wire";
import { viewport, zoomAt } from "./viewport";
import { positions } from "./positions";
import { portOffset } from "./layout";

export default function NodeCanvas({
  graph,
  selectedNodeId,
  onSelect,
  onUpdateGraph,
  onCommitMove,
  onToggleMute,
  onDeleteNode,
}: {
  graph: PostGraph;
  selectedNodeId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateGraph: (next: PostGraph) => void;
  onCommitMove: (id: string, x: number, y: number) => void;
  onToggleMute: (id: string) => void;
  onDeleteNode: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<SVGPathElement>(null);
  const [pendingFrom, setPendingFrom] = useState<{ id: string; port: string } | null>(null);
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));

  useEffect(() => {
    const apply = (v: { x: number; y: number; scale: number }) => {
      if (worldRef.current) worldRef.current.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.scale})`;
    };
    apply(viewport.get());
    return viewport.watch(apply);
  }, []);

  /* An in-progress wire, dragged from an output port, follows the pointer
     imperatively — one `<path>` mounted for the duration of the drag, its
     `d` set directly rather than through React state on every move. */
  useEffect(() => {
    if (!pendingFrom) return;
    const fromNode = nodesById.get(pendingFrom.id);
    if (!fromNode) return;
    const move = (ev: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || !pendingRef.current) return;
      const v = viewport.get();
      const wx = (ev.clientX - rect.left - v.x) / v.scale;
      const wy = (ev.clientY - rect.top - v.y) / v.scale;
      const p = positions.get(fromNode.id, { x: fromNode.x, y: fromNode.y });
      const o = portOffset(fromNode, pendingFrom.port, graph.format);
      pendingRef.current.setAttribute("d", bezierPath(p.x + o.x, p.y + o.y, wx, wy));
    };
    const up = () => setPendingFrom(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFrom]);

  const onBgPointerDown = (e: ReactPointerEvent) => {
    onSelect(null);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const startV = viewport.get();
    const move = (ev: PointerEvent) =>
      viewport.set({ ...startV, x: startV.x + (ev.clientX - startX), y: startV.y + (ev.clientY - startY) });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* A native listener, not JSX onWheel: React (and the browser, for touch-
     origin wheel events) treats a wheel handler as passive by default, and a
     passive listener can't preventDefault — the page would scroll under the
     canvas on every zoom gesture. */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.pow(1.0015, -e.deltaY);
      zoomAt(e.clientX, e.clientY, factor);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPortDown = (id: string, port: string) => setPendingFrom({ id, port });
  const onPortUp = (id: string, port: string) => {
    if (!pendingFrom) return;
    const next = addEdge(graph, { from: { node: pendingFrom.id, port: pendingFrom.port }, to: { node: id, port } });
    onUpdateGraph(next);
    setPendingFrom(null);
  };

  return (
    <div
      ref={containerRef}
      className="tc-canvas-dark absolute inset-0 overflow-hidden touch-none cursor-grab active:cursor-grabbing"
      style={{ background: "var(--tc-page)" }}
      onPointerDown={onBgPointerDown}
    >
      <div ref={worldRef} className="absolute top-0 left-0" style={{ transformOrigin: "0 0" }}>
        {/* Sized well past anything a graph will lay out, rather than 0x0 +
            overflow-visible — that trick is unreliable for a plain <svg>
            with no viewBox in some engines, and this SVG only ever draws
            wires, never gets clicked (pointer-events: none). */}
        <svg className="absolute top-0 left-0 pointer-events-none" width={8000} height={8000}>
          {graph.edges.map((e: GraphEdge, i) => (
            <Wire key={`${e.from.node}:${e.from.port}-${e.to.node}:${e.to.port}-${i}`} edge={e} nodes={nodesById} format={graph.format} />
          ))}
          {pendingFrom && <path ref={pendingRef} d="" {...wirePathProps(true)} />}
        </svg>
        {graph.nodes.map((n) => (
          <NodeBox
            key={n.id}
            graph={graph}
            node={n}
            selected={n.id === selectedNodeId}
            onSelect={onSelect}
            onCommitMove={onCommitMove}
            onToggleMute={onToggleMute}
            onDelete={onDeleteNode}
            onPortDown={onPortDown}
            onPortUp={onPortUp}
          />
        ))}
      </div>
    </div>
  );
}
