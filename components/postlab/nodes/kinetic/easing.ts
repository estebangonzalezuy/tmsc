// The acceleration menu the old Kinetics used, ported verbatim (pure math,
// no spec dependency) — a family and a direction rather than thirty named
// curves. `bounce` and `elastic` overshoot on purpose; they're the two that
// make type feel thrown rather than moved.

export type Ease = "linear" | "sine" | "quad" | "cubic" | "quart" | "expo" | "circ" | "back" | "bounce" | "elastic";
export type Dir = "in" | "out" | "inout";

export const EASES: Ease[] = ["linear", "sine", "quad", "cubic", "quart", "expo", "circ", "back", "bounce", "elastic"];
export const DIRS: Dir[] = ["in", "out", "inout"];

/** Every curve as its "in" form, 0→1. `out` and `inout` are derived, so a
    family is written once and can't disagree with itself. */
const IN: Record<Ease, (t: number) => number> = {
  linear: (t) => t,
  sine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  quad: (t) => t * t,
  cubic: (t) => t * t * t,
  quart: (t) => t * t * t * t,
  expo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  circ: (t) => 1 - Math.sqrt(1 - t * t),
  back: (t) => 2.70158 * t * t * t - 1.70158 * t * t,
  bounce: (t) => 1 - OUT_BOUNCE(1 - t),
  elastic: (t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3)),
};

function OUT_BOUNCE(t: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

export function ease(kind: Ease, dir: Dir, t: number): number {
  const x = Math.min(1, Math.max(0, t));
  const f = IN[kind] ?? IN.linear;
  if (dir === "in") return f(x);
  if (dir === "out") return 1 - f(1 - x);
  return x < 0.5 ? f(x * 2) / 2 : 1 - f((1 - x) * 2) / 2;
}
