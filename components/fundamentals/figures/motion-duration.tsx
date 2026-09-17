"use client";

import { useEffect, useState } from "react";
import Figure from "./Figure";
import { Replay, Slider } from "./controls";
import { useLoop } from "./useLoop";
import { num, type Params } from "./params";
import { ease } from "@/components/postlab/nodes/kinetic/easing";

/* Duration. Two identical moves, same curve, same distance, and the top
   one is always 300 ms. Drag the bottom one shorter and it starts to feel
   like a cut; drag it longer and it starts to feel like weight. The number
   tells you nothing; the pair does. */

const W = 800;
const H = 400;
const X0 = 150;
const X1 = 700;
const S = 56;
const REF = 300;

function verdict(ms: number) {
  if (ms < 180) return "a cut, not a move";
  if (ms <= 400) return "snappy, interface territory";
  if (ms <= 800) return "deliberate, it has weight";
  return "slow, it had better be worth watching";
}

export default function MotionDuration({ params, caption }: { params: Params; caption?: string }) {
  const [ms, setMs] = useState(num(params, "duration", 700, 100, 1500));
  const period = Math.max(REF, ms);

  const [a, setA] = useState<SVGRectElement | null>(null);
  const [b, setB] = useState<SVGRectElement | null>(null);

  const { ref, replay, draw } = useLoop({
    period,
    hold: 700,
    onFrame: (p) => {
      const t = p * period;
      const va = ease("cubic", "out", Math.min(1, t / REF));
      const vb = ease("cubic", "out", Math.min(1, t / ms));
      a?.setAttribute("x", String(X0 + (X1 - X0) * va - S / 2));
      b?.setAttribute("x", String(X0 + (X1 - X0) * vb - S / 2));
    },
  });
  useEffect(() => draw(), [ms, a, b, draw]);

  const lane = (y: number, label: string) => (
    <g>
      <text x={40} y={y + 5} fontSize={13} fill="currentColor" opacity={0.6} className="font-sans tabular-nums">{label}</text>
      <line x1={X0} x2={X1} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.15} />
      <circle cx={X0} cy={y} r={3} fill="currentColor" opacity={0.3} />
      <circle cx={X1} cy={y} r={3} fill="currentColor" opacity={0.3} />
    </g>
  );

  return (
    <Figure
      stageRef={ref}
      aspect="2 / 1"
      caption={caption}
      readout={`${ms} ms · ${verdict(ms)}`}
      stage={
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full">
          {lane(130, `${REF} ms`)}
          {lane(270, `${ms} ms`)}
          <rect ref={setA} x={X0 - S / 2} y={130 - S / 2} width={S} height={S} rx={12} fill="currentColor" opacity={0.45} />
          <rect ref={setB} x={X0 - S / 2} y={270 - S / 2} width={S} height={S} rx={12} fill="currentColor" />
        </svg>
      }
      controls={
        <>
          <Slider label="Duration" value={ms} min={100} max={1500} step={20} onChange={setMs} format={(v) => `${v} ms`} />
          <div className="grid grid-cols-[5rem_1fr] items-center gap-3 text-xs">
            <span className="text-muted">Play</span>
            <div><Replay onClick={replay} /></div>
          </div>
        </>
      }
    />
  );
}
