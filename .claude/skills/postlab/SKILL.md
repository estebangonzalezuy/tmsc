---
name: postlab
description: Turn a prompt, note, or Notion doc into a tMSC Posts Studio link — an Instagram post, carousel, or reel spec for /postlab. Use when the user asks to "make a post", "create a carousel/reel", or wants club content turned into social posts.
---

# Generating tMSC posts with the Posts Studio

The Posts Studio (`/postlab`) renders the club's posts. A post is fully
described by a **PostSpec** JSON; your job is to write that JSON and hand
back a link.

There are two registers and they share every control:

- **The sheet** — ruled paper, an oval label, an editorial headline that
  mixes roman and italic, corner labels. This is the club's default and what
  most posts should be: a ground from the neutrals, a `grid`, `veil: 0`, and
  a single layer of type `"none"`.
- **The club's pixels** — dithered graphics, animated, in black and white or
  one flat colour from the palette. Reach for them when the post wants a
  graphic, not by default.

They mix: a sheet with one dithered form on it is the club's most useful
post. What you must not do is reach for a shader because it's there.

## Workflow

1. Take the source text (user prompt, newsletter excerpt, Notion page —
   fetch it with the Notion tools if the user points at one).
2. Distill it into slides in the club's voice: honest, human, anti-hype,
   short lines. Use `\n` in titles to control line breaks deliberately.
3. Build the spec (schema below, full reference in `lib/postlab.ts` or
   `GET /api/postlab/schema` on the deployed site).
4. Encode and link it:

```bash
node -e 'const spec={/* ... */}; console.log("/postlab#spec="+Buffer.from(JSON.stringify(spec)).toString("base64url"))'
```

Prefix with the site origin (production Vercel domain, or
`http://localhost:3124` in dev). Opening the link loads the post ready to
tweak and export. Alternatively give the user the raw JSON — the tool's
"claude" panel has a paste-to-load box.

## Spec shape

```jsonc
{
  "v": 9,
  "format": "square" | "portrait" | "story" | "landscape",  // 1:1 post, 4:5 feed/carousel, 9:16 reel, 16:9 link/video post
  "duration": 6,                               // seconds recorded for video export
  "slides": [{
    "kicker": "design inspiration",            // small label, top left
    "tag": "08/26",                            // short label in an outlined oval above the headline
    "title": "What the club\n*saved for later*\nin August",  // *run* = the other voice
    "body": "",                                // optional supporting sentence
    "note": "@themotionsocialclub",            // small label top right; takes the mark's slot
    "footer": "@themotionsocialclub",
    "letter": "M",                             // circled letter top right, "" hides
    "text": true,                              // false = the sheet with no words on it
    "titleFont": "serif" | "sans" | "gothic",  // serif = editorial, sans = poster, gothic = blackletter
    "italic": false,                            // the whole headline in the italic; *runs* then read roman
    "titleSize": "s" | "m" | "l" | "fit",
    "anchor": "top" | "middle" | "bottom",     // where the headline block sits; middle is the default
    "boxed": false,                             // outlined box around headline
    "plate": false,                             // filled bg behind headline (legibility)
    "align": "left" | "center",
    "ring": false,                              // orbit ring of circled letters
    "grid": 7,                                  // columns of hairline ruling; omit for none
    "gridAlpha": 0.16,                          // how present the ruling is
    "gridTop": false,                           // ruling over the type instead of under it
    "background": "#e6e5e1",                   // the ground: paper #f4f3ef, ash #e6e5e1, cream #fffdf0, slate #1a1a1a
    "veil": 0,                                  // 0-0.9 wash dimming the background
    "titlePixel": 0,                            // 0-32, dithers the title into sharp blocks; 0 = off
    "metaPixel": 0,                             // 0-32, same dithering for kicker/body/footer/letter/ring
    "theme": "light" | "dark",
    "off": ["kicker", "body", "mark", "rules"], // parts to leave out; the words stay in the spec
    "layers": [{ "type": "none" }]              // 1-4 layers, bottom first; "none" = a plain sheet
  }]
}
```

**Emphasis is markup.** `*a run like this*` inside a `title` (or `body`)
switches that run to the other voice — italic in a roman headline, roman in
an italic one. Mixing the two mid-sentence is the club's editorial move; use
it on one phrase per headline, never on every other word.

**The oval and the corner.** `tag` is a date, an issue number or a chapter,
set in an outlined oval above the headline. `note` is a handle, a source or a
credit in the top-right corner; while it's set the circled mark stands down,
because there is only one corner.

**A counting number.** `count: { from, to, pad? }` makes a number travel over
the loop, and every `#` in the slide's words becomes its current value — title
`"#"` with body `"days to go"` is a countdown. It still loops (each value gets
an equal slice, and the last ends where the first begins), and `pad` holds the
same room for every value so the headline doesn't resize as a digit drops. Give
the number the headline and put the words under it in `body`: one size covers a
whole headline, so `"# days to go"` makes the number just another word.

Before writing a countdown, a monthly round-up, a quote card or a big number by
hand, check `/tools` — those are tools on the site, and a link to one arrives
filled in. Write a spec when the post is not one of those.

**Marks, and the deformers on them.** `shapes` is up to six of the club's
motifs placed on the sheet — `circle|oval|square|triangle|line|bar|arc|cross|
bracket` — each `{ kind, x, y, size, weight, rotation, opacity }`, plus `ink`,
`under` (behind the words), and the deformers that turn one into a pattern:
`repeat`, `along` (`x|y|arc|ring`), `spread`, `jitter` (seeded — set `seed`),
`twist`, `taper`. `weight` is the stroke; 0 fills it. A bracket at `size: 0.9`
is the club's boxed frame; a `line` repeated `along: "y"` is a ruled block; a
small `triangle` with `repeat: 7, along: "ring"` is a rosette. Two or three
marks is a composition; six is a mess.

**Motion has names.** Use the club's loops rather than arbitrary waves: drift
(sin ×1), breathe (sin ×2), pulse (sin ×4), swing (tri ×2), sweep (saw ×1),
march (saw ×3), blink (square ×4). They apply to any number on a layer or a
mark, and the studio shows them by name.

**The ruling.** `grid` is a column count — 6 to 8 on a portrait sheet — drawn
in square cells that are cut equally at top and bottom. `gridTop: true` puts
it over the words, which reads as a technical drawing rather than a caption.

Each layer also accepts `opacity` (0-1), `blend` (normal | multiply |
screen | overlay | darken | lighten | difference | exclusion), and a
transform: `offsetX`/`offsetY` (-1..1), `rotation` (degrees), `scale`
(0.1-4). Blending a texture over a gradient (mesh + dithering multiply)
is the signature look. v1 specs with a single `shader` field still load.

When a post does want a graphic, the club's own half is a **dithering
instrument** — hard-edged, thresholded pixels. Two layer types (plus `none`,
which draws nothing and is what a sheet wants):

- `dithering` (Paper Shaders): `shape` simplex|warp|dots|wave|ripple|swirl|
  sphere, `dtype` 4x4|8x8|2x2|random, `size` (pixel 1-14), `speed`, `scale`.
- `forms` (canvas ordered dither, shapes the shader lacks): `pattern`
  rings|ramp|bars|letter|spiral|grid|blobs|tunnel|noise|moire, `word`
  M|tMSC|MOTION|CLUB (for `letter`), `pixel` (2-16), `density`, `warp`
  (0-1 flow-field deformation), `speed`, `dtype` 4x4|8x8|2x2|lines|noise.

**Forms combine.** A `forms` layer can fold a second shape into the first:
`pattern2` (any pattern, or `none`) mixed with `mix` add|sub|mul|diff|max|
min, then mirrored with `fold` x|y|quad|radial. Both are mixed as grayscale
and dithered once, so the output stays hard-edged pixels. This is where the
good backgrounds are — `moire` + `rings` on `diff`, `grid` + `blobs` on
`mul`, `letter` + `noise` on `sub`.

**What's on the slide.** `off` is an array of parts to leave out — `kicker`,
`tag`, `title`, `body`, `mark`, `note`, `footer`, `rules` (the two decorative
lines). The words stay in the spec, so a part switched back on brings its text
with it. Only a headline: `off: ["kicker","tag","body","mark","note","footer","rules"]`.

`mark` decides the top-right circle: `auto` (default — the page number on a
carousel, the letter on a single post) | `letter` | `page` | `none`. When
it shows the page, the footer drops its counter.

**A photograph is a form.** `pattern: "photo"` with a `src` on the layer —
a path on this site (`/stills/x.jpg`, travels in the link) or `local:<id>`
(a file in the owner's browser, doesn't). It gets sampled and thresholded
like everything else, so it mixes, folds, screens and inks the same way.
`exposure` (0.2-2.5) is gamma before the threshold; `fit` is cover or
contain. Never invent a `src` — without a real one the layer is blank.

**Headlines.** `titleSize` is `s | m | l | fit`. `fit` grows the headline
until it fills the frame inside the margin, so short copy comes out
enormous and long copy comes out smaller, and neither overflows. Optional
`titleWeight` (100-900; serif caps at 700, gothic at 400) and `margin`
(24-240, default 96).

**Parameters can travel.** A `forms` layer may carry `motion`, a map of
parameter name to `{ to, wave, cycles, phase }` — the parameter's own value
is where the trip starts, `to` is where it goes, `wave` is
sin|tri|saw|square, and `cycles` is whole trips per loop (1-8, rounded).
Everything numeric is animatable, including `offsetX`/`offsetY`/`scale`/
`rotation`. A drifting `density` or `warp` is usually the difference
between a background that reads as a pattern and one that reads as motion.

**It loops.** The club's own `forms` renderer always returns to its first
frame at the end of the post, so exported reels loop — the forms, the
colour travel and any wave above are all periodic in the duration. The
WebGL `dithering` shader does not, except for `swirl` (no time in it) or
speed 0. For anything posted as a loop, use `forms`.

**Colour is per layer and off by default.** Leave `ink` out for the club's
black and white. Set it to a hex for one flat colour, or `"mix"` to scatter
the palette across the pixels. A `"mix"` layer takes four optional dials:
`inks` (hex array — the subset of the palette this layer may use),
`mixMode` blocks|bands|radial|source|noise (`source` colours by the shape's
own shading, which reads as a contour map), `mixScale` 1-12 (patch size),
`mixSpeed` 0-3 (0 holds the colours still). The slide's `colorSeed` decides
which colour starts where, and `background` sets the slide's own hex.
Generated posts stay monochrome unless colour was asked for.

Old type names from earlier spec versions (grid, mesh, orbits, lattice…)
are auto-mapped to the closest dithering equivalent, and the old slide-wide
`color: true` switch still reads as "palette on every layer", so old links
keep working.

## Instant links (no AI needed)

For a quick single-slide post, skip the spec entirely:
`/postlab?title=Line one // line two&body=...&kicker=...&format=portrait&theme=dark&shape=sphere`
— params build the spec in the browser; `//` becomes a line break. The
Notion queue's "Instant link" formula column assembles these automatically.
Use the encoded `#spec=` form when you need carousels or fine control.

## The queue automation (Notion → post)

Three Notion databases under the "The Motion Social Club" hub page drive
the club's content loop:

- **tMSC Pipeline** — `collection://de912cbf-c9df-440c-8a17-c1ef8a9c1d1d`
  One row per idea. Status flows `Angle → Chosen → Drafted → Ready →
  Generated → Scheduled → Posted`. Columns: Name, Angle, Pillar,
  Objective (relation), Source (relation to a library post), Format,
  Copy, Notes, LinkedIn draft, Post link, Schedule, Instant link
  (formula, zero-AI). ("Canva link" exists but is unused — Canva is out
  of the loop; the Post Lab is the club's visual system.)
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

**Job 1 — visuals.** For each Pipeline row with `Status = 'Ready'`:
distill its body/Copy/Notes into a PostSpec per this skill, encode it,
set **Post link** to
`https://themotionsocialclub.vercel.app/postlab#spec=<base64url>`, set
**Status** to `Generated`.

**Job 2 — angles.** Skip if 6+ rows already sit in `Angle`. Otherwise
read the library (what's over/under-published, what's gone quiet), the
active objective, and the pillars/threads in `content/site.json`, then
create exactly 3 rows with `Status = 'Angle'`, each with a Name, a 2-3
sentence Angle in the club's voice, a Pillar, the Objective relation,
and a Source relation to the post it extends. Vary across pillars;
prefer extending threads that worked over inventing new territory.

**Drafting (on demand).** When a row is `Chosen` and the owner asks,
write the **LinkedIn draft** — hook line, short paragraphs, no links in
the body, no hashtag soup — and set Status to `Drafted`. LinkedIn is the
club's primary channel (~26k followers); other channels only on request.

**Closing the loop.** When a row reaches `Posted`, add it to the Content
library (Channel, Date, Type, Pillar) so future angle proposals see it.

## Editorial defaults

The studio's own recipes are the reference — fetch `/api/postlab/schema` and
read `presets`, or copy one of these. Every one of them is a sheet unless it
says otherwise.

- **A month's round-up** → `portrait`, ash ground, `grid: 7`, a `tag` of
  `MM/YY`, serif `fit` headline centred with one italic run, everything else
  off. The club's most-used post.
- **A line worth keeping** → `portrait`, paper ground, sans `m` headline at
  `anchor: "bottom"`, `kicker` top left and `note` top right, and one `forms`
  `blobs` layer inked from the palette, scaled to about 0.6 and pushed to the
  half of the sheet the words don't use. Never let a procedural form land
  behind the headline — give the type its own half.
- **A quote** → `square`, ash ground, `grid: 6` at `gridAlpha: 0.12`, serif
  `fit` centred with German low quotes („…"), the attribution in `footer`.
- **A reference card** → `portrait`, slate ground, `theme: "dark"`, sans
  headline at `anchor: "top"` with the source in `body`, a numbered `tag`, a
  `note` for where it was seen.
- **A poster** → `square`, ash, sans `fit` in caps at weight 700, `grid: 6`
  with `gridTop: true` so the ruling crosses the letters.
- **Carousel** → `portrait`, one sheet per idea with the same ground and
  ruling throughout (that sameness is what makes four slides read as one
  piece), a `tag` of `01`, `02`, `03`, and the cover carrying the promise.
- **Reel** → `story`, one slide, a dithered background, duration 6-10 —
  `forms` loops seamlessly at exactly that length, `dithering` does not.
- **Link / video share** → `landscape`, one slide, shorter title (`s`/`m`),
  keep the block tight since the frame is short.
- Content to draw from lives in `content/site.json` (quotes, threads,
  pillars, archive titles).
