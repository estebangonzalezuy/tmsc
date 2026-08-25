# the Clips

The club's library of motion fragments — a few seconds lifted out of real work,
filed by what they are, how they move and how they land, and steppable frame by
frame. `/clips` is the library, `/cut` is the Cutter.

Read this before touching it.

## What it collects

**Brand and product presentation**: launch films, identity in motion, product
reveals, keynote graphics, site hero work, studio case films. Not motion design
in general — that is what everyone else already indexes, and the club's own
**Directory** already covers the resource half of it with more rigour.

The corpus was chosen partly on principle and partly on supply: this work lives
on YouTube and Vimeo, which means it is downloadable, which means the Cutter
works on it unchanged and the promise of *linked back to the second it came
from* survives. In-app UI micro-interactions would need screen recording and
have no citable source — that is the line, and it is a line about the contract,
not about taste.

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

## Two assets, each where its strengths are

A clip is committed twice: a **filmstrip** and a **video**. That is not
belt-and-braces, it is the only arrangement that works, and the reason is a
hard ceiling rather than a matter of taste.

A filmstrip holds every frame side by side, so its canvas grows with the square
of the tile. 36 frames at a 400px tile is 3.3 megapixels; at 800px it is 13; at
1280px it is 33, and at 1920px it would be 75 — well past what iOS will
allocate for a canvas at all. **A sheet can never carry a clip at the size you
want to look at one**, however many bytes you are willing to spend.

A codec has the thing a sheet structurally cannot: inter-frame prediction.
Consecutive frames of a film are nearly identical and a video stores only the
difference, where WebP has to intra-code all thirty-six. Measured on a real cut:
the videos came out at roughly the same total weight as the sheets while
carrying 1280px instead of 400px — ten times the pixels for about the same
bytes.

So:

- **The sheet is the wall.** Dozens animate at once with no decoders, no
  autoplay policy and no codec branch. The wall never requests a video; that is
  worth keeping true, and there is a check for it in the verification below.
- **The video is the lightbox.** Fetched only when somebody opens a clip, and
  what they actually watch. `VIDEO_EDGE` (1280) and `VIDEO_BITRATE` are the two
  dials.

Both come out of **one seek pass** over the film in `cutOne` — seeking a decoded
film is the expensive part, so the same seek feeds the sheet cell, the poster
and the recorder rather than walking the range three times.

`video` and `videoSeconds` are both optional, so a clip cut before any of this
existed still works: `ClipPlayer` falls back to the sheet with nothing else
changing. That is why it could be added without a migration — and why the Cutter
grows a **Re-cut all** button instead, which cuts a project's existing ranges
again from the film. A clip's id is derived from its range, so a re-cut lands on
the same ids and filenames: the facets, the notes and the cover survive, and the
new files simply replace the old ones.

### What the recorder gets wrong, and what to do about it

MediaRecorder timestamps frames **by the wall clock**, not by how many you
pushed. Three consequences, all of them handled and none of them obvious:

- A pass that seeks faster than real time writes a video shorter than the clip,
  and one that seeks slower writes a longer one. So the loop **paces** its
  pushes to the clip's own frame rate, and `ClipPlayer` corrects what is left
  with `playbackRate`. Tempo is the one thing a motion reference must not get
  wrong.
- The last frame needs a moment of its own or the muxer drops it, so the file
  always runs past its content. Indexing frames against the file's `duration`
  therefore lands late — measurably, the video showed a moment two frames ahead
  of the sheet's. The Cutter measures the span from the first push to the last
  and writes it down as **`videoSeconds`**; everything indexes against that.
- **The looping belongs to the element**, and trying to be cleverer than that
  broke it. A file MediaRecorder wrote has no duration in its header — it was a
  live stream — so `video.duration` often reads `Infinity`. (lib/video.ts
  already knew that about the Curator's *inputs*; it is just as true of the
  Cutter's *outputs*.) A hand-rolled loop that watched `currentTime` for the end
  was therefore waiting on a moment it could never reach: the clip played once
  and stopped dead. `loop` on the element is the only thing that knows where the
  data actually runs out. The tail it replays turns out to be nothing anyway —
  the measured span lands a hair *under* the clip, not over it.

That is also what makes `videoSeconds` load-bearing rather than a nicety: with
`duration` reading `Infinity`, it is the only number frame stepping has to
measure against.

What is *not* fixed: frame `i` of the video is not exactly frame `i` of the
sheet. The gaps between recorded frames are however long each seek took, so
uniform indexing drifts by up to a frame (measured at about ±1). Nothing ever
shows both assets at once — the sheet is the wall, the video is the lightbox —
so it is invisible, and the alternative (shipping thirty-six timestamps per clip
in the wall's payload) buys nobody anything. Don't "fix" it by adding them.

## The filmstrip itself

The constraint that shapes both walls is that a browser cannot take pixels out
of a YouTube or Vimeo *embed* — cross-origin, tainted canvas — but it can out of
a file you picked off your own disk. So the film never leaves the machine and
only the cut pieces are committed.

The sheet is **one WebP of the clip's frames, tiled in a grid**, plus a poster.
The wall draws one cell of it into a `<canvas>` on a shared ticker.

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

What it costs: a tile is 400px on its long edge, and every frame is
intra-coded. That is fine for a wall tile and not enough for a clip you have
opened — which is what the video is for. Reckon on 60–170KB a sheet for real
footage; flat-colour graphics compress far better.

`momentUrl` still hands you back to the source at the exact second, which is
where you go for the real thing at full resolution.

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
| video | `VIDEO_EDGE` 1280 on the long edge, never upscaled; `VIDEO_BITRATE` 2 Mbps |

The rate falls as the clip gets longer on purpose. A UI snap is *all* easing and
needs the frames; a six-second establishing shot is not, and spending the same
budget on it buys blur. The cap is also what keeps a sheet inside 6×6.

**A clip with a video gets the room; one without is capped at twice its tile
width.** Stretching a 400px sheet across a desktop advertises detail the club
deliberately did not commit.

## The facets

The vocabulary in `FACETS` is **closed on purpose**. A free tag list drifts —
"ui", "UI" and "interface" become three tags and the library stops being
answerable. Three axes, because a motion reference is asked three different
questions:

- **subject** — what am I looking at: logo, product, ui, type, packaging,
  endcard, transition, texture, data, camera, environment
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

### The fourth rail: who is presenting

`STAGES` — bootstrapped · seed · series-a · series-b · series-c · public ·
studio — and it is the axis nothing else in this field has. A designer asking
*"how does a Series A present itself"* is asking about budget and ambition, not
about aesthetics, and the answer really is different at seed than at IPO. It
makes the library answerable by a business decision rather than only by taste.

Two things about its shape:

- **It lives on the project, not the clip.** Every clip cut from one launch film
  shares the company that made it. On the clip it would be the same fact twelve
  times and twelve chances for the Cutter to disagree with itself. The wall
  already indexes each clip with `p` pointing at its project, so filtering by
  stage is `wall.projects[clip.p].stage` and costs nothing.
- **It is optional, and the escapes are honest.** A studio's own reel is not a
  company presenting itself, and Apple has no "series" — hence `studio` and
  `public`. A project with no stage at all stays out of the rail entirely, which
  also means a stage filter *excludes* it. That is correct behaviour for an
  optional field, and it is item 3 in the verification list below.

Alongside it, `brand` on the project: the company being presented, as distinct
from `credit`, which is who made the film. Linear is the brand; the studio that
cut it is the credit. A library about presentation needs to tell them apart, and
the wall leads with the brand where there is one.

Counts under the stage chips are **clips, not projects** — the wall filters
clips, so the number has to say how many clips pressing it will leave.

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
- `components/clips/cutSheet.ts` — a range in, a sheet and a video out, in one
  seek pass.
- `components/clips/ClipPlayer.tsx` — the video, with the sheet as its fallback.
  Everything about the recorder's wall-clock timestamps lives here.
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

Two things worth checking whenever this changes:

- **The wall must never request a video.** Watch the network on `/clips`: it
  should ask for `.webp` and nothing else. A video leaking into a wall tile
  undoes the whole reason there are two assets.
- **A clip with no `video` must still open.** The Aljoscha reel was cut before
  videos existed and is the standing test for the fallback; don't re-cut every
  project at once and lose it.
- **A clip must still be running a minute later.** Watch `currentTime` wrap
  more than once without touching anything. Every loop bug here has looked
  exactly like "plays once, then needs pressing again".

A note on codecs, because it will come up: the Cutter writes mp4/H.264 where the
browser offers it, which is what plays on every consumer device. Some
open-source Chromium builds ship without H.264 and cannot play those files — the
`onError` fallback catches it and draws the sheet instead, which is worth
knowing before assuming a clip is broken.
