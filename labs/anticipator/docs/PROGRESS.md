# Progress — Anticipator Skill Lab

## Etapa 0 — Recon ✅

**Where things are (real paths, in this cloud session):**

| Thing | Path | Status |
| --- | --- | --- |
| This lab | `tmsc/labs/anticipator/` (repo `estebangonzalezuy/tmsc`, branch `claude/new-session-3sl55y`) | created tonight |
| animate-text-springs seed | `/workspace/creative-practice/tools-diarias/animate-text-springs/` | **not in this container.** Lives on Esteban's machine. The three seed presets were rebuilt from the brief's description. Reconcile values with the local `src/motion.js` tomorrow. |
| reboot-editor inception prompt | `/workspace/creative-practice/reboot-editor/inception-prompt.md` | **not in this container** |
| Motion builder (Claude Code + DialKit) | not found (searched repo, `/`, `~`) | Editor rebuilt fresh on DialKit's `useDialTimeline` + `<DialTimeline />` |
| Upstream reference clone | scratchpad only, not committed (`pixel-point/animate-text@0f783e4`) | read for format only |
| DialKit | npm `dialkit@2.1.0`, MIT | dependency |
| ffmpeg | `/usr/bin/ffmpeg` | used by export script |

**Upstream licence:** none (no LICENSE file, `"private": true`). Zero copy-paste. See `LICENSE-NOTES.md`.

**Where the lab lives:** inside `tmsc` as a self-contained folder with its own
`package.json`, like `scripts/content-cycle/`. It's ignored by the site's
ESLint/TypeScript, not wired into `app/`, and not merged to `main`, so
nothing deploys.

## Etapa 1 — Skeleton + schema ✅

- `core/`: shared pure modules (spring closed form, CSS easing, phase curves,
  bezier fit, timeline, canvas render, validator). The app, scripts and export
  all import these. One code path.
- `catalog/text-animations/schema.md`: Pixel-compatible core + `x_*` extensions.
- 8 specs: 3 seed (rebuilt from the brief; reconcile with the local
  `motion.js`), `weight-wave-letters` (real, Archivo variable wght 100–900,
  not a stub), `hold-aware-rise`, and 3 calm/energetic variants.
- `npm run validate:catalog` passes; verified it fails on bad keys, stale
  fallback, unlisted file and id/file mismatch.
- `npm run fit:catalog` fits the bezier fallback from the physics (idempotent).

## Etapa 2 — Runtime preview + diales ✅

- `npm run dev` → http://localhost:5178 (Lab tab).
- Side by side: **bezier reference** (pick: the familiar back-out cubic
  `cubic-bezier(0.34, 1.56, 0.64, 1)` with its own duration dial, or this spec's
  own fitted fallback) vs **spring + anticipation**. One clock drives both
  screens and the curve plot.
- Dials: stiffness, damping, mass, anticipation %, anticipation ms, stagger,
  opacity ms, rest_delta. Live ζ, character, overshoot %, settle ms, and the
  fallback's rms/max error.
- Save as preset: name + intent (calm / energetic / heavy / playful / precise /
  editorial) + notes → POST `/api/specs` (Vite dev middleware) → validated,
  fallback fitted, written to `catalog/text-animations/specs/<id>.json` and
  listed in `catalog.json` (group `lab`). Copy JSON as well; without the dev
  server it downloads the file.
- Verified with Playwright: `anticipate-pop-words-energetic` was made from
  the UI (k 700, c 19, wind-up 22%/80ms) and is now in the catalog.

## Etapa 3 — Generate skill ✅

- `npm run generate:skill` → `skills/anticipator/` (SKILL.md, references/
  schema · selection-guide · catalog · implementation-notes, assets/specs with
  generated `x_css_linear`, assets/catalog.json, scripts/list-specs ·
  get-spec [--portable], scripts/runtime/ = the same closed-form core the app
  uses). Wipes and rewrites; verified byte-identical on re-run.
- `npm run check:skill`: regenerates to a temp dir and diffs (fails if
  skills/ is stale or hand-edited), checks frontmatter/sections/credit, runs
  the helper scripts from another cwd, imports the runtime.
- SKILL.md presents it as an **expansion** of pixel-point/animate-text and
  sends non-physical effects back to that skill. Translation order: native
  spring → CSS `linear()` → JS runtime → fitted bezier fallback.
- Not installed anywhere. Structure check only, as the brief asked.

## Etapa 4 — Editor timeline ✅

- Editor tab (`#editor`). A project is N text clips, and each clip plays one
  catalog spec (spring or bezier runtime). Projects live in `projects/*.json`;
  the last-open draft is kept in localStorage.
- **DialKit**: `useDialTimeline` + `<DialTimeline />` own the transport and the
  clip bars. Dragging/resizing a bar writes back into the project. Resizing
  stretches the clip's **hold**, never its springs. `useDialKitController`
  drives an inline **Clip** panel: text (`/` = line break), ink (current pair
  + B/W), size, y, stagger override, spring override (k/c/m).
- Our `renderProject(ctx, project, specs, t)` draws every frame at DialKit's
  playhead, the same function the exporters call.
- Colour pairs locked to the tMSC set (acid/ink, lilac/brown, magenta/green,
  indigo/white, periwinkle/ink, yellow/ink, white/ink); formats square /
  landscape / story.
- Verified with Playwright: 5-clip timeline loops (wraps at 11.0s), dock drag
  moves a clip (3000 → 4020ms), panel text edit reaches the canvas, Add clip
  gets its natural length.
