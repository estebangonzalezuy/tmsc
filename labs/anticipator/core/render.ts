// Canvas 2D renderer: the one draw path. The Lab, the Editor preview and every
// exported frame call renderClip / renderAt. No DOM at module load, so node
// scripts can import the helpers beside it.

import type { Clip, ClipOverrides, Mode, Project, Spec, Specs } from "./types.ts";
import { layoutText, unitStates, withOverrides, clipTiming, holdFor, type Layout } from "./timeline.ts";

export const FONT_NARROW = "Archivo Narrow";
export const FONT_VARIABLE = "Archivo";

type Ctx = CanvasRenderingContext2D;

/** Does this spec animate the variable weight axis? */
export function usesWeight(spec: Spec): boolean {
  return [spec.enter?.from, spec.enter?.to, spec.exit?.from, spec.exit?.to].some((f) => f && "x_font_weight" in f);
}

const fontString = (weight: number, px: number, family: string) => `${Math.round(weight)} ${px}px "${family}"`;

function condensed(ctx: Ctx) {
  if ("fontStretch" in ctx) (ctx as Ctx & { fontStretch: string }).fontStretch = "condensed";
}

const layoutCache = new Map<string, Layout>();

export function clipLayout(ctx: Ctx, { spec, text, fontPx, maxWidth, weight = 700 }: { spec: Spec; text: string; fontPx: number; maxWidth: number; weight?: number }): Layout {
  const variable = usesWeight(spec);
  const family = variable ? FONT_VARIABLE : FONT_NARROW;
  const w = variable ? (spec.enter.to.x_font_weight ?? weight) : weight;
  const key = [spec.target, text, fontPx, maxWidth, w, family].join("|");
  const hit = layoutCache.get(key);
  if (hit) return hit;
  ctx.save();
  ctx.font = fontString(w, fontPx, family);
  if (variable) condensed(ctx);
  const layout = layoutText({ text, target: spec.target, fontPx, maxWidth, lineHeight: 1.02, measure: (s) => ctx.measureText(s).width });
  ctx.restore();
  layout.family = family;
  layout.variable = variable;
  if (layoutCache.size > 400) layoutCache.clear();
  layoutCache.set(key, layout);
  return layout;
}

export type ClipOpts = {
  spec: Spec;
  text: string;
  ink?: string;
  fontPx?: number;
  maxWidth?: number;
  mode?: Mode;
  overrides?: ClipOverrides;
  holdMs?: number;
  exit?: boolean;
  weight?: number;
};

/** Draw one text clip at clip-local time tMs, centred on (cx, cy). */
export function renderClip(ctx: Ctx, tMs: number, cx: number, cy: number, opts: ClipOpts) {
  const spec = withOverrides(opts.spec, opts.overrides);
  const fontPx = opts.fontPx || 96;
  const weight = opts.weight || 700;
  const layout = clipLayout(ctx, { spec, text: opts.text, fontPx, maxWidth: opts.maxWidth || Infinity, weight });
  const states = unitStates(spec, layout, tMs, { mode: opts.mode || "spring", overrides: opts.overrides, holdMs: opts.holdMs, fontPx, exit: opts.exit !== false });
  const xh = fontPx * 0.36; // transform origin: middle of the x-height
  for (const { unit, props } of states) {
    const a = Number(props.opacity ?? 1);
    if (a <= 0.001) continue;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.font = fontString(Number(props.x_font_weight ?? weight), fontPx, layout.family!);
    if (layout.variable) condensed(ctx);
    ctx.fillStyle = (props.color as string) || opts.ink || "#0C0C0C";
    const blur = Number(props.blur_px || 0);
    if (blur > 0.05) ctx.filter = `blur(${blur.toFixed(2)}px)`;
    ctx.translate(cx + unit.x + unit.w / 2 + Number(props.x_px || 0), cy + unit.y - xh + Number(props.y_px || 0));
    if (props.rotate_deg) ctx.rotate((Number(props.rotate_deg) * Math.PI) / 180);
    const s = Number(props.scale ?? 1);
    // rotate_x/rotate_y have no real 3D in 2D canvas: foreshorten instead.
    const sx = s * Math.cos((Number(props.rotate_y_deg || 0) * Math.PI) / 180);
    const sy = s * Math.cos((Number(props.rotate_x_deg || 0) * Math.PI) / 180);
    if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillText(unit.text, -unit.w / 2, xh);
    ctx.restore();
  }
  return { layout, states };
}

/** Natural length (ms) of a spec on this text: enter + hold + exit. */
export function naturalClipMs(ctx: Ctx, opts: ClipOpts) {
  const spec = withOverrides(opts.spec, opts.overrides);
  const layout = clipLayout(ctx, { spec, text: opts.text, fontPx: opts.fontPx || 96, maxWidth: opts.maxWidth || Infinity, weight: opts.weight || 700 });
  const n = spec.target === "whole" ? 1 : layout.units.length;
  const t = clipTiming(spec, n, { mode: opts.mode || "spring", overrides: opts.overrides });
  const hold = holdFor(spec, layout.wordCount);
  return { ...t, hold, total: t.enterTotal + hold + t.exitTotal, units: n };
}

export function clipNatural(ctx: Ctx, clip: Clip, specs: Specs, width: number) {
  const spec = clip.specId ? specs[clip.specId] : undefined;
  if (!spec || clip.static) return null;
  return naturalClipMs(ctx, { spec, text: clip.text, fontPx: clip.fontPx || 120, maxWidth: width * (clip.w ?? 0.84), mode: clip.mode || "spring", overrides: clip.overrides, weight: clip.weight || 700 });
}

/**
 * Draw a whole project at absolute time tMs, deterministic in t. A clip's
 * length stretches its *hold*: enter and exit keep their physics, so making a
 * clip longer on the timeline never slows a spring.
 */
export function renderAt(ctx: Ctx, project: Project, specs: Specs, tMs: number) {
  const { width, height } = project;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = project.background || "#FFFFFF";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.scale(ctx.canvas.width / width, ctx.canvas.height / height);
  for (const clip of project.clips) {
    const local = tMs - clip.at_ms;
    if (local < 0 || local > clip.duration_ms) continue;
    const cx = width * (clip.x ?? 0.5);
    const cy = height * (clip.y ?? 0.5);
    if (clip.static) {
      ctx.save();
      ctx.fillStyle = clip.ink || "#0C0C0C";
      ctx.font = fontString(clip.weight || 600, clip.fontPx || 32, FONT_NARROW);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lines = String(clip.text).split("\n");
      lines.forEach((line, i) => ctx.fillText(line, cx, cy + (i - (lines.length - 1) / 2) * (clip.fontPx || 32) * 1.15));
      ctx.restore();
      continue;
    }
    const spec = clip.specId ? specs[clip.specId] : undefined;
    if (!spec) continue;
    const opts: ClipOpts = {
      spec, text: clip.text, ink: clip.ink, fontPx: clip.fontPx || 120, maxWidth: width * (clip.w ?? 0.84),
      mode: clip.mode || "spring", overrides: clip.overrides, weight: clip.weight || 700,
    };
    const nat = naturalClipMs(ctx, opts);
    opts.holdMs = Math.max(0, clip.duration_ms - nat.enterTotal - nat.exitTotal);
    renderClip(ctx, local, cx, cy, opts);
  }
  for (const g of project.guides || []) {
    ctx.save();
    ctx.strokeStyle = g.ink || "rgba(12,12,12,0.2)";
    ctx.lineWidth = g.width || 2;
    ctx.beginPath();
    ctx.moveTo(g.x1 * width, g.y1 * height);
    ctx.lineTo(g.x2 * width, g.y2 * height);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** Last ms anything is on screen. */
export function projectDuration(project: Project): number {
  return project.clips.reduce((m, c) => Math.max(m, c.at_ms + c.duration_ms), 0);
}
