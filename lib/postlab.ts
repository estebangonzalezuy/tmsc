// the Post Lab — spec model shared by the tool UI, the exporter, and the
// /api/postlab/schema endpoint that lets Claude generate posts from a prompt.
//
// A PostSpec fully describes a post/carousel/reel: format, slides, and the
// animated shader behind each slide. Specs travel as base64url JSON in the
// URL hash (/postlab#spec=...), so anything that can build JSON — including
// a Claude conversation reading a Notion doc — can deep-link a ready post.

export const SPEC_VERSION = 2;

export type PostFormat = "square" | "portrait" | "story";

export const FORMATS: Record<
  PostFormat,
  { w: number; h: number; label: string; hint: string }
> = {
  square: { w: 1080, h: 1080, label: "1:1", hint: "feed post" },
  portrait: { w: 1080, h: 1350, label: "4:5", hint: "feed / carousel" },
  story: { w: 1080, h: 1920, label: "9:16", hint: "reel / story" },
};

export type Theme = "light" | "dark";

export type ShaderType =
  | "none"
  | "dithering"
  | "waves"
  | "mesh"
  | "perlin"
  | "voronoi"
  | "metaballs"
  | "warp"
  | "spiral"
  | "smoke"
  // generative animators (Cavalry-style procedural motion, canvas 2D)
  | "grid"
  | "lattice"
  | "rays"
  | "tunnel"
  | "bars"
  | "orbits"
  | "bloom"
  | "field";

export type ShaderSpec = { type: ShaderType } & Record<
  string,
  number | string
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

/** One background layer: a shader/generative spec plus mixing + transform. */
export type LayerSpec = ShaderSpec & {
  opacity: number;
  blend: BlendMode;
  offsetX: number; // -1..1
  offsetY: number; // -1..1
  rotation: number; // degrees
  scale: number;
};

export const MAX_LAYERS = 4;

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

export type SlideSpec = {
  kicker: string;
  title: string;
  body: string;
  footer: string;
  /** Circled letter drawn top right; empty string hides it. */
  letter: string;
  titleFont: "serif" | "sans";
  italic: boolean;
  titleSize: "s" | "m" | "l";
  boxed: boolean;
  /** Filled background behind the headline so it reads over busy shaders. */
  plate: boolean;
  align: "left" | "center";
  /** Orbit ring of circled letters behind the text. */
  ring: boolean;
  /** 0-0.9 background-colored wash over the shader, for text legibility. */
  veil: number;
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
};

export type ShaderDef = {
  type: ShaderType;
  label: string;
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

const paperShaders: Omit<ShaderDef, "kind">[] = [
  { type: "none", label: "plain", animated: false, controls: [] },
  {
    type: "dithering",
    label: "dithering",
    animated: true,
    controls: [
      speed(0.5),
      scale(0.9),
      { key: "size", label: "pixel", min: 1, max: 14, step: 0.5, def: 3 },
    ],
    choices: [
      {
        key: "shape",
        label: "pattern",
        values: ["simplex", "warp", "dots", "wave", "ripple", "swirl", "sphere"],
        def: "sphere",
      },
    ],
  },
  {
    type: "waves",
    label: "waves",
    animated: false,
    controls: [
      scale(1),
      { key: "shape", label: "shape", min: 0, max: 3, step: 0.05, def: 1 },
      { key: "amplitude", label: "amplitude", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "frequency", label: "frequency", min: 0, max: 2, step: 0.05, def: 0.5 },
      { key: "spacing", label: "spacing", min: 0, max: 2, step: 0.05, def: 0.75 },
      { key: "rotation", label: "rotation", min: 0, max: 360, step: 5, def: 0 },
    ],
  },
  {
    type: "mesh",
    label: "mesh gradient",
    animated: true,
    controls: [
      speed(0.5),
      { key: "distortion", label: "distortion", min: 0, max: 1, step: 0.05, def: 0.8 },
      { key: "swirl", label: "swirl", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "grainOverlay", label: "grain", min: 0, max: 1, step: 0.05, def: 0 },
    ],
  },
  {
    type: "perlin",
    label: "perlin noise",
    animated: true,
    controls: [
      speed(0.4),
      scale(0.8),
      { key: "proportion", label: "proportion", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "softness", label: "softness", min: 0, max: 1, step: 0.05, def: 0.1 },
    ],
  },
  {
    type: "voronoi",
    label: "voronoi",
    animated: true,
    controls: [
      speed(0.4),
      scale(0.8),
      { key: "gap", label: "gap", min: 0, max: 0.1, step: 0.005, def: 0.03 },
      { key: "glow", label: "glow", min: 0, max: 1, step: 0.05, def: 0 },
    ],
  },
  {
    type: "metaballs",
    label: "metaballs",
    animated: true,
    controls: [
      speed(0.6),
      scale(1),
      { key: "count", label: "count", min: 1, max: 20, step: 1, def: 8 },
      { key: "size", label: "size", min: 0.2, max: 1, step: 0.05, def: 0.8 },
    ],
  },
  {
    type: "warp",
    label: "warp",
    animated: true,
    controls: [
      speed(0.4),
      scale(1),
      { key: "distortion", label: "distortion", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "swirl", label: "swirl", min: 0, max: 1, step: 0.05, def: 0.8 },
      { key: "softness", label: "softness", min: 0, max: 1, step: 0.05, def: 0 },
    ],
    choices: [
      {
        key: "shape",
        label: "pattern",
        values: ["checks", "stripes", "edge"],
        def: "stripes",
      },
    ],
  },
  {
    type: "spiral",
    label: "spiral",
    animated: true,
    controls: [
      speed(0.5),
      scale(1),
      { key: "density", label: "density", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "strokeWidth", label: "stroke", min: 0.05, max: 0.95, step: 0.05, def: 0.5 },
      { key: "distortion", label: "distortion", min: 0, max: 1, step: 0.05, def: 0 },
    ],
  },
  {
    type: "smoke",
    label: "smoke ring",
    animated: true,
    controls: [
      speed(0.6),
      scale(1),
      { key: "thickness", label: "thickness", min: 0.1, max: 2, step: 0.05, def: 0.7 },
      { key: "radius", label: "radius", min: 0, max: 1, step: 0.05, def: 0.5 },
    ],
  },
];

/* Procedural animators in the spirit of Cavalry: staggered repeaters,
   oscillators, radial arrays. All loop seamlessly over the post duration
   (speed picks a whole number of cycles per loop). `warp` pushes the
   geometry itself through a flow field — deformed shapes, not filters. */
const warpCtl = (def: number): ShaderControl => ({
  key: "warp",
  label: "warp",
  min: 0,
  max: 1,
  step: 0.05,
  def,
});

const generative: Omit<ShaderDef, "kind">[] = [
  {
    type: "grid",
    label: "grid",
    animated: true,
    controls: [
      speed(0.6),
      { key: "density", label: "density", min: 4, max: 18, step: 1, def: 9 },
      { key: "size", label: "size", min: 0.2, max: 1, step: 0.05, def: 0.8 },
      { key: "spread", label: "stagger", min: 0, max: 3, step: 0.1, def: 1.2 },
      warpCtl(0.2),
    ],
    choices: [
      { key: "shape", label: "shape", values: ["circle", "square", "cross"], def: "circle" },
    ],
  },
  {
    type: "lattice",
    label: "lattice",
    animated: true,
    controls: [
      speed(0.4),
      { key: "cells", label: "cells", min: 6, max: 30, step: 1, def: 12 },
      { key: "weight", label: "weight", min: 0.5, max: 6, step: 0.25, def: 1.5 },
      warpCtl(0.45),
    ],
  },
  {
    type: "rays",
    label: "rays",
    animated: true,
    controls: [
      speed(0.4),
      { key: "count", label: "count", min: 8, max: 90, step: 1, def: 36 },
      { key: "inner", label: "inner", min: 0, max: 0.8, step: 0.05, def: 0.15 },
      { key: "weight", label: "weight", min: 1, max: 10, step: 0.5, def: 2 },
      warpCtl(0.2),
    ],
  },
  {
    type: "tunnel",
    label: "tunnel",
    animated: true,
    controls: [
      speed(0.5),
      { key: "count", label: "count", min: 4, max: 24, step: 1, def: 10 },
      { key: "weight", label: "weight", min: 1, max: 10, step: 0.5, def: 2 },
      warpCtl(0.25),
    ],
    choices: [
      { key: "shape", label: "shape", values: ["circle", "square"], def: "circle" },
    ],
  },
  {
    type: "bars",
    label: "bars",
    animated: true,
    controls: [
      speed(0.5),
      { key: "rows", label: "rows", min: 6, max: 40, step: 1, def: 14 },
      { key: "phase", label: "phase", min: 0, max: 0.5, step: 0.01, def: 0.12 },
      { key: "fill", label: "fill", min: 0.2, max: 1, step: 0.05, def: 0.7 },
      warpCtl(0.2),
    ],
  },
  {
    type: "orbits",
    label: "orbits",
    animated: true,
    controls: [
      speed(0.5),
      { key: "rings", label: "rings", min: 2, max: 8, step: 1, def: 4 },
      { key: "dots", label: "dots", min: 1, max: 14, step: 1, def: 5 },
      { key: "dotSize", label: "dot size", min: 0.3, max: 2, step: 0.05, def: 1 },
    ],
  },
  {
    type: "bloom",
    label: "bloom",
    animated: true,
    controls: [
      speed(0.3),
      { key: "count", label: "count", min: 60, max: 500, step: 10, def: 220 },
      { key: "size", label: "size", min: 0.3, max: 2, step: 0.05, def: 1 },
      warpCtl(0.2),
    ],
  },
  {
    type: "field",
    label: "wave field",
    animated: true,
    controls: [
      speed(0.5),
      { key: "rows", label: "rows", min: 6, max: 30, step: 1, def: 12 },
      { key: "amplitude", label: "amplitude", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "frequency", label: "frequency", min: 0.5, max: 4, step: 0.1, def: 1.5 },
      warpCtl(0.3),
    ],
  },
];

export const SHADERS: ShaderDef[] = [
  ...paperShaders.map((s) => ({ ...s, kind: "shader" as const })),
  ...generative.map((s) => ({ ...s, kind: "generative" as const })),
];

export const shaderDef = (type: ShaderType): ShaderDef =>
  SHADERS.find((s) => s.type === type) ?? SHADERS[0];

export function defaultShader(type: ShaderType): ShaderSpec {
  const def = shaderDef(type);
  const spec: ShaderSpec = { type };
  for (const c of def.controls) spec[c.key] = c.def;
  for (const c of def.choices ?? []) spec[c.key] = c.def;
  return spec;
}

/* The whole tool is grayscale by contract: shader colors derive from the
   slide theme, never from the spec. */
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
    titleFont: "serif",
    italic: false,
    titleSize: "m",
    boxed: false,
    plate: false,
    align: "left",
    ring: false,
    veil: 0.25,
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
      // v1 specs carried a single `shader`; lift it into the layer stack.
      const layers =
        Array.isArray(s.layers) && s.layers.length
          ? s.layers
          : s.shader
            ? [s.shader as LayerSpec]
            : slide.layers;
      slide.layers = layers.slice(0, MAX_LAYERS).map((l) => {
        const type = shaderDef(l?.type ?? "dithering").type;
        return { ...defaultLayer(type), ...l, type };
      });
      return slide;
    },
  );
  return {
    v: SPEC_VERSION,
    format,
    duration: Math.min(15, Math.max(2, Number(r.duration) || 6)),
    slides: slides.slice(0, 10),
  };
}

/* ------------------------------------------------------------ spec in URL */

export function encodeSpec(spec: PostSpec): string {
  const json = JSON.stringify(spec);
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

export const PRESETS: { name: string; spec: PostSpec }[] = [
  {
    name: "Quote",
    spec: {
      v: SPEC_VERSION,
      format: "square",
      duration: 6,
      slides: [
        defaultSlide({
          kicker: "from the club",
          title:
            "Stop comparing your chapter one\nto someone else's chapter twenty.",
          titleFont: "serif",
          italic: true,
          align: "center",
          letter: "",
          theme: "dark",
          veil: 0.5,
          layers: [{ ...defaultLayer("dithering"), shape: "sphere", speed: 0.4 }],
        }),
      ],
    },
  },
  {
    name: "Announcement",
    spec: {
      v: SPEC_VERSION,
      format: "portrait",
      duration: 6,
      slides: [
        defaultSlide({
          kicker: "new in the club",
          title: "MOTION BASICS\nFOR DESIGNERS",
          body: "A short course on the fundamentals that carry across every tool — made for designers stepping into motion.",
          titleFont: "sans",
          titleSize: "l",
          boxed: true,
          plate: true,
          veil: 0,
          layers: [{ ...defaultLayer("waves"), rotation: 90 }],
        }),
      ],
    },
  },
  {
    name: "Practice File",
    spec: {
      v: SPEC_VERSION,
      format: "square",
      duration: 6,
      slides: [
        defaultSlide({
          kicker: "the practice file — #01",
          title: "Contrast",
          body: "Start here — black and white only. One bounded exercise, no pressure for perfection.",
          titleSize: "l",
          letter: "P",
          ring: true,
          plate: true,
          veil: 0.35,
          layers: [{ ...defaultLayer("grid"), shape: "cross", warp: 0.3 }],
        }),
      ],
    },
  },
  {
    name: "Carousel",
    spec: {
      v: SPEC_VERSION,
      format: "portrait",
      duration: 6,
      slides: [
        defaultSlide({
          kicker: "the Motion Social Club",
          title: "Three ideas\nthe club keeps\ncoming back to",
          theme: "dark",
          layers: [{ ...defaultLayer("mesh"), speed: 0.4 }],
        }),
        defaultSlide({
          kicker: "01 — practice over tutorials",
          title: "Watching is not\nthe same as learning.",
          body: "Short, bounded exercises beat one more tutorial every time.",
          letter: "1",
          veil: 0.55,
          layers: [{ ...defaultLayer("field"), warp: 0.45 }],
        }),
        defaultSlide({
          kicker: "02 — fundamentals over tools",
          title: "Tools are exhausting.\nFoundations are permanent.",
          body: "Easing, timing, contrast, hierarchy.",
          letter: "2",
          veil: 0.55,
          layers: [defaultLayer("voronoi")],
        }),
        defaultSlide({
          kicker: "03 — small and consistent",
          title: "The work no one sees\nshapes your skill.",
          body: "The gym metaphor: short sessions, no pressure for perfection.",
          letter: "3",
          veil: 0.45,
          layers: [defaultLayer("bloom")],
        }),
      ],
    },
  },
  {
    name: "Reel",
    spec: {
      v: SPEC_VERSION,
      format: "story",
      duration: 8,
      slides: [
        defaultSlide({
          kicker: "the Motion Social Club",
          title: "Motion design\nshouldn't feel\nthis lonely.",
          body: "Real conversations over algorithm-driven encounters.",
          theme: "dark",
          letter: "",
          veil: 0.25,
          layers: [{ ...defaultLayer("orbits"), speed: 0.5 }],
        }),
      ],
    },
  },
  {
    name: "Warped",
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
            { ...defaultLayer("lattice"), warp: 0.55, cells: 14, speed: 0.4 },
            {
              ...defaultLayer("grid"),
              shape: "circle",
              density: 7,
              size: 0.5,
              warp: 0.5,
              blend: "difference",
              opacity: 0.9,
            },
          ],
        }),
      ],
    },
  },
];
