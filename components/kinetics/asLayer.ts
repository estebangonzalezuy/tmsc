// the Kinetics, as a layer of a post.
//
// The two studios keep separate specs on purpose — over there the words are
// the picture, over here they sit on a sheet — and nothing about that changes.
// What this does is let the Posts Studio *draw* a Kinetics scene, by building
// a KineticSpec out of the slide it already has and handing it to the same
// renderer. There is no second implementation of a scene, and there is no
// second answer to what a scene looks like.
//
// It qualifies as a `generative` layer, which is the only classification that
// matters: canvas 2D, a pure function of the frame, periodic in the post's own
// duration. So the exporter can draw it directly at any moment it names, and a
// reel with one in it still loops.
//
// The words come from the slide's headline rather than from the layer. A
// kinetics layer that carried its own copy of the words would be a second
// place to type the same sentence, and the first thing anyone would do is let
// the two drift apart.

import {
  defaultTiming,
  normalize,
  type KineticSpec,
  type Params,
  type SceneId,
} from "@/lib/kinetics";
import type { PostFormat, Theme } from "@/lib/postlab";
import { paint, sceneOf } from "./scenes";

/** The one dial each scene leads with, so a layer can offer "more of it"
    without the Post Lab growing a panel per scene. The Kinetics itself is
    where the rest of the controls live. */
const DIAL: Record<SceneId, string> = {
  stagger: "rise",
  strokes: "rings",
  mosaic: "cols",
  arcs: "rings",
  field: "bars",
  bleed: "blobs",
  halftone: "cell",
};

export const KINETIC_SCENES: SceneId[] = [
  "stagger",
  "strokes",
  "mosaic",
  "arcs",
  "field",
  "bleed",
  "halftone",
];

/* The theme's two tones, matching the rest of the Post Lab: a light slide is
   near-black on white, a dark one the other way round. */
const tones = (theme: Theme) =>
  theme === "dark"
    ? { ground: "#101010", ink: "#ffffff" }
    : { ground: "#ffffff", ink: "#101010" };

export type KineticLayerOptions = {
  /** The slide's headline. Emphasis markers are stripped: `*this*` means a
      change of voice in the type renderer, and it is not markup here. */
  words: string;
  format: PostFormat;
  duration: number;
  theme: Theme;
  /** 0-1 along the scene's leading control. */
  density?: number;
  /** How far the ink spreads, 0 for no blotter. */
  blot?: number;
  face?: KineticSpec["font"];
  weight?: number;
  /** The layer's own ink, or the post's palette when it is mixing. */
  ink?: string;
  palette?: readonly string[];
};

/** Build the spec a scene needs out of what the slide already knows. */
export function kineticSpecFor(
  scene: SceneId,
  o: KineticLayerOptions,
): KineticSpec {
  const def = sceneOf(scene);
  const t = tones(o.theme);
  const blot = Math.max(0, Math.min(100, o.blot ?? 0));

  const params: Params = {};
  for (const c of def.controls) params[c.key] = c.def;

  /* One knob, mapped across whatever the scene's leading control happens to
     be, so "denser" means the same thing whichever scene is showing. */
  const dial = DIAL[scene];
  const ctrl = def.controls.find((c) => c.key === dial);
  if (ctrl && ctrl.kind === "num" && o.density !== undefined) {
    const d = Math.max(0, Math.min(1, o.density));
    params[dial] = Math.round((ctrl.min + (ctrl.max - ctrl.min) * d) / ctrl.step) * ctrl.step;
  }

  return normalize(
    {
      v: 1,
      format: o.format,
      duration: o.duration,
      scene,
      text: o.words.replace(/\*/g, "").trim() || "tMSC",
      font: o.face ?? "sans",
      weight: o.weight ?? 800,
      caps: true,
      size: 0,
      margin: 96,
      palette: "meaning",
      /* The post's colours win over the Kinetics palettes: a layer inside a
         post has to belong to the post. */
      ground: t.ground,
      inks: o.palette?.length ? [...o.palette] : [o.ink && o.ink !== "mix" ? o.ink : t.ink],
      timing: defaultTiming(),
      /* The Post Lab lays its own grain over the finished slide, and two
         grains is just noise. */
      grain: 0,
      blotter: blot > 0,
      blot,
      params,
    },
    def.controls,
  );
}

/**
 * Draw a Kinetics scene into a layer's canvas.
 *
 * `t` is seconds into the post, which is turned into the scene's own `p` here
 * — the one place the two studios' clocks are reconciled, and the reason a
 * scene inside a post loops on the post's duration rather than its own.
 */
export function drawKineticLayer(
  ctx: CanvasRenderingContext2D,
  scene: SceneId,
  t: number,
  w: number,
  h: number,
  o: KineticLayerOptions,
) {
  const spec = kineticSpecFor(scene, o);
  const D = Math.max(0.001, o.duration);
  paint(ctx, spec, (((t % D) + D) % D) / D, w, h);
}
