# the Studio's chrome

How `/postlab`, `/tools` and every tool page are dressed, and why. Read this
with the "the Posts Studio" section of `AGENTS.md`, which covers what the
studio *does*; this covers what it *looks like*.

## The decision

The chrome takes its **shapes** from toolcraft.sh — panels floating over a
full-bleed canvas, rounded corners, a full-width track under its label, a pill
switch, a pill toolbar, the order of the groups — and its **colour** from the
club: white panels, near-black ink, hairline rules, on the club's own black
stage. Not "inspired by" on the geometry: the same metrics, the same control
shapes, the same order. Copied exactly first, then dressed in the club's
palette, which is why the second step was one CSS block.

That is a deliberate exception to the club's design rules, and it is scoped
precisely:

- **The chrome breaks two rules on purpose.** Rounded corners and a
  translucent surface are things `AGENTS.md` forbids. They are allowed here and
  nowhere else. The rest of the club's rules it keeps: white ground, near-black
  ink, 1px hairlines, no shadows, no gradients, and green — the site's own focus
  colour — as the only colour, on a switch that is on.
- **The posts never do.** Everything inside the canvas — the sheet, the type,
  the marks, the palette — obeys the club's rules exactly as before. The
  studio is a room; the post is the work. A room may be someone else's shape.
- **The public site never does.** `/`, `/directory`, `/stills` and the rest are
  untouched: white ground, near-black ink, 1px hairlines, colour only on hover.

### Why copy rather than interpret

Because the club's own white-chrome-on-black version was *legible but not
convincing* — it read as a settings page floating over a picture rather than as
an instrument. toolcraft.sh gets three things right that are hard to arrive at
by taste:

1. The canvas is the whole window, including under the panel. Nothing is
   docked, so the artwork is never squeezed into the leftovers.
2. The panel is one column of named groups in a fixed order, each foldable,
   with the one button you press at the end pinned to its foot.
3. Everything else is a floating pill. There is no menu bar, no sidebar, no
   tab strip — one panel, one toolbar, and whatever the tool needs at the
   corners.

Copy it exactly, then decide what to bring back toward the club. Doing it in
that order means the second step is a token swap, not a rewrite.

## The tokens

Every value lives once, in `app/globals.css` under `.toolcraft`. Nothing in
`toolcraft.tsx` hardcodes a colour, a radius or a height — it reads a token. A
"club" skin later is that block, redefined.

| Token | Value | What it dresses |
| --- | --- | --- |
| `--tc-glass` | `rgba(255 255 255 / .94)` | Panel, toolbar, drawer surface |
| `--tc-blur` | `20px` | The `backdrop-filter` behind them |
| `--tc-frame` | `var(--line)` | A floating thing's own edge — the club's hairline |
| `--tc-edge` | `rgba(13 13 13 / .18)` | Borders inside it |
| `--tc-rule` | `rgba(13 13 13 / .12)` | Dividers between groups |
| `--tc-ink` | `var(--foreground)` | Values, titles |
| `--tc-ink-2` | `#2f2f2f` | Labels |
| `--tc-ink-3` | `var(--muted)` | Group headings, hints, icons |
| `--tc-field` | `rgba(13 13 13 / .035)` | Selects, buttons, pads |
| `--tc-field-on` | `rgba(13 13 13 / .10)` | Chosen segment, primary button |
| `--tc-track` | `rgba(13 13 13 / .16)` | Slider track, unfilled |
| `--tc-fill` / `--tc-thumb` | `var(--foreground)` | Travelled track, handle |
| `--tc-sel` | `var(--foreground)` | Selected: a swatch's ring, a chosen row |
| `--tc-live` | `var(--accent-green)` | A switch that is on — the one colour |
| `--tc-focus` | `var(--accent-green)` | The focus ring, as on the site |
| `--tc-r` | `10px` | Control radius |
| `--tc-r-lg` | `12px` | Panel radius |
| `--tc-r-pill` | `14px` | Toolbar radius |
| `--tc-h` | `34px` | Control height |
| `--tc-shadow` | `none` | The club has no shadows; black separates white |

The dark-glass values are kept in a comment beside the first of these, so the
instrument can be put back in the reference's own colours in one edit.

Type is the browser UI stack at 12.5px for labels and 13px for fields —
**not** Archivo. The chrome is instrument furniture; the club's typefaces
belong to the work, and a post rendered in Lora sitting inside a panel also
set in Lora is a post you cannot see.

## The anatomy

```
┌──────────────────────────────────────────────┬───────────────┐
┌─────────────┬────────────────────────────────┬───────────────┐
│ layers  2/4 │                                │  the Posts …  │  ← inspector:
│ ◉ 02 rings  │                                ├───────────────┤    title, ⋯,
│ ◉ 01 plain  │                                │  CANVAS     ⌃ │    reset, fold
│ + layer     │      the canvas, full bleed    │  aspect ratio │
└─────────────┤      (it continues under       │  ▾ 4:5        │
│              │       both panels)             │  …            │
│                                              ├───────────────┤
│                                              │  SOURCE     ⌃ │
│  ┌────────┐                                  │  …            │
│  │filmstrip│      ╭──────────────────╮       ├───────────────┤
│  └────────┘      │ ↺ ↻ │ − 120% + │ ⏮ ▶ │    │ ⤒ Export PNG  │
└───────────────────╰──────────────────╯───────┴───────────────┘
```

- **The inspector** — top right, 16px inset, 320px wide, floor to ceiling.
  Header: title, `⋯`, reset, fold. Body scrolls. Footer holds the export.
- **The layers panel** — top left, 300px, one `ListRow` a layer with a live
  thumbnail of what that layer alone draws, front of the post at the top. It
  was a dropdown inside the effect group, which is the one place a stack cannot
  live: you can't see the order of a thing you have to open a menu to read.
  Picking, hiding, soloing, reordering and deleting are all here, and they act
  on **the row you pressed** rather than on the layer being edited.
- **The `⋯` menu** is where the old menu bar went. toolcraft has no menu bar,
  so neither do we: everything that was under Post / Slide / Layer / View / Go
  is one menu hanging off the panel header.
- **Toolbar** — bottom centre, a pill: undo, redo · zoom out, %, zoom in ·
  start, play · guides, tracks.
- **Filmstrip** — bottom left, the same glass, only when the post has more
  than one slide.
- **Drawers** — recipes, rolled looks, paste-a-spec. Full-width glass over the
  canvas. Moments, not places.

## Getting it pixel-perfect

Taste is not a method. The method is:

1. `npx next dev -p 3124`, drive `/postlab` in Chromium at the reference
   screenshot's viewport.
2. Screenshot ours, put it beside the reference, and diff the two by eye at
   200% on the panel's top 400px — that is where every metric shows.
3. Fix the token, not the component.

`scripts/chrome-diff.mjs` does step 1 and 2 and writes a side-by-side PNG.
Reference captures live in `docs/reference/toolcraft/` — they are the spec, so
don't delete them when the design settles.

## Media: pictures, film and GIFs

The studio takes a file in three shapes, and all three end up as the same
thing: **a grayscale source the club's screen can dither.**

| Kind | Stored as | Travels in a link? |
| --- | --- | --- |
| Image | `local:<id>` — a data URL in `localStorage` | No |
| Image on this site | `/path.png` | Yes |
| Film or GIF | `clip:<id>` — grayscale frames in IndexedDB | No |

`components/postlab/clips.ts` owns the film half:

- **Decode once, on the way in.** A picked file is sampled to at most 512px on
  its long edge and at most 96 frames, and each frame is kept as one
  `Uint8ClampedArray` of luminance. 96 frames at 512×288 is 14MB — a video
  element and a live `drawImage` per frame would be neither seekable at export
  time nor deterministic.
- **A clip loops by construction.** The frame shown at loop position `p` is
  `floor(p · cycles · frames) mod frames`, with `cycles` a whole number. The
  last frame runs into the first with no seam, which is the same contract every
  travelling number in this studio keeps.
- **The exporter never films the page.** It asks for the frame at each exact
  moment, so two exports of the same post are still byte-identical.
- **Nothing is uploaded.** Same bargain as the photo and the GitHub token: the
  file stays in that browser, and the UI says so where the file is picked.

A clip is not a layer type. It is a `src` on a `forms` layer whose `pattern` is
`photo`, so it mixes, folds, inks and screens exactly like every other source —
one pipeline, no second render pass. That is the whole reason it is worth
having.
