// Generated from core/phase.ts by generate-skill.mjs.
import { displacement, settleMs, DEFAULT_REST_DELTA } from "./spring.js";
import { parseEasing, easeOutCubic, clamp01, ANTICIPATION_EASING } from "./easing.js";
export function hasSpring(phase) {
    return !!phase?.x_spring;
}
function windUp(phase) {
    const a = phase.x_anticipation;
    const amount = Math.max(0, Number(a?.amount) || 0);
    const ms = Math.max(0, Number(a?.duration_ms) || 0);
    return {
        amount,
        ms: amount > 0 ? ms : 0,
        ease: parseEasing(a?.easing || ANTICIPATION_EASING)
    };
}
export function springPhaseMs(phase) {
    const s = phase.x_spring;
    const { amount, ms } = windUp(phase);
    return ms + settleMs(s, -(1 + amount), s.velocity || 0, s.rest_delta ?? DEFAULT_REST_DELTA);
}
export function phaseMs(phase, mode = "spring") {
    if (mode === "spring" && hasSpring(phase)) return Math.max(springPhaseMs(phase), phase.x_opacity_duration_ms || 0);
    return phase.duration_ms;
}
export function progressAt(phase, ms, mode = "spring") {
    if (ms <= 0) return 0;
    if (mode === "spring" && hasSpring(phase)) {
        const s = phase.x_spring;
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
export function opacityProgressAt(phase, ms, mode = "spring") {
    if (ms <= 0) return 0;
    if (mode === "spring" && hasSpring(phase)) {
        const d = phase.x_opacity_duration_ms;
        if (d && d > 0) return easeOutCubic(clamp01(ms / d));
    }
    return clamp01(progressAt(phase, ms, mode));
}
export function sampleCurve(phase, n = 120, mode = "spring") {
    const total = phaseMs(phase, mode);
    const points = [];
    for(let i = 0; i <= n; i++){
        const x = i / n;
        points.push({
            x,
            y: progressAt(phase, x * total, mode)
        });
    }
    return {
        total,
        points
    };
}
