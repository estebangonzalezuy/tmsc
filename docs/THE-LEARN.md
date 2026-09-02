# Learn

The club's own library. Everything else the club publishes points at somebody
else's work: the Directory indexes it, the Stills and the Clips cite it. Learn
is the one place the club is the author.

It answers one question, and the question is the most-asked one in the inbox:
**where do I actually begin?**

It is a **pay-once library**: you buy it, you keep it, and what gets added later
is yours too. A piece or two stays open so the answer above is free to anyone who
wants it.

## The shape, and why it is this shape

Three concepts. There is deliberately no fourth.

- **A piece** is one thing you read, watch or listen to — `article`, `video` or
  `audio`. It lives in exactly one track, which gives it exactly one URL.
- **A track** is a topic: an ordered shelf of pieces.
- **The path** is the on-ramp: an ordered list of *days*, each pointing at a
  piece that already lives in a track, plus the one thing to go and do after it.

The path **references** pieces rather than owning them, and that is the decision
everything else rests on. Reorganising the curriculum later — moving a piece
between tracks, reordering the days, adding a day — never mints a new URL and
never breaks an old one, and no piece is ever published at two addresses. A
piece's home is where it is filed; the path is a route through the building, not
a second copy of it.

| URL | What |
|---|---|
| `/learn` | The hub: the path, the tracks, what is still on Notion, the Practice File |
| `/learn/<track>` | One track, its pieces in curriculum order |
| `/learn/<track>/<piece>` | One piece |

Track and piece pages are **server components**, and they are the only page type
in this repo with no reason to be `"use client"`. A plain article is text and
text does not need a runtime. Only the three blocks that genuinely need the
browser — a running spec, a video, an audio player — are client islands. Keep it
that way; reaching for `"use client"` at the top of a piece page would undo it.

## The data-vs-copy split

The same split the Directory, the Stills and the Clips make, for the same
reason: `content/site.json` is rewritten **wholesale** by the Studio on every
publish, so a library cannot live in it.

- **Written by hand** — `content/learn/sources/<track>/<slug>.md`
- **Generated, never hand-edited** — `content/learn/pieces/<slug>.json` (one file
  each, so a piece page loads only its own body) and `content/learn/manifest.json`
  (tracks, the path, a card per piece, counts, and no bodies at all)
- **Editable in the Studio** — `content/site.json → learn`: `label`, `headline`,
  `intro`, `note`. The words on the library, and nothing else.

`lib/learn.ts` is server-only, like `lib/directory.ts`. The hub is a client
component and imports `content/learn/manifest.json` directly, because the
manifest is kilobytes of cards and the bodies are not.

One deviation from the Directory, on purpose: its TSV sources sit under
`scripts/directory/sources/`. Prose belongs where a writer will look for it, so
the markdown sits under `content/learn/sources/`. In that folder, `.md` is
written and `.json` is generated.

## Writing a piece

One markdown file, frontmatter between `---` fences. Then:

```bash
npm run learn:build
```

Frontmatter is all required: `title`, `blurb`, `kind`, `state`, `minutes`,
`updated`. The voice is `docs/voice/PROFILE.md` — its hard rules are last in
that file on purpose, so read to the end.

### The markdown subset

Small, explicit, and enforced. `##` and `###` headings (the title comes from
frontmatter, so `#` is refused), paragraphs, `-` and `1.` lists, `>` quote,
`---` rule, `![alt](src)`, and inline `**strong**`, `*em*`, `` `code` ``,
`[text](href)`. A list item runs on across wrapped lines, like a paragraph.

Anything richer is a fenced directive, closed by `:::` —

| Block | What it is |
|---|---|
| `:::note` | An aside |
| `:::do minutes=30` | The thing to go and do. The whole library exists to get somebody to one of these, so it is the loudest block on the page |
| `:::video youtube <id>` | A video, loaded on click rather than on load |
| `:::audio /episodes/one.m4a seconds=1200` | A club episode |
| `:::spec postlab caption="…"` | A live example — see below |

**An unknown directive fails the build with a line number.** That is not
strictness for its own sake: silently dropping a block is how a published piece
quietly loses a paragraph, and the failure is also the instruction — come and
add the block to `DIRECTIVES` in `scripts/learn/build.mjs` and to
`components/learn/Prose.tsx`, rather than inventing syntax at the page level.

The build also refuses: a slug used twice across tracks, a track or a day
pointing at a piece that does not exist, a file sitting in a track folder that
the track does not list, and anything marked `published` with an empty body.

### Access, and what "locked" actually means

Frontmatter carries `access: free | paid`. A paid piece's source has a **`:::more`**
marker where the free preview ends, and the build writes **only the blocks above
it** into `content/learn/pieces/`, plus `locked: <n>` for how many were withheld.
The paid body never reaches the JSON, the bundle or a browser. There is no lock to
pick because there is nothing behind the page to unlock.

Be honest about the shape of that, in the copy and in your head: it keeps paid
writing off the *published site*, and the markdown sources still sit in this repo.
If the repo is public, they are readable there. **This is a preview mechanism, not
access control.** Real gating arrives with whatever platform takes the payment; do
not write UI that implies more than this does.

A paid piece with no `:::more`, or with `:::more` at the very top, fails the build.
So does `:::more` in a free piece, where it means nothing.

Paid pieces still get pages and still prerender. A library whose paid items 404
looks broken and cannot be linked or shared.

### The offer, and the price that does not exist yet

`content/site.json → learn` carries the offer as flat fields (`offerTitle`,
`offerPrice`, `offerHref`, `offerCta`, `offerNote`, `offerIncludes`), because the
Studio's object sections take text, textarea and select and there is no nested
list — `offerIncludes` is therefore one item per line.

`components/learn/OfferBlock.tsx` has two states and **the content decides which**:
fill in a price *and* a checkout link and it becomes an offer; leave either empty
and it asks for a waitlist instead, in the same shape and at the same weight. A
made-up number on a page is worse than no number, and this way nothing has to be
redesigned the day a real one exists.

### Placeholders are a promise, not a page

`state: placeholder` is a piece that is named and not yet made. It is listed on
its track, dimmed, marked *Coming*, and **not a link** — and `piecePaths()`
leaves it out of `generateStaticParams`, so it has no address at all. The hub
counts written and unwritten separately and says so. Keep that honest: the
Directory already promises the reader which of its entries have been checked,
and this is the same promise about which of these pages exist.

## Covers

Every piece and every track has one, and none of them is a photograph. A cover is
a Posts Studio sheet rolled from the item's **slug**, so it is the same cover on
every visit and every build — the same "stable, not shuffled" rule `accentHover`
follows. `lib/learnCover.ts` seeds mulberry32 from the slug, rolls `randomSlide`,
and applies it with `applyStyle`.

**A cover carries no words.** It set the title into the sheet once, and that was
wrong twice: the card already prints the title underneath on white where it is
legible, and a rolled look chooses its own ground and ink, so nothing can promise
type will read against it. The club's rule is that a roll decides the graphic only
— whether the words can be read is not the dice's call. So the slide's type is
switched off, and the Kinetics looks are re-rolled past, because those draw the
headline *as* the picture and would put it back at whatever contrast the roll
chose. The ruling stays: it belongs to the paper, not the type.

`components/learn/Cover.tsx` draws it with `Poster` and `live`, at display size.
Two things keep a wall of them affordable, and both matter:

- **One clock per page.** Every page carrying canvases renders exactly one
  `<ClockRunner />`. Every canvas subscribes to the same shared clock outside
  React, so a second starter does not animate a second thing — it advances the
  one clock twice a frame and runs the whole page at double speed. Two live
  examples in one article used to be enough to do it.
- **`live` follows an IntersectionObserver**, so only tiles on screen draw.

## The live example

This is the thing the club can do that a motion blog cannot, and it costs
almost nothing.

`:::spec` carries an encoded Posts Studio or Tiles spec, and
`components/learn/SpecBlock.tsx` renders it **running** at the bottom of the
paragraph that describes it, with an "open in the studio" link beside it. There
is no second renderer: it is `Poster` with `live`, exactly as
`components/tools/ToolWall.tsx` already draws the tool wall — a self-contained
canvas that subscribes to the shared `clock` and repaints itself without ever
re-rendering React.

Because every studio spec is periodic in its own duration, an embedded example
loops seamlessly for free. That contract is enforced elsewhere; this spends it.

## Progress

There is no backend and there are no accounts, and there is not going to be
either, so a reader's place on the path is `localStorage` and nothing else.

`components/learn/useProgress.ts` uses `useSyncExternalStore`, which is the
right API for exactly this: the server renders nothing ticked, the browser
renders what it remembers, and those two have to differ without React calling it
a hydration mismatch. Reading storage during render, or setting state from an
effect, each get this wrong in their own way. The snapshot is the raw string
rather than a parsed `Set`, because a snapshot has to be referentially stable
between reads and a fresh `Set` never is. Storage access itself throws in a
private window rather than returning null, so every touch is wrapped; a reader
who blocks storage gets a path that works and forgets.

## Adding a track

An entry in `TRACKS` in `scripts/learn/build.mjs`, a folder under
`content/learn/sources/`, and the files. No route and no component changes — the
track page and the piece page are generic, and `generateStaticParams` picks it
up. `PATH` in the same file is the on-ramp, and it is the one place the
curriculum's order is written down.

## Still on Notion

The club's older paths (`learningPaths` in `content/site.json`) are still six
links into Notion. They sit on the hub under a heading that says exactly that,
rather than being quietly mixed in with pages that exist here. They come out
when the library replaces them.

`nav:learn` is in `hidden[]` while the library is mostly promises, so the page
is reachable by URL and not yet in the menu. Taking it out of that list is what
opening the door looks like.
