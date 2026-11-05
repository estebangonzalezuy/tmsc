// Real damped spring, closed form. No integrator, no frame-rate dependence:
// displacement at time t is a pure function of t, so preview, export and the
// bezier fit all read the exact same curve.
//
//   m·x'' + c·x' + k·(x − target) = 0
//   ω0 = √(k/m)      ζ = c / (2·√(k·m))
//
// Everything here works in "travel" units: 0 is `from`, 1 is `to`.

export const DEFAULT_REST_DELTA = 0.001;

export function springParams({ stiffness = 170, damping = 26, mass = 1 } = {}) {
  const k = Math.max(1e-6, stiffness);
  const c = Math.max(0, damping);
  const m = Math.max(1e-6, mass);
  const w0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  return { k, c, m, w0, zeta };
}

/** Damping ratio ζ. <1 overshoots, =1 critical, >1 creeps. */
export function zetaOf(spring) {
  return springParams(spring).zeta;
}

/**
 * Displacement from the target after `t` seconds, given an initial
 * displacement d0 (position − target) and initial velocity v0 (units/s).
 */
export function displacement(spring, t, d0, v0 = 0) {
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

/**
 * Time in ms after which the spring stays within `restDelta` of its target
 * (as a fraction of |d0|). Sampled at 1 ms up to 12 s, so it is exact to the
 * millisecond and deterministic.
 */
export function settleMs(spring, d0 = -1, v0 = 0, restDelta = DEFAULT_REST_DELTA) {
  const tol = Math.abs(d0 || 1) * restDelta;
  let last = 0;
  for (let ms = 0; ms <= 12000; ms++) {
    if (Math.abs(displacement(spring, ms / 1000, d0, v0)) > tol) last = ms;
  }
  return last + 1;
}

/** Largest overshoot past the target, as a fraction of travel (0 when ζ ≥ 1). */
export function overshoot(spring, d0 = -1, v0 = 0) {
  let peak = 0;
  for (let ms = 0; ms <= 4000; ms += 2) {
    const d = displacement(spring, ms / 1000, d0, v0);
    if (Math.sign(d) !== Math.sign(d0) && Math.abs(d) > peak) peak = Math.abs(d);
  }
  return peak / Math.abs(d0 || 1);
}

/** Describe a spring the way a motion designer would read it. */
export function springCharacter(spring) {
  const z = zetaOf(spring);
  if (z < 0.35) return "bouncy";
  if (z < 0.65) return "lively";
  if (z < 0.95) return "firm";
  if (z <= 1.05) return "critical";
  return "soft";
}
