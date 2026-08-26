// the tMSC content cycle, as a program.
//
// Same jobs the chat-bound routines ran, moved onto GitHub Actions so they
// survive any single conversation. State lives entirely in Notion, so every
// job is safe to run twice: it re-reads the pipeline, does whatever the
// statuses ask for, and stops.
//
//   node index.mjs now          every `Chosen` row → draft + visual, one pass
//   node index.mjs capture --text="…"   a thought typed on the site → a post
//   node index.mjs pull         new entries from the handwritten journal
//   node index.mjs journal      every "Make post" capture → a finished post
//   node index.mjs review       how the month is going against its objective
//   node index.mjs queue        journal + drafts + visuals + library (the poll)
//   node index.mjs angles       propose three new angles (weekly)
//   node index.mjs objectives   roll the month over (no model call; every
//                               run does this first anyway)
//   node index.mjs all          everything
//   node index.mjs queue --dry-run     read-only, prints what it would do
//
// Nothing here runs on a schedule — the Desk starts every run. Costs
// nothing when there's nothing to do: the queries are Notion reads, and the
// Claude API is only touched once a row is actually waiting.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Notion, get, paragraphs, put } from "./notion.mjs";
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

/* Esteban's own journal: an ordinary Notion page with one sub-page per day,
   written by hand and mostly not about the club at all. The `pull` job
   copies what's new into the tMSC Journal so a thought written there can
   become a post without being retyped here. Not a data source — a page. */
const JOURNAL_PAGE =
  process.env.NOTION_JOURNAL_PAGE ?? "2f41c0b2-f62f-8095-ac8f-eb182c9d9997";
const ORIGIN = process.env.SITE_ORIGIN ?? "https://themotionsocialclub.vercel.app";
const PILLARS = ["Structure", "Criticism", "Honesty"];
/** Enough angles waiting means the bottleneck is decisions, not ideas. */
const ANGLE_BACKLOG = 6;

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const jobs = args.filter((a) => !a.startsWith("--"));

/* What someone typed into the box on the Desk, on its way to becoming a post.
   It arrives in the environment rather than on the command line because it is
   arbitrary text from a browser: interpolated into a shell line it would be a
   script injection, and quoting it correctly for every apostrophe and newline
   someone might write is not a thing to get right twice. `--text=` is here for
   running the job by hand. */
const CAPTURE =
  process.env.CAPTURE_TEXT ??
  args.find((a) => a.startsWith("--text="))?.slice("--text=".length) ??
  "";
const CAPTURE_ON_IMAGE = /^(1|true|yes|on)$/i.test(
  process.env.CAPTURE_ON_IMAGE ?? (args.includes("--on-image") ? "1" : ""),
);

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
    ? {
        id: month.id,
        name: get.title(month),
        goal: get.text(month, "Goal"),
        start: get.date(month, "Start"),
      }
    : null;
}

/* ------------------------------------------------------------- angles --- */

/* Every job here says what it looked for even when it found nothing. A run
   that does nothing and prints nothing is indistinguishable from a run that
   never started — which is exactly the confusion worth spending four lines
   to avoid. */
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
  /* Everything already moving, so a "new" angle isn't last week's post
     wearing a different hat. */
  const busy = (await notion.query(DB.pipeline)).filter((r) =>
    ["Chosen", "Drafted", "Ready", "Generated", "Scheduled"].includes(
      get.select(r, "Status"),
    ),
  );
  const { angles } = await ai.proposeAngles({
    voice,
    library,
    objective,
    pillars: PILLARS,
    existing: waiting.map((r) => get.title(r)),
    inFlight: busy.map((r) => get.title(r)),
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
  const withText = row.properties?.["Text on visual"]?.checkbox === true;

  /* No words on the image means nothing to art-direct, so this path skips
     the model entirely: a random dithered-forms background in the club
     palette, same as the Journal produces. Free, and different every time. */
  if (!withText) {
    const spec = assembleSpec(
      { slides: [{ kicker: "", title: "", body: "", footer: "" }],
        background: randomLayer(vocab, Math.random, "forms") },
      vocab,
      {
        format: formatFromRow(rowFormat, vocab) ?? "portrait",
        text: false,
        color: true,
        colorSeed: Math.floor(Math.random() * 9999) + 1,
      },
    );
    const { link, dropped } = postLink(ORIGIN, spec, vocab);
    return { spec, link, dropped, note: "no text, club palette" };
  }

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
    /* Words on the image get the palette too — the model picks veil and
       plate, which is what keeps them readable over it. */
    color: true,
    colorSeed: Math.floor(Math.random() * 9999) + 1,
  });
  const { link, dropped } = postLink(ORIGIN, spec, vocab);
  return { spec, link, dropped, note: brief.note ?? "" };
}

async function jobDrafts() {
  const rows = await notion.byStatus(DB.pipeline, "Chosen");
  if (!rows.length) {
    say("drafts: nothing marked Chosen in the Pipeline");
    return;
  }
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
  if (!rows.length) {
    say("visuals: nothing marked Ready in the Pipeline");
    return;
  }

  const vocab = await fetchVocabulary(ORIGIN);
  const schema = briefSchema(vocab);

  for (const row of rows) {
    const name = get.title(row);
    const { spec, link, note, dropped } = await visualFor(row, vocab, schema);
    if (dropped) {
      say(`visuals: "${name}" — dropped ${dropped} slide(s); the link hit Notion's 2000-character limit`);
    }
    if (DRY) {
      say(`visuals: would generate "${name}" — ${note}`);
      say(`  ${link}`);
      continue;
    }
    await notion.updatePage(row.id, {
      "Post link": put.url(link),
      Status: put.select("Generated"),
    });
    say(
      `visuals: ✓ ${name} — ${spec.slides.length} slide(s), ${spec.format}` +
        (spec.slides[0].text ? "" : ", no text"),
    );
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
    const { spec, link, dropped } = await visualFor(row, vocab, schema, draft);
    if (dropped) {
      say(`now: "${name}" — dropped ${dropped} slide(s); the link hit Notion's 2000-character limit`);
    }

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
    say(
      `now: ✓ ${name} — draft + ${spec.format} visual` +
        (spec.slides[0].text ? "" : " (no text, club palette)"),
    );
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
/* ---------------------------------------------------------------- pull --- */

/* Bring what's new in the handwritten journal across into the tMSC Journal.
 *
 * Everything lands as `Captured`, never as `Make post`. Most of what gets
 * written in a journal is a day, not an idea — the beach, the shopping, who
 * went where — and the club has no business turning that into a LinkedIn
 * post because a script found it. Choosing which thought is worth saying
 * out loud is the one part of this that stays a person's job.
 *
 * Deduplicated on the source page's URL, so this can be run as often as you
 * like and only ever adds what wasn't there.
 */
async function jobPull() {
  let pages;
  try {
    pages = await notion.childPages(JOURNAL_PAGE);
  } catch (err) {
    /* By far the likeliest cause, and unguessable from Notion's 404. */
    say(
      `pull: can't read the journal page — open it in Notion, ··· → Connections, ` +
        `and add the tMSC integration. (${err instanceof Error ? err.message.slice(0, 120) : err})`,
    );
    return;
  }
  if (!pages.length) {
    say("pull: the journal has no entries yet");
    return;
  }

  const already = new Set(
    (await notion.query(DB.journal)).map((r) => get.url(r, "Source")).filter(Boolean),
  );
  const fresh = pages.filter((p) => !already.has(p.url));
  if (!fresh.length) {
    say(`pull: nothing new — all ${pages.length} entries are already here`);
    return;
  }

  let made = 0;
  for (const page of fresh) {
    const body = (await notion.blockText(page.id)).trim();
    if (body.length < 10) {
      say(`pull: skipped "${page.title}" — nothing written in it yet`);
      continue;
    }
    /* The titles are dates, so on their own they're unreadable as a list.
       The first words of the entry are what tell you which day it was. */
    const opening = body.replace(/\s+/g, " ").slice(0, 70).trim();
    const name = page.title ? `${page.title} — ${opening}` : opening;

    if (DRY) {
      say(`pull: would add "${name.slice(0, 60)}…"`);
      made++;
      continue;
    }
    await notion.createPage(
      DB.journal,
      {
        Name: put.title(name),
        /* An excerpt in the property so the row reads at a glance; the whole
           thing in the body, where it can't hit the property's cap. */
        Entry: put.text(body.slice(0, 1800)),
        Status: put.select("Captured"),
        Date: put.date((page.created || today()).slice(0, 10)),
        Source: put.url(page.url),
      },
      paragraphs(body),
    );
    made++;
  }
  say(
    `pull: ${made} new ${made === 1 ? "entry" : "entries"} from the journal, ` +
      `all Captured — tick "Make post" on the ones worth saying out loud`,
  );
}

/* ------------------------------------------------------------ capture --- */

/* The other door into the Journal: text typed into the box on the Desk rather
   than into Notion. It files the thought as an ordinary capture and then runs
   the journal job in the same pass, so one press goes from a sentence to a
   finished Pipeline row — the whole point of typing it on the site instead.

   It deliberately owns no writing of its own. Everything that makes a post out
   of a thought already lives in `jobJournal`, and a second path through the
   model would be a second voice to keep in tune. */
async function jobCapture() {
  const text = CAPTURE.trim();
  if (text.length < 10) {
    say("capture: nothing written — type a thought in the box first");
    return;
  }

  /* The row has to read as something in a list of rows, and a whole paragraph
     doesn't. The opening words are what identify a thought, the same way they
     do for an entry pulled out of the handwritten journal. */
  const flat = text.replace(/\s+/g, " ").trim();
  const opening = flat.slice(0, 70).trim();
  /* Only trail off when there is actually more of it. */
  const shown = opening + (flat.length > opening.length ? "…" : "");

  if (DRY) {
    say(`capture: would file "${shown}"${CAPTURE_ON_IMAGE ? " (text on visual)" : ""}`);
    return;
  }

  await notion.createPage(
    DB.journal,
    {
      Name: put.title(opening),
      Entry: put.text(text.slice(0, 1800)),
      /* Straight to "Make post": someone typed this into a box whose button
         says make me a post. `pull` files as "Captured" because a script found
         those entries and nobody asked for them. */
      Status: put.select("Make post"),
      Date: put.date(today()),
      "Text on visual": put.checkbox(CAPTURE_ON_IMAGE),
    },
    paragraphs(text),
  );
  say(`capture: filed "${shown}"`);

  /* Same run, same minute. Anything else already waiting in the Journal gets
     finished too, which is the behaviour you'd want anyway. */
  await jobJournal();
}

async function jobJournal() {
  const rows = await notion.byStatus(DB.journal, "Make post");
  if (!rows.length) {
    say('journal: nothing marked "Make post" in the Journal — tick it on an entry worth saying out loud');
    return;
  }

  const objective = await activeObjective();
  const vocab = await fetchVocabulary(ORIGIN);
  const libraryRows = await notion.query(DB.library);
  const library = libraryRows.map((r) => ({
    id: r.id,
    name: get.title(r),
    date: get.date(r, "Date"),
    pillar: get.select(r, "Pillar"),
    landed: get.text(r, "How it landed"),
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
      { slides: [out.onimage], background: randomLayer(vocab, Math.random, "forms") },
      vocab,
      {
        format: out.format,
        text: withText,
        /* Journal posts come out in the club palette. A fresh seed each time
           is what keeps two posts from looking like the same picture. */
        color: true,
        colorSeed: Math.floor(Math.random() * 9999) + 1,
      },
    );
    const { link } = postLink(ORIGIN, spec, vocab);

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
    const bg = spec.slides[0].layers[0];
    say(
      `journal: ✓ ${out.name} — draft + ${spec.format} visual, ${bg.pattern}` +
        (withText ? "" : ", no text"),
    );
  }
}

/* ------------------------------------------------------------- review --- */

/* How the month is going against what the owner said he wanted. Reads the
   objective, what actually got published inside the period, and what's in
   flight; writes the reading back onto the objective row so it sits next to
   the goal it's judging. */
async function jobReview() {
  const objective = await activeObjective();
  if (!objective) {
    say("review: no active objective to review");
    return;
  }
  if (!objective.goal.trim()) {
    say(`review: "${objective.name}" has no Goal written — nothing to judge against`);
    return;
  }

  const start = objective.start || `${today().slice(0, 7)}-01`;
  const now = new Date();
  const startDate = new Date(`${start}T00:00:00Z`);
  const daysIn = Math.max(0, Math.round((now - startDate) / 86400000));
  const end = new Date(startDate);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const daysLeft = Math.max(0, Math.round((end - now) / 86400000));

  const published = (await notion.query(DB.library))
    .map((r) => ({
      name: get.title(r),
      date: get.date(r, "Date"),
      channel: get.select(r, "Channel"),
      pillar: get.select(r, "Pillar"),
      landed: get.text(r, "How it landed"),
    }))
    .filter((r) => r.date >= start)
    .sort((a, b) => a.date.localeCompare(b.date));

  const pipeline = (await notion.query(DB.pipeline))
    .map((r) => ({ name: get.title(r), status: get.select(r, "Status") }))
    .filter((r) => r.status && r.status !== "Posted");

  const out = await ai.reviewObjective({
    voice,
    objective: { ...objective, start },
    published,
    pipeline,
    daysIn,
    daysLeft,
  });

  const body = [
    out.standing,
    out.working ? `\nWorking: ${out.working}` : "",
    out.missing ? `\nMissing: ${out.missing}` : "",
    out.next ? `\nNext:\n${out.next}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (DRY) {
    say(`review: ${objective.name} — ${out.verdict}`);
    say(`  ${out.standing}`);
    return;
  }
  await notion.updatePage(objective.id, {
    Review: put.text(body),
    Standing: put.select(out.verdict),
    Reviewed: put.date(today()),
  });
  say(
    `review: ${objective.name} — ${out.verdict}, ${published.length} published, ` +
      `${daysLeft} days left`,
  );
  say(`  ${out.standing}`);
}

/* ------------------------------------------------------------ library --- */

/* Closing the loop: a Posted row becomes a library entry, so the next round
   of angles can see it. Deduped by title, which makes reruns harmless. */
async function jobLibrary() {
  const posted = await notion.byStatus(DB.pipeline, "Posted");
  if (!posted.length) {
    say("library: nothing marked Posted to file away");
    return;
  }

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
  capture: jobCapture,
  pull: jobPull,
  angles: jobAngles,
  drafts: jobDrafts,
  visuals: jobVisuals,
  now: jobNow,
  journal: jobJournal,
  review: jobReview,
  library: jobLibrary,
  objectives: jobObjectives,
};
const GROUPS = {
  /* `pull` leads: a thought written in the journal this morning should be
     in the queue before anything else looks at the queue. */
  queue: ["pull", "journal", "drafts", "visuals", "library"],
  weekly: ["pull", "journal", "drafts", "visuals", "library", "angles"],
  all: Object.keys(ALL),
};

/* Rolling the month over costs one Notion read and no model call, and the
   angles read the active objective to aim themselves — so every run does
   it, whatever it was asked for. With no schedule left, this is what keeps
   the objective current without anyone remembering to. */
const requested = [
  ...new Set([
    "objectives",
    ...(jobs.length ? jobs : ["queue"]).flatMap((j) => GROUPS[j] ?? [j]),
  ]),
];

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
