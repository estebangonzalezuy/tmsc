// Schema check for one spec. Shared by `validate:catalog` and the Lab's Save
// button, so the UI can't write a spec the CLI would reject.

import type { Phase, Spec } from "./types.ts";
import { isValidEasing } from "./easing.ts";
import { physicsHash } from "./fit.ts";

export const TARGETS = ["whole", "per-character", "per-word", "per-line"];
export const STAGGER_MODES = ["normal", "center-out", "edges-in", "reverse"];
export const SWAP_MODES = ["crossfade", "sequential", "morph"];
export const INTENTS = ["calm", "energetic", "heavy", "playful", "precise", "editorial"];
export const FRAME_KEYS = [
  "opacity", "x_px", "y_px", "z_px", "scale", "rotate_deg", "rotate_x_deg",
  "rotate_y_deg", "blur_px", "letter_spacing_em", "color", "x_font_weight",
];
const PHASE_KEYS = [
  "duration_ms", "stagger_ms", "easing", "from", "to", "x_spring", "x_anticipation",
  "x_opacity_duration_ms", "x_hold_ms", "x_hold_per_word_ms", "x_fallback", "x_css_linear",
];
const SPRING_KEYS = ["stiffness", "damping", "mass", "velocity", "rest_delta"];
const ANTIC_KEYS = ["amount", "duration_ms", "easing"];
const SPEC_KEYS = [
  "id", "display_name", "description", "inspiration", "target", "signature_easing",
  "enter", "exit", "swap", "usage_notes", "stagger_mode",
  "x_intent", "x_intent_notes", "x_variant_of", "x_exit_stagger_mode", "x_built_on",
];

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function checkFrame(where: string, f: unknown, errors: string[]) {
  if (!f || typeof f !== "object" || Array.isArray(f)) return void errors.push(`${where}: must be an object`);
  if (Object.keys(f).length === 0) errors.push(`${where}: empty frame`);
  for (const [k, v] of Object.entries(f)) {
    if (!FRAME_KEYS.includes(k)) errors.push(`${where}.${k}: unknown frame key (allowed: ${FRAME_KEYS.join(", ")})`);
    else if (k === "color") { if (typeof v !== "string") errors.push(`${where}.color: must be a string`); }
    else if (!isNum(v)) errors.push(`${where}.${k}: must be a number`);
    else if (k === "opacity" && (v < 0 || v > 1)) errors.push(`${where}.opacity: must be within 0–1`);
    else if (k === "x_font_weight" && (v < 1 || v > 1000)) errors.push(`${where}.x_font_weight: must be within 1–1000`);
  }
}

function checkPhase(where: string, p: Phase | undefined, errors: string[], strictFallback: boolean, isEnter: boolean) {
  if (!p || typeof p !== "object") return void errors.push(`${where}: missing`);
  for (const k of Object.keys(p)) if (!PHASE_KEYS.includes(k)) errors.push(`${where}.${k}: unknown field`);
  if (!isNum(p.duration_ms) || p.duration_ms <= 0) errors.push(`${where}.duration_ms: must be a number > 0`);
  if (!isNum(p.stagger_ms) || p.stagger_ms < 0) errors.push(`${where}.stagger_ms: must be a number ≥ 0`);
  if (!isValidEasing(p.easing)) errors.push(`${where}.easing: not a valid CSS easing ("${p.easing}")`);
  checkFrame(`${where}.from`, p.from, errors);
  checkFrame(`${where}.to`, p.to, errors);
  if (p.from && p.to) {
    const a = Object.keys(p.from).sort().join(), b = Object.keys(p.to).sort().join();
    if (a !== b) errors.push(`${where}: from and to must animate the same keys (${a} vs ${b})`);
  }
  if (p.x_spring) {
    const s = p.x_spring;
    for (const k of Object.keys(s)) if (!SPRING_KEYS.includes(k)) errors.push(`${where}.x_spring.${k}: unknown field`);
    if (!isNum(s.stiffness) || s.stiffness <= 0) errors.push(`${where}.x_spring.stiffness: must be > 0`);
    if (!isNum(s.damping) || s.damping <= 0) errors.push(`${where}.x_spring.damping: must be > 0 (0 never settles)`);
    if (!isNum(s.mass) || s.mass <= 0) errors.push(`${where}.x_spring.mass: must be > 0`);
    if (s.velocity != null && (!isNum(s.velocity) || Math.abs(s.velocity) > 100)) errors.push(`${where}.x_spring.velocity: must be within ±100 travel/s`);
    if (s.rest_delta != null && (!isNum(s.rest_delta) || s.rest_delta <= 0 || s.rest_delta > 0.1)) errors.push(`${where}.x_spring.rest_delta: must be within (0, 0.1]`);
    if (strictFallback) {
      if (!p.x_fallback) errors.push(`${where}.x_fallback: missing, run \`npm run fit:catalog\``);
      else if (p.x_fallback.fitted_from !== physicsHash(p)) errors.push(`${where}.x_fallback: stale (physics changed since the bezier was fitted), run \`npm run fit:catalog\``);
    }
  } else if (p.x_anticipation || p.x_opacity_duration_ms != null) {
    errors.push(`${where}: x_anticipation / x_opacity_duration_ms need x_spring`);
  }
  if (p.x_anticipation) {
    const a = p.x_anticipation;
    for (const k of Object.keys(a)) if (!ANTIC_KEYS.includes(k)) errors.push(`${where}.x_anticipation.${k}: unknown field`);
    if (!isNum(a.amount) || a.amount < 0 || a.amount > 0.6) errors.push(`${where}.x_anticipation.amount: must be within 0–0.6`);
    if (!isNum(a.duration_ms) || a.duration_ms < 0 || a.duration_ms > 1000) errors.push(`${where}.x_anticipation.duration_ms: must be within 0–1000`);
    if (a.easing != null && !isValidEasing(a.easing)) errors.push(`${where}.x_anticipation.easing: not a valid CSS easing`);
  }
  if (p.x_opacity_duration_ms != null && (!isNum(p.x_opacity_duration_ms) || p.x_opacity_duration_ms <= 0)) errors.push(`${where}.x_opacity_duration_ms: must be > 0`);
  for (const k of ["x_hold_ms", "x_hold_per_word_ms"] as const) {
    if (p[k] == null) continue;
    if (!isEnter) errors.push(`${where}.${k}: belongs in enter`);
    else if (!isNum(p[k]) || p[k]! < 0) errors.push(`${where}.${k}: must be a number ≥ 0`);
  }
}

/**
 * Validate one spec; returns error strings (empty = valid). strictFallback
 * (default) requires a fresh x_fallback on spring phases. The Lab turns it
 * off because it fits right before saving.
 */
export function validateSpec(spec: Spec, { fileId, strictFallback = true }: { fileId?: string; strictFallback?: boolean } = {}): string[] {
  const errors: string[] = [];
  if (!spec || typeof spec !== "object") return ["spec is not an object"];
  for (const k of Object.keys(spec)) {
    if (!SPEC_KEYS.includes(k)) errors.push(`${k}: unknown top-level field${k.startsWith("x_") ? "" : " (extensions must be prefixed x_ and documented in schema.md)"}`);
  }
  if (typeof spec.id !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(spec.id)) errors.push("id: must be kebab-case");
  if (fileId && spec.id !== fileId) errors.push(`id: "${spec.id}" does not match file name "${fileId}"`);
  for (const k of ["display_name", "description", "usage_notes", "signature_easing"] as const) {
    if (typeof spec[k] !== "string" || !spec[k].trim()) errors.push(`${k}: required string`);
  }
  if (!TARGETS.includes(spec.target)) errors.push(`target: must be one of ${TARGETS.join(", ")}`);
  if (spec.stagger_mode != null && !STAGGER_MODES.includes(spec.stagger_mode)) errors.push(`stagger_mode: must be one of ${STAGGER_MODES.join(", ")}`);
  if (spec.x_exit_stagger_mode != null && !STAGGER_MODES.includes(spec.x_exit_stagger_mode)) errors.push(`x_exit_stagger_mode: must be one of ${STAGGER_MODES.join(", ")}`);
  if (spec.signature_easing && !isValidEasing(spec.signature_easing)) errors.push("signature_easing: not a valid CSS easing");
  checkPhase("enter", spec.enter, errors, strictFallback, true);
  checkPhase("exit", spec.exit, errors, strictFallback, false);
  if (spec.swap) {
    if (!SWAP_MODES.includes(spec.swap.mode)) errors.push(`swap.mode: must be one of ${SWAP_MODES.join(", ")}`);
    for (const k of ["overlap_ms", "micro_delay_ms"] as const) {
      const v = spec.swap[k];
      if (v != null && (!isNum(v) || v < 0)) errors.push(`swap.${k}: must be a number ≥ 0`);
    }
  }
  if (spec.x_intent != null && !INTENTS.includes(spec.x_intent)) errors.push(`x_intent: must be one of ${INTENTS.join(", ")}`);
  if (spec.x_built_on !== "pixel-point/animate-text") errors.push(`x_built_on: must be "pixel-point/animate-text" (credit travels with the file)`);
  return errors;
}
