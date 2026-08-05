// PostSpec assembly, without duplicating lib/postlab.ts.
//
// The deployed site already publishes a machine-readable description of the
// spec at /api/postlab/schema. This module fetches it and derives the whole
// vocabulary from it — formats, fonts, shader types, every parameter and its
// range. So when the Post Lab grows a shape, the automation learns it on the
// next run; there is no second copy of the registry to keep in sync.
//
// The model is only asked for the *design brief* (a small, flat object of
// creative choices). This code turns that into a real PostSpec, validating
// every value against the fetched vocabulary. A hallucinated shape name
// falls back to the documented default instead of producing a broken link.

export async function fetchVocabulary(origin) {
  const res = await fetch(`${origin}/api/postlab/schema`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Post Lab schema → ${res.status}`);
  const doc = await res.json();

  const fields = doc.spec?.slides?.fields ?? {};
  /* Enum values are written as quoted tokens in the field prose:
     "'left' | 'center'", "'s' | 'm' | 'l'", "'serif' (Lora) | 'sans' (…)". */
  const quoted = (desc, fallback) => {
    const found = [...String(desc ?? "").matchAll(/'([a-z0-9]+)'/g)].map(
      (m) => m[1],
    );
    return found.length ? [...new Set(found)] : fallback;
  };

  const backgrounds = {};
  for (const s of doc.spec?.shaders ?? []) {
    if (s.type === "none") continue;
    const params = {};
    for (const [key, desc] of Object.entries(s.params ?? {})) {
      const choice = /^one of (.+?) \(default (.+)\)$/.exec(desc);
      if (choice) {
        params[key] = {
          kind: "choice",
          values: choice[1].split("|").map((v) => v.trim()),
          def: choice[2].trim(),
        };
        continue;
      }
      const range = /^number ([\d.]+)-([\d.]+) \(default ([\d.]+)\)$/.exec(desc);
      if (range) {
        params[key] = {
          kind: "number",
          min: Number(range[1]),
          max: Number(range[2]),
          def: Number(range[3]),
        };
      }
    }
    backgrounds[s.type] = params;
  }

  return {
    version: doc.version ?? 4,
    guidance: doc.writing_guidance ?? [],
    formats: Object.keys(doc.spec?.format?.options ?? {}),
    formatHints: doc.spec?.format?.options ?? {},
    themes: quoted(fields.theme, ["light", "dark"]),
    titleFonts: quoted(fields.titleFont, ["serif", "sans", "gothic"]),
    titleSizes: quoted(fields.titleSize, ["s", "m", "l"]),
    aligns: quoted(fields.align, ["left", "center"]),
    backgrounds,
  };
}

/** JSON schema for the design brief we ask Claude for. Closed and flat: no
    conditionals, which structured outputs don't support. Parameters that
    don't belong to the chosen background are simply dropped on assembly. */
export function briefSchema(vocab) {
  const paramProps = {};
  for (const params of Object.values(vocab.backgrounds)) {
    for (const [key, p] of Object.entries(params)) {
      paramProps[key] =
        p.kind === "choice"
          ? {
              type: "string",
              enum: [...new Set([...(paramProps[key]?.enum ?? []), ...p.values])],
              description: `${key} — only used by some backgrounds`,
            }
          : { type: "number", description: `${key} (${p.min}-${p.max})` };
    }
  }

  return {
    type: "object",
    additionalProperties: false,
    required: [
      "format",
      "duration",
      "theme",
      "titleFont",
      "titleSize",
      "align",
      "italic",
      "boxed",
      "plate",
      "ring",
      "veil",
      "titlePixel",
      "metaPixel",
      "letter",
      "background",
      "slides",
      "note",
    ],
    properties: {
      format: { type: "string", enum: vocab.formats },
      duration: { type: "number", description: "seconds of video, 2-15" },
      theme: { type: "string", enum: vocab.themes },
      titleFont: { type: "string", enum: vocab.titleFonts },
      titleSize: { type: "string", enum: vocab.titleSizes },
      align: { type: "string", enum: vocab.aligns },
      italic: { type: "boolean" },
      boxed: { type: "boolean" },
      plate: { type: "boolean", description: "filled plate behind the headline" },
      ring: { type: "boolean" },
      veil: { type: "number", description: "0-0.9 wash over the background" },
      titlePixel: { type: "number", description: "0 = crisp, else dither cell px" },
      metaPixel: { type: "number", description: "0 = crisp, else dither cell px" },
      letter: { type: "string", description: "one character, or empty to hide" },
      background: {
        type: "object",
        additionalProperties: false,
        required: ["type", ...Object.keys(paramProps)],
        properties: {
          type: { type: "string", enum: Object.keys(vocab.backgrounds) },
          ...paramProps,
        },
      },
      slides: {
        type: "array",
        description: "1 for a post, 2-8 for a carousel",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["kicker", "title", "body", "footer"],
          properties: {
            kicker: { type: "string" },
            title: { type: "string", description: "use \\n for line breaks" },
            body: { type: "string", description: "may be empty" },
            footer: { type: "string" },
          },
        },
      },
      note: { type: "string", description: "one line on why this treatment" },
    },
  };
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const pick = (value, allowed, def) =>
  allowed.includes(value) ? value : def ?? allowed[0];
const numeric = (v, def) => (typeof v === "number" && Number.isFinite(v) ? v : def);

/* A different-looking background every time, drawn from the documented
   vocabulary rather than from the model — there is nothing to art-direct on
   a post with no words on it, so this costs no tokens. Extremes are avoided
   on purpose: a speed of 0 doesn't move and a warp of 1 is mush. */
export function randomLayer(vocab, rand = Math.random) {
  const types = Object.keys(vocab.backgrounds);
  const type = types[Math.floor(rand() * types.length)] ?? "dithering";
  const params = vocab.backgrounds[type] ?? {};
  const layer = { type };
  for (const [key, p] of Object.entries(params)) {
    if (p.kind === "choice") {
      layer[key] = p.values[Math.floor(rand() * p.values.length)];
    } else {
      const lo = p.min + (p.max - p.min) * 0.2;
      const hi = p.min + (p.max - p.min) * 0.8;
      const v = lo + rand() * (hi - lo);
      layer[key] = Math.round(v * 100) / 100;
    }
  }
  return layer;
}

/** Design brief + vocabulary → a PostSpec every value of which is legal. */
export function assembleSpec(brief, vocab, { format, text } = {}) {
  const b = brief ?? {};

  const type = pick(b.background?.type, Object.keys(vocab.backgrounds));
  const params = vocab.backgrounds[type] ?? {};
  const layer = { type };
  for (const [key, p] of Object.entries(params)) {
    const raw = b.background?.[key];
    layer[key] =
      p.kind === "choice"
        ? pick(raw, p.values, p.def)
        : clamp(numeric(raw, p.def), p.min, p.max);
  }

  const slide = {
    letter: String(b.letter ?? "M").slice(0, 1),
    /* false hides the whole typographic layer — a pure background post. */
    text: text ?? true,
    titleFont: pick(b.titleFont, vocab.titleFonts, "serif"),
    italic: !!b.italic,
    titleSize: pick(b.titleSize, vocab.titleSizes, "m"),
    boxed: !!b.boxed,
    plate: !!b.plate,
    align: pick(b.align, vocab.aligns, "left"),
    ring: !!b.ring,
    veil: clamp(numeric(b.veil, 0.25), 0, 0.9),
    titlePixel: clamp(Math.round(numeric(b.titlePixel, 0)), 0, 32),
    metaPixel: clamp(Math.round(numeric(b.metaPixel, 0)), 0, 32),
    theme: pick(b.theme, vocab.themes, "light"),
    layers: [
      {
        opacity: 1,
        blend: "normal",
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
        scale: numeric(layer.scale, 1),
        ...layer,
      },
    ],
  };

  const slides = (Array.isArray(b.slides) && b.slides.length ? b.slides : [{}])
    .slice(0, 10)
    .map((s) => ({
      kicker: String(s.kicker ?? "the Motion Social Club"),
      title: String(s.title ?? ""),
      body: String(s.body ?? ""),
      footer: String(s.footer ?? "@themotionsocialclub"),
      ...slide,
    }));

  return {
    v: vocab.version,
    format: pick(format ?? b.format, vocab.formats, "portrait"),
    duration: clamp(Math.round(numeric(b.duration, 6)), 2, 15),
    slides,
  };
}

export const encodeSpec = (spec) =>
  Buffer.from(JSON.stringify(spec), "utf8").toString("base64url");

export const postLink = (origin, spec) =>
  `${origin}/postlab#spec=${encodeSpec(spec)}`;

/** The Pipeline's Format select doesn't map 1:1 onto the spec's formats. */
export function formatFromRow(rowFormat, vocab) {
  const map = { carousel: "portrait", reel: "story" };
  const wanted = map[rowFormat] ?? rowFormat;
  return vocab.formats.includes(wanted) ? wanted : null; // null = let Claude choose
}
