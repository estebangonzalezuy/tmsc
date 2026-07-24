// Canvas 2D renderer for the typographic layer of a slide. The same drawing
// code produces the on-screen preview overlay and the exported PNG / video
// frames, so what you see is exactly what downloads.

import { FORMATS, tones, type PostSpec, type SlideSpec } from "@/lib/postlab";
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

  textCtx.fillStyle = ink;
  textCtx.font = `400 ${Math.round(r * 0.9)}px ${font}`;
  textCtx.textAlign = "center";
  textCtx.textBaseline = "middle";
  textCtx.fillText(ch, x, y + r * 0.05);
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
 * Draw the full text/motif layer for one slide onto a w×h canvas.
 * `time` (seconds) animates the orbit ring; pass 0 for stills.
 */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  spec: PostSpec,
  index: number,
  fonts: Fonts,
  time = 0,
) {
  const slide: SlideSpec = spec.slides[index];
  const { w, h } = FORMATS[spec.format];
  const { ink, bg } = tones(slide.theme);
  const u = w / 1080; // design unit: layout was drawn at 1080 wide
  const pad = 96 * u;
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
    const spin = (time * 2 * Math.PI) / 90; // one lap every 90s
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
  if (slide.kicker) {
    mctx.font = `400 ${30 * u}px ${fonts.sans}`;
    mctx.textAlign = center ? "center" : "left";
    mctx.textBaseline = "alphabetic";
    const kx = center ? w / 2 : pad;
    const ky = pad + 30 * u;
    const kw = mctx.measureText(slide.kicker).width;
    strip(center ? kx - kw / 2 : kx, ky - 34 * u, kw, 56 * u);
    mctx.fillStyle = ink;
    mctx.fillText(slide.kicker, kx, ky);
    ctx.beginPath();
    ctx.moveTo(center ? kx - kw / 2 : kx, ky + 12 * u);
    ctx.lineTo(center ? kx + kw / 2 : kx + kw, ky + 12 * u);
    ctx.strokeStyle = ink;
    ctx.stroke();
  }

  /* Circled letter mark, top right (meta group). */
  if (slide.letter) {
    circledLetter(
      ctx,
      mctx,
      slide.letter,
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
  const titlePx = sizes[slide.titleSize] * u;
  const titleLH = titlePx * 1.12;
  const bodyPx = 34 * u;
  const bodyLH = bodyPx * 1.45;
  const boxPad = slide.boxed ? 36 * u : 0;
  const maxW = w - 2 * pad - 2 * boxPad;

  const weight =
    slide.titleFont === "serif" ? 500 : slide.titleFont === "gothic" ? 400 : 600;
  const style = slide.italic ? "italic " : "";
  const family =
    slide.titleFont === "serif"
      ? fonts.serif
      : slide.titleFont === "gothic"
        ? fonts.gothic
        : fonts.sans;
  tctx.font = `${style}${weight} ${titlePx}px ${family}`;
  const titleLines = wrap(tctx, slide.title, maxW);

  mctx.font = `400 ${bodyPx}px ${fonts.sans}`;
  const bodyLines = slide.body ? wrap(mctx, slide.body, Math.min(maxW, 720 * u)) : [];

  const titleH = titleLines.length * titleLH;
  const bodyH = bodyLines.length ? 40 * u + bodyLines.length * bodyLH : 0;
  const blockH = titleH + 2 * boxPad + bodyH;
  const y = (h - blockH) / 2 + boxPad;

  tctx.textAlign = center ? "center" : "left";
  tctx.textBaseline = "alphabetic";
  const tx = center ? w / 2 : pad + boxPad;

  tctx.font = `${style}${weight} ${titlePx}px ${family}`;
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

  /* Footer — hairline (structural) + handle left, slide counter (or club
     short) right, both meta ink. */
  ctx.beginPath();
  ctx.moveTo(pad, h - pad - 44 * u);
  ctx.lineTo(w - pad, h - pad - 44 * u);
  ctx.strokeStyle = ink;
  ctx.stroke();
  mctx.font = `400 ${28 * u}px ${fonts.sans}`;
  const counter =
    spec.slides.length > 1
      ? `${String(index + 1).padStart(2, "0")} / ${String(spec.slides.length).padStart(2, "0")}`
      : "tMSC";
  if (slide.footer)
    strip(pad, h - pad - 30 * u, mctx.measureText(slide.footer).width, 44 * u);
  const cw = mctx.measureText(counter).width;
  strip(w - pad - cw, h - pad - 30 * u, cw, 44 * u);
  mctx.textAlign = "left";
  mctx.fillStyle = ink;
  if (slide.footer) mctx.fillText(slide.footer, pad, h - pad);
  mctx.textAlign = "right";
  mctx.fillText(counter, w - pad, h - pad);

  compositeMask(ctx, titleMask, w, h, slide.titlePixel, ink);
  compositeMask(ctx, metaMask, w, h, slide.metaPixel, ink);
}
