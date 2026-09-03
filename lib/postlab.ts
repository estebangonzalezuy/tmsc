// the Post Lab — spec model shared by the tool UI, the exporter, and the
// /api/postlab/schema endpoint that lets Claude generate posts from a prompt.
//
// A PostSpec fully describes a post/carousel/reel: format, slides, and the
// animated shader behind each slide. Specs travel as base64url JSON in the
// URL hash (/postlab#spec=...), so anything that can build JSON — including
// a Claude conversation reading a Notion doc — can deep-link a ready post.

export const SPEC_VERSION = 10;

export type PostFormat = "square" | "portrait" | "story" | "landscape";

export const FORMATS: Record<
  PostFormat,
  { w: number; h: number; label: string; hint: string }
> = {
  square: { w: 1080, h: 1080, label: "1:1", hint: "feed post" },
  portrait: { w: 1080, h: 1350, label: "4:5", hint: "feed / carousel" },
  story: { w: 1080, h: 1920, label: "9:16", hint: "reel / story" },
  landscape: { w: 1080, h: 608, label: "16:9", hint: "link / video post" },
};

export type Theme = "light" | "dark";

/* The Post Lab is a dithering instrument: every background is either
   Paper Shaders' Dithering ("dithering") or our own canvas-2D ordered-dither
   renderer ("forms", for shapes the shader doesn't have). "none" = plain. */
/* Two families and a blank.
 *
 * "pixelated" is the club's own: Paper's dithering and our ordered-dither
 * forms renderer, everything hard-edged and thresholded. "clean" is the
 * other half — smooth shaders that draw an image rather than a screen of
 * pixels. They are families of *drawing*, and they are not the whole story:
 * a clean layer can be put through the pixelate filter and come out in the
 * club's pixels, which is the point of splitting the two in the first
 * place. Drawing and screening stopped being the same decision. */
export type ShaderFamily = "plain" | "pixelated" | "clean" | "kinetic" | "tile" | "trails";

export type ShaderType =
  | "none"
  | "dithering"
  | "forms"
  | "kinetics"
  | "tiles"
  | "trails"
  | CleanType;

/* ------------------------------------------------------------------ waves */

/* A parameter can be a number, or a number that travels. The wave shapes:
   `sin` eases both ways, `tri` is linear back and forth, `saw` ramps and
   snaps, `square` switches hard. */
export const WAVES = ["sin", "tri", "saw", "square"] as const;
export type Wave = (typeof WAVES)[number];

/** Where a parameter travels to, and how. The parameter's own value is the
    starting point, so adding motion never changes where a layer sits. */
export type Motion = {
  to: number;
  wave?: Wave;
  /** Whole trips per loop. Integers only — that is what keeps the post
      seamless, so anything else is rounded. */
  cycles?: number;
  /** 0-1, where in the trip the loop starts. */
  phase?: number;
};

export type MotionMap = Record<string, Motion>;

/**
 * Keep only motion this thing can actually travel, with whole cycle counts.
 * Both layers and shapes come through here: the cycle count is *forced* to a
 * whole number rather than trusted, because a fractional one is the single way
 * a spec could hand back a post that doesn't loop.
 */
export function cleanMotion(
  raw: unknown,
  controls: { key: string }[],
): MotionMap | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const keys = new Set(controls.map((c) => c.key));
  const motion: MotionMap = {};
  for (const [key, m] of Object.entries(raw as MotionMap)) {
    if (!keys.has(key) || !m || typeof m.to !== "number") continue;
    motion[key] = {
      to: m.to,
      wave: WAVES.includes(m.wave as Wave) ? m.wave : "sin",
      cycles: Math.min(8, Math.max(1, Math.round(Number(m.cycles) || 1))),
      phase: Math.min(1, Math.max(0, Number(m.phase) || 0)),
    };
  }
  return Object.keys(motion).length ? motion : undefined;
}

/* `x` counts trips. Every shape returns to 0 at every whole x, which is why
   an integer cycle count leaves the loop without a seam. */
export function waveAt(wave: Wave, x: number): number {
  const f = x - Math.floor(x);
  switch (wave) {
    case "tri":
      return 1 - 2 * Math.abs(f - 0.5);
    case "saw":
      return f;
    case "square":
      return f < 0.5 ? 0 : 1;
    default:
      return 0.5 - 0.5 * Math.cos(2 * Math.PI * f);
  }
}

/* Boolean is in the index signature only for the layer's `color` switch,
   string[] only for a mix layer's `inks`, and the motion map only for
   `motion`; every shader parameter is still a number or a choice string. */
export type ShaderSpec = { type: ShaderType } & Record<
  string,
  number | string | boolean | string[] | MotionMap | FilterSpec[] | undefined
>;

/* How stacked layers mix — CSS mix-blend-mode names, which map 1:1 onto
   canvas globalCompositeOperation for export. */
export const BLENDS = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "difference",
  "exclusion",
] as const;
export type BlendMode = (typeof BLENDS)[number];

/* How a "mix" layer decides which colour lands on which pixel. All five are
   deterministic, so preview and export always agree. */
export const MIX_MODES = [
  "blocks",
  "bands",
  "radial",
  "source",
  "noise",
] as const;
export type MixMode = (typeof MIX_MODES)[number];

/** One background layer: a shader/generative spec plus mixing + transform. */
export type LayerSpec = ShaderSpec & {
  /** What colour this layer's pixels are: a hex for one colour, "mix" for
      the palette scattered across them, absent for the theme's ink. */
  ink?: string;
  /** Only for `ink: "mix"` — the subset of the palette this layer draws
      from. Absent means the whole palette, which is the normal case; set it
      to give one layer three colours and another the rest. */
  inks?: string[];
  /** Only for `ink: "mix"` — how colours are handed out across the pixels.
      Absent = "blocks", the original mosaic. */
  mixMode?: MixMode;
  /** Only for `ink: "mix"` — the size, in dither cells, of one patch of
      colour. 1 is per-pixel confetti, 12 is broad fields. Absent = 3. */
  mixScale?: number;
  /** Only for `ink: "mix"` — how fast colour travels through the palette,
      as a multiple of the layer's motion speed. 0 freezes the colours in
      place; absent = 1, the original rate. */
  mixSpeed?: number;
  /** Parameters that travel over the loop instead of holding still, keyed
      by parameter name. Only the canvas `forms` renderer reads it — the
      WebGL shader's parameters are uniforms set once per render, and
      pushing new ones every frame is not what it is for. */
  motion?: MotionMap;
  /** The picture behind a `photo` pattern. A path on this site (`/stills/…`,
      which travels in a link), `local:<id>` for a file the owner picked, or
      `clip:<id>` for a film or GIF they picked — the last two live in that
      browser and nowhere else, the same zero-config bargain the Studio and the
      Desk make. */
  src?: string;
  /** Only for a `clip:` src — whole trips through the film over one loop.
      Absent = 1. Whole numbers only, which is what stops a film opening a
      seam the way every other travelling number is stopped. */
  clipCycles?: number;
  /** How the picture fills the frame. */
  fit?: "cover" | "contain";
  /** Switched off without being deleted, so a stack can be taken apart and
      put back together. Absent means visible. */
  mute?: boolean;
  /** What happens to this layer after it's drawn, in order. Absent means
      nothing does — which is how every layer written before filters
      existed still renders. */
  filters?: FilterSpec[];
  /** Superseded by `ink`. Kept so links written when colour was a switch
      still open; normalizeSpec turns it into an `ink` and it is never
      written again. */
  color?: boolean;
  opacity: number;
  blend: BlendMode;
  offsetX: number; // -1..1
  offsetY: number; // -1..1
  rotation: number; // degrees
  scale: number;
};

/* ---------------------------------------------------------------- filters */

/* What happens to a layer after it has been drawn.
 *
 * This is the half that makes two families worth having: the club's screen
 * is no longer welded to the thing that drew the image. Put `pixelate` on a
 * liquid-metal layer and it comes out in the club's hard pixels; leave it
 * off and the metal stays smooth. Filters run in the order they're listed,
 * on the layer's own canvas, before it is composited with the rest. */
export type FilterSpec = { type: string } & Record<
  string,
  number | string | boolean | undefined
> & {
    /** Switched off without being deleted, so a chain can be taken apart and
        put back together — the thing every effect panel has and the reason you
        can tell what an effect was doing. Absent means on. */
    mute?: boolean;
    /** Numbers on this effect that travel over the loop. An effect still never
        reads the clock itself — it is handed already-resolved numbers, on whole
        cycles — so it can't be the reason a loop stops closing. */
    motion?: MotionMap;
  };

export type FilterDef = {
  type: string;
  label: string;
  hint: string;
  controls: ShaderControl[];
  choices?: ShaderChoice[];
};

export const FILTERS: FilterDef[] = [
  {
    type: "pixelate",
    label: "pixelate",
    hint: "The club's screen, over anything. Averages into cells and thresholds each one — the same ordered dither the pixelated family draws with.",
    controls: [
      { key: "cell", label: "cell", min: 2, max: 32, step: 1, def: 6 },
      { key: "amount", label: "amount", min: 0, max: 1, step: 0.05, def: 1 },
    ],
    choices: [
      {
        key: "dtype",
        label: "screen",
        values: ["4x4", "8x8", "2x2", "lines", "noise"],
        def: "4x4",
      },
    ],
  },
  {
    type: "posterize",
    label: "posterize",
    hint: "Fewer steps per channel. Keeps the colour and throws away the gradient.",
    controls: [{ key: "steps", label: "steps", min: 2, max: 16, step: 1, def: 4 }],
  },
  {
    type: "levels",
    label: "levels",
    hint: "Brightness and contrast, for pushing a shader somewhere the shader won't go on its own.",
    controls: [
      { key: "brightness", label: "bright", min: -1, max: 1, step: 0.02, def: 0 },
      { key: "contrast", label: "contrast", min: -1, max: 1, step: 0.02, def: 0 },
    ],
  },
  {
    type: "grain",
    label: "grain",
    hint: "Film grain. Fixed, not animated, so it never opens a seam in a loop.",
    controls: [
      { key: "amount", label: "amount", min: 0, max: 1, step: 0.02, def: 0.25 },
      { key: "size", label: "size", min: 1, max: 8, step: 1, def: 1 },
    ],
  },
  {
    type: "mono",
    label: "monochrome",
    hint: "Down to the slide's two tones, whatever the shader was coloured.",
    controls: [{ key: "amount", label: "amount", min: 0, max: 1, step: 0.05, def: 1 }],
  },
  {
    type: "invert",
    label: "invert",
    hint: "Flips it.",
    controls: [{ key: "amount", label: "amount", min: 0, max: 1, step: 0.05, def: 1 }],
  },
];

export const filterDef = (type: string): FilterDef | undefined =>
  FILTERS.find((f) => f.type === type);

/** A filter with every parameter it doesn't carry filled in. */
export function defaultFilter(type: string): FilterSpec {
  const def = filterDef(type);
  const spec: FilterSpec = { type };
  for (const c of def?.controls ?? []) spec[c.key] = c.def;
  for (const c of def?.choices ?? []) spec[c.key] = c.def;
  return spec;
}

export const MAX_LAYERS = 4;

/* ----------------------------------------------------------------- shapes */

/* Marks on the sheet: the club's motif language as objects you can place, one
 * at a time, over or under the words. Outlined circles, ovals, rules, arcs,
 * brackets — the same vocabulary `Motifs.tsx` draws on the site, which is why
 * there is nothing here with a shadow, a gradient or a rounded corner.
 *
 * They are not a layer. A layer is a screenful of pixels a renderer makes; a
 * shape is one drawn thing with a position, and it lives with the type in
 * `overlay.ts` because that is what it is compositionally: part of the
 * typographic layer, not part of the background.
 */
export const SHAPE_KINDS = [
  "circle",
  "oval",
  "square",
  "triangle",
  "line",
  "bar",
  "arc",
  "cross",
  "bracket",
] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

export type ShapeSpec = {
  kind: ShapeKind;
  /** Where it sits, -1..1 from the centre of the frame. */
  x: number;
  y: number;
  /** How big, as a fraction of the frame's short edge. */
  size: number;
  /** Stroke width in design units at 1080 wide. 0 fills it instead. */
  weight: number;
  rotation: number;
  opacity: number;
  /** A hex, or absent for the slide's own ink. */
  ink?: string;
  /** Drawn under the words instead of over them. */
  under?: boolean;

  /* The deformers: what turns one mark into a pattern of them. Every one is
     absent by default, and absent means a single undeformed shape. */
  /** How many copies. 1 (or absent) is just the shape. */
  repeat?: number;
  /** How the copies are laid out. */
  along?: "x" | "y" | "arc" | "ring";
  /** How far apart, as a fraction of the frame. */
  spread?: number;
  /** Deterministic scatter — fixed by the shape's seed, so it never crawls. */
  jitter?: number;
  /** Each copy turned a little further than the last. */
  twist?: number;
  /** Each copy a little smaller than the last, as a fraction. */
  taper?: number;
  /** Which scatter you get. Change it to reroll without changing anything else. */
  seed?: number;
  /** Parameters that travel over the loop, keyed by name. */
  motion?: MotionMap;
};

/** Everything on a shape a number can be set for — and therefore everything a
    loop can be plugged into. */
export const SHAPE_CONTROLS: ShaderControl[] = [
  { key: "x", label: "x", min: -1, max: 1, step: 0.01, def: 0 },
  { key: "y", label: "y", min: -1, max: 1, step: 0.01, def: 0 },
  { key: "size", label: "size", min: 0.02, max: 1.4, step: 0.01, def: 0.4 },
  { key: "weight", label: "weight", min: 0, max: 40, step: 1, def: 3 },
  { key: "rotation", label: "turn", min: 0, max: 360, step: 1, def: 0 },
  { key: "opacity", label: "opacity", min: 0.05, max: 1, step: 0.05, def: 1 },
];

/** The deformer numbers, in the order they read. */
export const SHAPE_DEFORMERS: ShaderControl[] = [
  { key: "repeat", label: "copies", min: 1, max: 24, step: 1, def: 1 },
  { key: "spread", label: "spread", min: 0, max: 1, step: 0.01, def: 0.25 },
  { key: "jitter", label: "scatter", min: 0, max: 1, step: 0.02, def: 0 },
  { key: "twist", label: "twist", min: 0, max: 360, step: 1, def: 0 },
  { key: "taper", label: "taper", min: 0, max: 1, step: 0.02, def: 0 },
];

export const MAX_SHAPES = 6;

export function defaultShape(kind: ShapeKind = "circle"): ShapeSpec {
  /* A bracket is a frame and a rule is a rule: starting them at a badge's size
     would mean every first click needs a correction. */
  const size = kind === "bracket" ? 0.92 : kind === "line" || kind === "bar" ? 0.55 : 0.4;
  return { kind, x: 0, y: 0, size, weight: 3, rotation: 0, opacity: 1 };
}

/** A shape with its travelling numbers resolved at `tt` (0-1 through the loop).
    The same arithmetic as a layer's, for the same reason: preview and export go
    through one function so they can't disagree. */
export function resolveShape(shape: ShapeSpec, tt: number): ShapeSpec {
  if (!shape.motion) return shape;
  const out = { ...shape } as ShapeSpec & Record<string, number>;
  delete out.motion;
  for (const [key, m] of Object.entries(shape.motion)) {
    const from = typeof (shape as Record<string, unknown>)[key] === "number"
      ? ((shape as unknown as Record<string, number>)[key] as number)
      : 0;
    const cycles = Math.max(1, Math.round(m.cycles ?? 1));
    out[key] = from + (m.to - from) * waveAt(m.wave ?? "sin", cycles * tt + (m.phase ?? 0));
  }
  return out;
}

/* ------------------------------------------------------------------ loops */

/* Plug-and-play motion. A wave, a number of trips and how far to go: enough to
 * name, which is the point — "pulse" is a decision you can make in one click,
 * `{ wave: "sin", cycles: 2, to: 0.63 }` is arithmetic you have to work out.
 *
 * `amount` is how far across the parameter's own range the trip goes, from
 * wherever the number is now toward whichever end is further away. So the same
 * loop reads sensibly on a 0-1 warp and on a 0-360 rotation.
 */
export const LOOPS: {
  id: string;
  name: string;
  about: string;
  wave: Wave;
  cycles: number;
  amount: number;
}[] = [
  { id: "drift", name: "drift", about: "there and back, once, eased", wave: "sin", cycles: 1, amount: 0.35 },
  { id: "breathe", name: "breathe", about: "there and back, twice", wave: "sin", cycles: 2, amount: 0.25 },
  { id: "pulse", name: "pulse", about: "four times, eased", wave: "sin", cycles: 4, amount: 0.4 },
  { id: "swing", name: "swing", about: "straight there and back", wave: "tri", cycles: 2, amount: 0.3 },
  { id: "sweep", name: "sweep", about: "ramps all the way, then snaps", wave: "saw", cycles: 1, amount: 1 },
  { id: "march", name: "march", about: "ramps and snaps, three times", wave: "saw", cycles: 3, amount: 0.6 },
  { id: "blink", name: "blink", about: "switches hard, four times", wave: "square", cycles: 4, amount: 1 },
  { id: "hold", name: "far and back", about: "all the way to the other end", wave: "sin", cycles: 1, amount: 1 },
];

export const loopDef = (id: string) => LOOPS.find((l) => l.id === id);

/* Named motion for a whole mark rather than for one of its numbers.
 *
 * "Make it spin" is a decision; `{ rotation: { to: 374, wave: "saw", cycles: 1 } }`
 * is arithmetic. Each one reads the mark it's given and moves from wherever it
 * already sits, so plugging one in never also moves the mark. This is why a
 * shape in this studio is an animated thing by default: one dropdown, and it
 * lives — a still mark is the exception, and it's one dropdown back.
 */
export const SHAPE_LOOPS: {
  id: string;
  name: string;
  about: string;
  motion: (s: ShapeSpec) => MotionMap;
}[] = [
  {
    id: "sway",
    name: "sway",
    about: "rocks a little, twice",
    motion: (s) => ({ rotation: { to: s.rotation + 14, wave: "sin", cycles: 2, phase: 0 } }),
  },
  {
    id: "spin",
    name: "spin",
    about: "one whole turn",
    motion: (s) => ({ rotation: { to: s.rotation + 360, wave: "saw", cycles: 1, phase: 0 } }),
  },
  {
    id: "breathe",
    name: "breathe",
    about: "grows and shrinks, twice",
    motion: (s) => ({
      size: { to: Math.min(1.4, s.size * 1.45), wave: "sin", cycles: 2, phase: 0 },
    }),
  },
  {
    id: "pulse",
    name: "pulse",
    about: "fades away and back, four times",
    motion: () => ({ opacity: { to: 0.15, wave: "sin", cycles: 4, phase: 0 } }),
  },
  {
    id: "drift",
    name: "drift",
    about: "wanders and comes back",
    motion: (s) => ({
      x: { to: Math.max(-1, Math.min(1, s.x + 0.16)), wave: "sin", cycles: 1, phase: 0 },
      y: { to: Math.max(-1, Math.min(1, s.y - 0.11)), wave: "sin", cycles: 1, phase: 0.25 },
    }),
  },
  {
    id: "bloom",
    name: "bloom",
    about: "the copies open out and close — needs more than one",
    motion: (s) => ({
      spread: {
        to: Math.min(1, (s.spread ?? 0.25) + 0.3),
        wave: "sin",
        cycles: 1,
        phase: 0,
      },
    }),
  },
  {
    id: "unfold",
    name: "unfold",
    about: "the copies twist round and back",
    motion: (s) => ({
      twist: { to: Math.min(360, (s.twist ?? 0) + 120), wave: "sin", cycles: 1, phase: 0 },
    }),
  },
  {
    id: "shiver",
    name: "shiver",
    about: "the scatter opens up, three times",
    motion: (s) => ({
      jitter: { to: Math.min(1, (s.jitter ?? 0) + 0.35), wave: "sin", cycles: 3, phase: 0 },
    }),
  },
];

export const shapeLoopDef = (id: string) => SHAPE_LOOPS.find((l) => l.id === id);

/** Which named loop a mark is running, if it is one of them. */
export function shapeLoopOf(shape: ShapeSpec): string {
  const has = Object.keys(shape.motion ?? {});
  if (!has.length) return "";
  for (const l of SHAPE_LOOPS) {
    const mine = l.motion(shape);
    const keys = Object.keys(mine);
    if (keys.length !== has.length || !keys.every((k) => has.includes(k))) continue;
    const same = keys.every((k) => {
      const a = shape.motion![k];
      return (
        (a.wave ?? "sin") === mine[k].wave &&
        Math.round(a.cycles ?? 1) === Math.round(mine[k].cycles ?? 1)
      );
    });
    if (same) return l.id;
  }
  return "custom";
}

/** The motion a named loop makes for one parameter, from where it sits now. */
export function applyLoop(id: string, control: ShaderControl, from: number): Motion | null {
  const loop = loopDef(id);
  if (!loop) return null;
  /* Travel toward whichever end is further away, so a number already near the
     top of its range comes down rather than flattening against the ceiling. */
  const far = from - control.min > control.max - from ? control.min : control.max;
  const to = from + (far - from) * loop.amount;
  return {
    to: Math.round(Math.min(control.max, Math.max(control.min, to)) * 100) / 100,
    wave: loop.wave,
    cycles: loop.cycles,
    phase: 0,
  };
}

/** Which named loop a motion is, if it is one — so the dropdown can show it. */
export function loopOf(m: Motion | undefined): string {
  if (!m) return "";
  const found = LOOPS.find(
    (l) => l.wave === (m.wave ?? "sin") && l.cycles === Math.round(m.cycles ?? 1),
  );
  return found?.id ?? "custom";
}

/** The switchable parts of the typographic layer, in the order they read. */
export const SLIDE_PARTS = [
  "kicker",
  "tag",
  "title",
  "body",
  "mark",
  "note",
  "footer",
  "rules",
  "shapes",
] as const;

/** Is this part of the slide drawn? */
export const partOn = (slide: { off?: string[] }, part: string) =>
  !slide.off?.includes(part);

export function defaultLayer(type: ShaderType): LayerSpec {
  const base = defaultShader(type);
  return {
    opacity: 1,
    blend: "normal",
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    scale: typeof base.scale === "number" ? base.scale : 1,
    ...base,
  };
}

/* ---------------------------------------------------------------- counting */

/** A number travelling through whole values over the loop. */
export type Counter = {
  from: number;
  to: number;
  /** Digits to pad to, so "05" holds the same room as "12" and the headline
      doesn't breathe as the number changes. Absent = no padding. */
  pad?: number;
};

const padded = (n: number, pad?: number) =>
  pad && pad > 1
    ? (n < 0 ? "-" : "") + String(Math.abs(n)).padStart(pad, "0")
    : String(n);

/**
 * What a counting slide reads at `tt` (0-1 through the loop). Every value gets
 * an equal slice and the last slice ends exactly where the first begins, so a
 * counting post loops like everything else in here — no seam, and an export is
 * still a function of the frame number.
 */
export function countAt(count: Counter, tt: number): string {
  const span = Math.round(count.to - count.from);
  const steps = Math.abs(span) + 1;
  const i = Math.min(steps - 1, Math.max(0, Math.floor(tt * steps)));
  return padded(count.from + Math.sign(span) * i, count.pad);
}

/** The widest value this counter will ever show, for measuring against: a
    headline that resized itself every time a digit dropped would jump. */
export const countWidest = (count: Counter) => {
  const a = padded(count.from, count.pad);
  const b = padded(count.to, count.pad);
  return a.length >= b.length ? a : b;
};

/** `#` stands for the counter's current value, wherever it appears. */
export const fillCount = (text: string, value: string | null) =>
  value === null ? text : text.split("#").join(value);

export type SlideSpec = {
  kicker: string;
  /** The headline. `\n` breaks a line; `*a run like this*` switches that run
      to the other voice — italic on a roman slide, roman on an italic one.
      That mixing is the reference look's whole typographic move, and it is
      markup rather than a field because it happens mid-sentence. */
  title: string;
  body: string;
  footer: string;
  /** A short label in an outlined oval above the headline — an issue number,
      a date, a chapter ("06/26"). Absent or empty draws nothing. */
  tag?: string;
  /** A small label top right — a handle, a source, a credit. It takes the
      circled mark's slot when it's set, because there is only one corner and
      a note there says more than a letter does. */
  note?: string;
  /** Hairline grid over the frame: how many columns. Cells are square, so
      the row count follows from the format. 0 or absent draws nothing. */
  grid?: number;
  /** How present the grid is, 0-1. Absent = 0.16, a drawing-board hairline
      rather than a table. */
  gridAlpha?: number;
  /** Draw the grid over the type instead of under it — the technical-drawing
      look, where the sheet's ruling crosses the words. */
  gridTop?: boolean;
  /** Where the headline block sits in the frame. Absent = "middle", which is
      how every slide was laid out before this existed. */
  anchor?: "top" | "middle" | "bottom";
  /** A number that counts over the loop. `#` anywhere in the slide's words is
      replaced by its current value — "*#* days to go", "# / 12". Absent means
      the words hold still, which is every post written before this existed.

      It is the one thing on a slide that makes the *type* move rather than
      the background, and it is what a countdown is. */
  count?: Counter;
  /** Marks on the sheet — the club's motifs as placed objects, with deformers
      to turn one into a pattern of them. Drawn with the type, over the words
      unless a shape says `under`. Absent means none, which is every post
      written before they existed. */
  shapes?: ShapeSpec[];
  /** Circled letter drawn top right; empty string hides it. */
  letter: string;
  /** What the top-right circle is for. "auto" — the default — makes it a
      page mark on a carousel and the letter on a single post, which is the
      only time a mark there is saying something you don't already know. */
  mark?: "auto" | "letter" | "page" | "none";
  /** Parts of the typographic layer switched off on this slide, by id:
      kicker, title, body, footer, mark, rules. The words stay in the spec,
      so switching one back on brings its text with it. Absent means
      everything is on, which is how every older link was written.

      `rules` is the two decorative lines — the underline beneath the kicker
      and the hairline above the footer. */
  off?: string[];
  /** Master switch for the typographic layer (kicker, title, body, footer,
      letter, ring). Off = pure background; the veil still applies. */
  text: boolean;
  titleFont: "serif" | "sans" | "gothic";
  italic: boolean;
  /** Three fixed sizes, or "fit": the headline is grown until it fills the
      frame inside the margin, however long the words are. */
  titleSize: "s" | "m" | "l" | "fit";
  /** 100-900 on the variable fonts. Absent keeps the weight each family was
      always drawn at, which is what every older link expects. */
  titleWeight?: number;
  /** The frame's breathing room, in design units at 1080 wide. Absent means
      96, which is what the layout was drawn to. */
  margin?: number;
  boxed: boolean;
  /** Filled background behind the headline so it reads over busy shaders. */
  plate: boolean;
  align: "left" | "center";
  /** Orbit ring of circled letters behind the text. */
  ring: boolean;
  /** 0-0.9 background-colored wash over the shader, for text legibility. */
  veil: number;
  /** Paint the dithered pixels from the club palette instead of the two
      theme tones. Off is the original black-and-white look. */
  color: boolean;
  /** Only used by layers set to "mix": which colour lands on which block.
      Nothing else reads it. */
  colorSeed: number;
  /** The slide's background. A hex, or absent for the theme's. */
  background?: string;
  /** Override the club palette for this slide only. Absent — the normal
      case — means the palette in this file, so editing it there restyles
      every post that never overrode it. */
  palette?: string[];
  /** 0 = off; else the ordered-dither cell size (px) the title glyphs are
      thresholded into — sharp binary ink/transparent blocks, no gray. */
  titlePixel: number;
  /** Same dithering, applied to every other glyph: kicker, letter mark,
      body, footer, and the ring's circled letters. */
  metaPixel: number;
  theme: Theme;
  /** Background layer stack, bottom first (1-4 layers). */
  layers: LayerSpec[];
};

export type PostSpec = {
  v: number;
  format: PostFormat;
  /** Seconds of animation recorded when exporting video. */
  duration: number;
  slides: SlideSpec[];
};

/* ---------------------------------------------------------------- shaders */

export type ShaderControl = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  def: number;
};

export type ShaderChoice = {
  key: string;
  label: string;
  values: string[];
  def: string;
  /** Odds that a random roll keeps the default instead of picking freely.
      The combining choices default to "off", and a randomise button that
      turned everything on at once would only ever produce mush. */
  keepDefault?: number;
};

export type ShaderDef = {
  type: ShaderType;
  label: string;
  /** Which half of the tool it belongs to. Absent means pixelated, which is
      what everything was before there was a second half. */
  family?: ShaderFamily;
  animated: boolean;
  /** "shader" renders via Paper Shaders (WebGL); "generative" via canvas 2D
      procedural animators that loop seamlessly over the post duration. */
  kind: "shader" | "generative";
  controls: ShaderControl[];
  choices?: ShaderChoice[];
};

const speed = (def = 0.6): ShaderControl => ({
  key: "speed",
  label: "speed",
  min: 0,
  max: 2,
  step: 0.05,
  def,
});
const scale = (def = 1): ShaderControl => ({
  key: "scale",
  label: "scale",
  min: 0.2,
  max: 3,
  step: 0.05,
  def,
});

const paperDithering: ShaderDef = {
  type: "dithering",
  label: "dithering",
  animated: true,
  kind: "shader",
  family: "pixelated",
  controls: [
    speed(0.5),
    scale(0.9),
    { key: "size", label: "pixel", min: 1, max: 14, step: 0.5, def: 3 },
  ],
  choices: [
    {
      key: "shape",
      label: "shape",
      values: ["simplex", "warp", "dots", "wave", "ripple", "swirl", "sphere"],
      def: "sphere",
    },
    {
      key: "dtype",
      label: "dither",
      values: ["4x4", "8x8", "2x2", "random"],
      def: "4x4",
    },
  ],
};

/* Every grayscale form the forms renderer can draw. The first four are the
   original set; the rest were added later and cost old links nothing, since
   a link only ever names the one it uses. */
export const FORM_PATTERNS = [
  "rings",
  "ramp",
  "bars",
  "letter",
  "spiral",
  "grid",
  "blobs",
  "tunnel",
  "noise",
  "moire",
  /* A photograph is a grayscale source like any other: it gets sampled at
     the cell size and thresholded, so it comes out in the same hard pixels
     and can be mixed, folded and inked exactly like a drawn form. Which
     picture is on the layer, not on the pattern — see `src`. */
  "photo",
] as const;

/** Patterns that need a picture on the layer to draw anything. */
export const usesPhoto = (layer: LayerSpec) =>
  layer.pattern === "photo" || layer.pattern2 === "photo";

/* How a layer's two forms are combined before the dither threshold. Mixing
   grayscale sources and then dithering the result keeps everything in the
   one pixel language — nothing here is a second render pass. */
export const FORM_MIXES = [
  "solo",
  "add",
  "sub",
  "mul",
  "diff",
  "max",
  "min",
] as const;

/** Fold applied to the coordinates before sampling, so any form can be made
    symmetrical without a second layer. */
export const FORM_SYMMETRIES = ["none", "x", "y", "quad", "radial"] as const;

/* Shapes the shader doesn't have, rendered grayscale on canvas 2D and pushed
   through an ordered dither — same pixel language, new vocabulary. All loop
   seamlessly over the post duration; `warp` bends the source through a flow
   field before dithering, `pattern2` + `mix` fold a second form into the
   first, and `fold` mirrors the result. */
const ditheredForms: ShaderDef = {
  type: "forms",
  label: "dithered forms",
  animated: true,
  kind: "generative",
  family: "pixelated",
  controls: [
    speed(0.5),
    { key: "pixel", label: "pixel", min: 2, max: 16, step: 1, def: 6 },
    { key: "density", label: "density", min: 1, max: 24, step: 1, def: 8 },
    { key: "warp", label: "warp", min: 0, max: 1, step: 0.05, def: 0.2 },
    /* Gamma on the photo before it meets the threshold — the one knob that
       decides how much of a picture survives being dithered. Only shown
       when a photo is in play. */
    { key: "exposure", label: "exposure", min: 0.2, max: 2.5, step: 0.05, def: 1 },
  ],
  choices: [
    {
      key: "pattern",
      label: "pattern",
      values: [...FORM_PATTERNS],
      def: "rings",
    },
    {
      key: "pattern2",
      label: "and",
      values: ["none", ...FORM_PATTERNS],
      def: "none",
      keepDefault: 0.5,
    },
    {
      key: "mix",
      label: "mixed",
      values: [...FORM_MIXES],
      def: "solo",
      keepDefault: 0.2,
    },
    {
      key: "fold",
      label: "fold",
      values: [...FORM_SYMMETRIES],
      def: "none",
      keepDefault: 0.55,
    },
    {
      key: "dtype",
      label: "dither",
      values: ["4x4", "8x8", "2x2", "lines", "noise"],
      def: "4x4",
    },
    {
      key: "word",
      label: "word",
      values: ["M", "tMSC", "MOTION", "CLUB"],
      def: "M",
    },
  ],
};

/* ------------------------------------------------------------ the clean */

/* Paper Shaders ships far more than the dithering we were using; these are
 * the ones that draw something a post can be built on. Every number below
 * is the shader's own default, so a layer starts where its author put it.
 *
 * Colour is not in here on purpose. Each of these takes a different set of
 * colour props and the club's answer is always the same — the slide's two
 * tones, or the layer's inks when colour was asked for — so it is worked
 * out in one place (`paintProps`) rather than nineteen. */
const n = (
  key: string,
  min: number,
  max: number,
  step: number,
  def: number,
  label = key,
): ShaderControl => ({ key, label, min, max, step, def });

const c = (key: string, values: string[], def: string, label = key): ShaderChoice => ({
  key,
  label,
  values,
  def,
});

const CLEAN: {
  type: string;
  label: string;
  controls: ShaderControl[];
  choices?: ShaderChoice[];
}[] = [
  {
    type: "metal",
    label: "liquid metal",
    controls: [
      speed(1),
      scale(1),
      n("repetition", 1, 8, 0.1, 2),
      n("distortion", 0, 1, 0.01, 0.07),
      n("contour", 0, 1, 0.01, 0.4),
      n("softness", 0, 1, 0.01, 0.1),
      n("shiftRed", -1, 1, 0.01, 0.3, "red"),
      n("shiftBlue", -1, 1, 0.01, 0.3, "blue"),
      n("angle", 0, 360, 1, 70),
    ],
    choices: [
      /* "none" fills the frame, which is what a background wants; the
         shapes are there for when it shouldn't. */
      c("shape", ["none", "circle", "daisy", "metaballs", "diamond"], "none"),
    ],
  },
  {
    type: "mesh",
    label: "mesh gradient",
    controls: [speed(1), n("distortion", 0, 1, 0.01, 0.8), n("swirl", 0, 1, 0.01, 0.1)],
  },
  {
    type: "smoke",
    label: "gem smoke",
    controls: [
      speed(1),
      scale(0.6),
      n("size", 0, 2, 0.01, 0.8),
      n("innerDistortion", 0, 2, 0.01, 0.8, "inner"),
      n("outerDistortion", 0, 2, 0.01, 0.6, "outer"),
      n("outerGlow", 0, 1, 0.01, 0.55, "glow"),
      n("angle", 0, 360, 1, 0),
    ],
    choices: [c("shape", ["circle", "diamond", "square"], "diamond")],
  },
  {
    type: "rays",
    label: "god rays",
    controls: [
      speed(0.75),
      n("density", 0, 1, 0.01, 0.3),
      n("intensity", 0, 1, 0.01, 0.8),
      n("spotty", 0, 1, 0.01, 0.3),
      n("bloom", 0, 1, 0.01, 0.4),
      n("midSize", 0, 1, 0.01, 0.2, "mid size"),
    ],
  },
  {
    type: "grain",
    label: "grain gradient",
    controls: [
      speed(1),
      n("softness", 0, 1, 0.01, 0.5),
      n("intensity", 0, 1, 0.01, 0.5),
      n("noise", 0, 1, 0.01, 0.25),
    ],
    choices: [
      c(
        "shape",
        ["wave", "dots", "truchet", "corners", "ripple", "blob", "sphere"],
        "corners",
      ),
    ],
  },
  {
    type: "water",
    label: "water",
    controls: [
      speed(1),
      scale(0.8),
      n("size", 0, 2, 0.01, 1),
      n("waves", 0, 1, 0.01, 0.3),
      n("caustic", 0, 1, 0.01, 0.1),
      n("edges", 0, 1, 0.01, 0.8),
      n("layering", 0, 1, 0.01, 0.5),
    ],
  },
  {
    type: "ring",
    label: "smoke ring",
    controls: [
      speed(0.5),
      scale(0.8),
      n("radius", 0, 1, 0.01, 0.25),
      n("thickness", 0, 1, 0.01, 0.65),
      n("innerShape", 0, 2, 0.01, 0.7, "inner"),
      n("noiseScale", 0.5, 6, 0.1, 3, "noise"),
    ],
  },
  {
    type: "balls",
    label: "metaballs",
    controls: [speed(1), scale(1), n("count", 1, 20, 1, 10), n("size", 0, 2, 0.01, 0.83)],
  },
  {
    type: "neuro",
    label: "neuro noise",
    controls: [
      speed(1),
      scale(1),
      n("brightness", 0, 1, 0.01, 0.05),
      n("contrast", 0, 1, 0.01, 0.3),
    ],
  },
  {
    type: "cells",
    label: "voronoi",
    controls: [
      speed(0.5),
      scale(0.5),
      n("distortion", 0, 1, 0.01, 0.4),
      n("gap", 0, 0.5, 0.01, 0.04),
      n("glow", 0, 1, 0.01, 0),
      n("stepsPerColor", 1, 8, 1, 3, "steps"),
    ],
  },
  {
    type: "warpfield",
    label: "warp",
    controls: [
      speed(1),
      n("proportion", 0, 1, 0.01, 0.45),
      n("softness", 0, 1, 0.01, 1),
      n("distortion", 0, 1, 0.01, 0.25),
      n("swirl", 0, 1, 0.01, 0.8),
      n("shapeScale", 0, 1, 0.01, 0.1, "shape sc."),
      n("rotation", 0, 360, 1, 0),
    ],
    choices: [c("shape", ["stripes", "checks", "edge"], "checks")],
  },
  {
    type: "twist",
    label: "swirl",
    controls: [
      speed(0.32),
      n("bandCount", 1, 12, 1, 4, "bands"),
      n("twist", 0, 1, 0.01, 0.1),
      n("center", 0, 1, 0.01, 0.2),
      n("softness", 0, 1, 0.01, 0),
      n("noise", 0, 1, 0.01, 0.2),
    ],
  },
  {
    type: "ripples",
    label: "waves",
    controls: [
      scale(0.6),
      n("frequency", 0, 2, 0.01, 0.5),
      n("amplitude", 0, 2, 0.01, 0.5),
      n("spacing", 0, 3, 0.01, 1.2),
      n("proportion", 0, 1, 0.01, 0.1),
      n("softness", 0, 1, 0.01, 0),
      n("rotation", 0, 360, 1, 0),
    ],
  },
  {
    type: "coil",
    label: "spiral",
    controls: [
      speed(1),
      scale(1),
      n("density", 0, 4, 0.05, 1),
      n("distortion", 0, 1, 0.01, 0),
      n("strokeWidth", 0, 1, 0.01, 0.5, "stroke"),
      n("strokeTaper", 0, 1, 0.01, 0, "taper"),
      n("noise", 0, 1, 0.01, 0),
      n("softness", 0, 1, 0.01, 0),
    ],
  },
  {
    type: "orbit",
    label: "dot orbit",
    controls: [
      speed(1.5),
      scale(1),
      n("size", 0, 2, 0.01, 1),
      n("sizeRange", 0, 1, 0.01, 0),
      n("spreading", 0, 1, 0.01, 1),
    ],
  },
  {
    type: "panels",
    label: "colour panels",
    controls: [
      speed(0.5),
      scale(0.8),
      n("density", 1, 8, 1, 3),
      n("length", 0, 3, 0.05, 1.1),
      n("blur", 0, 1, 0.01, 0),
      n("gradient", 0, 1, 0.01, 0),
      n("angle1", 0, 360, 1, 0, "angle a"),
      n("angle2", 0, 360, 1, 0, "angle b"),
    ],
  },
  {
    type: "paper",
    label: "paper texture",
    controls: [
      scale(0.6),
      n("contrast", 0, 1, 0.01, 0.3),
      n("roughness", 0, 1, 0.01, 0.4),
      n("fiber", 0, 1, 0.01, 0.3),
      n("crumples", 0, 1, 0.01, 0.3),
      n("folds", 0, 1, 0.01, 0.65),
      n("foldCount", 0, 12, 1, 5, "fold no."),
      n("drops", 0, 1, 0.01, 0.2),
    ],
  },
];

export type CleanType = (typeof CLEAN)[number]["type"];

const cleanDefs: ShaderDef[] = CLEAN.map((s) => ({
  type: s.type as ShaderType,
  label: s.label,
  animated: true,
  kind: "shader",
  family: "clean",
  controls: s.controls,
  choices: s.choices,
}));

/* the Kinetics, borrowed whole.
 *
 * The other studio's argument is that the words *are* the picture; this is
 * that argument available as one layer of a post, drawn by the same renderer
 * from the slide's own headline. Seven scenes behind one `scene` choice, and
 * one `density` dial that means "more of it" whichever scene is showing —
 * the full control set lives in the Kinetics, which is where it belongs.
 *
 * It counts as `generative` because that is exactly what it is: canvas 2D, a
 * pure function of the frame, periodic in the post's duration. So the exporter
 * draws it directly and a reel with one in it still closes its loop. */
const kineticsLayer: ShaderDef = {
  type: "kinetics",
  label: "kinetic type",
  animated: true,
  kind: "generative",
  family: "kinetic",
  controls: [
    { key: "density", label: "density", min: 0, max: 1, step: 0.02, def: 0.45 },
    { key: "kblot", label: "blotter", min: 0, max: 100, step: 1, def: 0 },
    { key: "kweight", label: "weight", min: 100, max: 900, step: 100, def: 800 },
  ],
  choices: [
    {
      key: "scene",
      label: "scene",
      values: ["stagger", "strokes", "mosaic", "arcs", "field", "bleed", "halftone"],
      def: "stagger",
    },
    { key: "kface", label: "face", values: ["sans", "serif", "gothic"], def: "sans" },
  ],
};

/* the Tiles, borrowed whole.
 *
 * The third studio available as one layer of a post, drawn by the same
 * renderer from one of its thirteen starting points. One `tile` choice and one
 * `tdensity` dial that means "more of it" whichever tile is showing — the full
 * control set lives in the Tiles, which is where it belongs.
 *
 * It counts as `generative` for the same reason the Kinetics does: canvas 2D,
 * a pure function of the frame, periodic in the post's duration. So the
 * exporter draws it directly and a reel with one in it still loops.
 *
 * It is the one layer that brings its own colour. A tile is three or four flat
 * inks by construction, and a two-tone tile is not a quieter tile, it is a
 * different object. Set the layer's ink to `mix` and the post's palette takes
 * over the ornament, which is the escape hatch. */
const tilesLayer: ShaderDef = {
  type: "tiles",
  label: "tile",
  animated: true,
  kind: "generative",
  family: "tile",
  controls: [
    { key: "tdensity", label: "density", min: 0, max: 1, step: 0.02, def: 0.5 },
    { key: "thand", label: "the hand", min: 0, max: 1, step: 0.02, def: 0.4 },
    { key: "tboil", label: "boil", min: 0, max: 12, step: 1, def: 3 },
  ],
  choices: [
    {
      key: "tile",
      label: "tile",
      values: [
        "spokes",
        "flames",
        "pinwheel",
        "bloom",
        "union",
        "leaves",
        "orbit",
        "cross",
        "star",
        "rings",
        "alarm",
        "beacon",
        "carnival",
      ],
      def: "spokes",
    },
    {
      key: "tpalette",
      label: "palette",
      values: [
        "own",
        "harbour",
        "thicket",
        "ember",
        "flag",
        "union",
        "garden",
        "night",
        "signal",
        "cocoa",
        "peach",
        "sunny",
        "alarm",
        "carnival",
      ],
      def: "own",
    },
  ],
};

/* Trails — the smooth register, after Light Rails. Soft glowing colour bands
 * on a bow, canvas 2D, no threshold: the club's pixels' other half, the one
 * that doesn't dither. Named "trails" rather than "rays" — that name was
 * already the WebGL clean family's own god-rays shader below, a different
 * technique entirely. `kind: "generative"` for the same reason the Kinetics
 * and the Tiles are — a pure function of the frame, periodic in the post's
 * own duration, so the exporter draws it directly and a reel with one in it
 * still loops. One tuned shape rather than a shape switcher, so no `choices`.
 */
const trailsLayer: ShaderDef = {
  type: "trails",
  label: "trails",
  animated: true,
  kind: "generative",
  family: "trails",
  controls: [
    speed(0.6),
    n("count", 1, 6, 1, 3, "bands"),
    n("width", 0.02, 0.4, 0.01, 0.14),
    n("curve", 0, 1, 0.02, 0.35, "bow"),
    n("spread", 0.1, 1, 0.02, 0.55),
    n("glow", 0, 100, 1, 55),
    n("angle", 0, 360, 1, 20),
  ],
};

export const SHADERS: ShaderDef[] = [
  {
    type: "none",
    label: "plain",
    animated: false,
    kind: "shader",
    family: "plain",
    controls: [],
  },
  paperDithering,
  ditheredForms,
  kineticsLayer,
  tilesLayer,
  trailsLayer,
  ...cleanDefs,
];

/** Every family that draws, grouped the way the tool offers them. */
export const familyOf = (type: ShaderType): ShaderFamily =>
  shaderDef(type).family ?? "pixelated";

export const shaderDef = (type: ShaderType): ShaderDef =>
  SHADERS.find((s) => s.type === type) ?? SHADERS[0];

/** The parameters of a layer that can be given motion: everything the
    shader exposes as a number, plus where the layer sits. */
export function animatable(type: ShaderType): ShaderControl[] {
  return [
    ...shaderDef(type).controls,
    { key: "offsetX", label: "x", min: -1, max: 1, step: 0.01, def: 0 },
    { key: "offsetY", label: "y", min: -1, max: 1, step: 0.01, def: 0 },
    { key: "scale", label: "scale", min: 0.1, max: 4, step: 0.05, def: 1 },
    { key: "rotation", label: "rotation", min: 0, max: 360, step: 1, def: 0 },
  ];
}

/**
 * A layer with its travelling parameters resolved to the numbers they hold
 * at `tt` (0-1 through the loop). Preview and export both go through this,
 * so what you watch and what you export are the same arithmetic.
 */
export function resolveLayer(layer: LayerSpec, tt: number): LayerSpec {
  const motion = layer.motion;
  const chain = layer.filters?.some((f) => f.motion);
  if (!motion && !chain) return layer;
  const out = { ...layer } as LayerSpec;
  delete out.motion;
  for (const [key, m] of Object.entries(motion ?? {})) {
    const from = typeof layer[key] === "number" ? (layer[key] as number) : 0;
    const cycles = Math.max(1, Math.round(m.cycles ?? 1));
    const k = waveAt(m.wave ?? "sin", cycles * tt + (m.phase ?? 0));
    out[key] = from + (m.to - from) * k;
  }
  /* An effect's own numbers travel the same way. The effect is handed the
     resolved value — it never reads the clock — so the chain animates without
     any of it being able to open a seam. */
  if (chain) out.filters = layer.filters!.map((f) => resolveFilter(f, tt));
  return out;
}

/** One effect with its travelling numbers resolved at `tt`. */
export function resolveFilter(f: FilterSpec, tt: number): FilterSpec {
  if (!f.motion) return f;
  const out = { ...f } as FilterSpec & Record<string, number>;
  delete out.motion;
  for (const [key, m] of Object.entries(f.motion)) {
    const from = typeof (f as Record<string, unknown>)[key] === "number"
      ? ((f as unknown as Record<string, number>)[key] as number)
      : 0;
    const cycles = Math.max(1, Math.round(m.cycles ?? 1));
    out[key] = from + (m.to - from) * waveAt(m.wave ?? "sin", cycles * tt + (m.phase ?? 0));
  }
  return out;
}

/* ------------------------------------------------------------- the loop */

/* Whether a background returns to where it started at the end of the post.
   The club's own forms renderer is written to: every form is periodic in
   the post duration, and so is the colour rotation and any wave above. The
   WebGL dithering is a different matter — its shapes advance through noise
   that never repeats, so a recorded window has a seam. `swirl` is the
   exception: it ignores time entirely. */
const LOOPING_SHAPES = ["swirl"];

export function layerLoops(layer: LayerSpec): boolean {
  if (layer.mute) return true;
  if (layer.type !== "dithering") return true;
  if (Number(layer.speed ?? 0) === 0) return true;
  return LOOPING_SHAPES.includes(String(layer.shape ?? ""));
}

/** What to tell the owner before they export: whether this slide comes back
    to its first frame, and which layer is why it doesn't. */
export function loopReport(slide: SlideSpec): { loops: boolean; why: string[] } {
  const why: string[] = [];
  slide.layers.forEach((l, i) => {
    if (layerLoops(l)) return;
    why.push(
      `layer ${String(i + 1).padStart(2, "0")} — the dithering shader's ` +
        `${l.shape} doesn't repeat. Freeze its speed, switch it to swirl, or ` +
        `use dithered forms instead.`,
    );
  });
  return { loops: why.length === 0, why };
}

/* --------------------------------------------------------------- styles */

/* A style is a slide with the words taken out: how it looks, not what it
   says. Copying one onto another slide is how a carousel reads as one
   piece, and jittering one is how you get five posts that are obviously
   siblings without being the same post twice. */
const STYLE_FIELDS = [
  "theme",
  "background",
  "palette",
  "shapes",
  "grid",
  "gridAlpha",
  "gridTop",
  "anchor",
  "veil",
  "titleFont",
  "italic",
  "titleSize",
  "boxed",
  "plate",
  "align",
  "ring",
  "titlePixel",
  "metaPixel",
  "colorSeed",
] as const;

/** Where a layer sits, as opposed to what it draws. */
const TRANSFORM_KEYS = ["offsetX", "offsetY", "scale", "rotation"];

export type SlideStyle = Partial<SlideSpec> & { layers: LayerSpec[] };

export function styleOf(slide: SlideSpec): SlideStyle {
  const style: SlideStyle = { layers: structuredClone(slide.layers) };
  /* Every field, including the ones this slide doesn't carry: a look has to
     be able to say "no grid" and "no ground", or pasting a plain look onto a
     decorated slide would leave the decoration behind. An absent field
     travels as an explicit undefined and minifySpec drops it again. */
  for (const key of STYLE_FIELDS) {
    (style as Record<string, unknown>)[key] = slide[key];
  }
  return structuredClone(style);
}

/** The style on top of this slide's own words. */
export function applyStyle(slide: SlideSpec, style: SlideStyle): SlideSpec {
  return { ...slide, ...structuredClone(style) };
}

/**
 * The same rules with room to move: every number drifts within `amount` of
 * its range, and the colours are rearranged. Every *decision* — which form,
 * how it mixes, what it is inked with — is left alone, because that is what
 * makes the results read as one family rather than as a shuffle.
 */
/* Blends worth stacking with. Layers are already transparent, so `normal`
   is the honest default and the rest are there for the times two layers
   should argue with each other. */
const STACK_BLENDS: BlendMode[] = [
  "normal",
  "normal",
  "normal",
  "multiply",
  "difference",
  "exclusion",
  "screen",
];

/**
 * A whole look rolled from nothing: one to three dithered-forms layers with
 * every option in play — forms, mixes, folds, screens, colour, travelling
 * parameters, a background.
 *
 * Two rules keep the results usable rather than merely random. Stacked
 * layers get finer as they go up, so a coarse field reads through a fine
 * one instead of two identical grids fighting; and colour is all or
 * nothing on a slide, because one coloured layer under a black-and-white
 * one just looks like a mistake.
 *
 * Only the club's own renderer is rolled. That is what makes a sheet of
 * these cheap to draw, and it is also the half of the tool that loops.
 */
/* A look rolled out of the Kinetics rather than out of the forms renderer.
 *
 * It is a single layer on purpose: a kinetic layer paints its own ground,
 * because the words are the picture and a picture has to sit on something.
 * Stacking two of them would just hide the first.
 *
 * This is also the one roll allowed to touch the type, and the exception is
 * narrower than it looks. The rule is that a roll decides what the graphic is
 * and never whether the owner's words can be read — but here the graphic *is*
 * the words. Leaving the typographic layer switched on wouldn't be a
 * readability decision, it would print the headline twice. The footer stays,
 * because a handle in the corner is not the headline. */
function randomKinetic(rand: () => number): SlideStyle {
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const scenes =
    shaderDef("kinetics").choices?.find((c) => c.key === "scene")?.values ?? ["stagger"];

  const layer = { ...defaultLayer("kinetics") } as LayerSpec;
  layer.scene = pick(scenes);
  layer.density = Math.round(rand() * 100) / 100;
  layer.kface = pick(["sans", "serif", "gothic"]);
  layer.kweight = pick([400, 700, 800, 900]);
  /* A blotter now and then. It is the one thing here that changes what the
     piece is made of rather than how much of it there is, so it wants to turn
     up sometimes and not most times. Kept below the spread that eats fine
     type. */
  layer.kblot = rand() < 0.3 ? 8 + Math.floor(rand() * 34) : 0;

  /* No travelling number is plugged in, and this is the one roll where that
     isn't an oversight: a Kinetics scene is a function of the playhead by
     construction. It arrives moving because there is no version of it that
     stands still. */
  return {
    layers: [layer],
    theme: rand() < 0.45 ? "dark" : "light",
    colorSeed: Math.floor(rand() * 9999) + 1,
    off: ["kicker", "title", "body", "mark", "rules"],
    /* The veil exists to hold type up off a busy graphic. Here it would only
       fog the thing it was meant to help. */
    veil: 0,
  };
}

/* Trails is a background graphic like forms — over the words, not instead
   of them — so unlike randomKinetic it never touches `off`. Colour reads
   well here more often than it does on the dithered register: this is the
   one that's meant to glow. */
function randomTrails(rand: () => number): SlideStyle {
  const layer = {
    ...defaultLayer("trails"),
    ...randomShader("trails"),
  } as LayerSpec;

  const coloured = rand() < 0.55;
  const palette = PALETTE;
  if (coloured) {
    if (rand() < 0.7) {
      layer.ink = "mix";
      /* A narrower set reads as a decision; the whole palette reads as
         confetti — same rule the forms roll follows. */
      const inks = [...palette].sort(() => rand() - 0.5).slice(2 + Math.floor(rand() * 3));
      if (inks.length >= 2) layer.inks = inks;
    } else {
      layer.ink = paletteInk(Math.floor(rand() * 9999), "light", palette);
    }
  }

  const style: SlideStyle = {
    layers: [layer],
    /* Dark is where a glowing band actually glows. */
    theme: rand() < 0.55 ? "dark" : "light",
    colorSeed: Math.floor(rand() * 9999) + 1,
  };
  if (coloured) style.background = paletteAt(Math.floor(rand() * 9999), 3, palette);
  return style;
}

/**
 * A look from nothing.
 *
 * It rolls across the families that *close their loop* — the Kinetics, the
 * smooth trails and, rarely, the club's own dithered forms. Dithering used to
 * be what every non-Kinetics roll produced; now it's the deliberate minority,
 * because a roll should mostly hand back the register that doesn't pixelate.
 * The WebGL dithering and the clean shaders stay out of here entirely: they
 * animate, but they walk through noise that never repeats, and a roll that
 * handed back a post with a seam in it would be worse than a roll with a
 * narrower vocabulary.
 */
export function randomSlide(rand: () => number = Math.random): SlideStyle {
  const family = rand();
  if (family < 0.35) return randomKinetic(rand);
  if (family < 0.9) return randomTrails(rand);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const count = 1 + Math.floor(rand() * 3);
  const coloured = rand() < 0.45;
  const palette = PALETTE;

  const layers: LayerSpec[] = Array.from({ length: count }, (_, i) => {
    const layer = {
      ...defaultLayer("forms"),
      ...randomShader("forms"),
    } as LayerSpec;

    /* Coarse underneath, fine on top. */
    const coarse = 9 + Math.floor(rand() * 7);
    const fine = 2 + Math.floor(rand() * 4);
    layer.pixel = count === 1 ? 3 + Math.floor(rand() * 9) : i === 0 ? coarse : fine;

    if (i > 0) {
      layer.blend = pick(STACK_BLENDS);
      layer.opacity = Math.round((0.45 + rand() * 0.55) * 20) / 20;
    }

    if (coloured && rand() < 0.75) {
      if (rand() < 0.6) {
        layer.ink = "mix";
        /* A narrower set reads as a decision; the whole palette reads as
           confetti. */
        const inks = [...palette].sort(() => rand() - 0.5).slice(2 + Math.floor(rand() * 3));
        if (inks.length >= 2) layer.inks = inks;
        layer.mixMode = pick(MIX_MODES);
        layer.mixScale = 1 + Math.floor(rand() * 8);
        layer.mixSpeed = Math.round(rand() * 20) / 10;
      } else {
        layer.ink = paletteInk(Math.floor(rand() * 9999), "light", palette);
      }
    }

    /* Every one of them gets a number that travels — a still graphic is not
       something this studio makes, so a roll never produces one. Never
       `speed`, which also sets how fast the colours move. */
    {
      const movable = shaderDef("forms").controls.filter(
        (c) => c.key !== "speed" && (c.key !== "exposure" || usesPhoto(layer)),
      );
      const c = pick(movable);
      const from = Number(layer[c.key] ?? c.def);
      const far = from < (c.min + c.max) / 2 ? c.max : c.min;
      layer.motion = {
        [c.key]: {
          to: Math.round((from + (far - from) * (0.5 + rand() * 0.45)) * 100) / 100,
          wave: pick(WAVES),
          cycles: 1 + Math.floor(rand() * 3),
          phase: 0,
        },
      };
    }

    return layer;
  });

  /* Deliberately no `veil` and no type settings: a roll decides what the
     graphic is, not whether the words on top of it can be read. Those stay
     where the owner left them. */
  const style: SlideStyle = {
    layers,
    theme: rand() < 0.3 ? "dark" : "light",
    colorSeed: Math.floor(rand() * 9999) + 1,
  };
  if (coloured) style.background = paletteAt(Math.floor(rand() * 9999), 3, palette);
  return style;
}

export function varyStyle(
  style: SlideStyle,
  amount = 0.25,
  rand: () => number = Math.random,
): SlideStyle {
  const next = structuredClone(style);
  next.colorSeed = Math.floor(rand() * 9999) + 1;
  next.layers = next.layers.map((layer) => {
    const out = { ...layer };
    for (const c of animatable(layer.type)) {
      const cur = typeof out[c.key] === "number" ? (out[c.key] as number) : c.def;
      /* The transform stays where it is unless it had already been moved by
         hand. A background fills the frame, so shrinking or turning it only
         drags the edges into shot — and a family of posts where one member
         is a small square in the middle isn't a family. */
      if (TRANSFORM_KEYS.includes(c.key) && cur === c.def) continue;
      const span = (c.max - c.min) * amount;
      const drift = (rand() * 2 - 1) * span;
      const v = Math.min(c.max, Math.max(c.min, cur + drift));
      out[c.key] = Math.round(v / c.step) * c.step;
      out[c.key] = Math.round((out[c.key] as number) * 100) / 100;
    }
    return out;
  });
  return next;
}

/* A usable random background rather than a uniform one: parameters land in
   the middle 60% of each range, because the ends are where posts stop
   working — speed 0 doesn't move, warp 1 is mush, density 1 is empty. */
export function randomShader(type?: ShaderType): ShaderSpec {
  const pool = SHADERS.filter((s) => s.type !== "none");
  const def = type ? shaderDef(type) : pool[Math.floor(Math.random() * pool.length)];
  const spec: ShaderSpec = { type: def.type };
  for (const c of def.controls) {
    const lo = c.min + (c.max - c.min) * 0.2;
    const hi = c.min + (c.max - c.min) * 0.8;
    const stepped = Math.round((lo + Math.random() * (hi - lo)) / c.step) * c.step;
    spec[c.key] = Math.round(stepped * 100) / 100;
  }
  for (const c of def.choices ?? []) {
    /* Never roll "photo": the dice have no picture to hand it, and a photo
       pattern without a `src` draws nothing at all. Choosing an image is a
       decision, like choosing a colour. */
    const values = c.values.filter((v) => v !== "photo");
    spec[c.key] =
      c.keepDefault && Math.random() < c.keepDefault
        ? c.def
        : values[Math.floor(Math.random() * values.length)];
  }
  /* A second form that is never mixed in is just a slower render, and a mix
     mode with nothing to mix does nothing — roll them together or not at
     all. */
  if (spec.pattern2 === "none") spec.mix = "solo";
  else if (spec.mix === "solo") spec.pattern2 = "none";
  return spec;
}

export function defaultShader(type: ShaderType): ShaderSpec {
  const def = shaderDef(type);
  const spec: ShaderSpec = { type };
  for (const c of def.controls) spec[c.key] = c.def;
  for (const c of def.choices ?? []) spec[c.key] = c.def;
  return spec;
}

/* The club's palette. Colour is off by default and the spec never carries a
   hex — a slide says only whether colour is on and which seed picks from
   this list, so the palette stays a design decision in one place and every
   existing link keeps working untouched. */
export const PALETTE = [
  "#adb4f5", // periwinkle
  "#2e7d46", // green
  "#000000", // black
  "#ffffff", // white
  "#ee4b2b", // orange red
  "#3d3deb", // indigo
  "#fffdf0", // cream
] as const;

/* The grounds: the sheet a post is printed on.
 *
 * Deliberately not the palette. The palette is colour, and on the site
 * colour only ever answers a pointer; a ground is paper — the neutral a
 * whole post sits on, which in this register is almost never pure white. A
 * slide's `background` can still be any hex the owner picks; these are the
 * ones worth having a button for. */
export const GROUNDS: { hex: string; label: string }[] = [
  { hex: "#ffffff", label: "white" },
  { hex: "#f4f3ef", label: "paper" },
  { hex: "#e6e5e1", label: "ash" },
  { hex: "#fffdf0", label: "cream" },
  { hex: "#1a1a1a", label: "slate" },
  { hex: "#0d0d0d", label: "black" },
];

/* Deterministic pick, so preview and export agree and a link always renders
   the same post. */
export function paletteAt(
  seed: number,
  n: number,
  palette: readonly string[] = PALETTE,
): string {
  const list = palette.length ? palette : PALETTE;
  const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
  const f = x - Math.floor(x);
  return list[Math.floor(f * list.length) % list.length];
}

const luminance = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

/* A single flat colour has to be visible against the slide's background —
   the palette holds white and cream, and either of those on a light theme
   is a blank post. Only used where one colour stands for the whole layer;
   the pixel mosaic keeps every colour, since there the pale ones read as
   holes rather than as nothing. */
export function paletteInk(
  seed: number,
  theme: Theme,
  palette?: readonly string[],
): string {
  const { ink, bg } = tones(theme);
  const bgLum = luminance(bg);
  const list = (palette?.length ? palette : PALETTE).filter(
    (hex) => Math.abs(luminance(hex) - bgLum) > 0.25,
  );
  return list.length ? paletteAt(seed, 0, list) : ink;
}

/* Ink and background for a slide. Monochrome slides use the theme's two
   tones; a slide with any coloured layer takes both from the palette, so
   shuffling moves the background as well as the pixels — a palette that
   only ever recolours the ink reads as one accent on a fixed backdrop. */
export function slideTones(slide: {
  theme: Theme;
  background?: string;
  layers: { ink?: string }[];
}): { ink: string; bg: string; grays: string[] } {
  const base = tones(slide.theme);
  if (!slide.background) return base;
  /* Type has to survive whatever background was chosen, so it flips rather
     than following the theme off a cliff. */
  const ink = luminance(slide.background) > 0.5 ? "#0d0d0d" : "#ffffff";
  return { ink, bg: slide.background, grays: base.grays };
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Keep only real hexes; an empty result means "use the club palette". */
export function cleanPalette(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw
    .filter((c): c is string => typeof c === "string" && HEX.test(c))
    .map((c) => c.toLowerCase())
    .slice(0, 8);
  return list.length ? list : undefined;
}

/* Tones for the monochrome contract: shader colors derive from the slide
   theme, never from the spec. */
export function tones(theme: Theme) {
  const ink = theme === "dark" ? "#ffffff" : "#0d0d0d";
  const bg = theme === "dark" ? "#0d0d0d" : "#ffffff";
  const grays =
    theme === "dark"
      ? ["#0d0d0d", "#2e2e2e", "#6b6b6b", "#bdbdbd", "#ffffff"]
      : ["#ffffff", "#e6e6e6", "#bdbdbd", "#6b6b6b", "#0d0d0d"];
  return { ink, bg, grays };
}

/* ----------------------------------------------------------------- slides */

export function defaultSlide(partial: Partial<SlideSpec> = {}): SlideSpec {
  return {
    kicker: "the Motion Social Club",
    title: "You don't need more tutorials.\nYou need more practice.",
    body: "",
    footer: "@themotionsocialclub",
    letter: "M",
    text: true,
    titleFont: "serif",
    italic: false,
    titleSize: "m",
    boxed: false,
    plate: false,
    align: "left",
    ring: false,
    veil: 0.25,
    color: false,
    colorSeed: 1,
    titlePixel: 0,
    metaPixel: 0,
    theme: "light",
    layers: [defaultLayer("dithering")],
    ...partial,
  };
}

export function defaultSpec(): PostSpec {
  return {
    v: SPEC_VERSION,
    format: "portrait",
    duration: 6,
    slides: [defaultSlide()],
  };
}

/* Older specs (and links in the wild) used a wider palette of shader and
   generative types; map each onto its closest dithering equivalent so every
   existing link keeps rendering, in the new all-dithered identity. */
const LEGACY_TYPES: Record<string, Partial<ShaderSpec>> = {
  waves: { type: "dithering", shape: "wave" },
  mesh: { type: "dithering", shape: "simplex" },
  perlin: { type: "dithering", shape: "simplex" },
  voronoi: { type: "dithering", shape: "dots" },
  metaballs: { type: "dithering", shape: "ripple" },
  warp: { type: "dithering", shape: "warp" },
  spiral: { type: "dithering", shape: "swirl" },
  smoke: { type: "dithering", shape: "ripple" },
  grid: { type: "dithering", shape: "dots" },
  lattice: { type: "forms", pattern: "ramp" },
  rays: { type: "forms", pattern: "rings" },
  tunnel: { type: "forms", pattern: "rings" },
  bars: { type: "forms", pattern: "bars" },
  orbits: { type: "forms", pattern: "rings" },
  bloom: { type: "dithering", shape: "sphere" },
  field: { type: "forms", pattern: "ramp" },
  maze: { type: "forms", pattern: "bars" },
  scatter: { type: "dithering", shape: "dots" },
  ramp: { type: "forms", pattern: "ramp" },
  letters: { type: "forms", pattern: "letter" },
};

function mapLegacyLayer(l: Partial<LayerSpec> | undefined) {
  const legacy = l?.type && LEGACY_TYPES[l.type as string];
  if (!legacy) return l;
  const { opacity, blend, offsetX, offsetY, rotation, speed } = l as LayerSpec;
  return { opacity, blend, offsetX, offsetY, rotation, speed, ...legacy };
}

/* Fill a possibly partial spec (e.g. handwritten by Claude) with defaults so
   the tool never renders undefined fields. */
export function normalizeSpec(raw: unknown): PostSpec {
  const r = (raw ?? {}) as Partial<PostSpec>;
  const format: PostFormat = r.format && FORMATS[r.format] ? r.format : "portrait";
  const slides = (Array.isArray(r.slides) && r.slides.length ? r.slides : [{}]).map(
    (raw) => {
      const s = raw as Partial<SlideSpec> & { shader?: ShaderSpec };
      const slide = defaultSlide(s);
      slide.veil = Math.min(0.9, Math.max(0, Number(slide.veil) || 0));
      if (!["s", "m", "l", "fit"].includes(slide.titleSize)) slide.titleSize = "m";
      if (s.titleWeight === undefined) delete slide.titleWeight;
      else slide.titleWeight = Math.min(900, Math.max(100, Number(s.titleWeight) || 400));
      if (s.margin === undefined) delete slide.margin;
      else slide.margin = Math.min(240, Math.max(24, Number(s.margin) || 96));

      /* Everything below is absent by default, and absent means the layout
         every older link was shared with. */
      if (typeof s.tag === "string" && s.tag.trim()) slide.tag = s.tag;
      else delete slide.tag;
      if (typeof s.note === "string" && s.note.trim()) slide.note = s.note;
      else delete slide.note;
      const cols = Math.round(Number(s.grid) || 0);
      if (cols >= 2) slide.grid = Math.min(24, cols);
      else delete slide.grid;
      if (s.gridAlpha === undefined) delete slide.gridAlpha;
      else slide.gridAlpha = Math.min(1, Math.max(0, Number(s.gridAlpha) || 0));
      if (s.gridTop === true) slide.gridTop = true;
      else delete slide.gridTop;
      if (["top", "middle", "bottom"].includes(String(s.anchor)))
        slide.anchor = s.anchor;
      else delete slide.anchor;
      const count = s.count;
      if (count && Number.isFinite(Number(count.from)) && Number.isFinite(Number(count.to))) {
        /* No cap on how many values a count runs through. A thousand of them
           over six seconds is a blur, and a blur of numbers is a real thing a
           counter does — whether it should is the designer's call, not this
           function's. */
        const clamp = (n: number) => Math.min(99999, Math.max(-9999, Math.round(n)));
        slide.count = { from: clamp(Number(count.from)), to: clamp(Number(count.to)) };
        const pad = Math.round(Number(count.pad) || 0);
        if (pad > 1) slide.count.pad = Math.min(6, pad);
      } else {
        delete slide.count;
      }

      /* Shapes. Anything unrecognised is dropped rather than handed to the
         renderer, and every number is clamped here so a hand-written spec can't
         put a mark somewhere the frame isn't. */
      const rawShapes = s.shapes;
      if (Array.isArray(rawShapes) && rawShapes.length) {
        const clean = rawShapes
          .filter((sh) => sh && SHAPE_KINDS.includes(sh.kind))
          .slice(0, MAX_SHAPES)
          .map((sh) => {
            const out = { ...defaultShape(sh.kind), ...sh } as ShapeSpec;
            const fit = (key: string, c: ShaderControl) => {
              const v = Number((out as unknown as Record<string, number>)[key]);
              (out as unknown as Record<string, number>)[key] = Number.isFinite(v)
                ? Math.min(c.max, Math.max(c.min, v))
                : c.def;
            };
            for (const c of SHAPE_CONTROLS) fit(c.key, c);
            for (const c of SHAPE_DEFORMERS) {
              const v = Number((sh as unknown as Record<string, number>)[c.key]);
              if (Number.isFinite(v) && v !== c.def) {
                (out as unknown as Record<string, number>)[c.key] = Math.min(
                  c.max,
                  Math.max(c.min, v),
                );
              } else delete (out as unknown as Record<string, unknown>)[c.key];
            }
            if (!["x", "y", "arc", "ring"].includes(String(sh.along))) delete out.along;
            if (sh.under !== true) delete out.under;
            if (typeof sh.ink === "string" && HEX.test(sh.ink)) out.ink = sh.ink.toLowerCase();
            else delete out.ink;
            if (Number.isFinite(Number(sh.seed))) out.seed = Math.round(Number(sh.seed));
            else delete out.seed;
            out.motion = cleanMotion(sh.motion, [...SHAPE_CONTROLS, ...SHAPE_DEFORMERS]);
            if (!out.motion) delete out.motion;
            return out;
          });
        if (clean.length) slide.shapes = clean;
        else delete slide.shapes;
      } else {
        delete slide.shapes;
      }
      if (!["auto", "letter", "page", "none"].includes(String(s.mark)))
        delete slide.mark;
      const off = Array.isArray(s.off)
        ? [...new Set(s.off.filter((p) => (SLIDE_PARTS as readonly string[]).includes(p)))]
        : [];
      if (off.length) slide.off = off;
      else delete slide.off;
      slide.color = slide.color === true;
      slide.colorSeed = Number(slide.colorSeed) || 1;
      const custom = cleanPalette(s.palette);
      if (custom) slide.palette = custom;
      else delete slide.palette;
      // v3 specs carried a single `textPixel` for the whole layer; split it
      // across both new controls so old links keep their look.
      const legacyPixel = (s as { textPixel?: number }).textPixel;
      slide.titlePixel = Math.min(
        32,
        Math.max(0, Number(s.titlePixel ?? legacyPixel) || 0),
      );
      slide.metaPixel = Math.min(
        32,
        Math.max(0, Number(s.metaPixel ?? legacyPixel) || 0),
      );
      // v1 specs carried a single `shader`; lift it into the layer stack.
      const layers =
        Array.isArray(s.layers) && s.layers.length
          ? s.layers
          : s.shader
            ? [s.shader as LayerSpec]
            : slide.layers;
      slide.layers = layers.slice(0, MAX_LAYERS).map((l) => {
        const mapped = mapLegacyLayer(l);
        const type = shaderDef(mapped?.type ?? "dithering").type;
        const merged = { ...defaultLayer(type), ...mapped, type } as LayerSpec;

        /* Colour was a switch before it was a choice — first slide-wide,
           then per layer. Resolve either into an explicit `ink` here so
           every renderer downstream sees one model, and old links keep the
           colours they were shared with. */
        const legacyOn =
          typeof merged.color === "boolean" ? merged.color : slide.color;
        const list = slide.palette?.length ? slide.palette : PALETTE;
        if (merged.ink === "mix" || (typeof merged.ink === "string" && HEX.test(merged.ink))) {
          // already explicit
        } else if (legacyOn) {
          merged.ink =
            type === "forms" ? "mix" : paletteInk(slide.colorSeed, slide.theme, list);
        } else {
          delete merged.ink;
        }
        delete merged.color;

        /* The mix controls only mean anything on a mix layer, and each one
           is absent by default — absent is the look every link written
           before they existed was shared with. */
        if (merged.ink === "mix") {
          const inks = cleanPalette(merged.inks);
          if (inks) merged.inks = inks;
          else delete merged.inks;
          if (!MIX_MODES.includes(merged.mixMode as MixMode)) delete merged.mixMode;
          if (merged.mixScale === undefined) delete merged.mixScale;
          else merged.mixScale = Math.min(12, Math.max(1, Number(merged.mixScale) || 1));
          if (merged.mixSpeed === undefined) delete merged.mixSpeed;
          else merged.mixSpeed = Math.min(3, Math.max(0, Number(merged.mixSpeed) || 0));
        } else {
          delete merged.inks;
          delete merged.mixMode;
          delete merged.mixScale;
          delete merged.mixSpeed;
        }

        /* Filters, in order, with anything unrecognised dropped rather than
           handed to the renderer. */
        const rawFilters = merged.filters;
        if (Array.isArray(rawFilters) && rawFilters.length) {
          const list = (rawFilters as FilterSpec[])
            .filter((f) => f && filterDef(String(f.type)))
            .slice(0, 6)
            .map((f) => {
              const def = filterDef(String(f.type))!;
              const out: FilterSpec = { type: def.type };
              for (const ctrl of def.controls) {
                const v = Number(f[ctrl.key]);
                out[ctrl.key] = Number.isFinite(v)
                  ? Math.min(ctrl.max, Math.max(ctrl.min, v))
                  : ctrl.def;
              }
              for (const ch of def.choices ?? []) {
                out[ch.key] = ch.values.includes(String(f[ch.key]))
                  ? String(f[ch.key])
                  : ch.def;
              }
              /* Off without being deleted — absent means on, which is how every
                 chain written before the switch existed still renders. */
              if (f.mute === true) out.mute = true;
              const fm = cleanMotion(f.motion, def.controls);
              if (fm) out.motion = fm;
              return out;
            });
          if (list.length) merged.filters = list;
          else delete merged.filters;
        } else {
          delete merged.filters;
        }

        /* A picture only means anything to a photo pattern. */
        if (usesPhoto(merged)) {
          if (typeof merged.src !== "string" || !merged.src) delete merged.src;
          if (merged.fit !== "contain") delete merged.fit;
        } else {
          delete merged.src;
          delete merged.fit;
          /* Gamma on a picture there isn't one of. Dropping it keeps links
             free of numbers that do nothing. */
          delete merged.exposure;
        }

        /* Travelling parameters — only the ones this layer actually has. */
        const motion = cleanMotion(merged.motion, animatable(type));
        if (motion) merged.motion = motion;
        else delete merged.motion;
        return merged;
      });

      /* Same for the background: a coloured legacy slide had one picked
         from the seed, so pin it rather than let it drift. */
      if (typeof s.background === "string" && HEX.test(s.background)) {
        slide.background = s.background;
      } else if (slide.layers.some((l) => l.ink) && slide.color) {
        const list = slide.palette?.length ? slide.palette : PALETTE;
        slide.background = paletteAt(slide.colorSeed, 3, list);
      } else {
        delete slide.background;
      }
      return slide;
    },
  );
  return {
    v: SPEC_VERSION,
    format,
    duration: Math.min(15, Math.max(2, Number(r.duration) || 6)),
    slides: slides.slice(0, 20),
  };
}

/* ------------------------------------------------------------ spec in URL */

/* Drop everything already at its default before serialising. normalizeSpec
   fills them back in on read, so this is lossless — and it matters: a link
   goes in a Notion URL property, which rejects anything over 2000
   characters, and a five-slide carousel spelled out in full runs to 3600. */
export function minifySpec(spec: PostSpec): Record<string, unknown> {
  const base = defaultSlide();
  const out: Record<string, unknown> = { v: spec.v, format: spec.format };
  if (spec.duration !== 6) out.duration = spec.duration;

  out.slides = spec.slides.map((slide) => {
    const s: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(slide)) {
      if (k === "layers" || k === "palette") continue;
      if (JSON.stringify(v) !== JSON.stringify(base[k as keyof SlideSpec])) s[k] = v;
    }
    if (slide.palette) s.palette = slide.palette;
    s.layers = slide.layers.map((layer) => {
      const def = defaultLayer(layer.type);
      const l: Record<string, unknown> = { type: layer.type };
      for (const [k, v] of Object.entries(layer)) {
        if (k === "type") continue;
        if (JSON.stringify(v) !== JSON.stringify(def[k as keyof LayerSpec])) l[k] = v;
      }
      return l;
    });
    return s;
  });
  return out;
}

export function encodeSpec(spec: PostSpec): string {
  const json = JSON.stringify(minifySpec(spec));
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSpec(encoded: string): PostSpec | null {
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return normalizeSpec(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- presets */

/* A recipe: a whole post, named for what it makes rather than for the
   machinery it uses, with a line saying when to reach for it. They are the
   studio's front door — the first thing to do with a tool this size is
   choose the kind of post you're making, not a shader. */
export type Preset = { name: string; about: string; spec: PostSpec };

/* The sheet most of these are printed on: paper, ruled, nothing dithered
   behind the words. It is a plain slide in the strictest sense — the club's
   pixels are one of the things a post can have, not the only one. */
const sheet = (partial: Partial<SlideSpec> = {}): SlideSpec =>
  defaultSlide({
    kicker: "",
    body: "",
    footer: "@themotionsocialclub",
    letter: "",
    mark: "none",
    veil: 0,
    grid: 7,
    background: "#e6e5e1",
    layers: [defaultLayer("none")],
    off: ["kicker", "body", "mark", "rules"],
    ...partial,
  });

export const PRESETS: Preset[] = [
  {
    name: "Saved for later",
    about: "The monthly round-up cover: an oval date, one headline, ruled paper.",
    spec: {
      v: SPEC_VERSION,
      format: "portrait",
      duration: 6,
      slides: [
        sheet({
          tag: "08/26",
          title: "What the club\n*saved for later*\nin August",
          titleFont: "serif",
          titleSize: "fit",
          align: "center",
          margin: 128,
        }),
      ],
    },
  },
  {
    name: "One line",
    about: "A sentence worth keeping, with the club's pixels loose behind it.",
    spec: {
      v: SPEC_VERSION,
      format: "portrait",
      duration: 8,
      slides: [
        sheet({
          kicker: "design inspiration",
          note: "@themotionsocialclub",
          title: "A mind too full of information\nhas no space left\nfor inspiration.",
          titleFont: "sans",
          titleSize: "m",
          titleWeight: 500,
          align: "left",
          /* The words sit on the paper and the pixels sit above them. That is
             the reference's own arrangement, and it is the only reliable one:
             where a procedural blob lands can't be promised, so the type is
             given a half of the sheet rather than asked to survive whatever
             turns up behind it. */
          anchor: "bottom",
          grid: 0,
          background: "#f4f3ef",
          off: ["body", "mark", "rules", "footer"],
          layers: [
            {
              ...defaultLayer("forms"),
              pattern: "blobs",
              density: 21,
              pixel: 10,
              warp: 0.25,
              speed: 0.3,
              scale: 0.58,
              offsetY: -0.18,
              ink: "#3d3deb",
              /* One number travelling is the difference between a shape and a
                 piece of motion, and it shows in the timeline as a wave. */
              motion: { warp: { to: 0.6, wave: "sin", cycles: 1, phase: 0 } },
            },
          ],
        }),
      ],
    },
  },
  {
    name: "The quote",
    about: "Someone else's words, set the way a book would set them.",
    spec: {
      v: SPEC_VERSION,
      format: "square",
      duration: 6,
      slides: [
        sheet({
          title:
            "„The work nobody sees\nis the work *everybody* sees.”",
          titleFont: "serif",
          italic: false,
          titleSize: "fit",
          align: "center",
          footer: "— the club",
          grid: 6,
          gridAlpha: 0.12,
          margin: 144,
          off: ["kicker", "body", "mark", "rules"],
        }),
      ],
    },
  },
  {
    name: "Reference card",
    about: "One piece of work, credited: title at the top, the note in the corner.",
    spec: {
      v: SPEC_VERSION,
      format: "portrait",
      duration: 6,
      slides: [
        sheet({
          tag: "03",
          title: "Loewe\n180 years *film*",
          body: "Crafted out of 2,000 sheets of watercolour paper, made with ten artists. Seen this week and still being thought about.",
          titleFont: "sans",
          titleSize: "l",
          titleWeight: 400,
          align: "left",
          anchor: "top",
          note: "seen this week",
          theme: "dark",
          background: "#1a1a1a",
          grid: 6,
          gridAlpha: 0.14,
          off: ["kicker", "mark", "rules"],
          layers: [
            {
              ...defaultLayer("forms"),
              pattern: "blobs",
              density: 5,
              pixel: 10,
              warp: 0.2,
              speed: 0.25,
              offsetY: 0.42,
              scale: 0.7,
              /* Nothing in this studio sits still: the blob swells and comes
                 back over the loop, so the card is a piece of motion even
                 when the words don't move. */
              motion: { warp: { to: 0.55, wave: "sin", cycles: 1, phase: 0 } },
            },
          ],
        }),
      ],
    },
  },
  {
    name: "Grid poster",
    about: "The ruling crosses the words — a drawing rather than a caption.",
    spec: {
      v: SPEC_VERSION,
      format: "square",
      duration: 6,
      slides: [
        sheet({
          title: "PRACTICE\nOVER\nTUTORIALS",
          titleFont: "sans",
          titleSize: "fit",
          titleWeight: 700,
          align: "left",
          margin: 72,
          grid: 6,
          gridAlpha: 0.22,
          gridTop: true,
          footer: "the Motion Social Club",
          off: ["kicker", "body", "mark"],
          /* The club's boxed headline, reduced to four corners — and breathing,
             because a mark in this studio is an animated thing. */
          shapes: [
            {
              ...defaultShape("bracket"),
              size: 0.94,
              weight: 3,
              motion: { size: { to: 0.88, wave: "sin", cycles: 2, phase: 0 } },
            },
          ],
        }),
      ],
    },
  },
  {
    name: "Rosette",
    about: "Marks and deformers: one shape copied around a ring, turning as it goes.",
    spec: {
      v: SPEC_VERSION,
      format: "square",
      duration: 8,
      slides: [
        sheet({
          tag: "the club",
          title: "Same rules.\n*Different piece.*",
          titleFont: "serif",
          titleSize: "m",
          align: "center",
          margin: 128,
          grid: 8,
          gridAlpha: 0.12,
          off: ["kicker", "body", "mark", "rules"],
          shapes: [
            /* One mark, copied around a ring and turned as it goes — the whole
               point of the deformers in one shape. */
            {
              ...defaultShape("oval"),
              size: 0.1,
              weight: 2,
              repeat: 14,
              along: "ring",
              spread: 0.38,
              twist: 26,
              motion: { rotation: { to: 180, wave: "sin", cycles: 1, phase: 0 } },
            },
            {
              ...defaultShape("circle"),
              size: 0.52,
              weight: 2,
              under: true,
              opacity: 0.5,
              motion: { size: { to: 0.58, wave: "sin", cycles: 1, phase: 0 } },
            },
          ],
        }),
      ],
    },
  },
  {
    name: "Carousel",
    about: "Four sheets that read as one piece: a cover, then one idea a slide.",
    spec: {
      v: SPEC_VERSION,
      format: "portrait",
      duration: 6,
      slides: [
        sheet({
          tag: "08/26",
          title: "Three ideas\nthe club keeps\n*returning to*",
          titleFont: "serif",
          titleSize: "fit",
          align: "center",
          margin: 128,
        }),
        sheet({
          tag: "01",
          title: "Watching is not\nthe same as *learning*.",
          body: "Short, bounded exercises beat one more tutorial every time.",
          titleFont: "serif",
          titleSize: "m",
          align: "left",
          anchor: "middle",
          off: ["kicker", "mark", "rules"],
        }),
        sheet({
          tag: "02",
          title: "Tools are exhausting.\n*Foundations* are permanent.",
          body: "Easing, timing, contrast, hierarchy — they carry across every tool.",
          titleFont: "serif",
          titleSize: "m",
          align: "left",
          off: ["kicker", "mark", "rules"],
        }),
        sheet({
          tag: "03",
          title: "The work no one sees\nshapes *your* skill.",
          body: "Short sessions, no pressure for perfection. The gym, not the gallery.",
          titleFont: "serif",
          titleSize: "m",
          align: "left",
          off: ["kicker", "mark", "rules"],
        }),
      ],
    },
  },
  {
    name: "Announcement",
    about: "Something new, said plainly: boxed sans on paper.",
    spec: {
      v: SPEC_VERSION,
      format: "portrait",
      duration: 6,
      slides: [
        sheet({
          tag: "new",
          title: "MOTION BASICS\nFOR DESIGNERS",
          body: "A short course on the fundamentals that carry across every tool — made for designers stepping into motion.",
          titleFont: "sans",
          titleSize: "m",
          titleWeight: 600,
          boxed: true,
          align: "left",
          grid: 8,
          background: "#f4f3ef",
          off: ["kicker", "mark", "rules"],
        }),
      ],
    },
  },
  {
    name: "Practice file",
    about: "The series slide: a number, a word, and one bounded exercise.",
    spec: {
      v: SPEC_VERSION,
      format: "square",
      duration: 6,
      slides: [
        sheet({
          tag: "the practice file — 01",
          title: "Contrast",
          body: "Black and white only. One bounded exercise, no pressure for perfection.",
          titleFont: "serif",
          titleSize: "fit",
          italic: true,
          align: "center",
          margin: 160,
          grid: 7,
          off: ["kicker", "mark", "rules"],
        }),
      ],
    },
  },
  {
    name: "Reel",
    about: "Nine-by-sixteen, one thought, a background that keeps moving.",
    spec: {
      v: SPEC_VERSION,
      format: "story",
      duration: 8,
      slides: [
        defaultSlide({
          kicker: "the Motion Social Club",
          title: "Motion design\nshouldn't feel\n*this lonely*.",
          body: "Real conversations over algorithm-driven encounters.",
          theme: "dark",
          letter: "",
          mark: "none",
          /* A reel is read in a second, so the words get a plate rather than
             being asked to survive whatever the tunnel does behind them —
             the same answer the Type and Interference recipes give. */
          plate: true,
          veil: 0.25,
          /* Dithered forms rather than the WebGL dithering: this post is a
             reel, so it has to loop, and only the club's own renderer
             promises that. */
          layers: [
            {
              ...defaultLayer("forms"),
              pattern: "tunnel",
              density: 4,
              pixel: 8,
              warp: 0.3,
              speed: 0.4,
              motion: { density: { to: 8, wave: "sin", cycles: 1, phase: 0 } },
            },
          ],
        }),
      ],
    },
  },
  {
    name: "Type",
    about: "The club's letter, dithered enormous, with the words on a plate.",
    spec: {
      v: SPEC_VERSION,
      format: "portrait",
      duration: 6,
      slides: [
        defaultSlide({
          kicker: "the Motion Social Club",
          title: "Bend the grid.\nKeep the rhythm.",
          plate: true,
          veil: 0,
          layers: [
            {
              ...defaultLayer("forms"),
              pattern: "letter",
              word: "M",
              warp: 0.35,
              motion: { warp: { to: 0.75, wave: "sin", cycles: 1, phase: 0 } },
            },
            {
              ...defaultLayer("forms"),
              pattern: "noise",
              density: 14,
              pixel: 3,
              blend: "multiply",
              opacity: 0.5,
              motion: { warp: { to: 0.5, wave: "sin", cycles: 2, phase: 0.5 } },
            },
          ],
        }),
      ],
    },
  },
  {
    /* Two forms interfering inside one layer — the cheapest way to a
       pattern neither of them makes alone. */
    name: "Interference",
    about: "Two forms arguing inside one layer — the dither at its least tidy.",
    spec: {
      v: SPEC_VERSION,
      format: "square",
      duration: 8,
      slides: [
        defaultSlide({
          kicker: "the Motion Social Club",
          title: "Two simple rules,\none complicated result.",
          italic: true,
          plate: true,
          veil: 0,
          theme: "dark",
          layers: [
            {
              ...defaultLayer("forms"),
              pattern: "moire",
              pattern2: "rings",
              mix: "diff",
              density: 10,
              warp: 0.1,
              pixel: 5,
              /* The interference is the point, so the thing that travels is
                 the density the two forms disagree about. */
              motion: { density: { to: 16, wave: "sin", cycles: 1, phase: 0 } },
            },
          ],
        }),
      ],
    },
  },
  {
    /* Colour as a field rather than confetti: broad patches drifting slowly
       through three of the palette's colours. */
    name: "Colour field",
    about: "No words at all: broad patches of the palette drifting on cream.",
    spec: {
      v: SPEC_VERSION,
      format: "portrait",
      duration: 8,
      slides: [
        defaultSlide({
          kicker: "the Motion Social Club",
          title: "",
          footer: "",
          letter: "",
          text: false,
          veil: 0,
          background: "#fffdf0",
          layers: [
            {
              ...defaultLayer("forms"),
              /* Clouds rather than metaballs: "source" colouring reads as a
                 contour map, which needs a form with shading all over the
                 frame to colour. */
              pattern: "noise",
              density: 10,
              pixel: 7,
              warp: 0.15,
              speed: 0.35,
              ink: "mix",
              inks: ["#3d3deb", "#ee4b2b", "#adb4f5"],
              mixMode: "source",
              mixScale: 6,
              mixSpeed: 0.5,
              motion: { warp: { to: 0.45, wave: "sin", cycles: 1, phase: 0 } },
            },
          ],
        }),
      ],
    },
  },
  {
    /* The smooth register's showcase: colour as light instead of pixels —
       dark is where a glowing band actually glows. */
    name: "Night signal",
    about: "Colour as light instead of pixels — glowing bands on the club's own black.",
    spec: {
      v: SPEC_VERSION,
      format: "portrait",
      duration: 8,
      slides: [
        defaultSlide({
          kicker: "the Motion Social Club",
          title: "What moves best\n*after dark*.",
          theme: "dark",
          veil: 0,
          layers: [
            {
              ...defaultLayer("trails"),
              count: 4,
              width: 0.12,
              curve: 0.4,
              spread: 0.6,
              glow: 60,
              angle: 25,
              ink: "mix",
              inks: ["#adb4f5", "#3d3deb", "#ee4b2b"],
              motion: { curve: { to: 0.75, wave: "sin", cycles: 1, phase: 0 } },
            },
          ],
        }),
      ],
    },
  },
  {
    /* The same register with the colour switched off — proof it isn't only
       a dark, loud thing. One soft band behind editorial type on paper. */
    name: "Paper trail",
    about: "One soft band of light behind a sentence, on the club's own sheet.",
    spec: {
      v: SPEC_VERSION,
      format: "square",
      duration: 6,
      slides: [
        sheet({
          title: "Not every glow\nneeds *colour*.",
          titleFont: "serif",
          titleSize: "fit",
          align: "left",
          layers: [
            {
              ...defaultLayer("trails"),
              count: 1,
              width: 0.22,
              curve: 0.2,
              spread: 0.3,
              glow: 45,
              angle: 100,
              motion: { angle: { to: 130, wave: "sin", cycles: 1, phase: 0 } },
            },
          ],
        }),
      ],
    },
  },
];

/** The post the studio opens on when nothing was asked for. A real recipe
    rather than a blank: the fastest way to say what this tool makes now is
    to already be showing one. `defaultSpec` stays where it is — it is the
    normalisation baseline every link is minified against, and moving it
    would change what an old link decodes to. */
export function openingSpec(): PostSpec {
  return normalizeSpec(structuredClone(PRESETS[0].spec));
}

/** A headline with its emphasis markers taken out — for lists and labels,
    where the words matter and the voice doesn't. */
export const plainTitle = (title: string) =>
  title.replace(/\*/g, "").split("\n").join(" ");

/* ------------------------------------------------- instant links (no AI) */

/**
 * Build a spec straight from URL query params — the instant, zero-AI path:
 * /postlab?title=...&body=...&format=portrait&theme=dark&shape=sphere
 * "//" in title/body becomes a line break. A Notion formula column can
 * assemble these links directly from a queue row's fields.
 */
export function specFromQuery(params: URLSearchParams): PostSpec | null {
  const title = params.get("title");
  if (!title) return null;
  const nl = (s: string) => s.replace(/\s*\/\/\s*/g, "\n").trim();
  const formatParam = params.get("format") ?? "";
  const format: PostFormat = FORMATS[formatParam as PostFormat]
    ? (formatParam as PostFormat)
    : formatParam === "reel"
      ? "story"
      : "portrait";
  const shapes = ["simplex", "warp", "dots", "wave", "ripple", "swirl", "sphere"];
  const shape = shapes.includes(params.get("shape") ?? "")
    ? (params.get("shape") as string)
    : "sphere";
  const slide = defaultSlide({
    title: nl(title),
    kicker: params.get("kicker") ?? "the Motion Social Club",
    body: nl(params.get("body") ?? ""),
    footer: params.get("footer") ?? "@themotionsocialclub",
    theme: params.get("theme") === "dark" ? "dark" : "light",
    veil: 0.4,
    layers: [{ ...defaultLayer("dithering"), shape }],
  });
  return normalizeSpec({
    v: SPEC_VERSION,
    format,
    duration: 6,
    slides: [slide],
  });
}
