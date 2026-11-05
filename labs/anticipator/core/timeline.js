// Where every unit is at time t. Pure: (spec, layout, t) → states.
//
// A clip plays   enter → hold → exit.   Each unit starts its enter after its
// stagger rank, and its exit after the hold. There is no clock in here, so
// preview, scrubbing and export are the same call with a different t.

import { phaseMs, progressAt, opacityProgressAt } from "./phase.js";

/** The keys every frame understands, with their resting value. */
export const IDENTITY = {
  opacity: 1,
  x_px: 0,
  y_px: 0,
  z_px: 0,
  scale: 1,
  rotate_deg: 0,
  rotate_x_deg: 0,
  rotate_y_deg: 0,
  blur_px: 0,
  letter_spacing_em: 0,
};

/** px values in specs are authored for 48px type and scale with font size. */
export const REFERENCE_FONT_PX = 48;
const PX_KEYS = new Set(["x_px", "y_px", "z_px", "blur_px"]);

// ---------------------------------------------------------------- layout

/**
 * Split text into lines (explicit \n, then greedy wrap at maxWidth) and lay
 * out the units the spec animates. `measure(str)` returns a width in px.
 * Coordinates are relative to the block's centre; y is the baseline.
 */
export function layoutText({ text, target, measure, fontPx, maxWidth = Infinity, lineHeight = 1.0 }) {
  const lines = [];
  for (const para of String(text || "").split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = "";
    for (const w of words) {
      const next = cur ? cur + " " + w : w;
      if (cur && measure(next) > maxWidth) { lines.push(cur); cur = w; }
      else cur = next;
    }
    lines.push(cur);
  }
  const lh = fontPx * lineHeight;
  const blockH = lh * lines.length;
  const units = [];
  let wordIndex = 0;
  lines.forEach((line, li) => {
    const lineW = measure(line);
    const left = -lineW / 2;
    const baseline = -blockH / 2 + lh * li + lh * 0.78;
    if (target === "per-line" || target === "whole") {
      units.push({ text: line, x: left, y: baseline, w: lineW, line: li, word: wordIndex });
      wordIndex += line.split(" ").filter(Boolean).length;
      return;
    }
    if (target === "per-word") {
      let pos = 0;
      for (const word of line.split(" ")) {
        if (word) {
          const x = left + measure(line.slice(0, pos));
          units.push({ text: word, x, y: baseline, w: measure(word), line: li, word: wordIndex++ });
        }
        pos += word.length + 1;
      }
      return;
    }
    // per-character: position by prefix width so kerning survives.
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === " ") { wordIndex += 1; continue; }
      const x = left + measure(line.slice(0, i));
      units.push({ text: ch, x, y: baseline, w: measure(ch), line: li, word: wordIndex });
    }
    wordIndex += 1;
  });
  units.forEach((u, i) => (u.index = target === "whole" ? 0 : i));
  return { units, lines, height: blockH, wordCount: Math.max(1, wordIndex) };
}

// ---------------------------------------------------------------- stagger

/** Rank of unit i of n under a stagger mode (rank × stagger_ms = delay). */
export function staggerRank(i, n, mode = "normal") {
  const mid = (n - 1) / 2;
  const maxD = Math.floor(mid + 0.5);
  switch (mode) {
    case "reverse": return n - 1 - i;
    case "center-out": return Math.floor(Math.abs(i - mid) + 0.5) - (n % 2 === 0 ? 1 : 0);
    case "edges-in": return maxD - Math.floor(Math.abs(i - mid) + 0.5);
    default: return i;
  }
}

function maxRank(n, mode) {
  let m = 0;
  for (let i = 0; i < n; i++) m = Math.max(m, staggerRank(i, n, mode));
  return m;
}

// ---------------------------------------------------------------- timing

export function staggerOf(phase, overrides) {
  return overrides?.stagger_ms ?? phase.stagger_ms ?? 0;
}

/** How long the text must stay fully on screen to be read. */
export function holdFor(spec, wordCount) {
  const base = spec.x_hold_ms ?? 1200;
  const per = spec.x_hold_per_word_ms ?? 0;
  return base + per * wordCount;
}

/** Enter/exit totals for a clip with `n` animated units. */
export function clipTiming(spec, n, { mode = "spring", overrides } = {}) {
  const ranksIn = maxRank(n, spec.stagger_mode);
  const ranksOut = maxRank(n, spec.x_exit_stagger_mode || spec.stagger_mode);
  const enterUnit = phaseMs(spec.enter, mode);
  const exitUnit = spec.exit ? phaseMs(spec.exit, mode) : 0;
  return {
    enterUnit,
    exitUnit,
    enterTotal: ranksIn * staggerOf(spec.enter, overrides) + enterUnit,
    exitTotal: spec.exit ? ranksOut * (spec.exit.stagger_ms || 0) + exitUnit : 0,
  };
}

/** Natural length of a clip: enter + hold + exit. */
export function clipDuration(spec, n, wordCount, opts = {}) {
  const t = clipTiming(spec, n, opts);
  const hold = opts.holdMs ?? holdFor(spec, wordCount);
  return t.enterTotal + hold + t.exitTotal;
}

// ---------------------------------------------------------------- frames

function lerpFrame(from, to, p, op, mode, scalePx) {
  const out = {};
  const keys = new Set([...Object.keys(from || {}), ...Object.keys(to || {})]);
  for (const k of keys) {
    if (mode === "bezier" && k.startsWith("x_")) continue;
    if (k === "color") { out.color = p >= 1 ? to?.color : from?.color; continue; }
    const a = from?.[k] ?? IDENTITY[k] ?? 0;
    const b = to?.[k] ?? IDENTITY[k] ?? 0;
    const pp = k === "opacity" ? op : p;
    let v = a + (b - a) * pp;
    if (PX_KEYS.has(k)) v *= scalePx;
    if (k === "opacity") v = Math.min(1, Math.max(0, v));
    if (k === "blur_px" || k === "scale") v = Math.max(0, v);
    out[k] = v;
  }
  return out;
}

/**
 * State of every unit at clip-local time tMs.
 * Returns [{ unit, props }], props being frame keys (opacity, y_px, …).
 */
export function unitStates(spec, layout, tMs, { mode = "spring", overrides, holdMs, fontPx = REFERENCE_FONT_PX, exit = true } = {}) {
  const enter = spec.enter;
  const units = layout.units;
  const n = target(spec) === "whole" ? 1 : units.length;
  const timing = clipTiming(spec, n, { mode, overrides });
  const hold = holdMs ?? holdFor(spec, layout.wordCount);
  const exitStart = timing.enterTotal + hold;
  const sIn = staggerOf(enter, overrides);
  const sOut = spec.exit?.stagger_ms || 0;
  const scalePx = fontPx / REFERENCE_FONT_PX;
  return units.map((u) => {
    const i = u.index;
    const ue = tMs - staggerRank(i, n, spec.stagger_mode) * sIn;
    let props;
    if (exit && spec.exit && tMs >= exitStart) {
      const ux = tMs - exitStart - staggerRank(i, n, spec.x_exit_stagger_mode || spec.stagger_mode) * sOut;
      props = lerpFrame(spec.exit.from, spec.exit.to, progressAt(spec.exit, ux, mode), opacityProgressAt(spec.exit, ux, mode), mode, scalePx);
    } else {
      props = lerpFrame(enter.from, enter.to, progressAt(enter, ue, mode), opacityProgressAt(enter, ue, mode), mode, scalePx);
    }
    return { unit: u, props };
  });
}

function target(spec) {
  return spec.target || "per-word";
}

/** Merge per-clip overrides (stagger, spring) into a spec, without mutating it. */
export function withOverrides(spec, overrides) {
  if (!overrides) return spec;
  const enter = { ...spec.enter };
  if (overrides.stagger_ms != null) enter.stagger_ms = overrides.stagger_ms;
  if (overrides.x_spring && enter.x_spring) enter.x_spring = { ...enter.x_spring, ...overrides.x_spring };
  if (overrides.x_anticipation && enter.x_anticipation) enter.x_anticipation = { ...enter.x_anticipation, ...overrides.x_anticipation };
  return { ...spec, enter };
}
