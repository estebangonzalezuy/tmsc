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
  control panel for the content cycle (the box you write a thought into,
  starts the GitHub Actions jobs, shows what's running). Same zero-config
  contract as the Studio: the token is pasted in the browser and every call
  goes straight to api.github.com. Never move it server-side — and that is
  also why the Desk *writes* to the club's data but never reads it back.
  Notion's API refuses browser requests, so a page that listed the Pipeline
  would need a Notion token on Vercel, which is the one thing this
  architecture is built to avoid. **Write on the site, read in Notion.**
  The box has two speeds and only one of them needs the token: "Make it"
  hands the words to `/tools/note` through `encodeParams` and never touches
  the network, so it renders above the setup and works on a device that has
  never been set up; "Ask the club" dispatches the `capture` job.
- `lib/data.ts` — typed re-exports of the JSON for server components.

## Design rules

- **Black and white by default.** `--background` white, `--foreground`
  near-black, grays for hierarchy. Every surface, every block of type and
  every border stays monochrome.
- **Colour only ever answers a pointer.** At rest a page is black, white and
  gray — nothing on the site is coloured until it is hovered or focused. The
  palette lives in two places kept in step by hand: `PALETTE` in
  `lib/postlab.ts` (the studio's exporter needs it at module scope) and the
  `--accent*` variables in `app/globals.css`.
- **A hover picks its colour from the whole palette**, so a grid lights up
  differently as you cross it. Don't write hover colours by hand: use
  `accentHover(key)` for anything that fills (cards, rows) and
  `accentHoverText(key)` for a link that only recolours its type, both from
  `Motifs.tsx`. The key is something stable about the item, not its index, so
  a card keeps its colour between visits. Green is the default the bare
  `.accent-hover` class falls back to, and the focus ring.
- **Fill and type are paired, never mixed.** Each `.accent-*-hover` class in
  globals.css sets `--hover-fill` *and* `--hover-type` together; periwinkle
  carries near-black type, the saturated ones carry white, and it never
  appears as type on white. A child inside a filled block needs
  `accent-hover-sub` to follow that pairing — plain `text-muted` would
  survive the fill and go unreadable.
- Anything with its own ground inside a hovering block must pin its own
  colour (see `CircleLetter`'s `text-foreground`), or the glyph inherits the
  block's hover type and disappears.
- Never colour body copy, a heading, a border or a section background, and
  never introduce a hex outside the palette. the Posts Studio is still the one
  place colour can fill a surface without being asked — and the one place with
  a second list of hexes: `GROUNDS` in `lib/postlab.ts`, the neutral papers a
  *post* is printed on. They are not accents and they never touch the site.
- **Fonts:** Archivo (sans, UI/body) and Lora (serif, display/italic
  emphasis) via `next/font`, both loaded with their real italics — the studio
  mixes roman and italic inside one headline, and a browser-slanted roman
  gives that away immediately. No other fonts.
- **Motifs:** outlined circles, circled letters, orbital rings, boxed
  headlines, underlined labels — the components in `Motifs.tsx`. Don't
  introduce new decorative elements (shadows, gradients, rounded cards,
  icons) — extend the existing motif language instead.
- 1px `border-line` borders separate sections; `gap-px bg-line` grids make
  hairline tables.

## the Posts Studio (`/postlab`)

An internal design tool (like `/studio`, not in the nav) for generating the
club's Instagram posts, carousels, and reels, with PNG, video, and GIF export.

**Two registers, one spec.** The tool began as a dithering instrument and grew
the rest of Paper Shaders; in August 2026 it grew the half that most posts
actually need — the *sheet*.

- **the sheet** — ruled paper, an outlined oval label, an editorial headline
  that mixes roman and italic, small labels in the corners. A ground from
  `GROUNDS` (paper, ash, cream, slate — neutrals, not the palette), a `grid`
  column count, `veil: 0`, one layer of type `"none"`. This is the club's
  default register and the one the recipes lead with.
- **the club's pixels** — the dithered graphics below, on the sheet or
  instead of it.

Three things carry the sheet, all of them in `overlay.ts` and all absent by
default:

- **The ruling.** `grid` columns in square cells, cut equally top and bottom;
  `gridAlpha` for presence, `gridTop` to draw it over the words. It belongs to
  the paper, not to the type, so it survives `text: false`.
- **Emphasis is markup, not a field.** `*a run like this*` in a `title` flips
  that run to the other voice — italic in a roman headline, roman in an italic
  one. It happens mid-sentence, so it can't be a switch. Type is therefore
  measured a word at a time (`Word`, `Face`, `wrap`, `drawWords`), and the
  fit-to-frame search goes through the same measurement.
- **`tag` and `note`.** The oval above the headline, and the top-right corner
  label. There is one corner, so a `note` makes the circled mark stand down.

**Marks and their deformers.** `shapes[]` on a slide is the club's motif
language as placed objects — circle, oval, square, triangle, line, bar, arc,
cross, bracket — each with a position, a size, a weight (0 fills it), a turn, an
ink and `under` to put it behind the words. They are drawn in `overlay.ts`
alongside the type because that is what they are compositionally, and like the
ruling they survive `text: false`, so a sheet of marks with no words is a post.

What makes them worth having is the **deformers**: `repeat` copies a mark,
`along` lays the copies out (row, column, arc, ring), and `spread`, `jitter`,
`twist` and `taper` bend the row of them. One mark becomes a pattern without
becoming a second layer, which is the same rule the forms renderer follows —
combine before you render, never add a pass. `jitter` is seeded (`seed`), so a
scattered pattern is a design decision and never crawls.

**Loops are named motion.** `LOOPS` in `lib/postlab.ts` — drift, breathe, pulse,
swing, sweep, march, blink, far-and-back — is a wave plus a whole number of
trips plus how far to travel across the parameter's own range. `applyLoop`
writes the `Motion`, `loopOf` reads one back, so the studio can offer motion by
name instead of by arithmetic and still show "custom" for a hand-written spec.
Every number on a layer *and* on a shape takes one, which is what makes motion
plug-and-play here.

**Nothing is added still, and nothing shipped is still.** A mark, a layer, an
effect and a layer switched to draw something else all arrive with a loop
already plugged in — `addShape`, `addLayer`, `addFilter`, `setShaderType` and
`reroll` each attach one — because this is a studio for motion and a still
thing is the exception. `randomSlide` gives every rolled layer a travelling
number, and **every recipe that draws a graphic moves it**; the recipes that
don't move are the pure sheets, which carry a `none` layer and draw no graphic
at all. An effect's numbers travel like any other: `resolveFilter` hands the
chain already-resolved values, so an effect still never reads the clock itself
and still can't be the reason a loop stops closing.

That rule is also why nothing in the tool *offers* the WebGL dithering or the
clean shaders any more — they animate but they don't close their loop, so a
recipe or a roll would be handing over a post with a seam in it. They stay
selectable under `draws`, because links from months ago name them and the spec
is backwards-compatible; just don't reach for one when writing a recipe.

`SHAPE_LOOPS` is the same idea one level up: sway, spin, breathe, pulse, drift,
bloom, unfold, shiver — a named loop for a *whole mark*, which is the control
the studio leads with. **A mark arrives already moving** (a frame breathes, a
mark sways) because this is a studio for motion and a still mark is the
exception; "still" is the first option in the same dropdown. `shapeLoopOf` names
what a mark is running, and while it's running a named loop the per-number loop
rows stay folded away — one control at a time, not two views of the same wave.
Everything that moves gets a track in `Tracks.tsx`, marks included.

Anything with a stack — effects on a layer, marks on a slide — is drawn as
`Block`s in Toolcraft: a switch, a name, reorder, remove, and its numbers
inside. An effect switched off (`mute`) stays in the chain rather than being
deleted, so you can take one out and see what it was doing.

A fourth thing makes the *type* move rather than the background: **`count`**,
a number travelling through whole values over the loop, with every `#` in the
slide's words replaced by its current value. Each value gets an equal slice and
the last ends where the first begins, so it loops like everything else; the
headline is measured against the widest value it will ever show, because type
that resized itself as a digit dropped would jump on every tick. That is what a
countdown is, and `/tools` is where one gets made.

Both families of graphics remain, with filters between them:

- **pixelated** — Paper Shaders' Dithering and the club's own ordered-dither
  forms renderer (`components/postlab/generative.ts`, canvas 2D). Hard
  edges, thresholded, loops seamlessly.
- **clean** — the rest of Paper Shaders (`PaperLayer.tsx`): liquid metal,
  mesh gradient, gem smoke, god rays, water, voronoi, warp and the others.
  They draw an image rather than a screen of pixels.
- **filters** (`filters.ts`) run over a layer *after* it is drawn, and
  `pixelate` is one of them. That is the whole point of the split: the
  club's screen is no longer welded to the thing that drew the image, so a
  liquid-metal layer can come out in the club's pixels. Drawing and
  screening are separate decisions now.

Filters take no time as an input — not even the grain — so a filter can
never be the reason a loop stops closing. Keep it that way.

- `lib/postlab.ts` — the **PostSpec** model: types, shader registry,
  presets, base64url encode/decode. The spec travels in the URL
  (`/postlab#spec=<encoded>`), so anything that writes JSON can deep-link a
  ready post.
- **The stage is the whole window, and it is black.** Nothing is docked: the
  post sits in the middle of the club's own ink and every control floats over
  it, which is the one thing a studio has to get right — the post is never
  squeezed into what's left after the furniture. Top left is the identity and
  the menus (what you *do*), top right is one panel (what you *set*), bottom
  left the filmstrip, bottom centre the toolbar: undo, zoom, transport, guides,
  the loop.
  - **The layers panel is top left** — one row a layer with a live thumbnail of
    what that layer alone draws, front of the post at the top, and pick / hide /
    solo / reorder / delete on the row you pressed. It was a dropdown inside the
    effect group once, which is the one place a stack cannot live: you can't see
    the order of a thing you have to open a menu to read.
  - **The inspector is top right, one column, in Toolcraft's order:** `canvas`
    (the format, the resolution, the loop) · `source` (the sheet, its media and
    its ruling) · `type` (the
    words, and their setting, parts, counter and screen as folded `Block`s) ·
    `marks` · `effect` (the layer, its filters, where it sits) · `colour` (the
    layer's ink and the palette) — and **export in the footer**, where a tool's
    way out belongs. Read downwards; a `Section` folds and shows a summary when
    closed, and a `Block` carries its summary in its own title.
    It had tabs once, and a tab is a second place to look for something that
    only ever lived in one place. Put a new control where its subject already
    is rather than adding another place to look.
  - **Big grids of pictures go over the stage**: `Drawer` holds the recipe
    shelf, the rolled looks and the paste-a-spec box. Moments, not places.
  - `Tracks.tsx` is the loop in tracks — transport, ruler, a lane per travelling
    parameter with its **wave drawn across the loop**, marks included. It floats
    above the toolbar and is off until asked for.
  - The filmstrip is `Poster.tsx` drawing every slide for real, and **live**: a
    thumbnail follows the playhead rather than holding frame zero, because a
    post in this studio moves.
- **Toolcraft** (`components/postlab/toolcraft.tsx`) is the chrome all of it is
  built from — toolcraft.sh's *shapes* in the club's own colours: panels
  floating over a full-bleed canvas, the same metrics and control shapes and
  order, drawn in white with near-black ink and hairline rules on the club's
  black stage. The reference was copied exactly first and then dressed, which is
  why the dressing was one CSS block. It gets one thing exactly right: a tool is
  a canvas with chrome floating over it. Every colour, radius and height is a
  token in `app/globals.css` under `.toolcraft`, and nothing in the component
  file hardcodes one — putting the instrument back in the reference's own dark
  glass is that block and nothing else, and the dark values are kept in a comment
  beside it. **The two rules suspended inside the chrome stay inside it**:
  rounded corners and a translucent surface. Everything else is the club's —
  white ground, near-black ink, 1px hairlines, no shadows, and green, the site's
  own focus colour, as the only colour, on a switch that is on. `docs/THE-STUDIO-CHROME.md` is the spec. The anatomy, and it is the
  same everywhere:
  - `Panel` — a floating card: title, reset, fold, a scrolling body, and a
    footer holding the one button you press at the end
  - `Section` — an uppercase label with its own reset and fold
  - `Slider` — label left, value right, **track full width underneath**; never a
    slider squeezed between two labels. `Num` inside it drags as well as types
  - `Toggle` (a pill), `Segmented` (2-4 choices), `Select` (past four),
    `Cols` (two controls on one line)
  - `Range` — two handles on one track. A number that travels is drawn with it
    rather than as two sliders: where it rests and where it goes are one
    journey, and `cross` lets the handles pass each other so a number can
    travel downwards
  - `Dots` (colour as circles), `ColorRow` (swatch + hex + auto + remove — a
    palette is a two-column list of these), `XYPad` (two numbers that are one
    place), `Dropzone`
  - `Block` — one thing in a stack: switch, name, reorder, remove, numbers
  - `Menu` / `MenuItem` / `MenuRow` — the things you do
  - `Toolbar`, `Drawer`, `Help`, `Primary`
  Anything that floats carries `tc-float`, anything with its own ground carries
  `tc-field`, and a slider's track is drawn by two spans behind a transparent
  native input — never by the input itself, which paints over the fill. Add to
  Toolcraft rather than styling a control in place, and use the same kit on every
  tool page. `/tools` — the wall — is *not* chrome: it is a page of the site and
  stays in the club's white, hairlines and accent hovers. The wall is the club's;
  the instrument is the instrument.
- `components/postlab/clock.ts` — the playhead, deliberately outside React.
  Every canvas subscribes and draws itself; only the readout under the stage
  asks React for the number. It was state once, and re-rendering the tool
  sixty times a second cost about a third of the frame rate (29fps to 21 on
  a two-layer post, measured) — so keep new per-frame work subscribing, not
  re-rendering.
- `components/postlab/` — `PostLab.tsx` (the studio: state and layout),
  `toolcraft.tsx` (its chrome), `Stage.tsx` (the post on screen, shared with the
  tools), `useExports.ts` (getting one out), `Poster.tsx` (a real thumbnail),
  `Tracks.tsx` (the timeline), `ShaderLayer.tsx` (spec → Paper Shaders, tones
  from the slide theme or the palette when `color` is on), `overlay.ts`
  (canvas 2D type/motif renderer shared by preview and export), `exporter.ts`
  (PNG + MediaRecorder video + `paintPoster` for the thumbnails).
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
- **A photograph is a form, not a layer type — and so is a film.**
  `pattern: "photo"` reads the layer's `src`, samples it at the cell size and
  pushes it through the same threshold, so it mixes, folds and inks like anything
  else. The picture itself never enters the spec:
  `components/postlab/photos.ts` keeps a picked file in that browser under
  `local:<id>`, the same bargain the Studio and the Desk make with the token. A
  `src` starting with `/` is a path on this site and does travel in a link —
  cross-origin is refused on purpose, because a tainted canvas breaks the dither,
  the export and the GIF at once and does it silently.
  `components/postlab/clips.ts` does the same for a **film or a GIF** under
  `clip:<id>`: decoded once on the way in to at most 96 grayscale frames at 512px
  on the long edge, kept in IndexedDB, and sampled straight into the cell grid
  with no canvas in between. Which frame is `floor(p · clipCycles · n) mod n`
  with whole `clipCycles`, so a film can no more open a seam than a travelling
  number can, and the exporter stays a function of the frame number. Uploading is
  one door — the `media` block in `source` takes a picture, a film or a GIF and
  puts the layer on `photo` itself, because a file *is* the choice of what to
  draw.
- **A style is a slide without its words** — `styleOf` / `applyStyle` /
  `varyStyle`, plus `randomSlide` for a look rolled from nothing (the
  generate sheet). A roll decides the graphic only: it never touches
  `veil` or the type settings, because whether the words can be read is
  the owner's call and not the dice's. Varying keeps every *decision* (form, mix, fold, ink) and
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

## the Kinetics (`/kinetics`)

The club's second studio, and a different argument from the first one. The
Posts Studio treats type as a layer *over* a graphic. Here **the type is the
graphic** — there is no background layer in any scene, because the words are
the picture. It is not a mode of the other studio and does not share its spec.

- `lib/kinetics.ts` — the **KineticSpec**, the easing library, `presence` /
  `queue` (the stagger model), the palettes, and base64url encode/decode. The
  spec travels in the URL exactly as a PostSpec does.
- `components/kinetics/type.ts` — the two things every scene needs: the
  **layout** (where each line and each letter sits) and the **mask** (the same
  words drawn white-on-black offscreen, with a sampler). The mask is the
  important one: half the scenes never draw a letter at all, they draw a field
  and ask the mask whether each point is inside a word. It is cached per size
  because `getImageData` is the only genuinely expensive call here.
- `components/kinetics/scenes.ts` — the seven renderers. A scene is
  `(frame) => void` plus the controls it declares, so **adding one is one entry
  in `SCENES` and no UI work** — the panel is generated from the controls, the
  same bargain the Tools make with the wall.
- `Kinetics.tsx` (the studio, Toolcraft chrome), `Stage.tsx` (subscribes to the
  shared `clock`, never re-renders), `exports.ts` (PNG + webm).

Two rules carried over from the Posts Studio, and they are why an export is
trustworthy:

- **The loop is a contract.** Every scene is a function of `p` (0-1 through the
  loop) and lands on the same frame at 1 as at 0. Rotations are whole turns,
  scrolls are whole cells, and a stagger's intro/pause/outro are *shares of the
  loop* renormalized to sum to 1 — which is why moving any timing slider can
  never open a seam. Nothing reads the wall clock.
- **A recording is a function of the frame number.** `recordVideo` drives
  `captureStream(0)` by hand, drawing frame i of n at `p = i/n` (never
  `i/(n-1)`, or the last frame repeats the first). Two exports are identical.

Weights and distances inside a scene are **shares of something the scene
already has**, not pixels — `strokes` measures its stroke weight against the
gap between rings, `mosaic` sets each glyph to its own cell, `soften` takes its
radius as a share of the frame. That is what lets one slider keep meaning the
same thing when the count above it moves, and in a 4K export.

Two things there to reuse rather than rewrite:

- **`soften(frame, blur, paint)`** — blur at a controllable radius for about
  the cost of not blurring. The field is painted into a canvas an eighth the
  size, blurred *there*, and only then blown up: a 150px radius over a 4K frame
  is a convolution nobody can afford at 30fps, and the same radius an eighth
  the size is 1/64th of the work and identical once stretched. The small canvas
  is padded because a blur samples past its own edges and would otherwise fade
  the field out at the frame's border.
- **`grain`** draws a repeating tile, not a cell at a time. The first version
  filled the frame pixel by pixel — invisible in a preview, half a minute added
  to a video export. Eight fields, stepped a whole number of times over the
  loop, so it flickers like film and still lands back on field zero.

`RECIPES` in `lib/kinetics.ts` are the starting points, one a scene.
`applyRecipe` deliberately never touches the words: a recipe is "put my
sentence in this", not a poster about something else.

## the Tools (`/tools`)

The everyday front door to the studio: small tools, one thing each. A note, a
countdown, a quote card, a monthly round-up, a number, a practice card, a
pixel note. `/tools` is the wall (every tool showing what it makes, rendered
live), `/tools/<id>` is the tool.

**the Note leads** because it is the one that takes a thought of any length and
nothing else, which makes it the landing place for the box on the Desk. It is
also the only tool that breaks its own lines: `fitSize` in `overlay.ts` will
size a headline to fill a frame but never add a break, because where the lines
fall belongs to whoever typed them — a promise that holds in the studio and
can't hold for a sentence dictated into a box, which arrives with no breaks at
all. So `balance()` places them, evenly rather than greedily, and stands aside
the moment the writer types one.

**A tool is not a template.** It is one function — `build(params) → PostSpec`
in `lib/tools.ts` — so it asks the four questions that actually differ between
two of its posts and decides everything else. Because the output is a spec,
every tool inherits the renderer, the exporter and the shareable link for
free, and "open in the studio" is not an integration: it hands over the post
it already built. **No tool may produce a post the studio can't reopen.**

- Adding one is a `ToolDef` in `TOOLS` — id, name, a one-line `about`, its
  `fields`, `defaults`, and `build`. No route, no component: the wall and the
  viewer are generic, and `generateStaticParams` picks it up.
- The field kinds are deliberately few (text, lines, date, number, choice,
  ground, ink, format, switch). A tool that needs a control the list doesn't
  have is usually a tool that should have decided for you.
- Params travel in the URL (`/tools/<id>#p=<encoded>`) the same way a spec
  does, so a filled-in tool *is* a link.
- `components/postlab/Stage.tsx`, `useExports.ts`, `Poster.tsx` and `ui.tsx`
  are shared with the studio on purpose — one renderer, one exporter, one set
  of controls, two front doors. Don't fork them for a tool.

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

The constraint that shapes it: a browser cannot take a frame out of a YouTube
or Vimeo *embed* (cross-origin, tainted canvas) — but it can from a file the
owner picked off their own disk, where the canvas stays clean. So the Curator
(`/curate`) takes the film itself and does the whole job in the page:
`components/stills/localVideo.ts` decodes it, differences frames for the cuts,
and writes the stills; publishing lands the JSON and every new image as one
commit through the Git Data API. Nothing uploads until Publish, and a dropped
frame was never committed, so this road leaves no orphans.

There was a second road — paste a URL, let a GitHub Actions runner fetch it
with yt-dlp. It was removed: YouTube refuses datacentre addresses, and every
film has to be downloaded to be watched anyway. If it ever returns, put it
behind `ProjectEditor` rather than beside it. Two editors meant the second one
silently couldn't do half of what the first could.

`ProjectEditor` is that one editor: without `existing` it makes a new project
from a dropped file, with `existing` it reopens a committed one and attaching
the film again is what lets you cut more frames into it. The Curator gives it
a `key` per project so switching remounts it rather than an effect chasing the
prop.

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
reads the studio's vocabulary from the live `/api/postlab/schema` rather
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
