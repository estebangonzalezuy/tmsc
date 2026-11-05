# Anticipator

> **Built on Pixel Point's [animate-text](https://github.com/pixel-point/animate-text)**
> by [Alex Barashkov](https://x.com/alex_barashkov). animate-text turned text
> animations into JSON recipes and a skill any agent can install. Anticipator
> is an expansion of that idea. It uses the same spec format and the same
> generate-a-skill pipeline, and adds physics. It is not a fork or a
> replacement; for the wider catalog of text effects, use animate-text.

*(Draft of the future public README. Copy, not code. Fill in `YOUR_DEMO_URL`
and the licence before publishing.)*

**Real springs and anticipation for text animation specs**, plus a tool to
design them with dials and a small editor to cut video with them.

[demo](YOUR_DEMO_URL) · [skill](./skills/anticipator/SKILL.md) · [spec format](./catalog/text-animations/schema.md)

## What it adds to animate-text

- **Real springs.** `x_spring: { stiffness, damping, mass, velocity }`,
  `F = −k(x−1) − c·v`, solved exactly (closed form, checked against step
  integration). It isn't a cubic-bezier pretending, so a
  second bounce and real weight are possible.
- **Anticipation.** `x_anticipation: { amount, duration_ms }` winds up away
  from the target before the spring releases. It's the oldest trick in
  animation, applied to type.
- **Opacity on its own clock**, so the wind-up is visible instead of
  happening while the letter is still invisible.
- **Reading time.** `x_hold_ms` and `x_hold_per_word_ms` say how long copy
  must stay up before it exits.
- **Intent.** Every spec says what it is for (calm, energetic, heavy,
  playful…), and variants share `from`/`to`, so "make it calmer" is a
  one-word swap.
- **Nothing breaks.** Every extension is an optional `x_*` field. Each spring
  phase also carries a cubic-bezier `easing` fitted to the spring, with its
  error written down (`x_fallback.max_error`). A runtime built for
  animate-text plays every Anticipator spec as-is.

## Install the skill

```bash
npx skills add YOUR_GITHUB/anticipator --skill anticipator
```

Pair it with animate-text:

```bash
npx skills add pixel-point/animate-text --skill animate-text
```

## The tool

```bash
npm install
npm run dev            # Lab + Editor at http://localhost:5178
```

- **Lab.** Pick a spec and see it side by side: the familiar bezier spring
  vs the real spring with anticipation, on one clock with the curves plotted.
  Dial stiffness, damping, mass, wind-up, stagger and opacity, and watch ζ
  live. Save a named preset with an intent, and it lands in
  `catalog/text-animations/specs/`.
- **Editor.** Compose clips on a timeline (built on
  [DialKit](https://dialkit.dev)'s timeline). Each clip plays a catalog spec
  with per-clip overrides. Export WebM in the browser, or MP4/WebM frame by
  frame from the CLI.

## Pipeline

```
catalog/text-animations/   schema.md · catalog.json · specs/*.json   ← source of truth
scripts/                   validate-catalog · fit-catalog · generate-skill · check-skill · export-video
skills/anticipator/        generated. Never edit by hand
app/                       the Lab + Editor (Vite + React + TypeScript + DialKit)
core/                      the runtime: spring, easing, phase, fit, timeline, render
```

```bash
npm test                   # physics vs integration, catalog, skill, typecheck
npm run validate:catalog   # fails on any schema break or stale fallback
npm run fit:catalog        # re-fit bezier fallbacks after editing physics by hand
npm run generate:skill     # the only way skills/ changes (idempotent)
npm run check:skill        # skills/ in sync, structure ok, helpers run
npm run export -- tmsc-timeline --verify
```

## Credits

- **Format, concept, skill pattern:** Pixel Point's animate-text, by Alex
  Barashkov. No code from animate-text is included here; the format is
  matched so the two work together.
- **Timeline + dials:** DialKit by Josh Puckett (MIT).
- **Type:** Archivo Narrow and Archivo by Omnibus-Type (SIL OFL 1.1).
- **Made by** Esteban González / the Motion Social Club.

## Licence

MIT for this repo's own code. Fonts: SIL OFL 1.1.
