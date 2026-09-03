// `shape` — the club's motif language as placed objects: circle, oval,
// square, triangle, line, bar, arc, cross, bracket, each with a position, a
// size, a weight (0 fills it), a turn, an ink, and the deformers that turn
// one mark into a pattern (`repeat`/`along`/`spread`/`jitter`/`twist`/
// `taper`) — ported from overlay.ts's drawMark/drawShape/scatter, already
// decoupled from the old layer-stack model.
//
// `ParamValue` (number | string | boolean | string[]) has no array-of-objects
// case, so the mark list travels as one JSON-stringified `marksJson` string
// param rather than as a new shape in postgraph.ts's own model — parsed
// defensively (malformed JSON -> no marks) and edited through the
// parseMarks/stringifyMarks helpers below, never hand-rolled by the UI.
//
// Per-mark motion (the old model's ShapeSpec.motion, animating one mark's own
// numbers) is dropped from this pass — only the node-level GraphNode.motion
// map applies, to top-level params. A deliberate breadth cut, not an
// oversight: fewer node kinds fully-featured beats many half-working.

import type { NodeDef, NodeKindImpl, ParamValue } from "@/lib/postgraph";
import { num, str, clamp01, makeCanvas } from "./util";

export type Mark = {
  kind: string;
  x: number;
  y: number;
  size: number;
  weight: number;
  rotation: number;
  opacity: number;
  ink?: string;
  repeat: number;
  along: string;
  spread: number;
  jitter: number;
  twist: number;
  taper: number;
  seed: number;
};

export const MARK_KINDS = ["circle", "oval", "square", "triangle", "line", "bar", "arc", "cross", "bracket"];
export const ALONG = ["none", "y", "arc", "ring"];

export const defaultMark = (): Mark => ({
  kind: "circle",
  x: 0,
  y: 0,
  size: 0.4,
  weight: 2,
  rotation: 0,
  opacity: 1,
  repeat: 1,
  along: "none",
  spread: 0.25,
  jitter: 0,
  twist: 0,
  taper: 0,
  seed: 1,
});

export function parseMarks(json: string): Mark[] {
  try {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw.map((m) => ({ ...defaultMark(), ...(m && typeof m === "object" ? m : {}) }));
  } catch {
    return [];
  }
}

export const stringifyMarks = (marks: Mark[]): string => JSON.stringify(marks);

export const def: NodeDef = {
  kind: "shape",
  label: "Shape",
  hint: "The club's motifs as placed marks — circles, bars, brackets — repeated along a row, an arc or a ring.",
  inputs: ["in"],
  outputs: ["out"],
  /* The one top-level numeric param on this node — every other number lives
     inside the marksJson string, out of GraphNode.motion's reach (it only
     animates a top-level param). `spin` turns every mark uniformly, which is
     what lets a shape node carry a travelling motion at all in this pass. */
  controls: [{ key: "spin", label: "spin", min: 0, max: 360, step: 1, def: 0 }],
};

function defaultParams(): Record<string, ParamValue> {
  return { marksJson: stringifyMarks([defaultMark()]), ink: "#000000", spin: 0 };
}

const scatter = (seed: number, i: number, k: number) => {
  const x = Math.sin(seed * 91.7 + i * 47.3 + k * 13.1) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

function drawMark(ctx: CanvasRenderingContext2D, kind: string, r: number, filled: boolean) {
  const path = new Path2D();
  switch (kind) {
    case "oval":
      path.ellipse(0, 0, r, r * 0.58, 0, 0, Math.PI * 2);
      break;
    case "square":
      path.rect(-r, -r, r * 2, r * 2);
      break;
    case "triangle":
      path.moveTo(0, -r);
      path.lineTo(r * 0.92, r * 0.72);
      path.lineTo(-r * 0.92, r * 0.72);
      path.closePath();
      break;
    case "line":
      path.moveTo(-r, 0);
      path.lineTo(r, 0);
      break;
    case "bar":
      path.rect(-r, -r * 0.16, r * 2, r * 0.32);
      break;
    case "arc":
      path.arc(0, 0, r, Math.PI, 0);
      break;
    case "cross":
      path.moveTo(-r, 0);
      path.lineTo(r, 0);
      path.moveTo(0, -r);
      path.lineTo(0, r);
      break;
    case "bracket": {
      const c = r * 0.42;
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        path.moveTo(sx * r, sy * r - sy * c);
        path.lineTo(sx * r, sy * r);
        path.lineTo(sx * r - sx * c, sy * r);
      }
      break;
    }
    default:
      path.arc(0, 0, r, 0, Math.PI * 2);
  }
  if (filled && kind !== "line" && kind !== "cross" && kind !== "arc" && kind !== "bracket") ctx.fill(path);
  else ctx.stroke(path);
}

function drawOneMark(ctx: CanvasRenderingContext2D, s: Mark, w: number, h: number, u: number, ink: string, spin: number) {
  const count = Math.max(1, Math.round(s.repeat));
  const short = Math.min(w, h);
  const r0 = (s.size * short) / 2;
  const spread = s.spread * short;
  const seed = s.seed;

  ctx.save();
  ctx.globalAlpha = clamp01(s.opacity);
  ctx.strokeStyle = s.ink || ink;
  ctx.fillStyle = s.ink || ink;
  ctx.lineWidth = Math.max(0.5, s.weight * u);
  ctx.lineJoin = "miter";

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1) - 0.5;
    let dx = 0;
    let dy = 0;
    if (s.along === "y") dy = t * spread * count * 0.5;
    else if (s.along === "arc") {
      const a = t * Math.PI * 0.9;
      dx = Math.sin(a) * spread;
      dy = (1 - Math.cos(a)) * spread * 0.5;
    } else if (s.along === "ring") {
      const a = (i / count) * Math.PI * 2;
      dx = Math.cos(a) * spread;
      dy = Math.sin(a) * spread;
    } else if (count > 1) dx = t * spread * count * 0.5;

    if (s.jitter) {
      dx += scatter(seed, i, 1) * s.jitter * short * 0.2;
      dy += scatter(seed, i, 2) * s.jitter * short * 0.2;
    }

    const r = r0 * (1 - s.taper * (count === 1 ? 0 : i / (count - 1)));
    if (r <= 0.5) continue;

    ctx.save();
    ctx.translate(w / 2 + (s.x * w) / 2 + dx, h / 2 + (s.y * h) / 2 + dy);
    ctx.rotate(((s.rotation + s.twist * i + spin) * Math.PI) / 180);
    drawMark(ctx, s.kind, r, s.weight === 0);
    ctx.restore();
  }
  ctx.restore();
}

function evaluate(
  params: Record<string, ParamValue>,
  inputs: Record<string, HTMLCanvasElement | null>,
  _p: number,
  w: number,
  h: number,
): HTMLCanvasElement {
  const out = makeCanvas(w, h);
  const ctx = out.getContext("2d")!;
  if (inputs.in) ctx.drawImage(inputs.in, 0, 0, w, h);

  const u = w / 1080;
  const ink = str(params.ink, "#000000");
  const spin = num(params.spin, 0);
  const marks = parseMarks(str(params.marksJson, "[]"));
  for (const mark of marks) drawOneMark(ctx, mark, w, h, u, ink, spin);
  return out;
}

const shapeNode: NodeKindImpl = { def, defaultParams, evaluate };
export default shapeNode;
