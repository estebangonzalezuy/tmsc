// Fallback fitting. A plain animate-text runtime only understands
// `duration_ms` + a CSS `easing`. So for every spring phase we fit the best
// cubic-bezier to the real curve (anticipation + spring), and also emit an
// exact CSS `linear()` easing for runtimes that support it.
//
// cubic-bezier can hold one dip below 0 (y1 < 0, the anticipation) and one
// overshoot above 1 (y2 > 1). It cannot hold a second bounce. `max_error`
// says honestly how far off the fallback is.

import { cubicBezier } from "./easing.js";
import { sampleCurve, springPhaseMs } from "./phase.js";

const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

function errorOf(params, pts) {
  const f = cubicBezier(...params);
  let sum = 0, max = 0;
  for (const p of pts) {
    const e = Math.abs(f(p.x) - p.y);
    sum += e * e;
    if (e > max) max = e;
  }
  return { rms: Math.sqrt(sum / pts.length), max };
}

function clampParams([x1, y1, x2, y2]) {
  const c = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  return [c(x1, 0, 1), c(y1, -1.5, 2.5), c(x2, 0, 1), c(y2, -1.5, 2.5)];
}

// Nelder–Mead on 4 params. Small, deterministic, good enough for 4 numbers.
function nelderMead(f, start, step = 0.15, iters = 400) {
  const n = start.length;
  let simplex = [start];
  for (let i = 0; i < n; i++) {
    const p = start.slice();
    p[i] += step;
    simplex.push(p);
  }
  let vals = simplex.map(f);
  for (let k = 0; k < iters; k++) {
    const order = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
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
  const best = vals.indexOf(Math.min(...vals));
  return simplex[best];
}

/** Best cubic-bezier for a spring phase, plus its honest error. */
export function fitBezier(phase) {
  const { total, points } = sampleCurve(phase, 80, "spring");
  const cost = (p) => errorOf(clampParams(p), points).rms;
  const starts = [
    [0.3, -0.2, 0.3, 1.3],
    [0.2, 0.0, 0.2, 1.0],
    [0.5, -0.5, 0.2, 1.6],
    [0.15, 0.6, 0.3, 1.0],
  ];
  let best = null, bestCost = Infinity;
  for (const s of starts) {
    const p = clampParams(nelderMead(cost, s));
    const c = cost(p);
    if (c < bestCost) { bestCost = c; best = p; }
  }
  const params = best.map((v) => round(v, 3));
  const err = errorOf(params, points);
  return {
    easing: `cubic-bezier(${params.join(", ")})`,
    duration_ms: Math.round(total),
    rms_error: round(err.rms, 4),
    max_error: round(err.max, 4),
  };
}

/** Exact CSS linear() easing of a spring phase, `n` evenly spaced stops. */
export function cssLinear(phase, n = 48) {
  const { points } = sampleCurve(phase, n, "spring");
  return `linear(${points.map((p) => round(p.y, 4)).join(", ")})`;
}

/** Stable short fingerprint of the physics a fallback was fitted from. */
export function physicsHash(phase) {
  const src = JSON.stringify({
    s: phase.x_spring || null,
    a: phase.x_anticipation || null,
  });
  let h = 2166136261;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Write the fitted fallback into a spring phase in place: `easing`,
 * `duration_ms` and `x_fallback`. A runtime that ignores x_* plays this.
 */
export function applyFallback(phase) {
  if (!phase || !phase.x_spring) return phase;
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
