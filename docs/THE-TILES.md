# the Tiles

The club's third studio, at `/tiles`. It makes a **tile**: a framed square of
hand-cut folk ornament — radial, flat-coloured, printed rather than rendered,
and never quite still.

It exists because the other two studios are both about words. The Posts Studio
sets a headline on a sheet and draws something behind it; the Kinetics makes
the words themselves the picture. A tile has no words in it at all, and trying
to reach one from either of those specs would have meant bolting an ornament
generator onto a typesetter. So it is a third instrument with its own spec,
sharing only the things it would be perverse to write twice: the clock, the
formats, the effect chain, the way out.

## The grammar

Thirteen reference tiles went in. Reading them together is what produced the
model, rather than a pile of settings:

    a frame · a panel · some guides · a stack of arms · a centre

Five things, and deliberately five. Everything in the references that looked
like a sixth turned out to be an arm:

- the pinwheel field *behind* the rays is an arm of wedges with a wide angular
  width, so it fills;
- the beads threaded along a spoke are an arm of beads;
- the four dots in the corners are an arm of four dots at radius 1.24, turned
  45°.

A tile is not a background plus a foreground. It is a stack of repeats around
one point, and saying so out loud is what keeps the tool small: one arm
renderer, one panel, one border, and no special cases.

### the frame

A band of colour around the edge with a row of **ticks** running through it —
the stitched, stamped edge of a printed tile. Ticks are placed by distance
around the whole perimeter rather than per side, so they carry through the
corners at an even pitch; a per-side loop leaves four visible gaps. `tickAt` is
where across the band they sit, and at 0 they are centred on the very edge of
the canvas and half of each is cut off, which is exactly what the references
do. `outer` gives the outermost strip its own colour — one reference in
thirteen needs it.

### the panel

A rounded rectangle inset by the band, filled with the ground, and **clipping
everything after it**. That clip is why an arm can be given a radius past the
edge and simply run into the corners; most of the references do exactly that,
and it is the difference between shapes that look cut and shapes that look
arranged.

It is walked as four lines and four corner arcs rather than drawn as a
superellipse. A superellipse is one clean expression but it is never actually
square, and at this sample density the corner is the first thing to round off.

### the guides

The dashed lines a tile was set out with, left in. Three kinds, because the
references use three: **spokes** out from the middle, **rings** around it, and
**arcs** that curl on their way out. All three share one ink and one dash,
because in every reference they are plainly the same pencil. `top` puts them
over the ornament instead of under it.

### the arms

One repeat around the centre, and how many of it. `count` copies at equal
angles is the whole of the symmetry; `mirror` reflects every other copy, which
turns the rotation into a mirror symmetry. Four of the thirteen are mirrored
and the rest turn, and nothing else was needed to tell them apart.

Eight shapes. Six of them run from the middle outwards and differ only in
their **profile** — how the width changes along the way — which is why they
share one renderer and six numbers rather than six functions that can drift
apart:

| shape | profile |
| --- | --- |
| `lance` | a spindle, pointed at both ends, widest in the middle |
| `ribbon` | one thickness the whole way, which is what takes a wave best |
| `wedge` | a blade: its width is an **angle**, so at 1 the blades touch and the field fills |
| `petal` | narrow at the middle, widest near the rim |
| `bar` | one thickness with round ends, usually not reaching the centre |
| `hook` | a bar that holds its line and then turns all at once (the same twist, read through `t²·⁴`) |

The other two place marks instead of drawing a stroke: `chain` threads beads
along the spoke, and `dot` puts one mark at one radius.

**The wave is a distance, not an angle.** Written as an angle it looked right
near the middle and thrashed at the rim, because the same few degrees are a
few pixels at r=0.2 and half the panel at r=1.4 — a ribbon that starts as a
waver and ends as a whip. Measured across the ray instead, one wave setting is
one wave everywhere along it, and it is damped near the middle so a bundle of
rays still converges on a point.

**And the wave travels.** `ripple` is whole waves run *along* the ray over the
loop, so the meander leaves the middle and goes out to the rim rather than
standing there — a stroke with a wave looping out of it, which is the one
deformer the arm was missing and the one that turns an ornament into a piece
of generative motion. Whole waves, so the crest at the end of the loop is
exactly where the crest before it was; negative runs it back inwards.

**And every copy can be late.** `stagger` is the duplicator's delay: how much
of the loop each copy runs behind the one before it, as a share of the loop
across the whole ring. It moves the *phase* and never the angle, so the ring
stays evenly spaced however far it is staggered — and it moves the phase of
everything on the arm at once (the breath, the sway, the travelling wave, the
marching beads), because they all read the playhead and a copy is simply handed
its own. At 0 the arm breathes as one object. At 1 the delay adds up to a whole
loop by the time it has gone round, and whatever the arm does travels round the
tile as a wave.

Neither can open a seam, and for the two reasons the rest of the file gives:
`ripple` is a whole number, and a phase offset of something periodic is the
same periodic thing.

## Nothing is drawn straight

Every closed shape — the panel, an arm, a bead, a tick — is built as an exact
outline and then pushed about by `wobbleClosed` before it is filled. The
displacement is smooth noise along the outline's own arc length, applied along
each point's own normal, so a shape swells and pinches rather than sliding, and
a long edge gets more wobbles than a short one.

Two details are load-bearing:

- **The noise wraps.** The lattice index is taken modulo a whole number of
  wavelengths, so the value at the end of an outline is the value at its start.
  Without it every shape has one visible join, which is the one place a
  hand-drawn look reads as a bug rather than as a hand.
- **The hand is capped against the mark's own width.** A tile-wide amount that
  reads as a torn edge on a blade would eat a thread of beads entirely, so a
  bead is measured against its own radius instead of against the panel.

This is why the tool has no "sketchy" filter and doesn't need one: the sketch
is the geometry.

## The loop is a contract

Same rule as the other two studios, and for the same reason — an export is
filmed frame by frame, so a seam would ship.

Everything that moves moves through a whole number of somethings. `spin` is
whole turns. `march` is whole beads. `ripple` is whole waves along the ray.
`pulse` and `sway` are one cosine over the loop. The global `spin` is whole
turns of the whole composition. Every one of those is rounded in `normalize`,
so there is no way to write a fraction into a spec that would fail to come
back. `stagger` is the exception that proves it: it is not rounded and does not
need to be, because it shifts a phase rather than counting anything, and a
phase offset of something periodic is still periodic.

Measured rather than assumed: scrub the playhead to the start and to the end of
a rolled tile and the two frames are pixel-identical, while the middle of the
loop is plainly a different picture.

**`boil` is the interesting one.** It is the hand redrawing the tile a few
times over the loop: the wobble's seed steps through `floor(p · boil)` whole
fields and lands back on field zero at the end. That is how a hand-drawn thing
moves when nothing in it is moving, and it is why a tile with every arm held
still is still not a still image.

## Colour

A palette is four slots — the band, the ticks in it, the panel, and the inks
the arms and guides draw with. They travel together because in every reference
they were chosen together: the orange in the border is the orange in the
middle. Thirteen palettes, lifted off the references.

Any slot can be overridden by hand, and then that tile stops following its
palette in that slot — the deliberate cost of the picker, same as everywhere
else in the club.

Note that this parts company with the site, where nothing is coloured until it
is pointed at. A tile is three or four flat inks by construction; there is no
monochrome version of one that is the same object.

## The files

- `lib/tiles.ts` — the **TileSpec**: arms, frame, guides, centre, the palettes,
  the thirteen recipes, `randomTile`, `normalize`, base64url encode/decode. The
  spec travels in the URL (`/tiles#spec=<encoded>`) exactly as a PostSpec does.
- `components/tiles/render.ts` — `paint(ctx, spec, p, w, h)`, the only entry
  point, shared by the stage, the thumbnails and the exporter so they cannot
  disagree.
- `components/tiles/Tiles.tsx` — the studio, in Toolcraft chrome.
- `components/tiles/Stage.tsx` — the tile on screen, plus `Thumb`, a real
  thumbnail that follows the playhead rather than holding frame zero.
- `components/tiles/exports.ts` — PNG, webm, and a numbered run of frames.
- `components/tiles/asLayer.ts` — a tile as one layer of a post.

## Two other front doors

**A tile is a layer of a post.** `type: "tiles"` in the Posts Studio draws one
of the thirteen through the same renderer, with one `tile` choice and one
`tdensity` dial that scales every count in it at once. It counts as
`generative` for the same reason the Kinetics does — canvas 2D, a pure function
of the frame, periodic in the post's duration — so the exporter draws it
directly and a reel with a tile in it still loops.

It is the one layer that brings its own colour. Set the layer's `ink` to
`"mix"` and the post's palette takes over the ornament instead.

**A tile is a tool.** `/tools/tile` asks four questions — which one, what
colour, how much, how hard the hand shakes — and hands back a PostSpec with a
single tile layer and every part of the sheet switched off. It is the one tool
with nothing to say, which is what a tile is.

## Adding to it

- **A shape** is one entry in `SHAPES`, one row in `PROFILE` and one in
  `CAPPED` in `render.ts`, and nothing in the panel: the arm block is generated
  from the shape list. If it needs a control the arm doesn't have, ask first
  whether it is really the same shape with a different profile.
- **A palette** is one entry in `PALETTES`. Adding one restyles nothing that
  already exists, because a spec names its palette by id.
- **A recipe** is one entry in `RECIPES` — a whole composition, since unlike a
  Kinetics recipe there is nothing of yours in a tile for it to preserve.
- Keep `normalize` total. Every field added since v1 must default to absent,
  and absent must mean the look older links were shared with.
