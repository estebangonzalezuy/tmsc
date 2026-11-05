# Anticipator Skill Lab

Real springs and anticipation for text animation specs. An **expansion of
[Pixel Point's animate-text](https://github.com/pixel-point/animate-text)** by
Alex Barashkov: same spec format, plus `x_spring` / `x_anticipation`, a Lab to
design presets with dials, a skill generator, and a small video editor built on
DialKit's timeline.

Built overnight on 2026-11-05. It's a lab inside the tMSC repo, not part of
the site: not wired into `app/`, ignored by the site's ESLint/tsconfig, and
never deployed. Start with `docs/PROGRESS.md` (what works / what's missing),
then `docs/STRATEGY.md` and `docs/SHIP-CHECKLIST.md`.

```bash
cd labs/anticipator
npm install
npm run dev                 # Lab + Editor → http://localhost:5178
npm test                    # physics + validate:catalog + check:skill + typecheck
npm run generate:skill      # rebuild skills/anticipator from the catalog
npm run export -- springs-side-by-side tmsc-timeline --verify   # → out/
```

`pnpm` works too (`pnpm validate:catalog`, `pnpm generate:skill`); the
scripts are plain Node.

| Path | What |
| --- | --- |
| `catalog/text-animations/` | `schema.md`, `catalog.json`, `specs/*.json`, the source of truth |
| `core/` | the runtime in TypeScript (Node runs it natively): spring, easing, phase, fit, timeline, render, validate |
| `scripts/` | validate-catalog, fit-catalog, generate-skill, check-skill, export-video |
| `skills/anticipator/` | **generated** skill. Don't edit by hand |
| `app/` | Vite + React + TS: Lab, Editor (DialKit), `#render` route for export |
| `_ref/` | gitignored clone of pixel-point/animate-text, format reference only |
| `projects/` | editor projects (`tmsc-timeline`, `springs-side-by-side`) |
| `out/` | rendered demos (mp4, webm, poster) |
| `docs/` | strategy, progress, licence notes, ship checklist, public README draft, tweet draft |
