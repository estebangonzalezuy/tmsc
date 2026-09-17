"use client";

import { useState } from "react";
import Figure from "./Figure";
import { Chips, Slider } from "./controls";
import { num, pick, type Params } from "./params";

/* Margins on a post. The same title in the same frame; only the margin
   moves. At zero the type touches the edge and the frame stops being a
   frame. Past a certain point the margin is doing the composing, and the
   type has to shrink to fit what is left. The dashed line is the safe area
   the margin makes. */

const FORMATS = {
  square: { w: 1080, h: 1080, label: "Square" },
  portrait: { w: 1080, h: 1350, label: "Portrait" },
  story: { w: 1080, h: 1920, label: "Story" },
} as const;
type Format = keyof typeof FORMATS;
const FORMAT_KEYS = Object.keys(FORMATS) as Format[];

const SW = 800;
const SH = 500;

export default function GridMargins({ params, caption }: { params: Params; caption?: string }) {
  const [format, setFormat] = useState<Format>(pick(params, "format", FORMAT_KEYS, "portrait"));
  const [margin, setMargin] = useState(num(params, "margin", 8, 0, 20));

  const f = FORMATS[format];
  /* The frame fits the stage's height, so the story never overflows. */
  const scale = Math.min((SH - 40) / f.h, (SW - 40) / f.w);
  const fw = f.w * scale;
  const fh = f.h * scale;
  const fx = (SW - fw) / 2;
  const fy = (SH - fh) / 2;
  const m = (margin / 100) * fw;
  const inner = fw - 2 * m;

  /* Type as a share of the frame, capped by what the margins leave. */
  const size = Math.min(fw * 0.11, inner / 6.2);
  const lh = size * 1.05;
  const kicker = Math.max(6, fw * 0.028);

  return (
    <Figure
      caption={caption}
      readout={`margin ${Math.round((margin / 100) * f.w)}px of ${f.w} · type ${Math.round(size / scale)}px`}
      stage={
        <svg viewBox={`0 0 ${SW} ${SH}`} className="absolute inset-0 w-full h-full">
          <rect x={fx} y={fy} width={fw} height={fh} fill="currentColor" opacity={0.05} />
          <rect x={fx} y={fy} width={fw} height={fh} fill="none" stroke="currentColor" strokeOpacity={0.25} />
          {m > 0 && (
            <rect x={fx + m} y={fy + m} width={inner} height={fh - 2 * m} fill="none" stroke="currentColor" strokeOpacity={0.3} strokeDasharray="4 4" />
          )}
          <text x={fx + m} y={fy + m + kicker} fontSize={kicker} className="font-sans" fill="currentColor" style={{ letterSpacing: "0.08em" }}>
            THE MOTION SOCIAL CLUB
          </text>
          <text x={fx + m} y={fy + fh - m - lh * 1.05} fontSize={size} className="font-serif" fill="currentColor">
            Start in
          </text>
          <text x={fx + m} y={fy + fh - m - lh * 0.1} fontSize={size} className="font-serif" fill="currentColor">
            <tspan fontStyle="italic">motion</tspan> today.
          </text>
        </svg>
      }
      controls={
        <>
          <Chips
            label="Format"
            value={format}
            options={FORMAT_KEYS.map((k) => ({ value: k, label: FORMATS[k].label }))}
            onChange={setFormat}
          />
          <Slider label="Margin" value={margin} min={0} max={20} onChange={setMargin} format={(v) => `${v}%`} />
        </>
      }
    />
  );
}
