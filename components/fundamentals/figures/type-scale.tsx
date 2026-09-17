"use client";

import { useState } from "react";
import Figure from "./Figure";
import { Chips, Slider } from "./controls";
import { num, pick, type Params } from "./params";

/* A type scale: one base size, one ratio, and every other size follows.
   The ratios are the musical ones because that is what they are — the same
   intervals, in size instead of pitch. A small ratio gives you many usable
   steps close together; a big one gives you drama and skips the middle. */

const RATIOS = [
  { value: "1.125", label: "1.125", name: "major second" },
  { value: "1.2", label: "1.2", name: "minor third" },
  { value: "1.25", label: "1.25", name: "major third" },
  { value: "1.333", label: "1.333", name: "perfect fourth" },
  { value: "1.5", label: "1.5", name: "perfect fifth" },
  { value: "1.618", label: "1.618", name: "golden ratio" },
] as const;
type Ratio = (typeof RATIOS)[number]["value"];
const RATIO_KEYS = RATIOS.map((r) => r.value);

export default function TypeScale({ params, caption }: { params: Params; caption?: string }) {
  const [base, setBase] = useState(num(params, "base", 16, 12, 22));
  const [ratio, setRatio] = useState<Ratio>(pick(params, "ratio", RATIO_KEYS, "1.25"));
  const [steps, setSteps] = useState(num(params, "steps", 5, 3, 6));

  const r = Number(ratio);
  const sizes = Array.from({ length: steps }, (_, i) => base * Math.pow(r, i)).reverse();
  const named = RATIOS.find((x) => x.value === ratio)!;

  return (
    <Figure
      aspect={null}
      caption={caption}
      readout={`${ratio} · ${named.name} · ${Math.round(sizes[0])}px at the top`}
      stage={
        <div className="px-6 py-5 flex flex-col">
          {sizes.map((s, i) => {
            const step = steps - 1 - i;
            return (
              <div key={i} className="flex items-baseline justify-between gap-4" style={{ minHeight: s * 1.15 }}>
                <span className="font-serif whitespace-nowrap" style={{ fontSize: s, lineHeight: 1.1 }}>
                  Aa
                </span>
                <span className="text-xs text-muted tabular-nums whitespace-nowrap">
                  {Math.round(s)}px{step === 0 ? " · base" : ` · base × ${ratio}${step > 1 ? `^${step}` : ""}`}
                </span>
              </div>
            );
          })}
        </div>
      }
      controls={
        <>
          <Slider label="Base" value={base} min={12} max={22} onChange={setBase} format={(v) => `${v}px`} />
          <Chips label="Ratio" value={ratio} options={RATIOS.map((x) => ({ value: x.value, label: x.label }))} onChange={setRatio} />
          <Slider label="Steps" value={steps} min={3} max={6} onChange={setSteps} />
        </>
      }
    />
  );
}
