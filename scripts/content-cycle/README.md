# the content cycle, as a program

The same jobs the chat-bound Claude Routines ran, moved onto GitHub Actions
so they don't die with a conversation. State still lives entirely in Notion —
this is a stateless worker that reads the Pipeline, does what the statuses
ask for, and stops.

Nothing about the deployed site changes. Vercel holds no secrets, the app
gains no dependencies: this directory has its own `package.json` precisely so
the site's stays untouched.

## What runs when

No schedule. Every run is started from the Desk (`/desk` on the site), or
from Actions → Run workflow, or from the CLI below.

| Job | What it does | Model calls |
|---|---|---|
| `now` | every `Chosen` row → draft + Post link | 1 per row, 2 with text |
| `journal` | every `Make post` capture → a finished post | 1 per entry |
| `angles` | three things to write next | 1 |
| `queue` | journal, drafts, visuals, library | only if a row is waiting |

Every run rolls the objective period over first: one Notion read, no model
call, idempotent.

**`now` is the one to use when you're actually making a post.** The staged
path (`Chosen` → draft → you review → `Ready` → visual) costs two polls;
`now` does both in one run, about a minute end to end. That review gate is
the point of the slow path, so no schedule ever runs `now` — you ask for it.

There used to be a cron. Asked for a run every five minutes over a day and
a half, GitHub delivered 15 out of 347, one to three hours apart, and
emailed a failure whenever its runner pool was unhappy. A button is faster
than that and doesn't send mail about it.

## Setup (once)

**1. A Notion integration.** notion.so/my-integrations → New integration →
internal, workspace = yours. Copy the secret. Then open each of the three
databases (Pipeline, Content library, Objectives) → `···` → Connections →
add the integration. Sharing the parent hub page usually covers all three.

**2. Two repository secrets.** GitHub → Settings → Secrets and variables →
Actions → New repository secret:

- `ANTHROPIC_API_KEY` — from console.anthropic.com. Billed separately from
  a Claude subscription; this workload is pennies a month.
- `NOTION_TOKEN` — the integration secret from step 1.

**3. Merge to `main`.** GitHub only runs scheduled workflows from the default
branch.

**4. Check it.** Actions → *content cycle* → Run workflow → job `queue`,
dry run ✓. It prints what it would have done without writing anything.

## Running it locally

```bash
cd scripts/content-cycle && npm ci
export NOTION_TOKEN=secret_… ANTHROPIC_API_KEY=sk-ant-…
node index.mjs queue --dry-run
node index.mjs angles          # one job
node index.mjs all
```

Optional env: `SITE_ORIGIN` (default the Vercel URL — point it at
`http://localhost:3124` to generate links against a dev server),
`NOTION_PIPELINE` / `NOTION_LIBRARY` / `NOTION_OBJECTIVES` to retarget the
data sources.

## How it's put together

- `notion.mjs` — a small REST client (API version `2025-09-03`, where rows
  live in *data sources*), throttled and retrying, plus property read/write
  helpers. Rich text is chunked at 1900 characters because Notion rejects
  more in one block and LinkedIn drafts run longer.
- `postspec.mjs` — no copy of the Post Lab registry. It fetches
  `/api/postlab/schema` from the live site and derives the whole vocabulary
  from it: formats, fonts, every shader parameter and its range. Add a shape
  to the Post Lab and the automation can use it on the next run. Claude is
  asked only for a small *design brief*; this file validates every value
  against that vocabulary and assembles the PostSpec, so a hallucinated
  shape name falls back to the documented default instead of shipping a
  broken link.
- `claude.mjs` — the only three places that need judgment: proposing angles,
  writing the LinkedIn draft, choosing a visual treatment. One structured
  request each (`claude-opus-5`, adaptive thinking, `output_config.format`),
  not an agent loop. The club's voice is read from `content/site.json`, so
  editing the site in the Studio also steers the writing.
- `index.mjs` — the jobs, and a CLI over them.

## What this does *not* do

**Publishing.** Nothing posts to LinkedIn. `Scheduled` → `Posted` stays a
human move; the cycle only files the result back into the library.

**Canva.** Deliberately — the Post Lab is the club's visual system now.
See "Why Canva is not in the loop" in `docs/CONTENT-SYSTEM.md`.
