# the Motion Social Club — agent guide

Website for the Motion Social Club (tMSC). Next.js App Router + React +
TypeScript + Tailwind v4. Deployed on Vercel from `main` — every push to
`main` goes live in about a minute.

## The one rule that shapes everything

**Copy is content, not code.** All editable text lives in
`content/site.json`, edited by the owner through the visual Studio at
`/studio` (which commits that file to `main` via the GitHub API from the
browser). Therefore:

- Never hardcode copy that the owner might want to change — add a field to
  `content/site.json` and read it through `useContent()`.
- Never hand-edit `content/site.json` for design work; your change will be
  overwritten by the next Studio publish. Structural additions to the JSON
  (new fields/sections) are fine — also update the Studio schema in
  `app/studio/StudioEditor.tsx` (sections list) so the field is editable.
- The Studio may publish to `main` at any time. Always pull/rebase before
  pushing, and never force-push over `main`.

## Architecture map

- `content/site.json` — single source of truth for all copy, plus the
  `hidden[]` list (section ids and `nav:<page>` entries the owner has hidden).
- `content/directory/` — the Directory's data (not copy; see below). Generated,
  never hand-edited.
- `components/content.tsx` — `ContentContext` (defaults to the built JSON so
  public pages stay static), `useContent()`, `studioSection(id, label)`
  (click-to-edit markers), `hiddenSet(content)`.
- `components/pages/*.tsx` — the real page bodies ("use client", read
  `useContent()`, honor `hiddenSet`, carry `data-studio-section` markers).
- `app/(site)/*/page.tsx` — thin server wrappers; metadata only.
- `components/` — SiteHeader, SiteFooter, Cta, PostList, Motifs (the design
  system: CircleLetter, LetterMarquee, OrbitRing, Boxed, SectionHeading).
- `app/studio/` — the visual editor. `StudioEditor.tsx` (panel, GitHub
  publishing, section schema) and `preview/PreviewClient.tsx` (renders the
  real pages in an iframe with draft content over postMessage).
- `app/api/studio/content/route.ts` — dev-only filesystem helper; returns
  404 in production. Do not add secrets or env-var requirements: the Studio
  is deliberately zero-config (GitHub token pasted in the browser).
- `app/desk/` + `components/runs/RunsPanel.tsx` — the Desk, the owner's
  control panel for the content cycle (starts the GitHub Actions jobs,
  shows what's running). Same zero-config contract as the Studio: the
  token is pasted in the browser and every call goes straight to
  api.github.com. Never move it server-side.
- `lib/data.ts` — typed re-exports of the JSON for server components.

## Design rules

- **Black and white by default.** `--background` white, `--foreground`
  near-black, grays for hierarchy. The site itself stays monochrome. The one
  exception is the Post Lab, where a slide can opt into the club palette
  (`PALETTE` in `lib/postlab.ts`) for the dithered pixels — off unless asked
  for, and never anywhere else in the UI.
- **Fonts:** Archivo (sans, UI/body) and Lora (serif, display/italic
  emphasis) via `next/font`. No other fonts.
- **Motifs:** outlined circles, circled letters, orbital rings, boxed
  headlines, underlined labels — the components in `Motifs.tsx`. Don't
  introduce new decorative elements (shadows, gradients, rounded cards,
  icons) — extend the existing motif language instead.
- 1px `border-line` borders separate sections; `gap-px bg-line` grids make
  hairline tables.

## The Post Lab (`/postlab`)

An internal design tool (like `/studio`, not in the nav) for generating the
club's animated Instagram posts, carousels, and reels: dithered animated
backgrounds under the club's typography, with PNG, video, and GIF export.
The tool is deliberately a dithering instrument — backgrounds are Paper
Shaders' Dithering (`@paper-design/shaders-react`) or the club's own
ordered-dither forms renderer (`components/postlab/generative.ts`, canvas
2D), looping seamlessly over the post duration. Don't add other shader
families; extend the dithering vocabulary instead.

- `lib/postlab.ts` — the **PostSpec** model: types, shader registry,
  presets, base64url encode/decode. The spec travels in the URL
  (`/postlab#spec=<encoded>`), so anything that writes JSON can deep-link a
  ready post.
- `components/postlab/` — `PostLab.tsx` (tool UI), `ShaderLayer.tsx`
  (spec → Paper Shaders, tones from the slide theme or the palette when
  `color` is on), `overlay.ts` (canvas 2D text/motif renderer shared by preview and
  export), `exporter.ts` (PNG + MediaRecorder video).
- `app/api/postlab/schema/route.ts` — public, static JSON description of
  the spec so a Claude session anywhere can fetch it and generate links.
- `.claude/skills/postlab/SKILL.md` — the skill for doing exactly that from
  a repo session (including from Notion content).

Keep the spec backwards-compatible (bump `SPEC_VERSION` and normalize in
`normalizeSpec` if it must change) — links and the schema endpoint are the
integration surface. **Every field added since v1 defaults to absent, and
absent means the look the older links were shared with**; that rule is why
new effects can keep landing without breaking a Notion row from months ago.

Four things extend the dithering vocabulary rather than sitting beside it:

- **Parameters travel.** A layer's `motion` map sends any number on a trip
  over the loop (`to`, `wave`, `cycles`, `phase`). `resolveLayer` in
  `lib/postlab.ts` is the only place that knows about it, and both the
  preview and the exporter go through it, so they can't disagree. Cycles
  are whole numbers on purpose — that is the entire reason a travelling
  parameter can't open a seam.
- **The loop is a contract, not a hope.** Everything in
  `components/postlab/generative.ts` is periodic in the post duration:
  time only ever reaches a form as sin/cos of TAU·p, colour rotation
  completes whole rounds, and the orbit ring turns exactly one lap. When a
  slide is forms-only the exporter draws each frame itself, at its exact
  moment and at full export size, instead of filming the page — so a
  recording is a function of the frame number and two exports of the same
  post are byte-identical. The WebGL dithering can't do this (its shapes
  walk through noise that never repeats), so `loopReport` says so in the
  export panel rather than letting a seam ship.
- **A style is a slide without its words** — `styleOf` / `applyStyle` /
  `varyStyle`. Varying keeps every *decision* (form, mix, fold, ink) and
  moves only the numbers, which is what makes variations read as a family
  instead of a shuffle. The transform is left alone unless it was already
  moved by hand: a shrunk or turned background just drags its edges into
  shot.

- **Forms combine before the threshold.** A `forms` layer can mix a second
  `pattern2` into its `pattern` (`mix`), and `fold` the coordinates for
  symmetry. Both sources are grayscale and the *result* is dithered once,
  so the output is always the same hard-edged pixels. Anything new belongs
  in that pipeline — a second render pass would not be this tool.
- **Colour is per layer.** `ink` is a hex, `"mix"` (the palette scattered
  across the pixels), or absent for the theme's black and white — the
  default, and where the site itself stays. A `"mix"` layer can narrow the
  palette to its own `inks`, and choose `mixMode` / `mixScale` / `mixSpeed`
  for how colour is spread and how fast it travels. The palette lives in
  `PALETTE` in `lib/postlab.ts`, so editing that one array restyles every
  post that never overrode it. A slide may carry its own `palette` when the
  owner picks colours by hand; that slide then stops following the club
  palette, which is the deliberate cost of the picker. Generated posts
  never set it, and never set `ink` unless colour was asked for.

## the Directory (`/directory`)

The club's public, filterable index of motion design resources — 744 entries
across twelve collections (channels, courses, studios, tools, books, glossary,
timeline…). Documented in `docs/THE-DIRECTORY.md`; read that before touching it.

The split that matters: **the entries are data, the framing is copy.**

- Entries live in `content/directory/*.json`, generated by
  `node scripts/directory/build.mjs` from the tab-separated sources in
  `scripts/directory/sources/`. Edit the TSV and rebuild — never the JSON, and
  never put entries in `content/site.json`, which the Studio rewrites wholesale.
- The page's intro copy lives in `content/site.json` under `directory`, and is
  edited in the Studio like every other section.

Every collection declares `#source: notion` (exported from the club's own
databases) or `#source: seed` (written from knowledge, links unverified), and
the collection page says which to the reader. Keep that honest: if you add
entries you have not checked, they are `seed`, and
`node scripts/directory/check-links.mjs` is how they graduate. It needs open
outbound HTTPS, which the agent sandbox usually does not have.

Adding a collection is a TSV plus one entry in `COLLECTIONS` in `build.mjs`
plus an import in `lib/directory.ts` — no route or component changes.
`lib/directory.ts` pulls in every collection, so import it from server
components only; the hub uses `content/directory/manifest.json` instead.

## the Stills (`/stills`)

The club's curated wall of style frames — single frames lifted out of real
motion work, credited and linked back to the second they came from. Documented
in `docs/THE-STILLS.md`; read that before touching it.

Same split as the Directory: **the frames are data, the framing is copy.** The
frames live in `content/stills/projects.json` and `public/stills/`; the wall's
intro copy lives in `content/site.json` under `stills`, edited in the Studio.

The one constraint that shapes it: a browser cannot take a frame out of a
YouTube or Vimeo embed (cross-origin, tainted canvas). So the cutting happens
in GitHub Actions — `scripts/stills/extract.mjs` with yt-dlp and ffmpeg, run
from `.github/workflows/stills.yml` — and the site's job is choosing. The
extractor also writes a per-second sprite sheet so the Curator (`/curate`) can
scrub a video it is never allowed to play, and send marked timestamps back for
a second cutting pass. Keep those two passes in one workflow.

Don't add a generated `wall.json`: the lean index the wall filters over is
derived by `buildWall` at build time precisely so there is one implementation
rather than one in Node and one in the browser. And don't move the Curator's
GitHub calls server-side — it keeps the Studio and Desk's zero-config contract,
token in the browser, no secret on Vercel.

Everything the site renders goes through `frameSrc`/`scrubSrc` and the
`assetBase` field, so moving the images off the repo later is that one string.

## The content system

The club's posting loop — a Notion Pipeline, a Content library, monthly
Objectives, and the scheduler that ties them together — is documented in
`docs/CONTENT-SYSTEM.md`. Read that before touching
anything content-workflow related; it carries the database IDs, the status
lifecycle, and the routine prompts verbatim so the system can be rebuilt
from scratch.

The scheduled half of it lives in `scripts/content-cycle/` and runs from
`.github/workflows/content-cycle.yml` — Notion REST + the Claude API, no
chat session involved. It keeps its own `package.json` on purpose: the
deployed app must stay dependency- and secret-free, so never move those
dependencies into the root manifest or add env vars to Vercel for it. It
reads the Post Lab vocabulary from the live `/api/postlab/schema` rather
than duplicating `lib/postlab.ts`; keep that endpoint accurate and the
automation follows.

The writing voice lives in `docs/voice/` — `PROFILE.md` (how Esteban
writes, ending in the hard rules) and `EXAMPLES.md` (twenty published
posts). `claude.mjs` reads both at run time, so tuning the writing is
editing those files, not the prompts. Keep the hard rules last in the
profile: they're appended to every system prompt for recency.

## When adding or changing a section

1. Mark its wrapper with `{...studioSection("<id>", "<Label>")}`.
2. Honor visibility: wrap it in `{!hidden.has("<id>") && (...)}` and make
   neighboring borders/grid columns adapt when it's gone.
3. If it has editable copy, add the data to `content/site.json` and its
   schema to the `sections` array in `StudioEditor.tsx`.
4. If it's a new page, add it to `pageTabs` in StudioEditor, the `pages` map
   in `PreviewClient.tsx`, nav in SiteHeader/SiteFooter (with a `navId` so
   the owner can hide the link), and a wrapper under `app/(site)/`.

Note the `gap-px bg-line` grids show the line colour through any cell a
section doesn't fill, so an odd number of cards needs a blank
`bg-background` filler (see `DirectoryPage`).

## Verify before pushing

```bash
npm run lint && npm run build
```

Then drive it for real: `npx next dev -p 3124`, screenshot pages with
Playwright (Chromium is preinstalled), and for Studio changes verify the
loop end-to-end — open `/studio`, click a section in the preview iframe
(`iframe[title="Site preview"]`), edit a field, Publish, confirm
`content/site.json` changed and the rendered page shows it. Revert test
edits to the JSON before committing.

## Git flow

Develop on a feature branch, push it, then fast-forward `main`
(`git checkout main && git merge --ff-only <branch> && git push`) — Vercel
deploys `main`. Site content edits arrive on `main` as
"Update site content from the Studio" commits; treat them as the owner's.
