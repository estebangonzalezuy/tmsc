"use client";

import { useEffect, useRef, useState } from "react";
import Figure from "./Figure";
import { Chips, Replay } from "./controls";
import { useLoop } from "./useLoop";
import { pick, type Params } from "./params";
import { ease } from "@/components/postlab/nodes/kinetic/easing";

/* Easing. The same mark travels the same distance in the same time, and the
   only thing that changes is how it spends that time — the curve on the
   left. Pick a curve, or take the two handles and make your own: the plot
   is a cubic bezier, the thing every animation tool hands you as "graph
   editor", and the dot on it is the mark's position right now. */

const CURVES = [
  { value: "linear", label: "Linear" },
  { value: "in", label: "Ease in" },
  { value: "out", label: "Ease out" },
  { value: "inout", label: "In-out" },
  { value: "back", label: "Overshoot" },
  { value: "bounce", label: "Bounce" },
  { value: "custom", label: "Custom" },
] as const;
type Curve = (typeof CURVES)[number]["value"];
const CURVE_KEYS = CURVES.map((c) => c.value);

/* Solve a cubic bezier's y for a given x — what the browser does for
   `cubic-bezier(x1, y1, x2, y2)`. Bisection, because it is short and the
   plot is small. */
function bezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  const at = (a: number, b: number, t: number) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (at(x1, x2, mid) < x) lo = mid;
    else hi = mid;
  }
  const t = (lo + hi) / 2;
  return at(y1, y2, t);
}

const W = 800;
const H = 500;
/* The plot: a square, with room above and below for overshoot. */
const PLOT = { x: 60, y: 90, size: 300 };
/* The track the mark runs on. */
const TRACK = { x0: 470, x1: 730, y: 250, r: 24 };

export default function MotionEasing({ params, caption }: { params: Params; caption?: string }) {
  const [curve, setCurve] = useState<Curve>(pick(params, "curve", CURVE_KEYS, "out"));
  const [h, setH] = useState({ x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 });
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<0 | 1 | 2>(0);

  const mark = useRef<SVGCircleElement>(null);
  const dot = useRef<SVGCircleElement>(null);
  const head = useRef<SVGLineElement>(null);

  const f = (p: number) => {
    switch (curve) {
      case "linear": return p;
      case "in": return ease("cubic", "in", p);
      case "out": return ease("cubic", "out", p);
      case "inout": return ease("cubic", "inout", p);
      case "back": return ease("back", "out", p);
      case "bounce": return ease("bounce", "out", p);
      default: return bezier(h.x1, h.y1, h.x2, h.y2, p);
    }
  };

  const px = (x: number) => PLOT.x + x * PLOT.size;
  const py = (y: number) => PLOT.y + PLOT.size - y * PLOT.size;

  const { ref, replay, draw } = useLoop({
    period: 1400,
    hold: 600,
    onFrame: (p) => {
      const v = f(p);
      mark.current?.setAttribute("cx", String(TRACK.x0 + (TRACK.x1 - TRACK.x0) * v));
      dot.current?.setAttribute("cx", String(px(p)));
      dot.current?.setAttribute("cy", String(py(v)));
      head.current?.setAttribute("x1", String(px(p)));
      head.current?.setAttribute("x2", String(px(p)));
    },
  });
  /* A new curve while the loop is holding, or under reduced motion, still
     has to show on the mark. */
  useEffect(() => draw(), [curve, h, draw]);

  const path = Array.from({ length: 61 }, (_, i) => {
    const p = i / 60;
    return `${i ? "L" : "M"}${px(p).toFixed(1)},${py(f(p)).toFixed(1)}`;
  }).join(" ");

  const toPlot = (e: React.PointerEvent) => {
    const el = svg.current!;
    const r = el.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const sy = ((e.clientY - r.top) / r.height) * H;
    return {
      x: Math.min(1, Math.max(0, (sx - PLOT.x) / PLOT.size)),
      y: Math.min(1.6, Math.max(-0.6, (PLOT.y + PLOT.size - sy) / PLOT.size)),
    };
  };

  const label = CURVES.find((c) => c.value === curve)!.label;
  const custom = curve === "custom";

  return (
    <Figure
      stageRef={ref}
      caption={caption}
      readout={
        custom
          ? `cubic-bezier(${h.x1.toFixed(2)}, ${h.y1.toFixed(2)}, ${h.x2.toFixed(2)}, ${h.y2.toFixed(2)})`
          : `${label} · same distance, same 1.4 s`
      }
      stage={
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 w-full h-full touch-none"
          onPointerMove={(e) => {
            if (!drag.current) return;
            const p = toPlot(e);
            setH((c) => (drag.current === 1 ? { ...c, x1: p.x, y1: p.y } : { ...c, x2: p.x, y2: p.y }));
          }}
          onPointerUp={() => (drag.current = 0)}
          onPointerCancel={() => (drag.current = 0)}
        >
          {/* the plot */}
          <rect x={PLOT.x} y={PLOT.y} width={PLOT.size} height={PLOT.size} fill="currentColor" opacity={0.04} />
          <rect x={PLOT.x} y={PLOT.y} width={PLOT.size} height={PLOT.size} fill="none" stroke="currentColor" strokeOpacity={0.2} />
          <line x1={PLOT.x} y1={PLOT.y + PLOT.size} x2={PLOT.x + PLOT.size} y2={PLOT.y} stroke="currentColor" strokeOpacity={0.12} strokeDasharray="3 5" />
          <text x={PLOT.x} y={PLOT.y + PLOT.size + 22} fontSize={11} fill="currentColor" opacity={0.5} className="font-sans">time →</text>
          <text x={PLOT.x - 10} y={PLOT.y + 4} fontSize={11} fill="currentColor" opacity={0.5} textAnchor="end" className="font-sans">↑ distance</text>
          <path d={path} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" />
          <line ref={head} x1={px(0)} x2={px(0)} y1={PLOT.y - 40} y2={PLOT.y + PLOT.size + 40} stroke="currentColor" strokeOpacity={0.18} />
          {custom && (
            <g>
              <line x1={px(0)} y1={py(0)} x2={px(h.x1)} y2={py(h.y1)} stroke="currentColor" strokeOpacity={0.35} />
              <line x1={px(1)} y1={py(1)} x2={px(h.x2)} y2={py(h.y2)} stroke="currentColor" strokeOpacity={0.35} />
              {([1, 2] as const).map((i) => (
                <circle
                  key={i}
                  cx={px(i === 1 ? h.x1 : h.x2)}
                  cy={py(i === 1 ? h.y1 : h.y2)}
                  r={11}
                  fill="var(--surface)"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="cursor-grab"
                  onPointerDown={(e) => {
                    drag.current = i;
                    svg.current?.setPointerCapture(e.pointerId);
                  }}
                />
              ))}
            </g>
          )}
          <circle ref={dot} cx={px(0)} cy={py(0)} r={6} fill="currentColor" />
          {/* the track */}
          <line x1={TRACK.x0} x2={TRACK.x1} y1={TRACK.y} y2={TRACK.y} stroke="currentColor" strokeOpacity={0.15} />
          <circle cx={TRACK.x0} cy={TRACK.y} r={3} fill="currentColor" opacity={0.3} />
          <circle cx={TRACK.x1} cy={TRACK.y} r={3} fill="currentColor" opacity={0.3} />
          <circle ref={mark} cx={TRACK.x0} cy={TRACK.y} r={TRACK.r} fill="currentColor" />
        </svg>
      }
      controls={
        <>
          <Chips label="Curve" value={curve} options={CURVES.map((c) => ({ value: c.value, label: c.label }))} onChange={setCurve} />
          <div className="grid grid-cols-[5rem_1fr] items-center gap-3 text-xs">
            <span className="text-muted">Play</span>
            <div><Replay onClick={replay} /></div>
          </div>
        </>
      }
    />
  );
}
