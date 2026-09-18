"use client";

import { useEffect } from "react";
import { useNearViewport, useReducedMotion } from "@/components/clips/useNearViewport";
import { DRAWERS, hash01, type IllusKind } from "@/lib/illus/drawers";

/* A canvas that runs one of the club's drawers.
 *
 * Every illustration on the public site is one of these: the six room cards,
 * the rings behind the homepage headline, a letter's cover, a Learn track.
 *
 * **One animation frame for the whole page.** A homepage can hold a dozen of
 * these, and a dozen requestAnimationFrame loops is a dozen chances to jank
 * the scroll. So the loop lives here, at module scope: a canvas registers
 * itself while it is on screen, the loop starts with the first one and stops
 * with the last, and every registered canvas is drawn from the same
 * timestamp. That is deliberately not the studios' clock
 * (components/postlab/clock.ts): that one is a wrapped six-second number the
 * Posts Studio's exporter also reads, it needs a <ClockRunner /> mounted to
 * advance, and a page that mounted two would run at double speed. Nothing
 * here touches it, so no public page needs a runner.
 *
 * **A still is the same drawing, stopped.** Pass `still` and the canvas draws
 * once, at an instant seeded from that string, and never registers. That is
 * what a newsletter cover is: the same code as the moving version, frozen
 * where its own title puts it, so two letters never look alike and one letter
 * always looks the same.
 */

type Entry = {
  el: HTMLCanvasElement;
  kind: IllusKind;
  ink: string;
  seed: number;
};

const live = new Set<Entry>();
let frame = 0;

/* The families come from next/font, so their real names are only knowable in
   the browser. Read once, off the root, where layout.tsx puts them. */
let families: { serif: string; sans: string } | null = null;
function fonts() {
  if (!families) {
    const style = getComputedStyle(document.documentElement);
    const serif = style.getPropertyValue("--font-lora").trim();
    const sans = style.getPropertyValue("--font-archivo").trim();
    families = {
      serif: serif ? `${serif}, Georgia, serif` : "Georgia, serif",
      sans: sans ? `${sans}, system-ui, sans-serif` : "system-ui, sans-serif",
    };
  }
  return families;
}

function paint(entry: Entry, t: number) {
  const { el, kind, ink, seed } = entry;
  const width = el.clientWidth;
  const height = el.clientHeight;
  if (!width || !height) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (el.width !== Math.round(width * dpr)) {
    el.width = Math.round(width * dpr);
    el.height = Math.round(height * dpr);
  }
  const c = el.getContext("2d");
  if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, width, height);
  const { serif, sans } = fonts();
  c.save();
  DRAWERS[kind]({ c, w: width, h: height, t: t + seed, ink, serif, sans });
  c.restore();
}

function tick(now: number) {
  const t = now / 1000;
  for (const entry of live) paint(entry, t);
  frame = live.size ? requestAnimationFrame(tick) : 0;
}

function join(entry: Entry) {
  live.add(entry);
  if (!frame) frame = requestAnimationFrame(tick);
}

function leave(entry: Entry) {
  live.delete(entry);
  if (!live.size && frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
}

export default function Illustration({
  kind,
  ink,
  seed,
  still,
  className = "",
}: {
  kind: IllusKind;
  /** The one colour the drawing is made of — a CSS colour, alpha included. */
  ink: string;
  /** Something stable about the thing this belongs to, so it starts in its
      own place in the cycle rather than in lockstep with its neighbours. */
  seed?: string;
  /** Draw one frame, at an instant seeded from this string, and stop. */
  still?: string;
  className?: string;
}) {
  const [ref, near] = useNearViewport<HTMLCanvasElement>("200px");
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const entry: Entry = {
      el,
      kind,
      ink,
      seed: still ? hash01(still) * 30 : seed ? hash01(seed) * 12 : 0,
    };
    /* A still, an off-screen canvas, and a viewer who asked for less motion
       all get the same thing: one frame, held. The seed is what makes that
       frame worth looking at. */
    if (still || reduced || !near) {
      paint(entry, still || reduced ? 0 : 0);
      return;
    }
    join(entry);
    return () => leave(entry);
  }, [ref, kind, ink, seed, still, near, reduced]);

  /* Redraw a held frame when the element is resized, since nothing else will. */
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (live.size && !still && !reduced && near) return;
      paint(
        {
          el,
          kind,
          ink,
          seed: still ? hash01(still) * 30 : seed ? hash01(seed) * 12 : 0,
        },
        0,
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, kind, ink, seed, still, near, reduced]);

  return <canvas ref={ref} aria-hidden className={`block ${className}`} />;
}
