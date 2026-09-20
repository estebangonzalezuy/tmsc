"use client";

// Two generic hooks: `useStageFit` (fit a format into the room available) and
// `useClockRunning` (the rAF loop that advances the playhead). Both are
// generic over format and duration, and neither knows what a post is.
//
// `useClockRunning` is what makes every live canvas move: without it the
// clock never advances and every preview holds its first frame forever. One
// caller per page, always — a second runner does not animate a second thing,
// it advances the same number twice a frame and runs the page at double
// speed. `components/learn/ClockRunner.tsx` is one caller; the studio is the
// other.

import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { FORMATS, type FormatKind } from "@/lib/poster";
import { clock } from "./clock";

/** Fit a post of this format into whatever room the element has, keeping its
    proportions. Returns CSS pixels for the frame. */
export function useStageFit(ref: RefObject<HTMLElement | null>, format: FormatKind, pad = 56) {
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

/** The loop, running. A paused frame is exactly the frame that exports. */
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
