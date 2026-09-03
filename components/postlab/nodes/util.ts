// Small param-reading helpers shared by every node kind. `ParamValue` is
// `number | string | boolean | string[]`, so every evaluate() reads its
// params defensively — a param mid-edit (a blank field, a bad value) should
// degrade to a sane default rather than throw, matching renderFrame's own
// per-node try/catch philosophy.

import type { ParamValue } from "@/lib/postgraph";

/* A local copy of lib/postgraph.ts's own `WAVES`/`waveAt` — not imported
   from there. postgraph.ts imports `NODE_KINDS` from this directory's
   `index.ts` at its own bottom, and every node file may only ever `import
   type` from postgraph.ts in return, or that becomes a real circular
   *value* import: postgraph.ts's module body hasn't finished running (its
   own `const WAVES` included) by the time a node deep in that same import
   graph tries to read it, which throws "Cannot access before
   initialization" at first load. Keep these two in step with postgraph.ts's
   copy if either ever changes — small and stable enough that the
   duplication is the lesser cost. */
export const WAVES = ["sin", "tri", "saw", "square"] as const;
export type Wave = (typeof WAVES)[number];

export function waveAt(wave: Wave, x: number): number {
  const f = x - Math.floor(x);
  switch (wave) {
    case "tri":
      return 1 - 2 * Math.abs(f - 0.5);
    case "saw":
      return f;
    case "square":
      return f < 0.5 ? 0 : 1;
    default:
      return 0.5 - 0.5 * Math.cos(2 * Math.PI * f);
  }
}

export const num = (v: ParamValue | undefined, def: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : def;

export const str = (v: ParamValue | undefined, def: string): string =>
  typeof v === "string" ? v : def;

export const bool = (v: ParamValue | undefined, def: boolean): boolean =>
  typeof v === "boolean" ? v : def;

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

export const clamp01 = (v: number) => clamp(v, 0, 1);

/** A fresh canvas at exactly w x h — every evaluate() returns one of these. */
export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

const HEX = /^#[0-9a-f]{6}$/i;

export function hexToRgb(hex: string): [number, number, number] {
  const h = HEX.test(hex) ? hex : "#000000";
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
