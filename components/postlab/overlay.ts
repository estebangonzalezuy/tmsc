// Canvas 2D renderer for the typographic layer of a slide. The same drawing
// code produces the on-screen preview overlay and the exported PNG / video
// frames, so what you see is exactly what downloads.

import {
  FORMATS,
  partOn,
  slideTones,
  type PostSpec,
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

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const hard of text.split("\n")) {
    const words = hard.split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    let line = words[0];
    for (const word of words.slice(1)) {
      if (ctx.measureText(line + " " + word).width <= maxWidth) {
        line += " " + word;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
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
  font: (px: number) => string,
  maxW: number,
  maxH: number,
): number {
  const fits = (px: number) => {
    ctx.font = font(px);
    const lines = wrap(ctx, text, maxW);
    if (lines.length * px * 1.12 > maxH) return false;
    /* A word longer than the frame can't be wrapped out of trouble, so the
       size has to come down until it fits on its own. */
    return lines.every((line) => ctx.measureText(line).width <= maxW);
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

  /* Text switch off = pure background (the veil above still applies). */
  if (slide.text === false) return;

  /* The two decorative lines: the underline under the kicker and the
     hairline above the footer. */
  const rules = partOn(slide, "rules");

  /* What goes in the top-right circle. "auto" is the useful default: a page
     number when there is more than one slide, the letter otherwise. */
  const many = spec.slides.length > 1;
  const mode = slide.mark ?? "auto";
  const pageMark = String(index + 1).padStart(2, "0");
  const markChar = !partOn(slide, "mark")
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
  if (slide.kicker && partOn(slide, "kicker")) {
    mctx.font = `400 ${30 * u}px ${fonts.sans}`;
    mctx.textAlign = center ? "center" : "left";
    mctx.textBaseline = "alphabetic";
    const kx = center ? w / 2 : pad;
    const ky = pad + 30 * u;
    const kw = mctx.measureText(slide.kicker).width;
    strip(center ? kx - kw / 2 : kx, ky - 34 * u, kw, 56 * u);
    mctx.fillStyle = ink;
    mctx.fillText(slide.kicker, kx, ky);
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
  }

  /* Title + body block, vertically centered. Title is its own ink group;
     body is meta. */
  const sizes = { s: 64, m: 92, l: 128 } as const;
  const bodyPx = 34 * u;
  const bodyLH = bodyPx * 1.45;
  const boxPad = slide.boxed ? 36 * u : 0;
  const maxW = w - 2 * pad - 2 * boxPad;

  /* Pirata has one weight drawn and Lora's axis stops at 700; asking a
     variable font for a weight it doesn't have gets you a synthesised one,
     which on a headline this size looks like a mistake. */
  const maxWeight = slide.titleFont === "gothic" ? 400 : slide.titleFont === "serif" ? 700 : 900;
  const weight = Math.min(
    maxWeight,
    slide.titleWeight ??
      (slide.titleFont === "serif" ? 500 : slide.titleFont === "gothic" ? 400 : 600),
  );
  const style = slide.italic ? "italic " : "";
  const family =
    slide.titleFont === "serif"
      ? fonts.serif
      : slide.titleFont === "gothic"
        ? fonts.gothic
        : fonts.sans;
  const titleFont = (px: number) => `${style}${weight} ${px}px ${family}`;

  mctx.font = `400 ${bodyPx}px ${fonts.sans}`;
  const bodyLines =
    slide.body && partOn(slide, "body")
      ? wrap(mctx, slide.body, Math.min(maxW, 720 * u))
      : [];

  /* "fit" grows the headline until it fills the frame — as big as the words
     allow inside the margin, with the kicker, the body and the footer left
     the room they need. Long copy comes out smaller, short copy comes out
     enormous, and neither ever overflows. */
  let titlePx: number;
  if (slide.titleSize === "fit") {
    const bodyRoom = bodyLines.length ? 40 * u + bodyLines.length * bodyLH : 0;
    /* Top: kicker and letter mark. Bottom: the rule and the footer line. */
    const maxH = h - 2 * (pad + 78 * u) - bodyRoom - 2 * boxPad;
    titlePx = fitSize(tctx, slide.title, titleFont, maxW, Math.max(24 * u, maxH));
  } else {
    titlePx = sizes[slide.titleSize] * u;
  }
  const titleLH = titlePx * 1.12;

  tctx.font = titleFont(titlePx);
  const titleLines = partOn(slide, "title") ? wrap(tctx, slide.title, maxW) : [];

  const titleH = titleLines.length * titleLH;
  const bodyH = bodyLines.length ? 40 * u + bodyLines.length * bodyLH : 0;
  const blockH = titleH + 2 * boxPad + bodyH;
  const y = (h - blockH) / 2 + boxPad;

  tctx.textAlign = center ? "center" : "left";
  tctx.textBaseline = "alphabetic";
  const tx = center ? w / 2 : pad + boxPad;

  tctx.font = titleFont(titlePx);
  let maxLineW = 0;
  for (const line of titleLines)
    maxLineW = Math.max(maxLineW, tctx.measureText(line).width);

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
      titleLines.forEach((line, i) => {
        const lw = tctx.measureText(line).width;
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
    tctx.fillText(line, tx, y + titlePx * 0.82 + i * titleLH);
  });

  if (slide.boxed && titleLines.length) {
    const bx = center ? w / 2 - maxLineW / 2 - boxPad : pad;
    ctx.strokeStyle = ink;
    ctx.strokeRect(bx, y - boxPad, maxLineW + 2 * boxPad, titleH + 2 * boxPad);
  }

  if (bodyLines.length) {
    const by = y + titleH + boxPad + 40 * u;
    mctx.font = `400 ${bodyPx}px ${fonts.sans}`;
    /* Said out loud rather than inherited: this canvas is shared, and a
       slide without a kicker never sets it. */
    mctx.textAlign = center ? "center" : "left";
    mctx.textBaseline = "alphabetic";
    bodyLines.forEach((line, i) => {
      const lw = mctx.measureText(line).width;
      const lx = center ? w / 2 - lw / 2 : pad;
      strip(lx, by + i * bodyLH - bodyPx * 0.1, lw, bodyLH);
    });
    mctx.save();
    mctx.globalAlpha = 0.78;
    mctx.fillStyle = ink;
    bodyLines.forEach((line, i) => {
      mctx.fillText(line, center ? w / 2 : pad, by + bodyPx * 0.8 + i * bodyLH);
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
    const counter = many && markChar !== pageMark ? `${pageMark} / ${String(spec.slides.length).padStart(2, "0")}` : "tMSC";
    if (slide.footer)
      strip(pad, h - pad - 30 * u, mctx.measureText(slide.footer).width, 44 * u);
    const cw = mctx.measureText(counter).width;
    strip(w - pad - cw, h - pad - 30 * u, cw, 44 * u);
    mctx.textAlign = "left";
    mctx.fillStyle = ink;
    if (slide.footer) mctx.fillText(slide.footer, pad, h - pad);
    mctx.textAlign = "right";
    mctx.fillText(counter, w - pad, h - pad);
  }

  /* Cell sizes scale with the canvas so the dithered type keeps the same
     coarseness at 4K instead of turning into fine grain. */
  compositeMask(ctx, titleMask, w, h, slide.titlePixel * u, ink);
  compositeMask(ctx, metaMask, w, h, slide.metaPixel * u, ink);
}
