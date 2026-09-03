// `type` — the club's typographic engine, ported from the old overlay.ts
// almost verbatim (the word-level rich-text measurement, the fit-to-frame
// search, the sheet's ruling) but trimmed to the params this pass asks for:
// kicker, title, body, footer, tag, note, titleFont, italic, titleSize,
// align, margin, anchor, grid — plus explicit `ink`/`ground` hex params
// (colour-agnostic now; no slide `theme` to read).
//
// Composites over an optional `in` port (a field/photo/mix upstream) or
// fills flat `ground` when nothing is wired — that's what makes
// `field -> type -> frame` in defaultGraph() actually draw a background
// under the words.
//
// Dropped from the old SlideSpec surface, out of scope for this trimmed set:
// plate, boxed, ring, mark/letter, count (the counting-slide "#" engine —
// lib/tools.ts territory, itself deleted), veil, and the per-group
// pixel-dither masking (compositeMask) — words are drawn crisp, straight
// onto the output canvas. A future pass can reintroduce any of these as
// their own params without disturbing this file's shape.

import type { NodeDef, NodeKindImpl, ParamValue } from "@/lib/postgraph";
import { num, str, bool, clamp, makeCanvas } from "./util";

/* -------------------------------------------------------------- fonts -- */

export type Fonts = { sans: string; serif: string; gothic: string };

let fontsCache: Fonts | null = null;
let fontsPending = false;

/* Same graceful-degradation shape as the old overlay.ts: evaluate() can't be
   async, so fonts are loaded once at module scope and evaluate falls back to
   generic families until document.fonts.ready resolves. */
export function loadFonts(): Promise<Fonts> {
  if (fontsCache) return Promise.resolve(fontsCache);
  const probeFamily = (className: string) => {
    const probe = document.createElement("span");
    probe.className = className;
    probe.textContent = "x";
    document.body.appendChild(probe);
    const family = getComputedStyle(probe).fontFamily;
    probe.remove();
    return family;
  };
  return document.fonts.ready.then(() => {
    fontsCache = {
      sans: getComputedStyle(document.body).fontFamily,
      serif: probeFamily("font-serif"),
      gothic: probeFamily("font-gothic"),
    };
    return fontsCache;
  });
}

function ensureFonts() {
  if (fontsCache || fontsPending || typeof document === "undefined") return;
  fontsPending = true;
  void loadFonts().finally(() => {
    fontsPending = false;
  });
}

const fallbackFonts = (): Fonts => ({ sans: "sans-serif", serif: "serif", gothic: "sans-serif" });

/** The synchronous half of the fonts cache, exported so other node kinds
    (`kinetic`) can share the one cache this module already loads rather than
    building a second one — `evaluate()` can't be async anywhere in this
    studio, so every caller kicks off loading and falls back to generic
    families until `document.fonts.ready` resolves. */
export function currentFonts(): Fonts {
  ensureFonts();
  return fontsCache ?? fallbackFonts();
}

/* -------------------------------------------------------------- rich text */

/* A word and which voice it is in — `em` means "the other voice", so a run
   marked with asterisks comes out italic on a roman headline and roman on an
   italic one. */
type Run = { text: string; em: boolean };
type Word = Run[];
type Face = (px: number, em: boolean) => string;

function readWords(line: string): Word[] {
  const words: Word[] = [];
  let word: Word = [];
  let em = false;
  line.split("*").forEach((run, i) => {
    if (i > 0) em = !em;
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

const spaceWidth = (ctx: CanvasRenderingContext2D, before: Word, face: Face, px: number) => {
  ctx.font = face(px, before[before.length - 1].em);
  return ctx.measureText(" ").width;
};

const wordWidth = (ctx: CanvasRenderingContext2D, word: Word, face: Face, px: number) =>
  word.reduce((w, run) => {
    ctx.font = face(px, run.em);
    return w + ctx.measureText(run.text).width;
  }, 0);

const lineWidth = (ctx: CanvasRenderingContext2D, line: Word[], face: Face, px: number) =>
  line.reduce((w, word, i) => w + (i ? spaceWidth(ctx, line[i - 1], face, px) : 0) + wordWidth(ctx, word, face, px), 0);

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, face: Face, px: number): Word[][] {
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

function drawWords(ctx: CanvasRenderingContext2D, line: Word[], x: number, baseline: number, face: Face, px: number) {
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

/** The largest size at which the text still fits maxW x maxH once wrapped,
    without ever inserting a break the writer didn't type. Binary search,
    since wrapping is a step function. */
function fitSize(ctx: CanvasRenderingContext2D, text: string, face: Face, maxW: number, maxH: number): number {
  const typed = text.split("\n").filter((l) => l.trim()).length;
  const fits = (px: number) => {
    const lines = wrap(ctx, text, maxW, face, px);
    if (lines.length > typed) return false;
    if (lines.length * px * 1.12 > maxH) return false;
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

/* ------------------------------------------------------------------ node */

export const def: NodeDef = {
  kind: "type",
  label: "Type",
  hint: "The club's editorial headline, kicker and footer — the sheet, laid over whatever's wired into it.",
  inputs: ["in"],
  outputs: ["out"],
  controls: [
    { key: "margin", label: "margin", min: 32, max: 200, step: 1, def: 96 },
    { key: "grid", label: "ruling columns", min: 0, max: 16, step: 1, def: 0 },
  ],
  choices: [
    { key: "titleFont", label: "voice", values: ["sans", "serif", "gothic"], def: "sans" },
    { key: "titleSize", label: "size", values: ["fit", "s", "m", "l"], def: "fit" },
    { key: "align", label: "align", values: ["left", "center"], def: "left" },
    { key: "anchor", label: "anchor", values: ["top", "middle", "bottom"], def: "middle" },
  ],
  texts: [
    { key: "kicker", label: "kicker" },
    { key: "tag", label: "tag" },
    { key: "title", label: "title", rows: 4 },
    { key: "body", label: "body", rows: 3 },
    { key: "footer", label: "footer" },
    { key: "note", label: "note" },
  ],
};

function defaultParams(): Record<string, ParamValue> {
  return {
    kicker: "",
    title: "",
    body: "",
    footer: "",
    tag: "",
    note: "",
    titleFont: "sans",
    italic: false,
    titleSize: "fit",
    align: "left",
    margin: 96,
    anchor: "middle",
    grid: 0,
    ink: "#000000",
    ground: "#ffffff",
  };
}

const SIZES = { s: 64, m: 92, l: 128 } as const;

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, u: number, cols: number, ink: string) {
  if (cols < 2) return;
  const cell = w / cols;
  const rows = Math.floor(h / cell);
  const offY = (h - rows * cell) / 2;
  ctx.save();
  ctx.globalAlpha = 0.16;
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
}

function evaluate(
  params: Record<string, ParamValue>,
  inputs: Record<string, HTMLCanvasElement | null>,
  _p: number,
  w: number,
  h: number,
): HTMLCanvasElement {
  ensureFonts();
  const fonts = fontsCache ?? fallbackFonts();

  const out = makeCanvas(w, h);
  const ctx = out.getContext("2d")!;
  const ink = str(params.ink, "#000000");
  const ground = str(params.ground, "#ffffff");

  /* The ground fills first, always — an upstream field/shape/photo draws
     transparent wherever it has no ink of its own (the same "nothing fills
     the background" rule the old dithered layers kept, so stacked nodes
     combine on their own), and composites on top of it rather than
     replacing it. This is what makes `field -> type -> frame` in
     defaultGraph() draw an actual filled sheet under the words instead of a
     mostly-transparent PNG. */
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, w, h);
  if (inputs.in) ctx.drawImage(inputs.in, 0, 0, w, h);

  const u = w / 1080;
  const margin = clamp(num(params.margin, 96), 32, 200);
  const pad = margin * u;
  const center = str(params.align, "left") === "center";
  const anchor = str(params.anchor, "middle");
  const grid = clamp(Math.round(num(params.grid, 0)), 0, 16);

  drawGrid(ctx, w, h, u, grid, ink);

  const kicker = str(params.kicker, "").trim();
  const tag = str(params.tag, "").trim();
  const title = str(params.title, "");
  const body = str(params.body, "").trim();
  const footer = str(params.footer, "").trim();
  const note = str(params.note, "").trim();

  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;

  if (kicker) {
    ctx.font = `400 ${30 * u}px ${fonts.sans}`;
    ctx.textAlign = center ? "center" : "left";
    ctx.textBaseline = "alphabetic";
    const kx = center ? w / 2 : pad;
    const ky = pad + 30 * u;
    const kw = ctx.measureText(kicker).width;
    ctx.fillText(kicker, kx, ky);
    ctx.beginPath();
    ctx.moveTo(center ? kx - kw / 2 : kx, ky + 12 * u);
    ctx.lineTo(center ? kx + kw / 2 : kx + kw, ky + 12 * u);
    ctx.stroke();
  }

  if (note) {
    ctx.font = `400 ${30 * u}px ${fonts.sans}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(note, w - pad, pad + 30 * u);
  }

  const maxWeight = params.titleFont === "gothic" ? 400 : params.titleFont === "serif" ? 700 : 900;
  const weight = params.titleFont === "serif" ? 500 : params.titleFont === "gothic" ? 400 : 600;
  const family = params.titleFont === "serif" ? fonts.serif : params.titleFont === "gothic" ? fonts.gothic : fonts.sans;
  const italic = bool(params.italic, false);
  const titleFace: Face = (px, em) => `${italic !== em ? "italic " : ""}${Math.min(maxWeight, weight)} ${px}px ${family}`;
  const bodyFace: Face = (px, em) => `${em ? "italic " : ""}400 ${px}px ${fonts.sans}`;

  const boxPad = 0;
  const maxW = w - 2 * pad;
  const tagPx = 30 * u;
  const tagH = tag ? 60 * u : 0;
  const tagGap = tag ? 34 * u : 0;

  const bodyPx = 34 * u;
  const bodyLH = bodyPx * 1.45;
  const bodyLines = body ? wrap(ctx, body, Math.min(maxW, 720 * u), bodyFace, bodyPx) : [];

  let titlePx: number;
  const titleSize = str(params.titleSize, "fit");
  if (titleSize === "fit") {
    const bodyRoom = bodyLines.length ? 40 * u + bodyLines.length * bodyLH : 0;
    const maxH = h - 2 * (pad + 78 * u) - bodyRoom - tagH - tagGap;
    titlePx = fitSize(ctx, title, titleFace, maxW, Math.max(24 * u, maxH));
  } else {
    titlePx = (SIZES[titleSize as keyof typeof SIZES] ?? SIZES.m) * u;
  }
  const titleLH = titlePx * 1.12;
  const titleLines = title ? wrap(ctx, title, maxW, titleFace, titlePx) : [];
  const titleWidths = titleLines.map((line) => lineWidth(ctx, line, titleFace, titlePx));
  const titleH = titleLines.length * titleLH;
  const bodyH = bodyLines.length ? 40 * u + bodyLines.length * bodyLH : 0;
  const blockH = tagH + tagGap + titleH + bodyH;

  const room = pad + 96 * u;
  const blockTop = anchor === "top" ? room : anchor === "bottom" ? Math.max(room, h - room - blockH) : (h - blockH) / 2;
  const y = blockTop + tagH + tagGap + boxPad;
  const tx = center ? w / 2 : pad;

  if (tag) {
    ctx.font = `400 ${tagPx}px ${fonts.sans}`;
    const tagW = ctx.measureText(tag).width;
    const rx = tagW / 2 + 34 * u;
    const cx = center ? w / 2 : pad + rx;
    const cy = blockTop + tagH / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, tagH / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tag, cx, cy + tagPx * 0.04);
  }

  titleLines.forEach((line, i) => {
    const lx = center ? w / 2 - titleWidths[i] / 2 : tx;
    drawWords(ctx, line, lx, y + titlePx * 0.82 + i * titleLH, titleFace, titlePx);
  });

  if (bodyLines.length) {
    const by = y + titleH + 40 * u;
    const bodyWidths = bodyLines.map((line) => lineWidth(ctx, line, bodyFace, bodyPx));
    ctx.save();
    ctx.globalAlpha = 0.78;
    bodyLines.forEach((line, i) => {
      const lx = center ? w / 2 - bodyWidths[i] / 2 : pad;
      drawWords(ctx, line, lx, by + bodyPx * 0.8 + i * bodyLH, bodyFace, bodyPx);
    });
    ctx.restore();
  }

  if (footer) {
    ctx.beginPath();
    ctx.moveTo(pad, h - pad - 44 * u);
    ctx.lineTo(w - pad, h - pad - 44 * u);
    ctx.stroke();
    ctx.font = `400 ${28 * u}px ${fonts.sans}`;
    ctx.textAlign = "left";
    ctx.fillText(footer, pad, h - pad);
  }

  return out;
}

const typeNode: NodeKindImpl = { def, defaultParams, evaluate };
export default typeNode;
