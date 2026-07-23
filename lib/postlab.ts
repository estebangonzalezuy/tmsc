// the Post Lab — spec model shared by the tool UI, the exporter, and the
// /api/postlab/schema endpoint that lets Claude generate posts from a prompt.
//
// A PostSpec fully describes a post/carousel/reel: format, slides, and the
// animated shader behind each slide. Specs travel as base64url JSON in the
// URL hash (/postlab#spec=...), so anything that can build JSON — including
// a Claude conversation reading a Notion doc — can deep-link a ready post.

export const SPEC_VERSION = 3;

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
  /** Master switch for the typographic layer (kicker, title, body, footer,
      letter, ring). Off = pure background; the veil still applies. */
  text: boolean;
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

/* Shapes the shader doesn't have, rendered grayscale on canvas 2D and pushed
   through a Bayer ordered dither — same pixel language, new vocabulary.
   All loop seamlessly over the post duration; `warp` bends the source
   through a flow field before dithering. */
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
  ],
  choices: [
    {
      key: "pattern",
      label: "pattern",
      values: ["rings", "ramp", "bars", "letter"],
      def: "rings",
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
    text: true,
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
        return { ...defaultLayer(type), ...mapped, type };
      });
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
