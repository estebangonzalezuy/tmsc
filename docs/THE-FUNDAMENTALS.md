# the Fundamentals

One page per fundamental — Grids, Typography, Composition, Motion basics —
each built around **figures you play with**: a slider that changes the
columns, a curve you drag, a Replay button. `/fundamentals` is the hub,
`/fundamentals/<slug>` is a page. Free, all of it, in the club's voice.

It is the place to send someone who asks where to begin, and it takes its
shape from interfacecraft.dev: short prose, and a figure wherever a concept
needs to be *felt* rather than shown.

Read this before touching it.

## Why it is not a Learn track

Learn is the club's library: a pay-once shelf, an on-ramp of days, pieces
with a `:::more` line where the paid body starts. The Fundamentals are the
opposite bargain — four short pages, free, finished, with their own front
door and their own nav link — so they got their own section rather than a
fourth shelf inside the library. What they share with Learn is everything
underneath: the markdown, the parser, the `Prose` renderer, and the block
vocabulary, all of which moved into one shared module the day this section
was written.

## The data-vs-copy split

Same split as the Directory, the Stills, the Clips and Learn, for the same
reason: `content/site.json` is rewritten wholesale by the Studio on every
publish, so a page cannot live in it.

- **Written by hand** — `content/fundamentals/sources/<slug>.md`
- **Generated, never hand-edited** — `content/fundamentals/lessons/<slug>.json`
  (one file each) and `content/fundamentals/manifest.json` (cards and counts,
  no bodies)
- **Editable in the Studio** — `content/site.json → fundamentals`: `label`,
  `headline`, `intro`, `note`. The words on the section, and nothing else.

`lib/fundamentals.ts` is server-only, like `lib/learn.ts`. The hub is a
client component and imports the manifest directly.

## Writing a page

One markdown file, frontmatter between `---` fences (`title`, `blurb`,
`minutes`, `updated`, all required), then:

```bash
npm run fundamentals:build
```

The order of the pages is `LESSONS` in `scripts/fundamentals/build.mjs`, and
it is the one place the order is written down. The build refuses a file that
is not listed, a listed slug with no file, an empty body, a `:::more` (every
fundamental is free, so it means nothing here), and a `:::figure` whose id
has no file — with the line number.

### The markdown

The Learn subset, exactly — it is the same parser, `scripts/learn/markdown.mjs`.
`docs/THE-LEARN.md` has the table. Everything from `:::note` to `:::do` works
here, and `:::do` closes every page on purpose: a fundamental should end in
something to go and make.

### `:::figure`

The one block this section added, and its reason to exist:

```
:::figure motion-easing curve=out caption="Same distance, same 1.4 seconds. Only the curve changes."
:::
```

- The first word is the figure's **id**, which is the name of its file in
  `components/fundamentals/figures/`. That convention is what lets the build
  script check a source against the folder without importing anything.
- Every other `key=value` is a **starting value** the figure reads with a
  default (`figures/params.ts`), so a source can open a figure on the setting
  the paragraph above it is talking about. Keys are lowercase letters only —
  the arg parser's rule — and a stray word on the line fails the build rather
  than sliding into a positional.
- `caption="…"`, or the body between the fences, is the caption.

There are two nets against a figure that does not exist, on purpose. The
build script fails with `file:line` when the id has no file. `FigureBlock`
(a server component) throws during prerender when the id has no entry in
`figures/index.ts`, so `next build` fails naming it. Silently dropping a
figure is how a published page quietly loses its point.

Because the parser is shared, a Learn piece may use `:::figure` too. That is
the honest consequence of one vocabulary, and a fine one.

## The figure kit

`components/fundamentals/figures/` — twelve figures and the four files they
share.

- **`Figure.tsx`** is the shell: a `.card` with the stage on top (at a fixed
  aspect when the figure draws, at its own height when it sets type), the
  controls underneath in an `.inset`, and the caption below the card in the
  same muted size `SpecBlock` uses, with a live **readout** on the right — one
  line that says what the current settings mean ("66 characters per line ·
  comfortable"). The stage is a size container, so a figure that sets real
  type can size it in `cqw`.
- **`controls.tsx`** — `Slider`, `Chips`, `Switch`, `Replay`, `Row`. The
  site's own controls, monochrome at rest, lit only under the pointer, the
  Practice page's chip pattern. **Not** the studios' Toolcraft chrome: that
  is instrument furniture with its own font stack and `--tc-*` tokens that
  only exist under `.toolcraft`; a figure sits inside an article. The slider
  is a native range input styled by `.fig-range` in `globals.css`.
- **`params.ts`** — `num`, `pick`, `bool`: read a starting value from the
  source with a default and a range.
- **`useLoop.ts`** — the animation loop, and the one rule worth knowing:

### Each moving figure runs its own loop

The studios and the Learn examples share one page-wide clock
(`components/postlab/clock.ts`), started once per page by `ClockRunner`, and
AGENTS.md is firm that a second runner doubles the speed of everything. The
Fundamentals do not use that clock at all, and a Fundamentals page renders
no runner. A figure has to start over when you press Replay, hold at its end
so the eye can rest, and run at the duration a slider just set; a single
number wrapped every six seconds cannot give it any of that.

So `useLoop({ period, hold, onFrame })` runs its own `requestAnimationFrame`,
and only while the figure is near the viewport and the reader allows motion
— both from the Clips wall's hydration-safe hooks in
`components/clips/useNearViewport.ts`, not rewritten. `onFrame(p)` gets the
cycle's progress and writes to the DOM itself, a few attributes on a few
elements, never React state per frame (the lesson `clock.ts` was built on).
Under `prefers-reduced-motion` a figure holds its end state; Replay still
plays it once, because motion the reader asked for is the point of the page.

Nothing here advances the shared clock, so the "one ClockRunner per page"
rule is not in play. If a figure ever needs to share time with a `:::spec`
example on the same page, that is the moment to revisit this, not before.

### Drawing

SVG or DOM first, canvas only when pixels are the point (none of the twelve
needed it). Type in a figure is real Archivo and Lora through the `font-sans`
and `font-serif` utilities, which apply to SVG `<text>` too. Every figure
renders deterministically on the server from its params — no `window`, no
`matchMedia`, no `Math.random` in render — so there is nothing to mismatch on
hydration.

The easing figures reuse `ease()` from
`components/postlab/nodes/kinetic/easing.ts`; there is no second easing
library. The stagger figure computes its delays in milliseconds directly —
`kinetic/timing.ts`'s `presence()` is a share-of-loop model built to close a
seamless loop, and a figure that teaches milliseconds with a Replay button
wanted the plain arithmetic.

## Adding a figure

1. `components/fundamentals/figures/<id>.tsx`, `"use client"`, exporting a
   component that takes `{ params, caption }` and renders `<Figure>`.
2. An entry in `FIGURES` in `figures/index.ts` (a plain module, not
   `"use client"`, so a page ships only the figures it uses).
3. `:::figure <id> …` in a source, then `npm run fundamentals:build`.

## Adding a page

A file under `content/fundamentals/sources/`, an entry in `LESSONS`, and the
build. No route or component changes; `generateStaticParams` picks it up.
Four is the number on purpose — a fifth has to earn its place against these.

## Navigation

The header and footer carry the link, and `nav:fundamentals` in `hidden[]`
(the Studio's Navigation panel) takes it out of the menus while the pages
stay reachable by URL. It is hidden for now, the owner's call until the
section is ready to be pointed at from the menu; flipping it back on is one
toggle in the Studio. Hiding the `fundamentals` section itself also drops
the link, the way it does for every other page.
