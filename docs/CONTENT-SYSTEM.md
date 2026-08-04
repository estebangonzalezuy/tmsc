# the tMSC content system

How the club goes from an idea to a posted piece. This document is the
source of truth: any Claude session, anywhere, can read it and run the
whole system. Nothing here depends on a particular chat.

The loop, in one line: **the library of what's been published feeds the
angles → an angle becomes a draft → the draft gets a visual → it gets
scheduled → posting writes it back into the library.**

## The pieces

| Piece | Where | Notes |
|---|---|---|
| the Post Lab | <https://themotionsocialclub.vercel.app/postlab> | Dithering instrument for posts, carousels, reels. PNG / MP4 / GIF export. |
| the Studio | <https://themotionsocialclub.vercel.app/studio> | Edits site copy in `content/site.json`, publishes to `main`. |
| tMSC Pipeline | Notion · `collection://de912cbf-c9df-440c-8a17-c1ef8a9c1d1d` | One row per idea, all the way through. |
| tMSC Content library | Notion · `collection://59421a28-6325-466b-848e-f59b8bcf0986` | Everything published. Seeded with 51 Substack posts. |
| tMSC Objectives | Notion · `collection://e57499ed-1671-4267-876b-5b9247aef1f3` | Month / quarter / semester goals. The `Active` row aims the angles. |
| Canva masters | `DAHPx9zFsfY` (poster), `DAHPx5Abjpo` (serif quote) | Text fields tagged kicker / title / subtitle / footer. |
| Voice & pillars | `content/site.json` in this repo | `pillars`, `threads`, `quotes`, `archive`. |
| Post spec reference | `.claude/skills/postlab/SKILL.md` | How to build a Post Lab link. |

All Notion databases live under the **The Motion Social Club** hub page.

## The lifecycle

A Pipeline row's `Status` is the only state that matters. Nothing else is
remembered between runs.

```
Angle → Chosen → Drafted → Ready → Generated → Scheduled → Posted
  │        │         │        │         │           │          │
  │        │         │        │         │           │          └─ copy into the Content library
  │        │         │        │         │           └─ Schedule date set, draft ready to paste
  │        │         │        │         └─ Post link (and Canva link) filled in
  │        │         │        └─ you asking for a visual
  │        │         └─ LinkedIn draft written
  │        └─ you picked this one
  └─ proposed by the weekly cycle
```

`Ready` is the trigger word: it means "make me a visual". Everything else
moves when a human decides it moves.

## The jobs

Any session can run these on demand — just ask. Two of them also run on a
schedule (see Routines below).

**Propose angles.** Skip if 6+ rows already sit in `Angle`. Otherwise read
the Content library (what's over- and under-published, what's gone quiet),
the `Active` objective, and the pillars/threads in `content/site.json`.
Create exactly 3 rows with `Status = Angle`, each with a Name, a 2–3
sentence Angle in the club's voice, a Pillar, the Objective relation, and
a Source relation to the library post it extends. Vary across pillars;
prefer extending threads that worked over inventing new territory.

**Write the LinkedIn draft.** For a `Chosen` row: hook line first, short
paragraphs, no links in the body, no hashtag soup, no em-dash-heavy AI
cadence. Put it in **LinkedIn draft**, set `Status = Drafted`. LinkedIn is
the club's primary channel (~26k). Other channels only when asked.

**Make the visual.** For a `Ready` row: build a PostSpec per the postlab
skill, encode it with
`Buffer.from(JSON.stringify(spec)).toString('base64url')`, write
`https://themotionsocialclub.vercel.app/postlab#spec=<encoded>` into
**Post link**, set `Status = Generated`. If Notes mention "canva", also
copy the matching Canva master, fill its text in an editing transaction,
commit, and put the copy's edit URL in **Canva link**.

**Close the loop.** When a row reaches `Posted`, create a Content library
entry for it (Channel, Date, Type, Pillar) so future angles can see it.

## Zero-AI paths

Two things need no model call at all:

- **Instant link** — a formula column on every Pipeline row builds
  `…/postlab?title=…&body=…&format=…` from the Name, Copy and Format
  fields. It works the moment you type. `//` becomes a line break.
- **Canva copy-fill** — duplicating a master and typing into it is
  ordinary Canva work; you don't need Claude for it.

Use these when you just want a post. Use Claude for the parts that need
judgment: angles and drafts.

## The scheduler

Two ways to run the jobs on a schedule. They do the same work and both are
safe to run twice, because every job re-reads Notion and nothing is
remembered between runs.

### GitHub Actions — the one that outlives everything

`.github/workflows/content-cycle.yml` runs `scripts/content-cycle` on
ubuntu, calling the Notion REST API and the Claude API directly. No chat
session involved, no connectors, no memory. Setup and internals are in
`scripts/content-cycle/README.md`; the short version:

| Trigger | Job | Model calls |
|---|---|---|
| Hourly (`:17`) | drafts, visuals, library | only when a row is waiting |
| Mondays 12:00 UTC | the above + three new angles | 1 |
| 1st of the month | roll the objective period over | none, ever |
| Actions → Run workflow | any job, `--dry-run` available | as needed |

It needs two repository secrets — `ANTHROPIC_API_KEY` and `NOTION_TOKEN`
(an internal Notion integration with the three databases shared to it) —
and it must be on `main`, because GitHub only schedules from the default
branch. The site itself stays untouched: no Vercel env vars, no new
dependencies in the app's `package.json`.

The hourly poll is the instant path — mark a row `Ready` from your phone
and the visual lands within the hour — and it costs nothing when the queue
is empty, because the API is only touched once there's work.

It does not do Canva (that needs a Canva Connect OAuth app) and it never
publishes anything.

### Claude Routines — the chat-bound ones

Scheduled prompts, nothing more, run by a Claude session with the Notion
and Canva connectors attached. They can do the Canva step, which is their
one advantage. They are **bound to a specific chat session**: if it's
deleted they stop firing silently. To make them permanent, recreate them
from the **Routines** section of claude.ai in *new session* mode with the
connectors attached, using the prompts below verbatim.

Run both and you'll get duplicate angles — pick one. Actions for the
reliable loop, Routines when you want the Canva copies made for you.

### Weekly content cycle — Mondays, `0 12 * * 1` (UTC)

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
> and set Status = 'Generated'. If the row's Notes mention "canva", also
> copy Canva master DAHPx9zFsfY (poster) or DAHPx5Abjpo (serif quote),
> fill its text via an editing transaction, commit, and put the copy's
> edit_url in "Canva link".
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

### Objectives check-in — 1st of the month, `0 12 1 * *` (UTC)

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
- **Routines stopped firing.** The bound session was probably deleted.
  Recreate them from the claude.ai Routines UI with the prompts above — or
  move to the GitHub Actions workflow, which has nothing to lose.
- **The workflow failed.** Actions → the red run → its summary says which
  job and why. A bad `NOTION_TOKEN` shows up as a 401, a database that
  wasn't shared with the integration as a 404. Re-run it; nothing
  duplicates.
- **A Post Lab link won't open.** Old links from earlier spec versions are
  auto-migrated; if one truly breaks, rebuild it from the row's fields.
- **Angles feel generic.** The `Active` objective is probably empty.

## Working from anywhere

- **Phone / tablet** — Notion app for the pipeline, the Post Lab and
  Studio are both mobile-friendly, Canva app for the design copies.
- **Any Claude chat with the Notion connector** — say *"read
  docs/CONTENT-SYSTEM.md in the tmsc repo and run the angle job"* (or the
  draft job, or the visual job). Everything it needs is in this file.
- **A Claude Code session on this repo** — `AGENTS.md` and the postlab
  skill load automatically.
- **Nobody at all** — the GitHub Actions workflow runs the loop whether or
  not anyone opens a chat.
