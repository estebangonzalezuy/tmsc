// Canvas 2D renderer for the typographic layer of a slide. The same drawing
// code produces the on-screen preview overlay and the exported PNG / video
// frames, so what you see is exactly what downloads.

import { FORMATS, tones, type PostSpec, type SlideSpec } from "@/lib/postlab";

export type Fonts = { sans: string; serif: string };

// next/font registers hashed family names; read them off the live page.
export async function loadFonts(): Promise<Fonts> {
  await document.fonts.ready;
  const sans = getComputedStyle(document.body).fontFamily;
  const probe = document.createElement("span");
  probe.className = "font-serif";
  probe.textContent = "x";
  document.body.appendChild(probe);
  const serif = getComputedStyle(probe).fontFamily;
  probe.remove();
  return { sans, serif };
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

function circledLetter(
  ctx: CanvasRenderingContext2D,
  ch: string,
  x: number,
  y: number,
  r: number,
  ink: string,
  bg: string | null,
  font: string,
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fill();
  }
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.font = `400 ${Math.round(r * 0.9)}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ch, x, y + r * 0.05);
}

const RING_TEXT = "THE MOTION SOCIAL CLUB — ";

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

  /* Orbit ring — behind the text, letters kept upright, slow spin. */
  if (slide.ring) {
    const R = Math.min(w, h) * 0.4;
    const cx = w / 2;
    const cy = h / 2;
    ctx.save();
    ctx.globalAlpha = 0.5;
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
  }

  /* Filled bg strip behind a run of text; only when the plate is on. */
  const strip = (x: number, top: number, sw: number, sh: number) => {
    if (!slide.plate) return;
    ctx.fillStyle = bg;
    ctx.fillRect(x - 14 * u, top, sw + 28 * u, sh);
  };

  /* Kicker — small underlined label, top left (or centered). */
  if (slide.kicker) {
    ctx.font = `400 ${30 * u}px ${fonts.sans}`;
    ctx.textAlign = center ? "center" : "left";
    ctx.textBaseline = "alphabetic";
    const kx = center ? w / 2 : pad;
    const ky = pad + 30 * u;
    const kw = ctx.measureText(slide.kicker).width;
    strip(center ? kx - kw / 2 : kx, ky - 34 * u, kw, 56 * u);
    ctx.fillStyle = ink;
    ctx.fillText(slide.kicker, kx, ky);
    ctx.beginPath();
    ctx.moveTo(center ? kx - kw / 2 : kx, ky + 12 * u);
    ctx.lineTo(center ? kx + kw / 2 : kx + kw, ky + 12 * u);
    ctx.strokeStyle = ink;
    ctx.stroke();
  }

  /* Circled letter mark, top right. */
  if (slide.letter) {
    circledLetter(
      ctx,
      slide.letter,
      w - pad - 20 * u,
      pad + 24 * u,
      44 * u,
      ink,
      null,
      fonts.sans,
    );
  }

  /* Title + body block, vertically centered. */
  const sizes = { s: 64, m: 92, l: 128 } as const;
  const titlePx = sizes[slide.titleSize] * u;
  const titleLH = titlePx * 1.12;
  const bodyPx = 34 * u;
  const bodyLH = bodyPx * 1.45;
  const boxPad = slide.boxed ? 36 * u : 0;
  const maxW = w - 2 * pad - 2 * boxPad;

  const weight = slide.titleFont === "serif" ? 500 : 600;
  const style = slide.italic ? "italic " : "";
  const family = slide.titleFont === "serif" ? fonts.serif : fonts.sans;
  ctx.font = `${style}${weight} ${titlePx}px ${family}`;
  const titleLines = wrap(ctx, slide.title, maxW);

  ctx.font = `400 ${bodyPx}px ${fonts.sans}`;
  const bodyLines = slide.body ? wrap(ctx, slide.body, Math.min(maxW, 720 * u)) : [];

  const titleH = titleLines.length * titleLH;
  const bodyH = bodyLines.length ? 40 * u + bodyLines.length * bodyLH : 0;
  const blockH = titleH + 2 * boxPad + bodyH;
  const y = (h - blockH) / 2 + boxPad;

  ctx.textAlign = center ? "center" : "left";
  ctx.textBaseline = "alphabetic";
  const tx = center ? w / 2 : pad + boxPad;

  ctx.font = `${style}${weight} ${titlePx}px ${family}`;
  let maxLineW = 0;
  for (const line of titleLines)
    maxLineW = Math.max(maxLineW, ctx.measureText(line).width);

  /* Plate — filled background behind the headline. With a box it fills the
     whole box; otherwise each line gets its own strip, editorial-style. */
  if (slide.plate && titleLines.length) {
    ctx.fillStyle = bg;
    if (slide.boxed) {
      const bx = center ? w / 2 - maxLineW / 2 - boxPad : pad;
      ctx.fillRect(bx, y - boxPad, maxLineW + 2 * boxPad, titleH + 2 * boxPad);
    } else {
      const stripPad = 20 * u;
      titleLines.forEach((line, i) => {
        const lw = ctx.measureText(line).width;
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

  ctx.fillStyle = ink;
  titleLines.forEach((line, i) => {
    ctx.fillText(line, tx, y + titlePx * 0.82 + i * titleLH);
  });

  if (slide.boxed && titleLines.length) {
    const bx = center ? w / 2 - maxLineW / 2 - boxPad : pad;
    ctx.strokeStyle = ink;
    ctx.strokeRect(bx, y - boxPad, maxLineW + 2 * boxPad, titleH + 2 * boxPad);
  }

  if (bodyLines.length) {
    const by = y + titleH + boxPad + 40 * u;
    ctx.font = `400 ${bodyPx}px ${fonts.sans}`;
    bodyLines.forEach((line, i) => {
      const lw = ctx.measureText(line).width;
      const lx = center ? w / 2 - lw / 2 : pad;
      strip(lx, by + i * bodyLH - bodyPx * 0.1, lw, bodyLH);
    });
    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = ink;
    bodyLines.forEach((line, i) => {
      ctx.fillText(line, center ? w / 2 : pad, by + bodyPx * 0.8 + i * bodyLH);
    });
    ctx.restore();
  }

  /* Footer — hairline + handle left, slide counter (or club short) right. */
  ctx.beginPath();
  ctx.moveTo(pad, h - pad - 44 * u);
  ctx.lineTo(w - pad, h - pad - 44 * u);
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.font = `400 ${28 * u}px ${fonts.sans}`;
  const counter =
    spec.slides.length > 1
      ? `${String(index + 1).padStart(2, "0")} / ${String(spec.slides.length).padStart(2, "0")}`
      : "tMSC";
  if (slide.footer)
    strip(pad, h - pad - 30 * u, ctx.measureText(slide.footer).width, 44 * u);
  const cw = ctx.measureText(counter).width;
  strip(w - pad - cw, h - pad - 30 * u, cw, 44 * u);
  ctx.textAlign = "left";
  ctx.fillStyle = ink;
  if (slide.footer) ctx.fillText(slide.footer, pad, h - pad);
  ctx.textAlign = "right";
  ctx.fillText(counter, w - pad, h - pad);
}
