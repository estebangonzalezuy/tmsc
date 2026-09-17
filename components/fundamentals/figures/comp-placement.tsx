"use client";

import { useRef, useState } from "react";
import Figure from "./Figure";
import { Switch } from "./controls";
import { bool, num, type Params } from "./params";

/* Where the subject sits. Drag the mark around the frame with the guides on
   and feel how it changes weight: dead centre is calm and a little inert; a
   thirds point gives the frame somewhere to go; the golden lines sit just
   inside the thirds and read as the same idea with a slightly quieter
   accent. None of these is a rule. They are places to start from. */

const W = 600;
const H = 400;
const R = 22;
const PHI = 1 / 1.618;

export default function CompPlacement({ params, caption }: { params: Params; caption?: string }) {
  const [pos, setPos] = useState({ x: num(params, "x", 0.5, 0, 1), y: num(params, "y", 0.5, 0, 1) });
  const [thirds, setThirds] = useState(bool(params, "thirds", true));
  const [centre, setCentre] = useState(bool(params, "centre", false));
  const [golden, setGolden] = useState(bool(params, "golden", false));
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const toFrame = (e: React.PointerEvent) => {
    const el = svg.current;
    if (!el) return pos;
    const r = el.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  const near = (v: number, targets: number[]) => targets.some((t) => Math.abs(v - t) < 0.035);
  const onThirds = near(pos.x, [1 / 3, 2 / 3]) && near(pos.y, [1 / 3, 2 / 3]);
  const onGolden = near(pos.x, [1 - PHI, PHI]) && near(pos.y, [1 - PHI, PHI]);
  const onCentre = near(pos.x, [0.5]) && near(pos.y, [0.5]);
  const where = onCentre ? "dead centre" : onThirds ? "on a thirds point" : onGolden ? "on a golden point" : "off the guides";

  const cx = pos.x * W;
  const cy = pos.y * H;

  return (
    <Figure
      aspect="3 / 2"
      caption={caption}
      readout={`x ${pos.x.toFixed(2)} · y ${pos.y.toFixed(2)} · ${where}`}
      stage={
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            setPos(toFrame(e));
          }}
          onPointerMove={(e) => dragging.current && setPos(toFrame(e))}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          <rect x={0} y={0} width={W} height={H} fill="currentColor" opacity={0.04} />
          {/* A horizon, so the frame is a place and not a void. */}
          <line x1={0} x2={W} y1={H * 0.62} y2={H * 0.62} stroke="currentColor" strokeOpacity={0.12} />
          <g stroke="currentColor" strokeOpacity={0.28} strokeWidth={1}>
            {thirds && (
              <>
                <line x1={W / 3} x2={W / 3} y1={0} y2={H} />
                <line x1={(2 * W) / 3} x2={(2 * W) / 3} y1={0} y2={H} />
                <line x1={0} x2={W} y1={H / 3} y2={H / 3} />
                <line x1={0} x2={W} y1={(2 * H) / 3} y2={(2 * H) / 3} />
              </>
            )}
            {golden && (
              <g strokeDasharray="5 5">
                <line x1={W * (1 - PHI)} x2={W * (1 - PHI)} y1={0} y2={H} />
                <line x1={W * PHI} x2={W * PHI} y1={0} y2={H} />
                <line x1={0} x2={W} y1={H * (1 - PHI)} y2={H * (1 - PHI)} />
                <line x1={0} x2={W} y1={H * PHI} y2={H * PHI} />
              </g>
            )}
            {centre && (
              <>
                <line x1={W / 2} x2={W / 2} y1={0} y2={H} strokeDasharray="2 6" />
                <line x1={0} x2={W} y1={H / 2} y2={H / 2} strokeDasharray="2 6" />
              </>
            )}
          </g>
          <circle cx={cx} cy={cy} r={R} fill="currentColor" />
          <circle cx={cx} cy={cy} r={R + 8} fill="none" stroke="currentColor" strokeOpacity={0.2} />
        </svg>
      }
      controls={
        <>
          <Switch label="Thirds" on={thirds} onChange={setThirds} labels={["Shown", "Hidden"]} />
          <Switch label="Golden" on={golden} onChange={setGolden} labels={["Shown", "Hidden"]} />
          <Switch label="Centre" on={centre} onChange={setCentre} labels={["Shown", "Hidden"]} />
        </>
      }
    />
  );
}
