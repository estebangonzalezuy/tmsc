// The three places this system needs judgment: proposing angles, writing the
// LinkedIn draft, and choosing a visual treatment. Everything else in the
// cycle is deterministic code, so these are the only calls that cost tokens —
// and each is a single request, not an agent loop.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const HERE = dirname(fileURLToPath(import.meta.url));
const readDoc = (name) => {
  try {
    return readFileSync(resolve(HERE, "../../docs/voice", name), "utf8");
  } catch {
    return "";
  }
};

/* Esteban's own voice document and a batch of posts he actually published.
   Read from the repo rather than paraphrased here, so editing the source of
   truth changes what comes out — and so nobody has to trust a summary of
   how someone writes. */
const PROFILE = readDoc("PROFILE.md");
const EXAMPLES = readDoc("EXAMPLES.md");

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

/* The rules Esteban states most strongly, repeated at the end of the system
   prompt because the last thing read is the thing best obeyed. Everything
   here is quoted from his profile, not inferred. */
const HARD_RULES = `
Before writing anything, these are absolute:
- Never the "it's not X, it's Y" structure. He rejects this above all else.
- Never these words: unveil, uncover, enhance, realm, breathes, symphony,
  unfolds. Also avoid "value" and "content" as nouns.
- Never em dashes.
- Never inflate a simple idea into something grander than it is.
- Never guru formatting: one sentence per line, each trying to be a mic drop.
- Always the simplest word that does the job. If "use" works, never
  "leverage".
- Write as a colleague suggesting, not a guru instructing. "I suggest",
  not "you need to".
- Small imperfections are welcome. He is not a native English speaker and
  does not polish that away.

Ask yourself before finishing: does this sound like something he would
actually write, or like an AI trying hard to imitate him? If it feels
forced, pull back.`;

/** Who the club is, from its own site, plus how Esteban actually writes. */
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
    PROFILE ? `\n\n--- HOW ESTEBAN WRITES ---\n${PROFILE}` : "",
    HARD_RULES,
  ]
    .filter(Boolean)
    .join("\n");
}

/* Twenty posts he published. Worth the tokens where a draft is being
   written, not where a two-sentence angle is. */
const withExamples = (system) =>
  EXAMPLES
    ? `${system}\n\n--- POSTS HE ACTUALLY PUBLISHED, for rhythm and shape ---\n${EXAMPLES}`
    : system;

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

export function proposeAngles({ voice, library, objective, pillars, existing, inFlight }) {
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
      objective?.goal
        ? `THE OBJECTIVE for ${objective.name}, in his own words:\n"${objective.goal}"\n\nThis is what the next posts are for. Every angle has to move it.`
        : objective
          ? `The objective for ${objective.name} has no goal written yet, so aim at what the library shows is missing instead.`
          : "No active objective is set.",
      "",
      inFlight?.length
        ? `Already written or scheduled this period (don't propose these again, and don't propose the same beat):\n${inFlight.map((r) => `- ${r}`).join("\n")}`
        : "",
      "",
      existing.length
        ? `Angles already waiting in the pipeline (don't repeat them):\n${existing.map((e) => `- ${e}`).join("\n")}`
        : "Nothing is waiting in the pipeline.",
      "",
      "Propose exactly three angles for the next posts. Rules:",
      "- Vary them across the three pillars; look at which pillar is thin",
      "  in the library and correct the imbalance.",
      "- Some pieces carry what they did in the world (landed: impressions,",
      "  interactions, engagement rate). Read it as attention, not as",
      "  quality: a post can reach a hundred thousand people and say",
      "  nothing. What it is good for is telling you which subjects this",
      "  audience turns up for. Prefer extending one of those, and prefer",
      "  the ones with a high engagement rate over the ones with big",
      "  impressions — those are the posts people answered rather than",
      "  scrolled past.",
      "- Prefer extending a thread that already landed over inventing new",
      "  territory. Cite the piece(s) by [n] in `sources`, and say in",
      "  `builds_on` what you're taking from them and what you're adding.",
      "  Only cite something you'd actually reference — an unrelated number",
      "  is worse than none.",
      "- Each angle must be specific enough that someone could write the",
      "  post from it — a take, not a topic.",
      "- If the objective is written, all three angles must serve it, and",
      "  `angle` should say plainly how. Not decoration: if an angle doesn't",
      "  move the objective, it's the wrong angle this month.",
      "- Write the `angle` in his voice, the way he'd say it to a colleague.",
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
    system: withExamples(
      voice +
        "\n\nYou write Esteban's LinkedIn posts, in his voice, as him. " +
        "LinkedIn is the club's primary channel (~26k people). An emoji " +
        "marker then the hook on the first line, then short paragraphs with " +
        "blank lines between them. 100-150 words is the target; 220 is the " +
        "ceiling. No links in the body, no hashtags, no CTA boilerplate. " +
        "Rarely open with 'I' — speak to the reader.",
    ),
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
    .map(
      (r, i) =>
        `[${i}] ${r.date || "?"} · ${r.pillar || "—"} · ${r.name}` +
        (r.landed ? ` (landed: ${r.landed})` : ""),
    )
    .join("\n");

  return ask({
    system: withExamples(
      voice +
      "\n\nEsteban captured a raw thought — typed fast or spoken aloud, so " +
      "expect no punctuation, false starts, and half-finished sentences. " +
      "Find what he actually means and turn it into a post. Keep his words " +
      "and his phrasing wherever they're good; you are editing, not " +
      "replacing. Don't smooth it into something more polished than he is.",
    ),
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

/* ------------------------------------------------------------- review --- */

const reviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["standing", "verdict", "working", "missing", "next"],
  properties: {
    standing: {
      type: "string",
      description:
        "one sentence on where the month is against the objective, said plainly",
    },
    verdict: {
      type: "string",
      enum: ["on track", "slipping", "off track", "too early to tell"],
    },
    working: { type: "string", description: "what's actually going well, or empty" },
    missing: {
      type: "string",
      description: "the gap between what was published and what the goal needs",
    },
    next: {
      type: "string",
      description:
        "the two or three concrete things to do in the rest of the period, as a short list separated by newlines",
    },
  },
};

export function reviewObjective({ voice, objective, published, pipeline, daysIn, daysLeft }) {
  return ask({
    system:
      voice +
      "\n\nYou're looking at how the month is going against what Esteban " +
      "said he wanted, and reporting back to him. Be a colleague reading the " +
      "situation honestly, not a coach. If the month is going badly, say so " +
      "in one plain sentence; if it's fine, don't invent a problem to look " +
      "useful. Judge against the objective he wrote, not against some idea " +
      "of how much one should post.",
    effort: "high",
    schema: reviewSchema,
    prompt: [
      `Objective for ${objective.name}: "${objective.goal}"`,
      `Started ${objective.start}. ${daysIn} days in, ${daysLeft} left.`,
      "",
      published.length
        ? `Published in this period (${published.length}):\n${published.map((p) => `- ${p.date || "?"} · ${p.channel || "?"} · ${p.pillar || "—"} · ${p.name}${p.landed ? ` (landed: ${p.landed})` : ""}`).join("\n")}`
        : "Nothing published in this period yet.",
      "",
      pipeline.length
        ? `In the pipeline right now:\n${pipeline.map((p) => `- [${p.status}] ${p.name}`).join("\n")}`
        : "The pipeline is empty.",
      "",
      "Some pieces carry what they did in the world (landed: impressions,",
      "interactions, engagement rate). That is attention, not quality, and",
      "it is not the objective either — use it to say which subjects the",
      "audience turned up for, and only judge the month against the goal",
      "he wrote.",
      "",
      "Read it and answer the schema. `next` should be things he can do,",
      "not principles he should hold.",
    ].join("\n"),
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
