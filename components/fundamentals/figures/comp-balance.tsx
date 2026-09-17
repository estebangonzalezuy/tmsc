"use client";

import { useState } from "react";
import Figure from "./Figure";
import { Slider } from "./controls";
import { num, type Params } from "./params";

/* Visual weight on a beam. A big thing near the middle and a small thing
   far out can balance, the way they do on a seesaw: what matters is size
   times distance, not size. The beam tips toward whichever side is carrying
   more, so you can feel a composition lean before you can say why. */

const W = 600;
const H = 400;
const PIVOT = { x: W / 2, y: 300 };

export default function CompBalance({ params, caption }: { params: Params; caption?: string }) {
  const [left, setLeft] = useState(num(params, "left", 90, 20, 130));
  const [right, setRight] = useState(num(params, "right", 50, 20, 130));
  const [reach, setReach] = useState(num(params, "reach", 200, 60, 270));

  const leftX = -150;
  const rightX = reach;
  /* Area × distance. The circle's area against the square's, honestly. */
  const tl = (Math.PI * (left / 2) ** 2 * Math.abs(leftX)) / 1e5;
  const tr = (right * right * rightX) / 1e5;
  const diff = tr - tl;
  const tilt = Math.max(-9, Math.min(9, diff * 1.2));
  const state =
    Math.abs(diff) < 0.6 ? "balanced" : diff > 0 ? "leans right" : "leans left";

  return (
    <Figure
      aspect="3 / 2"
      caption={caption}
      readout={`left ${tl.toFixed(1)} · right ${tr.toFixed(1)} · ${state}`}
      stage={
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full">
          <rect x={0} y={0} width={W} height={H} fill="currentColor" opacity={0.04} />
          <polygon points={`${PIVOT.x - 22},${H - 40} ${PIVOT.x + 22},${H - 40} ${PIVOT.x},${PIVOT.y}`} fill="currentColor" opacity={0.25} />
          <g
            style={{ transform: `rotate(${tilt}deg)`, transformOrigin: `${PIVOT.x}px ${PIVOT.y}px`, transition: "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)" }}
          >
            <line x1={PIVOT.x - 280} x2={PIVOT.x + 280} y1={PIVOT.y} y2={PIVOT.y} stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
            <circle cx={PIVOT.x + leftX} cy={PIVOT.y - 2 - left / 2} r={left / 2} fill="currentColor" />
            <rect x={PIVOT.x + rightX - right / 2} y={PIVOT.y - 2 - right} width={right} height={right} rx={right * 0.12} fill="currentColor" opacity={0.85} />
          </g>
        </svg>
      }
      controls={
        <>
          <Slider label="Left size" value={left} min={20} max={130} onChange={setLeft} />
          <Slider label="Right size" value={right} min={20} max={130} onChange={setRight} />
          <Slider label="Right reach" value={reach} min={60} max={270} onChange={setReach} />
        </>
      }
    />
  );
}
