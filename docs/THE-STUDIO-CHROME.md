# the Studio's chrome

How `/postlab` and every tool page are dressed, and why. `/tiles` and
`/kinetics` shared this chrome too until both were retired in the September
2026 rebuild (see `AGENTS.md`'s "the Posts Studio" section); Postlab is the
only studio left in this family. Read this with that section of
`AGENTS.md`, which covers what the studio *does*; this covers what it
*looks like*.

## The decision

The chrome took its shapes from toolcraft.sh once — panels floating with
margin over a full-bleed black stage, nothing docked. In September 2026 it
was redrawn after **Light Rails** (`light-stroke-rail.vercel.app`): the same
control shapes toolcraft.sh gave it, but on the club's own **light** ground,
with the panels **docked** flush to the page's edges as flat columns rather
than floating cards, a real top bar above them, and a number drawn as a dark
filled pill — the field is the slider — instead of a track under a label.
Copied for its shapes, not its content: nothing here draws Light Rails' own
light-ray graphics, and no field it doesn't already have (a freeform easing
curve, "which card is on screen") was invented to fill the gap.

That is still a deliberate exception to the club's design rules, and it is
scoped exactly as before:

- **The chrome breaks two rules on purpose.** Rounded corners and (on the few
  things still floating — a menu, a drawer) a translucent surface are things
  `AGENTS.md` forbids. They are allowed here and nowhere else. The rest of the
  club's rules it keeps: warm ground, white surface, near-black ink, 1px
  hairlines, no gradients, and green — the site's own focus colour — as the
  only colour, on a switch that is on. The near-black number pill is the one
  new departure, and it stays scoped to a value field.
- **The posts never do.** Everything inside the canvas — the sheet, the type,
  the marks, the palette — obeys the club's rules exactly as before. The
  studio is a room; the post is the work. A room may be someone else's shape.
- **The public site never does.** `/`, `/directory`, `/stills` and the rest are
  untouched: white ground, near-black ink, 1px hairlines, colour only on hover.

### Why docked, now

The full-bleed black stage was right for a tool with one panel and one
photograph-sized canvas. It stopped being right once a studio had a real
*gallery* to show alongside it — Postlab's recipes, Tiles' shelf — because a
gallery worth having is worth always being in view, not summoned into a
drawer over the work. Docking the panels turns "a moment, not a place" into
"a place," which is exactly what a persistent rail of recipes is. The
`Drawer` component still exists, still glass, still floating — for what
really is a moment: a sheet rolled from nothing, pasting a spec.

## The tokens

Every value lives once, in `app/globals.css` under `.toolcraft`. Nothing in
`toolcraft.tsx` hardcodes a colour, a radius or a height — it reads a token.

| Token | Value | What it dresses |
| --- | --- | --- |
| `--tc-page` | `var(--background)` | The stage — the club's warm ground |
| `--tc-panel` | `var(--surface)` | A docked column: flat, opaque, no blur |
| `--tc-glass` / `--tc-blur` | `rgba(255 255 255 / .94)`, `20px` | A menu, a drawer, anything still floating |
| `--tc-frame` | `var(--line)` | A floating thing's own edge — the club's hairline |
| `--tc-edge` | `rgba(13 13 13 / .18)` | Borders inside it |
| `--tc-rule` | `rgba(13 13 13 / .12)` | Dividers between groups, a dock's own inner edge |
| `--tc-ink` | `var(--foreground)` | Values, titles |
| `--tc-ink-2` | `#2f2f2f` | Labels |
| `--tc-ink-3` | `var(--muted)` | Group headings, hints, icons |
| `--tc-field` | `rgba(13 13 13 / .035)` | Selects, buttons, pads |
| `--tc-field-on` | `rgba(13 13 13 / .10)` | Chosen segment |
| `--tc-fill-bg` / `--tc-fill-ink` | `#17181b`, `#f4f3ef` | A number's own field — near-black, light type |
| `--tc-fill-quiet` | `rgba(255 255 255 / .14)` | The proportional fill inside that pill |
| `--tc-sel` | `var(--foreground)` | Selected: a swatch's ring, a chosen row |
| `--tc-live` | `var(--accent-green)` | A switch that is on — the one colour |
| `--tc-focus` | `var(--accent-green)` | The focus ring, as on the site |
| `--tc-r` | `10px` | Control radius |
| `--tc-r-lg` | `12px` | Panel radius (floating; a dock is square) |
| `--tc-r-pill` | `14px` | Toolbar radius |
| `--tc-h` | `34px` | Control height |
| `--tc-shadow` | `var(--shadow)` | A light panel on a light page needs the club's own lift to separate |

Type is the browser UI stack at 12.5px for labels and 13px for fields —
**not** Archivo. The chrome is instrument furniture; the club's typefaces
belong to the work, and a post rendered in Lora sitting inside a panel also
set in Lora is a post you cannot see.

## The anatomy

```
┌──────────────────────────────────────────────────────────────────────┐
│ ✦ the Posts Studio                          Import   Share   Export  │  ← TopBar
├───────────────┬────────────────────────────────────┬─────────────────┤
│ looks     roll │                                    │ the Posts … ⋯ ⌃ │  ← inspector,
│ LAYERS         │                                    ├─────────────────┤    docked right
│ ◉ 02 rings     │                                    │ CANVAS        ⌃ │
│ ◉ 01 plain     │                                    │ aspect ratio    │
│ + layer        │        the canvas                  │ ▾ 4:5           │
├───────────────┤        (still full bleed            ├─────────────────┤
│ RECIPES        │         between the docks)          │ SOURCE        ⌃ │
│ ▢ ▢ ▢          │                                     │ …               │
│ ▢ ▢ ▢          │  ┌────────┐    ╭──────────────╮    ├─────────────────┤
│ ▢ ▢ ▢          │  │filmstrip│    │ ↺↻│−120%+│⏮▶│    │ ⤓ Export PNG    │
└───────────────┴────────────────────────────────────┴─────────────────┘
```

- **The top bar** — full width, docked, flat. The mark, the title, then the
  primary actions right-aligned. Toolcraft had no menu bar and stood by it —
  "six menus floating over the canvas are six things standing where the work
  is" — which was true when nothing was docked. It's a real bar now because
  there's a real place for it to live that isn't over the canvas.
- **The left dock** — one panel, full height, flush to the edge. Postlab
  puts its add-a-node rail there, one `RailItem` a `NodeKind`; a retired
  tool page with nothing gallery-shaped to put there didn't get a left dock
  at all — an empty column is worse than no column.
- **The right dock** — the inspector, unchanged in what it holds: canvas,
  source, type, marks, effect, colour, export at the foot, one column read
  downwards. Only how it's drawn changed — flat and flush instead of a
  floating card, its numbers dark filled pills instead of a track underneath.
- **Toolbar** — bottom, centred over the canvas span between the two docks
  (not the whole viewport) — undo, redo · zoom out, %, zoom in · start,
  play · guides, tracks.
- **Filmstrip** — bottom, just clear of the left dock, the same floating
  glass, only when the post has more than one slide.
- **Drawers** — a sheet rolled from nothing, paste-a-spec. Full-width glass
  over the canvas still. Moments, not places — the gallery graduated out of
  this category, so recipes are no longer one.

`Panel` takes a `dock="left" | "right"` prop for the two columns; leave it
unset for something that's still genuinely a floating card. Below the `md:`
breakpoint every dock stacks full-width in normal document flow instead,
same as before — `Section` and `Block` still start folded there
(`useCompact()`), so a tall stack of docked groups still reads as short taps,
not a scroll.

## Getting it pixel-perfect

Taste is not a method. The method is:

1. `npx next dev -p 3124`, drive `/postlab` in Chromium at the reference
   screenshot's viewport.
2. Screenshot ours, put it beside the reference, and diff the two by eye at
   200% on the panel's top 400px — that is where every metric shows.
3. Fix the token, not the component.

`scripts/chrome-diff.mjs` does step 1 and 2 and writes a side-by-side PNG.
Reference captures live in `docs/reference/toolcraft/` — they are the spec
for the *shapes* (the pill, the slider, the fold) and still hold; they are
not a picture of the current stage colour or dock, which this file
describes instead.

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
