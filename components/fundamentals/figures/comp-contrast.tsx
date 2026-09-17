"use client";

import { useState } from "react";
import Figure from "./Figure";
import { Slider } from "./controls";
import { num, type Params } from "./params";

/* Contrast is the gap between things. One slider widens every gap at once:
   size, weight, presence. At zero the three lines are three equals and the
   eye has nowhere to land. Long before the slider reaches the end, one
   thing is first — and past that, the rest start to disappear. */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function verdict(c: number) {
  if (c < 0.15) return "three equals, nothing first";
  if (c < 0.45) return "a lead is forming";
  if (c < 0.8) return "one thing first, the rest still read";
  return "one thing, and the rest are furniture";
}

export default function CompContrast({ params, caption }: { params: Params; caption?: string }) {
  const [c, setC] = useState(num(params, "contrast", 0.6, 0, 1));

  return (
    <Figure
      aspect={null}
      caption={caption}
      readout={`${c.toFixed(2)} · ${verdict(c)}`}
      stage={
        <div className="px-6 py-6 max-w-lg">
          <p
            className="font-serif"
            style={{
              fontSize: lerp(16, 44, c),
              lineHeight: lerp(1.5, 1.08, c),
              fontWeight: lerp(400, 600, c),
              marginBottom: lerp(0, 14, c),
            }}
          >
            One thing first.
          </p>
          <p style={{ fontSize: lerp(16, 15, c), lineHeight: 1.5, opacity: lerp(1, 0.62, c) }}>
            Then the sentence that explains it, at a size you read second.
          </p>
          <p
            style={{
              fontSize: lerp(16, 11, c),
              lineHeight: 1.5,
              opacity: lerp(1, 0.45, c),
              marginTop: lerp(0, 12, c),
              letterSpacing: `${lerp(0, 0.08, c)}em`,
              textTransform: c > 0.5 ? "uppercase" : "none",
            }}
          >
            the Motion Social Club · 2026
          </p>
        </div>
      }
      controls={<Slider label="Contrast" value={c} min={0} max={1} step={0.01} onChange={setC} format={(v) => v.toFixed(2)} />}
    />
  );
}
