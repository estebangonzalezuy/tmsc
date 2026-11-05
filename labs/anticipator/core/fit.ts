// Fallback fitting. A plain animate-text runtime only reads `duration_ms` +
// `easing`, so for each spring phase we fit the best cubic-bezier to the real
// curve (anticipation + spring) and record its error honestly. A cubic can
// hold one dip (y1 < 0) and one overshoot (y2 > 1), never a second bounce.
// We also emit an exact CSS linear() easing for runtimes that support it.

import type { Phase } from "./types.ts";
import { cubicBezier } from "./easing.ts";
import { sampleCurve, springPhaseMs } from "./phase.ts";

type P4 = [number, number, number, number];
type Pt = { x: number; y: number };

const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

function errorOf(params: P4, pts: Pt[]) {
  const f = cubicBezier(...params);
  let sum = 0, max = 0;
  for (const p of pts) {
    const e = Math.abs(f(p.x) - p.y);
    sum += e * e;
    if (e > max) max = e;
  }
  return { rms: Math.sqrt(sum / pts.length), max };
}

function clampParams([x1, y1, x2, y2]: number[]): P4 {
  const c = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return [c(x1, 0, 1), c(y1, -1.5, 2.5), c(x2, 0, 1), c(y2, -1.5, 2.5)];
}

// Nelder–Mead on 4 params: small, deterministic, good enough for four numbers.
function nelderMead(f: (p: number[]) => number, start: number[], step = 0.15, iters = 600): number[] {
  const n = start.length;
  let simplex: number[][] = [start];
  for (let i = 0; i < n; i++) {
    const p = start.slice();
    p[i] += step;
    simplex.push(p);
  }
  let vals = simplex.map(f);
  for (let k = 0; k < iters; k++) {
    const order = vals.map((_, i) => i).sort((a, b) => vals[a] - vals[b]);
    simplex = order.map((i) => simplex[i]);
    vals = order.map((i) => vals[i]);
    const c = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += simplex[i][j] / n;
    const worst = simplex[n];
    const refl = c.map((v, j) => v + (v - worst[j]));
    const fr = f(refl);
    if (fr < vals[0]) {
      const exp = c.map((v, j) => v + 2 * (v - worst[j]));
      const fe = f(exp);
      if (fe < fr) { simplex[n] = exp; vals[n] = fe; } else { simplex[n] = refl; vals[n] = fr; }
    } else if (fr < vals[n - 1]) {
      simplex[n] = refl; vals[n] = fr;
    } else {
      const con = c.map((v, j) => v + 0.5 * (worst[j] - v));
      const fc = f(con);
      if (fc < vals[n]) { simplex[n] = con; vals[n] = fc; }
      else {
        for (let i = 1; i <= n; i++) {
          simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j]));
          vals[i] = f(simplex[i]);
        }
      }
    }
  }
  return simplex[vals.indexOf(Math.min(...vals))];
}

/** Best cubic-bezier for a spring phase, plus its honest error (travel units). */
export function fitBezier(phase: Phase) {
  const { total, points } = sampleCurve(phase, 80, "spring");
  const cost = (p: number[]) => errorOf(clampParams(p), points).rms;
  const starts = [[0.3, -0.2, 0.3, 1.3], [0.2, 0, 0.2, 1], [0.5, -0.5, 0.2, 1.6], [0.15, 0.6, 0.3, 1], [0.34, 1.56, 0.64, 1], [0.36, -0.3, 0.1, 1.4]];
  // Also start from the bezier the spec was authored with, so the fit can only improve on it.
  const authored = /^cubic-bezier\(([^)]+)\)$/.exec(String(phase.easing || "").trim());
  if (authored) {
    const n = authored[1].split(",").map(Number);
    if (n.length === 4 && n.every(Number.isFinite)) starts.push(n);
  }
  let best: P4 = [0, 0, 1, 1], bestCost = Infinity;
  for (const s of starts) {
    const p = clampParams(nelderMead(cost, s));
    const c = cost(p);
    if (c < bestCost) { bestCost = c; best = p; }
  }
  const params = best.map((v) => round(v, 3)) as P4;
  const err = errorOf(params, points);
  return {
    easing: `cubic-bezier(${params.join(", ")})`,
    duration_ms: Math.round(total),
    rms_error: round(err.rms, 4),
    max_error: round(err.max, 4),
  };
}

/** Exact CSS linear() easing of a spring phase, n evenly spaced stops. */
export function cssLinear(phase: Phase, n = 48): string {
  const { points } = sampleCurve(phase, n, "spring");
  return `linear(${points.map((p) => round(p.y, 4)).join(", ")})`;
}

/** Short fingerprint of the physics a fallback was fitted from. */
export function physicsHash(phase: Phase): string {
  const src = JSON.stringify({ s: phase.x_spring || null, a: phase.x_anticipation || null });
  let h = 2166136261;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Write the fitted fallback into a spring phase in place. */
export function applyFallback(phase: Phase): Phase {
  if (!phase?.x_spring) return phase;
  const fit = fitBezier(phase);
  phase.easing = fit.easing;
  phase.duration_ms = fit.duration_ms;
  phase.x_fallback = {
    fitted_from: physicsHash(phase),
    rms_error: fit.rms_error,
    max_error: fit.max_error,
    spring_phase_ms: Math.round(springPhaseMs(phase)),
  };
  return phase;
}
