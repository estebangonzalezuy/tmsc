"use client";

// The piece on screen, and the way one gets out.
//
// The canvas subscribes to the clock directly and never re-renders: the same
// bargain the Posts Studio struck, and for the same measured reason — holding
// the playhead in React state costs about a third of the frame rate, and this
// studio does more per frame than that one does.
//
// Everything here draws through `paint`, which is also what the exporter uses,
// so what you are looking at is what comes out. There is no second code path
// that could drift.

import { useEffect, useRef } from "react";
import { clock } from "@/components/postlab/clock";
import { FORMATS, type KineticSpec } from "@/lib/kinetics";
import { paint } from "./scenes";

export { useClockRunning, useStageFit } from "@/components/postlab/Stage";

export default function Stage({
  spec,
  width,
  height,
  canvasRef,
}: {
  spec: KineticSpec;
  width: number;
  height: number;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}) {
  const own = useRef<HTMLCanvasElement>(null);
  const ref = canvasRef ?? own;
  /* The spec is read through a ref inside the draw loop so a control change
     doesn't tear the subscription down and rebuild it sixty times a second
     while a slider is being dragged. Written in an effect rather than during
     render, because a ref touched in render is a ref that lies under Strict
     Mode's double invocation. */
  const specRef = useRef(spec);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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
    /* One draw a frame however many times the clock ticks — the scenes are the
       expensive part and drawing twice for one frame would just drop it. */
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

  /* Redraw on any change that isn't the clock — a control move while paused —
     and hand the running loop the spec it should be drawing from now on. */
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

  return (
    <canvas
      ref={ref}
      className="block"
      style={{ width, height }}
      aria-label="the piece"
    />
  );
}
