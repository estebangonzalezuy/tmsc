"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useNearViewport, useReducedMotion } from "@/components/clips/useNearViewport";

/* The animation loop a moving figure runs on.
 *
 * Each figure has its own, deliberately — not the page-wide clock the
 * studios and the Learn examples share. That clock is one number the whole
 * page reads, wrapped every six seconds, which is exactly right for a wall of
 * loops and exactly wrong for a figure that has to start over when you press
 * Replay, hold at its end so the eye can rest, and run at the duration a
 * slider just set. Nothing here touches components/postlab/clock.ts, so the
 * "one ClockRunner per page" rule is not in play: nothing advances the shared
 * clock, and a Fundamentals page renders no runner at all.
 *
 * It only runs while the figure is near the viewport and the reader allows
 * motion (both hooks are the Clips wall's, already hydration-safe). Under
 * reduced motion a figure holds its end state; Replay still plays it once,
 * because motion the reader asked for is the point of the page.
 *
 * `onFrame(p)` gets the cycle's progress, 0 to 1, and writes to the DOM
 * itself — a few attributes on a few elements — never React state per frame.
 */
export function useLoop({
  period,
  hold = 0,
  playing = true,
  onFrame,
}: {
  /** The moving part, in ms. */
  period: number;
  /** How long the end state is held before it starts over, in ms. */
  hold?: number;
  playing?: boolean;
  onFrame: (p: number) => void;
}) {
  const [ref, near] = useNearViewport<HTMLDivElement>("200px");
  const reduced = useReducedMotion();

  const frame = useRef(onFrame);
  useEffect(() => {
    frame.current = onFrame;
  });

  /* ms into the current cycle. A ref: it changes sixty times a second and
     nothing in React needs to know. */
  const t = useRef(0);
  /* Scrubbed by hand: hold still until Replay. */
  const [manual, setManual] = useState(false);
  /* Under reduced motion, Replay plays exactly one cycle. */
  const [once, setOnce] = useState(0);

  const running = near && playing && !manual && (!reduced || once > 0);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const cycle = period + hold;
    const tick = (now: number) => {
      /* Capped so a background tab coming back doesn't jump the loop. */
      const dt = Math.min(100, now - last);
      last = now;
      t.current += dt;
      if (t.current >= cycle) {
        if (reduced) {
          t.current = period;
          frame.current(1);
          setOnce(0);
          return;
        }
        t.current -= cycle;
      }
      frame.current(Math.min(1, t.current / period));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, period, hold, reduced]);

  /* A reader who asked for less motion sees the end of the move, not the
     start of one that never comes. */
  useEffect(() => {
    if (reduced && once === 0 && !manual) {
      t.current = period;
      frame.current(1);
    }
  }, [reduced, once, manual, period]);

  const replay = useCallback(() => {
    t.current = 0;
    setManual(false);
    if (reduced) setOnce((n) => n + 1);
    else frame.current(0);
  }, [reduced]);

  const scrub = useCallback(
    (p: number) => {
      setManual(true);
      t.current = Math.min(1, Math.max(0, p)) * period;
      frame.current(Math.min(1, Math.max(0, p)));
    },
    [period],
  );

  /** Redraw the current instant — for when a setting changed and the loop is
      not running to pick it up. */
  const draw = useCallback(() => {
    frame.current(Math.min(1, t.current / period));
  }, [period]);

  return { ref, replay, scrub, draw, reduced };
}
