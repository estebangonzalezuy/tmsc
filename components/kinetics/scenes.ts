// The scenes: seven ways of making words into a picture, all canvas 2D, all
// closing their loop.
//
// A scene is `(frame) => void` plus the controls it wants. Nothing else — no
// state, no clock of its own, no React. It is handed `p`, a number from 0 to 1
// through the loop, and it must draw the same frame at 1 as it did at 0. That
// is why every rotation here is a whole number of turns, every scroll is a
// whole number of cells, and every stagger measures its stages as shares of
// the loop rather than seconds: not as a style, but because an export is
// filmed frame by frame and a seam would ship.
//
// Two families run through them. `stagger`, `arcs` and `field` *set* type —
// they draw letters. `strokes`, `mosaic`, `bleed` and `halftone` never draw a
// letter at all: they draw a field and ask the mask whether each point is
// inside a word. That second family is the reason this studio exists, and the
// reason the mask in `type.ts` is the most important object here.

import {
  colorsOf,
  ease,
  FORMATS,
  inkFor,
  num,
  bool,
  text as par,
  presence,
  queue,
  rnd,
  type Ctrl,
  type KineticSpec,
  type SceneId,
} from "@/lib/kinetics";
import { fontOf, layout, maskOf, type Mask } from "./type";

export type Frame = {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** 0-1 through the loop. */
  p: number;
  spec: KineticSpec;
  ground: string;
  inks: string[];
  /** Canvas units per design unit, so a weight means the same thing in the
      preview and in a 4K export. */
  s: number;
};

export type SceneDef = {
  id: SceneId;
  name: string;
  about: string;
  controls: Ctrl[];
  draw: (f: Frame) => void;
};

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const clear = (f: Frame) => {
  f.ctx.fillStyle = f.ground;
  f.ctx.fillRect(0, 0, f.w, f.h);
};

/* A scene that wants the words as a field asks for this rather than drawing
   them, and every one of them samples it the same way. */
const mask = (f: Frame): Mask => maskOf(f.spec, f.w, f.h);

/* ------------------------------------------------------------- stagger --- */

/* The reference tool this comes from is a headline that arrives a letter at a
   time and leaves the same way, with an easing menu and a 3×3 pad saying where
   the wave starts. Everything expressive about it is in `presence` and
   `queue`, which is why they live in the spec module and not here: this scene
   is only the transform they drive. */
const stagger: SceneDef = {
  id: "stagger",
  name: "stagger",
  about: "A headline that arrives a letter at a time, and leaves the same way.",
  controls: [
    { key: "rise", label: "throw", kind: "num", min: 0, max: 600, step: 4, def: 180, hint: "How far a letter travels to get here." },
    { key: "spin", label: "turn", kind: "num", min: -180, max: 180, step: 1, def: 0 },
    { key: "zoom", label: "grow from", kind: "num", min: 0, max: 2.5, step: 0.05, def: 0.7 },
    { key: "rowShift", label: "row drift", kind: "num", min: 0, max: 400, step: 4, def: 90, hint: "Rows sit offset from each other, the way a stacked headline does." },
    { key: "perLetter", label: "a colour a letter", kind: "bool", def: true },
    { key: "fade", label: "fade in", kind: "bool", def: false, hint: "Off, a letter is solid the whole way — it moves, it doesn't dissolve." },
  ],
  draw: (f) => {
    clear(f);
    const { ctx, spec, p, w, h, inks, s } = f;
    const lay = layout(ctx, spec, w, h);
    if (!lay.count) return;

    const rise = num(spec.params, "rise") * s;
    const spin = (num(spec.params, "spin") * Math.PI) / 180;
    const zoom = num(spec.params, "zoom", 1);
    const shift = num(spec.params, "rowShift") * s;
    const perLetter = bool(spec.params, "perLetter");
    const fade = bool(spec.params, "fade");

    ctx.font = fontOf(spec, lay.size);
    ctx.textBaseline = "alphabetic";

    for (const line of lay.lines) {
      /* Every row sits at its own offset, seeded off the row index so the
         same headline always breaks the same way. */
      const off = (rnd(line.glyphs[0]?.line * 37 + 5) - 0.5) * 2 * shift;
      for (const g of line.glyphs) {
        if (g.ch === " ") continue;
        const k = queue(spec.timing.from, g.cx / w, g.cy / h, g.i, lay.count);
        const pr = presence(spec.timing, p, k);
        if (pr <= 0.001) continue;

        ctx.save();
        ctx.globalAlpha = fade ? pr : Math.min(1, pr * 3);
        ctx.translate(g.cx + off * (1 - pr) * 0 + off, g.cy);
        const sc = lerp(zoom, 1, pr);
        ctx.scale(sc, sc);
        ctx.rotate(spin * (1 - pr));
        ctx.translate(0, (1 - pr) * rise);
        ctx.fillStyle = perLetter ? inkFor(inks, g.i * 7 + g.line * 3) : inks[0];
        ctx.fillText(g.ch, g.x - g.cx, g.y - g.cy);
        ctx.restore();
      }
    }
  },
};

/* ------------------------------------------------------------- strokes --- */

/* The letters are never drawn. Concentric rings are walked a step at a time,
   and each step asks the mask whether it is inside a word: inside, the ring is
   drawn heavy and continuous, so the letter builds itself out of stacked arcs;
   outside, it breaks into dashes that thin out with distance.
 *
 * The distance is measured *along the ring*, in a single pass over the ring's
 * own samples, which is the whole trick — a real 2D distance field would cost
 * more than the rest of the studio, and along the ring is the only direction
 * that shows. */
const strokes: SceneDef = {
  id: "strokes",
  name: "strokes",
  about: "Words cut out of a field of concentric strokes, fraying at the edges.",
  controls: [
    { key: "rings", label: "rings", kind: "num", min: 12, max: 220, step: 1, def: 64 },
    { key: "centreY", label: "centre", kind: "num", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "inside", label: "inside", kind: "num", min: 0.2, max: 2.4, step: 0.05, def: 1.15, hint: "Weight as a share of the gap between rings. Past 1 the rings touch and the letter fills in solid." },
    { key: "outside", label: "outside", kind: "num", min: 0, max: 2, step: 0.05, def: 0.5 },
    { key: "reach", label: "fray", kind: "num", min: 0, max: 1, step: 0.01, def: 0.42, hint: "How far the dashes carry past the letter." },
    { key: "spin", label: "turns", kind: "num", min: -3, max: 3, step: 1, def: 1, hint: "Whole turns over the loop — a fraction would open a seam." },
    { key: "colour", label: "colour the rings", kind: "bool", def: false },
  ],
  draw: (f) => {
    clear(f);
    const { ctx, spec, p, w, h, inks, s } = f;
    const m = mask(f);
    const rings = Math.round(num(spec.params, "rings", 64));
    const cx = w / 2;
    const cy = h * num(spec.params, "centreY", 0.5);
    const reach = num(spec.params, "reach", 0.4);
    const spin = Math.round(num(spec.params, "spin", 1));
    const colour = bool(spec.params, "colour");

    const maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
    const turn = p * TAU * spin;
    /* The weights are shares of the gap between two rings, not pixels. That is
       what lets one slider mean "the letter is solid" at any ring count: at 1
       the arcs just touch, past it they overlap and the glyph fills in. Set in
       pixels it would have needed re-finding every time the count moved. */
    const gap = maxR / rings;
    const wIn = num(spec.params, "inside", 1.15) * gap;
    const wOut = num(spec.params, "outside", 0.5) * gap;

    ctx.lineCap = "round";
    for (let i = 1; i <= rings; i++) {
      const r = (i / rings) * maxR;
      /* Sample density follows circumference, so the outermost ring is not
         coarser than the innermost. */
      const steps = Math.max(24, Math.min(1400, Math.round((TAU * r) / (2.4 * s))));
      const da = TAU / steps;

      const hit = new Uint8Array(steps);
      for (let j = 0; j < steps; j++) {
        const a = j * da + turn;
        hit[j] = m.inside(cx + Math.cos(a) * r, cy + Math.sin(a) * r) ? 1 : 0;
      }

      /* Distance to the nearest inside sample, wrapping both ways round the
         ring. Two sweeps, no allocation past this array. */
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
          /* A continuous run inside a letter: one arc, drawn heavy. */
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
          /* Outside, but near enough to fray: a dash whose length and weight
             fall away with distance. The seeded test is what keeps the
             scatter from crawling between frames. */
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
  },
};

/* -------------------------------------------------------------- mosaic --- */

/* The words are the picture and also the pixels: a grid is laid over the frame
   and every cell that falls inside a letter is filled with a letter, chosen
   from a short alphabet by how much of the cell is covered and stretched to
   fill it. The rows slide by whole cells over the loop, so the mosaic flows
   without ever arriving somewhere it can't leave. */
const mosaic: SceneDef = {
  id: "mosaic",
  name: "mosaic",
  about: "The headline rebuilt out of smaller letters, sliding row by row.",
  controls: [
    { key: "cols", label: "columns", kind: "num", min: 3, max: 60, step: 1, def: 11 },
    { key: "alphabet", label: "made of", kind: "words", def: "SMLX" },
    { key: "slide", label: "slide", kind: "num", min: -6, max: 6, step: 1, def: 2, hint: "Whole cells a row travels over the loop." },
    { key: "wave", label: "wave", kind: "num", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "stretch", label: "stretch", kind: "num", min: 0.5, max: 2.4, step: 0.05, def: 1.5 },
    { key: "ghost", label: "fill the ground", kind: "bool", def: true, hint: "Off, only the cells inside a letter are set and the ground stays bare." },
  ],
  draw: (f) => {
    clear(f);
    const { ctx, spec, p, w, h, inks } = f;
    const m = mask(f);
    const cols = Math.round(num(spec.params, "cols", 11));
    const alpha = (par(spec.params, "alphabet", "SMLX") || "S").toUpperCase();
    const slide = Math.round(num(spec.params, "slide", 2));
    const wave = num(spec.params, "wave", 0.35);
    const stretch = num(spec.params, "stretch", 1.5);
    const ghost = bool(spec.params, "ghost");

    const cw = w / cols;
    const ch = cw * stretch;
    const rows = Math.ceil(h / ch) + 1;

    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    for (let r = 0; r < rows; r++) {
      /* Odd rows travel the other way, which is what makes the field read as
         woven rather than as a screen scrolling. */
      const dir = r % 2 ? -1 : 1;
      const travel = p * slide * dir * cw;
      const y = r * ch + ch / 2;
      for (let c = -1; c <= cols + 1; c++) {
        const x = c * cw + cw / 2 + travel;
        /* Sample the mask where the cell *is*, not where it started, so the
           letters flow through the word rather than dragging it along. */
        const cover =
          (m.at(x, y) + m.at(x - cw * 0.3, y) + m.at(x + cw * 0.3, y) + m.at(x, y - ch * 0.3) + m.at(x, y + ch * 0.3)) / 5;
        const lift = wave ? (Math.sin(p * TAU + c * 0.4 + r * 0.7) + 1) / 2 : 0;
        const level = cover * (1 - wave * 0.5) + cover * wave * lift;
        if (level < 0.06 && !ghost) continue;

        const bare = cover < 0.06;
        const idx = Math.min(alpha.length - 1, Math.floor(level * alpha.length));
        const ch2 = alpha[bare ? 0 : idx];
        /* The cell is the unit and the letter fills it. Setting the glyph
           smaller than its cell is what turned the first version into
           confetti: a mosaic has to tile, so the tile has to be the size of
           the hole it goes in. */
        ctx.font = fontOf(spec, ch * (bare ? 0.85 : 1.05));
        ctx.globalAlpha = bare ? 0.22 : 1;
        ctx.fillStyle = inkFor(inks, r * 5 + c * 3 + (bare ? 1 : 0));
        ctx.save();
        ctx.translate(((x % w) + w) % w, y);
        /* Squeezed horizontally to the cell's own width, so a wide M and a
           narrow I both fill their column and the field reads as woven. */
        const gw = ctx.measureText(ch2).width || 1;
        ctx.scale(Math.min(2.2, (cw * 1.02) / gw), bare ? 0.9 : lerp(0.9, 1.15, level));
        ctx.fillText(ch2, 0, 0);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  },
};

/* ---------------------------------------------------------------- arcs --- */

/* Type laid along concentric arcs from a point off the bottom of the frame,
   until the repetition becomes a dome. Rings turn in whole laps and alternate
   direction, so the whole field counter-rotates against itself and still lands
   exactly where it started. */
const arcs: SceneDef = {
  id: "arcs",
  name: "arcs",
  about: "One line repeated along rings until the repetition becomes a dome.",
  controls: [
    { key: "rings", label: "rings", kind: "num", min: 3, max: 60, step: 1, def: 22 },
    { key: "size", label: "letter", kind: "num", min: 6, max: 48, step: 1, def: 17 },
    { key: "gap", label: "spacing", kind: "num", min: 0.6, max: 3, step: 0.05, def: 1.5 },
    { key: "centreY", label: "centre", kind: "num", min: 0.2, max: 2, step: 0.02, def: 1.18 },
    { key: "inner", label: "inner ring", kind: "num", min: 0, max: 0.9, step: 0.01, def: 0.12 },
    { key: "turns", label: "turns", kind: "num", min: -2, max: 2, step: 1, def: 1 },
    { key: "alternate", label: "counter-turn", kind: "bool", def: true },
    { key: "mono", label: "one ink", kind: "bool", def: true, hint: "Off, every ring takes its own colour." },
  ],
  draw: (f) => {
    clear(f);
    const { ctx, spec, p, w, h, inks, s } = f;
    const line = (spec.caps ? spec.text.toUpperCase() : spec.text).replace(/\n/g, " ") + "  ";
    if (!line.trim()) return;

    const rings = Math.round(num(spec.params, "rings", 22));
    const size = num(spec.params, "size", 17) * s;
    const gap = num(spec.params, "gap", 1.5);
    const cy = h * num(spec.params, "centreY", 1.18);
    const inner = num(spec.params, "inner", 0.12);
    const turns = Math.round(num(spec.params, "turns", 1));
    const alt = bool(spec.params, "alternate");
    const mono = bool(spec.params, "mono");

    const cx = w / 2;
    const maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
    ctx.font = fontOf(spec, size);
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    for (let i = 0; i < rings; i++) {
      const r = maxR * lerp(inner, 1, (i + 1) / rings);
      const dir = alt && i % 2 ? -1 : 1;
      const spin = p * TAU * turns * dir;
      ctx.fillStyle = mono ? inks[0] : inkFor(inks, i);
      /* Advance by each letter's own width so the setting stays even round the
         arc — a fixed angular step would crowd an M and strand an I. */
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
  },
};

/* --------------------------------------------------------------- field --- */

/* Soft colour, and words that find each other. The field is a handful of
   colour bars drawn into a tiny canvas and blown up with smoothing on — which
   is a better blur than any filter, costs nothing, and is the reason this
   scene runs at full rate while looking like it shouldn't.
 *
 * The words start scattered and arrive on one line, so the piece resolves
 * rather than just moving. */
const field: SceneDef = {
  id: "field",
  name: "field",
  about: "Soft colour, and scattered words that arrive on one line.",
  controls: [
    { key: "bars", label: "bands", kind: "num", min: 2, max: 16, step: 1, def: 7 },
    { key: "rows", label: "rows", kind: "num", min: 1, max: 4, step: 1, def: 2 },
    { key: "soft", label: "softness", kind: "num", min: 2, max: 40, step: 1, def: 16 },
    { key: "drift", label: "drift", kind: "num", min: -3, max: 3, step: 1, def: 1 },
    { key: "inset", label: "inset", kind: "num", min: 0, max: 0.3, step: 0.01, def: 0.08 },
    { key: "word", label: "word size", kind: "num", min: 8, max: 120, step: 1, def: 46 },
    { key: "scatter", label: "scatter", kind: "num", min: 0, max: 1, step: 0.01, def: 0.7 },
    { key: "dark", label: "dark words", kind: "bool", def: false, hint: "On a pale field the words read better in the ground's own colour." },
  ],
  draw: (f) => {
    clear(f);
    const { ctx, spec, p, w, h, inks, s } = f;
    const bars = Math.round(num(spec.params, "bars", 7));
    const rows = Math.round(num(spec.params, "rows", 2));
    const soft = Math.round(num(spec.params, "soft", 16));
    const drift = Math.round(num(spec.params, "drift", 1));
    const inset = num(spec.params, "inset", 0.08);

    /* The field, drawn small and blown up with smoothing on — a better blur
       than any filter, and free.
     *
       The cells are drawn several pixels across rather than one. At one pixel
       a bar the upscale interpolates straight from each colour to the next and
       the whole thing comes out a rainbow; with a few pixels of flat colour in
       the middle, each band keeps its own colour and only the edges melt,
       which is the look this is after. */
    const q = 6;
    const small = document.createElement("canvas");
    small.width = Math.max(2, bars) * q;
    small.height = Math.max(1, rows) * q;
    const sc = small.getContext("2d")!;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < bars; c++) {
        /* Shifting by whole bars over the loop keeps the field travelling and
           still puts it back where it began. */
        const shifted = (((c + Math.round(p * drift * bars)) % bars) + bars) % bars;
        sc.fillStyle = inkFor(inks, shifted * 3 + r * 5);
        sc.fillRect(c * q, r * q, q, q);
      }
    }
    const ix = w * inset;
    const iy = h * inset;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    /* Two passes at different scales: one wide and soft, one tighter, which
       reads much closer to a real gaussian than a single stretch does. */
    ctx.globalAlpha = 1;
    ctx.drawImage(small, -ix, -iy, w + ix * 2, h + iy * 2);
    ctx.globalAlpha = 0.55;
    ctx.drawImage(small, ix, iy, w - ix * 2, h - iy * 2);
    ctx.restore();
    /* A wash of the ground at the edges, so the field sits on paper rather
       than running off it. `soft` decides how far in the paper reaches. */
    const inner = Math.min(w, h) * (1 - soft / 60);
    const vign = ctx.createRadialGradient(w / 2, h / 2, inner * 0.5, w / 2, h / 2, Math.max(w, h) * 0.8);
    vign.addColorStop(0, "rgba(0,0,0,0)");
    vign.addColorStop(1, f.ground);
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, w, h);

    /* The words. */
    const words = (spec.caps ? spec.text.toUpperCase() : spec.text).split(/\s+/).filter(Boolean);
    if (!words.length) return;
    const size = num(spec.params, "word", 46) * s;
    const spread = num(spec.params, "scatter", 0.7);
    const dark = bool(spec.params, "dark");
    ctx.font = fontOf(spec, size);
    ctx.textBaseline = "middle";

    const widths = words.map((word) => ctx.measureText(word).width);
    const gapW = ctx.measureText(" ").width;
    const totalW = widths.reduce((a, b) => a + b, 0) + gapW * (words.length - 1);
    let cursor = (w - totalW) / 2;

    words.forEach((word, i) => {
      const homeX = cursor;
      const homeY = h / 2;
      cursor += widths[i] + gapW;
      const k = queue(spec.timing.from, homeX / w, homeY / h, i, words.length);
      const pr = presence(spec.timing, p, k);
      if (pr <= 0.002) return;
      /* Away is a seeded place in the frame; home is the line. The word
         travels between the two, so the piece resolves into a sentence. */
      const ax = lerp(w * 0.12, w * 0.78, rnd(i * 71 + 3)) - widths[i] / 2;
      const ay = lerp(h * 0.16, h * 0.84, rnd(i * 131 + 9));
      const t = ease("cubic", "out", pr);
      ctx.globalAlpha = Math.min(1, pr * 2.5);
      /* Small type over a field of colour has one job — to be readable — so it
         is one flat tone rather than a colour a word, which is the one place
         this studio holds back. */
      ctx.fillStyle = dark ? f.ground : "#ffffff";
      ctx.fillText(
        word,
        lerp(lerp(homeX, ax, spread), homeX, t),
        lerp(lerp(homeY, ay, spread), homeY, t),
      );
    });
    ctx.globalAlpha = 1;
    ctx.textBaseline = "alphabetic";
  },
};

/* --------------------------------------------------------------- bleed --- */

/* A poster where the type never moves and the picture underneath never stops.
   Blobs drift on circles — whole laps, so the field closes — and the words are
   composited against them rather than laid over them, so a letter is black on
   the light half and lit on the dark half and changes as the field passes
   under it. */
const bleed: SceneDef = {
  id: "bleed",
  name: "bleed",
  about: "A fixed headline over a moving field, composited rather than laid on top.",
  controls: [
    { key: "blobs", label: "blobs", kind: "num", min: 2, max: 12, step: 1, def: 5 },
    { key: "size", label: "blob size", kind: "num", min: 0.2, max: 1.4, step: 0.05, def: 0.7 },
    { key: "flow", label: "flow", kind: "num", min: -3, max: 3, step: 1, def: 1 },
    {
      key: "mode",
      label: "against",
      kind: "pick",
      def: "difference",
      values: [
        { value: "difference", label: "difference" },
        { value: "exclusion", label: "exclusion" },
        { value: "multiply", label: "multiply" },
        { value: "screen", label: "screen" },
        { value: "source-over", label: "over" },
      ],
    },
    { key: "smear", label: "smear", kind: "num", min: 0, max: 40, step: 1, def: 10, hint: "The words drag where the field is bright." },
    { key: "steps", label: "smear steps", kind: "num", min: 1, max: 14, step: 1, def: 6 },
  ],
  draw: (f) => {
    clear(f);
    const { ctx, spec, p, w, h, inks, s } = f;
    const blobs = Math.round(num(spec.params, "blobs", 5));
    const size = num(spec.params, "size", 0.7);
    const flow = Math.round(num(spec.params, "flow", 1));
    const mode = par(spec.params, "mode", "difference");
    const smear = num(spec.params, "smear", 10) * s;
    const steps = Math.round(num(spec.params, "steps", 6));

    /* The field. Each blob walks a whole number of laps round its own small
       circle, which is the cheapest motion that is guaranteed periodic. */
    for (let i = 0; i < blobs; i++) {
      const a = p * TAU * flow + (i / blobs) * TAU;
      const rx = lerp(0.14, 0.86, rnd(i * 17 + 1)) * w + Math.cos(a) * w * 0.18;
      const ry = lerp(0.14, 0.86, rnd(i * 29 + 7)) * h + Math.sin(a) * h * 0.14;
      const rr = Math.max(w, h) * size * lerp(0.35, 0.8, rnd(i * 53 + 11));
      const g = ctx.createRadialGradient(rx, ry, 0, rx, ry, rr);
      const ink = inkFor(inks, i * 3 + 1);
      g.addColorStop(0, ink);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    /* The words, composited against it. */
    const lay = layout(ctx, spec, w, h);
    if (!lay.count) return;
    ctx.save();
    ctx.globalCompositeOperation = mode as GlobalCompositeOperation;
    ctx.font = fontOf(spec, lay.size);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = inks[0];
    for (const line of lay.lines) {
      if (smear > 0 && steps > 1) {
        /* Drawn several times along a short path, fading — a cheap smear that
           costs one fillText a step and needs no pixel work at all. */
        const dir = Math.sin(p * TAU + line.glyphs[0]?.line * 1.3) ;
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
  },
};

/* ------------------------------------------------------------ halftone --- */

/* The club's own screen, in colour and pointed at the words. Each ink gets its
   own grid at its own angle and its own dot, exactly as a press would separate
   them, and the dot size comes from how much of the cell the words and the
   field cover. The grids rotate as a set over whole turns. */
const halftone: SceneDef = {
  id: "halftone",
  name: "halftone",
  about: "The words screened into coloured dots, one grid an ink.",
  controls: [
    { key: "cell", label: "dot pitch", kind: "num", min: 4, max: 60, step: 1, def: 26 },
    { key: "inks", label: "inks", kind: "num", min: 1, max: 5, step: 1, def: 4 },
    { key: "swell", label: "dot size", kind: "num", min: 0.4, max: 2.4, step: 0.05, def: 1.5 },
    { key: "spin", label: "turns", kind: "num", min: -2, max: 2, step: 1, def: 1 },
    { key: "wobble", label: "wobble", kind: "num", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "square", label: "square dots", kind: "bool", def: false },
  ],
  draw: (f) => {
    clear(f);
    const { ctx, spec, p, w, h, inks, s } = f;
    const m = mask(f);
    const cell = Math.max(3, num(spec.params, "cell", 26) * s);
    const n = Math.min(inks.length, Math.round(num(spec.params, "inks", 4)));
    const swell = num(spec.params, "swell", 1.5);
    const spin = Math.round(num(spec.params, "spin", 1));
    const wobble = num(spec.params, "wobble", 0.35);
    const square = bool(spec.params, "square");

    const diag = Math.hypot(w, h);
    for (let k = 0; k < n; k++) {
      /* The classic separation angles, plus a whole-turn rotation of the whole
         set so the moiré travels instead of sitting still. */
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
          /* Grid space → canvas space. */
          const x = w / 2 + gx * cos - gy * sin;
          const y = h / 2 + gx * sin + gy * cos;
          if (x < -cell || y < -cell || x > w + cell || y > h + cell) continue;
          const cover = m.at(x, y);
          if (cover < 0.02) continue;
          /* Each ink breathes on its own phase, so the separation pulses the
             way a misregistered print does. */
          const beat = 1 + wobble * Math.sin(p * TAU + (k / n) * TAU);
          const r = (cell / 2) * cover * swell * beat;
          if (r < 0.25) continue;
          if (square) {
            ctx.rect(x - r, y - r, r * 2, r * 2);
          } else {
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, TAU);
          }
        }
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
};

/* ---------------------------------------------------------------- grain --- */

/* Laid over everything at the end, and seeded off the frame rather than
   Math.random, so two exports of the same piece are identical. It is the one
   thing in the studio that is allowed to touch every pixel. */
export function grain(f: Frame, amount: number) {
  if (amount <= 0.001) return;
  const { ctx, w, h, p } = f;
  const step = Math.max(2, Math.round(2 * f.s));
  const seed = Math.round(p * 60);
  ctx.save();
  ctx.globalAlpha = Math.min(0.4, amount);
  ctx.fillStyle = "#000";
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (rnd(x * 0.7 + y * 1.3 + seed * 31.7) > 0.5) continue;
      ctx.fillRect(x, y, step, step);
    }
  }
  ctx.restore();
}

/* ---------------------------------------------------------------------- */

export const SCENES: SceneDef[] = [stagger, strokes, mosaic, arcs, field, bleed, halftone];

export const sceneOf = (id: string) => SCENES.find((s) => s.id === id) ?? SCENES[0];

/** Draw a whole frame: the scene, then the grain. The only entry point the
    stage, the poster and the exporter use, so none of them can disagree. */
export function paint(
  ctx: CanvasRenderingContext2D,
  spec: KineticSpec,
  p: number,
  w: number,
  h: number,
) {
  const { ground, inks } = colorsOf(spec);
  const f: Frame = {
    ctx,
    w,
    h,
    p: ((p % 1) + 1) % 1,
    spec,
    ground,
    inks: inks.length ? inks : ["#ffffff"],
    s: w / FORMATS[spec.format].w,
  };
  ctx.save();
  sceneOf(spec.scene).draw(f);
  ctx.restore();
  grain(f, spec.grain);
}
