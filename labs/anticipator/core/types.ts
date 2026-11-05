// The spec shape: Pixel Point animate-text's portable spec, plus optional x_* fields.

export type Target = "whole" | "per-character" | "per-word" | "per-line";
export type StaggerMode = "normal" | "center-out" | "edges-in" | "reverse";
export type Mode = "spring" | "bezier";

export type Frame = {
  opacity?: number;
  x_px?: number;
  y_px?: number;
  z_px?: number;
  scale?: number;
  rotate_deg?: number;
  rotate_x_deg?: number;
  rotate_y_deg?: number;
  blur_px?: number;
  letter_spacing_em?: number;
  color?: string;
  x_font_weight?: number;
};

export type SpringConfig = {
  stiffness: number;
  damping: number;
  mass: number;
  /** Initial velocity in travel units per second (positive = toward `to`). */
  velocity?: number;
  /** Settle tolerance, as a fraction of travel. */
  rest_delta?: number;
};

export type Anticipation = {
  /** Wind-up away from the target, as a fraction of travel. */
  amount: number;
  duration_ms: number;
  /** Easing of the wind-up. Defaults to cubic-bezier(0.45, 0, 0.55, 1). */
  easing?: string;
};

export type Fallback = {
  fitted_from: string;
  rms_error: number;
  max_error: number;
  spring_phase_ms: number;
};

export type Phase = {
  duration_ms: number;
  stagger_ms: number;
  easing: string;
  from: Frame;
  to: Frame;
  x_spring?: SpringConfig;
  x_anticipation?: Anticipation;
  x_opacity_duration_ms?: number;
  /** Time the fully-entered text stays before exit (enter only). */
  x_hold_ms?: number;
  /** Added to the hold per word (enter only). */
  x_hold_per_word_ms?: number;
  x_fallback?: Fallback;
  x_css_linear?: string;
};

export type Swap = {
  mode: "crossfade" | "sequential" | "morph";
  overlap_ms?: number;
  micro_delay_ms?: number;
};

export type Spec = {
  id: string;
  display_name: string;
  description: string;
  inspiration?: string;
  target: Target;
  signature_easing: string;
  stagger_mode?: StaggerMode;
  enter: Phase;
  exit: Phase;
  swap?: Swap;
  usage_notes: string;
  x_intent?: string;
  x_intent_notes?: string;
  x_variant_of?: string;
  x_exit_stagger_mode?: StaggerMode;
  x_built_on: "pixel-point/animate-text";
};

export type Catalog = {
  visible_ids: string[];
  groups?: Record<string, string[]>;
};

export type ClipOverrides = {
  stagger_ms?: number;
  x_spring?: Partial<SpringConfig>;
  x_anticipation?: Partial<Anticipation>;
  easing?: string;
  duration_ms?: number;
};

export type Clip = {
  id: string;
  specId?: string;
  text: string;
  ink?: string;
  at_ms: number;
  duration_ms: number;
  fontPx?: number;
  weight?: number;
  /** Centre, as a fraction of the frame. */
  x?: number;
  y?: number;
  /** Max line width, as a fraction of the frame width. */
  w?: number;
  mode?: Mode;
  overrides?: ClipOverrides;
  /** A label: drawn as plain type, no animation. */
  static?: boolean;
};

export type Guide = { x1: number; y1: number; x2: number; y2: number; ink?: string; width?: number };

export type Project = {
  name: string;
  description?: string;
  width: number;
  height: number;
  fps?: number;
  background?: string;
  guides?: Guide[];
  clips: Clip[];
};

export type Specs = Record<string, Spec>;
