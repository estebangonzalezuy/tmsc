// Field order in written files: the compatible core first, extensions after,
// so a spec reads like an animate-text spec with notes in the margin.

import type { Spec } from "./types.ts";

const SPEC_ORDER = [
  "id", "display_name", "description", "inspiration", "target", "signature_easing",
  "stagger_mode", "enter", "exit", "swap", "usage_notes",
  "x_intent", "x_intent_notes", "x_variant_of", "x_exit_stagger_mode", "x_built_on",
];
const PHASE_ORDER = [
  "duration_ms", "stagger_ms", "easing", "from", "to",
  "x_spring", "x_anticipation", "x_opacity_duration_ms", "x_hold_ms", "x_hold_per_word_ms", "x_fallback", "x_css_linear",
];
const SPRING_ORDER = ["stiffness", "damping", "mass", "velocity", "rest_delta"];
const ANTIC_ORDER = ["duration_ms", "amount", "easing"];

function ordered<T extends object>(obj: T, order: string[]): T {
  const src = obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of order) if (src[k] !== undefined) out[k] = src[k];
  for (const k of Object.keys(src)) if (!(k in out)) out[k] = src[k];
  return out as T;
}

/** Canonical key order, so writes are stable and diffs stay small. */
export function canonicalSpec(spec: Spec): Spec {
  const s = ordered(spec, SPEC_ORDER);
  for (const key of ["enter", "exit"] as const) {
    if (!s[key]) continue;
    const p = ordered(s[key], PHASE_ORDER);
    if (p.x_spring) p.x_spring = ordered(p.x_spring, SPRING_ORDER);
    if (p.x_anticipation) p.x_anticipation = ordered(p.x_anticipation, ANTIC_ORDER);
    s[key] = p;
  }
  return s;
}
