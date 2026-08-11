"use client";

// A small picture of a real post. Every place the studio shows you a choice —
// the filmstrip, the recipe shelf, a sheet of variations — shows it as this:
// the same renderer, the same spec, drawn at the size it is displayed so the
// dither cells land where they will in the finished post instead of being
// smoothed into gray on the way down.

import { useEffect, useRef } from "react";
import { FORMATS, type PostSpec } from "@/lib/postlab";
import { paintPoster } from "./exporter";
import type { Fonts } from "./overlay";

export default function Poster({
  spec,
  index,
  fonts,
  width,
  t = 0,
  className = "",
}: {
  spec: PostSpec;
  index: number;
  fonts: Fonts | null;
  /** CSS pixels wide; the canvas is drawn at exactly this size. */
  width: number;
  /** Which moment of the loop to draw. */
  t?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const base = FORMATS[spec.format];
  const w = Math.max(8, Math.round(width));
  const h = Math.max(8, Math.round((width * base.h) / base.w));

  /* Redrawn when this slide's own description changes, not when anything
     else in the post does — a filmstrip of twenty slides shouldn't repaint
     because the twenty-first got a new headline. */
  const key = JSON.stringify(spec.slides[index]);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    paintPoster(ctx, spec, index, w, h, fonts, t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, index, spec.format, spec.duration, spec.slides.length, w, h, fonts, t]);

  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      className={`block w-full h-auto ${className}`}
    />
  );
}
