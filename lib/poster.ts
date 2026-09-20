/* the Posts Studio's model: a poster is a row of totems on a sheet of paper.
 *
 * One kind of post, one vocabulary. A **totem** is a vertical bar with a
 * **silhouette** (its mask) and one or more **segments** stacked inside it,
 * each segment filled with a **pattern** in colours from a **palette**. A
 * **poster** is a few of those laid across a sheet, with the type, when there
 * is type, in a band of its own.
 *
 * Three rules hold the whole thing up:
 *
 * - **Everything is a pure periodic function of `p ∈ [0,1]`.** A silhouette,
 *   a fill, the whole poster: hand it the same `p` and it draws the same
 *   picture. That is what makes the preview, a thumbnail and an exported
 *   frame the same code at different sizes, and what makes a loop close
 *   without anybody easing it by hand.
 * - **Type never sits on a shape.** The totems get the field; the words get a
 *   band of the sheet's own paper. Nothing is ever set over a pattern, so
 *   nothing has to be checked for contrast.
 * - **A segment's ground is never the sheet's paper.** Otherwise the totem
 *   disappears into the card, which is exactly what the first draft did.
 *
 * Everything here is pure and canvas-only: no React, no DOM beyond the 2D
 * context, so a server, a worker and an exporter can all call it.
 */

export const TAU = Math.PI * 2;

/** FNV-1a, the same hash the site's accents and drawers are seeded with. */
export function hash01(key: string): number {
  let h = 2166136261;
  const s = String(key);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

const wave = (p: number, cycles = 1, phase = 0) =>
  Math.sin(TAU * (cycles * p + phase));

/* ------------------------------------------------------------- the model */

export type SilhouetteKind =
  | "stadium"
  | "capsule"
  | "block"
  | "octagon"
  | "beads"
  | "ziggurat"
  | "hourglass"
  | "scallop";

export type FillKind =
  | "solid"
  | "stripes"
  | "waves"
  | "blobs"
  | "chain"
  | "clover"
  | "camo"
  | "dots";

/** How one segment meets the next. */
export type JointKind = "cut" | "scallop";

export type Segment = {
  fill: FillKind;
  /** Share of the totem's height, relative to its siblings. */
  weight: number;
  joint: JointKind;
  /** [ground, mark, second mark, ink]. The ground is never the sheet. */
  inks: string[];
};

export type Totem = {
  silhouette: SilhouetteKind;
  segments: Segment[];
  seed: string;
};

export type FormatKind = "1:1" | "4:5" | "9:16";

export type Poster = {
  format: FormatKind;
  /** The sheet. White unless somebody deliberately changes it. */
  ground: string;
  palette: PaletteKind;
  columns: number;
  seed: string;
  /** "mix" lets the seed choose per column. */
  silhouette: SilhouetteKind | "mix";
  fill: FillKind | "mix";
  kicker: string;
  title: string;
  textPlace: "bottom" | "top" | "none";
  /** Whole cycles per loop for the motion; 0 holds the poster still. */
  motion: number;
};

export const FORMATS: Record<FormatKind, { w: number; h: number; label: string }> = {
  "1:1": { w: 1080, h: 1080, label: "Square" },
  "4:5": { w: 1080, h: 1350, label: "Portrait" },
  "9:16": { w: 1080, h: 1920, label: "Story" },
};

export const SILHOUETTE_KINDS: SilhouetteKind[] = [
  "stadium",
  "capsule",
  "block",
  "octagon",
  "beads",
  "ziggurat",
  "hourglass",
  "scallop",
];

export const FILL_KINDS: FillKind[] = [
  "solid",
  "stripes",
  "waves",
  "blobs",
  "chain",
  "clover",
  "camo",
  "dots",
];

/* ------------------------------------------------------------- palettes */

/* A palette keeps its two jobs apart: `grounds` are what a segment is filled
   with, `marks` are what is drawn on top. They overlap on purpose — black is
   a fine ground and a fine mark — but a segment never picks its mark from
   the same entry as its ground. */
export type Palette = { label: string; grounds: string[]; marks: string[] };

export const PALETTES = {
  club: {
    label: "the club",
    grounds: ["#3d3deb", "#2e7d46", "#ee4b2b", "#0d0d0d", "#adb4f5"],
    marks: ["#fffdf0", "#ffffff", "#adb4f5", "#0d0d0d", "#ee4b2b"],
  },
  playa: {
    label: "playa",
    grounds: ["#ee4b2b", "#f6c6cf", "#8fd8f0", "#0d0d0d", "#2e7d46"],
    marks: ["#fffdf0", "#ee4b2b", "#0d0d0d", "#8ce3a8", "#ffffff"],
  },
  monte: {
    label: "monte",
    grounds: ["#0d0d0d", "#2e7d46", "#8ce3a8", "#3d3deb"],
    marks: ["#fffdf0", "#8ce3a8", "#ffffff", "#ee4b2b"],
  },
  ink: {
    label: "ink",
    grounds: ["#0d0d0d", "#3d3deb", "#adb4f5"],
    marks: ["#ffffff", "#fffdf0", "#3d3deb", "#0d0d0d"],
  },
  citrus: {
    label: "citrus",
    grounds: ["#ee4b2b", "#ffb703", "#0d0d0d", "#2e7d46"],
    marks: ["#fffdf0", "#ffffff", "#ffb703", "#0d0d0d"],
  },
} satisfies Record<string, Palette>;

export type PaletteKind = keyof typeof PALETTES;
export const PALETTE_KINDS = Object.keys(PALETTES) as PaletteKind[];

/* ---------------------------------------------------------- silhouettes */

type SilArgs = { p: number; seed: string };

/* Each one builds a closed path in the box x,y,w,h. The caller clips to it. */
export const SILHOUETTES: Record<
  SilhouetteKind,
  (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: SilArgs) => void
> = {
  stadium(c, x, y, w, h) {
    c.beginPath();
    c.roundRect(x, y, w, h, w / 2);
  },
  capsule(c, x, y, w, h) {
    const r = w / 2;
    c.beginPath();
    c.roundRect(x, y, w, h, [r, r, 0, 0]);
  },
  block(c, x, y, w, h) {
    c.beginPath();
    c.roundRect(x, y, w, h, w * 0.1);
  },
  octagon(c, x, y, w, h) {
    const k = w * 0.3;
    c.beginPath();
    c.moveTo(x + k, y);
    c.lineTo(x + w - k, y);
    c.lineTo(x + w, y + k);
    c.lineTo(x + w, y + h - k);
    c.lineTo(x + w - k, y + h);
    c.lineTo(x + k, y + h);
    c.lineTo(x, y + h - k);
    c.lineTo(x, y + k);
    c.closePath();
  },
  /* A chain of circles joined by pinched waists, the whole column breathing
     one bead at a time. */
  beads(c, x, y, w, h, { p }) {
    const r = w / 2;
    const cx = x + r;
    const n = Math.max(3, Math.round(h / (r * 1.85)));
    const step = h / n;
    const wob = (i: number) => 1 + 0.14 * wave(p, 1, i / n);
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const cy = y + r + (h - 2 * r) * (i / n);
      const rr = r * (i === 0 || i === n ? 1 : wob(i));
      if (i === 0) c.moveTo(cx + rr, cy);
      else c.quadraticCurveTo(cx + r * 0.52, cy - step / 2, cx + rr, cy);
      c.arc(cx, cy, rr, 0, Math.PI, false);
    }
    for (let i = n; i >= 0; i--) {
      const cy = y + r + (h - 2 * r) * (i / n);
      const rr = r * (i === 0 || i === n ? 1 : wob(i));
      c.quadraticCurveTo(cx - r * 0.52, cy + step / 2, cx - rr, cy);
      c.arc(cx, cy, rr, Math.PI, 0, false);
    }
    c.closePath();
  },
  /* Stepped taper under a dome — the club's pagoda. */
  ziggurat(c, x, y, w, h) {
    const steps = 6;
    const sh = h / (steps + 2);
    const inset = (i: number) => (w / 2) * (i / steps) * 0.78;
    c.beginPath();
    c.moveTo(x, y + h);
    let top = y + h;
    for (let i = 0; i < steps; i++) {
      const nextTop = y + h - sh * (i + 1);
      c.lineTo(x + inset(i), top);
      c.lineTo(x + inset(i), nextTop);
      top = nextTop;
    }
    const capW = w - 2 * inset(steps - 1);
    c.lineTo(x + w / 2 - capW / 2, top);
    c.arc(x + w / 2, top, capW / 2, Math.PI, 0);
    c.lineTo(x + w / 2 + capW / 2, top);
    for (let i = steps - 1; i >= 0; i--) {
      c.lineTo(x + w - inset(i), y + h - sh * (i + 1));
      c.lineTo(x + w - inset(i), y + h - sh * i);
    }
    c.lineTo(x + w, y + h);
    c.closePath();
  },
  hourglass(c, x, y, w, h) {
    const r = w * 0.18;
    const waist = w * 0.42;
    const my = y + h / 2;
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h * 0.3);
    c.bezierCurveTo(x + w, my - h * 0.05, x + w / 2 + waist / 2, my - h * 0.05, x + w / 2 + waist / 2, my);
    c.bezierCurveTo(x + w / 2 + waist / 2, my + h * 0.05, x + w, my + h * 0.05, x + w, y + h * 0.7);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + h * 0.7);
    c.bezierCurveTo(x, my + h * 0.05, x + w / 2 - waist / 2, my + h * 0.05, x + w / 2 - waist / 2, my);
    c.bezierCurveTo(x + w / 2 - waist / 2, my - h * 0.05, x, my - h * 0.05, x, y + h * 0.3);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  },
  /* Domed top, scalloped foot. */
  scallop(c, x, y, w, h) {
    const r = w / 2;
    const n = 5;
    const bw = w / n;
    c.beginPath();
    c.moveTo(x, y + r);
    c.arc(x + r, y + r, r, Math.PI, 0);
    c.lineTo(x + w, y + h - bw / 2);
    for (let i = n - 1; i >= 0; i--) {
      c.arc(x + bw * i + bw / 2, y + h - bw / 2, bw / 2, 0, Math.PI, false);
    }
    c.lineTo(x, y + r);
    c.closePath();
  },
};

/* ---------------------------------------------------------------- fills */

/* A closed organic blob: points on a wobbled circle joined with quadratic
   midpoint smoothing, so the outline is round rather than spiky. Drawing
   these as raw polygons is what made the first camo look like broken glass. */
export function smoothBlob(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  seedKey: string,
  { points = 9, wobble = 0.34, squash = 1, p = 0, drift = 0 } = {},
) {
  const pts: [number, number][] = [];
  for (let k = 0; k < points; k++) {
    const a = (k / points) * TAU;
    const n = hash01(`${seedKey}:${k}`);
    const d = r * (1 - wobble + wobble * 2 * n) * (1 + drift * wave(p, 1, n));
    pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * squash]);
  }
  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  c.beginPath();
  const start = mid(pts[points - 1], pts[0]);
  c.moveTo(start[0], start[1]);
  for (let k = 0; k < points; k++) {
    const cur = pts[k];
    const m2 = mid(cur, pts[(k + 1) % points]);
    c.quadraticCurveTo(cur[0], cur[1], m2[0], m2[1]);
  }
  c.closePath();
}

type FillArgs = { inks: string[]; p: number; seed: string };

export const FILLS: Record<
  FillKind,
  (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: FillArgs) => void
> = {
  solid(c, x, y, w, h, { inks }) {
    c.fillStyle = inks[0];
    c.fillRect(x, y, w, h);
  },

  /* Bands scrolling by exactly one period, so the loop closes. */
  stripes(c, x, y, w, h, { inks, p }) {
    const band = h / Math.max(6, Math.round(h / (w * 0.26)));
    c.fillStyle = inks[0];
    c.fillRect(x, y, w, h);
    c.fillStyle = inks[1] ?? "#ffffff";
    const off = (p * band * 2) % (band * 2);
    for (let yy = y - band * 2 + off; yy < y + h + band; yy += band * 2) {
      c.fillRect(x, yy, w, band);
    }
  },

  waves(c, x, y, w, h, { inks, p }) {
    c.fillStyle = inks[0];
    c.fillRect(x, y, w, h);
    const band = Math.max(6, h / 26);
    c.fillStyle = inks[1] ?? "#ffffff";
    const off = (p * band * 2) % (band * 2);
    for (let i = -2; i < h / (band * 2) + 2; i++) {
      const yy = y + i * band * 2 + off;
      c.beginPath();
      for (let sx = 0; sx <= w; sx += 4) {
        const k = yy + Math.sin((sx / w) * TAU * 1.6 + i * 1.3 + p * TAU) * band * 0.45;
        if (sx === 0) c.moveTo(x + sx, k);
        else c.lineTo(x + sx, k);
      }
      for (let sx = w; sx >= 0; sx -= 4) {
        const k = yy + band * 0.62 + Math.sin((sx / w) * TAU * 1.6 + i * 1.3 + p * TAU) * band * 0.45;
        c.lineTo(x + sx, k);
      }
      c.closePath();
      c.fill();
    }
  },

  /* Clusters of big circles, each breathing on its own phase. */
  blobs(c, x, y, w, h, { inks, p, seed }) {
    c.fillStyle = inks[0];
    c.fillRect(x, y, w, h);
    c.fillStyle = inks[1] ?? "#ffffff";
    const n = Math.max(3, Math.round(h / (w * 0.95)));
    for (let i = 0; i < n; i++) {
      const cx = x + w * (0.3 + 0.4 * hash01(`${seed}cx${i}`));
      const cy = y + h * ((i + 0.5) / n) + (hash01(`${seed}cy${i}`) - 0.5) * (h / n) * 0.5;
      const base = w * (0.3 + 0.12 * hash01(`${seed}r${i}`));
      const lobes = 3 + Math.round(hash01(`${seed}l${i}`));
      for (let k = 0; k < lobes; k++) {
        const a = hash01(`${seed}a${i}${k}`) * TAU;
        const d = base * (0.5 + 0.55 * hash01(`${seed}d${i}${k}`));
        const rr = base * (0.62 + 0.3 * hash01(`${seed}s${i}${k}`)) * (1 + 0.1 * wave(p, 1, (i + k) / (n + 4)));
        c.beginPath();
        c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr, 0, TAU);
        c.fill();
      }
    }
  },

  /* A vertical chain of circles whose swell travels down the column. */
  chain(c, x, y, w, h, { inks, p }) {
    c.fillStyle = inks[0];
    c.fillRect(x, y, w, h);
    c.fillStyle = inks[1] ?? "#0d0d0d";
    const n = Math.max(6, Math.round(h / (w * 0.55)));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const swell = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(TAU * (t * 1.2 - p)));
      c.beginPath();
      c.arc(x + w / 2, y + h * t, w * 0.44 * swell, 0, TAU);
      c.fill();
    }
  },

  /* Quatrefoils with a diamond mark between them. */
  clover(c, x, y, w, h, { inks, p }) {
    c.fillStyle = inks[0];
    c.fillRect(x, y, w, h);
    const cell = w * 0.86;
    const rows = Math.max(2, Math.round(h / (cell * 1.25)));
    for (let i = 0; i < rows; i++) {
      const cy = y + (h / rows) * (i + 0.5);
      const r = cell * 0.26 * (1 + 0.08 * wave(p, 1, i / rows));
      const spin = TAU * p + (i % 2 ? Math.PI / 4 : 0);
      c.fillStyle = inks[1] ?? "#3d3deb";
      for (let k = 0; k < 4; k++) {
        const a = spin + (k * TAU) / 4;
        c.beginPath();
        c.arc(x + w / 2 + Math.cos(a) * r, cy + Math.sin(a) * r, r, 0, TAU);
        c.fill();
      }
      if (i < rows - 1) {
        const my = y + (h / rows) * (i + 1);
        const d = cell * 0.16;
        const diamond = (size: number) => {
          c.beginPath();
          c.moveTo(x + w / 2, my - size);
          c.lineTo(x + w / 2 + size, my);
          c.lineTo(x + w / 2, my + size);
          c.lineTo(x + w / 2 - size, my);
          c.closePath();
          c.fill();
        };
        c.fillStyle = inks[2] ?? "#ee4b2b";
        diamond(d);
        c.fillStyle = inks[3] ?? "#0d0d0d";
        diamond(d * 0.38);
      }
    }
  },

  /* Small and many, so the ground stays part of the pattern: a few big blobs
     just turn the column into one flat mass. */
  camo(c, x, y, w, h, { inks, p, seed }) {
    c.fillStyle = inks[0];
    c.fillRect(x, y, w, h);
    const layers = Math.max(1, Math.min(2, inks.length - 1));
    for (let L = 0; L < layers; L++) {
      c.fillStyle = inks[L + 1];
      const n = Math.max(4, Math.round((h / w) * (2.4 + L)));
      for (let i = 0; i < n; i++) {
        const cx = x + w * (0.2 + 0.6 * hash01(`${seed}${L}cx${i}`));
        const cy = y + h * ((i + hash01(`${seed}${L}cy${i}`)) / n);
        const rr = w * (0.15 + 0.13 * hash01(`${seed}${L}r${i}`));
        smoothBlob(c, cx, cy, rr, `${seed}${L}${i}`, {
          points: 8,
          wobble: 0.42,
          squash: 1.45,
          p,
          drift: 0.08,
        });
        c.fill();
      }
    }
  },

  dots(c, x, y, w, h, { inks, p }) {
    c.fillStyle = inks[0];
    c.fillRect(x, y, w, h);
    c.fillStyle = inks[1] ?? "#ffffff";
    const cols = 3;
    const cell = w / cols;
    const rows = Math.max(3, Math.round(h / cell));
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const t = (j * cols + i) / (rows * cols);
        const rr = cell * 0.38 * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(TAU * (t * 2 - p))));
        c.beginPath();
        c.arc(x + cell * (i + 0.5), y + (h / rows) * (j + 0.5), rr, 0, TAU);
        c.fill();
      }
    }
  },
};

/* --------------------------------------------------------------- totems */

function cutBand(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  joint: JointKind,
) {
  c.beginPath();
  if (joint === "scallop") {
    const n = 5;
    const bw = w / n;
    c.moveTo(x, y);
    c.lineTo(x + w, y);
    c.lineTo(x + w, y + h - bw / 2);
    for (let i = n - 1; i >= 0; i--) {
      c.arc(x + bw * i + bw / 2, y + h - bw / 2, bw / 2, 0, Math.PI, false);
    }
    c.lineTo(x, y);
    c.closePath();
  } else {
    c.rect(x, y, w, h);
  }
}

/** One totem: the mask cut once, each segment clipped again to its own band. */
export function drawTotem(
  c: CanvasRenderingContext2D,
  totem: Totem,
  x: number,
  y: number,
  w: number,
  h: number,
  p: number,
) {
  c.save();
  (SILHOUETTES[totem.silhouette] ?? SILHOUETTES.stadium)(c, x, y, w, h, { p, seed: totem.seed });
  c.clip();

  const segs = totem.segments.length ? totem.segments : [{ fill: "solid" as FillKind, weight: 1, joint: "cut" as JointKind, inks: ["#0d0d0d"] }];
  const total = segs.reduce((n, s) => n + (s.weight || 1), 0);
  let yy = y;
  segs.forEach((seg, i) => {
    const last = i === segs.length - 1;
    /* The last one runs to the bottom, so rounding never leaves a seam. */
    const bottom = last ? y + h : yy + (h * (seg.weight || 1)) / total;
    /* A joint bleeds into the next band so a scallop has somewhere to sit. */
    const bleed = !last && seg.joint === "scallop" ? w * 0.5 : 0;
    c.save();
    cutBand(c, x, yy, w, bottom - yy + bleed, last ? "cut" : seg.joint);
    c.clip();
    (FILLS[seg.fill] ?? FILLS.solid)(c, x, yy, w, bottom - yy + bleed, {
      inks: seg.inks.length ? seg.inks : ["#0d0d0d"],
      p,
      seed: `${totem.seed}:${i}`,
    });
    c.restore();
    yy = bottom;
  });
  c.restore();
}

/* ------------------------------------------------------ making a poster */

/* `solid` is in the bag once rather than twice: a poster wants a flat column
   or two for rest, not half of them. */
const SEGMENT_FILLS: FillKind[] = [
  "stripes",
  "waves",
  "blobs",
  "chain",
  "clover",
  "camo",
  "dots",
  "solid",
];

/** The totems a poster's own seed and options describe. Deterministic: the
    same poster always builds the same row, which is what makes a link a
    picture rather than a promise. */
export function makeTotems(poster: Poster): Totem[] {
  const pal = PALETTES[poster.palette] ?? PALETTES.club;
  const out: Totem[] = [];
  /* The previous column's ground, so two neighbours never land on the same
     colour and read as one wide bar. */
  let lastGround: string | null = null;

  for (let i = 0; i < poster.columns; i++) {
    const k = `${poster.seed}:${i}`;
    const silhouette =
      poster.silhouette !== "mix"
        ? poster.silhouette
        : SILHOUETTE_KINDS[Math.floor(hash01(k + "sil") * SILHOUETTE_KINDS.length)];
    const nseg = 1 + Math.floor(hash01(k + "n") * 3);
    const segments: Segment[] = [];
    for (let s = 0; s < nseg; s++) {
      const fill =
        poster.fill !== "mix"
          ? poster.fill
          : SEGMENT_FILLS[Math.floor(hash01(`${k}f${s}`) * SEGMENT_FILLS.length)];
      const grounds: string[] = pal.grounds;
      const choices: string[] =
        s === 0 && lastGround ? grounds.filter((g) => g !== lastGround) : grounds;
      const ground: string = choices[Math.floor(hash01(`${k}g${s}`) * choices.length)];
      if (s === 0) lastGround = ground;
      const marks: string[] = (pal.marks as string[]).filter((m) => m !== ground);
      segments.push({
        fill,
        weight: 0.6 + hash01(`${k}w${s}`) * 1.5,
        joint: hash01(`${k}j${s}`) < 0.28 ? "scallop" : "cut",
        inks: [
          ground,
          marks[Math.floor(hash01(`${k}m${s}`) * marks.length)],
          marks[Math.floor(hash01(`${k}M${s}`) * marks.length)],
          "#0d0d0d",
        ],
      });
    }
    out.push({ silhouette, segments, seed: k });
  }
  return out;
}

export function defaultPoster(): Poster {
  return {
    format: "4:5",
    ground: "#ffffff",
    palette: "club",
    columns: 4,
    seed: "motion",
    silhouette: "mix",
    fill: "mix",
    kicker: "the Motion Social Club",
    title: "You don't need more tutorials. You need more practice.",
    textPlace: "bottom",
    motion: 1,
  };
}

/* ------------------------------------------------------------ the sheet */

export type TypeFaces = { sans: string; serif: string };

const FALLBACK_FACES: TypeFaces = {
  sans: "system-ui, sans-serif",
  serif: "Georgia, serif",
};

/** Wrap to a measured width. The canvas has no line breaking of its own. */
export function wrapText(c: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (c.measureText(next).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The whole poster, at any size, at one instant of its loop. */
export function drawPoster(
  c: CanvasRenderingContext2D,
  poster: Poster,
  p: number,
  W: number,
  H: number,
  faces: TypeFaces = FALLBACK_FACES,
) {
  c.fillStyle = poster.ground;
  c.fillRect(0, 0, W, H);

  /* The motion setting is whole cycles per loop, so a poster is periodic
     however many times it is asked to move. */
  const t = ((p * Math.max(0, Math.round(poster.motion))) % 1 + 1) % 1;

  const pad = W * 0.065;
  const hasText = poster.textPlace !== "none" && Boolean(poster.title || poster.kicker);
  const measured = hasText ? measureText(c, poster, W, faces) : 0;
  const top = poster.textPlace === "top" && hasText ? pad + measured : pad;
  const fieldH = H - pad * 2 - measured;

  const totems = makeTotems(poster);
  const n = totems.length;
  const gap = W * 0.028;
  const colW = (W - pad * 2 - gap * (n - 1)) / n;

  totems.forEach((totem, i) => {
    const k = totem.seed;
    /* Each column is cut to its own length and hung at its own height, so a
       row reads as a set of objects rather than a bar chart. */
    const y = top + fieldH * (hash01(k + "lead") * 0.16);
    const h = Math.min(fieldH * (0.6 + hash01(k + "len") * 0.4), top + fieldH - y);
    const x = pad + i * (colW + gap);
    drawTotem(c, totem, x, y, colW, h, t);

    /* Sometimes a second, shorter tile underneath — the stacked pairs. */
    if (hash01(k + "pair") < 0.3) {
      const y2 = y + h + gap;
      const h2 = top + fieldH - y2;
      if (h2 > colW * 0.9) {
        const tail: Totem = {
          ...totem,
          seed: k + "b",
          segments: [totem.segments[totem.segments.length - 1]],
        };
        drawTotem(c, tail, x, y2, colW, h2, t);
      }
    }
  });

  if (hasText) drawPosterText(c, poster, W, H, pad, measured, faces);
}

/* The line is set as big as it can be without eating the field: three lines
   at full size, then a step down, then one more. A control for this would be
   one more thing to get wrong — the poster knows how long its own line is. */
const TITLE_STEPS = [0.085, 0.07, 0.058];

/** The size the title is actually set at, and the lines it breaks into. */
export function fitTitle(
  c: CanvasRenderingContext2D,
  poster: Poster,
  W: number,
  faces: TypeFaces,
): { size: number; lines: string[] } {
  const maxW = W - W * 0.065 * 2;
  let chosen = { size: W * TITLE_STEPS[0], lines: [] as string[] };
  for (const step of TITLE_STEPS) {
    const size = W * step;
    c.font = `${size}px ${faces.serif}`;
    const lines = wrapText(c, poster.title, maxW);
    chosen = { size, lines };
    if (lines.length <= 3) break;
  }
  return chosen;
}

/** How tall the type band needs to be, measured rather than guessed. */
export function measureText(
  c: CanvasRenderingContext2D,
  poster: Poster,
  W: number,
  faces: TypeFaces,
): number {
  let h = 0;
  if (poster.kicker) h += W * 0.026 * 2.1;
  if (poster.title) {
    const { size, lines } = fitTitle(c, poster, W, faces);
    h += lines.length * size * 1.06;
  }
  return h + W * 0.03;
}

export function drawPosterText(
  c: CanvasRenderingContext2D,
  poster: Poster,
  W: number,
  H: number,
  pad: number,
  textH: number,
  faces: TypeFaces,
) {
  const x = pad;
  let y = poster.textPlace === "top" ? pad : H - textH;
  c.textBaseline = "top";

  if (poster.kicker) {
    const fs = W * 0.026;
    c.font = `600 ${fs}px ${faces.sans}`;
    c.letterSpacing = `${fs * 0.14}px`;
    c.fillStyle = "#6b6b6b";
    c.fillText(poster.kicker.toUpperCase(), x, y);
    c.letterSpacing = "0px";
    y += fs * 2.1;
  }
  if (poster.title) {
    const { size, lines } = fitTitle(c, poster, W, faces);
    c.font = `${size}px ${faces.serif}`;
    c.fillStyle = "#0d0d0d";
    for (const line of lines) {
      c.fillText(line, x, y);
      y += size * 1.06;
    }
  }
}

/* ------------------------------------------------------------- the link */

/* Same base64url mechanism the retired graph model used, and for the same
   reason: a poster is small enough to live in a URL, so "send me that post"
   is a link rather than a file. */
export function encodePoster(poster: Poster): string {
  const json = JSON.stringify(poster);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePoster(encoded: string): Poster | null {
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const raw = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    if (!raw || typeof raw !== "object") return null;

    /* Every field is checked against what it is allowed to be rather than
       spread in on trust. A link from the retired graph model decodes into
       perfectly valid JSON of the wrong shape, and spreading that over the
       defaults put an unknown format on a poster and took a build down. A
       stale link now opens as the nearest real poster instead. */
    const base = defaultPoster();
    const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
    const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
      typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
    const clamp = (v: unknown, lo: number, hi: number, fallback: number) =>
      typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback;

    return {
      format: oneOf(raw.format, Object.keys(FORMATS) as FormatKind[], base.format),
      ground: /^#[0-9a-fA-F]{3,8}$/.test(String(raw.ground)) ? String(raw.ground) : base.ground,
      palette: oneOf(raw.palette, PALETTE_KINDS, base.palette),
      columns: clamp(raw.columns, 1, 8, base.columns),
      seed: str(raw.seed, base.seed),
      silhouette: oneOf(raw.silhouette, ["mix", ...SILHOUETTE_KINDS] as const, base.silhouette),
      fill: oneOf(raw.fill, ["mix", ...FILL_KINDS] as const, base.fill),
      kicker: str(raw.kicker, ""),
      title: str(raw.title, ""),
      textPlace: oneOf(raw.textPlace, ["bottom", "top", "none"] as const, base.textPlace),
      motion: clamp(raw.motion, 0, 8, base.motion),
    };
  } catch {
    return null;
  }
}
