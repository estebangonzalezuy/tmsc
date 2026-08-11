// the Post Lab — spec model shared by the tool UI, the exporter, and the
// /api/postlab/schema endpoint that lets Claude generate posts from a prompt.
//
// A PostSpec fully describes a post/carousel/reel: format, slides, and the
// animated shader behind each slide. Specs travel as base64url JSON in the
// URL hash (/postlab#spec=...), so anything that can build JSON — including
// a Claude conversation reading a Notion doc — can deep-link a ready post.

export const SPEC_VERSION = 8;

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
export type ShaderType = "none" | "dithering" | "forms";

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
  number | string | boolean | string[] | MotionMap | undefined
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
  /** The picture behind a `photo` pattern. Either a path on this site
      (`/stills/…`, which travels in a link) or `local:<id>` for a file the
      owner picked, which lives in that browser and nowhere else — the same
      zero-config bargain the Studio and the Desk make. */
  src?: string;
  /** How the picture fills the frame. */
  fit?: "cover" | "contain";
  /** Switched off without being deleted, so a stack can be taken apart and
      put back together. Absent means visible. */
  mute?: boolean;
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

export const MAX_LAYERS = 4;

/** The switchable parts of the typographic layer, in the order they read. */
export const SLIDE_PARTS = [
  "kicker",
  "title",
  "body",
  "mark",
  "footer",
  "rules",
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

export type SlideSpec = {
  kicker: string;
  title: string;
  body: string;
  footer: string;
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

export const SHADERS: ShaderDef[] = [
  { type: "none", label: "plain", animated: false, kind: "shader", controls: [] },
  paperDithering,
  ditheredForms,
];

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
  if (!motion) return layer;
  const out = { ...layer } as LayerSpec;
  delete out.motion;
  for (const [key, m] of Object.entries(motion)) {
    const from = typeof layer[key] === "number" ? (layer[key] as number) : 0;
    const cycles = Math.max(1, Math.round(m.cycles ?? 1));
    const k = waveAt(m.wave ?? "sin", cycles * tt + (m.phase ?? 0));
    out[key] = from + (m.to - from) * k;
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
  for (const key of STYLE_FIELDS) {
    const v = slide[key];
    if (v !== undefined) (style as Record<string, unknown>)[key] = v;
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
export function randomSlide(rand: () => number = Math.random): SlideStyle {
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

    /* Half of them get a number that travels. Never `speed`, which also
       sets how fast the colours move. */
    if (rand() < 0.5) {
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

        /* Travelling parameters. Only the documented ones survive, and the
           cycle count is forced to a whole number here rather than trusted
           — a fractional one is the one way a spec could hand back a post
           that doesn't loop. */
        const raw = merged.motion as MotionMap | undefined;
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          const keys = new Set(animatable(type).map((c) => c.key));
          const motion: MotionMap = {};
          for (const [key, m] of Object.entries(raw)) {
            if (!keys.has(key) || !m || typeof m.to !== "number") continue;
            motion[key] = {
              to: m.to,
              wave: WAVES.includes(m.wave as Wave) ? m.wave : "sin",
              cycles: Math.min(8, Math.max(1, Math.round(Number(m.cycles) || 1))),
              phase: Math.min(1, Math.max(0, Number(m.phase) || 0)),
            };
          }
          if (Object.keys(motion).length) merged.motion = motion;
          else delete merged.motion;
        } else {
          delete merged.motion;
        }
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
          layers: [{ ...defaultLayer("dithering"), shape: "wave", speed: 0.3 }],
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
          layers: [{ ...defaultLayer("forms"), pattern: "rings", warp: 0.3 }],
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
          layers: [{ ...defaultLayer("dithering"), shape: "swirl", speed: 0.4 }],
        }),
        defaultSlide({
          kicker: "01 — practice over tutorials",
          title: "Watching is not\nthe same as learning.",
          body: "Short, bounded exercises beat one more tutorial every time.",
          letter: "1",
          veil: 0.5,
          layers: [{ ...defaultLayer("dithering"), shape: "simplex" }],
        }),
        defaultSlide({
          kicker: "02 — fundamentals over tools",
          title: "Tools are exhausting.\nFoundations are permanent.",
          body: "Easing, timing, contrast, hierarchy.",
          letter: "2",
          veil: 0.5,
          layers: [{ ...defaultLayer("forms"), pattern: "ramp", warp: 0.25 }],
        }),
        defaultSlide({
          kicker: "03 — small and consistent",
          title: "The work no one sees\nshapes your skill.",
          body: "The gym metaphor: short sessions, no pressure for perfection.",
          letter: "3",
          veil: 0.45,
          layers: [{ ...defaultLayer("dithering"), shape: "ripple", speed: 0.35 }],
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
          veil: 0.3,
          layers: [{ ...defaultLayer("dithering"), shape: "sphere", speed: 0.5 }],
        }),
      ],
    },
  },
  {
    name: "Type",
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
            { ...defaultLayer("forms"), pattern: "letter", word: "M", warp: 0.35 },
            {
              ...defaultLayer("dithering"),
              shape: "simplex",
              size: 2,
              blend: "multiply",
              opacity: 0.5,
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
            },
          ],
        }),
      ],
    },
  },
];

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
