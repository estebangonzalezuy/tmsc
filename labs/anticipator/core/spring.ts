// A real damped spring:  m·x'' = −k·(x − 1) − c·x'
//
// Solved in closed form instead of stepped. The closed form *is* the exact
// integral of that ODE (core/spring.test.ts checks it against a 0.1ms
// semi-implicit Euler integration), and it makes the position at time t a
// pure function of t. Preview, scrubbing, export and the bezier fit all read
// the same curve with no frame-rate drift.
//
//   ω0 = √(k/m)      ζ = c / (2·√(k·m))
//
// Everything is in travel units: 0 is `from`, 1 is `to`.

import type { SpringConfig } from "./types.ts";

export const DEFAULT_REST_DELTA = 0.001;

export function springParams({ stiffness = 170, damping = 26, mass = 1 }: Partial<SpringConfig> = {}) {
  const k = Math.max(1e-6, stiffness);
  const c = Math.max(0, damping);
  const m = Math.max(1e-6, mass);
  const w0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  return { k, c, m, w0, zeta };
}

/** Damping ratio ζ: < 1 bounces, = 1 critical, > 1 slow. */
export function zetaOf(spring: Partial<SpringConfig>): number {
  return springParams(spring).zeta;
}

/**
 * Displacement from the target after `t` seconds, from an initial
 * displacement d0 (position − target) and initial velocity v0 (units/s).
 */
export function displacement(spring: Partial<SpringConfig>, t: number, d0: number, v0 = 0): number {
  const { w0, zeta } = springParams(spring);
  if (t <= 0) return d0;
  if (zeta < 1 - 1e-9) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const env = Math.exp(-zeta * w0 * t);
    return env * (d0 * Math.cos(wd * t) + ((v0 + zeta * w0 * d0) / wd) * Math.sin(wd * t));
  }
  if (zeta <= 1 + 1e-9) {
    return Math.exp(-w0 * t) * (d0 + (v0 + w0 * d0) * t);
  }
  const s = Math.sqrt(zeta * zeta - 1);
  const r1 = -w0 * (zeta - s);
  const r2 = -w0 * (zeta + s);
  const A = (v0 - r2 * d0) / (r1 - r2);
  const B = d0 - A;
  return A * Math.exp(r1 * t) + B * Math.exp(r2 * t);
}

/** The same spring, stepped (semi-implicit Euler). Used only to verify the closed form. */
export function integrate(spring: Partial<SpringConfig>, tEnd: number, d0: number, v0 = 0, dt = 1e-4): number {
  const { k, c, m } = springParams(spring);
  let x = d0, v = v0;
  for (let t = 0; t < tEnd - 1e-12; t += dt) {
    const a = (-k * x - c * v) / m;
    v += a * dt;
    x += v * dt;
  }
  return x;
}

/**
 * Time in ms after which the spring stays within restDelta·|d0| of its
 * target. Sampled every 1ms up to 12s: exact to the millisecond and deterministic.
 */
export function settleMs(spring: Partial<SpringConfig>, d0 = -1, v0 = 0, restDelta = DEFAULT_REST_DELTA): number {
  const tol = Math.abs(d0 || 1) * restDelta;
  let last = 0;
  for (let ms = 0; ms <= 12000; ms++) {
    if (Math.abs(displacement(spring, ms / 1000, d0, v0)) > tol) last = ms;
  }
  return last + 1;
}

/** Largest overshoot past the target, as a fraction of |d0| (0 when ζ ≥ 1 and v0 = 0). */
export function overshoot(spring: Partial<SpringConfig>, d0 = -1, v0 = 0): number {
  let peak = 0;
  for (let ms = 0; ms <= 4000; ms += 2) {
    const d = displacement(spring, ms / 1000, d0, v0);
    if (Math.sign(d) !== Math.sign(d0) && Math.abs(d) > peak) peak = Math.abs(d);
  }
  return peak / Math.abs(d0 || 1);
}

/** How a motion designer would describe it: rebota / crítico / lento. */
export function springCharacter(spring: Partial<SpringConfig>): string {
  const z = zetaOf(spring);
  if (z < 0.35) return "bouncy";
  if (z < 0.65) return "lively";
  if (z < 0.95) return "firm";
  if (z <= 1.05) return "critical";
  return "slow";
}
