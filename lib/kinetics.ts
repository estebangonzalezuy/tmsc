// the Kinetics — the club's second studio, and a different argument from the
// first one.
//
// The Posts Studio treats type as a layer *over* a graphic: a headline sits on
// a sheet, and underneath it something is drawn. Every reference this studio
// was built from does the opposite — the type *is* the graphic. A word is
// exploded into letters that arrive one at a time; a word is a mask that a
// field of strokes is cut against; a word is the alphabet a mosaic is built
// out of; a word is repeated along an arc until it becomes a dome. There is no
// background layer in any of them, because the words are the picture.
//
// So this is not a mode of the other studio. It is a second instrument with
// its own spec, and it shares only the things that would be perverse to write
// twice: the clock, the formats, the fonts, the way out.
//
// Two rules carried over, because they are what make an export trustworthy:
//
// 1. **The loop is a contract.** Every scene is a function of `p`, a number
//    from 0 to 1 through the loop, and every one of them lands on the same
//    frame at p=1 as it drew at p=0. Rotations are whole turns, waves are
//    whole cycles, and a stagger's intro, pause and outro are shares of the
//    loop rather than seconds. Nothing reads the wall clock.
// 2. **Nothing shipped is still.** There is no static scene here — a still
//    frame is a scene paused, not a scene without motion.

import { FORMATS, type PostFormat } from "./postlab";

export { FORMATS };
export type { PostFormat };

export const KINETIC_VERSION = 1;

/* ------------------------------------------------------------- easing --- */

/* The acceleration menu, straight off the reference: a family and a
   direction, rather than thirty named curves. `bounce` and `elastic` overshoot
   on purpose — they are the two that make type feel thrown rather than
   moved. */
export type Ease =
  | "linear"
  | "sine"
  | "quad"
  | "cubic"
  | "quart"
  | "expo"
  | "circ"
  | "back"
  | "bounce"
  | "elastic";

export type Dir = "in" | "out" | "inout";

export const EASES: { value: Ease; label: string }[] = [
  { value: "linear", label: "linear" },
  { value: "sine", label: "sine" },
  { value: "quad", label: "quad" },
  { value: "cubic", label: "cubic" },
  { value: "quart", label: "quart" },
  { value: "expo", label: "expo" },
  { value: "circ", label: "circ" },
  { value: "back", label: "back" },
  { value: "bounce", label: "bounce" },
  { value: "elastic", label: "elastic" },
];

/** Every curve as its "in" form, 0→1. `out` and `inout` are derived, so a
    family is written once and can't disagree with itself. */
const IN: Record<Ease, (t: number) => number> = {
  linear: (t) => t,
  sine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  quad: (t) => t * t,
  cubic: (t) => t * t * t,
  quart: (t) => t * t * t * t,
  expo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  circ: (t) => 1 - Math.sqrt(1 - t * t),
  back: (t) => 2.70158 * t * t * t - 1.70158 * t * t,
  bounce: (t) => 1 - OUT_BOUNCE(1 - t),
  elastic: (t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3)),
};

function OUT_BOUNCE(t: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

export function ease(kind: Ease, dir: Dir, t: number): number {
  const x = Math.min(1, Math.max(0, t));
  const f = IN[kind] ?? IN.linear;
  if (dir === "in") return f(x);
  if (dir === "out") return 1 - f(1 - x);
  return x < 0.5 ? f(x * 2) / 2 : 1 - f((1 - x) * 2) / 2;
}

/* -------------------------------------------------------------- timing --- */

/** Where a stagger radiates from. The reference draws this as a 3×3 of radio
    buttons, which is exactly right: it is a position, not a list. */
export type Origin =
  | "tl" | "tc" | "tr"
  | "ml" | "mc" | "mr"
  | "bl" | "bc" | "br"
  | "order" | "random";

export const ORIGINS: Origin[] = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];

export type Timing = {
  intro: Ease;
  introDir: Dir;
  /** Share of the loop, 0-1. Intro + pause + outro are normalized to fit. */
  introLen: number;
  pause: number;
  outro: Ease;
  outroDir: Dir;
  outroLen: number;
  /** How far apart two items start, as a share of the loop. */
  delay: number;
  from: Origin;
};

export const defaultTiming = (): Timing => ({
  intro: "expo",
  introDir: "out",
  introLen: 0.34,
  pause: 0.32,
  outro: "expo",
  outroDir: "in",
  outroLen: 0.34,
  delay: 0.22,
  from: "ml",
});

/**
 * One item's presence at time `p`: 0 = away, 1 = arrived.
 *
 * The whole loop is intro → pause → outro, and because those three are shares
 * rather than seconds the sum is renormalized to 1 — which is what makes the
 * frame at p=1 identical to the frame at p=0 whatever the sliders say. That is
 * the entire reason a stagger can't open a seam here.
 *
 * `k` is the item's place in the queue, 0-1, already measured from the origin.
 */
export function presence(t: Timing, p: number, k: number): number {
  const total = t.introLen + t.pause + t.outroLen || 1;
  const intro = t.introLen / total;
  const hold = t.pause / total;
  /* The stagger eats into the loop rather than extending past it: the last
     item still has a whole intro inside the window. */
  const spread = Math.min(0.9, Math.max(0, t.delay));
  const lead = k * spread;
  const span = 1 - spread;
  const local = (p - lead) / (span || 1);

  if (local < 0) {
    /* Not yet arrived this time round — but the tail of the previous loop is
       still leaving, which is what keeps the two ends continuous. */
    const wrapped = (local + 1) * span;
    const outStart = (intro + hold) * span + lead;
    return tail(t, wrapped, intro, hold, outStart, span, lead);
  }
  if (local > 1) return 0;

  if (local < intro) return ease(t.intro, t.introDir, local / (intro || 1));
  if (local < intro + hold) return 1;
  const o = (local - intro - hold) / (1 - intro - hold || 1);
  return 1 - ease(t.outro, t.outroDir, o);
}

/* The part of an item's journey that belongs to the previous turn of the
   loop. Split out because reading it inline made `presence` unreadable, and
   it is the half that actually guarantees the seam closes. */
function tail(
  t: Timing,
  wrapped: number,
  intro: number,
  hold: number,
  _outStart: number,
  span: number,
  lead: number,
): number {
  const local = (wrapped - lead) / (span || 1);
  if (local < intro + hold || local > 1) return 0;
  const o = (local - intro - hold) / (1 - intro - hold || 1);
  return 1 - ease(t.outro, t.outroDir, o);
}

/** An item's place in the queue, 0-1, by where it sits in the frame. */
export function queue(
  from: Origin,
  x: number,
  y: number,
  i: number,
  n: number,
  seed = 1,
): number {
  if (n <= 1) return 0;
  if (from === "order") return i / (n - 1);
  if (from === "random") return rnd(i * 97 + seed * 13);
  const ax = from[1] === "l" ? 0 : from[1] === "r" ? 1 : 0.5;
  const ay = from[0] === "t" ? 0 : from[0] === "b" ? 1 : 0.5;
  /* Distance from the chosen corner, normalized by the longest it could be —
     so the same slider means the same thing wherever the origin is. */
  const d = Math.hypot(x - ax, y - ay);
  return Math.min(1, d / Math.SQRT2);
}

/* A deterministic hash, because a scattered layout is a design decision and
   must not crawl between frames or differ between two exports. */
export function rnd(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/* ------------------------------------------------------------ palettes --- */

/* This studio is colour-forward, which is the one place it parts company with
   the site. The rule there is that nothing is coloured until it is pointed at;
   here colour is the material. Grounds and inks travel together because every
   reference picked both at once — pink type on black is a decision, not two. */
export type Palette = { id: string; name: string; ground: string; inks: string[] };

export const PALETTES: Palette[] = [
  {
    id: "meaning",
    name: "meaning",
    ground: "#111111",
    inks: ["#ffffff", "#ff2d95", "#00e05a", "#2b34ff", "#ff5c00", "#ffe500", "#a855f7"],
  },
  {
    id: "shine",
    name: "shine",
    ground: "#0b0b0b",
    inks: ["#00e05a", "#ffffff", "#00c2ff", "#ff3b30", "#ffd400"],
  },
  {
    id: "smlxl",
    name: "smlxl",
    ground: "#111111",
    inks: ["#ff7ac8", "#4ec3e0", "#2f8f6b", "#ff7a5c"],
  },
  {
    id: "love",
    name: "love",
    ground: "#f7efd8",
    inks: ["#ef4a3a", "#f58220", "#ec6ca4", "#2f8fbf", "#f2b705", "#c86dd7"],
  },
  {
    id: "torino",
    name: "torino",
    ground: "#f2f0eb",
    inks: ["#111111", "#2b34ff", "#00b34a", "#ff2d2d", "#6b21d9"],
  },
  {
    id: "press",
    name: "press",
    ground: "#ffffff",
    inks: ["#111111", "#ff2d2d", "#2b34ff", "#00b34a", "#ffb800"],
  },
];

export const paletteOf = (id: string) =>
  PALETTES.find((p) => p.id === id) ?? PALETTES[0];

/* ------------------------------------------------------------ controls --- */

/* A scene declares what it asks about, and the panel is generated from it —
   the same bargain the Tools make. It means a new scene is one file and no UI
   work, and it means no scene can grow a control the panel doesn't know how to
   draw. */
export type Ctrl =
  | { key: string; label: string; kind: "num"; min: number; max: number; step: number; def: number; hint?: string }
  | { key: string; label: string; kind: "bool"; def: boolean; hint?: string }
  | { key: string; label: string; kind: "pick"; values: { value: string; label: string }[]; def: string }
  | { key: string; label: string; kind: "words"; def: string };

export type Params = Record<string, number | string | boolean>;

export type SceneId =
  | "stagger"
  | "strokes"
  | "mosaic"
  | "arcs"
  | "field"
  | "bleed"
  | "halftone";

/* ---------------------------------------------------------------- spec --- */

export type KineticSpec = {
  v: number;
  format: PostFormat;
  /** Seconds. The loop is this long and every scene closes inside it. */
  duration: number;
  scene: SceneId;
  /** The words. `\n` breaks a line. */
  text: string;
  font: "sans" | "serif" | "gothic";
  weight: number;
  caps: boolean;
  /** Type size as a share of the frame, or 0 to fit the frame. */
  size: number;
  margin: number;
  palette: string;
  /** Set only when the owner has overridden the palette by hand. */
  ground?: string;
  inks?: string[];
  timing: Timing;
  grain: number;
  params: Params;
};

export const defaultSpec = (): KineticSpec => ({
  v: KINETIC_VERSION,
  format: "portrait",
  duration: 6,
  scene: "stagger",
  text: "THE MEANING\nOF ALL\nMOTION",
  font: "sans",
  weight: 800,
  caps: true,
  size: 0,
  margin: 72,
  palette: "meaning",
  timing: defaultTiming(),
  grain: 0.05,
  params: {},
});

/** The spec's colours, whether they came from a palette or a hand override. */
export function colorsOf(spec: KineticSpec): { ground: string; inks: string[] } {
  const p = paletteOf(spec.palette);
  return {
    ground: spec.ground ?? p.ground,
    inks: spec.inks?.length ? spec.inks : p.inks,
  };
}

/** An ink for an item, stable across frames and visits — the same rule the
    site's hover colours follow: pick by something about the item, never by a
    counter that shifts when a letter is added. */
export const inkFor = (inks: string[], key: number) =>
  inks[Math.abs(Math.round(key)) % inks.length];

/* ------------------------------------------------------------- travel --- */

/* Fill in whatever a spec doesn't say, against the active scene's controls, so
   a link written before a control existed still opens — and opens on the look
   it was shared with, because every default is "the way it was before". */
export function normalize(raw: Partial<KineticSpec>, controls: Ctrl[]): KineticSpec {
  const base = defaultSpec();
  const spec: KineticSpec = {
    ...base,
    ...raw,
    timing: { ...base.timing, ...(raw.timing ?? {}) },
    params: { ...(raw.params ?? {}) },
  };
  spec.v = KINETIC_VERSION;
  spec.duration = Math.min(30, Math.max(1, spec.duration || 6));
  for (const c of controls) {
    const got = spec.params[c.key];
    if (got === undefined) spec.params[c.key] = c.def;
    else if (c.kind === "num") {
      const n = Number(got);
      spec.params[c.key] = Number.isFinite(n) ? Math.min(c.max, Math.max(c.min, n)) : c.def;
    } else if (c.kind === "bool") spec.params[c.key] = got === true || got === "true";
    else if (c.kind === "pick" && !c.values.some((v) => v.value === got)) {
      spec.params[c.key] = c.def;
    }
  }
  return spec;
}

export const num = (p: Params, k: string, d = 0) => {
  const n = Number(p[k]);
  return Number.isFinite(n) ? n : d;
};
export const bool = (p: Params, k: string) => p[k] === true || p[k] === "true";
export const text = (p: Params, k: string, d = "") => String(p[k] ?? d);

/* The spec travels in the URL exactly as a PostSpec does, so anything that can
   write JSON can hand over a finished piece. */
export function encodeSpec(spec: KineticSpec): string {
  const bytes = new TextEncoder().encode(JSON.stringify(spec));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSpec(encoded: string): Partial<KineticSpec> | null {
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    return JSON.parse(
      new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))),
    ) as Partial<KineticSpec>;
  } catch {
    return null;
  }
}
