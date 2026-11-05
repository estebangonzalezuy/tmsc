// Field order in written files: the compatible core first, extensions after,
// so a spec reads like an animate-text spec with notes in the margin.
const SPEC_ORDER = [
  "id", "display_name", "description", "inspiration", "target", "signature_easing",
  "stagger_mode", "enter", "exit", "swap", "usage_notes",
  "x_intent", "x_intent_notes", "x_variant_of", "x_hold_ms", "x_hold_per_word_ms",
  "x_exit_stagger_mode", "x_built_on",
];
const PHASE_ORDER = [
  "duration_ms", "stagger_ms", "easing", "from", "to",
  "x_spring", "x_anticipation", "x_opacity_duration_ms", "x_fallback", "x_css_linear",
];

function ordered(obj, order) {
  const out = {};
  for (const k of order) if (obj[k] !== undefined) out[k] = obj[k];
  for (const k of Object.keys(obj)) if (!(k in out)) out[k] = obj[k];
  return out;
}

/** Canonical key order, so writes are stable and diffs stay small. */
export function canonicalSpec(spec) {
  const s = ordered(spec, SPEC_ORDER);
  if (s.enter) s.enter = ordered(s.enter, PHASE_ORDER);
  if (s.exit) s.exit = ordered(s.exit, PHASE_ORDER);
  return s;
}

