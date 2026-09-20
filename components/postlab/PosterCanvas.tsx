"use client";

// A live picture of a poster — the studio's preview, a thumbnail on a wall,
// and the running example inside a Learn piece, all the same component.
//
// It draws through `drawPoster`, which is the same function the exporter
// calls, so what is on screen is what comes out of the export at a different
// number of pixels. Nothing re-renders per frame: the canvas subscribes to
// the shared clock and paints itself.

import { useEffect, useRef } from "react";
import { FORMATS, drawPoster, type Poster, type TypeFaces } from "@/lib/poster";
import { clock } from "./clock";

/** Seconds in one loop. Long enough to read a slow breath, short enough that
    a GIF of it is still a GIF. */
export const LOOP = 6;

export default function PosterCanvas({
  poster,
  width,
  faces,
  t = 0,
  live = false,
  fps = 12,
  className = "",
}: {
  poster: Poster;
  /** CSS pixels wide; the canvas is drawn at exactly this size. */
  width: number;
  faces?: TypeFaces | null;
  t?: number;
  /** Follow the playhead instead of holding one frame. */
  live?: boolean;
  /** Redraw ceiling. A wall of thumbnails does not need sixty. */
  fps?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const base = FORMATS[poster.format];
  const w = Math.max(8, Math.round(width));
  const h = Math.max(8, Math.round((width * base.h) / base.w));

  /* Redrawing is driven by the poster's own value, not by identity: the
     studio rebuilds the object on every keystroke and a deep compare here is
     cheaper than a repaint that was not needed. */
  const key = JSON.stringify(poster);
  const moves = poster.motion > 0;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const current = JSON.parse(key) as Poster;
    const draw = (p: number) => drawPoster(ctx, current, p, w, h, faces ?? undefined);

    draw(live ? (clock.get() % LOOP) / LOOP : t);
    if (!live || !moves) return;

    let last = -1;
    return clock.watch((now) => {
      if (now - last < 1 / fps && now > last) return;
      last = now;
      draw((now % LOOP) / LOOP);
    });
  }, [key, w, h, t, live, moves, fps, faces]);

  return <canvas ref={ref} width={w} height={h} className={`block h-auto w-full ${className}`} />;
}
