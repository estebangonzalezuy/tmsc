// The three places this system needs judgment: proposing angles, writing the
// LinkedIn draft, and choosing a visual treatment. Everything else in the
// cycle is deterministic code, so these are the only calls that cost tokens —
// and each is a single request, not an agent loop.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5";

/* Created on first use, so jobs that need no judgment — rolling the month
   over, filing a posted piece — run fine without an API key present. */
let client;
const anthropic = () => {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is missing");
    }
    client = new Anthropic();
  }
  return client;
};

/** One structured request. Returns the parsed object. */
async function ask({ system, prompt, schema, effort = "medium", max = 8000 }) {
  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: max,
    system,
    thinking: { type: "adaptive" },
    output_config: { effort, format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (res.stop_reason === "max_tokens") {
    throw new Error("Claude hit max_tokens — output truncated");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Claude returned unparseable JSON: ${text.slice(0, 400)}`);
  }
}

/** The club's voice, straight from the site's own copy. */
export function voiceBrief(site) {
  const list = (arr, f) => (arr ?? []).map(f).join("\n");
  return [
    `The club: ${site.site?.name ?? "the Motion Social Club"}`,
    site.site?.description ?? "",
    site.site?.positioning ?? "",
    "\nThe three pillars:",
    list(site.pillars, (p) => `- ${p.name}: ${p.text}`),
    "\nRecurring threads:",
    list(site.threads, (t) => `- ${t.name}: ${t.text}`),
    site.quotes?.length ? "\nHouse lines:" : "",
    list(site.quotes, (q) => `- "${typeof q === "string" ? q : q.text}"`),
    "\nVoice: honest, human, anti-hype. Short lines. Lowercase is fine.",
    "No hashtag soup, no engagement bait, no em-dash-heavy AI cadence,",
    "no 'in today's fast-paced world'. Say the true thing plainly.",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------------------------------------------------- angles --- */

const anglesSchema = (pillars) => ({
  type: "object",
  additionalProperties: false,
  required: ["angles"],
  properties: {
    angles: {
      type: "array",
      description: "exactly three",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "angle", "pillar", "sources", "builds_on"],
        properties: {
          name: { type: "string", description: "the working title" },
          angle: {
            type: "string",
            description: "2-3 sentences: the specific take, and why now",
          },
          pillar: { type: "string", enum: pillars },
          sources: {
            type: "array",
            description:
              "the [n] numbers of the library pieces this extends — one, " +
              "or two at most. Empty only if it genuinely extends nothing.",
            items: { type: "integer" },
          },
          builds_on: {
            type: "string",
            description:
              "one sentence: what this takes from those pieces, and what it " +
              "adds that they didn't say. Empty if sources is empty.",
          },
        },
      },
    },
  },
});

export function proposeAngles({ voice, library, objective, pillars, existing }) {
  /* Numbered, so the model can point at a piece by index instead of
     retyping its title — a paraphrased title would silently fail to match
     and the angle would land in Notion with no source attached. */
  const shelf = library
    .map(
      (r, i) =>
        `[${i}] ${r.date || "?"} · ${r.channel || "?"} · ${r.pillar || "—"} · ${r.name}` +
        (r.landed ? ` (landed: ${r.landed})` : ""),
    )
    .join("\n");

  return ask({
    system:
      voice +
      "\n\nYou are proposing what the club should publish next. You are not " +
      "writing the posts, only the angles.",
    effort: "high",
    schema: anglesSchema(pillars),
    prompt: [
      "Everything the club has published, oldest first, numbered so you can",
      "cite a piece by its [n]:",
      shelf || "(nothing yet)",
      "",
      objective
        ? `The active objective (${objective.name}): ${objective.goal || "(not filled in yet)"}`
        : "No active objective is set.",
      "",
      existing.length
        ? `Angles already waiting in the pipeline (don't repeat them):\n${existing.map((e) => `- ${e}`).join("\n")}`
        : "Nothing is waiting in the pipeline.",
      "",
      "Propose exactly three angles for the next posts. Rules:",
      "- Vary them across the three pillars; look at which pillar is thin",
      "  in the library and correct the imbalance.",
      "- Prefer extending a thread that already landed over inventing new",
      "  territory. Cite the piece(s) by [n] in `sources`, and say in",
      "  `builds_on` what you're taking from them and what you're adding.",
      "  Only cite something you'd actually reference — an unrelated number",
      "  is worse than none.",
      "- Each angle must be specific enough that someone could write the",
      "  post from it — a take, not a topic.",
      "- If the objective is filled in, aim all three at it.",
    ].join("\n"),
  });
}

/* -------------------------------------------------------------- draft --- */

const draftSchema = {
  type: "object",
  additionalProperties: false,
  required: ["draft"],
  properties: {
    draft: {
      type: "string",
      description: "the full LinkedIn post, ready to paste, newlines included",
    },
  },
};

export function writeDraft({ voice, row, objective }) {
  return ask({
    system:
      voice +
      "\n\nYou write the club's LinkedIn posts. LinkedIn is the primary " +
      "channel (~26k people). Hook line first, then short paragraphs with " +
      "blank lines between them. No links in the body, no hashtags, no " +
      "call-to-action boilerplate. 120-220 words.",
    effort: "high",
    schema: draftSchema,
    prompt: [
      `Title: ${row.name}`,
      `Pillar: ${row.pillar || "—"}`,
      `The angle: ${row.angle || "(none written — work from the title)"}`,
      row.notes ? `Notes: ${row.notes}` : "",
      objective?.goal ? `This month's objective: ${objective.goal}` : "",
      "",
      "Write the post.",
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

/* ------------------------------------------------------------ journal --- */

/* One call turns a raw capture — typed or dictated, unpunctuated, half a
   thought — into everything a Pipeline row needs. Doing it in one request
   rather than three keeps a journal entry about as cheap as an angle. */

const journalSchema = (pillars, formats) => ({
  type: "object",
  additionalProperties: false,
  required: [
    "name",
    "angle",
    "pillar",
    "sources",
    "builds_on",
    "draft",
    "format",
    "onimage",
  ],
  properties: {
    name: { type: "string", description: "working title for the post" },
    angle: { type: "string", description: "2-3 sentences: the take, and why now" },
    pillar: { type: "string", enum: pillars },
    sources: {
      type: "array",
      description: "[n] of the library pieces this connects to, if any",
      items: { type: "integer" },
    },
    builds_on: { type: "string", description: "one sentence, or empty" },
    draft: { type: "string", description: "the full LinkedIn post" },
    format: { type: "string", enum: formats },
    onimage: {
      type: "object",
      additionalProperties: false,
      required: ["kicker", "title", "body", "footer"],
      description: "words for the image, used only if asked for",
      properties: {
        kicker: { type: "string" },
        title: { type: "string", description: "short; \\n for line breaks" },
        body: { type: "string", description: "may be empty" },
        footer: { type: "string" },
      },
    },
  },
});

export function readJournal({ voice, entry, library, objective, pillars, formats }) {
  const shelf = library
    .map((r, i) => `[${i}] ${r.date || "?"} · ${r.pillar || "—"} · ${r.name}`)
    .join("\n");

  return ask({
    system:
      voice +
      "\n\nEsteban captured a raw thought — typed fast or spoken aloud, so " +
      "expect no punctuation, false starts, and half-finished sentences. " +
      "Find what he actually means and turn it into a post. Keep his words " +
      "and his phrasing wherever they're good; you are editing, not " +
      "replacing. Don't smooth it into something more polished than he is.",
    effort: "high",
    max: 12000,
    schema: journalSchema(pillars, formats),
    prompt: [
      "The capture:",
      entry,
      "",
      "What the club has published, numbered so you can cite by [n]:",
      shelf || "(nothing yet)",
      "",
      objective?.goal ? `This month's objective: ${objective.goal}` : "",
      "",
      "Turn it into a post: a working title, the angle, the pillar it fits,",
      "any library pieces it connects to, and the LinkedIn draft itself.",
      "Also write `onimage` — the few words that would go on the image if",
      "one were used: a short headline, not the whole post.",
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

/* ------------------------------------------------------------- visual --- */

export function designPost({ voice, row, vocab, schema }) {
  return ask({
    system:
      voice +
      "\n\nYou are art-directing a post in the club's Post Lab: a dithering " +
      "instrument. Every background is dithered pixels in two tones — there " +
      "is no color, by design. Choose a treatment and write the on-image " +
      "type, which is much shorter than the caption: a headline and maybe " +
      "one supporting line.\n\n" +
      vocab.guidance.map((g) => `- ${g}`).join("\n"),
    effort: "medium",
    schema,
    prompt: [
      `Title: ${row.name}`,
      row.angle ? `Angle: ${row.angle}` : "",
      row.copy ? `Copy the owner wrote (// means a line break):\n${row.copy}` : "",
      row.draft ? `The LinkedIn draft this accompanies:\n${row.draft}` : "",
      row.notes ? `Art direction notes: ${row.notes}` : "",
      row.format && row.format !== "auto"
        ? `Requested format: ${row.format}`
        : "Format is up to you.",
      "",
      "Design the post. Keep the headline short enough to read at thumbnail",
      "size. Raise `veil` or turn on `plate` if the background is dense.",
      "If the owner's copy is present, use it — don't rewrite it.",
    ]
      .filter(Boolean)
      .join("\n"),
  });
}
