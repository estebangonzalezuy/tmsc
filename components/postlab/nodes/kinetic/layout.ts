// The type machinery every `kinetic` scene shares, ported from the old
// `components/kinetics/type.ts` — adapted to read an explicit params bag
// instead of a `KineticSpec`, and fonts passed in rather than held in a
// module-level slot (a node graph can hold several `kinetic` nodes at once,
// each mid-edit with its own text).
//
// Two things live here:
//
// - **The layout.** Where the lines sit and where each letter sits inside
//   them. `stagger` needs the glyphs; `arcs`/`bleed` need the lines; all of
//   them come from one measurement so two scenes can never disagree about
//   where the word is.
// - **The mask.** The same words drawn white-on-black on an offscreen
//   canvas, with a fast sampler. `strokes`, `mosaic` and `halftone` never
//   draw a letter — they draw a field and ask the mask, pixel by pixel,
//   whether it's inside a word. The letters are never painted; they're the
//   shape of the hole.

import type { Fonts } from "../type";

export type TypeParams = {
  text: string;
  font: "sans" | "serif" | "gothic";
  weight: number;
  caps: boolean;
  /** Share of the frame height, or 0 to fit the frame. */
  size: number;
  /** Px at the format's 1080-wide base. */
  margin: number;
};

export const familyOf = (fonts: Fonts, font: TypeParams["font"]) =>
  font === "serif" ? fonts.serif : font === "gothic" ? fonts.gothic : fonts.sans;

export type Glyph = {
  ch: string;
  cx: number;
  cy: number;
  w: number;
  x: number;
  y: number;
  line: number;
  i: number;
};

export type Line = { text: string; x: number; y: number; w: number; glyphs: Glyph[] };

export type Layout = {
  lines: Line[];
  size: number;
  lead: number;
  box: { x: number; y: number; w: number; h: number };
  count: number;
};

const LEAD = 0.92;
const BASE_W = 1080;

const fontString = (tp: TypeParams, fonts: Fonts, size: number) => `${tp.weight} ${size}px ${familyOf(fonts, tp.font)}`;

const linesOf = (tp: TypeParams) => {
  const raw = tp.caps ? tp.text.toUpperCase() : tp.text;
  return raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
};

/**
 * Measure the headline and place every letter.
 *
 * `size: 0` means fit the frame: grow until the widest line touches the
 * margin or the stack touches the top and bottom, whichever comes first.
 * Binary search rather than arithmetic, since a font's advance widths aren't
 * exactly proportional to its size once hinting is involved.
 */
export function layout(ctx: CanvasRenderingContext2D, tp: TypeParams, fonts: Fonts, w: number, h: number): Layout {
  const rows = linesOf(tp);
  if (!rows.length) return { lines: [], size: 0, lead: 0, box: { x: 0, y: 0, w: 0, h: 0 }, count: 0 };

  const scale = w / BASE_W;
  const margin = tp.margin * scale;
  const maxW = w - margin * 2;
  const maxH = h - margin * 2;

  const widest = (size: number) => {
    ctx.font = fontString(tp, fonts, size);
    return Math.max(...rows.map((r) => ctx.measureText(r).width));
  };

  let size = tp.size > 0 ? tp.size * h : 0;
  if (size <= 0) {
    let lo = 8;
    let hi = Math.max(16, h);
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      const fits = widest(mid) <= maxW && rows.length * mid * LEAD <= maxH;
      if (fits) lo = mid;
      else hi = mid;
    }
    size = lo;
  }

  ctx.font = fontString(tp, fonts, size);
  const lead = size * LEAD;
  const blockH = rows.length * lead;
  const top = (h - blockH) / 2;

  let i = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  const lines: Line[] = rows.map((row, r) => {
    const lw = ctx.measureText(row).width;
    const x = (w - lw) / 2;
    const y = top + r * lead + lead * 0.78;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + lw);
    let cursor = x;
    const glyphs: Glyph[] = [...row].map((ch) => {
      const gw = ctx.measureText(ch).width;
      const g: Glyph = { ch, x: cursor, y, w: gw, cx: cursor + gw / 2, cy: y - size * 0.32, line: r, i: i++ };
      cursor += gw;
      return g;
    });
    return { text: row, x, y, w: lw, glyphs };
  });

  return { lines, size, lead, box: { x: minX, y: top, w: maxX - minX, h: blockH }, count: i };
}

export const fontOf = (tp: TypeParams, fonts: Fonts, size: number) => fontString(tp, fonts, size);

/* ---------------------------------------------------------------- mask --- */

export type Mask = {
  w: number;
  h: number;
  at: (x: number, y: number) => number;
  inside: (x: number, y: number) => boolean;
  layout: Layout;
};

/* Keyed by content (not a single slot) so several `kinetic` nodes live and
   preview at once without thrashing each other's mask every redraw — the
   old studio only ever had one Kinetics spec on screen and could get away
   with a single cached mask; this canvas can hold several nodes with
   different text at once, each redrawing on every clock tick. `evaluate()`
   is a pure function of its params (no node identity available or wanted),
   so the key is exactly the fields the mask geometry depends on — two nodes
   that happen to share every one of those fields correctly share a mask.
   Small and capped: only ever as many entries as nodes currently on screen
   need, so the oldest is dropped once the cache grows past a handful. */
const CACHE_CAP = 12;
const cache = new Map<string, Mask>();

export function maskOf(tp: TypeParams, fonts: Fonts, w: number, h: number): Mask {
  const key = [
    tp.text, tp.font, tp.weight, tp.caps, tp.size, tp.margin,
    Math.round(w), Math.round(h), fonts.sans, fonts.serif, fonts.gothic,
  ].join("|");
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const lay = layout(ctx, tp, fonts, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = fontOf(tp, fonts, lay.size);
  ctx.textBaseline = "alphabetic";
  for (const line of lay.lines) ctx.fillText(line.text, line.x, line.y);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const cw = canvas.width;
  const chh = canvas.height;
  const bytes = new Uint8Array(cw * chh);
  for (let i = 0, j = 0; i < bytes.length; i++, j += 4) bytes[i] = data[j];

  const at = (x: number, y: number) => {
    const ix = x | 0;
    const iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= cw || iy >= chh) return 0;
    return bytes[iy * cw + ix] / 255;
  };

  const mask: Mask = { w: cw, h: chh, at, inside: (x, y) => at(x, y) > 0.5, layout: lay };
  cache.set(key, mask);
  if (cache.size > CACHE_CAP) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return mask;
}
