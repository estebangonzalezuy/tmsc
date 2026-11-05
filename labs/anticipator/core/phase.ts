// One phase (enter or exit) of one unit, as a progress curve.
//
// Progress is in travel units: 0 = `from`, 1 = `to`. A spring phase dips
// below 0 (anticipation) and overshoots above 1. Two readings of one spec:
//   "bezier": a plain animate-text runtime. Ignores x_*, plays `easing` over `duration_ms`.
//   "spring": ours. x_anticipation eases progress to −amount, then x_spring
//             (F = −k(x−1) − c·v, a = F/m) releases from there with
//             x_spring.velocity, and opacity runs on x_opacity_duration_ms.

import type { Mode, Phase } from "./types.ts";
import { displacement, settleMs, DEFAULT_REST_DELTA } from "./spring.ts";
import { parseEasing, easeOutCubic, clamp01, ANTICIPATION_EASING } from "./easing.ts";

export function hasSpring(phase: Phase | undefined): boolean {
  return !!phase?.x_spring;
}

function windUp(phase: Phase) {
  const a = phase.x_anticipation;
  const amount = Math.max(0, Number(a?.amount) || 0);
  const ms = Math.max(0, Number(a?.duration_ms) || 0);
  return { amount, ms: amount > 0 ? ms : 0, ease: parseEasing(a?.easing || ANTICIPATION_EASING) };
}

/** Full length in ms of one unit's spring phase: wind-up + settle. */
export function springPhaseMs(phase: Phase): number {
  const s = phase.x_spring!;
  const { amount, ms } = windUp(phase);
  return ms + settleMs(s, -(1 + amount), s.velocity || 0, s.rest_delta ?? DEFAULT_REST_DELTA);
}

/** Length in ms of one unit's phase in a mode. */
export function phaseMs(phase: Phase, mode: Mode = "spring"): number {
  if (mode === "spring" && hasSpring(phase)) return Math.max(springPhaseMs(phase), phase.x_opacity_duration_ms || 0);
  return phase.duration_ms;
}

/** (ms since this unit's phase started) → travel. 0 before, exactly 1 after the end. */
export function progressAt(phase: Phase, ms: number, mode: Mode = "spring"): number {
  if (ms <= 0) return 0;
  if (mode === "spring" && hasSpring(phase)) {
    const s = phase.x_spring!;
    const w = windUp(phase);
    if (w.ms > 0 && ms < w.ms) return -w.amount * w.ease(ms / w.ms);
    if (ms >= springPhaseMs(phase)) return 1;
    const t = (ms - w.ms) / 1000;
    return 1 + displacement(s, t, -w.amount - 1, s.velocity || 0);
  }
  const d = Math.max(1, phase.duration_ms);
  if (ms >= d) return 1;
  return parseEasing(phase.easing)(ms / d);
}

/** Opacity progress 0–1. Opacity never springs: it runs on its own ease-out clock. */
export function opacityProgressAt(phase: Phase, ms: number, mode: Mode = "spring"): number {
  if (ms <= 0) return 0;
  if (mode === "spring" && hasSpring(phase)) {
    const d = phase.x_opacity_duration_ms;
    if (d && d > 0) return easeOutCubic(clamp01(ms / d));
  }
  return clamp01(progressAt(phase, ms, mode));
}

/** Sample a phase's progress over its own normalized duration. */
export function sampleCurve(phase: Phase, n = 120, mode: Mode = "spring") {
  const total = phaseMs(phase, mode);
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    points.push({ x, y: progressAt(phase, x * total, mode) });
  }
  return { total, points };
}
