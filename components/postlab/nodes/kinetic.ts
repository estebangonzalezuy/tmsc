// `kinetic` — the retired Kinetics studio's "type is the graphic" argument,
// folded into the Posts Studio as a 9th node kind. Where `type` sets a
// headline over whatever's wired in, `kinetic` has no background layer at
// all: seven ways of turning the words themselves into the picture
// (`components/postlab/nodes/kinetic/scenes.ts`), ported from
// `components/kinetics/scenes.ts` almost unchanged — only how params arrive
// is different.
//
// A source node like `field`/`photo` (`inputs: []`) — a scene is drawn
// fresh every frame, never composited over an upstream image.
//
// **Every param is flat**, `ParamValue`-shaped, because a graph node has no
// room for a nested `KineticSpec`: the old spec's `timing: Timing` object
// unpacks directly (every `Timing` field is already a primitive); the old
// per-scene `params: Params` bag unpacks into this node's own params,
// prefixed `${scene}_${key}` so none of the ~40 controls across 7 scenes
// collide with each other or with the shared ones (`rings`/`centreY`/`spin`/
// `size`/`blur` all recur across scenes with different ranges; halftone's
// own "inks" control — a count — would otherwise collide outright with this
// node's own `inks: string[]` colour ramp).
//
// Colour follows `field`'s ramp-with-presets convention rather than a
// `Theme`/palette object: `inks`/`ground` are explicit hex params, and
// `KINETIC_PRESET_PALETTES` (`lib/palette.ts`, ported from the old
// `lib/kinetics.ts`'s `PALETTES`) are starting points the Inspector offers,
// not the only source.
//
// Dropped relative to the old `paint()`: running the Posts Studio's filter
// chain internally — a filter is now a separate `filter` node wired
// downstream, exactly like every other node kind here. Grain and blotter
// stay on this node, unchanged, since neither was ever a `filter` node in
// the old model either.

import type { BoolControl, NodeDef, NodeKindImpl, ParamValue, ShaderChoice, ShaderControl, TextField } from "@/lib/postgraph";
import { KINETIC_PRESET_PALETTES, cleanInks, kineticPaletteOf } from "@/lib/palette";
import { currentFonts } from "./type";
import { num, str, bool, makeCanvas } from "./util";
import { DIRS, EASES, type Dir, type Ease } from "./kinetic/easing";
import { ORIGINS, type Origin, type Timing } from "./kinetic/timing";
import type { TypeParams } from "./kinetic/layout";
import { SCENE_IDS, paint, type Frame, type SceneId } from "./kinetic/scenes";

/* ------------------------------------------------------------- controls -- */

const SHARED_CONTROLS: ShaderControl[] = [
  { key: "weight", label: "weight", min: 100, max: 900, step: 10, def: 800 },
  { key: "size", label: "size (0 fits)", min: 0, max: 0.5, step: 0.005, def: 0 },
  { key: "margin", label: "margin", min: 0, max: 300, step: 2, def: 72 },
  { key: "grain", label: "grain", min: 0, max: 1, step: 0.01, def: 0.05 },
  { key: "blot", label: "blot spread", min: 0, max: 100, step: 1, def: 40 },
];

/* Only `stagger` and `field` read the timing model — the other five scenes
   never call presence()/queue() at all. `visibleFor` hides this whole group
   unless one of those two is the active scene. */
const TIMING_CONTROLS: ShaderControl[] = [
  { key: "introLen", label: "intro length", min: 0, max: 1, step: 0.01, def: 0.34 },
  { key: "pause", label: "pause", min: 0, max: 1, step: 0.01, def: 0.32 },
  { key: "outroLen", label: "outro length", min: 0, max: 1, step: 0.01, def: 0.34 },
  { key: "delay", label: "stagger delay", min: 0, max: 0.9, step: 0.01, def: 0.22 },
];
const TIMING_KEYS = new Set(["introEase", "introDir", ...TIMING_CONTROLS.map((c) => c.key), "outroEase", "outroDir", "from"]);

/* One entry a scene's own `Ctrl[]` (see the old `components/kinetics/
   scenes.ts`), key prefixed `${scene}_`. */
const SCENE_CONTROLS: Record<SceneId, ShaderControl[]> = {
  stagger: [
    { key: "rise", label: "throw", min: 0, max: 600, step: 4, def: 180 },
    { key: "spin", label: "turn", min: -180, max: 180, step: 1, def: 0 },
    { key: "zoom", label: "grow from", min: 0, max: 2.5, step: 0.05, def: 0.7 },
    { key: "rowShift", label: "row drift", min: 0, max: 400, step: 4, def: 90 },
  ],
  strokes: [
    { key: "rings", label: "rings", min: 12, max: 220, step: 1, def: 64 },
    { key: "centreY", label: "centre", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "inside", label: "inside weight", min: 0.2, max: 2.4, step: 0.05, def: 1.15 },
    { key: "outside", label: "outside weight", min: 0, max: 2, step: 0.05, def: 0.5 },
    { key: "reach", label: "fray", min: 0, max: 1, step: 0.01, def: 0.42 },
    { key: "spin", label: "turns", min: -3, max: 3, step: 1, def: 1 },
  ],
  mosaic: [
    { key: "cols", label: "columns", min: 3, max: 60, step: 1, def: 11 },
    { key: "slide", label: "slide", min: -6, max: 6, step: 1, def: 2 },
    { key: "wave", label: "wave", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "stretch", label: "stretch", min: 0.5, max: 2.4, step: 0.05, def: 1.5 },
  ],
  arcs: [
    { key: "rings", label: "rings", min: 3, max: 60, step: 1, def: 22 },
    { key: "size", label: "letter", min: 6, max: 48, step: 1, def: 17 },
    { key: "gap", label: "spacing", min: 0.6, max: 3, step: 0.05, def: 1.5 },
    { key: "centreY", label: "centre", min: 0.2, max: 2, step: 0.02, def: 1.18 },
    { key: "inner", label: "inner ring", min: 0, max: 0.9, step: 0.01, def: 0.12 },
    { key: "turns", label: "turns", min: -2, max: 2, step: 1, def: 1 },
  ],
  field: [
    { key: "bars", label: "bands", min: 2, max: 16, step: 1, def: 7 },
    { key: "rows", label: "rows", min: 1, max: 4, step: 1, def: 2 },
    { key: "blur", label: "blur", min: 0, max: 100, step: 1, def: 42 },
    { key: "paper", label: "paper", min: 0, max: 100, step: 1, def: 30 },
    { key: "drift", label: "drift", min: -3, max: 3, step: 1, def: 1 },
    { key: "inset", label: "inset", min: 0, max: 0.3, step: 0.01, def: 0.08 },
    { key: "word", label: "word size", min: 8, max: 120, step: 1, def: 46 },
    { key: "scatter", label: "scatter", min: 0, max: 1, step: 0.01, def: 0.7 },
  ],
  bleed: [
    { key: "blobs", label: "blobs", min: 2, max: 12, step: 1, def: 5 },
    { key: "size", label: "blob size", min: 0.2, max: 1.4, step: 0.05, def: 0.7 },
    { key: "blur", label: "blur", min: 0, max: 100, step: 1, def: 30 },
    { key: "flow", label: "flow", min: -3, max: 3, step: 1, def: 1 },
    { key: "smear", label: "smear", min: 0, max: 40, step: 1, def: 10 },
    { key: "steps", label: "smear steps", min: 1, max: 14, step: 1, def: 6 },
  ],
  halftone: [
    { key: "cell", label: "dot pitch", min: 4, max: 60, step: 1, def: 26 },
    { key: "inkCount", label: "inks", min: 1, max: 5, step: 1, def: 4 },
    { key: "swell", label: "dot size", min: 0.4, max: 2.4, step: 0.05, def: 1.5 },
    { key: "spin", label: "turns", min: -2, max: 2, step: 1, def: 1 },
    { key: "wobble", label: "wobble", min: 0, max: 1, step: 0.01, def: 0.35 },
  ],
};

const SCENE_BOOLS: Record<SceneId, BoolControl[]> = {
  stagger: [
    { key: "perLetter", label: "a colour a letter", def: true },
    { key: "fade", label: "fade in", def: false, hint: "Off, a letter is solid the whole way — it moves, it doesn't dissolve." },
  ],
  strokes: [{ key: "colour", label: "colour the rings", def: false }],
  mosaic: [{ key: "ghost", label: "fill the ground", def: true, hint: "Off, only cells inside a letter are set." }],
  arcs: [
    { key: "alternate", label: "counter-turn", def: true },
    { key: "mono", label: "one ink", def: true, hint: "Off, every ring takes its own colour." },
  ],
  field: [{ key: "dark", label: "dark words", def: false }],
  bleed: [],
  halftone: [{ key: "square", label: "square dots", def: false }],
};

const SCENE_CHOICES: Record<SceneId, ShaderChoice[]> = {
  stagger: [],
  strokes: [],
  mosaic: [],
  arcs: [],
  field: [],
  bleed: [{ key: "mode", label: "against", values: ["difference", "exclusion", "multiply", "screen", "source-over"], def: "difference" }],
  halftone: [],
};

const SCENE_TEXTS: Record<SceneId, TextField[]> = {
  stagger: [],
  strokes: [],
  mosaic: [{ key: "alphabet", label: "made of" }],
  arcs: [],
  field: [],
  bleed: [],
  halftone: [],
};

function prefixed<T extends { key: string }>(scene: SceneId, list: T[]): T[] {
  return list.map((c) => ({ ...c, key: `${scene}_${c.key}` }));
}

const allControls: ShaderControl[] = [
  ...SHARED_CONTROLS,
  ...TIMING_CONTROLS,
  ...SCENE_IDS.flatMap((s) => prefixed(s, SCENE_CONTROLS[s])),
];
const allBools: BoolControl[] = [
  { key: "caps", label: "caps", def: true },
  { key: "blotter", label: "blotter (one ink on paper)", def: false },
  ...SCENE_IDS.flatMap((s) => prefixed(s, SCENE_BOOLS[s])),
];
const allChoices: ShaderChoice[] = [
  { key: "scene", label: "scene", values: [...SCENE_IDS], def: "stagger" },
  { key: "font", label: "voice", values: ["sans", "serif", "gothic"], def: "sans" },
  { key: "paletteId", label: "palette", values: KINETIC_PRESET_PALETTES.map((p) => p.id), def: "meaning" },
  { key: "introEase", label: "intro ease", values: [...EASES], def: "expo" },
  { key: "introDir", label: "intro dir", values: [...DIRS], def: "out" },
  { key: "outroEase", label: "outro ease", values: [...EASES], def: "expo" },
  { key: "outroDir", label: "outro dir", values: [...DIRS], def: "in" },
  { key: "from", label: "stagger from", values: [...ORIGINS], def: "ml" },
  ...SCENE_IDS.flatMap((s) => prefixed(s, SCENE_CHOICES[s])),
];
const allTexts: TextField[] = [
  { key: "text", label: "text", rows: 4 },
  ...SCENE_IDS.flatMap((s) => prefixed(s, SCENE_TEXTS[s])),
];

/** Which of the ~50 flat params apply to the active scene — the one thing
    that keeps this node's Inspector from being an unfiltered wall of every
    scene's controls at once. A key prefixed `scene_` only shows for that
    scene; the timing group only shows for the two scenes that read it
    (`stagger`, `field`); everything else (shared params, the scene picker
    itself) always shows. */
export function visibleFor(scene: string, key: string): boolean {
  const owner = SCENE_IDS.find((id) => key.startsWith(`${id}_`));
  if (owner) return owner === scene;
  if (TIMING_KEYS.has(key)) return scene === "stagger" || scene === "field";
  return true;
}

export const def: NodeDef = {
  kind: "kinetic",
  label: "Kinetic",
  hint: "Type as the graphic, not a layer over one — seven scenes, ported from the retired Kinetics studio.",
  inputs: [],
  outputs: ["out"],
  controls: allControls,
  choices: allChoices,
  bools: allBools,
  texts: allTexts,
};

/* -------------------------------------------------------------- defaults -- */

function defaultParams(): Record<string, ParamValue> {
  const palette = kineticPaletteOf("meaning");
  const params: Record<string, ParamValue> = {
    text: "THE MEANING\nOF ALL\nMOTION",
    font: "sans",
    weight: 800,
    caps: true,
    size: 0,
    margin: 72,
    paletteId: palette.id,
    inks: [...palette.inks],
    ground: palette.ground,
    grain: 0.05,
    blotter: false,
    blot: 40,
    scene: "stagger",
    introEase: "expo",
    introDir: "out",
    introLen: 0.34,
    pause: 0.32,
    outroEase: "expo",
    outroDir: "in",
    outroLen: 0.34,
    delay: 0.22,
    from: "ml",
    mosaic_alphabet: "SMLX",
  };
  for (const c of allControls) if (!(c.key in params)) params[c.key] = c.def;
  for (const c of allBools) if (!(c.key in params)) params[c.key] = c.def;
  for (const c of allChoices) if (!(c.key in params)) params[c.key] = c.def;
  return params;
}

/* -------------------------------------------------------------- evaluate -- */

function evaluate(
  params: Record<string, ParamValue>,
  _inputs: Record<string, HTMLCanvasElement | null>,
  p: number,
  w: number,
  h: number,
): HTMLCanvasElement {
  const sceneRaw = str(params.scene, "stagger");
  const scene: SceneId = (SCENE_IDS as readonly string[]).includes(sceneRaw) ? (sceneRaw as SceneId) : "stagger";

  const tp: TypeParams = {
    text: str(params.text, ""),
    font: (["sans", "serif", "gothic"] as const).includes(str(params.font, "sans") as "sans" | "serif" | "gothic")
      ? (str(params.font, "sans") as TypeParams["font"])
      : "sans",
    weight: num(params.weight, 800),
    caps: bool(params.caps, true),
    size: num(params.size, 0),
    margin: num(params.margin, 72),
  };

  const paletteId = str(params.paletteId, "meaning");
  const preset = kineticPaletteOf(paletteId);
  const ground = str(params.ground, preset.ground);
  const inks = cleanInks(params.inks, preset.inks);

  const introEase = (EASES as readonly string[]).includes(str(params.introEase, "expo")) ? (str(params.introEase, "expo") as Ease) : "expo";
  const outroEase = (EASES as readonly string[]).includes(str(params.outroEase, "expo")) ? (str(params.outroEase, "expo") as Ease) : "expo";
  const introDir = (DIRS as readonly string[]).includes(str(params.introDir, "out")) ? (str(params.introDir, "out") as Dir) : "out";
  const outroDir = (DIRS as readonly string[]).includes(str(params.outroDir, "in")) ? (str(params.outroDir, "in") as Dir) : "in";
  const from = (ORIGINS as readonly string[]).includes(str(params.from, "ml")) ? (str(params.from, "ml") as Origin) : "ml";

  const timing: Timing = {
    intro: introEase,
    introDir,
    introLen: Math.min(1, Math.max(0, num(params.introLen, 0.34))),
    pause: Math.min(1, Math.max(0, num(params.pause, 0.32))),
    outro: outroEase,
    outroDir,
    outroLen: Math.min(1, Math.max(0, num(params.outroLen, 0.34))),
    delay: Math.min(0.9, Math.max(0, num(params.delay, 0.22))),
    from,
  };

  const out = makeCanvas(w, h);
  const ctx = out.getContext("2d")!;
  const f: Frame = {
    ctx,
    w,
    h,
    p: ((p % 1) + 1) % 1,
    tp,
    fonts: currentFonts(),
    timing,
    ground,
    inks: inks.length ? inks : ["#ffffff"],
    s: w / 1080,
    params,
    grain: Math.min(1, Math.max(0, num(params.grain, 0.05))),
    blotter: bool(params.blotter, false),
    blot: Math.min(100, Math.max(0, num(params.blot, 40))),
  };
  paint(f, scene);
  return out;
}

const kineticNode: NodeKindImpl = { def, defaultParams, evaluate };
export default kineticNode;
