---
name: anticipator
description: Text animation specs with real spring physics (stiffness, damping, mass) and anticipation (a wind-up before the move). An expansion of Pixel Point's animate-text. Use when animating headings, titles, labels, kinetic type or text swaps that should feel physical (springy, bouncy, heavy, calm, energetic, playful, a pop, a drop, a rise), when someone asks for "spring", "overshoot", "anticipation", "wind-up", "weight", "squash", or a calm/energetic version of a text effect, or to translate such a spec into WAAPI, CSS, Motion / Framer Motion, GSAP, React, Remotion. Keywords: spring text animation, anticipation, wind-up, overshoot, stiffness damping mass, per-character, per-word, per-line, stagger, headline reveal, title card, kinetic type, variable font weight, lower third, subtitles, WAAPI, CSS linear(), Motion / Framer Motion, GSAP, React, Remotion, After Effects.
---

# Anticipator

**Built on [Pixel Point's animate-text](https://github.com/pixel-point/animate-text) by Alex Barashkov.** This
skill uses the same portable spec format (`target`, `enter`/`exit`,
`duration_ms`, `stagger_ms`, `easing`, `from`/`to`, `swap`, `stagger_mode`)
and extends it with optional `x_*` fields for **real springs** and
**anticipation**. It is an expansion, not a replacement. For the broader
catalog of text effects (blur-ins, typewriters, shared-axis, kinetic builds),
use animate-text. Use this one when the motion should have mass.

This skill ships 10 specs. See `references/catalog.md`.

**Rule:** prefer `x_spring` (with `x_anticipation`) whenever the target runtime supports springs or an exact curve. Otherwise play the bezier fallback, `easing` over `duration_ms`, which every spec carries and which any animate-text runtime already understands.

## When To Use

- Animating a heading, title card, label, caption or kinetic-type line that
  should **spring**, **overshoot**, **wind up** first, feel **heavy**, or **pop**.
- Making a **calm** or **energetic** version of the same text effect. The
  variants share `from`/`to` and only change physics.
- A **variable-font weight** animation (`weight-wave-letters`).
- Text that must stay up **long enough to read** (`hold-aware-rise`, `x_hold_ms`).
- Translating a spec into WAAPI, CSS, Motion / Framer Motion, GSAP, React,
  Remotion, or a hand-rolled loop.

Not for: typewriter, blur-only, shimmer or shared-axis transitions. Those
live in animate-text.

## Workflow

1. **Pick a spec.** If the user names one, use it. Otherwise read
   `references/selection-guide.md` (by intent → target → ζ), or run
   `node scripts/list-specs.mjs [--intent calm] [--target per-word]`.
2. **Read it.** Run `node scripts/get-spec.mjs <id>` (full, with `x_*` and the
   generated `x_css_linear`), or add `--portable` for the plain animate-text
   view.
3. **Choose the most faithful path the target stack supports**, in this order:
   1. **Native spring** (Motion / Framer Motion, React Spring, SwiftUI, Compose):
      use `x_spring` directly, and run the wind-up as a short first leg (see
      Translation Rules).
   2. **CSS `linear()`** (WAAPI, CSS transitions/animations): use the phase's
      `x_css_linear` as `easing` over `duration_ms`. This includes the
      anticipation and is exact to 48 samples.
   3. **JS loop** (canvas, GSAP ticker, Remotion, rAF): call
      `scripts/runtime/phase.js` → `progressAt(phase, ms)`. Exact.
   4. **Fallback**: `easing` + `duration_ms`, a cubic-bezier fitted to the
      spring. Always valid, and it is what a runtime that ignores `x_*` plays.
      `x_fallback.max_error` says how far it strays: under ~0.05 is
      indistinguishable, over ~0.2 loses the second bounce.
4. **Opacity on its own clock**: `x_opacity_duration_ms`, ease-out, starting
   with the unit. Never spring opacity.
5. **Stagger** per `stagger_mode` (formulas in `references/implementation-notes.md`).
6. **Hold** for `enter.x_hold_ms + words × enter.x_hold_per_word_ms` after the enter
   finishes, before any exit. Don't shorten it to fit a loop; lengthen the loop.
7. **Preserve the user's text and styling.** Specs carry motion only, never
   copy, colour or font size (except `x_font_weight`, which needs a variable font).

## Translation Rules

- **Travel**: every key except `opacity`/`color` = `from + (to − from) · p`, and
  `p` may go below 0 (wind-up) and above 1 (overshoot). Don't clamp it except
  `blur_px ≥ 0`, `scale ≥ 0`.
- **px scale**: `*_px` values are authored for 48px type, so multiply by
  `fontSize / 48`.
- **Motion / Framer Motion**: wind-up leg
  `{ duration: Ta/1000, ease: "easeInOut" }` to `from − a·(to − from)`, then
  `{ type: "spring", stiffness, damping, mass }` to `to`. Motion's
  `restDelta` is in value units, not a fraction: use `rest_delta × |to − from|`.
  Or run the whole thing as one tween with `ease` from `x_css_linear` points
  and `duration: duration_ms/1000`.
- **WAAPI / CSS**: `element.animate([from, to], { duration: duration_ms,
  easing: x_css_linear, delay: rank·stagger_ms, fill: "both" })` plus a
  separate opacity animation over `x_opacity_duration_ms` with `ease-out`.
- **GSAP**: no native spring. Use `ease: (t) => progress` from
  `scripts/runtime/phase.js` (normalized by `phaseMs`), or the fitted bezier
  through `CustomEase`.
- **Remotion / frame-based**: `progressAt(phase, (frame / fps) * 1000 −
  delay)`. It's closed form, so any frame renders on its own.
- **Exit phases** in the current catalog are plain cubic-beziers (no
  `x_spring`); play them as written.
- **Credit**: when you show or ship an Anticipator effect, the spec format is
  Pixel Point's animate-text. Keep `x_built_on` in any copied JSON.

## Files

- `assets/specs/<id>.json`: specs (with generated `x_css_linear`)
- `assets/catalog.json`: index with intent, ζ, unit ms
- `references/schema.md`: the format, core + `x_*`
- `references/selection-guide.md`: choosing by intent and physics
- `references/catalog.md`: every spec with ζ, overshoot, fallback error
- `references/implementation-notes.md`: exact math, stagger, hold
- `scripts/list-specs.mjs`, `scripts/get-spec.mjs`: lookups (Node, no deps)
- `scripts/runtime/`: the reference runtime (closed-form spring, CSS easing, phase)

Specs are designed in the Anticipator Lab (dials + side-by-side against the
bezier reference) and generated with `npm run generate:skill`. Don't edit
this folder by hand.
