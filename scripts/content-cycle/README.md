# the content cycle, as a program

The same jobs the chat-bound Claude Routines ran, moved onto GitHub Actions
so they don't die with a conversation. State still lives entirely in Notion —
this is a stateless worker that reads the Pipeline, does what the statuses
ask for, and stops.

Nothing about the deployed site changes. Vercel holds no secrets, the app
gains no dependencies: this directory has its own `package.json` precisely so
the site's stays untouched.

## What runs when

| Trigger | Job | Model calls |
|---|---|---|
| Hourly (`:17`) | `queue` — drafts, visuals, library | only if a row is waiting |
| Mondays 12:00 UTC | `weekly` — the queue + three new angles | 1 for the angles |
| 1st of the month | `objectives` — roll the period over | none, ever |
| Actions → Run workflow | anything, including `--dry-run` | as needed |

The hourly poll is the "instant" path: mark a row `Ready` on your phone and
the visual shows up within the hour. It costs nothing when the queue is
empty — three Notion reads, no API call.

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

**Canva.** The MCP connector that filled the masters from chat has no
equivalent here; doing it from a script means a Canva Connect OAuth app.
Rows whose Notes mention canva still get their Post Lab link, and the run
summary reminds you which master to copy by hand
(`DAHPx9zFsfY` poster, `DAHPx5Abjpo` serif quote).

**Publishing.** Nothing posts to LinkedIn. `Scheduled` → `Posted` stays a
human move; the cycle only files the result back into the library.
