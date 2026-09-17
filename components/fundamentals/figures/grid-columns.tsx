"use client";

import { useState } from "react";
import Figure from "./Figure";
import { Slider, Switch } from "./controls";
import { num, bool, type Params } from "./params";

/* A column grid, and three blocks that only ever land on it. Drag the
   columns and the blocks re-snap; drag the gutter and margin and the whole
   page breathes. The grid itself can be hidden, which is the point: it was
   never meant to be seen, only obeyed. */

const W = 800;
const H = 500;

export default function GridColumns({ params, caption }: { params: Params; caption?: string }) {
  const [columns, setColumns] = useState(num(params, "columns", 6, 2, 12));
  const [gutter, setGutter] = useState(num(params, "gutter", 16, 0, 48));
  const [margin, setMargin] = useState(num(params, "margin", 48, 0, 140));
  const [shown, setShown] = useState(bool(params, "grid", true));

  const colW = (W - 2 * margin - (columns - 1) * gutter) / columns;
  const x = (i: number) => margin + i * (colW + gutter);
  const span = (from: number, to: number) => ({ x: x(from), w: x(to) - x(from) - gutter });

  const half = Math.ceil(columns / 2);
  const a = span(0, half);
  const b = span(half, columns);
  const c = span(columns > 2 ? 1 : 0, columns > 2 ? columns - 1 : columns);

  const top = margin;
  const rowH = (H - 2 * margin - gutter) / 2;

  /* A block reads as text when it holds lines. */
  const lines = (bx: number, by: number, bw: number, bh: number, n: number, big = false) => {
    const pad = 18;
    const lh = big ? 26 : 14;
    const out = [];
    for (let i = 0; i < n; i++) {
      const y = by + pad + i * lh;
      if (y + (big ? 16 : 6) > by + bh - pad) break;
      const frac = i === n - 1 ? 0.55 : big ? 0.85 : 0.95 - (i % 3) * 0.08;
      out.push(
        <rect key={i} x={bx + pad} y={y} width={Math.max(0, (bw - 2 * pad) * frac)} height={big ? 16 : 6} rx={big ? 3 : 3} fill="currentColor" opacity={big ? 0.9 : 0.35} />,
      );
    }
    return out;
  };

  return (
    <Figure
      caption={caption}
      readout={`${columns} columns · each ${((colW / W) * 100).toFixed(1)}% of the width`}
      stage={
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full">
          {shown &&
            Array.from({ length: columns }, (_, i) => (
              <rect key={i} x={x(i)} y={0} width={colW} height={H} fill="currentColor" opacity={0.06} />
            ))}
          {shown && margin > 0 && (
            <rect x={margin} y={margin} width={W - 2 * margin} height={H - 2 * margin} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeDasharray="4 4" />
          )}
          <g className="text-foreground">
            <rect x={a.x} y={top} width={a.w} height={rowH} rx={10} fill="currentColor" opacity={0.08} />
            {lines(a.x, top, a.w, rowH, 3, true)}
            <rect x={b.x} y={top} width={b.w} height={rowH} rx={10} fill="currentColor" opacity={0.08} />
            {lines(b.x, top, b.w, rowH, 9)}
            <rect x={c.x} y={top + rowH + gutter} width={c.w} height={rowH} rx={10} fill="currentColor" opacity={0.08} />
            {lines(c.x, top + rowH + gutter, c.w, rowH, 6)}
          </g>
        </svg>
      }
      controls={
        <>
          <Slider label="Columns" value={columns} min={2} max={12} onChange={setColumns} />
          <Slider label="Gutter" value={gutter} min={0} max={48} step={4} onChange={setGutter} />
          <Slider label="Margin" value={margin} min={0} max={140} step={4} onChange={setMargin} />
          <Switch label="Grid" on={shown} onChange={setShown} labels={["Shown", "Hidden"]} />
        </>
      }
    />
  );
}
