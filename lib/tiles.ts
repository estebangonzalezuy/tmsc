// the Tiles — the club's third studio, and the one that isn't about type at
// all.
//
// The Posts Studio puts words on a sheet. the Kinetics makes the words the
// picture. This one has no words in it: it draws a **tile** — a framed square
// of hand-cut folk-art ornament, radial, flat-coloured, printed rather than
// rendered. Every reference it was built from is the same object seen thirteen
// ways, and reading them together is what produced this model rather than a
// pile of settings:
//
//   a frame · a panel · some guides · a stack of arms · a centre
//
// That is the whole grammar, and it is deliberately five things. Everything in
// the references that looked like a sixth turned out to be an arm: the
// pinwheel field behind the rays is arms with a wide angular width, the beads
// threaded along a spoke are an arm of beads, the dots in the corners are an
// arm of four. A tile is not a background plus a foreground; it is a stack of
// repeats around one point, and saying so is what keeps the tool small.
//
// Three rules carried over from the other two studios, for the same reasons:
//
// 1. **The loop is a contract.** Everything that moves here moves through a
//    whole number of somethings — whole turns, whole waves, whole beads — so
//    the frame at p=1 is the frame at p=0 and a recording can be filmed frame
//    by frame without a seam. Nothing reads the wall clock.
// 2. **Nothing is drawn straight.** Every edge in every reference is a hand
//    one: torn, thick-and-thin, never quite meeting itself. That is `wobble`,
//    and it is not an effect on top — it is applied to the outline of every
//    shape before it is filled, which is why the tool has no "sketchy" filter
//    and doesn't need one. `boil` is the same wobble re-drawn a few times a
//    second, which is how a hand-drawn thing moves when it isn't moving.
// 3. **Colour is a palette, not a picker.** A tile is three to five flat inks
//    and no gradients. The palettes are lifted from the references; a slot can
//    be overridden by hand, and then that tile stops following its palette.
//
// The spec travels in the URL exactly as a PostSpec does.

import {
  FILTERS,
  FORMATS,
  defaultFilter,
  filterDef,
  type FilterSpec,
  type PostFormat,
} from "./postlab";

export { FILTERS, FORMATS, defaultFilter, filterDef };
export type { FilterSpec, PostFormat };

export const TILE_VERSION = 1;

/* ---------------------------------------------------------------- marks --- */

/**
 * What one repeat is made of.
 *
 * Seven of them, and they are seven because the references have seven. Six
 * draw a shape that runs from the middle outwards and differ only in their
 * profile — how the width changes along the way — which is why they share one
 * renderer and one set of controls. `chain` and `dot` are the two that place
 * marks instead of drawing a stroke.
 */
export type ShapeId =
  | "lance"
  | "ribbon"
  | "wedge"
  | "petal"
  | "bar"
  | "hook"
  | "chain"
  | "dot";

export const SHAPES: { value: ShapeId; label: string; hint: string }[] = [
  { value: "lance", label: "lance", hint: "A spindle, pointed at both ends and widest in the middle." },
  { value: "ribbon", label: "ribbon", hint: "A band of one thickness, which is the shape that takes a wave best." },
  { value: "wedge", label: "wedge", hint: "A blade of the pinwheel. Its width is an angle, so at 1 the blades touch and the field fills." },
  { value: "petal", label: "petal", hint: "A leaf: narrow at the middle, widest near the rim." },
  { value: "bar", label: "bar", hint: "A straight stroke with round ends, not reaching the centre." },
  { value: "hook", label: "hook", hint: "A bar that holds its line and then turns all at once." },
  { value: "chain", label: "chain", hint: "Beads threaded along the spoke rather than a stroke drawn down it." },
  { value: "dot", label: "dot", hint: "One mark at one radius — studs on a ring, or the four in the corners." },
];

/**
 * One repeat around the centre, and how many of it.
 *
 * `count` copies at equal angles is the whole of the symmetry, and `mirror`
 * is the only variation on it: every other copy is reflected, which turns the
 * rotation into a mirror symmetry. Four of the thirteen references are
 * mirrored and the rest turn, and nothing else was needed to tell them apart.
 *
 * The last four numbers are the motion, and they are the shape of a loop
 * rather than a speed: whole turns, one breath, one sway, whole beads. There
 * is no way to write a fraction into any of them that would open a seam,
 * because they are rounded where it matters and periodic where it isn't.
 */
export type Arm = {
  shape: ShapeId;
  /** How many copies around the centre. */
  count: number;
  /** Which ink, by position in the palette's list. */
  ink: number;
  /** Where the mark starts and ends, as a share of the panel's half-width.
      Past 1 it runs into the corners and is cut off by the panel — which is
      how most of the references fill their squares. */
  inner: number;
  outer: number;
  /** The widest the mark ever gets. A share of the panel for everything
      except `wedge`, where it is a share of the angle each copy is given. */
  width: number;
  /** Positive narrows it towards the tip, negative towards the middle. */
  taper: number;
  /** Degrees of curl between the root and the tip — the swirl. */
  twist: number;
  /** How far the mark meanders sideways, and how many meanders it makes. */
  wave: number;
  waves: number;
  /** Whole waves travelled *along* the ray over the loop, so the meander
      leaves the middle and runs out to the rim instead of standing still.
      This is the deformer the whole thing wanted: a stroke with a wave
      looping out of it. Whole, so the last frame is the first one; negative
      runs it inwards. */
  ripple: number;
  /** A static rotation, so two arms can interleave. */
  turn: number;
  /** `chain` only: how many beads on the thread. */
  beads: number;
  /** `chain` and `dot`: how far the mark is pulled out along its own ray.
      0 is a circle. */
  stretch: number;
  /** Every other copy reflected: a mirror symmetry rather than a rotation. */
  mirror: boolean;
  /** Whole turns over the loop. A fraction would not come back. */
  spin: number;
  /** One breath in and out over the loop, as a share of the radius. */
  pulse: number;
  /** Degrees the twist swings by, once, over the loop. */
  sway: number;
  /** Whole beads travelled over the loop. `chain` only. */
  march: number;
  /** The duplicator's delay: how much of the loop each copy runs behind the
      one before it, as a share of the loop across the whole ring. 0 is every
      copy in step — which is what an ornament does — and 1 is a wave going
      once round the tile, which is what a generative one does. It moves the
      *phase* of everything on this arm that moves (the breath, the sway, the
      travelling wave, the marching beads) and never the angle a copy sits at,
      so the ring stays evenly spaced however far it is staggered.

      It cannot open a seam: each copy is periodic in its own phase, and a
      phase offset of a periodic thing is the same periodic thing. */
  stagger: number;
  mute?: boolean;
};

export const defaultArm = (patch: Partial<Arm> = {}): Arm => ({
  shape: "lance",
  count: 12,
  ink: 0,
  inner: 0,
  outer: 1.05,
  width: 0.09,
  taper: 0,
  twist: 0,
  wave: 0,
  waves: 2,
  ripple: 0,
  turn: 0,
  beads: 7,
  stretch: 0,
  mirror: false,
  spin: 0,
  pulse: 0,
  sway: 0,
  march: 0,
  stagger: 0,
  ...patch,
});

/* ---------------------------------------------------------------- frame --- */

/**
 * The border, which every reference has and none of them draws as a line.
 *
 * It is a band of colour around the edge with a row of ticks running through
 * it — the stitched, stamped edge of a printed tile. The ticks sit at
 * `tickAt` across the band, and at 0 that means they are centred on the very
 * edge of the canvas and half of each one is cut off, which is exactly what
 * the references do.
 *
 * `outer` gives the outermost strip of the band its own colour. One tile in
 * thirteen needs it; the rest leave it at 0 and get one flat band.
 */
export type Frame = {
  /** How much of the half-frame the band takes, 0-0.4. */
  band: number;
  /** Share of the band given to a second, outer colour. 0 = one band. */
  outer: number;
  /** Ticks per short side. 0 = a plain band. */
  ticks: number;
  /** Tick length, as a share of the band. */
  tickLen: number;
  /** Tick thickness, as a share of the gap between two ticks. */
  tickWide: number;
  /** Where across the band the ticks are centred. 0 = on the canvas edge. */
  tickAt: number;
  round: boolean;
};

export const defaultFrame = (patch: Partial<Frame> = {}): Frame => ({
  band: 0.16,
  outer: 0,
  ticks: 9,
  tickLen: 0.55,
  tickWide: 0.5,
  tickAt: 0.04,
  round: false,
  ...patch,
});

/* --------------------------------------------------------------- guides --- */

/**
 * The dashed lines under (or over) the ornament.
 *
 * They read as the setting-out marks a tile was drawn from and were left in,
 * and they come in three kinds because the references use three: spokes out
 * from the middle, rings around it, and long spiralling arcs that sweep across
 * the whole face. All three share one ink and one dash, because in every
 * reference they are plainly the same pencil.
 */
export type Guides = {
  spokes: number;
  rings: number;
  arcs: number;
  /** How far an arc curls between the centre and the rim, in degrees. */
  spiral: number;
  ink: number;
  alpha: number;
  weight: number;
  dash: number;
  gap: number;
  from: number;
  to: number;
  /** Drawn over the arms rather than under them. */
  top: boolean;
};

export const defaultGuides = (patch: Partial<Guides> = {}): Guides => ({
  spokes: 0,
  rings: 0,
  arcs: 0,
  spiral: 160,
  ink: 0,
  alpha: 0.5,
  weight: 3,
  dash: 16,
  gap: 14,
  from: 0.1,
  to: 1.3,
  top: false,
  ...patch,
});

/* --------------------------------------------------------------- centre --- */

export type CentreKind = "none" | "dot" | "ring" | "star";

export type Centre = {
  kind: CentreKind;
  /** A share of the panel's half-width. */
  size: number;
  ink: number;
  /** `star` only. */
  points: number;
};

export const defaultCentre = (patch: Partial<Centre> = {}): Centre => ({
  kind: "none",
  size: 0.08,
  ink: 0,
  points: 8,
  ...patch,
});

/* ------------------------------------------------------------- palettes --- */

/* Lifted off the references, one palette a family. Each is four slots: the
   band, the ticks in it, the panel behind everything, and the inks the arms
   and the guides draw with. They travel together because in every reference
   they were chosen together — the orange in the border is the orange in the
   middle, and pulling them apart would just make thirteen tiles that all look
   like a colour picker. */
export type TilePalette = {
  id: string;
  name: string;
  frame: string;
  edge: string;
  ground: string;
  inks: string[];
};

export const PALETTES: TilePalette[] = [
  {
    id: "harbour",
    name: "harbour",
    frame: "#4e7f96",
    edge: "#ee4b1d",
    ground: "#f9cbb8",
    inks: ["#1e2464", "#ee4b1d", "#7d8794", "#f9cbb8"],
  },
  {
    id: "thicket",
    name: "thicket",
    frame: "#4d4b0b",
    edge: "#9dc7db",
    ground: "#9dc7db",
    inks: ["#f04a23", "#fdf6e8", "#4d4b0b"],
  },
  {
    id: "ember",
    name: "ember",
    frame: "#2f4a42",
    edge: "#f6c6ad",
    ground: "#f4471d",
    inks: ["#f7e6a6", "#1c1b22", "#c0341a", "#2f4a42"],
  },
  {
    id: "flag",
    name: "flag",
    frame: "#22463c",
    edge: "#f4471d",
    ground: "#22463c",
    inks: ["#f4471d", "#f6efdd", "#c0341a"],
  },
  {
    id: "union",
    name: "union",
    frame: "#f0501f",
    edge: "#1f4a40",
    ground: "#1f4a40",
    inks: ["#f0d5bb", "#f0501f", "#c99a72"],
  },
  {
    id: "garden",
    name: "garden",
    frame: "#23453b",
    edge: "#f0a184",
    ground: "#2f8f66",
    inks: ["#f6ee9a", "#14161c", "#f0a184", "#23453b"],
  },
  {
    id: "night",
    name: "night",
    frame: "#131318",
    edge: "#f6c92c",
    ground: "#24544a",
    inks: ["#f6c92c", "#e0322a", "#131318"],
  },
  {
    id: "signal",
    name: "signal",
    frame: "#232a4d",
    edge: "#f4471d",
    ground: "#f6efdd",
    inks: ["#14614a", "#f4471d", "#232a4d", "#b9b79c"],
  },
  {
    id: "cocoa",
    name: "cocoa",
    frame: "#2b1410",
    edge: "#f5bf28",
    ground: "#1f4a40",
    inks: ["#f5bf28", "#2b1410", "#8a6a1e"],
  },
  {
    id: "peach",
    name: "peach",
    frame: "#1f8a72",
    edge: "#f2b39c",
    ground: "#f2b39c",
    inks: ["#f0501f", "#fdf0dd", "#b4602f"],
  },
  {
    id: "sunny",
    name: "sunny",
    frame: "#74bde0",
    edge: "#f5c518",
    ground: "#fdf6e8",
    inks: ["#e05a2b", "#f5c518", "#fdf6e8", "#74bde0"],
  },
  {
    id: "alarm",
    name: "alarm",
    frame: "#a8a8a8",
    edge: "#f61a1a",
    ground: "#4f5210",
    inks: ["#f61a1a", "#14161c", "#a8a8a8"],
  },
  {
    id: "carnival",
    name: "carnival",
    frame: "#2b1410",
    edge: "#e0212a",
    ground: "#1f4a44",
    inks: ["#e0212a", "#f5c518", "#7fbcd8", "#fdf0dd"],
  },
];

export const paletteOf = (id: string) =>
  PALETTES.find((p) => p.id === id) ?? PALETTES[0];

/* ----------------------------------------------------------------- spec --- */

export type TileSpec = {
  v: number;
  format: PostFormat;
  /** Seconds. The loop is this long and everything closes inside it. */
  duration: number;
  palette: string;
  /* Set only when a slot has been overridden by hand. A tile with any of
     these stops following its palette in that slot, which is the deliberate
     cost of the picker. */
  frameInk?: string;
  frameOuterInk?: string;
  edgeInk?: string;
  ground?: string;
  inks?: string[];
  frame: Frame;
  /** The panel's corners: 0 is a square, 1 is a circle. */
  round: number;
  /** How hard the hand shakes, 0-1. Nothing here is drawn straight. */
  wobble: number;
  /** How many times the hand redraws it over the loop. 0 holds still. */
  boil: number;
  /** Whole turns the whole composition makes over the loop. */
  spin: number;
  guides: Guides;
  centre: Centre;
  arms: Arm[];
  /** The Posts Studio's own chain, over the finished tile. */
  filters?: FilterSpec[];
};

export const defaultSpec = (): TileSpec => ({
  v: TILE_VERSION,
  format: "square",
  duration: 6,
  palette: "harbour",
  frame: defaultFrame(),
  round: 0.05,
  wobble: 0.4,
  boil: 3,
  spin: 0,
  guides: defaultGuides({ rings: 4, ink: 2, alpha: 0.55 }),
  centre: defaultCentre({ kind: "dot", size: 0.11, ink: 1 }),
  arms: [
    defaultArm({ shape: "ribbon", count: 12, ink: 0, inner: 0.08, outer: 1.55, width: 0.055, wave: 0.3, waves: 2 }),
    defaultArm({ shape: "chain", count: 12, ink: 1, inner: 0.16, outer: 1.35, width: 0.05, taper: -0.3, beads: 6 }),
  ],
});

/** Every colour the renderer needs, palette or hand override. */
export function colorsOf(spec: TileSpec): {
  frame: string;
  frameOuter: string;
  edge: string;
  ground: string;
  inks: string[];
} {
  const p = paletteOf(spec.palette);
  const frame = spec.frameInk ?? p.frame;
  return {
    frame,
    frameOuter: spec.frameOuterInk ?? p.edge,
    edge: spec.edgeInk ?? p.edge,
    ground: spec.ground ?? p.ground,
    inks: spec.inks?.length ? spec.inks : p.inks,
  };
}

/** An ink by position, wrapping — so an arm keeps a colour when a palette
    with fewer inks is chosen, rather than disappearing. */
export const inkAt = (inks: string[], i: number) =>
  inks[((Math.round(i) % inks.length) + inks.length) % inks.length] ?? "#000000";

/* -------------------------------------------------------------- recipes --- */

/**
 * The thirteen, as starting points.
 *
 * Each one is a reading of a reference rather than a copy of it: the frame,
 * the palette, the arms and the guides that make that family of tile, with the
 * numbers left where a hand would want to move them. A recipe replaces the
 * whole composition, because unlike a Kinetics recipe there is nothing of
 * yours in a tile for it to preserve — no words, no picture. The tile *is* the
 * composition.
 */
export type Recipe = {
  id: string;
  name: string;
  note: string;
  spec: Partial<TileSpec>;
};

export const RECIPES: Recipe[] = [
  {
    id: "spokes",
    name: "spokes",
    note: "Twelve navy ribbons with a thread of beads down each one.",
    spec: {
      palette: "harbour",
      frame: defaultFrame({ band: 0.15, ticks: 9, tickLen: 0.5, tickAt: 0.03 }),
      guides: defaultGuides({ rings: 4, ink: 2, alpha: 0.6, dash: 16, from: 0.2, to: 1.25 }),
      centre: defaultCentre({ kind: "dot", size: 0.11, ink: 1 }),
      arms: [
        defaultArm({ shape: "ribbon", count: 12, ink: 0, inner: 0.06, outer: 1.6, width: 0.052, wave: 0.3, waves: 2, pulse: 0.04, ripple: 1, stagger: 1 }),
        defaultArm({ shape: "chain", count: 12, ink: 1, inner: 0.18, outer: 1.35, width: 0.062, taper: -0.3, beads: 6, march: 1, stagger: 0.5 }),
      ],
    },
  },
  {
    id: "flames",
    name: "flames",
    note: "Wavy rays curling out of a point, over dashed setting-out lines.",
    spec: {
      palette: "thicket",
      frame: defaultFrame({ band: 0.16, ticks: 8, tickLen: 0.5, tickWide: 0.45 }),
      guides: defaultGuides({ spokes: 8, arcs: 3, ink: 1, alpha: 1, weight: 4, dash: 20, gap: 16, from: 0.02, to: 1.45, spiral: 120 }),
      centre: defaultCentre({ kind: "star", size: 0.035, ink: 0, points: 8 }),
      arms: [
        defaultArm({ shape: "ribbon", count: 12, ink: 0, inner: 0.01, outer: 1.6, width: 0.048, twist: 55, wave: 0.55, waves: 3, taper: 0.15, sway: 12, ripple: -1, stagger: -1 }),
      ],
    },
  },
  {
    id: "pinwheel",
    name: "pinwheel",
    note: "Three inks of blade, interleaved, all leaning the same way.",
    spec: {
      palette: "ember",
      frame: defaultFrame({ band: 0.14, ticks: 10, tickLen: 0.55, tickWide: 0.42 }),
      guides: defaultGuides({ arcs: 4, ink: 2, alpha: 0.55, weight: 4, dash: 22, gap: 26, from: 0.4, to: 1.4, spiral: 140 }),
      centre: defaultCentre({ kind: "star", size: 0.05, ink: 1, points: 9 }),
      round: 0.03,
      arms: [
        defaultArm({ shape: "wedge", count: 6, ink: 0, inner: 0, outer: 1.7, width: 0.36, taper: -0.55, twist: 110, sway: 8, stagger: 1 }),
        defaultArm({ shape: "wedge", count: 6, ink: 1, turn: 20, inner: 0, outer: 1.7, width: 0.32, taper: -0.55, twist: 110, sway: 8, stagger: 0.5 }),
      ],
    },
  },
  {
    id: "bloom",
    name: "bloom",
    note: "Four hooks and four lobes, mirrored rather than turned.",
    spec: {
      palette: "flag",
      frame: defaultFrame({ band: 0.13, ticks: 11, tickLen: 0.6, tickWide: 0.45 }),
      guides: defaultGuides({ spokes: 4, ink: 2, alpha: 0.85, weight: 4, dash: 24, gap: 20, from: 0.35, to: 1.3 }),
      centre: defaultCentre({ kind: "none" }),
      arms: [
        defaultArm({ shape: "hook", count: 4, ink: 0, turn: 45, inner: 0.48, outer: 1.85, width: 0.19, twist: 78, mirror: true, sway: 10, stagger: 1 }),
        defaultArm({ shape: "petal", count: 4, ink: 1, inner: 0.22, outer: 1.0, width: 0.13, taper: -0.15, pulse: 0.05, stagger: -0.5 }),
      ],
    },
  },
  {
    id: "union",
    name: "union",
    note: "Straight bars to the corners, with snakes running between them.",
    spec: {
      palette: "union",
      frame: defaultFrame({ band: 0.13, ticks: 12, tickLen: 0.5, tickWide: 0.5 }),
      guides: defaultGuides({ spokes: 8, ink: 2, alpha: 0.5, weight: 3, dash: 18, gap: 16, from: 0.3, to: 1.35 }),
      centre: defaultCentre({ kind: "none" }),
      arms: [
        defaultArm({ shape: "bar", count: 8, ink: 0, inner: 0.18, outer: 1.6, width: 0.07 }),
        defaultArm({ shape: "ribbon", count: 8, ink: 1, inner: 0.01, outer: 1.05, width: 0.032, twist: 25, wave: 0.62, waves: 2.5, taper: 0.25, sway: 12, ripple: 2, stagger: 1 }),
      ],
    },
  },
  {
    id: "leaves",
    name: "leaves",
    note: "A field of soft blades with a star of lances laid over it.",
    spec: {
      palette: "garden",
      frame: defaultFrame({ band: 0.15, ticks: 10, tickLen: 0.6, tickWide: 0.44 }),
      guides: defaultGuides({ rings: 3, ink: 3, alpha: 0.5, dash: 18, gap: 22, from: 0.35, to: 1.2 }),
      centre: defaultCentre({ kind: "none" }),
      arms: [
        defaultArm({ shape: "wedge", count: 6, ink: 1, inner: 0, outer: 1.7, width: 0.44, twist: 80, wave: 0.42, waves: 1.5, taper: -0.4, ripple: 1, stagger: 0.5 }),
        defaultArm({ shape: "wedge", count: 6, ink: 0, turn: 30, inner: 0, outer: 1.7, width: 0.38, twist: 80, wave: 0.42, waves: 1.5, taper: -0.4, ripple: -2, stagger: -1 }),
        defaultArm({ shape: "lance", count: 8, ink: 2, inner: 0, outer: 1.5, width: 0.04, pulse: 0.05, stagger: 1 }),
      ],
    },
  },
  {
    id: "orbit",
    name: "orbit",
    note: "Dashes threaded along spirals, with the working lines left in.",
    spec: {
      palette: "night",
      frame: defaultFrame({ band: 0.16, ticks: 9, tickLen: 0.55, tickWide: 0.5 }),
      guides: defaultGuides({ spokes: 5, arcs: 5, ink: 1, alpha: 1, weight: 5, dash: 26, gap: 20, from: 0.03, to: 1.5, spiral: 210, top: true }),
      centre: defaultCentre({ kind: "star", size: 0.03, ink: 1, points: 8 }),
      arms: [
        defaultArm({ shape: "chain", count: 16, ink: 0, inner: 0.04, outer: 1.55, width: 0.026, beads: 9, stretch: 2.4, twist: 70, march: 1, stagger: 0.5 }),
      ],
    },
  },
  {
    id: "cross",
    name: "cross",
    note: "Leaves around a cross of two bars, on cream.",
    spec: {
      palette: "signal",
      frame: defaultFrame({ band: 0.13, ticks: 11, tickLen: 0.55, tickWide: 0.45 }),
      guides: defaultGuides({ spokes: 16, ink: 3, alpha: 0.85, weight: 3, dash: 18, gap: 20, from: 0.15, to: 1.2 }),
      centre: defaultCentre({ kind: "none" }),
      arms: [
        defaultArm({ shape: "petal", count: 8, ink: 0, inner: 0.06, outer: 1.35, width: 0.115, twist: 46, mirror: true, sway: 8, stagger: 1 }),
        defaultArm({ shape: "bar", count: 4, ink: 1, inner: 0, outer: 1.6, width: 0.045 }),
      ],
    },
  },
  {
    id: "star",
    name: "star",
    note: "Long lances and short bars alternating. No guides at all.",
    spec: {
      palette: "cocoa",
      frame: defaultFrame({ band: 0.15, ticks: 8, tickLen: 0.6, tickWide: 0.5 }),
      guides: defaultGuides(),
      centre: defaultCentre({ kind: "none" }),
      arms: [
        defaultArm({ shape: "lance", count: 8, ink: 0, turn: 22.5, inner: 0, outer: 1.55, width: 0.075, pulse: 0.05, stagger: -0.5 }),
        defaultArm({ shape: "bar", count: 8, ink: 0, inner: 0.3, outer: 1.0, width: 0.032, pulse: -0.05, stagger: 1 }),
      ],
    },
  },
  {
    id: "rings",
    name: "rings",
    note: "Fat rounded lobes with a dashed path drawn over the top.",
    spec: {
      palette: "sunny",
      frame: defaultFrame({ band: 0.13, ticks: 12, tickLen: 0.55, tickWide: 0.42 }),
      guides: defaultGuides({ arcs: 4, ink: 2, alpha: 1, weight: 5, dash: 22, gap: 18, from: 0.25, to: 1.3, spiral: 150, top: true }),
      centre: defaultCentre({ kind: "none" }),
      arms: [
        defaultArm({ shape: "wedge", count: 6, ink: 0, inner: 0.1, outer: 1.6, width: 0.7, twist: 26, wave: 0.5, waves: 1.5, taper: -0.3, ripple: 1, stagger: 0.5 }),
        defaultArm({ shape: "wedge", count: 6, ink: 1, turn: 30, inner: 0.35, outer: 1.5, width: 0.34, twist: 26, wave: 0.5, waves: 1.5, taper: -0.5, ripple: 1, stagger: -1 }),
      ],
    },
  },
  {
    id: "alarm",
    name: "alarm",
    note: "One loud ink, and a heavy dashed line thrown across it.",
    spec: {
      palette: "alarm",
      frame: defaultFrame({ band: 0.14, ticks: 10, tickLen: 0.55, tickWide: 0.5 }),
      guides: defaultGuides({ arcs: 5, ink: 1, alpha: 1, weight: 10, dash: 30, gap: 22, from: 0.05, to: 1.4, spiral: 150, top: true }),
      centre: defaultCentre({ kind: "dot", size: 0.03, ink: 1 }),
      arms: [
        defaultArm({ shape: "petal", count: 8, ink: 0, inner: 0, outer: 1.35, width: 0.2, twist: 35, wave: 0.36, waves: 1.5, sway: 10, ripple: -1, stagger: 1 }),
      ],
    },
  },
  {
    id: "beacon",
    name: "beacon",
    note: "Eight quiet rays, and the pencil lines they were set out with.",
    spec: {
      palette: "peach",
      frame: defaultFrame({ band: 0.14, ticks: 11, tickLen: 0.55, tickWide: 0.45 }),
      guides: defaultGuides({ arcs: 8, spokes: 8, ink: 1, alpha: 1, weight: 4, dash: 18, gap: 16, from: 0.02, to: 1.4, spiral: 110 }),
      centre: defaultCentre({ kind: "none" }),
      arms: [
        defaultArm({ shape: "ribbon", count: 8, ink: 0, inner: 0.01, outer: 1.55, width: 0.05, wave: 0.4, waves: 3, pulse: 0.05, ripple: 2, stagger: 0.5 }),
      ],
    },
  },
  {
    id: "carnival",
    name: "carnival",
    note: "Everything at once: a star, arms, threads, studs and corner dots.",
    spec: {
      palette: "carnival",
      frame: defaultFrame({ band: 0.2, outer: 0.32, ticks: 14, tickLen: 0.3, tickWide: 0.55, tickAt: 0.02 }),
      guides: defaultGuides({ rings: 3, spokes: 8, ink: 3, alpha: 0.45, weight: 3, dash: 16, gap: 18, from: 0.2, to: 1.25 }),
      centre: defaultCentre({ kind: "none" }),
      arms: [
        defaultArm({ shape: "petal", count: 8, ink: 1, turn: 22.5, inner: 0.18, outer: 1.6, width: 0.17, twist: 18, mirror: true }),
        defaultArm({ shape: "lance", count: 8, ink: 0, inner: 0, outer: 0.85, width: 0.12, taper: 0.3, pulse: 0.06, stagger: 1 }),
        defaultArm({ shape: "chain", count: 8, ink: 3, turn: 22.5, inner: 0.4, outer: 1.35, width: 0.018, beads: 5, stretch: 2.2, march: 1, stagger: -0.5 }),
        defaultArm({ shape: "dot", count: 8, ink: 2, outer: 0.6, width: 0.055 }),
        defaultArm({ shape: "dot", count: 4, ink: 0, turn: 45, outer: 1.24, width: 0.05 }),
      ],
    },
  },
];

/** A recipe over whatever is showing. The palette can be kept, because a
    palette is the one decision that isn't the composition. */
export function applyRecipe(spec: TileSpec, r: Recipe, keepPalette = false): TileSpec {
  const base = defaultSpec();
  return normalize({
    ...base,
    ...r.spec,
    format: spec.format,
    duration: spec.duration,
    wobble: spec.wobble,
    boil: spec.boil,
    filters: spec.filters,
    palette: keepPalette ? spec.palette : (r.spec.palette ?? base.palette),
    ...(keepPalette
      ? { frameInk: spec.frameInk, frameOuterInk: spec.frameOuterInk, edgeInk: spec.edgeInk, ground: spec.ground, inks: spec.inks }
      : {}),
  });
}

/* ----------------------------------------------------------------- roll --- */

/* A tile from nothing.
 *
 * It rolls the composition and never the frame's proportions or the wobble —
 * the same rule the other studios follow, that a roll decides what the thing
 * is made of and not whether it is legible. And it always leaves at least one
 * arm moving, because this is a studio for motion and a still tile is the
 * exception rather than the default. */
export function randomTile(seed: number, from?: TileSpec): TileSpec {
  let s = seed >>> 0 || 1;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const between = (a: number, b: number) => a + rand() * (b - a);

  const base = from ?? defaultSpec();
  const palette = pick(PALETTES);
  const inkCount = palette.inks.length;
  /* One symmetry for the whole tile: two arms turning at different counts
     read as a mistake rather than as a decision. Multiples of it are fine,
     which is what lets a chain sit on every second ray. */
  const fold = pick([4, 5, 6, 8, 8, 10, 12, 12, 16]);
  const swirl = rand() < 0.55 ? between(-120, 120) : 0;

  const arms: Arm[] = [];
  /* A field behind, sometimes: wide blades that fill the panel and turn the
     ground into one of the colours rather than the colour. */
  const field = rand() < 0.5;
  if (field) {
    const w = between(0.3, 0.55);
    const taper = between(-0.6, 0);
    for (let i = 0; i < 2; i++) {
      arms.push(
        defaultArm({
          shape: "wedge",
          count: fold / 2 >= 3 ? Math.round(fold / 2) : fold,
          ink: (i + 1) % inkCount,
          turn: (i * 360) / fold,
          inner: 0,
          outer: 1.7,
          width: w - i * 0.04,
          taper,
          twist: swirl,
          wave: rand() < 0.5 ? between(0.2, 0.6) : 0,
          waves: between(1, 3),
          /* A wave that stands still is an ornament; a wave that runs out of
             the middle is the thing this studio is for. Rolled whenever there
             is a wave to run. */
          ripple: rand() < 0.7 ? pick([-2, -1, 1, 1, 2]) : 0,
          sway: rand() < 0.5 ? between(-14, 14) : 0,
        }),
      );
    }
  }
  /* The arm that is the tile. */
  arms.push(
    defaultArm({
      /* Never a second wide blade over a field of them — two of those and
         the tile is one colour with a texture, which is not one of these. */
      shape: pick(
        field
          ? (["lance", "ribbon", "petal", "bar", "hook"] as const)
          : (["lance", "ribbon", "petal", "bar", "hook", "wedge"] as const),
      ),
      count: fold,
      ink: 0,
      inner: between(0, 0.25),
      outer: between(1.0, 1.6),
      width: between(0.05, 0.22),
      taper: between(-0.4, 0.4),
      twist: swirl,
      wave: rand() < 0.5 ? between(0.2, 0.7) : 0,
      waves: between(1.5, 3.5),
      ripple: rand() < 0.75 ? pick([-2, -1, 1, 1, 2]) : 0,
      mirror: rand() < 0.3,
      spin: rand() < 0.25 ? pick([-1, 1]) : 0,
      pulse: rand() < 0.6 ? between(-0.08, 0.08) : 0,
      sway: rand() < 0.4 ? between(-18, 18) : 0,
      /* The delay round the ring: often, and often the whole loop, because a
         breath that arrives everywhere at once reads as one object pulsing
         and a breath that travels reads as a system. */
      stagger: rand() < 0.6 ? pick([-1, -0.5, 0.5, 1, 1]) : 0,
    }),
  );
  /* And something threaded through it, often. */
  if (rand() < 0.55) {
    arms.push(
      defaultArm({
        shape: rand() < 0.6 ? "chain" : "dot",
        count: fold,
        ink: Math.max(1, Math.floor(rand() * inkCount)),
        turn: rand() < 0.5 ? 180 / fold : 0,
        inner: between(0.2, 0.45),
        outer: between(1.0, 1.4),
        width: between(0.02, 0.06),
        beads: Math.round(between(4, 9)),
        stretch: rand() < 0.5 ? between(0, 2.4) : 0,
        taper: between(-0.4, 0.2),
        march: rand() < 0.6 ? pick([-1, 1]) : 0,
        stagger: rand() < 0.55 ? pick([-1, 0.5, 1]) : 0,
      }),
    );
  }
  /* Nothing shipped is still. If the dice left every arm holding, the whole
     composition turns instead. */
  const moving = arms.some(
    (a) => a.spin || a.pulse || a.sway || a.march || (a.wave > 0 && a.ripple),
  );

  return normalize({
    ...base,
    palette: palette.id,
    frameInk: undefined,
    frameOuterInk: undefined,
    edgeInk: undefined,
    ground: undefined,
    inks: undefined,
    frame: defaultFrame({
      band: between(0.12, 0.19),
      outer: rand() < 0.2 ? between(0.25, 0.4) : 0,
      ticks: Math.round(between(7, 14)),
      tickLen: between(0.4, 0.65),
      tickWide: between(0.4, 0.6),
      tickAt: between(0, 0.08),
      round: rand() < 0.3,
    }),
    spin: moving ? 0 : pick([-1, 1]),
    guides: defaultGuides({
      spokes: rand() < 0.5 ? fold : 0,
      rings: rand() < 0.4 ? Math.round(between(2, 5)) : 0,
      arcs: rand() < 0.4 ? Math.round(between(3, 8)) : 0,
      spiral: between(80, 220),
      ink: Math.floor(rand() * inkCount),
      alpha: between(0.4, 1),
      weight: between(3, 8),
      dash: between(14, 30),
      gap: between(14, 24),
      from: between(0.02, 0.3),
      to: between(1.1, 1.45),
      top: rand() < 0.35,
    }),
    centre: defaultCentre({
      kind: pick(["none", "none", "dot", "star"] as const),
      size: between(0.03, 0.12),
      ink: Math.floor(rand() * inkCount),
      points: Math.round(between(6, 12)),
    }),
    arms,
  });
}

/* --------------------------------------------------------------- travel --- */

const clamp = (n: number, lo: number, hi: number, d: number) =>
  Number.isFinite(Number(n)) ? Math.min(hi, Math.max(lo, Number(n))) : d;

/** Fill in whatever a spec doesn't say, and put every number back inside its
    range — so a link written before a control existed still opens, and opens
    on the look it was shared with. */
export function normalize(raw: Partial<TileSpec>): TileSpec {
  const base = defaultSpec();
  const frame = { ...base.frame, ...(raw.frame ?? {}) };
  const guides = { ...base.guides, ...(raw.guides ?? {}) };
  const centre = { ...base.centre, ...(raw.centre ?? {}) };
  const arms = (Array.isArray(raw.arms) && raw.arms.length ? raw.arms : base.arms).map((a) => {
    const arm = defaultArm(a);
    return {
      ...arm,
      shape: SHAPES.some((s) => s.value === arm.shape) ? arm.shape : "lance",
      count: Math.round(clamp(arm.count, 1, 48, 12)),
      ink: Math.round(clamp(arm.ink, 0, 15, 0)),
      inner: clamp(arm.inner, 0, 1.8, 0),
      outer: clamp(arm.outer, 0, 2, 1.05),
      width: clamp(arm.width, 0.002, 1.2, 0.09),
      taper: clamp(arm.taper, -1, 1, 0),
      twist: clamp(arm.twist, -540, 540, 0),
      wave: clamp(arm.wave, 0, 1, 0),
      waves: clamp(arm.waves, 0, 12, 2),
      ripple: Math.round(clamp(arm.ripple, -6, 6, 0)),
      turn: clamp(arm.turn, -360, 360, 0),
      beads: Math.round(clamp(arm.beads, 1, 40, 7)),
      stretch: clamp(arm.stretch, 0, 6, 0),
      mirror: arm.mirror === true,
      /* Whole turns and whole beads: the two places a fraction would open a
         seam, and the two places it is simply rounded away. */
      spin: Math.round(clamp(arm.spin, -4, 4, 0)),
      pulse: clamp(arm.pulse, -0.6, 0.6, 0),
      sway: clamp(arm.sway, -180, 180, 0),
      march: Math.round(clamp(arm.march, -6, 6, 0)),
      /* Not rounded, and it doesn't need to be: a delay is a phase, and a
         phase offset of something periodic is still periodic. */
      stagger: clamp(arm.stagger, -2, 2, 0),
      mute: arm.mute === true ? true : undefined,
    } satisfies Arm;
  });

  return {
    ...base,
    ...raw,
    v: TILE_VERSION,
    format: FORMATS[raw.format as PostFormat] ? (raw.format as PostFormat) : base.format,
    duration: clamp(raw.duration ?? base.duration, 1, 30, 6),
    palette: PALETTES.some((p) => p.id === raw.palette) ? raw.palette! : base.palette,
    round: clamp(raw.round ?? base.round, 0, 1, base.round),
    wobble: clamp(raw.wobble ?? base.wobble, 0, 1, base.wobble),
    boil: Math.round(clamp(raw.boil ?? base.boil, 0, 12, base.boil)),
    spin: Math.round(clamp(raw.spin ?? base.spin, -4, 4, 0)),
    frame: {
      band: clamp(frame.band, 0, 0.45, base.frame.band),
      outer: clamp(frame.outer, 0, 1, 0),
      ticks: Math.round(clamp(frame.ticks, 0, 40, base.frame.ticks)),
      tickLen: clamp(frame.tickLen, 0, 1.4, base.frame.tickLen),
      tickWide: clamp(frame.tickWide, 0.05, 1, base.frame.tickWide),
      tickAt: clamp(frame.tickAt, 0, 1, base.frame.tickAt),
      round: frame.round === true,
    },
    guides: {
      spokes: Math.round(clamp(guides.spokes, 0, 48, 0)),
      rings: Math.round(clamp(guides.rings, 0, 16, 0)),
      arcs: Math.round(clamp(guides.arcs, 0, 24, 0)),
      spiral: clamp(guides.spiral, -540, 540, 160),
      ink: Math.round(clamp(guides.ink, 0, 15, 0)),
      alpha: clamp(guides.alpha, 0, 1, 0.5),
      weight: clamp(guides.weight, 0.5, 24, 3),
      dash: clamp(guides.dash, 1, 120, 16),
      gap: clamp(guides.gap, 0, 120, 14),
      from: clamp(guides.from, 0, 1.8, 0.1),
      to: clamp(guides.to, 0, 2, 1.3),
      top: guides.top === true,
    },
    centre: {
      kind: (["none", "dot", "ring", "star"] as CentreKind[]).includes(centre.kind)
        ? centre.kind
        : "none",
      size: clamp(centre.size, 0.005, 0.6, 0.08),
      ink: Math.round(clamp(centre.ink, 0, 15, 0)),
      points: Math.round(clamp(centre.points, 3, 24, 8)),
    },
    arms,
  };
}

/* The spec travels in the URL exactly as a PostSpec does, so anything that can
   write JSON can hand over a finished tile. */
export function encodeSpec(spec: TileSpec): string {
  const bytes = new TextEncoder().encode(JSON.stringify(spec));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSpec(encoded: string): Partial<TileSpec> | null {
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    return JSON.parse(
      new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))),
    ) as Partial<TileSpec>;
  } catch {
    return null;
  }
}
