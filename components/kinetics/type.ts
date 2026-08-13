// The type machinery every scene in the Kinetics shares.
//
// Two things live here, and every scene needs one or both of them:
//
// - **The layout.** Where the lines sit and where each letter sits inside
//   them. A scene that animates letters (`stagger`) needs the glyphs; a scene
//   that animates whole lines needs the lines; both come from one measurement
//   so two scenes can never disagree about where the word is.
// - **The mask.** The same words drawn white-on-black on an offscreen canvas,
//   with a sampler over it. This is the other half of the studio's argument:
//   a scene like `strokes` or `mosaic` doesn't draw type at all, it draws a
//   field and asks the mask, pixel by pixel, whether it is inside a letter.
//   The letters are never painted; they are the shape of the hole.
//
// The mask is built once per size and cached, because reading it back with
// getImageData is the one genuinely expensive thing in this studio and doing
// it every frame would cost more than everything else put together.

import type { Fonts } from "@/components/postlab/overlay";
import { FORMATS, type KineticSpec } from "@/lib/kinetics";

export type { Fonts };

export const familyOf = (fonts: Fonts, font: KineticSpec["font"]) =>
  font === "serif" ? fonts.serif : font === "gothic" ? fonts.gothic : fonts.sans;

export type Glyph = {
  ch: string;
  /** Centre of the glyph, in canvas units. */
  cx: number;
  cy: number;
  w: number;
  /** Left edge, for drawing with the default alphabetic baseline. */
  x: number;
  y: number;
  line: number;
  /** Place in the whole headline, so a stagger can order by it. */
  i: number;
};

export type Line = {
  text: string;
  x: number;
  y: number;
  w: number;
  glyphs: Glyph[];
};

export type Layout = {
  lines: Line[];
  size: number;
  lead: number;
  /** The block's bounding box, for scenes that frame the words rather than
      set them. */
  box: { x: number; y: number; w: number; h: number };
  count: number;
};

const LEAD = 0.92;

const fontString = (spec: KineticSpec, fonts: Fonts, size: number) =>
  `${spec.weight} ${size}px ${familyOf(fonts, spec.font)}`;

const linesOf = (spec: KineticSpec) => {
  const raw = spec.caps ? spec.text.toUpperCase() : spec.text;
  return raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
};

/**
 * Measure the headline and place every letter.
 *
 * `size: 0` means fit the frame: grow until the widest line touches the margin
 * or the stack touches the top and bottom, whichever comes first. Binary
 * search rather than arithmetic, because a font's advance widths are not
 * exactly proportional to its size once hinting is involved.
 */
export function layout(
  ctx: CanvasRenderingContext2D,
  spec: KineticSpec,
  w: number,
  h: number,
): Layout {
  const rows = linesOf(spec);
  if (!rows.length) {
    return { lines: [], size: 0, lead: 0, box: { x: 0, y: 0, w: 0, h: 0 }, count: 0 };
  }
  const scale = w / FORMATS[spec.format].w;
  const margin = spec.margin * scale;
  const maxW = w - margin * 2;
  const maxH = h - margin * 2;

  const widest = (size: number) => {
    ctx.font = fontString(spec, fonts_, size);
    return Math.max(...rows.map((r) => ctx.measureText(r).width));
  };

  let size = spec.size > 0 ? spec.size * h : 0;
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

  ctx.font = fontString(spec, fonts_, size);
  const lead = size * LEAD;
  const blockH = rows.length * lead;
  const top = (h - blockH) / 2;

  let i = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  const lines: Line[] = rows.map((row, r) => {
    const lw = ctx.measureText(row).width;
    const x = (w - lw) / 2;
    /* Baseline sits a little above the row's bottom so the block reads
       optically centred rather than measured-centred. */
    const y = top + r * lead + lead * 0.78;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + lw);
    let cursor = x;
    const glyphs: Glyph[] = [...row].map((ch) => {
      const gw = ctx.measureText(ch).width;
      const g: Glyph = {
        ch,
        x: cursor,
        y,
        w: gw,
        cx: cursor + gw / 2,
        cy: y - size * 0.32,
        line: r,
        i: i++,
      };
      cursor += gw;
      return g;
    });
    return { text: row, x, y, w: lw, glyphs };
  });

  return {
    lines,
    size,
    lead,
    box: { x: minX, y: top, w: maxX - minX, h: blockH },
    count: i,
  };
}

/* `layout` needs the family before it can measure, and threading fonts through
   every helper made the signatures unreadable. The module holds the current
   set instead — there is exactly one in the page, and it is set before any
   scene draws. */
let fonts_: Fonts = { sans: "sans-serif", serif: "serif", gothic: "sans-serif" };
export const adoptFonts = (f: Fonts) => {
  fonts_ = f;
};

export const fontOf = (spec: KineticSpec, size: number) => fontString(spec, fonts_, size);

/* ---------------------------------------------------------------- mask --- */

/**
 * The words as a field: white where a letter is, black where it isn't, with a
 * sampler over the pixels.
 *
 * Scenes ask `inside(x, y)` a few hundred thousand times a frame, so this
 * reads the whole thing into a Uint8 once and indexes it directly rather than
 * calling getImageData per lookup — which is the difference between this
 * studio running at 60fps and at 4.
 */
export type Mask = {
  w: number;
  h: number;
  /** 0-1 coverage at a canvas coordinate. Outside the frame reads 0. */
  at: (x: number, y: number) => number;
  inside: (x: number, y: number) => boolean;
  canvas: HTMLCanvasElement;
  layout: Layout;
};

let cache: { key: string; mask: Mask } | null = null;

export function maskOf(spec: KineticSpec, w: number, h: number): Mask {
  const key = [
    spec.text, spec.font, spec.weight, spec.caps, spec.size, spec.margin,
    spec.format, Math.round(w), Math.round(h), fonts_.sans, fonts_.serif,
  ].join("|");
  if (cache && cache.key === key) return cache.mask;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const lay = layout(ctx, spec, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = fontOf(spec, lay.size);
  ctx.textBaseline = "alphabetic";
  for (const line of lay.lines) ctx.fillText(line.text, line.x, line.y);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const cw = canvas.width;
  const chh = canvas.height;
  /* One byte a pixel: the red channel is enough for a white-on-black mask, and
     a quarter of the memory keeps the whole thing in cache. */
  const bytes = new Uint8Array(cw * chh);
  for (let i = 0, j = 0; i < bytes.length; i++, j += 4) bytes[i] = data[j];

  const at = (x: number, y: number) => {
    const ix = x | 0;
    const iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= cw || iy >= chh) return 0;
    return bytes[iy * cw + ix] / 255;
  };

  const mask: Mask = {
    w: cw,
    h: chh,
    at,
    inside: (x, y) => at(x, y) > 0.5,
    canvas,
    layout: lay,
  };
  cache = { key, mask };
  return mask;
}

/** Drop the cached mask — for when the fonts finish loading after a first
    draw, which would otherwise leave a mask measured in Times. */
export const forgetMask = () => {
  cache = null;
};
