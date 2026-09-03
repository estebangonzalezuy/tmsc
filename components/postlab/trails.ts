// Trails — soft, glowing colour bands sweeping the frame on a bow. The
// club's pixels have one register (ordered-dither forms, hard-edged); this
// is the smooth one, built after Light Rails (light-stroke-rail.vercel.app):
// canvas 2D, no threshold, a blurred stroke rather than a screen of cells.
// Named "trails" rather than "rays" — that name was already the WebGL clean
// family's own god-rays shader, and the two are different techniques.
//
// Same two contracts every generative layer here keeps:
//
// - Periodic in the post's own duration. `ph` grows by a whole number of
//   cycles over one loop, and every animated quantity is `sin`/`cos` of
//   `TAU · ph` (or a multiple of it), so frame 0 and frame `duration` are
//   the same frame and a recording can't open a seam.
// - Never still. The band field sways and bows on its own — `speed` sets
//   how fast, never whether — because a still graphic is not something
//   this studio hands back.
//
// The glow is the one expensive-looking part and the cheapest to draw: the
// bands are painted crisp into a small offscreen canvas (an eighth size,
// the same ratio Kinetics' own soften() uses) and blurred there with the
// canvas `filter` — blurring a lot fewer pixels — then scaled back up.
// Kinetics' version isn't reusable here (it's typed around that studio's
// own Frame, and the two studios keep separate renderers on purpose), so
// this is a small local copy of the same technique, not a new idea.

import { resolveLayer, tones, type LayerSpec, type ShaderSpec, type Theme } from "@/lib/postlab";
import type { FilterSpec } from "@/lib/postlab";
import { applyFilters } from "./filters";

const TAU = Math.PI * 2;

const num = (v: unknown, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : def;

/* Reusable scratch canvases, the same pattern overlay.ts's sizedCanvas
   keeps: a ref object at module scope so it survives across frames instead
   of allocating one every draw. */
const smallRef: { c: HTMLCanvasElement | null } = { c: null };
const blurRef: { c: HTMLCanvasElement | null } = { c: null };

function sizedCanvas(cache: { c: HTMLCanvasElement | null }, w: number, h: number) {
  if (!cache.c) cache.c = document.createElement("canvas");
  if (cache.c.width !== w || cache.c.height !== h) {
    cache.c.width = w;
    cache.c.height = h;
  }
  return cache.c;
}

export function drawTrails(
  ctx: CanvasRenderingContext2D,
  spec: ShaderSpec,
  theme: Theme,
  t: number,
  duration: number,
  w: number,
  h: number,
  color?: {
    ink?: string;
    /** Only for `ink: "mix"` — one colour per band, cycling. */
    palette?: readonly string[];
  },
) {
  const D = Math.max(2, duration);
  const tt = (((t % D) + D) % D) / D;
  const s = resolveLayer(spec as LayerSpec, tt);

  const speed = num(s.speed, 0.6);
  const cycles = Math.max(1, Math.round(speed * 3));
  const ph = tt * cycles;

  const count = Math.max(1, Math.min(6, Math.round(num(s.count, 3))));
  const width = Math.max(0.02, num(s.width, 0.14));
  const curve = Math.max(0, Math.min(1, num(s.curve, 0.35)));
  const spread = Math.max(0.1, num(s.spread, 0.55));
  const glow = Math.max(0, Math.min(100, num(s.glow, 55)));
  const angle = (num(s.angle, 20) * Math.PI) / 180;

  const themeInk = tones(theme).ink;
  const bandColor = (i: number) => {
    if (color?.ink === "mix") {
      const list = color.palette?.length ? color.palette : [themeInk];
      return list[i % list.length];
    }
    return color?.ink || themeInk;
  };

  /* Full resolution when nothing is asked for; an eighth once glow is on —
     as coarse as this can go before the bands themselves start stepping. */
  const q = glow <= 0 ? 1 : 0.125;
  const sw = Math.max(16, Math.round(w * q));
  const sh = Math.max(16, Math.round(h * q));
  const short = Math.min(sw, sh);
  const diag = Math.hypot(sw, sh) * 0.75;
  /* Radius in the small canvas's own units, padded so the blur doesn't
     sample past its own edge and fade the bands out at the frame's border. */
  const radius = Math.pow(glow / 100, 1.2) * 0.045 * short;
  const pad = Math.ceil(radius * 2.4);

  const small = sizedCanvas(smallRef, sw + pad * 2, sh + pad * 2);
  const sctx = small.getContext("2d")!;
  sctx.clearRect(0, 0, small.width, small.height);
  sctx.save();
  sctx.translate(pad, pad);

  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const px = -dy;
  const py = dx;
  const cx = sw / 2;
  const cy = sh / 2;

  sctx.lineCap = "round";
  sctx.lineWidth = Math.max(1, width * short);
  for (let i = 0; i < count; i++) {
    const frac = count === 1 ? 0 : i / (count - 1) - 0.5;
    /* A gentle sway on top of the fixed spacing, out of phase band to band
       so the whole field reads as one drifting thing rather than count
       copies moving in lockstep. */
    const sway = Math.sin(TAU * ph + i * 0.7) * spread * 0.12 * short;
    const along = frac * spread * short + sway;
    const bow = curve * diag * 0.3 * Math.sin(TAU * ph * 0.5 + i * 1.3);

    const x0 = cx - dx * diag + px * along;
    const y0 = cy - dy * diag + py * along;
    const x1 = cx + dx * diag + px * along;
    const y1 = cy + dy * diag + py * along;
    const mx = (x0 + x1) / 2 + px * bow;
    const my = (y0 + y1) / 2 + py * bow;

    sctx.globalAlpha = 0.92;
    sctx.strokeStyle = bandColor(i);
    sctx.beginPath();
    sctx.moveTo(x0, y0);
    sctx.quadraticCurveTo(mx, my, x1, y1);
    sctx.stroke();
  }
  sctx.restore();

  let src: HTMLCanvasElement = small;
  if (radius > 0.4) {
    const blurred = sizedCanvas(blurRef, small.width, small.height);
    const bctx = blurred.getContext("2d")!;
    bctx.clearRect(0, 0, blurred.width, blurred.height);
    bctx.filter = `blur(${radius}px)`;
    bctx.drawImage(small, 0, 0);
    bctx.filter = "none";
    src = blurred;
  }

  /* Composited with the layer's own transform (drag / pinch / rotate),
     the same block every other layer type honours. Nothing fills the
     background first, so stacked layers combine on their own. */
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  const c2x = w / 2;
  const c2y = h / 2;
  ctx.translate(c2x + num(s.offsetX, 0) * w, c2y + num(s.offsetY, 0) * h);
  ctx.rotate((num(s.rotation, 0) * Math.PI) / 180);
  const sc = Math.max(0.1, num(s.scale, 1));
  ctx.scale(sc, sc);
  ctx.translate(-c2x, -c2y);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, pad, pad, sw, sh, 0, 0, w, h);
  ctx.restore();

  applyFilters(ctx, w, h, s.filters as FilterSpec[] | undefined, theme, themeInk);
}
