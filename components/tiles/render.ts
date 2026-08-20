// Drawing a tile.
//
// One entry point, `paint`, shared by the stage, the thumbnails and the
// exporter, so there is no second answer to what a tile looks like.
//
// Two things in here are the whole character of the output and everything else
// is arithmetic around them:
//
// **Nothing is drawn straight.** Every closed shape — the panel, an arm, a
// bead, a tick in the border — is built as an exact outline and then pushed
// about by `wobbleClosed` before it is filled. The displacement is smooth
// noise along the outline's own length, at a whole number of wavelengths so
// the loop meets itself, applied along each point's own normal so a shape
// swells and pinches rather than sliding. That is the difference between a
// vector fan of triangles and something that looks cut out with scissors, and
// it is why this tool has no "sketchy" filter: the sketch is the geometry.
//
// **The noise is a pure function of a seed.** So a tile is identical between
// two frames unless something asked it not to be, identical between the
// preview and a 4K export, and identical between two exports. `boil` is the
// one thing that changes it over time, and it changes it in whole steps —
// the hand redrawing the same tile three times a second, landing back on the
// first drawing at the end of the loop.

import { applyFilters } from "@/components/postlab/filters";
import {
  FORMATS,
  colorsOf,
  inkAt,
  type Arm,
  type ShapeId,
  type TileSpec,
} from "@/lib/tiles";

const TAU = Math.PI * 2;
const rad = (deg: number) => (deg * Math.PI) / 180;

type P = { x: number; y: number };

/* ---------------------------------------------------------------- noise --- */

/** A deterministic hash. The same one the other two studios use, for the same
    reason: a scattered thing is a design decision and must never crawl. */
export function rnd(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Smooth noise that wraps.
 *
 * `x` runs 0-1 around a closed outline and `cycles` is a whole number of
 * wavelengths in that distance, so the lattice index wraps cleanly and the
 * value at 1 is the value at 0. Without the wrap every wobbled shape would
 * have one visible join where its start didn't meet its end — the one place a
 * hand-drawn look reads as a bug instead of a hand.
 */
function loopNoise(x: number, cycles: number, seed: number): number {
  const c = Math.max(1, Math.round(cycles));
  const f = x * c;
  const i = Math.floor(f);
  const t = f - i;
  const u = t * t * (3 - 2 * t);
  const a = rnd((((i % c) + c) % c) * 1.13 + seed * 7.77 + 0.31);
  const b = rnd((((i + 1) % c) + c) % c * 1.13 + seed * 7.77 + 0.31);
  return (a + (b - a) * u) * 2 - 1;
}

/* ---------------------------------------------------------------- paths --- */

/** Unit normals along an open polyline, from the tangent at each point. */
function normals(pts: P[]): P[] {
  const n = pts.length;
  return pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
  });
}

/** The same, treating the polyline as a closed loop. */
function normalsClosed(pts: P[]): P[] {
  const n = pts.length;
  return pts.map((_, i) => {
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
  });
}

/**
 * The hand.
 *
 * Every point on a closed outline is pushed along its own normal by smooth
 * noise measured in the outline's own arc length, so a long edge gets more
 * wobbles than a short one and one setting means the same amount of hand
 * everywhere. `feature` is roughly how far apart two wobbles should be.
 */
function wobbleClosed(pts: P[], amp: number, seed: number, feature: number): P[] {
  if (amp <= 0.01 || pts.length < 3) return pts;
  const n = pts.length;
  const seg: number[] = new Array(n);
  let per = 0;
  for (let i = 0; i < n; i++) {
    const b = pts[(i + 1) % n];
    seg[i] = Math.hypot(b.x - pts[i].x, b.y - pts[i].y);
    per += seg[i];
  }
  if (per <= 0) return pts;
  const cycles = Math.max(3, Math.round(per / Math.max(1, feature)));
  const nrm = normalsClosed(pts);
  const out: P[] = new Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = loopNoise(s / per, cycles, seed) * amp;
    out[i] = { x: pts[i].x + nrm[i].x * d, y: pts[i].y + nrm[i].y * d };
    s += seg[i];
  }
  return out;
}

/** The same hand on a line with two ends, for the guides. */
function wobbleOpen(pts: P[], amp: number, seed: number, feature: number): P[] {
  if (amp <= 0.01 || pts.length < 3) return pts;
  const n = pts.length;
  let per = 0;
  const seg: number[] = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    seg[i] = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    per += seg[i];
  }
  if (per <= 0) return pts;
  const cycles = Math.max(2, Math.round(per / Math.max(1, feature)));
  const nrm = normals(pts);
  const out: P[] = new Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = loopNoise(s / per, cycles, seed) * amp;
    out[i] = { x: pts[i].x + nrm[i].x * d, y: pts[i].y + nrm[i].y * d };
    if (i < n - 1) s += seg[i];
  }
  return out;
}

/** A closed path through the points, rounded off — quadratics through the
    midpoints, which is the cheapest curve that never overshoots. */
function traceClosed(ctx: CanvasRenderingContext2D, pts: P[]) {
  const n = pts.length;
  if (n < 3) return;
  const mid = (a: P, b: P) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  let m = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m.x, m.y);
  for (let i = 0; i < n; i++) {
    const next = mid(pts[i], pts[(i + 1) % n]);
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, next.x, next.y);
    m = next;
  }
  ctx.closePath();
}

/** The same, with two ends. */
function traceOpen(ctx: CanvasRenderingContext2D, pts: P[]) {
  const n = pts.length;
  if (n < 2) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < n - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
}

const fillShape = (ctx: CanvasRenderingContext2D, pts: P[], ink: string) => {
  ctx.beginPath();
  traceClosed(ctx, pts);
  ctx.fillStyle = ink;
  ctx.fill();
};

/**
 * The panel's outline, as points spaced evenly along its own edge.
 *
 * It is walked as four lines and four corner arcs rather than drawn as a
 * superellipse, because the references have corners: a superellipse is one
 * clean expression but it is never actually square, and at the sample density
 * this needs the corner is the first thing that rounds off. Even spacing is
 * what lets the hand be the same everywhere, corners included.
 */
function panelPoints(cx: number, cy: number, hw: number, hh: number, round: number, step: number): P[] {
  const r = Math.min(1, Math.max(0, round)) * Math.min(hw, hh);
  const pts: P[] = [];
  const x0 = cx - hw;
  const x1 = cx + hw;
  const y0 = cy - hh;
  const y1 = cy + hh;
  const run = (ax: number, ay: number, bx: number, by: number) => {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let i = 0; i < n; i++) pts.push({ x: ax + ((bx - ax) * i) / n, y: ay + ((by - ay) * i) / n });
  };
  const bend = (ccx: number, ccy: number, a0: number, a1: number) => {
    if (r <= 0) return;
    const n = Math.max(2, Math.round((Math.abs(a1 - a0) * r) / step));
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push({ x: ccx + Math.cos(a) * r, y: ccy + Math.sin(a) * r });
    }
  };
  run(x0 + r, y0, x1 - r, y0);
  bend(x1 - r, y0 + r, -Math.PI / 2, 0);
  run(x1, y0 + r, x1, y1 - r);
  bend(x1 - r, y1 - r, 0, Math.PI / 2);
  run(x1 - r, y1, x0 + r, y1);
  bend(x0 + r, y1 - r, Math.PI / 2, Math.PI);
  run(x0, y1 - r, x0, y0 + r);
  bend(x0 + r, y0 + r, Math.PI, Math.PI * 1.5);
  return pts;
}

/** A circle, or an oval pulled out along one direction. */
function oval(c: P, r: number, stretch: number, angle: number, n = 24): P[] {
  const rx = r * (1 + stretch);
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const pts: P[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * r;
    pts[i] = { x: c.x + x * ca - y * sa, y: c.y + x * sa + y * ca };
  }
  return pts;
}

/* ----------------------------------------------------------------- arms --- */

/* How the width changes between the root and the tip. Two exponents, so the
   six stroke shapes are one renderer with six numbers rather than six
   functions that could drift apart. */
const PROFILE: Record<ShapeId, [number, number]> = {
  lance: [0.8, 0.8],
  ribbon: [0, 0],
  wedge: [0, 0],
  petal: [1.5, 0.4],
  bar: [0, 0],
  hook: [0, 0],
  chain: [0, 0],
  dot: [0, 0],
};

const CAPPED: Record<ShapeId, boolean> = {
  lance: false,
  ribbon: true,
  wedge: false,
  petal: false,
  bar: true,
  hook: true,
  chain: true,
  dot: true,
};

function profile(shape: ShapeId, t: number): number {
  const [a, b] = PROFILE[shape];
  if (a === 0 && b === 0) return 1;
  const peak = a / (a + b);
  const norm = Math.pow(peak, a) * Math.pow(1 - peak, b);
  return (Math.pow(Math.max(0, t), a) * Math.pow(Math.max(0, 1 - t), b)) / norm;
}

/** Positive narrows towards the tip, negative towards the root. One number
    rather than two, because in the references it is always one decision. */
const taperAt = (taper: number, t: number) =>
  taper >= 0 ? 1 - taper * t : 1 + taper * (1 - t);

/** Half a round end, as points, so a cap is part of the outline and gets
    wobbled with everything else rather than being a tidy arc stuck on. */
function capPoints(p: P, nrm: P, tan: P, hw: number, sign: 1 | -1, from: number, to: number): P[] {
  const out: P[] = [];
  const steps = 8;
  for (let i = 1; i < steps; i++) {
    const a = from + (to - from) * (i / steps);
    const c = Math.cos(a);
    const s = Math.sin(a) * sign;
    out.push({
      x: p.x + nrm.x * hw * c + tan.x * hw * s,
      y: p.y + nrm.y * hw * c + tan.y * hw * s,
    });
  }
  return out;
}

/**
 * Where a point on an arm actually sits, once the meander is applied.
 *
 * The wave is a **distance** sideways, not an angle. Written as an angle it
 * looked right near the middle and thrashed at the rim, because the same few
 * degrees are a few pixels at r=0.2 and half the panel at r=1.4 — a ribbon
 * that starts as a gentle waver and ends as a whip. Measured across the ray
 * instead, one wave setting is one wave everywhere along it, which is what
 * every reference does.
 *
 * It is damped near the middle so a bundle of rays still converges on a point
 * rather than opening into a rosette nobody asked for.
 */
function meander(f: ArmFrame, arm: Arm, a: number, r: number, t: number, flip: number): P {
  const x = f.cx + Math.cos(a) * r;
  const y = f.cy + Math.sin(a) * r;
  if (arm.wave <= 0) return { x, y };
  const hold = Math.min(1, r / (0.3 * f.u));
  /* `ripple` slides the wave along the ray as the loop runs, in whole waves,
     so the meander travels out of the middle and off the rim instead of
     standing still. Whole is what makes it safe: at the end of the loop the
     crest is exactly where the crest before it was. */
  const phase = TAU * (arm.waves * t - arm.ripple * f.p);
  const off = arm.wave * 0.22 * f.u * flip * hold * Math.sin(phase);
  return { x: x - Math.sin(a) * off, y: y + Math.cos(a) * off };
}

type ArmFrame = {
  cx: number;
  cy: number;
  /** Pixels per unit: r = 1 is the panel's half-width. */
  u: number;
  /** Pixels per design unit at 1080, for weights. */
  s: number;
  p: number;
  seed: number;
  wob: number;
};

/** One copy of an arm, as a closed outline in canvas pixels. */
function armOutline(arm: Arm, f: ArmFrame, a0: number, flip: number, pulse: number, twist: number): P[] {
  const steps = 30;
  const centre: P[] = new Array(steps + 1);
  const half: number[] = new Array(steps + 1);
  const angles: number[] = new Array(steps + 1);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    /* A hook holds its line and then turns all at once; everything else turns
       evenly along its length. It is the same twist, read through a curve. */
    const bend = arm.shape === "hook" ? Math.pow(t, 2.4) : t;
    const a = a0 + twist * flip * bend;
    const r = (arm.inner + (arm.outer - arm.inner) * t) * pulse * f.u;
    angles[i] = a;
    centre[i] = meander(f, arm, a, r, t, flip);
    half[i] = f.u * arm.width * profile(arm.shape, t) * Math.max(0, taperAt(arm.taper, t));
  }

  /* A wedge's width is an angle, not a distance — which is what makes it a
     blade of a pinwheel rather than a thick ray. At width 1 the blades of one
     arm touch each other and the field fills. */
  if (arm.shape === "wedge") {
    const left: P[] = [];
    const right: P[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const r = (arm.inner + (arm.outer - arm.inner) * t) * pulse * f.u;
      const spread =
        (Math.PI / Math.max(1, arm.count)) *
        arm.width *
        profile(arm.shape, t) *
        Math.max(0, taperAt(arm.taper, t));
      left.push(meander(f, arm, angles[i] + spread, r, t, flip));
      right.push(meander(f, arm, angles[i] - spread, r, t, flip));
    }
    return [...left, ...right.reverse()];
  }

  const nrm = normals(centre);
  const last = steps;
  const tanAt = (i: number): P => ({ x: nrm[i].y, y: -nrm[i].x });
  const left = centre.map((p, i) => ({ x: p.x + nrm[i].x * half[i], y: p.y + nrm[i].y * half[i] }));
  const right = centre.map((p, i) => ({ x: p.x - nrm[i].x * half[i], y: p.y - nrm[i].y * half[i] }));

  const out: P[] = [...left];
  if (CAPPED[arm.shape]) out.push(...capPoints(centre[last], nrm[last], tanAt(last), half[last], 1, 0, Math.PI));
  out.push(...right.reverse());
  if (CAPPED[arm.shape]) out.push(...capPoints(centre[0], nrm[0], tanAt(0), half[0], -1, Math.PI, 0));
  return out;
}

/** Beads threaded along the arm, rather than a stroke drawn down it. */
function chainMarks(arm: Arm, f: ArmFrame, a0: number, flip: number, pulse: number, twist: number): P[][] {
  const marks: P[][] = [];
  const n = Math.max(1, arm.beads);
  const shift = arm.march !== 0 ? (arm.march * f.p) / n : 0;
  for (let i = 0; i < n; i++) {
    let t = (i + 0.5) / n + shift;
    t = ((t % 1) + 1) % 1;
    const a = a0 + twist * flip * t;
    const r = (arm.inner + (arm.outer - arm.inner) * t) * pulse * f.u;
    /* Marching beads are damped at both ends of the thread, so a bead that
       runs off the rim has already shrunk to nothing before it reappears at
       the middle. A still chain is left alone — the references have plenty of
       chains that start and end abruptly, and that is the look. */
    const damp = arm.march !== 0 ? Math.pow(Math.sin(Math.PI * t), 0.4) : 1;
    const size = f.u * arm.width * Math.max(0, taperAt(arm.taper, t)) * damp;
    if (size < 0.4) continue;
    marks.push(oval(meander(f, arm, a, r, t, flip), size, arm.stretch, a));
  }
  return marks;
}

function drawArm(ctx: CanvasRenderingContext2D, arm: Arm, f: ArmFrame, inks: string[], globalTurn: number) {
  const ink = inkAt(inks, arm.ink);
  const spin = TAU * arm.spin * f.p;
  const feature = f.u * 0.1;
  /* The hand is capped against the mark's own width. A tile-wide amount that
     reads as a torn edge on a blade would eat a thread of beads entirely, so
     no shape is ever pushed about by more than a fraction of itself — and a
     bead is measured against its own radius rather than the panel, or the
     same shake that ruffles a ray turns a dot into a burr. */
  const bead = arm.shape === "chain" || arm.shape === "dot";
  const amp = Math.min(f.wob, f.u * arm.width * (arm.shape === "wedge" ? 6 : bead ? 0.22 : 0.7));
  const beadFeature = f.u * arm.width * 1.5;

  for (let k = 0; k < arm.count; k++) {
    const flip = arm.mirror && k % 2 === 1 ? -1 : 1;
    const a0 = rad(arm.turn) + (TAU * k) / arm.count + spin + globalTurn;

    /* The duplicator's delay. Every copy runs the same motion a little later
       than the one before it, which is the difference between an ornament
       that breathes and a wave going round a ring. It is done by handing this
       copy its own playhead rather than by moving anything: the breath, the
       sway, the travelling wave and the marching beads all read `f.p`, so one
       shifted frame staggers all four and can't get out of step with itself.
       The angle is left alone, so the ring stays evenly spaced. */
    const fk =
      arm.stagger === 0 ? f : { ...f, p: f.p + (arm.stagger * k) / arm.count };
    const pulse = 1 + arm.pulse * Math.sin(TAU * fk.p);
    const twist = rad(arm.twist + arm.sway * Math.sin(TAU * fk.p));
    /* The seed is the copy, not a counter — so an arm keeps its own hand when
       another arm is added above it, exactly the way the site picks a hover
       colour by something stable about the item. */
    const seed = f.seed + arm.ink * 13 + k * 101 + arm.count * 7;

    if (arm.shape === "dot") {
      const r = arm.outer * pulse * f.u;
      const pts = oval(
        { x: f.cx + Math.cos(a0) * r, y: f.cy + Math.sin(a0) * r },
        f.u * arm.width,
        arm.stretch,
        a0,
      );
      fillShape(ctx, wobbleClosed(pts, amp, seed, beadFeature), ink);
      continue;
    }

    if (arm.shape === "chain") {
      chainMarks(arm, fk, a0, flip, pulse, twist).forEach((pts, i) =>
        fillShape(ctx, wobbleClosed(pts, amp * 0.9, seed + i * 17, beadFeature), ink),
      );
      continue;
    }

    fillShape(ctx, wobbleClosed(armOutline(arm, fk, a0, flip, pulse, twist), amp, seed, feature), ink);
  }
}

/* --------------------------------------------------------------- guides --- */

function drawGuides(ctx: CanvasRenderingContext2D, spec: TileSpec, f: ArmFrame, inks: string[], globalTurn: number) {
  const g = spec.guides;
  if (!g.spokes && !g.rings && !g.arcs) return;
  ctx.save();
  ctx.globalAlpha = g.alpha;
  ctx.strokeStyle = inkAt(inks, g.ink);
  ctx.lineWidth = Math.max(0.6, g.weight * f.s);
  ctx.lineCap = "butt";
  ctx.setLineDash([g.dash * f.s, g.gap * f.s]);
  const feature = f.u * 0.16;
  const amp = f.wob * 0.35;

  const line = (pts: P[], seed: number) => {
    ctx.beginPath();
    traceOpen(ctx, wobbleOpen(pts, amp, seed, feature));
    ctx.stroke();
  };

  for (let i = 0; i < g.spokes; i++) {
    const a = (TAU * i) / g.spokes + globalTurn;
    const pts: P[] = [];
    for (let j = 0; j <= 14; j++) {
      const r = (g.from + (g.to - g.from) * (j / 14)) * f.u;
      pts.push({ x: f.cx + Math.cos(a) * r, y: f.cy + Math.sin(a) * r });
    }
    line(pts, f.seed + 400 + i * 31);
  }

  for (let i = 0; i < g.rings; i++) {
    const r = (g.from + (g.to - g.from) * ((i + 1) / (g.rings + 1))) * f.u;
    const pts: P[] = [];
    for (let j = 0; j < 96; j++) {
      const a = (TAU * j) / 96 + globalTurn;
      pts.push({ x: f.cx + Math.cos(a) * r, y: f.cy + Math.sin(a) * r });
    }
    const wob = wobbleClosed(pts, amp, f.seed + 700 + i * 53, feature);
    ctx.beginPath();
    traceClosed(ctx, wob);
    ctx.stroke();
  }

  /* An arc leaves the middle and curls on its way out — the long sweeping
     working lines in the references, which are not circles round the centre
     and not spokes either. At spiral 0 it is a spoke, which is why the two
     counts can both be on at once without saying the same thing twice. */
  for (let i = 0; i < g.arcs; i++) {
    const a0 = (TAU * i) / g.arcs + globalTurn;
    const pts: P[] = [];
    for (let j = 0; j <= 40; j++) {
      const t = j / 40;
      const r = (g.from + (g.to - g.from) * t) * f.u;
      const a = a0 + rad(g.spiral) * t;
      pts.push({ x: f.cx + Math.cos(a) * r, y: f.cy + Math.sin(a) * r });
    }
    line(pts, f.seed + 1100 + i * 71);
  }
  ctx.restore();
}

/* --------------------------------------------------------------- centre --- */

function drawCentre(ctx: CanvasRenderingContext2D, spec: TileSpec, f: ArmFrame, inks: string[], globalTurn: number) {
  const c = spec.centre;
  if (c.kind === "none") return;
  const ink = inkAt(inks, c.ink);
  const r = c.size * f.u;
  const at = { x: f.cx, y: f.cy };

  if (c.kind === "dot") {
    fillShape(ctx, wobbleClosed(oval(at, r, 0, 0, 36), f.wob, f.seed + 5, f.u * 0.05), ink);
    return;
  }
  if (c.kind === "ring") {
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, r * 0.3);
    ctx.beginPath();
    traceClosed(ctx, wobbleClosed(oval(at, r, 0, 0, 36), f.wob, f.seed + 6, f.u * 0.05));
    ctx.stroke();
    ctx.restore();
    return;
  }
  /* The little asterisk half the references have sitting in the middle: short
     spokes, not a drawn star, because that is plainly what it is. */
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1, r * 0.42);
  ctx.lineCap = "round";
  for (let i = 0; i < c.points; i++) {
    const a = (TAU * i) / c.points + globalTurn;
    const jitter = 1 + loopNoise(i / c.points, c.points, f.seed + 9) * 0.22;
    ctx.beginPath();
    ctx.moveTo(f.cx, f.cy);
    ctx.lineTo(f.cx + Math.cos(a) * r * jitter, f.cy + Math.sin(a) * r * jitter);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- frame --- */

function drawFrame(
  ctx: CanvasRenderingContext2D,
  spec: TileSpec,
  w: number,
  h: number,
  band: number,
  colors: ReturnType<typeof colorsOf>,
  seed: number,
  wob: number,
) {
  const fr = spec.frame;
  ctx.fillStyle = colors.frame;
  ctx.fillRect(0, 0, w, h);

  /* A second, outermost strip. One reference in thirteen has one, and every
     other tile leaves it at 0 and gets a flat band. */
  const strip = fr.outer * band;
  if (strip > 0.5) {
    ctx.fillStyle = colors.frameOuter;
    ctx.fillRect(0, 0, w, strip);
    ctx.fillRect(0, h - strip, w, strip);
    ctx.fillRect(0, 0, strip, h);
    ctx.fillRect(w - strip, 0, strip, h);
  }

  if (fr.ticks <= 0 || band <= 0) return;

  /* Ticks are placed by distance around the perimeter rather than per side, so
     they carry through the corners at an even pitch the way a stamped edge
     does — a per-side loop leaves four visible gaps. */
  const inset = fr.tickAt * band;
  const x0 = inset;
  const y0 = inset;
  const rw = w - inset * 2;
  const rh = h - inset * 2;
  if (rw <= 0 || rh <= 0) return;
  const per = 2 * (rw + rh);
  const count = Math.max(4, Math.round((fr.ticks * per) / Math.min(w, h)));
  const pitch = per / count;
  const len = fr.tickLen * band;

  ctx.save();
  ctx.strokeStyle = colors.edge;
  ctx.lineWidth = Math.max(1, fr.tickWide * pitch);
  ctx.lineCap = fr.round ? "round" : "butt";
  for (let i = 0; i < count; i++) {
    let s = ((i + 0.5) * pitch) % per;
    let px: number;
    let py: number;
    let nx: number;
    let ny: number;
    if (s < rw) {
      px = x0 + s;
      py = y0;
      nx = 0;
      ny = -1;
    } else if ((s -= rw) < rh) {
      px = x0 + rw;
      py = y0 + s;
      nx = 1;
      ny = 0;
    } else if ((s -= rh) < rw) {
      px = x0 + rw - s;
      py = y0 + rh;
      nx = 0;
      ny = 1;
    } else {
      s -= rw;
      px = x0;
      py = y0 + rh - s;
      nx = -1;
      ny = 0;
    }
    /* Each tick is its own length and sits a hair off its mark. Ticks that
       agreed exactly with each other would be the one machined thing on a
       tile where nothing else is. */
    const jitter = 1 + loopNoise(i / count, count, seed + 3) * 0.28;
    const slip = loopNoise(i / count, count, seed + 4) * wob * 0.6;
    const l = len * jitter;
    const tx = -ny;
    const ty = nx;
    ctx.beginPath();
    ctx.moveTo(px - nx * l * 0.5 + tx * slip, py - ny * l * 0.5 + ty * slip);
    ctx.lineTo(px + nx * l * 0.5 + tx * slip, py + ny * l * 0.5 + ty * slip);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------------------------------------------------------------------- */

/**
 * A whole tile.
 *
 * The order is the order a tile is made in: the band, the panel it frames, the
 * lines it was set out with, the ornament, and last whatever sits in the
 * middle. The panel clips everything after it, which is what lets an arm be
 * given a radius past the edge and simply run into the corners — most of the
 * references do exactly that, and it is why the shapes look cut rather than
 * arranged.
 */
export function paint(
  ctx: CanvasRenderingContext2D,
  spec: TileSpec,
  p: number,
  w: number,
  h: number,
) {
  const colors = colorsOf(spec);
  const inks = colors.inks.length ? colors.inks : ["#111111"];
  const pp = ((p % 1) + 1) % 1;
  /* The hand redraws the tile in whole steps and lands back on the first
     drawing at the end of the loop. It is the one thing in here that is a
     function of time and isn't continuous, and it is the reason a still tile
     still moves. */
  const field = spec.boil > 0 ? Math.floor(pp * spec.boil) % spec.boil : 0;
  const seed = 1 + field * 977;

  const R = Math.min(w, h) / 2;
  const s = Math.min(w, h) / 1080;
  const band = spec.frame.band * R;
  const hw = Math.max(4, w / 2 - band);
  const hh = Math.max(4, h / 2 - band);
  const u = Math.min(hw, hh);
  const wob = spec.wobble * 0.045 * R;

  drawFrame(ctx, spec, w, h, band, colors, seed, wob);

  const panel = wobbleClosed(
    panelPoints(w / 2, h / 2, hw, hh, spec.round, u * 0.03),
    wob * 1.2,
    seed + 21,
    u * 0.11,
  );
  ctx.save();
  ctx.beginPath();
  traceClosed(ctx, panel);
  ctx.fillStyle = colors.ground;
  ctx.fill();
  ctx.clip();

  const f: ArmFrame = { cx: w / 2, cy: h / 2, u, s, p: pp, seed, wob };
  const globalTurn = TAU * spec.spin * pp;

  if (!spec.guides.top) drawGuides(ctx, spec, f, inks, globalTurn);
  for (const arm of spec.arms) {
    if (arm.mute) continue;
    drawArm(ctx, arm, f, inks, globalTurn);
  }
  if (spec.guides.top) drawGuides(ctx, spec, f, inks, globalTurn);
  drawCentre(ctx, spec, f, inks, globalTurn);
  ctx.restore();

  /* The Posts Studio's chain, unforked, over the finished tile. Same fix the
     Kinetics needs: over there a filter runs on a transparent layer and a
     cleared cell is how the ground shows through, so here the ground goes
     back in behind whatever the chain left transparent. */
  if (spec.filters?.length) {
    applyFilters(ctx, w, h, spec.filters, "light", inks[0]);
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = colors.ground;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

/** The size a tile of this spec is drawn at. */
export const sizeOf = (spec: TileSpec) => FORMATS[spec.format];
