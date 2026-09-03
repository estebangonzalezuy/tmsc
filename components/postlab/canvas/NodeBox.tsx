"use client";

// One node on the canvas: title bar (kind label, mute, delete), a live
// thumbnail of what this node alone outputs, and a port dot per input plus
// one output — every stage of the pipeline previews itself, which is what
// makes a node graph legible instead of a diagram you have to imagine the
// result of.
//
// Dragging writes to the imperative `positions` store and this box's own DOM
// transform directly (bypassing React) on every pointermove, and commits
// `{x,y}` into the graph's React state only on pointerup — a whole-graph
// drag never re-renders the canvas. A tap (no meaningful movement) selects
// the node instead, driving the Inspector.

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { inputPorts, nodeDef, type GraphNode, type PostGraph } from "@/lib/postgraph";
import { NodeShell, PortDot, IconBtn } from "../toolcraft";
import GraphPoster from "../GraphPoster";
import { positions } from "./positions";
import { viewport } from "./viewport";
import { NODE_WIDTH, nodeHeight } from "./layout";

export default function NodeBox({
  graph,
  node,
  selected,
  onSelect,
  onCommitMove,
  onToggleMute,
  onDelete,
  onPortDown,
  onPortUp,
}: {
  graph: PostGraph;
  node: GraphNode;
  selected: boolean;
  onSelect: (id: string) => void;
  onCommitMove: (id: string, x: number, y: number) => void;
  onToggleMute: (id: string) => void;
  onDelete: (id: string) => void;
  /** Starting a wire, from this node's output port. */
  onPortDown: (id: string, port: string) => void;
  /** Dropping a wire onto this node's input port. */
  onPortUp: (id: string, port: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const h = nodeHeight(graph.format);
  const def = nodeDef(node.kind);
  const ports = inputPorts(node);
  const connectedIn = new Set(graph.edges.filter((e) => e.to.node === node.id).map((e) => e.to.port));
  const connectedOut = graph.edges.some((e) => e.from.node === node.id);

  const startDrag = (e: ReactPointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const from = positions.get(node.id, { x: node.x, y: node.y });
    let moved = false;
    setDragging(true);

    const move = (ev: PointerEvent) => {
      const scale = viewport.get().scale;
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      const x = from.x + dx;
      const y = from.y + dy;
      if (rootRef.current) rootRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      positions.set(node.id, { x, y });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragging(false);
      const scale = viewport.get().scale;
      const x = from.x + (ev.clientX - startX) / scale;
      const y = from.y + (ev.clientY - startY) / scale;
      if (moved) onCommitMove(node.id, x, y);
      else onSelect(node.id);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={rootRef}
      className="absolute top-0 left-0"
      style={{ transform: `translate3d(${node.x}px, ${node.y}px, 0)`, zIndex: dragging || selected ? 10 : 1 }}
    >
      <NodeShell
        title={def.label}
        selected={selected}
        muted={node.mute}
        width={NODE_WIDTH}
        onPointerDownTitle={startDrag}
        onClick={() => !dragging && onSelect(node.id)}
        right={
          <span className="flex items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
            <IconBtn small bare on={!node.mute} onClick={() => onToggleMute(node.id)} title={node.mute ? "Muted — click to switch on" : "Switch off"}>
              {node.mute ? "○" : "◉"}
            </IconBtn>
            {node.kind !== "showreel" && (
              <IconBtn small bare onClick={() => onDelete(node.id)} title="Delete">
                ×
              </IconBtn>
            )}
          </span>
        }
      >
        <div className="relative" style={{ height: h - 32 }}>
          <GraphPoster graph={graph} targetId={node.id} width={NODE_WIDTH - 16} live className="m-2" />
          {/* Input ports, evenly spaced down the left edge. */}
          {ports.map((port, i) => (
            <span
              key={port}
              className="absolute -left-[7px]"
              style={{ top: `${((i + 0.5) / ports.length) * 100}%`, transform: "translateY(-50%)" }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <PortDot
                title={port}
                connected={connectedIn.has(port)}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  onPortUp(node.id, port);
                }}
              />
            </span>
          ))}
        </div>
      </NodeShell>
      {/* Output port, centred on the title bar, outside NodeShell's own
          padding so it sits exactly on the box's right edge. */}
      <span
        className="absolute -right-[7px] top-4 -translate-y-1/2"
        onPointerDown={(e) => {
          e.stopPropagation();
          onPortDown(node.id, "out");
        }}
      >
        <PortDot title="out" connected={connectedOut} />
      </span>
    </div>
  );
}
