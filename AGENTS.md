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

- **Black and white only.** `--background` white, `--foreground` near-black,
  grays for hierarchy. No color, ever.
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
  (spec → Paper Shaders, colors always derived from the theme — grayscale
  only), `overlay.ts` (canvas 2D text/motif renderer shared by preview and
  export), `exporter.ts` (PNG + MediaRecorder video).
- `app/api/postlab/schema/route.ts` — public, static JSON description of
  the spec so a Claude session anywhere can fetch it and generate links.
- `.claude/skills/postlab/SKILL.md` — the skill for doing exactly that from
  a repo session (including from Notion content).

Keep the spec backwards-compatible (bump `SPEC_VERSION` and normalize in
`normalizeSpec` if it must change) — links and the schema endpoint are the
integration surface. Shader colors must stay theme-derived; never add color
fields to the spec.

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

## When adding or changing a section

1. Mark its wrapper with `{...studioSection("<id>", "<Label>")}`.
2. Honor visibility: wrap it in `{!hidden.has("<id>") && (...)}` and make
   neighboring borders/grid columns adapt when it's gone.
3. If it has editable copy, add the data to `content/site.json` and its
   schema to the `sections` array in `StudioEditor.tsx`.
4. If it's a new page, add it to `pageTabs` in StudioEditor, the `pages` map
   in `PreviewClient.tsx`, nav in SiteHeader/SiteFooter (with a `navId` so
   the owner can hide the link), and a wrapper under `app/(site)/`.

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
