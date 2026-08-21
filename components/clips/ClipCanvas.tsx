"use client";

import { useEffect, useRef, useState } from "react";
import { ticker } from "@/components/clips/ticker";
import { cellAt, clipSeconds, frameAt } from "@/lib/clips-shared";

// One clip, animating.
//
// The poster is a plain <img> underneath and the canvas is painted over it, so
// a tile is a picture from its first paint and becomes motion when its sheet
// arrives. That ordering is the whole reason the wall is usable: a sheet is a
// few hundred kilobytes and forty of them are not something to block on.
//
// Nothing here re-renders per frame. The sheet is an <img> decoded off the
// document, the canvas is a ref, and the ticker calls a function that draws one
// cell. React hears about exactly two things: the sheet arriving, and whether
// this tile is close enough to the viewport to be worth animating at all.

/** Load a sheet once per URL per page, so a project page showing the same clip
 *  twice and a wall re-mounting a tile on filter don't refetch it. The browser
 *  cache would serve the bytes, but it would decode the image again, and a
 *  2400×1350 decode is not free. */
const sheets = new Map<string, Promise<HTMLImageElement>>();

function loadSheet(src: string): Promise<HTMLImageElement> {
  const already = sheets.get(src);
  if (already) return already;
  const job = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't load ${src}`));
    img.src = src;
  });
  sheets.set(src, job);
  job.catch(() => sheets.delete(src));
  return job;
}

export type ClipShape = {
  cols: number;
  rows: number;
  frames: number;
  /** One cell of the sheet, which is also the clip's own size. */
  w: number;
  h: number;
  in: number;
  out: number;
};

export default function ClipCanvas({
  clip,
  sheet,
  poster,
  alt,
  /** Off until the tile is worth animating — near the viewport, or hovered. */
  active,
  /** Set to hold a particular frame: the lightbox scrubbing, or stepping. */
  frame,
  className = "",
}: {
  clip: ClipShape;
  sheet: string;
  poster: string;
  alt: string;
  active?: boolean;
  frame?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const held = frame !== undefined;

  /* The sheet is only fetched once somebody might see it move. A wall of forty
     tiles that eagerly loaded every sheet would be twenty megabytes before a
     cursor had gone near one. */
  useEffect(() => {
    if (!active && !held) return;
    let alive = true;
    loadSheet(sheet)
      .then((img) => alive && setImage(img))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [sheet, active, held]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = clip.w;
    canvas.height = clip.h;

    const draw = (index: number) => {
      const { x, y } = cellAt(clip, index);
      ctx.drawImage(image, x, y, clip.w, clip.h, 0, 0, clip.w, clip.h);
    };

    if (held) {
      draw(Math.max(0, Math.min(clip.frames - 1, Math.round(frame))));
      return;
    }
    if (!active) return;

    const seconds = clipSeconds(clip);
    let last = -1;
    /* Only touching the canvas when the frame actually changes: a 24-frame clip
       over two seconds is twelve draws a second, not sixty. */
    const paint = (ms: number) => {
      const index = frameAt(ms, seconds, clip.frames);
      if (index === last) return;
      last = index;
      draw(index);
    };
    paint(ticker.get());
    return ticker.watch(paint);
  }, [image, clip, active, held, frame]);

  /* The clip's own shape, set here rather than left to whoever renders it.
     The poster and the canvas are both absolutely positioned, so a wrapper
     with no height collapses to nothing — and a caller that forgot to say
     `aspect-video` got a card with no picture in it. A clip knows how tall it
     is; nobody else should have to. */
  return (
    <span
      style={{ aspectRatio: `${clip.w} / ${clip.h}` }}
      className={`relative block overflow-hidden ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- the Cutter wrote
          this file at the size the wall shows it; there is nothing to optimise
          and next/image would want a loader for what is already the right
          picture. */}
      <img
        src={poster}
        alt={alt}
        width={clip.w}
        height={clip.h}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          image ? "opacity-100" : "opacity-0"
        }`}
      />
    </span>
  );
}
