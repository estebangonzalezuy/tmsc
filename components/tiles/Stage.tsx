"use client";

// The tile on screen.
//
// The canvas subscribes to the clock directly and never re-renders — the same
// bargain both other studios struck, and for the same measured reason: holding
// the playhead in React state costs about a third of the frame rate.
//
// Everything draws through `paint`, which is also what the thumbnails and the
// exporter use, so what you are looking at is what comes out.

import { useEffect, useRef } from "react";
import { clock } from "@/components/postlab/clock";
import { FORMATS, type TileSpec } from "@/lib/tiles";
import { paint } from "./render";

export { useClockRunning, useStageFit } from "@/components/postlab/Stage";

export default function Stage({
  spec,
  width,
  height,
  canvasRef,
}: {
  spec: TileSpec;
  width: number;
  height: number;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}) {
  const own = useRef<HTMLCanvasElement>(null);
  const ref = canvasRef ?? own;
  /* The spec is read through a ref inside the draw loop so a control change
     doesn't tear the subscription down and rebuild it sixty times a second
     while a slider is being dragged. Written in an effect rather than during
     render, because a ref touched in render lies under Strict Mode's double
     invocation. */
  const specRef = useRef(spec);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    let pending = false;
    const draw = () => {
      pending = false;
      const s = specRef.current;
      const { w, h } = FORMATS[s.format];
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      paint(ctx, s, clock.get() / Math.max(0.001, s.duration), w, h);
    };
    /* One draw a frame however many times the clock ticks. */
    const schedule = () => {
      if (pending) return;
      pending = true;
      raf = requestAnimationFrame(draw);
    };
    const stop = clock.watch(schedule);
    schedule();
    return () => {
      stop();
      cancelAnimationFrame(raf);
    };
  }, [ref]);

  /* Redraw on any change that isn't the clock — a control moved while paused. */
  useEffect(() => {
    specRef.current = spec;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { w, h } = FORMATS[spec.format];
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    paint(ctx, spec, clock.get() / Math.max(0.001, spec.duration), w, h);
  }, [spec, ref]);

  return <canvas ref={ref} className="block" style={{ width, height }} aria-label="the tile" />;
}

/**
 * A real thumbnail: the tile itself, drawn small, and **live** — it follows
 * the playhead rather than holding frame zero, because a tile in this studio
 * moves and a shelf of frozen first frames would say nothing about which one
 * to pick.
 */
export function Thumb({ spec, size = 96 }: { spec: TileSpec; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const specRef = useRef(spec);
  useEffect(() => {
    specRef.current = spec;
  }, [spec]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let last = -1;
    const draw = (t: number) => {
      /* Twelve a second is plenty for something this size, and a shelf of
         thirteen of them at sixty would cost more than the stage. */
      if (t - last < 1 / 12 && t > last) return;
      last = t;
      const s = specRef.current;
      paint(ctx, s, t / Math.max(0.001, s.duration), canvas.width, canvas.height);
    };
    draw(clock.get());
    return clock.watch(draw);
  }, []);

  const { w, h } = FORMATS[spec.format];
  /* Drawn at a fixed pixel size and then laid out fluidly: a shelf of these
     sits in a grid whose cells are whatever the drawer is wide, and a canvas
     that measured itself would be a resize observer per thumbnail. */
  return (
    <canvas
      ref={ref}
      width={size}
      height={Math.round((size * h) / w)}
      style={{ width: "100%", height: "auto", aspectRatio: `${w} / ${h}` }}
      className="block"
    />
  );
}
