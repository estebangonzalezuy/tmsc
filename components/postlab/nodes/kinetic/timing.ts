// The stagger timing model, ported verbatim from the old `lib/kinetics.ts` —
// pure math over a Timing bag, no spec dependency. `stagger` and `field` are
// the only two scenes that read it (the others don't stagger anything).

import { ease, type Dir, type Ease } from "./easing";

/** Where a stagger radiates from. A 3×3 grid of positions plus "order" (the
    headline's own reading order) and "random" (seeded, stable). */
export type Origin = "tl" | "tc" | "tr" | "ml" | "mc" | "mr" | "bl" | "bc" | "br" | "order" | "random";
export const ORIGINS: Origin[] = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br", "order", "random"];

export type Timing = {
  intro: Ease;
  introDir: Dir;
  /** Share of the loop, 0-1. Intro + pause + outro are normalized to fit. */
  introLen: number;
  pause: number;
  outro: Ease;
  outroDir: Dir;
  outroLen: number;
  /** How far apart two items start, as a share of the loop. */
  delay: number;
  from: Origin;
};

/**
 * One item's presence at time `p`: 0 = away, 1 = arrived.
 *
 * The whole loop is intro → pause → outro, and because those three are
 * shares rather than seconds the sum is renormalized to 1 — which is what
 * makes the frame at p=1 identical to the frame at p=0 whatever the sliders
 * say. `k` is the item's place in the queue, 0-1, already measured from the
 * origin.
 */
export function presence(t: Timing, p: number, k: number): number {
  const total = t.introLen + t.pause + t.outroLen || 1;
  const intro = t.introLen / total;
  const hold = t.pause / total;
  const spread = Math.min(0.9, Math.max(0, t.delay));
  const lead = k * spread;
  const span = 1 - spread;
  const local = (p - lead) / (span || 1);

  if (local < 0) {
    const wrapped = (local + 1) * span;
    return tail(t, wrapped, intro, hold, span, lead);
  }
  if (local > 1) return 0;

  if (local < intro) return ease(t.intro, t.introDir, local / (intro || 1));
  if (local < intro + hold) return 1;
  const o = (local - intro - hold) / (1 - intro - hold || 1);
  return 1 - ease(t.outro, t.outroDir, o);
}

/* The part of an item's journey that belongs to the previous turn of the
   loop — the half that guarantees the seam closes. */
function tail(t: Timing, wrapped: number, intro: number, hold: number, span: number, lead: number): number {
  const local = (wrapped - lead) / (span || 1);
  if (local < intro + hold || local > 1) return 0;
  const o = (local - intro - hold) / (1 - intro - hold || 1);
  return 1 - ease(t.outro, t.outroDir, o);
}

/** An item's place in the queue, 0-1, by where it sits in the frame. */
export function queue(from: Origin, x: number, y: number, i: number, n: number, seed = 1): number {
  if (n <= 1) return 0;
  if (from === "order") return i / (n - 1);
  if (from === "random") return rnd(i * 97 + seed * 13);
  const ax = from[1] === "l" ? 0 : from[1] === "r" ? 1 : 0.5;
  const ay = from[0] === "t" ? 0 : from[0] === "b" ? 1 : 0.5;
  const d = Math.hypot(x - ax, y - ay);
  return Math.min(1, d / Math.SQRT2);
}

/* A deterministic hash — a scattered layout is a design decision and must
   not crawl between frames or differ between two exports. */
export function rnd(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}
