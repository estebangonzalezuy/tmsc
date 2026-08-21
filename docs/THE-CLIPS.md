# the Clips

The club's library of motion fragments — a few seconds lifted out of real work,
filed by what they are, how they move and how they land, and steppable frame by
frame. `/clips` is the library, `/cut` is the Cutter.

Read this before touching it.

## Why it is not the Stills

The Stills answers *what does good look like?* — composition, palette, type,
light. It cannot answer the question the club actually gets asked, which is
**how do you animate this?** A frame has no easing in it, and easing is the
entire content of a logo reveal or a UI micro-interaction.

So the Clips takes the same road — drop a film you have, cut pieces out of it in
the browser, commit only the pieces, credit it, link back to the second — and
changes the unit. A **clip** is a fragment of seconds. And because a library of
fragments is only worth having if you can interrogate it, the wall is faceted
rather than tagged.

Same split as the Stills and the Directory: **the clips are data, the framing is
copy.** Clips live in `content/clips/clips.json` and `public/clips/`; the
library's intro copy lives in `content/site.json` under `clips`, edited in the
Studio like everything else.

## A clip is a filmstrip, not a video

The constraint that shapes both walls is that a browser cannot take pixels out
of a YouTube or Vimeo *embed* — cross-origin, tainted canvas — but it can out of
a file you picked off your own disk. So the film never leaves the machine and
only the cut pieces are committed.

What gets committed is **one WebP sheet of the clip's frames, tiled in a grid**,
plus a poster. The wall draws one cell of it into a `<canvas>` on a shared
ticker.

Three things this buys that a `.webm` would not:

- **Dozens animate at once.** No decoders, no autoplay policy, no codec branch.
- **It loops by construction.** Frame `i` is sampled at
  `in + (i / n) · (out − in)`, so the sampling never lands on `out` — the frame
  after the last one is the first one again. The same arithmetic
  `components/postlab/clips.ts` uses to decode a film for the Posts Studio.
- **It steps.** Left and right walk a frame at a time in the lightbox. A
  three-frame stagger is not something you can see at speed, and it is the one
  thing an embed of the source will never let you do. This is the reason the
  whole approach was chosen.

What it costs, stated plainly so nobody is surprised later:

- **Fidelity.** A tile is 400px on its long edge. Good enough to read timing and
  spacing; not a substitute for the source.
- **Bytes.** WebP has no inter-frame prediction, so every frame in a sheet is
  intra-coded — a sheet is heavier than the equivalent video. Reckon on
  250–600KB a clip for real footage; flat-colour graphics compress far better.
  A sheet is the heaviest thing the club commits.

Both costs are deliberate. Full-resolution playback is the source's job, and
`momentUrl` is how a clip hands you back to it.

**`assetBase` is the way out.** Everything that renders a clip goes through
`sheetSrc`, so moving the sheets to a CDN later is a change to one string in
`clips.json`. That matters more here than it does for the Stills.

### The numbers

All constants in `lib/clips-shared.ts`, so retuning is one edit:

| | |
|---|---|
| frames | `frameCount(seconds)` — 30fps under 1.5s, 18fps under 3s, else 12, clamped to 12–36 |
| grid | `SHEET_COLS` 6, so a sheet is never worse than 6×6 |
| tile | `TILE_EDGE` 400px on the long edge, even pixels so a cell never lands on a half |
| quality | 0.72 for the sheet, 0.75 for the poster |
| length | `MIN_SECONDS` 0.4 to `MAX_SECONDS` 6 |

The rate falls as the clip gets longer on purpose. A UI snap is *all* easing and
needs the frames; a six-second establishing shot is not, and spending the same
budget on it buys blur. The cap is also what keeps a sheet inside 6×6.

**The lightbox never blows a clip up past twice its tile width.** A lightbox
that stretched a 400px tile across a desktop would be advertising detail the
club deliberately did not commit.

## The facets

The vocabulary in `FACETS` is **closed on purpose**. A free tag list drifts —
"ui", "UI" and "interface" become three tags and the library stops being
answerable. Three axes, because a motion reference is asked three different
questions:

- **subject** — what am I looking at: ui, intro, logo, transition, type,
  gradient, texture, character, camera, product, data, abstract
- **technique** — what is the mechanism: stagger, mask, morph, spring, particle,
  distort, offset, trim-path, cutout, blur, 3d, loop
- **feel** — how does it land: snap, overshoot, ease-out, linear, elastic, drift

**Values OR within an axis and AND across them.** That is the query somebody
actually has — *"ui or transition, and staggered"*. The Stills ANDs one flat tag
list; doing that here would make two subjects return nothing. Each axis is one
query parameter named for itself, so the URL reads as the question:
`?subject=ui&subject=transition&technique=stagger`.

The rails are drawn **in the vocabulary's own order, not by count** — a rail
that reorders itself as clips land is one you have to re-read every visit.

Adding a term is a deliberate edit to `FACETS`, the way adding a Directory
collection is. Before adding one, ask whether it is really an existing term seen
from a different angle. `cleanFacet` drops anything the vocabulary doesn't know,
so a hand-edited file can never put an unknown chip on the wall.

A clip also carries free `tags[]` for the overflow, and a **`note`** — the field
that makes this a library rather than a mood board. *"Three-frame stagger, and
only the last item overshoots."* Write it.

## A cut is a spike, not a high number

`findCuts` (in `lib/video.ts`, shared with the Stills) walks the film at 2fps
and scores each step by how much the picture changed. The Stills reads its peaks
as moments worth freezing. A clip wants the **span between** two peaks, which is
the same measurement asked a different question — `chooseShots` turns those
scores into ranges.

The first version called every sample over a fixed threshold a cut. That quietly
threw away exactly the shots this library exists for: a breathing gradient, a
whip pan, a big camera move — anything where the whole frame changes
continuously scores high on *every* sample, gets shredded into sub-minimum
fragments, and vanishes from the suggestions entirely.

So a cut has to be a **spike**: above a bar set by the film's own median change
(`max(threshold, median × 2.2)`), and strictly above the sample before it. Peaks
closer together than a clip can be are one boundary seen twice — a
cross-dissolve — and the stronger wins. A shot is then trimmed at both ends,
because the first moments of one are usually still the transition out of the
last.

## The files

- `lib/clips-shared.ts` — the **ClipSpec** side of things: the facet vocabulary,
  the sheet constants, `frameAt` / `cellAt`, `buildClipWall`, `chooseShots`. No
  JSON imported, so it is safe on the client.
- `lib/clips.ts` — holds `clips.json`, derives the wall at build time. **Server
  components only.**
- `lib/video.ts` — the generic decoder, shared with the Stills: `openVideo`, the
  `seek` that cannot hang, `findCuts`. Lifted out of
  `components/stills/localVideo.ts` when the Clips needed all of it; two copies
  of that seek would be two places for its two documented hangs to come back.
- `lib/github.ts` — committing from a browser, shared with the Curator. Same
  zero-config contract: the token is pasted into the page, every call goes
  straight to api.github.com, nothing on Vercel holds a secret.
- `components/clips/cutSheet.ts` — a range in, a sheet out.
- `components/clips/ticker.ts` — the wall's playhead, outside React for the
  reason `components/postlab/clock.ts` spells out. Its own free-running rAF
  because a wall has no transport, and it stops when the last tile unsubscribes.
- `components/clips/ClipCanvas.tsx` — a poster `<img>` with a canvas painted
  over it. **It sets its own aspect ratio from the clip**: the poster and canvas
  are both absolutely positioned, so a wrapper with no height collapses to
  nothing, and a caller who forgot got a card with no picture in it.
- `components/clips/ClipLightbox.tsx` — large, with the scrubber and the frame
  stepping. Keyed by clip id by both callers, so stepping to the next one
  remounts rather than an effect resetting state on a prop change.
- `components/pages/ClipsPage.tsx` / `ClipsProjectPage.tsx` — the wall and one
  film.
- `components/clips/Cutter.tsx` / `ClipEditor.tsx` / `ClipFields.tsx` — `/cut`.

## Things worth keeping true

- **A pending clip animates.** Every sheet cut in a session gets an object URL
  and renders live in the Cutter before anything is committed. Not a nicety: you
  cannot judge a clip from a poster, and judging clips is the panel's whole job.
- **Only what is near the viewport moves.** Every animating tile is a decoded
  sheet in memory and a draw a frame. `useNearViewport` gates it; the wall has
  one switch over everything, and `prefers-reduced-motion` decides where that
  switch starts — but pressing it **overrides** the system, because somebody who
  runs their machine on reduce still has to be able to watch the page that is
  about motion.
- **The object URLs are minted when the blobs change, not during render.**
  Minting one inside the render pass means minting it again on every render, and
  leaking the last one.
- **`committed` is keyed by full repo path, not filename.** A new project's id
  follows its title, so retitling between two publishes moves the whole asset
  directory — bare filenames would claim the sheets were already uploaded and
  skip them, leaving the wall full of 404s.
- **Dropping a clip leaves the file behind on purpose.** Publishing is one
  commit; deleting binaries in the same breath makes it a tree write that can
  half-fail. `node scripts/clips/prune.mjs` sweeps orphans, from a fresh pull.

## Verifying it

`app/api/clips/local/route.ts` is a **dev-only** helper (404 in production, no
env vars, no secrets) that lands a project in the working copy instead of the
repo — `content/clips/clips.json` plus every sheet under `public/clips/`. In
`next dev` the Cutter shows a **Save to this checkout** button and does not ask
for a token at all.

It exists because the alternative was untestable: the wall is a build-time
derivation of a file the Cutter writes through the GitHub API, so without it the
only way to see a real clip on a real wall is to publish one to the live site
and wait for Vercel. Keep it working.
