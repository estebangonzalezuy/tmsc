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
| the Desk | <https://themotionsocialclub.vercel.app/desk> | Starts the runs. Four buttons and a live view — the phone-friendly front of the whole system. |
| the Post Lab | <https://themotionsocialclub.vercel.app/postlab> | Dithering instrument for posts, carousels, reels. PNG / MP4 / GIF export. |
| the Studio | <https://themotionsocialclub.vercel.app/studio> | Edits site copy in `content/site.json`, publishes to `main`. |
| tMSC Journal | Notion · `collection://90f76b2d-065b-4fe4-a3f6-3b2da5c9f727` | Raw capture. Set `Make post` and a run turns it into a finished post. |
| tMSC Pipeline | Notion · `collection://de912cbf-c9df-440c-8a17-c1ef8a9c1d1d` | One row per idea, all the way through. |
| tMSC Content library | Notion · `collection://59421a28-6325-466b-848e-f59b8bcf0986` | Everything published. Seeded with 51 Substack posts. |
| tMSC Objectives | Notion · `collection://e57499ed-1671-4267-876b-5b9247aef1f3` | Month / quarter / semester goals. The `Active` row aims the angles. |
| Canva masters | `DAHPx9zFsfY` (poster), `DAHPx5Abjpo` (serif quote) | Out of the loop — kept for one-off manual work only. See below. |
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
  │        │         │        │         └─ Post link filled in
  │        │         │        └─ you asking for a visual
  │        │         └─ LinkedIn draft written
  │        └─ you picked this one
  └─ proposed by the weekly cycle
```

`Ready` is the trigger word: it means "make me a visual". Everything else
moves when a human decides it moves.

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

The Post Lab already makes the poster and the serif quote, it's
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

| Trigger | Job | Model calls |
|---|---|---|
| Actions → Run workflow | `now` — every `Chosen` row to a finished draft + Post link, one pass | 1 per row, 2 with text on the visual |
| Hourly, best-effort | journal, drafts, visuals, library | only when a row is waiting |
| Mondays 12:00 UTC | the above + three new angles | 1 |
| 1st of the month | roll the objective period over | none, ever |

It needs two repository secrets — `ANTHROPIC_API_KEY` and `NOTION_TOKEN`
(an internal Notion integration with the three databases shared to it) —
and it must be on `main`, because GitHub only schedules from the default
branch. The site itself stays untouched: no Vercel env vars, no new
dependencies in the app's `package.json`.

Two speeds, on purpose. **Sitting down to make a post: run `now`** — it
takes every `Chosen` row to a finished draft *and* Post link in a single
run, about a minute. **Leaving work behind:** mark the row and let the
poll pick it up whenever it arrives. The poll costs nothing when the queue
is empty, because the API is only touched once there's work.

**How best-effort is it?** Measured over a day and a half asking for every
five minutes: 15 runs delivered out of 347 due, spaced one to three hours
apart. GitHub drops scheduled runs freely and asking more often doesn't get
you more of them, so the cron asks hourly now. If you want something to
happen at a time you choose, press the button.

The staged statuses exist so you can review the draft before the visual is
designed from it. `now` skips that gate deliberately — use it when you'd
rather edit both together than wait between them.

### Starting a run without opening GitHub

**the Desk** (`/desk`) is the front door: four buttons, a live view of
what's running, and nothing else. It works on a phone.

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

And if you touch nothing at all, the poll picks the work up on its own
eventually — see the measurement above for what "eventually" really means.
That gap is exactly why the Desk exists.

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
- **A Post Lab link won't open.** Old links from earlier spec versions are
  auto-migrated; if one truly breaks, rebuild it from the row's fields.
- **Angles feel generic.** The `Active` objective is probably empty.

## Working from anywhere

- **Phone / tablet** — Notion app for the pipeline, the Post Lab for the
  visual, the Studio for site copy. All three are mobile-friendly, and
  nothing else is needed.
- **Any Claude chat with the Notion connector** — say *"read
  docs/CONTENT-SYSTEM.md in the tmsc repo and run the angle job"* (or the
  draft job, or the visual job). Everything it needs is in this file.
- **A Claude Code session on this repo** — `AGENTS.md` and the postlab
  skill load automatically.
- **Nobody at all** — the GitHub Actions workflow runs the loop whether or
  not anyone opens a chat.
