// One phase (enter or exit) of one animated unit, as a progress curve.
//
// Progress is in travel units: 0 = `from`, 1 = `to`. A spring phase can go
// below 0 (anticipation, the wind-up away from the target) and above 1
// (overshoot). A bezier phase goes wherever its cubic-bezier goes.
//
// Two ways to read the same spec:
//   mode "bezier": what a plain animate-text runtime does. It ignores every
//                  x_* field and plays `easing` over `duration_ms`.
//   mode "spring": ours. It plays x_anticipation, then x_spring, and runs
//                  opacity on its own clock (x_opacity_duration_ms).

import { displacement, settleMs, DEFAULT_REST_DELTA } from "./spring.js";
import { parseEasing, easeInOutSine, easeOutCubic, clamp01 } from "./easing.js";

export function hasSpring(phase) {
  return !!(phase && phase.x_spring);
}

function anticipationOf(phase) {
  const a = phase.x_anticipation || {};
  return {
    amount: Math.max(0, Number(a.amount) || 0),
    ms: Math.max(0, Number(a.duration_ms) || 0),
  };
}

/** Full length in ms of one unit's spring phase: wind-up + settle. */
export function springPhaseMs(phase) {
  const { amount, ms } = anticipationOf(phase);
  const rest = phase.x_spring.rest_delta ?? DEFAULT_REST_DELTA;
  return (amount > 0 ? ms : 0) + settleMs(phase.x_spring, -(1 + amount), 0, rest);
}

/** Length in ms of one unit's phase in the given mode. */
export function phaseMs(phase, mode = "spring") {
  if (mode === "spring" && hasSpring(phase)) {
    return Math.max(springPhaseMs(phase), phase.x_opacity_duration_ms || 0);
  }
  return phase.duration_ms;
}

/**
 * Progress curve of a phase: (ms since this unit's phase started) → travel.
 * Before 0 it is 0; after the end it is exactly 1.
 */
export function progressAt(phase, ms, mode = "spring") {
  if (ms <= 0) return 0;
  if (mode === "spring" && hasSpring(phase)) {
    const { amount, ms: aMs } = anticipationOf(phase);
    const windUp = amount > 0 && aMs > 0;
    if (windUp && ms < aMs) return -amount * easeInOutSine(ms / aMs);
    const t = (ms - (windUp ? aMs : 0)) / 1000;
    const start = windUp ? -amount : 0;
    const total = springPhaseMs(phase);
    if (ms >= total) return 1;
    return 1 + displacement(phase.x_spring, t, start - 1, 0);
  }
  const d = Math.max(1, phase.duration_ms);
  if (ms >= d) return 1;
  return parseEasing(phase.easing)(ms / d);
}

/**
 * Opacity progress (0–1) of a phase. In spring mode opacity never springs.
 * Overshooting alpha means nothing, so it runs on its own short clock and
 * the anticipation stays visible. In bezier mode it shares the curve,
 * clamped.
 */
export function opacityProgressAt(phase, ms, mode = "spring") {
  if (ms <= 0) return 0;
  if (mode === "spring" && hasSpring(phase)) {
    const d = phase.x_opacity_duration_ms;
    if (d && d > 0) return easeOutCubic(clamp01(ms / d));
    return clamp01(progressAt(phase, ms, mode));
  }
  return clamp01(progressAt(phase, ms, "bezier"));
}

/** Sample a phase's progress curve over its own normalized duration. */
export function sampleCurve(phase, n = 120, mode = "spring") {
  const total = phaseMs(phase, mode);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    out.push({ x, y: progressAt(phase, x * total, mode) });
  }
  return { total, points: out };
}
