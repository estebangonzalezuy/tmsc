// Canvas 2D renderer for the typographic layer of a slide. The same drawing
// code produces the on-screen preview overlay and the exported PNG / video
// frames, so what you see is exactly what downloads.

import {
  FORMATS,
  countAt,
  countWidest,
  fillCount,
  partOn,
  resolveShape,
  slideTones,
  type PostSpec,
  type ShapeSpec,
  type SlideSpec,
} from "@/lib/postlab";
import { BAYER4 } from "./generative";

export type Fonts = { sans: string; serif: string; gothic: string };

// next/font registers hashed family names; read them off the live page.
export async function loadFonts(): Promise<Fonts> {
  await document.fonts.ready;
  const sans = getComputedStyle(document.body).fontFamily;
  const probeFamily = (className: string) => {
    const probe = document.createElement("span");
    probe.className = className;
    probe.textContent = "x";
    document.body.appendChild(probe);
    const family = getComputedStyle(probe).fontFamily;
    probe.remove();
    return family;
  };
  return {
    sans,
    serif: probeFamily("font-serif"),
    gothic: probeFamily("font-gothic"),
  };
}

/* ------------------------------------------------------------- rich text */

/* A word and which voice it is in. `em` doesn't mean italic on its own: it
   means the *other* voice, so a run marked with asterisks comes out italic on
   a roman slide and roman on an italic one. Mixing the two mid-sentence is
   the reference look's whole typographic move — "What the club *saved for
   later* in August" — and it has to survive wrapping, measuring and the
   fit-to-frame search, which is why type is measured a word at a time from
   here on rather than a line at a time. */
type Run = { text: string; em: boolean };

/* A word is a list of runs rather than one, because a voice can change inside
   a word: the full stop after "*learning*" belongs to that word and has to
   stay glued to it, or it wraps onto a line of its own. */
export type Word = Run[];

/** A font for one voice at one size. */
export type Face = (px: number, em: boolean) => string;

/** Split a written line into words, toggling voice at every asterisk. */
function readWords(line: string): Word[] {
  const words: Word[] = [];
  let word: Word = [];
  let em = false;
  line.split("*").forEach((run, i) => {
    if (i > 0) em = !em;
    /* Keeping the separators means a marker that lands mid-word doesn't
       silently insert a space where the writer didn't put one. */
    for (const bit of run.split(/(\s+)/)) {
      if (!bit) continue;
      if (/^\s+$/.test(bit)) {
        if (word.length) words.push(word);
        word = [];
      } else {
        word.push({ text: bit, em });
      }
    }
  });
  if (word.length) words.push(word);
  return words;
}

/* The space between two words belongs to the voice on its left, which is what
   keeps a roman space from opening up between two italic words. */
const spaceWidth = (
  ctx: CanvasRenderingContext2D,
  before: Word,
  face: Face,
  px: number,
) => {
  ctx.font = face(px, before[before.length - 1].em);
  return ctx.measureText(" ").width;
};

const wordWidth = (
  ctx: CanvasRenderingContext2D,
  word: Word,
  face: Face,
  px: number,
) =>
  word.reduce((w, run) => {
    ctx.font = face(px, run.em);
    return w + ctx.measureText(run.text).width;
  }, 0);

const lineWidth = (
  ctx: CanvasRenderingContext2D,
  line: Word[],
  face: Face,
  px: number,
) =>
  line.reduce(
    (w, word, i) =>
      w +
      (i ? spaceWidth(ctx, line[i - 1], face, px) : 0) +
      wordWidth(ctx, word, face, px),
    0,
  );

/** Wrap text to `maxWidth`, honouring the line breaks that were typed. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  face: Face,
  px: number,
): Word[][] {
  const lines: Word[][] = [];
  for (const hard of text.split("\n")) {
    const words = readWords(hard);
    if (!words.length) continue;
    let line: Word[] = [words[0]];
    for (const word of words.slice(1)) {
      if (lineWidth(ctx, [...line, word], face, px) <= maxWidth) line.push(word);
      else {
        lines.push(line);
        line = [word];
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Draw one wrapped line, word by word, switching face as the voice does. */
function drawWords(
  ctx: CanvasRenderingContext2D,
  line: Word[],
  x: number,
  baseline: number,
  face: Face,
  px: number,
) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  let cx = x;
  line.forEach((word, i) => {
    if (i) cx += spaceWidth(ctx, line[i - 1], face, px);
    for (const run of word) {
      ctx.font = face(px, run.em);
      ctx.fillText(run.text, cx, baseline);
      cx += ctx.measureText(run.text).width;
    }
  });
}

/* Circled letter mark: the circle (frame, plus an optional bg backing disc
   for legibility) is structural and always crisp; the character itself is
   ink, drawn onto `textCtx` so it's subject to that group's dithering. */
function circledLetter(
  frameCtx: CanvasRenderingContext2D,
  textCtx: CanvasRenderingContext2D,
  ch: string,
  x: number,
  y: number,
  r: number,
  ink: string,
  bg: string | null,
  font: string,
) {
  frameCtx.beginPath();
  frameCtx.arc(x, y, r, 0, Math.PI * 2);
  if (bg) {
    frameCtx.fillStyle = bg;
    frameCtx.fill();
  }
  frameCtx.strokeStyle = ink;
  frameCtx.stroke();

  /* The mask context is shared with the kicker, the body and the footer, so
     the centring here has to be handed back. Without this, a slide with a
     letter mark or an orbit ring drew its body copy centred on the left
     margin — half of it off the canvas. */
  textCtx.save();
  textCtx.fillStyle = ink;
  textCtx.font = `400 ${Math.round(r * 0.9)}px ${font}`;
  textCtx.textAlign = "center";
  textCtx.textBaseline = "middle";
  textCtx.fillText(ch, x, y + r * 0.05);
  textCtx.restore();
}

const RING_TEXT = "THE MOTION SOCIAL CLUB — ";

/* -------------------------------------------------------------- the shapes */

/* One mark, at the origin, in the club's motif language: outlined or filled,
   nothing else. The caller has already moved, turned and scaled the context, so
   everything here is drawn around (0,0) at radius r. */
function drawMark(
  ctx: CanvasRenderingContext2D,
  kind: string,
  r: number,
  filled: boolean,
) {
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
      /* The club's boxed headline, reduced to its corners. */
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
  /* A line and a cross have no inside, so they are always stroked. */
  if (filled && kind !== "line" && kind !== "cross" && kind !== "arc" && kind !== "bracket")
    ctx.fill(path);
  else ctx.stroke(path);
}

/* Fixed scatter: the same shape and seed always land in the same places, so a
   scattered pattern is part of the design rather than something that crawls. */
const scatter = (seed: number, i: number, k: number) => {
  const x = Math.sin(seed * 91.7 + i * 47.3 + k * 13.1) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

/**
 * A shape and its copies. The deformers are the whole point: `repeat` makes
 * copies, `along` decides where they go, and `spread`, `jitter`, `twist` and
 * `taper` bend the row of them — one mark becomes a pattern without becoming a
 * second layer.
 */
function drawShape(
  ctx: CanvasRenderingContext2D,
  raw: ShapeSpec,
  w: number,
  h: number,
  u: number,
  ink: string,
  tt: number,
) {
  const s = resolveShape(raw, tt);
  const count = Math.max(1, Math.round(s.repeat ?? 1));
  const short = Math.min(w, h);
  const r0 = (s.size * short) / 2;
  const spread = (s.spread ?? 0.25) * short;
  const seed = s.seed ?? 1;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, s.opacity));
  ctx.strokeStyle = s.ink ?? ink;
  ctx.fillStyle = s.ink ?? ink;
  ctx.lineWidth = Math.max(0.5, s.weight * u);
  ctx.lineJoin = "miter";

  for (let i = 0; i < count; i++) {
    /* Copies are laid out around the shape's own position, so the placement you
       set stays the middle of the pattern rather than its first corner. */
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

    const r = r0 * (1 - (s.taper ?? 0) * (count === 1 ? 0 : i / (count - 1)));
    if (r <= 0.5) continue;

    ctx.save();
    ctx.translate(w / 2 + (s.x * w) / 2 + dx, h / 2 + (s.y * h) / 2 + dy);
    ctx.rotate(((s.rotation + (s.twist ?? 0) * i) * Math.PI) / 180);
    drawMark(ctx, s.kind, r, s.weight === 0);
    ctx.restore();
  }
  ctx.restore();
}

/* Scratch canvases: an ink mask per pixelation group (title vs. everything
   else), reused across frames, plus one for the dither downsample. */
function sizedCanvas(cache: { c: HTMLCanvasElement | null }, w: number, h: number) {
  if (!cache.c) cache.c = document.createElement("canvas");
  if (cache.c.width !== w || cache.c.height !== h) {
    cache.c.width = w;
    cache.c.height = h;
  }
  return cache.c;
}
const titleMaskRef: { c: HTMLCanvasElement | null } = { c: null };
const metaMaskRef: { c: HTMLCanvasElement | null } = { c: null };
const ditherRef: { c: HTMLCanvasElement | null } = { c: null };

/**
 * Composite an ink mask (transparent everywhere but the glyphs, drawn in
 * `ink`) onto the destination. `pixel` = 0 draws it crisp as-is; otherwise
 * it's ordered-dithered — averaged into `pixel`-sized cells, each cell
 * thresholded against the club's 4x4 Bayer matrix into pure ink or pure
 * transparent — the same technique as the dithered-forms background, now
 * applied to rendered type. No gray, no gradient: every cell is one flat
 * color with a hard edge.
 */
function compositeMask(
  ctx: CanvasRenderingContext2D,
  mask: HTMLCanvasElement,
  w: number,
  h: number,
  pixel: number,
  ink: string,
) {
  if (pixel <= 0) {
    ctx.drawImage(mask, 0, 0);
    return;
  }
  const cw = Math.max(1, Math.ceil(w / pixel));
  const chh = Math.max(1, Math.ceil(h / pixel));
  const small = sizedCanvas(ditherRef, cw, chh);
  const sctx = small.getContext("2d", { willReadFrequently: true })!;
  sctx.clearRect(0, 0, cw, chh);
  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(mask, 0, 0, cw, chh); // per-cell average coverage

  const img = sctx.getImageData(0, 0, cw, chh);
  const data = img.data;
  const inkR = parseInt(ink.slice(1, 3), 16);
  const inkG = parseInt(ink.slice(3, 5), 16);
  const inkB = parseInt(ink.slice(5, 7), 16);
  for (let cy = 0; cy < chh; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const o = (cy * cw + cx) * 4;
      const coverage = data[o + 3] / 255;
      const threshold = (BAYER4[cy % 4][cx % 4] + 0.5) / 16;
      if (coverage > threshold) {
        data[o] = inkR;
        data[o + 1] = inkG;
        data[o + 2] = inkB;
        data[o + 3] = 255;
      } else {
        data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0;
      }
    }
  }
  sctx.putImageData(img, 0, 0);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, cw, chh, 0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
}

/**
 * The largest size at which the headline still fits `maxW` × `maxH` once
 * wrapped. Binary search rather than arithmetic, because wrapping is a step
 * function: one more character can cost a whole line.
 */
function fitSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  face: Face,
  maxW: number,
  maxH: number,
): number {
  /* The breaks the writer typed. "fit" is not allowed to add any: the panel
     promises that line breaks are yours to place, and a headline that
     re-flows as it grows would make a mess of the one thing this register is
     for. So the size comes down until every typed line stands on its own. */
  const typed = text.split("\n").filter((l) => l.trim()).length;
  const fits = (px: number) => {
    const lines = wrap(ctx, text, maxW, face, px);
    if (lines.length > typed) return false;
    if (lines.length * px * 1.12 > maxH) return false;
    /* A word longer than the frame can't be wrapped out of trouble, so the
       size has to come down until it fits on its own. */
    return lines.every((line) => lineWidth(ctx, line, face, px) <= maxW);
  };
  let lo = 12;
  let hi = 400;
  if (!text.trim()) return lo;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo);
}

/**
 * Draw the full text/motif layer for one slide onto a w×h canvas.
 * `time` (seconds) animates the orbit ring; pass 0 for stills.
 */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  spec: PostSpec,
  index: number,
  fonts: Fonts,
  time = 0,
  /* Export resolution multiplier. Every measurement below is derived from
     `u`, so the type is redrawn at the target size rather than scaled up
     from 1080 — which is the whole point of exporting bigger. */
  scale = 1,
) {
  const slide: SlideSpec = spec.slides[index];
  const base = FORMATS[spec.format];
  const w = Math.round(base.w * scale);
  const h = Math.round(base.h * scale);
  const { ink, bg } = slideTones(slide);
  const u = w / 1080; // design unit: layout was drawn at 1080 wide
  const pad = (slide.margin ?? 96) * u;
  const center = slide.align === "center";

  /* A counting slide reads a different number every frame. `said` puts the
     current value wherever a `#` was written; `widest` is the same words with
     the longest value this counter can reach, which is what the type is
     measured against — a headline that resized itself as digits dropped would
     jump on every tick. */
  const tt = (time / Math.max(2, spec.duration)) % 1;
  const value = slide.count ? countAt(slide.count, tt) : null;
  const said = (text: string) => fillCount(text, value);
  const widest = (text: string) =>
    slide.count ? fillCount(text, countWidest(slide.count)) : text;

  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = 2 * u;

  /* Veil — background-colored wash dimming the shader under the text. */
  if (slide.veil > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.9, slide.veil);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /* The sheet's ruling: a hairline grid in square cells, centred vertically
     so the top and bottom rows are cut equally. It belongs to the paper
     rather than to the words, so it survives the text switch below — and
     `gridTop` draws it last instead, crossing the type the way a ruled sheet
     crosses anything written on it. */
  const drawGrid = () => {
    const cols = slide.grid ?? 0;
    if (cols < 2) return;
    const cell = w / cols;
    const rows = Math.floor(h / cell);
    const offY = (h - rows * cell) / 2;
    ctx.save();
    ctx.globalAlpha = slide.gridAlpha ?? 0.16;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, 1.5 * u);
    ctx.beginPath();
    for (let i = 1; i < cols; i++) {
      const x = Math.round(i * cell) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let j = 0; j <= rows; j++) {
      const y = Math.round(offY + j * cell) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
    ctx.restore();
  };

  if (!slide.gridTop) drawGrid();

  /* The marks. Like the ruling, they belong to the sheet rather than to the
     words — so a slide with the type switched off is still a sheet with marks on
     it, which is a post the club makes often. `under` puts one behind the words;
     everything else is drawn after them, at the bottom of this function. */
  const shapes = partOn(slide, "shapes") ? (slide.shapes ?? []) : [];
  const marks = (under: boolean) => {
    for (const s of shapes) {
      if (!!s.under === under) drawShape(ctx, s, w, h, u, ink, tt);
    }
  };
  marks(true);

  /* Text switch off = the sheet and its marks, no words (the veil still
     applies). */
  if (slide.text === false) {
    marks(false);
    if (slide.gridTop) drawGrid();
    return;
  }

  /* The two decorative lines: the underline under the kicker and the
     hairline above the footer. */
  const rules = partOn(slide, "rules");

  /* What goes in the top-right circle. "auto" is the useful default: a page
     number when there is more than one slide, the letter otherwise. */
  const many = spec.slides.length > 1;
  const mode = slide.mark ?? "auto";
  const pageMark = String(index + 1).padStart(2, "0");
  /* A small label top right — a handle, a source, a credit. There is one
     corner, so a note takes it: a line of words up there says more than a
     letter in a circle does, and both at once is two things in one place. */
  const note = partOn(slide, "note") ? said(slide.note ?? "").trim() : "";
  const markChar = !partOn(slide, "mark")
    ? ""
    : note
      ? ""
      : mode === "none"
        ? ""
        : mode === "page"
          ? pageMark
          : mode === "letter"
            ? slide.letter
            : many
              ? pageMark
              : slide.letter;

  /* Structural elements (plates, box outline, hairlines, circle frames)
     draw straight onto ctx as they're reached below, in their original
     order. Glyphs go into one of two ink masks — title vs. everything
     else — composited on top at the end so each group can be dithered
     independently at its own pixel size. */
  const titleMask = sizedCanvas(titleMaskRef, w, h);
  const metaMask = sizedCanvas(metaMaskRef, w, h);
  const tctx = titleMask.getContext("2d")!;
  const mctx = metaMask.getContext("2d")!;
  tctx.clearRect(0, 0, w, h);
  mctx.clearRect(0, 0, w, h);

  /* Orbit ring — behind the text, letters kept upright, slow spin. The
     circle is structural; the circled letters are ink (meta group). */
  if (slide.ring) {
    const R = Math.min(w, h) * 0.4;
    const cx = w / 2;
    const cy = h / 2;
    ctx.save();
    mctx.save();
    ctx.globalAlpha = 0.5;
    mctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = ink;
    ctx.stroke();
    const letters = RING_TEXT.split("");
    /* Exactly one lap per post, so the last frame of a recording is the
       frame before the first one. The ring reads different letters at each
       position, so a whole lap is the only rotation that comes back to the
       same picture — a slower drift would always leave a jump at the loop. */
    const spin = (time / Math.max(2, spec.duration)) * 2 * Math.PI;
    letters.forEach((ch, i) => {
      if (ch === " ") return;
      const a = (i / letters.length) * Math.PI * 2 - Math.PI / 2 + spin;
      circledLetter(
        ctx,
        mctx,
        ch,
        cx + Math.cos(a) * R,
        cy + Math.sin(a) * R,
        26 * u,
        ink,
        bg,
        fonts.sans,
      );
    });
    ctx.restore();
    mctx.restore();
  }

  /* Filled bg strip behind a run of text; only when the plate is on.
     Structural — always crisp, drawn straight onto ctx. */
  const strip = (x: number, top: number, sw: number, sh: number) => {
    if (!slide.plate) return;
    ctx.fillStyle = bg;
    ctx.fillRect(x - 14 * u, top, sw + 28 * u, sh);
  };

  /* Kicker — small underlined label, top left (or centered). Label is ink
     (meta); the underline is structural. */
  const kicker = said(slide.kicker);
  if (kicker && partOn(slide, "kicker")) {
    mctx.font = `400 ${30 * u}px ${fonts.sans}`;
    mctx.textAlign = center ? "center" : "left";
    mctx.textBaseline = "alphabetic";
    const kx = center ? w / 2 : pad;
    const ky = pad + 30 * u;
    const kw = mctx.measureText(kicker).width;
    strip(center ? kx - kw / 2 : kx, ky - 34 * u, kw, 56 * u);
    mctx.fillStyle = ink;
    mctx.fillText(kicker, kx, ky);
    if (rules) {
      ctx.beginPath();
      ctx.moveTo(center ? kx - kw / 2 : kx, ky + 12 * u);
      ctx.lineTo(center ? kx + kw / 2 : kx + kw, ky + 12 * u);
      ctx.strokeStyle = ink;
      ctx.stroke();
    }
  }

  /* Circled mark, top right (meta group). On a carousel it's the page you're
     on, which is the only thing a mark up there can say that the reader
     doesn't already know; on a single post it's the club's letter. */
  if (markChar) {
    circledLetter(
      ctx,
      mctx,
      markChar,
      w - pad - 20 * u,
      pad + 24 * u,
      44 * u,
      ink,
      null,
      fonts.sans,
    );
  } else if (note) {
    mctx.font = `400 ${30 * u}px ${fonts.sans}`;
    mctx.textAlign = "right";
    mctx.textBaseline = "alphabetic";
    const nw = mctx.measureText(note).width;
    strip(w - pad - nw, pad - 4 * u, nw, 56 * u);
    mctx.fillStyle = ink;
    mctx.fillText(note, w - pad, pad + 30 * u);
  }

  /* Title + body block. Title is its own ink group; body is meta. */
  const sizes = { s: 64, m: 92, l: 128 } as const;
  const bodyPx = 34 * u;
  const bodyLH = bodyPx * 1.45;
  const boxPad = slide.boxed ? 36 * u : 0;
  const maxW = w - 2 * pad - 2 * boxPad;

  /* The oval label above the headline — an issue number, a date, a chapter.
     The outline is structural like every other circle in the club's motifs;
     the characters are ink. */
  const tag = partOn(slide, "tag") ? said(slide.tag ?? "").trim() : "";
  const tagPx = 30 * u;
  const tagH = tag ? 60 * u : 0;
  const tagGap = tag ? 34 * u : 0;

  /* Pirata has one weight drawn and Lora's axis stops at 700; asking a
     variable font for a weight it doesn't have gets you a synthesised one,
     which on a headline this size looks like a mistake. */
  const maxWeight = slide.titleFont === "gothic" ? 400 : slide.titleFont === "serif" ? 700 : 900;
  const weight = Math.min(
    maxWeight,
    slide.titleWeight ??
      (slide.titleFont === "serif" ? 500 : slide.titleFont === "gothic" ? 400 : 600),
  );
  const family =
    slide.titleFont === "serif"
      ? fonts.serif
      : slide.titleFont === "gothic"
        ? fonts.gothic
        : fonts.sans;
  /* `em` is the other voice, not italic outright: an asterisked run reads
     italic on a roman slide and roman on an italic one. */
  const titleFace: Face = (px, em) =>
    `${slide.italic !== em ? "italic " : ""}${weight} ${px}px ${family}`;
  const bodyFace: Face = (px, em) => `${em ? "italic " : ""}400 ${px}px ${fonts.sans}`;

  const bodyLines =
    slide.body && partOn(slide, "body")
      ? wrap(mctx, said(slide.body), Math.min(maxW, 720 * u), bodyFace, bodyPx)
      : [];

  /* "fit" grows the headline until it fills the frame — as big as the words
     allow inside the margin, with the kicker, the body and the footer left
     the room they need. Long copy comes out smaller, short copy comes out
     enormous, and neither ever overflows. */
  let titlePx: number;
  if (slide.titleSize === "fit") {
    const bodyRoom = bodyLines.length ? 40 * u + bodyLines.length * bodyLH : 0;
    /* Top: kicker and letter mark. Bottom: the rule and the footer line. */
    const maxH =
      h - 2 * (pad + 78 * u) - bodyRoom - 2 * boxPad - tagH - tagGap;
    titlePx = fitSize(tctx, widest(slide.title), titleFace, maxW, Math.max(24 * u, maxH));
  } else {
    titlePx = sizes[slide.titleSize] * u;
  }
  const titleLH = titlePx * 1.12;

  const titleLines = partOn(slide, "title")
    ? wrap(tctx, said(slide.title), maxW, titleFace, titlePx)
    : [];
  const titleWidths = titleLines.map((line) =>
    lineWidth(tctx, line, titleFace, titlePx),
  );

  const titleH = titleLines.length * titleLH;
  const bodyH = bodyLines.length ? 40 * u + bodyLines.length * bodyLH : 0;
  const blockH = tagH + tagGap + titleH + 2 * boxPad + bodyH;

  /* Where the block sits. The reserved rooms at the top and bottom are the
     kicker/mark row and the footer row, so an anchored block lands under one
     and above the other rather than on top of them. */
  const room = pad + 96 * u;
  const anchor = slide.anchor ?? "middle";
  const blockTop =
    anchor === "top"
      ? room
      : anchor === "bottom"
        ? Math.max(room, h - room - blockH)
        : (h - blockH) / 2;
  const y = blockTop + tagH + tagGap + boxPad;

  tctx.textBaseline = "alphabetic";
  const tx = center ? w / 2 : pad + boxPad;
  const maxLineW = titleWidths.length ? Math.max(...titleWidths) : 0;

  if (tag) {
    const tagW = ((): number => {
      mctx.font = `400 ${tagPx}px ${fonts.sans}`;
      return mctx.measureText(tag).width;
    })();
    const rx = tagW / 2 + 34 * u;
    const cx = center ? w / 2 : pad + rx;
    const cy = blockTop + tagH / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, tagH / 2, 0, 0, Math.PI * 2);
    if (slide.plate) {
      ctx.fillStyle = bg;
      ctx.fill();
    }
    ctx.strokeStyle = ink;
    ctx.stroke();
    mctx.save();
    mctx.fillStyle = ink;
    mctx.textAlign = "center";
    mctx.textBaseline = "middle";
    mctx.fillText(tag, cx, cy + tagPx * 0.04);
    mctx.restore();
  }

  /* Plate — filled background behind the headline. With a box it fills the
     whole box; otherwise each line gets its own strip, editorial-style.
     Structural — drawn straight onto ctx. */
  if (slide.plate && titleLines.length) {
    ctx.fillStyle = bg;
    if (slide.boxed) {
      const bx = center ? w / 2 - maxLineW / 2 - boxPad : pad;
      ctx.fillRect(bx, y - boxPad, maxLineW + 2 * boxPad, titleH + 2 * boxPad);
    } else {
      const stripPad = 20 * u;
      titleLines.forEach((_, i) => {
        const lw = titleWidths[i];
        const lx = center ? w / 2 - lw / 2 : tx;
        ctx.fillRect(
          lx - stripPad,
          y + i * titleLH - titlePx * 0.12,
          lw + 2 * stripPad,
          titleLH,
        );
      });
    }
  }

  tctx.fillStyle = ink;
  titleLines.forEach((line, i) => {
    const lx = center ? w / 2 - titleWidths[i] / 2 : tx;
    drawWords(tctx, line, lx, y + titlePx * 0.82 + i * titleLH, titleFace, titlePx);
  });

  if (slide.boxed && titleLines.length) {
    const bx = center ? w / 2 - maxLineW / 2 - boxPad : pad;
    ctx.strokeStyle = ink;
    ctx.strokeRect(bx, y - boxPad, maxLineW + 2 * boxPad, titleH + 2 * boxPad);
  }

  if (bodyLines.length) {
    const by = y + titleH + boxPad + 40 * u;
    const bodyWidths = bodyLines.map((line) =>
      lineWidth(mctx, line, bodyFace, bodyPx),
    );
    bodyLines.forEach((_, i) => {
      const lw = bodyWidths[i];
      const lx = center ? w / 2 - lw / 2 : pad;
      strip(lx, by + i * bodyLH - bodyPx * 0.1, lw, bodyLH);
    });
    mctx.save();
    mctx.globalAlpha = 0.78;
    mctx.fillStyle = ink;
    bodyLines.forEach((line, i) => {
      const lx = center ? w / 2 - bodyWidths[i] / 2 : pad;
      drawWords(mctx, line, lx, by + bodyPx * 0.8 + i * bodyLH, bodyFace, bodyPx);
    });
    mctx.restore();
  }

  /* Footer — hairline (structural) + handle left, club short right, both
     meta ink. The page number lives in the top-right circle when there is
     one, so it isn't said twice down here. */
  if (partOn(slide, "footer")) {
    if (rules) {
      ctx.beginPath();
      ctx.moveTo(pad, h - pad - 44 * u);
      ctx.lineTo(w - pad, h - pad - 44 * u);
      ctx.strokeStyle = ink;
      ctx.stroke();
    }
    mctx.font = `400 ${28 * u}px ${fonts.sans}`;
    const footer = said(slide.footer);
    const counter = many && markChar !== pageMark ? `${pageMark} / ${String(spec.slides.length).padStart(2, "0")}` : "tMSC";
    if (footer) strip(pad, h - pad - 30 * u, mctx.measureText(footer).width, 44 * u);
    const cw = mctx.measureText(counter).width;
    strip(w - pad - cw, h - pad - 30 * u, cw, 44 * u);
    mctx.textAlign = "left";
    mctx.fillStyle = ink;
    if (footer) mctx.fillText(footer, pad, h - pad);
    mctx.textAlign = "right";
    mctx.fillText(counter, w - pad, h - pad);
  }

  /* Cell sizes scale with the canvas so the dithered type keeps the same
     coarseness at 4K instead of turning into fine grain. */
  compositeMask(ctx, titleMask, w, h, slide.titlePixel * u, ink);
  compositeMask(ctx, metaMask, w, h, slide.metaPixel * u, ink);

  /* Then the marks that go over the words, and last the ruling, so the sheet's
     lines cross everything written on it. */
  marks(false);
  if (slide.gridTop) drawGrid();
}
