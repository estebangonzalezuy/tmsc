# the tMSC content system

How the club goes from an idea to a posted piece. This document is the
source of truth: any Claude session, anywhere, can read it and run the
whole system. Nothing here depends on a particular chat.

The loop, in one line: **the library of what's been published feeds the
angles → an angle becomes a draft → the draft gets a visual → it gets
scheduled → posting writes it back into the library.**

> **The scheduled half is currently broken.** The Posts Studio was rebuilt
> as a node graph in September 2026 (`AGENTS.md`, "the Posts Studio", "What's
> retired") and `/api/postlab/schema` — what `scripts/content-cycle/
> postspec.mjs` reads to build a visual — no longer exists; every "build a
> PostSpec" instruction below is the pre-rebuild routine, not yet adapted.
> `postspec.mjs`'s `assembleSpec`/`encodeSpec` need rewriting against
> `lib/postgraph.ts` (node kinds, `NodeDef`s, `encodeGraph`) before Job 1/2
> can post a working link again. The Desk's manual "Make it" path (below) is
> unaffected — it builds its own small graph directly, no schema fetch
> involved.

## Start here: the box on the Desk

Everything below is the machinery. The everyday way in is one text field at
the top of [the Desk](https://themotionsocialclub.vercel.app/desk), and it has
two speeds:

| | what it does | cost | where it lands |
|---|---|---|---|
| **Make it** | Builds a small [Post Lab](https://themotionsocialclub.vercel.app/postlab) graph — your words as a sheet — and opens it already in. Never leaves the browser. | instant, nothing | the Post Lab, right now |
| **Ask the club** | Hands the same words to the runner, which writes the angle and the LinkedIn draft, art-directs the visual, and files the row. | about a minute, one model call | a Pipeline row at `Generated`, with the Post link |

Use **Make it** when you already know what you want to say — it is the whole
distance from a sentence to an exported PNG. Use **Ask the club** when you want
the club to do the writing.

Both file the thought in the Journal, so nothing typed is lost and the library
stays whole. **Ask the club** is the `capture` job, which is the Journal path
with the typing moved to the site: it creates the row already at `Make post`
and runs the journal job in the same pass.

Typing straight into the tMSC Journal in Notion still works exactly as it
always did, and `pull` still copies from the handwritten 📔 Journal. The box is
a second door into one corridor, not a second corridor.

## The pieces

| Piece | Where | Notes |
|---|---|---|
| the Desk | <https://themotionsocialclub.vercel.app/desk> | The box you write into, the buttons that start the runs, and a live view — the phone-friendly front of the whole system. |
| the Tools | <https://themotionsocialclub.vercel.app/tools> | Small tools, one thing each. **the Note** is where the Desk's "Make it" lands. No AI, no waiting, no Notion. |
| the Posts Studio | <https://themotionsocialclub.vercel.app/postlab> | Where posts, carousels and reels are made: ruled sheets, editorial type, dithered graphics. PNG / MP4 / GIF export. |
| the Studio | <https://themotionsocialclub.vercel.app/studio> | Edits site copy in `content/site.json`, publishes to `main`. |
| 📔 Journal (Esteban's own) | Notion · page `2f41c0b2f62f8095ac8feb182c9d9997` | Written by hand, one sub-page per day. Not part of the club — the `pull` job reads it. Needs the tMSC integration added to it. |
| tMSC Journal | Notion · `collection://90f76b2d-065b-4fe4-a3f6-3b2da5c9f727` | Raw capture. Set `Make post` and a run turns it into a finished post. `Source` holds the handwritten entry it came from. |
| tMSC Pipeline | Notion · `collection://de912cbf-c9df-440c-8a17-c1ef8a9c1d1d` | One row per idea, all the way through. |
| tMSC Content library | Notion · `collection://59421a28-6325-466b-848e-f59b8bcf0986` | Everything published. Seeded with 51 Substack posts. |
| tMSC Objectives | Notion · `collection://e57499ed-1671-4267-876b-5b9247aef1f3` | Month / quarter / semester goals. The `Active` row aims the angles; the `review` job writes back **Review**, **Standing**, **Reviewed**. |
| Canva masters | `DAHPx9zFsfY` (poster), `DAHPx5Abjpo` (serif quote) | Out of the loop — kept for one-off manual work only. See below. |
| Club facts & pillars | `content/site.json` in this repo | `pillars`, `threads`, `quotes`, `archive`. |
| How Esteban writes | `docs/voice/` in this repo | `PROFILE.md` (the rules) and `EXAMPLES.md` (20 published posts). Every writing job reads these. |
| Post spec reference | `.claude/skills/postlab/SKILL.md` | How to build a Posts Studio link. |

All Notion databases live under the **The Motion Social Club** hub page.

## The lifecycle

A Pipeline row's `Status` is the only state that matters. Nothing else is
remembered between runs.

```
Angle → Chosen → Drafted → Ready → Generated → Scheduled → Posted
  │        │         │        │         │           │          │
  │        │         │        │         │           │          └─ copy into the Content library
  │        │         │        │         │           └─ Schedule date set, draft ready to paste
  │        │         │        │         └─ Post link filled in
  │        │         │        └─ you asking for a visual
  │        │         └─ LinkedIn draft written
  │        └─ you picked this one
  └─ proposed when you press "Give me three angles"
```

`Ready` is the trigger word: it means "make me a visual". Everything else
moves when a human decides it moves.

**In practice you only walk four of these.** `Angle → Chosen → Generated →
Posted` is the lived path: "Finish what I chose" takes a `Chosen` row to a
draft *and* a Post link in one run, and the box skips straight to `Generated`.
`Drafted`, `Ready` and `Scheduled` stay legal — the `drafts` and `visuals` jobs
still read them — but they are the slow road, there for when you want to read
the draft before the visual is designed from it. Don't feel you're skipping
steps; the staged path is the exception now, not the default.

## Capture → post, without touching a keyboard properly

The Journal is the front door for days that start with a thought rather
than a plan.

1. New row in **tMSC Journal**. Type it, or hold the mic key on the phone
   keyboard and talk — the words land as text either way, in **Entry** or
   in the page body; the run reads both.
2. Status → **`Make post`**. Tick **Text on visual** only if you want the
   words *on the image*; left off (the default) the visual is a pure
   generative background with no type at all.
3. The next run reads the capture against the whole library, and creates a
   Pipeline row already at `Generated`: title, angle, pillar, sources,
   LinkedIn draft, Post link. The Journal row flips to `Used` and links to
   the post it became.

One model call for the whole thing. The no-text visual costs nothing extra
— there is no art direction to do, so the shader, its parameters and the
colour seed are picked at random, and no two look alike. Journal posts come
out in the club palette; the dithered-forms backgrounds get the full
mosaic, the WebGL dithering one takes a single colour, since that shader
only has two tones.

**Voice notes:** Notion can hold an audio file, but no Claude model reads
audio, and transcribing would mean a third vendor. Dictating with the
phone keyboard's mic gets you the same result — your voice, straight into
text the run can read — for nothing.

## The jobs

Any session can run these on demand — just ask. The Desk runs them with a
button; nothing runs on its own.

**Capture a thought.** What "Ask the club" on the Desk runs. Takes the text
typed into the box, files it in the tMSC Journal already at `Make post`, and
then runs the journal job below in the same pass — so one press goes from a
sentence to a finished Pipeline row. It owns no writing of its own: everything
that turns a thought into a post lives in the journal job, and a second path
through the model would be a second voice to keep in tune. The box's **Put
these words on the visual** checkbox becomes the row's **Text on visual**.

The text travels to the runner in the environment, never on the command line —
it is arbitrary text from a browser, and interpolated into a shell command one
apostrophe would be enough to turn it into something else.

**Pull the journal.** Reads the sub-pages of the handwritten 📔 Journal and
copies anything not already here into the tMSC Journal: the first words as
the Name, the whole entry in the page body, the date it was written, and
the source page in `Source`, which is what stops it arriving twice.

Everything lands as **`Captured`**, never `Make post`. Most of what goes in
a journal is a day rather than an idea, and the club has no business
turning that into a post because a script found it — deciding which thought
is worth saying out loud stays a person's job. Costs no model call, so it
is safe to run whenever.

**Propose angles.** Skip if 6+ rows already sit in `Angle`. Otherwise read
the Content library (what's over- and under-published, what's gone quiet),
the `Active` objective, the rows already in flight, and the
pillars/threads in `content/site.json`. Create exactly 3 rows with
`Status = Angle`, each with a Name, a 2–3 sentence Angle in the club's
voice, a Pillar, the Objective relation, and a Source relation to the
library post it extends. The objective is the brief, not a hint: if the
month has a Goal written, every angle has to move it. Vary across pillars;
prefer extending threads that worked over inventing new territory, and
don't repeat a beat that's already sitting in the Pipeline.

A library row may carry a **How it landed** text — impressions,
interactions and engagement rate, pasted in from the channel's own export
(LinkedIn's is under *Settings → Get a copy of your data → Posts*). Every
job that reads the library passes it to the model as *attention, not
quality*: a post can reach a hundred thousand people and say nothing. What
it is for is telling the club which subjects this audience turns up for,
and a high engagement rate counts for more than big impressions — those
are the posts people answered rather than scrolled past. Leave the field
empty and nothing changes; the jobs simply don't mention it.

**Review the month.** Reads the `Active` objective's Goal, everything
published since its Start date, and what's still unposted in the Pipeline,
then writes back a short standing (`on track` / `slipping` / `off track` /
`too early to tell`), what's working, what's missing, and the next move —
into the objective row's **Review**, **Standing** and **Reviewed**
columns. Needs a Goal written on the row; with an empty Goal it says so
and spends nothing.

**Write the LinkedIn draft.** For a `Chosen` row: hook line first, short
paragraphs, no links in the body, no hashtag soup, no em-dash-heavy AI
cadence. Put it in **LinkedIn draft**, set `Status = Drafted`. LinkedIn is
the club's primary channel (~26k). Other channels only when asked.

**Make the visual.** For a `Ready` row: build a PostSpec per the postlab
skill, encode it with
`Buffer.from(JSON.stringify(spec)).toString('base64url')`, write
`https://themotionsocialclub.vercel.app/postlab#spec=<encoded>` into
**Post link**, set `Status = Generated`. The row's **Text on visual**
checkbox decides the treatment: off (the default) gives a pure generative
background in the club palette and costs no model call at all, since there
are no words to art-direct; on puts the headline over it.

**Close the loop.** When a row reaches `Posted`, create a Content library
entry for it (Channel, Date, Type, Pillar) so future angles can see it.

## Zero-AI paths

- **Instant link** — a formula column on every Pipeline row builds
  `…/postlab?title=…&body=…&format=…` from the Name, Copy and Format
  fields. It works the moment you type. `//` becomes a line break.

Use it when you just want a post. Use Claude for the parts that need
judgment: angles and drafts.

## Why Canva is not in the loop

the Posts Studio already makes the poster and the serif quote, it's
mobile-friendly, and it exports PNG / MP4 / GIF. Canva was doing the same
job through an MCP connector, and that connector was the **only** piece of
the system that required a live chat session — automating it from a script
would mean a Canva Connect OAuth app, refresh tokens rotating in the repo
secrets, and a paid plan for Autofill, all to replace two minutes of
manual work.

So Canva is out of the automated path. The two masters still exist if you
want to make something by hand; duplicating one and typing into it is
ordinary Canva work and needs nothing from this system. The Pipeline's
**Canva link** column is now unused — leave it or delete it, nothing reads
it.

## The scheduler

One brain: GitHub Actions. Every job re-reads Notion and nothing is
remembered between runs, so any of them is safe to run twice.

### GitHub Actions — the whole loop

`.github/workflows/content-cycle.yml` runs `scripts/content-cycle` on
ubuntu, calling the Notion REST API and the Claude API directly. No chat
session involved, no connectors, no memory. Setup and internals are in
`scripts/content-cycle/README.md`; the short version:

**Nothing runs on a schedule.** Every run starts from the Desk. GitHub's
cron delivered 15 of 347 requested runs over a day and a half, one to three
hours apart, and emailed a failure every time its runner pool wobbled — a
promise nobody was keeping, plus noise. A button you press is both faster
and quieter.

| Button on the Desk | Job | Model calls |
|---|---|---|
| The box → Ask the club | `capture` — what you typed → a finished post | 1, plus 1 with text on the visual |
| The box → Make it | none — the browser builds the sheet itself | none |
| Get my journal | `pull` — new entries from the handwritten Journal, as `Captured` | none |
| Make the journal posts | `journal` — every `Make post` capture → a finished post | 1 per entry |
| Give me three angles | `angles` — aimed at the month's objective | 1 |
| Finish what I chose | `now` — every `Chosen` row → draft + Post link | 1 per row, 2 with text on the visual |
| How is the month going | `review` — the objective vs. what got published | 1 |
| Catch up | `queue` — journal, drafts, visuals, library | only when a row is waiting |

Every run also rolls the objective period over first — one Notion read, no
model call — so the month stays current without a schedule to do it.

It needs two repository secrets — `ANTHROPIC_API_KEY` and `NOTION_TOKEN`
(an internal Notion integration with the three databases shared to it) —
and it must be on `main`, because GitHub only schedules from the default
branch. The site itself stays untouched: no Vercel env vars, no new
dependencies in the app's `package.json`.

**Sitting down to make a post: run `now`** — it takes every `Chosen` row to
a finished draft *and* Post link in a single run, about a minute. Mark
several rows first and one press finishes them all. The poll costs nothing when the queue
is empty, because the API is only touched once there's work.

If you want the old background behaviour back — three angles every Monday
without asking — a `schedule:` block in the workflow restores it, with the
caveats above.

The staged statuses exist so you can review the draft before the visual is
designed from it. `now` skips that gate deliberately — use it when you'd
rather edit both together than wait between them.

### Starting a run without opening GitHub

**the Desk** (`/desk`) is the front door: a box to write into, a couple of
buttons, a live view of what's running, and the housekeeping folded away under
*The other four*. It works on a phone.

The box's **Make it** needs no token at all — it never touches the network — so
the Desk is useful on a device you have never set up. Everything else waits for
the token below.

It holds no secret. Like the Studio, you paste a GitHub fine-grained token
once (repository access limited to this repo, *Actions: read and write*)
and it lives in that browser's localStorage; every call goes straight from
the page to api.github.com. Vercel stores nothing, which is what keeps the
deployed app free of environment variables.

There is also a `repository_dispatch` trigger on the workflow, for a
**Notion button** — but webhook actions need Notion Plus or above, so on
the free plan the Desk is the answer. If you ever upgrade:

- URL `https://api.github.com/repos/estebangonzalezuy/tmsc/dispatches`
- Headers: `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`
- Body: `{"event_type":"content-cycle","client_payload":{"job":"journal"}}`
- Or, for the box's job: `{"event_type":"content-cycle","client_payload":{"job":"capture","text":"…","on_image":"true"}}`

Nothing happens on its own — which is the point. The Desk is the only
trigger, so the system is never quietly halfway through something.

It never publishes anything, and it doesn't touch Canva.

### The one Claude Routine still running

`tMSC objectives check-in`, 1st of the month, `0 12 1 * *` (UTC) — two
minutes after the workflow. The workflow has already created the new
period's row by then; the routine's job is to **nudge you to fill in the
Goal**, which a CI run can't do. Its prompt is below.

It's a convenience, not a dependency: it's bound to a chat session, so if
that session is deleted it stops firing and all you lose is the reminder.
The weekly content-cycle routine that used to sit beside it is **disabled**
— Actions does that work now, and running both would produce duplicate
angles every Monday.

### If you ever want to run the cycle from a chat

Any Claude session with the Notion connector can do it — paste the prompt
below, or just say *"read `docs/CONTENT-SYSTEM.md` in the tmsc repo and run
the angle job"*. This is also the prompt to restore if you ever want the
weekly routine back instead of Actions.

#### Weekly content cycle — Mondays, `0 12 * * 1` (UTC) · disabled

> Run the club's content cycle. Two jobs, in order. Never commit or push
> code, and never touch rows in statuses you weren't asked to handle.
>
> JOB 1 — process pending visuals. Query the Pipeline
> (`collection://de912cbf-c9df-440c-8a17-c1ef8a9c1d1d`) for
> `Status = 'Ready'`. For each: build a PostSpec per the postlab skill
> (dithering-only: layers are `dithering` with shape
> simplex|warp|dots|wave|ripple|swirl|sphere and dtype 4x4|8x8|2x2|random,
> or `forms` with pattern rings|ramp|bars|letter + word + warp), encode
> with `Buffer.from(JSON.stringify(spec)).toString('base64url')`, set
> "Post link" = `https://themotionsocialclub.vercel.app/postlab#spec=<encoded>`,
> and set Status = 'Generated'.
>
> JOB 2 — propose three angles. First check the Pipeline for rows already
> in Status 'Angle': if there are 6 or more sitting unactioned, skip this
> job entirely. Otherwise read the Content library
> (`collection://59421a28-6325-466b-848e-f59b8bcf0986`), the Objectives db
> (`collection://e57499ed-1671-4267-876b-5b9247aef1f3`) row with
> Status = 'Active', and the pillars and recurring threads in
> `content/site.json`. Then create exactly 3 new Pipeline rows with
> Status = 'Angle', each with a Name, an Angle (2-3 sentences on the
> specific take and why now, in the club's honest anti-hype voice), a
> Pillar, the Objective relation, and a Source relation to the library
> post it builds on. Prefer angles that extend a thread that worked.
> Vary the three across pillars.
>
> Then reply with a two-line summary. If nothing happened, say nothing.

#### Objectives check-in — 1st of the month, `0 12 1 * *` (UTC) · running

> It's the 1st. Open the Objectives db
> (`collection://e57499ed-1671-4267-876b-5b9247aef1f3`). If there is no
> row with Status = 'Active' whose Start falls in the current month, mark
> any older Active row as 'Past' and create a new row for this month:
> Name = "<Month> <Year>", Period = month, Start = the 1st,
> Status = 'Active', Goal left empty. If today also starts a quarter
> (Jan/Apr/Jul/Oct) or a semester (Jan/Jul), create those rows too.
>
> Then reply with one short message asking Esteban to fill in the Goal in
> his own words — one sentence about what should be true by the end of the
> period. Mention that Monday's content cycle reads it to aim the angles.
> Keep it to two lines. Never modify Pipeline rows or repo code.

## When something breaks

- **A run failed halfway.** Fine. State lives in Notion, so the row is
  still in its old status and the next run picks it up. Nothing
  duplicates.
- **The objectives nudge stopped arriving.** Its chat session was probably
  deleted. Nothing is broken — the workflow still creates the row on the
  1st, you just have to remember the Goal yourself. Recreate the routine
  from the claude.ai Routines UI with the prompt above if you miss it.
- **The workflow failed.** Actions → the red run → its summary says which
  job and why. A bad `NOTION_TOKEN` shows up as a 401, a database that
  wasn't shared with the integration as a 404. Re-run it; nothing
  duplicates.
- **A Posts Studio link won't open.** Old links from earlier spec versions are
  auto-migrated; if one truly breaks, rebuild it from the row's fields.
- **Angles feel generic.** The `Active` objective's Goal is probably empty —
  write one sentence in it and the angles have something to aim at. The
  `review` job needs the same field and refuses to guess without it.
- **A draft sounds like everyone else's LinkedIn.** The voice comes from
  `docs/voice/PROFILE.md`. Edit that file — it is read on every run, and
  the hard rules at the end of it carry the most weight.

## Working from anywhere

- **Phone / tablet** — the Desk's box for a thought (hold the mic key and talk;
  the words land as text either way), the Notion app for the pipeline, the
  Posts Studio for the visual, the Studio for site copy. All mobile-friendly,
  and nothing else is needed.
- **Any Claude chat with the Notion connector** — say *"read
  docs/CONTENT-SYSTEM.md in the tmsc repo and run the angle job"* (or the
  draft job, or the visual job). Everything it needs is in this file.
- **A Claude Code session on this repo** — `AGENTS.md` and the postlab
  skill load automatically.
- **Nobody at all** — the GitHub Actions workflow runs the loop whether or
  not anyone opens a chat.
