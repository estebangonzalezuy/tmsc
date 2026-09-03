"use client";

// Two generic hooks, kept from the old model's Stage.tsx and nothing else of
// it: `useStageFit` (fit a format into available room) and `useClockRunning`
// (the rAF loop that advances clock.set) are both generic over format/
// duration, never over the old PostSpec/layer-stack shape.
// `components/learn/ClockRunner.tsx` is the one remaining caller — the
// Tiles and Kinetics studios that used to share this file (each with its
// own Stage.tsx hardcoding this path) were retired along with the rest of
// the old model. The node-graph studio itself doesn't need either hook (the
// node canvas is a free pan/zoom surface, not a fixed-aspect stage), so
// nothing here is used by components/postlab/* — this file exists solely
// for ClockRunner.

import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { FORMATS, type PostFormat } from "@/lib/postgraph";
import { clock } from "./clock";

/** Fit a post of this format into whatever room the element has, keeping its
    proportions. Returns CSS pixels for the frame. */
export function useStageFit(ref: RefObject<HTMLElement | null>, format: PostFormat, pad = 56) {
  const { w, h } = FORMATS[format];
  const [size, setSize] = useState({ w: 320, h: 400 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const s = Math.min((el.clientWidth - pad) / w, (el.clientHeight - pad) / h);
      if (s > 0) setSize({ w: Math.floor(w * s), h: Math.floor(h * s) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, w, h, pad]);
  return size;
}

/** The loop, running. Every canvas is a function of this clock, so a paused
    frame is exactly the frame that exports. */
export function useClockRunning(playing: boolean, duration: number) {
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      clock.set((clock.get() + dt) % Math.max(2, duration));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration]);
}
