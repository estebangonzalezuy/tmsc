// Where every unit is at time t. Pure: (spec, layout, t) → states.
// A clip plays  enter → hold → exit. No clock in here, so preview, scrubbing
// and export are the same call with a different t: renderAt(ms).

import type { ClipOverrides, Frame, Mode, Phase, Spec, StaggerMode, Target } from "./types.ts";
import { phaseMs, progressAt, opacityProgressAt } from "./phase.ts";

export const IDENTITY: Record<string, number> = {
  opacity: 1, x_px: 0, y_px: 0, z_px: 0, scale: 1, rotate_deg: 0,
  rotate_x_deg: 0, rotate_y_deg: 0, blur_px: 0, letter_spacing_em: 0,
};

/** px values in specs are authored for 48px type and scale with font size. */
export const REFERENCE_FONT_PX = 48;
const PX_KEYS = new Set(["x_px", "y_px", "z_px", "blur_px"]);

export type Unit = { text: string; x: number; y: number; w: number; line: number; word: number; index: number };
export type Layout = { units: Unit[]; lines: string[]; height: number; wordCount: number; family?: string; variable?: boolean };
export type Props = Frame & Record<string, number | string | undefined>;

// ---------------------------------------------------------------- layout

/**
 * Lines (explicit \n, then greedy wrap at maxWidth) and the units the spec
 * animates. Coordinates are relative to the block's centre; y is the baseline.
 */
export function layoutText({ text, target, measure, fontPx, maxWidth = Infinity, lineHeight = 1.0 }: {
  text: string; target: Target; measure: (s: string) => number; fontPx: number; maxWidth?: number; lineHeight?: number;
}): Layout {
  const lines: string[] = [];
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
  const units: Unit[] = [];
  let wordIndex = 0;
  const push = (u: Omit<Unit, "index">) => units.push({ ...u, index: 0 });
  lines.forEach((line, li) => {
    const lineW = measure(line);
    const left = -lineW / 2;
    const baseline = -blockH / 2 + lh * li + lh * 0.78;
    if (target === "per-line" || target === "whole") {
      push({ text: line, x: left, y: baseline, w: lineW, line: li, word: wordIndex });
      wordIndex += line.split(" ").filter(Boolean).length;
      return;
    }
    if (target === "per-word") {
      let pos = 0;
      for (const word of line.split(" ")) {
        if (word) push({ text: word, x: left + measure(line.slice(0, pos)), y: baseline, w: measure(word), line: li, word: wordIndex++ });
        pos += word.length + 1;
      }
      return;
    }
    // per-character: position by prefix width so kerning survives.
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === " ") { wordIndex += 1; continue; }
      push({ text: ch, x: left + measure(line.slice(0, i)), y: baseline, w: measure(ch), line: li, word: wordIndex });
    }
    wordIndex += 1;
  });
  units.forEach((u, i) => (u.index = target === "whole" ? 0 : i));
  return { units, lines, height: blockH, wordCount: Math.max(1, wordIndex) };
}

// ---------------------------------------------------------------- stagger

/** Rank of unit i of n under a stagger mode (rank × stagger_ms = delay). */
export function staggerRank(i: number, n: number, mode: StaggerMode = "normal"): number {
  const mid = (n - 1) / 2;
  const maxD = Math.floor(mid + 0.5);
  switch (mode) {
    case "reverse": return n - 1 - i;
    case "center-out": return Math.floor(Math.abs(i - mid) + 0.5) - (n % 2 === 0 ? 1 : 0);
    case "edges-in": return maxD - Math.floor(Math.abs(i - mid) + 0.5);
    default: return i;
  }
}

function maxRank(n: number, mode?: StaggerMode): number {
  let m = 0;
  for (let i = 0; i < n; i++) m = Math.max(m, staggerRank(i, n, mode));
  return m;
}

// ---------------------------------------------------------------- timing

export function staggerOf(phase: Phase, overrides?: ClipOverrides): number {
  return overrides?.stagger_ms ?? phase.stagger_ms ?? 0;
}

/** How long fully-entered text stays up to be read: enter.x_hold_ms (+ per word). */
export function holdFor(spec: Spec, wordCount: number): number {
  return (spec.enter.x_hold_ms ?? 1200) + (spec.enter.x_hold_per_word_ms ?? 0) * wordCount;
}

export type Timing = { enterUnit: number; exitUnit: number; enterTotal: number; exitTotal: number };

/** Enter/exit totals for a clip with n animated units. */
export function clipTiming(spec: Spec, n: number, { mode = "spring", overrides }: { mode?: Mode; overrides?: ClipOverrides } = {}): Timing {
  const enterUnit = phaseMs(spec.enter, mode);
  const exitUnit = spec.exit ? phaseMs(spec.exit, mode) : 0;
  return {
    enterUnit,
    exitUnit,
    enterTotal: maxRank(n, spec.stagger_mode) * staggerOf(spec.enter, overrides) + enterUnit,
    exitTotal: spec.exit ? maxRank(n, spec.x_exit_stagger_mode || spec.stagger_mode) * (spec.exit.stagger_ms || 0) + exitUnit : 0,
  };
}

// ---------------------------------------------------------------- frames

function lerpFrame(from: Frame, to: Frame, p: number, op: number, mode: Mode, scalePx: number): Props {
  const out: Props = {};
  const keys = new Set([...Object.keys(from || {}), ...Object.keys(to || {})]);
  const f = from as Record<string, number | string | undefined>;
  const t = to as Record<string, number | string | undefined>;
  for (const k of keys) {
    if (mode === "bezier" && k.startsWith("x_")) continue;
    if (k === "color") { out.color = p >= 1 ? to?.color : from?.color; continue; }
    const a = Number(f?.[k] ?? IDENTITY[k] ?? 0);
    const b = Number(t?.[k] ?? IDENTITY[k] ?? 0);
    let v = a + (b - a) * (k === "opacity" ? op : p);
    if (PX_KEYS.has(k)) v *= scalePx;
    if (k === "opacity") v = Math.min(1, Math.max(0, v));
    if (k === "blur_px" || k === "scale") v = Math.max(0, v);
    out[k] = v;
  }
  return out;
}

export type StateOpts = { mode?: Mode; overrides?: ClipOverrides; holdMs?: number; fontPx?: number; exit?: boolean };

/** State of every unit at clip-local time tMs. */
export function unitStates(spec: Spec, layout: Layout, tMs: number, { mode = "spring", overrides, holdMs, fontPx = REFERENCE_FONT_PX, exit = true }: StateOpts = {}) {
  const enter = spec.enter;
  const n = spec.target === "whole" ? 1 : layout.units.length;
  const timing = clipTiming(spec, n, { mode, overrides });
  const exitStart = timing.enterTotal + (holdMs ?? holdFor(spec, layout.wordCount));
  const sIn = staggerOf(enter, overrides);
  const sOut = spec.exit?.stagger_ms || 0;
  const scalePx = fontPx / REFERENCE_FONT_PX;
  return layout.units.map((unit) => {
    const ue = tMs - staggerRank(unit.index, n, spec.stagger_mode) * sIn;
    let props: Props;
    if (exit && spec.exit && tMs >= exitStart) {
      const ux = tMs - exitStart - staggerRank(unit.index, n, spec.x_exit_stagger_mode || spec.stagger_mode) * sOut;
      props = lerpFrame(spec.exit.from, spec.exit.to, progressAt(spec.exit, ux, mode), opacityProgressAt(spec.exit, ux, mode), mode, scalePx);
    } else {
      props = lerpFrame(enter.from, enter.to, progressAt(enter, ue, mode), opacityProgressAt(enter, ue, mode), mode, scalePx);
    }
    return { unit, props };
  });
}

/** Merge per-clip overrides into a spec without mutating it. */
export function withOverrides(spec: Spec, overrides?: ClipOverrides): Spec {
  if (!overrides) return spec;
  const enter: Phase = { ...spec.enter };
  if (overrides.stagger_ms != null) enter.stagger_ms = overrides.stagger_ms;
  // A bezier override plays the spec like a plain animate-text runtime with a
  // different curve: used for side-by-side references.
  if (overrides.easing) enter.easing = overrides.easing;
  if (overrides.duration_ms != null) enter.duration_ms = overrides.duration_ms;
  if (overrides.x_spring && enter.x_spring) enter.x_spring = { ...enter.x_spring, ...overrides.x_spring };
  if (overrides.x_anticipation && enter.x_anticipation) enter.x_anticipation = { ...enter.x_anticipation, ...overrides.x_anticipation };
  return { ...spec, enter };
}
