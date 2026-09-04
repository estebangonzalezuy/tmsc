---
name: postlab
description: Turn a prompt, note, or Notion doc into a tMSC Posts Studio link — an Instagram post, carousel, or reel spec for /postlab. Use when the user asks to "make a post", "create a carousel/reel", or wants club content turned into social posts.
---

# Generating tMSC posts with the Posts Studio

The Posts Studio (`/postlab`) is a **node graph**: small boxes (a `field`, a
`photo`, some `type`, a `shape`, a `filter`, a `mix`) wired together, each one
a carousel slide's own pipeline, ending in a `frame` node, with every frame
wired into one `showreel` in order. A post is fully described by a
**PostGraph** JSON — nodes plus edges — and your job is to build that graph
and hand back a link. (This replaced an older, flat `PostSpec` model in
2026 — AGENTS.md, Workstream 4 — so a `#spec=` link from before that date
opens the retired studio, not this one; always emit `#graph=`.)

Two registers, same as before, now expressed as which nodes you wire:

- **The sheet** — a `type` node alone (or over a plain `field`), ruled with
  its own `grid`. This is the club's default and what most posts should be.
- **The club's pixels** — a `field` node (rings, lobed, quantized, dithered)
  feeding `type`. Reach for it when the post wants a graphic, not by default.

What you must not do is reach for a graphic because a node exists for one.

## Workflow

1. Take the source text (user prompt, newsletter excerpt, Notion page —
   fetch it with the Notion tools if the user points at one).
2. Distill it into slides in the club's voice: honest, human, anti-hype,
   short lines. Use `\n` in titles to control line breaks deliberately.
3. Build one small graph per slide — usually `field -> type -> frame` (or
   just `type -> frame` for a plain sheet) — and wire every `frame`'s output
   into the `showreel`'s `in-1`, `in-2`, ... ports, in carousel order. Node
   kinds and their params are below; the full, current schema is always
   `lib/postgraph.ts` plus `components/postlab/nodes/*.ts` in a repo
   checkout — there is no `GET /api/postlab/schema` fetchable endpoint any
   more (retired with the old model; a Claude session with no repo access
   has to work from this skill's own reference below, which is a real,
   disclosed regression versus the old always-fetchable schema).
4. Encode and link it:

```bash
node -e '
const graph = { v: 1, format: "portrait", duration: 6, nodes: [ /* ... */ ], edges: [ /* ... */ ] };
const json = JSON.stringify(graph);
const b64 = Buffer.from(json, "utf-8").toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
console.log("/postlab#graph=" + b64);
'
```

Prefix with the site origin (production Vercel domain, or
`http://localhost:3124` in dev). Opening the link loads the graph ready to
tweak and export. Alternatively give the user the raw JSON — the studio's
Import drawer takes a pasted link or the bare JSON.

Every node needs an `id` (any unique string), a `kind`, `x`/`y` (canvas
position — layout doesn't matter for a generated link, `{x: i*300, y: 60}`
per node in pipeline order is fine), and `params` (only the ones that differ
from the kind's own default — see each kind below; anything omitted takes
that default, which is what keeps a link short and future nodes
backwards-compatible).

## Node kinds

**`field`** — a dithered radial field: rings, lobed by angle, quantized into
flat bands, with a quiet centre. No inputs. Key params: `pixelsAcross` (8-64),
`rings` (2-24), `distortion` (lobing, 0-1), `grain` (0-1), `quantize` (2-16),
`quietCentre` (0-1), `rotationOffset` (0-360°), `movement`
(`none`|`ripple`|`breathe`), `amount` (0-1), `wave` (`sin`|`tri`|`saw`|
`square`), `loopLength` (whole trips, 1-8), `dtype` (screen: `4x4`|`2x2`|
`8x8`|`lines`|`noise`), `inks` (hex array, deepest-first — a ramp from
`lib/palette.ts`'s `FIELD_PRESET_RAMPS`, or hand-picked).

**`photo`** — a picture, a film, or a GIF, composited in full colour (cover
or contain, no thresholding — pixelate it downstream with a `filter` node if
you want it dithered). `src`: a path on this site (`/stills/x.jpg`, travels
in the link) or `local:<id>`/`clip:<id>` (kept in the owner's browser,
doesn't travel — never invent one of these). `fit` (`cover`|`contain`),
`exposure` (gamma, 0.2-3), `clipCycles` (whole loop trips for a film, 1-8).

**`type`** — the club's editorial headline over whatever's wired into its
`in` port (or a flat `ground` fill when nothing is). `kicker`, `tag`, `title`
(`*a run like this*` = the other voice — roman inside an italic headline,
italic inside a roman one), `body`, `footer`, `note`, `titleFont`
(`sans`|`serif`|`gothic`), `italic` (bool), `titleSize` (`s`|`m`|`l`|`fit` —
`fit` grows the headline to the frame, never inserting a break you didn't
type), `align` (`left`|`center`), `anchor` (`top`|`middle`|`bottom`),
`margin` (32-200), `grid` (ruling columns, 0 = off), `ink`/`ground` (hex).

**`shape`** — the club's motifs as placed marks: `circle`|`oval`|`square`|
`triangle`|`line`|`bar`|`arc`|`cross`|`bracket`, over its `in` port. Marks
travel as a JSON string in the single `marksJson` param (an array of
`{kind,x,y,size,weight,rotation,opacity,ink?,repeat,along,spread,jitter,
twist,taper,seed}` — `weight: 0` fills the mark, `along` is `none`|`y`|
`arc`|`ring` for `repeat > 1`). `spin` (0-360) is the one top-level number a
`motion` map can travel — it turns every mark on the node uniformly.

**`filter`** — one effect over its `in` port: `type`
(`pixelate`|`posterize`|`levels`|`grain`|`mono`|`invert`) plus that effect's
own params (`cell`/`amount`/`dtype` for pixelate; `steps` for posterize;
`brightness`/`contrast` for levels; `amount`/`size` for grain; `amount` for
mono/invert), `ink`/`ground` (hex, used by pixelate and mono). Chain several
by wiring `filter` nodes in series — there is no filter list on one node.

**`mix`** — composites `over` onto `base`: `mode` (`normal`|`multiply`|
`screen`|`overlay`|`darken`|`lighten`|`color-dodge`|`color-burn`|
`difference`|`exclusion`), `opacity` (0-1).

**`frame`** — terminal, one carousel slide; passes its `in` through. `label`
is cosmetic only.

**`showreel`** — the carousel: `slots` (1-12) sets how many `in-N` ports it
has. Wire `frame` outputs into `in-1`, `in-2`, ... in order — carousel order
is which port a frame is wired into, not a separate array.

**Motion.** Any node can carry a top-level `motion` map: `{ "<param>": { to,
wave, cycles, phase } }` — `to` is where the number travels, `wave` is
`sin`|`tri`|`saw`|`square`, `cycles` is whole trips per loop (1-8, rounded —
this is what keeps the loop seamless), `phase` (0-1) is where in the trip it
starts. Only params that are plain numbers on that node's own `params` object
qualify — `field`'s `distortion`/`grain`/`rotationOffset`/etc., `shape`'s
`spin`, `mix`'s `opacity`, a `filter`'s `amount`. `field`'s own `movement`
param already gives it looping motion without touching `motion` at all —
reach for `motion` when you want a *different* number to travel.

## Instant links

There is no query-param bootstrap for the graph model yet (the old model's
`/postlab?title=...` instant links) — a deliberate, disclosed gap versus the
old studio; always build the full graph and use `#graph=`.

## The queue automation (Notion → post)

Three Notion databases under the "The Motion Social Club" hub page drive
the club's content loop:

- **tMSC Pipeline** — `collection://de912cbf-c9df-440c-8a17-c1ef8a9c1d1d`
  One row per idea. Status flows `Idea → Borrador → Publicado` — three
  states, not seven; `Borrador` covers everything from "picked" to
  "has a draft and a visual", distinguished by which fields are filled
  rather than by a status of its own. Columns: Name, Angle, Pillar,
  Objective (relation), Source (relation to a library post), Format,
  Copy, Notes, LinkedIn draft, Post link, Schedule. ("Instant link", the
  zero-AI formula link, lives in a secondary view now, not the main one.)
- **tMSC Content library** — `collection://59421a28-6325-466b-848e-f59b8bcf0986`
  Everything published (seeded with 51 Substack posts). Name, Channel,
  Date, Type, Pillar, Link, How it landed.
- **tMSC Objectives** — `collection://e57499ed-1671-4267-876b-5b9247aef1f3`
  Name, Period (month|quarter|semester), Goal, Start, Status. The row
  with Status `Active` aims the angle proposals.

Both jobs below run on a schedule from `.github/workflows/content-cycle.yml`
(see `docs/CONTENT-SYSTEM.md`); any session can also run either on demand.
Never modify rows in statuses you weren't asked to handle, and never commit
or push repo code during a content run.

**Job 1 — visuals.** For each Pipeline row with `Status = 'Borrador'` and
an empty **Post link**: distill its body/Copy/Notes into a PostGraph per
this skill, encode it, set **Post link** to
`https://themotionsocialclub.vercel.app/postlab#graph=<base64url>`.
Status stays `Borrador` — it's the field that changed, not the state.

**Job 2 — angles (optional, off by default).** Only run this when asked
for ideas. Skip if 6+ rows already sit in `Idea`. Otherwise read the
library (what's over/under-published, what's gone quiet), the active
objective (also optional — if its Goal is empty, angles are still fine,
just less aimed), and the pillars/threads in `content/site.json`, then
create exactly 3 rows with `Status = 'Idea'`, each with a Name, a 2-3
sentence Angle in the club's voice, a Pillar, the Objective relation,
and a Source relation to the post it extends. Vary across pillars;
prefer extending threads that worked over inventing new territory.

**Drafting (on demand).** When a row is `Idea` and the owner asks, write
the **LinkedIn draft** — hook line, short paragraphs, no links in the
body, no hashtag soup — and set Status to `Borrador`. LinkedIn is the
club's primary channel (~26k followers); other channels only on request.

**Closing the loop.** When a row reaches `Publicado`, add it to the
Content library (Channel, Date, Type, Pillar) so future angle proposals
see it.

## Editorial defaults

There is no recipe/preset rail for the graph model yet (the old model's
`PRESETS`, and the schema endpoint that served them, are both retired — a
disclosed gap, not a secret one). Build each of these as a small graph by
hand, `field/type -> frame`, per slide:

- **A month's round-up** → `portrait`, `type` alone, `tag` of `MM/YY`, serif
  `fit` title centred with one italic run, `ground` ash. The club's
  most-used post.
- **A line worth keeping** → `portrait`, `field -> type`, `type.anchor:
  "bottom"`, `kicker` set, sans `titleSize: "m"`. Keep the field's `amount`/
  `distortion` modest so it reads as texture, not as the subject — the words
  are the subject.
- **A quote** → `square`, `type` alone, `ground` ash, `grid: 6`, serif `fit`
  centred, the attribution in `footer`.
- **A reference card** → `portrait`, `type` alone, `ground` slate (`#1a1a1a`)
  with `ink` `#ffffff`, sans title at `anchor: "top"`, source in `body`, a
  numbered `tag`.
- **A poster** → `square`, `field -> type`, sans `fit` caps, `grid: 6`.
- **Carousel** → `portrait`, one `field/type -> frame` trio per idea sharing
  the same `ground`/`grid` (that sameness is what makes several slides read
  as one piece), a `tag` of `01`, `02`, `03`, every `frame` wired into the
  one `showreel` in order.
- **Reel** → `story`, one frame, `field` with `movement` set, `duration`
  6-10 — every node kind here is periodic in the loop by construction, so
  any graph exports as a seamless reel.
- **Link / video share** → `landscape`, one frame, shorter title
  (`titleSize: "s"` or `"m"`), keep the block tight since the frame is short.
- Content to draw from lives in `content/site.json` (quotes, threads,
  pillars, archive titles).
