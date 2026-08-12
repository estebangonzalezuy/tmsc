# the Studio's chrome

How `/postlab`, `/tools` and every tool page are dressed, and why. Read this
with the "the Posts Studio" section of `AGENTS.md`, which covers what the
studio *does*; this covers what it *looks like*.

## The decision

The chrome is a faithful reproduction of **toolcraft.sh** — dark glass panels
floating over a full-bleed canvas, rounded corners, a pill toolbar at the
bottom. Not "inspired by": the same metrics, the same control shapes, the same
order.

That is a deliberate exception to the club's design rules, and it is scoped
precisely:

- **The chrome breaks the rules on purpose.** Rounded corners, a shadow, a
  translucent surface and a blue switch are all things `AGENTS.md` forbids.
  They are allowed here and nowhere else.
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
| `--tc-glass` | `rgba(18 20 24 / .66)` | Panel, toolbar, drawer surface |
| `--tc-blur` | `28px` | The `backdrop-filter` behind them |
| `--tc-edge` | `rgba(255 255 255 / .10)` | Every 1px border |
| `--tc-rule` | `rgba(255 255 255 / .07)` | Dividers between groups |
| `--tc-ink` | `rgba(255 255 255 / .95)` | Values, titles |
| `--tc-ink-2` | `rgba(255 255 255 / .72)` | Labels |
| `--tc-ink-3` | `rgba(255 255 255 / .45)` | Group headings, hints, icons |
| `--tc-field` | `rgba(255 255 255 / .06)` | Selects, buttons, pads |
| `--tc-field-on` | `rgba(255 255 255 / .14)` | Chosen segment, primary button |
| `--tc-track` | `rgba(255 255 255 / .14)` | Slider track, unfilled |
| `--tc-live` | `#3b82f6` | A switch that is on — the one colour |
| `--tc-r` | `10px` | Control radius |
| `--tc-r-lg` | `12px` | Panel radius |
| `--tc-r-pill` | `14px` | Toolbar radius |
| `--tc-h` | `34px` | Control height |
| `--tc-shadow` | `0 8px 32px rgba(0 0 0 / .35)` | Under anything that floats |

Type is the browser UI stack at 12.5px for labels and 13px for fields —
**not** Archivo. The chrome is instrument furniture; the club's typefaces
belong to the work, and a post rendered in Lora sitting inside a panel also
set in Lora is a post you cannot see.

## The anatomy

```
┌──────────────────────────────────────────────┬───────────────┐
│                                              │  the Posts …  │  ← panel: title,
│                                              ├───────────────┤    ⋯ menu, reset,
│                                              │  CANVAS     ⌃ │    fold
│              the canvas, full bleed          │  aspect ratio │
│              (it continues under             │  ▾ 4:5        │
│               the panel)                     │  …            │
│                                              ├───────────────┤
│                                              │  SOURCE     ⌃ │
│  ┌────────┐                                  │  …            │
│  │filmstrip│      ╭──────────────────╮       ├───────────────┤
│  └────────┘      │ ↺ ↻ │ − 120% + │ ⏮ ▶ │    │ ⤒ Export PNG  │
└───────────────────╰──────────────────╯───────┴───────────────┘
```

- **Panel** — top right, 16px inset, 320px wide, floor to ceiling. Header:
  title, `⋯`, reset, fold. Body scrolls. Footer holds the export.
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
