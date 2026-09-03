// The seven scenes, ported from the old `components/kinetics/scenes.ts` —
// same math, reading a flat prefixed param bag (`${scene}_${key}`) instead
// of a `KineticSpec.params` object, so a `kinetic` node's params fit
// `ParamValue` directly with no per-scene sub-object.
//
// `stagger`, `arcs` and `field` *set* type — they draw letters. `strokes`,
// `mosaic`, `halftone` never draw a letter: they draw a field and ask the
// mask whether each point is inside a word. `bleed` composites the (fixed)
// words against a moving field. That second family is why `maskOf` in
// `layout.ts` is the most important thing this node carries.
//
// Every scene is a pure function of `p` (0-1 through the loop) and lands on
// the same frame at 1 as at 0 — rotations are whole turns, scrolls are whole
// cells, a stagger's intro/pause/outro are shares of the loop. Nothing here
// reads the wall clock.
//
// Dropped from `paint()` relative to the old studio: running the Posts
// Studio's own filter chain internally. In the graph model a filter is a
// separate `filter` node wired downstream — chaining is the graph's job,
// exactly like every other node kind here (see `mix`/`filter`'s own doc
// comments). Grain and blotter stay inside this node, same as before —
// neither is expressed as a `filter` node in the old model either.

import type { ParamValue } from "@/lib/postgraph";
import type { Fonts } from "../type";
import { num, str, bool } from "../util";
import { ease } from "./easing";
import { presence, queue, rnd, type Timing } from "./timing";
import { fontOf, layout, maskOf, type Mask, type TypeParams } from "./layout";

export type SceneId = "stagger" | "strokes" | "mosaic" | "arcs" | "field" | "bleed" | "halftone";
export const SCENE_IDS: SceneId[] = ["stagger", "strokes", "mosaic", "arcs", "field", "bleed", "halftone"];

export type Frame = {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** 0-1 through the loop. */
  p: number;
  tp: TypeParams;
  fonts: Fonts;
  timing: Timing;
  ground: string;
  inks: string[];
  /** Canvas units per design unit (the format's base width is always 1080,
      see FORMATS in lib/postgraph.ts), so a weight means the same thing in
      the preview and in a 4K export. */
  s: number;
  /** The node's full flat param bag, for a scene's own prefixed reads. */
  params: Record<string, ParamValue>;
  grain: number;
  blotter: boolean;
  blot: number;
};

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** An ink for an item, stable across frames and visits — pick by something
    about the item, never by a counter that shifts when a letter is added. */
const inkFor = (inks: string[], key: number) => inks[Math.abs(Math.round(key)) % inks.length];

/** Read one scene's own param, prefixed `${scene}_${key}` so the ~40 flat
    params across 7 scenes never collide with each other or with the node's
    shared params (`inks`, `grain`, ...). */
const n = (f: Frame, scene: SceneId, key: string, def: number) => num(f.params[`${scene}_${key}`], def);
const b = (f: Frame, scene: SceneId, key: string, def: boolean) => bool(f.params[`${scene}_${key}`], def);
const s_ = (f: Frame, scene: SceneId, key: string, def: string) => str(f.params[`${scene}_${key}`], def);

const clear = (f: Frame) => {
  f.ctx.fillStyle = f.ground;
  f.ctx.fillRect(0, 0, f.w, f.h);
};

/* Scratch canvases reused for every soft field this node draws — allocating
   one a frame is the kind of cost that looks free and shows up as a stutter
   every few seconds once the collector catches up. */
const pads: HTMLCanvasElement[] = [];
const padAt = (i: number, w: number, h: number) => {
  if (!pads[i]) pads[i] = document.createElement("canvas");
  const c = pads[i];
  c.width = w;
  c.height = h;
  return c.getContext("2d")!;
};

type Soft = { canvas: HTMLCanvasElement; sx: number; sy: number; sw: number; sh: number };

/**
 * A blurred field, at a controllable radius, for about the cost of not
 * blurring. Painted small, blurred there, blown back up — a 150px radius
 * over a 4K frame is unaffordable per-pixel; the same radius over a canvas
 * an eighth the size is 1/64th of the work and identical once stretched.
 */
function soften(f: Frame, blur: number, paintField: (c: CanvasRenderingContext2D, w: number, h: number) => void): Soft {
  const bl = Math.max(0, Math.min(100, blur));
  const q = bl <= 0 ? 1 : 0.125;
  const sw = Math.max(8, Math.round(f.w * q));
  const sh = Math.max(8, Math.round(f.h * q));
  const radius = Math.pow(bl / 100, 1.35) * 0.34 * Math.min(sw, sh);
  const pad = Math.ceil(radius * 2.2);

  const a = padAt(0, sw + pad * 2, sh + pad * 2);
  a.clearRect(0, 0, a.canvas.width, a.canvas.height);
  a.save();
  a.translate(pad, pad);
  paintField(a, sw, sh);
  a.restore();

  let src = a.canvas;
  if (radius > 0.4) {
    const bb = padAt(1, a.canvas.width, a.canvas.height);
    bb.clearRect(0, 0, bb.canvas.width, bb.canvas.height);
    bb.filter = `blur(${radius}px)`;
    bb.drawImage(a.canvas, 0, 0);
    bb.filter = "none";
    src = bb.canvas;
  }

  const { ctx } = f;
  ctx.save();
  ctx.imageSmoothingEnabled = bl > 0;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, pad, pad, sw, sh, 0, 0, f.w, f.h);
  ctx.restore();
  return { canvas: src, sx: pad, sy: pad, sw, sh };
}

const mask = (f: Frame): Mask => maskOf(f.tp, f.fonts, f.w, f.h);

/* ------------------------------------------------------------- stagger --- */

function drawStagger(f: Frame) {
  clear(f);
  const { ctx, p, w, h, inks, s } = f;
  const lay = layout(ctx, f.tp, f.fonts, w, h);
  if (!lay.count) return;

  const rise = n(f, "stagger", "rise", 180) * s;
  const spin = (n(f, "stagger", "spin", 0) * Math.PI) / 180;
  const zoom = n(f, "stagger", "zoom", 0.7);
  const shift = n(f, "stagger", "rowShift", 90) * s;
  const perLetter = b(f, "stagger", "perLetter", true);
  const fade = b(f, "stagger", "fade", false);

  ctx.font = fontOf(f.tp, f.fonts, lay.size);
  ctx.textBaseline = "alphabetic";

  for (const line of lay.lines) {
    const off = (rnd((line.glyphs[0]?.line ?? 0) * 37 + 5) - 0.5) * 2 * shift;
    for (const g of line.glyphs) {
      if (g.ch === " ") continue;
      const k = queue(f.timing.from, g.cx / w, g.cy / h, g.i, lay.count);
      const pr = presence(f.timing, p, k);
      if (pr <= 0.001) continue;

      ctx.save();
      ctx.globalAlpha = fade ? pr : Math.min(1, pr * 3);
      ctx.translate(g.cx + off, g.cy);
      const sc = lerp(zoom, 1, pr);
      ctx.scale(sc, sc);
      ctx.rotate(spin * (1 - pr));
      ctx.translate(0, (1 - pr) * rise);
      ctx.fillStyle = perLetter ? inkFor(inks, g.i * 7 + g.line * 3) : inks[0];
      ctx.fillText(g.ch, g.x - g.cx, g.y - g.cy);
      ctx.restore();
    }
  }
}

/* -------------------------------------------------------------- strokes --- */

function drawStrokes(f: Frame) {
  clear(f);
  const { ctx, p, w, h, inks, s } = f;
  const m = mask(f);
  const rings = Math.round(n(f, "strokes", "rings", 64));
  const cx = w / 2;
  const cy = h * n(f, "strokes", "centreY", 0.5);
  const reach = n(f, "strokes", "reach", 0.42);
  const spin = Math.round(n(f, "strokes", "spin", 1));
  const colour = b(f, "strokes", "colour", false);

  const maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
  const turn = p * TAU * spin;
  const gap = maxR / rings;
  const wIn = n(f, "strokes", "inside", 1.15) * gap;
  const wOut = n(f, "strokes", "outside", 0.5) * gap;

  ctx.lineCap = "round";
  for (let i = 1; i <= rings; i++) {
    const r = (i / rings) * maxR;
    const steps = Math.max(24, Math.min(1400, Math.round((TAU * r) / (2.4 * s))));
    const da = TAU / steps;

    const hit = new Uint8Array(steps);
    for (let j = 0; j < steps; j++) {
      const a = j * da + turn;
      hit[j] = m.inside(cx + Math.cos(a) * r, cy + Math.sin(a) * r) ? 1 : 0;
    }

    const dist = new Int32Array(steps);
    const BIG = steps;
    for (let j = 0; j < steps; j++) dist[j] = hit[j] ? 0 : BIG;
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < steps; j++) {
        const k = (j - 1 + steps) % steps;
        if (dist[k] + 1 < dist[j]) dist[j] = dist[k] + 1;
      }
      for (let j = steps - 1; j >= 0; j--) {
        const k = (j + 1) % steps;
        if (dist[k] + 1 < dist[j]) dist[j] = dist[k] + 1;
      }
    }

    const span = Math.max(1, reach * steps * 0.25);
    ctx.strokeStyle = colour ? inkFor(inks, i * 3) : inks[0];

    let j = 0;
    while (j < steps) {
      const d = dist[j];
      if (d === 0) {
        let k = j;
        while (k < steps && dist[k] === 0) k++;
        ctx.beginPath();
        ctx.lineWidth = wIn;
        ctx.arc(cx, cy, r, j * da + turn, k * da + turn);
        ctx.stroke();
        j = k;
        continue;
      }
      if (wOut > 0 && d < span) {
        const t = 1 - d / span;
        if (rnd(i * 131.7 + j * 0.37) < t * 0.9) {
          const len = da * lerp(0.4, 3.2, t);
          ctx.beginPath();
          ctx.lineWidth = Math.max(0.4, wOut * t);
          ctx.arc(cx, cy, r, j * da + turn, j * da + turn + len);
          ctx.stroke();
        }
      }
      j++;
    }
  }
}

/* --------------------------------------------------------------- mosaic --- */

function drawMosaic(f: Frame) {
  clear(f);
  const { ctx, p, w, h, inks } = f;
  const m = mask(f);
  const cols = Math.round(n(f, "mosaic", "cols", 11));
  const alpha = (s_(f, "mosaic", "alphabet", "SMLX") || "S").toUpperCase();
  const slide = Math.round(n(f, "mosaic", "slide", 2));
  const wave = n(f, "mosaic", "wave", 0.35);
  const stretch = n(f, "mosaic", "stretch", 1.5);
  const ghost = b(f, "mosaic", "ghost", true);

  const cw = w / cols;
  const ch = cw * stretch;
  const rows = Math.ceil(h / ch) + 1;

  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  for (let r = 0; r < rows; r++) {
    const dir = r % 2 ? -1 : 1;
    const travel = p * slide * dir * cw;
    const y = r * ch + ch / 2;
    for (let c = -1; c <= cols + 1; c++) {
      const x = c * cw + cw / 2 + travel;
      const cover = (m.at(x, y) + m.at(x - cw * 0.3, y) + m.at(x + cw * 0.3, y) + m.at(x, y - ch * 0.3) + m.at(x, y + ch * 0.3)) / 5;
      const lift = wave ? (Math.sin(p * TAU + c * 0.4 + r * 0.7) + 1) / 2 : 0;
      const level = cover * (1 - wave * 0.5) + cover * wave * lift;
      if (level < 0.06 && !ghost) continue;

      const bare = cover < 0.06;
      const idx = Math.min(alpha.length - 1, Math.floor(level * alpha.length));
      const ch2 = alpha[bare ? 0 : idx];
      ctx.font = fontOf(f.tp, f.fonts, ch * (bare ? 0.85 : 1.05));
      ctx.globalAlpha = bare ? 0.22 : 1;
      ctx.fillStyle = inkFor(inks, r * 5 + c * 3 + (bare ? 1 : 0));
      ctx.save();
      ctx.translate(((x % w) + w) % w, y);
      const gw = ctx.measureText(ch2).width || 1;
      ctx.scale(Math.min(2.2, (cw * 1.02) / gw), bare ? 0.9 : lerp(0.9, 1.15, level));
      ctx.fillText(ch2, 0, 0);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

/* ------------------------------------------------------------------ arcs --- */

function drawArcs(f: Frame) {
  clear(f);
  const { ctx, p, w, h, inks, s } = f;
  const line = (f.tp.caps ? f.tp.text.toUpperCase() : f.tp.text).replace(/\n/g, " ") + "  ";
  if (!line.trim()) return;

  const rings = Math.round(n(f, "arcs", "rings", 22));
  const size = n(f, "arcs", "size", 17) * s;
  const gap = n(f, "arcs", "gap", 1.5);
  const cy = h * n(f, "arcs", "centreY", 1.18);
  const inner = n(f, "arcs", "inner", 0.12);
  const turns = Math.round(n(f, "arcs", "turns", 1));
  const alt = b(f, "arcs", "alternate", true);
  const mono = b(f, "arcs", "mono", true);

  const cx = w / 2;
  const maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
  ctx.font = fontOf(f.tp, f.fonts, size);
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  for (let i = 0; i < rings; i++) {
    const r = maxR * lerp(inner, 1, (i + 1) / rings);
    const dir = alt && i % 2 ? -1 : 1;
    const spin = p * TAU * turns * dir;
    ctx.fillStyle = mono ? inks[0] : inkFor(inks, i);
    let a = spin;
    const limit = spin + TAU;
    let guard = 0;
    while (a < limit && guard++ < 4000) {
      const ch = line[guard % line.length];
      const adv = (ctx.measureText(ch).width * gap) / r;
      if (ch !== " ") {
        ctx.save();
        ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      }
      a += adv;
    }
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

/* ----------------------------------------------------------------- field --- */

function drawField(f: Frame) {
  clear(f);
  const { ctx, p, w, h, inks, s } = f;
  const bars = Math.round(n(f, "field", "bars", 7));
  const rows = Math.round(n(f, "field", "rows", 2));
  const blur = n(f, "field", "blur", 42);
  const paper = n(f, "field", "paper", 30);
  const drift = Math.round(n(f, "field", "drift", 1));
  const inset = n(f, "field", "inset", 0.08);

  const soft = soften(f, blur, (sc, sw, sh) => {
    const bw = sw / bars;
    const bh = sh / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < bars; c++) {
        const shifted = (((c + Math.round(p * drift * bars)) % bars) + bars) % bars;
        sc.fillStyle = inkFor(inks, shifted * 3 + r * 5);
        sc.fillRect(c * bw, r * bh, bw + 1, bh + 1);
      }
    }
  });

  if (inset > 0) {
    const ix = w * inset;
    const iy = h * inset;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(soft.canvas, soft.sx, soft.sy, soft.sw, soft.sh, ix, iy, w - ix * 2, h - iy * 2);
    ctx.restore();
  }

  if (paper > 0) {
    const vign = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * lerp(0.75, 0.05, paper / 100), w / 2, h / 2, Math.max(w, h) * 0.8);
    vign.addColorStop(0, "rgba(0,0,0,0)");
    vign.addColorStop(1, f.ground);
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, w, h);
  }

  const words = (f.tp.caps ? f.tp.text.toUpperCase() : f.tp.text).split(/\s+/).filter(Boolean);
  if (!words.length) return;
  const size = n(f, "field", "word", 46) * s;
  const spread = n(f, "field", "scatter", 0.7);
  const dark = b(f, "field", "dark", false);
  ctx.font = fontOf(f.tp, f.fonts, size);
  ctx.textBaseline = "middle";

  const widths = words.map((word) => ctx.measureText(word).width);
  const gapW = ctx.measureText(" ").width;
  const totalW = widths.reduce((a, bb) => a + bb, 0) + gapW * (words.length - 1);
  let cursor = (w - totalW) / 2;

  words.forEach((word, i) => {
    const homeX = cursor;
    const homeY = h / 2;
    cursor += widths[i] + gapW;
    const k = queue(f.timing.from, homeX / w, homeY / h, i, words.length);
    const pr = presence(f.timing, p, k);
    if (pr <= 0.002) return;
    const ax = lerp(w * 0.12, w * 0.78, rnd(i * 71 + 3)) - widths[i] / 2;
    const ay = lerp(h * 0.16, h * 0.84, rnd(i * 131 + 9));
    const t = ease("cubic", "out", pr);
    ctx.globalAlpha = Math.min(1, pr * 2.5);
    ctx.fillStyle = dark ? f.ground : "#ffffff";
    ctx.fillText(word, lerp(lerp(homeX, ax, spread), homeX, t), lerp(lerp(homeY, ay, spread), homeY, t));
  });
  ctx.globalAlpha = 1;
  ctx.textBaseline = "alphabetic";
}

/* ----------------------------------------------------------------- bleed --- */

function drawBleed(f: Frame) {
  clear(f);
  const { ctx, p, w, h, inks, s } = f;
  const blobs = Math.round(n(f, "bleed", "blobs", 5));
  const size = n(f, "bleed", "size", 0.7);
  const blur = n(f, "bleed", "blur", 30);
  const flow = Math.round(n(f, "bleed", "flow", 1));
  const mode = s_(f, "bleed", "mode", "difference");
  const smear = n(f, "bleed", "smear", 10) * s;
  const steps = Math.round(n(f, "bleed", "steps", 6));

  soften(f, blur, (sc, sw, sh) => {
    sc.fillStyle = f.ground;
    sc.fillRect(0, 0, sw, sh);
    for (let i = 0; i < blobs; i++) {
      const a = p * TAU * flow + (i / blobs) * TAU;
      const rx = lerp(0.14, 0.86, rnd(i * 17 + 1)) * sw + Math.cos(a) * sw * 0.18;
      const ry = lerp(0.14, 0.86, rnd(i * 29 + 7)) * sh + Math.sin(a) * sh * 0.14;
      const rr = Math.max(sw, sh) * size * lerp(0.35, 0.8, rnd(i * 53 + 11));
      const g = sc.createRadialGradient(rx, ry, 0, rx, ry, rr);
      g.addColorStop(0, inkFor(inks, i * 3 + 1));
      g.addColorStop(1, "rgba(0,0,0,0)");
      sc.fillStyle = g;
      sc.fillRect(0, 0, sw, sh);
    }
  });

  const lay = layout(ctx, f.tp, f.fonts, w, h);
  if (!lay.count) return;
  ctx.save();
  ctx.globalCompositeOperation = mode as GlobalCompositeOperation;
  ctx.font = fontOf(f.tp, f.fonts, lay.size);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = inks[0];
  for (const line of lay.lines) {
    if (smear > 0 && steps > 1) {
      const dir = Math.sin(p * TAU + (line.glyphs[0]?.line ?? 0) * 1.3);
      for (let k = steps; k >= 1; k--) {
        ctx.globalAlpha = k === 1 ? 1 : 0.18;
        ctx.fillText(line.text, line.x + dir * smear * (k / steps), line.y);
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.fillText(line.text, line.x, line.y);
    }
  }
  ctx.restore();
}

/* -------------------------------------------------------------- halftone --- */

function drawHalftone(f: Frame) {
  clear(f);
  const { ctx, p, w, h, inks, s } = f;
  const m = mask(f);
  const cell = Math.max(3, n(f, "halftone", "cell", 26) * s);
  const nInks = Math.min(inks.length, Math.round(n(f, "halftone", "inkCount", 4)));
  const swell = n(f, "halftone", "swell", 1.5);
  const spin = Math.round(n(f, "halftone", "spin", 1));
  const wobble = n(f, "halftone", "wobble", 0.35);
  const square = b(f, "halftone", "square", false);

  const diag = Math.hypot(w, h);
  for (let k = 0; k < nInks; k++) {
    const base = [0.262, 1.309, 0, 0.785, 0.524][k % 5];
    const ang = base + p * TAU * spin;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    ctx.fillStyle = inkFor(inks, k);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    const half = diag / 2;
    for (let gy = -half; gy < half; gy += cell) {
      for (let gx = -half; gx < half; gx += cell) {
        const x = w / 2 + gx * cos - gy * sin;
        const y = h / 2 + gx * sin + gy * cos;
        if (x < -cell || y < -cell || x > w + cell || y > h + cell) continue;
        const cover = m.at(x, y);
        if (cover < 0.02) continue;
        const beat = 1 + wobble * Math.sin(p * TAU + (k / nInks) * TAU);
        const r = (cell / 2) * cover * swell * beat;
        if (r < 0.25) continue;
        if (square) ctx.rect(x - r, y - r, r * 2, r * 2);
        else {
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, TAU);
        }
      }
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const DRAW: Record<SceneId, (f: Frame) => void> = {
  stagger: drawStagger,
  strokes: drawStrokes,
  mosaic: drawMosaic,
  arcs: drawArcs,
  field: drawField,
  bleed: drawBleed,
  halftone: drawHalftone,
};

/* ---------------------------------------------------------------- grain --- */

/* Laid over everything at the end, seeded off the frame rather than
   Math.random so two exports of the same piece are identical. Drawn as a
   repeating tile rather than a pixel at a time — the difference between one
   fillRect and hundreds of thousands of them. Eight fields, stepped a whole
   number of times over the loop, so the grain flickers like film and still
   lands back on field zero. */
const GRAIN_FIELDS = 8;
const grainTiles = new Map<string, HTMLCanvasElement>();

function paintGrain(f: Frame, amount: number) {
  if (amount <= 0.001) return;
  const { ctx, w, h, p } = f;
  const step = Math.max(1, Math.round(f.s));
  const field = Math.floor(p * GRAIN_FIELDS * 3) % GRAIN_FIELDS;
  const key = `${step}:${field}`;
  let tile = grainTiles.get(key);
  if (!tile) {
    const cells = 96;
    tile = document.createElement("canvas");
    tile.width = tile.height = cells * step;
    const tc = tile.getContext("2d")!;
    tc.fillStyle = "#000";
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        if (rnd(x * 0.7 + y * 1.3 + field * 31.7) > 0.5) continue;
        tc.fillRect(x * step, y * step, step, step);
      }
    }
    grainTiles.set(key, tile);
  }
  const pat = ctx.createPattern(tile, "repeat");
  if (!pat) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.4, amount);
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/* -------------------------------------------------------------- blotter --- */

const PAPER = "#ffffff";

/**
 * The whole piece reprinted as one ink on paper: blur, then crush the
 * contrast. Blurring turns every edge into a gradient and the crush snaps it
 * back to a hard edge, so a shape's own edge returns almost where it was
 * while two shapes merely *near* each other blur into a shared grey and
 * become one mass — what ink does on paper that drinks it.
 */
function blot(f: Frame, amount: number) {
  const a = Math.max(0, Math.min(100, amount));
  if (a <= 0) return;
  const { ctx, w, h } = f;
  const radius = (a / 100) * 0.022 * Math.min(w, h);
  const pad = Math.ceil(radius * 3) + 2;

  const src = padAt(2, w + pad * 2, h + pad * 2);
  src.fillStyle = PAPER;
  src.fillRect(0, 0, src.canvas.width, src.canvas.height);
  src.drawImage(ctx.canvas, pad, pad);

  ctx.save();
  ctx.filter = `grayscale(1) blur(${radius}px) contrast(${6 + a * 0.6})`;
  ctx.drawImage(src.canvas, pad, pad, w, h, 0, 0, w, h);
  ctx.restore();
}

/* ---------------------------------------------------------------------- */

/** Draw one whole frame: the scene, then the ink spreading if this is a
    blotter, then the grain — the only entry point `kinetic.ts`'s
    `evaluate()` uses, so preview, thumbnail and export can't disagree. */
export function paint(f: Frame, scene: SceneId) {
  f.ctx.save();
  (DRAW[scene] ?? drawStagger)(f);
  f.ctx.restore();

  if (f.blotter) blot(f, f.blot);
  paintGrain(f, f.grain);
}
