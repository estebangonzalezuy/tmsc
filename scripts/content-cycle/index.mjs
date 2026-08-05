// the tMSC content cycle, as a program.
//
// Same jobs the chat-bound routines ran, moved onto GitHub Actions so they
// survive any single conversation. State lives entirely in Notion, so every
// job is safe to run twice: it re-reads the pipeline, does whatever the
// statuses ask for, and stops.
//
//   node index.mjs now          every `Chosen` row → draft + visual, one pass
//   node index.mjs journal      every "Make post" capture → a finished post
//   node index.mjs queue        journal + drafts + visuals + library (the poll)
//   node index.mjs angles       propose three new angles (weekly)
//   node index.mjs objectives   roll the month over (1st, no model call)
//   node index.mjs all          everything
//   node index.mjs queue --dry-run     read-only, prints what it would do
//
// Costs nothing when there's nothing to do: the polls are Notion reads, and
// the Claude API is only touched once a row is actually waiting.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Notion, get, put } from "./notion.mjs";
import * as ai from "./claude.mjs";
import {
  assembleSpec,
  briefSchema,
  fetchVocabulary,
  formatFromRow,
  postLink,
  randomLayer,
} from "./postspec.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const DB = {
  pipeline: process.env.NOTION_PIPELINE ?? "de912cbf-c9df-440c-8a17-c1ef8a9c1d1d",
  library: process.env.NOTION_LIBRARY ?? "59421a28-6325-466b-848e-f59b8bcf0986",
  objectives:
    process.env.NOTION_OBJECTIVES ?? "e57499ed-1671-4267-876b-5b9247aef1f3",
  journal: process.env.NOTION_JOURNAL ?? "90f76b2d-065b-4fe4-a3f6-3b2da5c9f727",
};
const ORIGIN = process.env.SITE_ORIGIN ?? "https://themotionsocialclub.vercel.app";
const PILLARS = ["Structure", "Criticism", "Honesty"];
/** Enough angles waiting means the bottleneck is decisions, not ideas. */
const ANGLE_BACKLOG = 6;

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const jobs = args.filter((a) => !a.startsWith("--"));

const notes = [];
const say = (line) => {
  notes.push(line);
  console.log(line);
};

const site = JSON.parse(
  readFileSync(resolve(HERE, "../../content/site.json"), "utf8"),
);
const voice = ai.voiceBrief(site);

if (!process.env.NOTION_TOKEN) {
  console.error(
    "NOTION_TOKEN is missing. Create an internal integration at\n" +
      "notion.so/my-integrations, share the three tMSC databases with it,\n" +
      "and put the secret in the repo's Actions secrets (or your shell).",
  );
  process.exit(2);
}
const notion = new Notion(process.env.NOTION_TOKEN);

const today = () => new Date().toISOString().slice(0, 10);

/** The Objectives row the angles should aim at. */
async function activeObjective() {
  const rows = await notion.byStatus(DB.objectives, "Active");
  const month = rows.find((r) => get.select(r, "Period") === "month") ?? rows[0];
  return month
    ? { id: month.id, name: get.title(month), goal: get.text(month, "Goal") }
    : null;
}

/* ------------------------------------------------------------- angles --- */

async function jobAngles() {
  const waiting = await notion.byStatus(DB.pipeline, "Angle");
  if (waiting.length >= ANGLE_BACKLOG) {
    say(`angles: skipped — ${waiting.length} already waiting`);
    return;
  }

  const libraryRows = await notion.query(DB.library);
  const library = libraryRows
    .map((r) => ({
      id: r.id,
      name: get.title(r),
      date: get.date(r, "Date"),
      channel: get.select(r, "Channel"),
      pillar: get.select(r, "Pillar"),
      landed: get.text(r, "How it landed"),
    }))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const objective = await activeObjective();
  const { angles } = await ai.proposeAngles({
    voice,
    library,
    objective,
    pillars: PILLARS,
    existing: waiting.map((r) => get.title(r)),
  });

  for (const a of angles.slice(0, 3)) {
    /* Sources come back as indices into the numbered list we sent, so a
       paraphrased title can't silently drop the reference. */
    const cited = (a.sources ?? [])
      .map((i) => library[i])
      .filter(Boolean)
      .slice(0, 2);

    /* The relation is clickable in Notion; the sentence is readable at a
       glance in the Angle itself, without opening anything. */
    const angleText = cited.length
      ? `${a.angle}\n\nBuilds on: ${cited.map((c) => `"${c.name}"`).join(" + ")}` +
        (a.builds_on ? ` — ${a.builds_on}` : "")
      : a.angle;

    const trail = cited.length
      ? ` ← ${cited.map((c) => c.name).join(" + ")}`
      : " ← (no source)";

    if (DRY) {
      say(`angles: would create "${a.name}" (${a.pillar})${trail}`);
      continue;
    }
    await notion.createPage(DB.pipeline, {
      Name: put.title(a.name),
      Angle: put.text(angleText),
      Pillar: put.select(PILLARS.includes(a.pillar) ? a.pillar : null),
      Status: put.select("Angle"),
      Objective: put.relation(objective ? [objective.id] : []),
      Source: put.relation(cited.map((c) => c.id)),
    });
    say(`angles: + ${a.name} (${a.pillar})${trail}`);
  }
}

/* ---------------------------------------------------- draft + visual --- */

/* The two pieces of work, separated from the schedules that call them, so
   the same code serves the patient path (one status at a time) and the
   impatient one (everything for a row in a single run). */

const draftFor = async (row, objective) =>
  (
    await ai.writeDraft({
      voice,
      objective,
      row: {
        name: get.title(row),
        pillar: get.select(row, "Pillar"),
        angle: get.text(row, "Angle"),
        notes: get.text(row, "Notes"),
      },
    })
  ).draft;

async function visualFor(row, vocab, schema, draft) {
  const rowFormat = get.select(row, "Format");
  const brief = await ai.designPost({
    voice,
    vocab,
    schema,
    row: {
      name: get.title(row),
      angle: get.text(row, "Angle"),
      copy: get.text(row, "Copy"),
      draft: draft ?? get.text(row, "LinkedIn draft"),
      notes: get.text(row, "Notes"),
      format: rowFormat,
    },
  });
  const spec = assembleSpec(brief, vocab, {
    format: formatFromRow(rowFormat, vocab),
  });
  return { spec, link: postLink(ORIGIN, spec), note: brief.note ?? "" };
}

async function jobDrafts() {
  const rows = await notion.byStatus(DB.pipeline, "Chosen");
  if (!rows.length) return;
  const objective = await activeObjective();

  for (const row of rows) {
    const name = get.title(row);
    const draft = await draftFor(row, objective);
    if (DRY) {
      say(`drafts: would draft "${name}" (${draft.length} chars)`);
      continue;
    }
    await notion.updatePage(row.id, {
      "LinkedIn draft": put.text(draft),
      Status: put.select("Drafted"),
    });
    say(`drafts: ✓ ${name}`);
  }
}

async function jobVisuals() {
  const rows = await notion.byStatus(DB.pipeline, "Ready");
  if (!rows.length) return;

  const vocab = await fetchVocabulary(ORIGIN);
  const schema = briefSchema(vocab);

  for (const row of rows) {
    const name = get.title(row);
    const { spec, link, note } = await visualFor(row, vocab, schema);
    if (DRY) {
      say(`visuals: would generate "${name}" — ${note}`);
      say(`  ${link}`);
      continue;
    }
    await notion.updatePage(row.id, {
      "Post link": put.url(link),
      Status: put.select("Generated"),
    });
    say(`visuals: ✓ ${name} — ${spec.slides.length} slide(s), ${spec.format}`);
  }
}

/* ---------------------------------------------------------------- now --- */

/* For sitting down to make a post: takes every row you've marked `Chosen`
   all the way to `Generated` in one pass — draft and visual, both model
   calls back to back, no waiting for a second poll. The review gate between
   them is the whole point of the slow path, so this is a separate job you
   ask for, never something a schedule does on its own. */
async function jobNow() {
  const rows = await notion.byStatus(DB.pipeline, "Chosen");
  if (!rows.length) {
    say("now: nothing marked Chosen");
    return;
  }
  const objective = await activeObjective();
  const vocab = await fetchVocabulary(ORIGIN);
  const schema = briefSchema(vocab);

  for (const row of rows) {
    const name = get.title(row);
    /* Keep a draft you've already written or edited; only write a missing one. */
    const existing = get.text(row, "LinkedIn draft");
    const draft = existing || (await draftFor(row, objective));
    const { spec, link } = await visualFor(row, vocab, schema, draft);

    if (DRY) {
      say(`now: would finish "${name}" — draft ${draft.length} chars, ${spec.format}`);
      say(`  ${link}`);
      continue;
    }
    await notion.updatePage(row.id, {
      "LinkedIn draft": put.text(draft),
      "Post link": put.url(link),
      Status: put.select("Generated"),
    });
    say(`now: ✓ ${name} — draft + ${spec.format} visual ready`);
  }
}

/* ------------------------------------------------------------ journal --- */

/* Capture → finished post, in one pass. Write or dictate a thought into the
   Journal, flip it to "Make post", and this builds the Pipeline row, the
   draft and the visual, then links the two rows together.

   The visual defaults to a pure generative background — no words on the
   image — and picks its own shader at random, which costs nothing since
   there is no art direction to do. Tick "Text on visual" to put the
   headline on it instead. */
async function jobJournal() {
  const rows = await notion.byStatus(DB.journal, "Make post");
  if (!rows.length) return;

  const objective = await activeObjective();
  const vocab = await fetchVocabulary(ORIGIN);
  const libraryRows = await notion.query(DB.library);
  const library = libraryRows.map((r) => ({
    id: r.id,
    name: get.title(r),
    date: get.date(r, "Date"),
    pillar: get.select(r, "Pillar"),
  }));

  for (const row of rows) {
    /* The thought may be in the Entry property, in the page body, or both —
       whichever was closer to hand at the time. */
    const entry = [
      get.title(row),
      get.text(row, "Entry"),
      await notion.blockText(row.id),
    ]
      .filter(Boolean)
      .join("\n");

    if (entry.trim().length < 10) {
      say(`journal: skipped an empty entry`);
      continue;
    }

    const withText = row.properties?.["Text on visual"]?.checkbox === true;
    const out = await ai.readJournal({
      voice,
      entry,
      library,
      objective,
      pillars: PILLARS,
      formats: vocab.formats,
    });

    const cited = (out.sources ?? []).map((i) => library[i]).filter(Boolean).slice(0, 2);
    const angleText = cited.length
      ? `${out.angle}\n\nBuilds on: ${cited.map((c) => `"${c.name}"`).join(" + ")}` +
        (out.builds_on ? ` — ${out.builds_on}` : "")
      : out.angle;

    const spec = assembleSpec(
      { slides: [out.onimage], background: randomLayer(vocab) },
      vocab,
      { format: out.format, text: withText },
    );
    const link = postLink(ORIGIN, spec);

    if (DRY) {
      say(`journal: would post "${out.name}" (${out.pillar}, ${spec.format}, ${withText ? "with text" : "no text"})`);
      say(`  ${link}`);
      continue;
    }

    const page = await notion.createPage(DB.pipeline, {
      Name: put.title(out.name),
      Angle: put.text(angleText),
      Pillar: put.select(PILLARS.includes(out.pillar) ? out.pillar : null),
      Status: put.select("Generated"),
      "LinkedIn draft": put.text(out.draft),
      "Post link": put.url(link),
      Format: put.select(vocab.formats.includes(out.format) ? out.format : null),
      Objective: put.relation(objective ? [objective.id] : []),
      Source: put.relation(cited.map((c) => c.id)),
    });

    await notion.updatePage(row.id, {
      Status: put.select("Used"),
      Post: put.relation([page.id]),
    });
    say(`journal: ✓ ${out.name} — draft + ${spec.format} visual${withText ? "" : " (no text)"}`);
  }
}

/* ------------------------------------------------------------ library --- */

/* Closing the loop: a Posted row becomes a library entry, so the next round
   of angles can see it. Deduped by title, which makes reruns harmless. */
async function jobLibrary() {
  const posted = await notion.byStatus(DB.pipeline, "Posted");
  if (!posted.length) return;

  const known = new Set(
    (await notion.query(DB.library)).map((r) => get.title(r).toLowerCase()),
  );

  for (const row of posted) {
    const name = get.title(row);
    if (!name || known.has(name.toLowerCase())) continue;
    if (DRY) {
      say(`library: would file "${name}"`);
      continue;
    }
    await notion.createPage(DB.library, {
      Name: put.title(name),
      Channel: put.select("LinkedIn"),
      Date: put.date(get.date(row, "Schedule") || today()),
      Pillar: put.select(get.select(row, "Pillar") || null),
    });
    say(`library: + ${name}`);
  }
}

/* --------------------------------------------------------- objectives --- */

/* Pure bookkeeping — no model call. Runs on the 1st, but is written as
   "is there an Active row for the current period?", so a missed run
   self-heals on the next one. */
async function jobObjectives() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-11
  const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const monthName = now.toLocaleString("en-US", { month: "long", timeZone: "UTC" });

  const wanted = [{ period: "month", name: `${monthName} ${y}`, start }];
  if (m % 3 === 0)
    wanted.push({ period: "quarter", name: `Q${m / 3 + 1} ${y}`, start });
  if (m % 6 === 0)
    wanted.push({ period: "semester", name: `H${m / 6 + 1} ${y}`, start });

  const rows = await notion.query(DB.objectives);
  for (const w of wanted) {
    const existing = rows.filter((r) => get.select(r, "Period") === w.period);
    if (existing.some((r) => get.date(r, "Start") === w.start)) continue;

    for (const stale of existing.filter((r) => get.select(r, "Status") === "Active")) {
      if (DRY) say(`objectives: would retire "${get.title(stale)}"`);
      else await notion.updatePage(stale.id, { Status: put.select("Past") });
    }
    if (DRY) {
      say(`objectives: would open "${w.name}"`);
      continue;
    }
    await notion.createPage(DB.objectives, {
      Name: put.title(w.name),
      Period: put.select(w.period),
      Start: put.date(w.start),
      Status: put.select("Active"),
    });
    say(`objectives: + ${w.name} — fill in the Goal`);
  }
}

/* ---------------------------------------------------------------- run --- */

const ALL = {
  angles: jobAngles,
  drafts: jobDrafts,
  visuals: jobVisuals,
  now: jobNow,
  journal: jobJournal,
  library: jobLibrary,
  objectives: jobObjectives,
};
const GROUPS = {
  queue: ["journal", "drafts", "visuals", "library"],
  weekly: ["journal", "drafts", "visuals", "library", "angles"],
  all: Object.keys(ALL),
};

const requested = (jobs.length ? jobs : ["queue"]).flatMap(
  (j) => GROUPS[j] ?? [j],
);

let failed = false;
for (const name of [...new Set(requested)]) {
  const job = ALL[name];
  if (!job) {
    console.error(`unknown job: ${name}`);
    failed = true;
    continue;
  }
  try {
    await job();
  } catch (err) {
    failed = true;
    say(`${name}: failed — ${err.message}`);
  }
}

if (!notes.length) say("nothing to do");

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### content cycle — ${requested.join(", ")}${DRY ? " (dry run)" : ""}\n\n` +
      notes.map((n) => `- ${n}`).join("\n") +
      "\n",
  );
}

process.exit(failed ? 1 : 0);
