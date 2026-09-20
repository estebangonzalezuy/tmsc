"use client";

import { useEffect, useRef, useState } from "react";
import Figure from "./Figure";
import { Chips, Replay, Slider } from "./controls";
import { useLoop } from "./useLoop";
import { num, pick, type Params } from "./params";
import { ease, type Dir, type Ease } from "@/lib/easing";

/* Stagger. Several things arriving, and the gap between one starting and
   the next. At zero they are one thing. A few dozen milliseconds and they
   become a sequence the eye can count; a lot more and the last one is
   arriving after the reader has moved on. Each item's own move is always
   the same 500 ms. */

const CURVES = [
  { value: "out", label: "Ease out", ease: "cubic" as Ease, dir: "out" as Dir },
  { value: "back", label: "Overshoot", ease: "back" as Ease, dir: "out" as Dir },
  { value: "linear", label: "Linear", ease: "linear" as Ease, dir: "out" as Dir },
] as const;
type Curve = (typeof CURVES)[number]["value"];
const CURVE_KEYS = CURVES.map((c) => c.value);

const W = 800;
const H = 400;
const EACH = 500;
const RISE = 60;

export default function MotionStagger({ params, caption }: { params: Params; caption?: string }) {
  const [count, setCount] = useState(num(params, "count", 5, 2, 8));
  const [gap, setGap] = useState(num(params, "stagger", 80, 0, 200));
  const [curve, setCurve] = useState<Curve>(pick(params, "curve", CURVE_KEYS, "out"));
  const items = useRef<(SVGGElement | null)[]>([]);

  const total = EACH + (count - 1) * gap;
  const c = CURVES.find((x) => x.value === curve)!;

  const { ref, replay, draw } = useLoop({
    period: total,
    hold: 900,
    onFrame: (p) => {
      const t = p * total;
      for (let i = 0; i < count; i++) {
        const el = items.current[i];
        if (!el) continue;
        const local = Math.min(1, Math.max(0, (t - i * gap) / EACH));
        const v = ease(c.ease, c.dir, local);
        el.setAttribute("transform", `translate(0 ${(1 - v) * RISE})`);
        el.setAttribute("opacity", String(Math.min(1, local * 2.5)));
      }
    },
  });
  useEffect(() => draw(), [count, gap, curve, draw]);

  const pad = 60;
  const g = 16;
  const w = (W - 2 * pad - (count - 1) * g) / count;
  const h = 150;
  const y = (H - h) / 2;

  return (
    <Figure
      stageRef={ref}
      aspect="2 / 1"
      caption={caption}
      readout={`${count} items · ${gap} ms apart · ${total} ms in all`}
      stage={
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full">
          {Array.from({ length: count }, (_, i) => (
            <g
              key={i}
              ref={(el) => {
                items.current[i] = el;
              }}
              transform={`translate(0 ${RISE})`}
              opacity={0}
            >
              <rect x={pad + i * (w + g)} y={y} width={w} height={h} rx={14} fill="currentColor" opacity={0.9} />
              <rect x={pad + i * (w + g) + 16} y={y + h - 34} width={Math.max(8, w * 0.45)} height={8} rx={4} fill="var(--surface)" opacity={0.6} />
            </g>
          ))}
        </svg>
      }
      controls={
        <>
          <Slider label="Items" value={count} min={2} max={8} onChange={setCount} />
          <Slider label="Stagger" value={gap} min={0} max={200} step={10} onChange={setGap} format={(v) => `${v} ms`} />
          <Chips label="Curve" value={curve} options={CURVES.map((x) => ({ value: x.value, label: x.label }))} onChange={setCurve} />
          <div className="grid grid-cols-[5rem_1fr] items-center gap-3 text-xs">
            <span className="text-muted">Play</span>
            <div><Replay onClick={replay} /></div>
          </div>
        </>
      }
    />
  );
}
