# Frames

A small tool for making the club's posts and carousels as JavaScript
animations. It lives beside the site, not in it: no Next, no React, no
Tailwind, no build step, no dependencies.

Open it two ways. Double-click `index.html` in this folder, in Chrome or
Edge, and it works with no server. Or reach the deployed copy at
`/frames/index.html` on the site: this folder sits in `public/`, which Vercel
serves verbatim, so a push to `main` publishes it a minute later. Use the
full file name, since `public/` does no directory-index resolution and
`/frames/` alone has no page. It is unlisted, not protected, the way the
Studio and the Desk are.

Either way the fonts come from Google Fonts, so the first load wants a
connection; after that the browser has them.

The one thing it takes from the Posts Studio is the four formats, copied
into `formats.js`:

| format    | px          | ratio | for               |
| --------- | ----------- | ----- | ----------------- |
| square    | 1080 × 1080 | 1:1   | feed post         |
| portrait  | 1080 × 1350 | 4:5   | feed / carousel   |
| story     | 1080 × 1920 | 9:16  | reel / story      |
| landscape | 1080 × 608  | 16:9  | link / video post |

## The idea

A post is a list of slides. A slide is the body of one function:

```js
function (ctx, t, s) {
  // ctx  a 2D canvas context; 0..s.w × 0..s.h is the post
  // t    loop progress, 0 → 1, then it wraps
  // s    sizes, timing and a small helper kit
}
```

It is called once per frame and draws the whole picture from `t` alone. No
state between calls, no `Math.random`, no clock. That rule is what makes the
live preview, the thumbnails in the rail and every exported frame come out of
the same function, and two exports of the same post byte-identical.

A single post is one slide. A carousel is several. The **Shared** tab is code
that runs before every slide, so colours, the faces and any helper you want in
all of them go there.

## Options

A slide declares what can be changed from the **Options** tab by asking for
the value as it draws. Each call returns the current value, and the panel
builds a control for it:

```js
const ground = s.color("Ground", "#fffdf0");          // a colour, with the club swatches
const copy = s.text("Headline", "Question\nourselves"); // copy; a default with line breaks gets a multi-line field
const shake = s.range("Shake", 0.3, 0, 1);             // a slider
const entrance = s.pick("Entrance", "rise", s.ENTRANCES); // a choice
const showFooter = s.toggle("Footer", true);           // on or off
```

Values live on the slide (`opts` in the JSON and the link), so a carousel can
run the same code on every point with different copy, which is what the
carousel starter does. **Reset** returns a slide to its own defaults.

## Motion

| name                          | what it is                                                                 |
| ----------------------------- | -------------------------------------------------------------------------- |
| `enter(name, p, size)`        | a named entrance at progress `p`: `rise drop pop slide spin fade none` (in `s.ENTRANCES`), as `{dx, dy, scale, rot, alpha}` |
| `place(x, y, fx, () => …)`    | draws under that transform at (x, y)                                       |
| `shake(t, seed, cycles)`      | a smooth seeded shake, `{x, y}` in about −1..1, whole cycles per loop     |
| `jitter(t, i, steps)`         | a stepped random offset per item, new every 1/steps of the loop           |
| `step(t, n)`                  | `t` in n steps                                                             |
| `scramble(text, p, t, seed)`  | the first `p` of the text settled, the rest churning through random letters |

Stagger with `s.stagger`, ease the result, hand it to `s.enter`, draw inside
`s.place`. Add `s.shake` or `s.jitter` to the position for a shake.

## Grit

The rough type on the club's posts is a fragment shader, `s.grit`, run over
a layer the type was drawn on, in the manner of a screen or offset print
(WebGL; a browser without it gets the layer back untouched):

```js
const L = s.layer("type");          // a post-sized offscreen canvas
const g = s.on(L.ctx);              // the same stage, drawing into it
g.rich("Rough is a *choice.*", s.w / 2, s.h / 2, { size: 200, family: serif, weight: 700, align: "center" });
s.grit(L.canvas, { texture: 1, grain: 0.6, chunk: 4, rough: 2, bleed: 3, chroma: 8, boil: 10, t });
```

A tooth field eats into the ink everywhere, so the inside of a letter goes
uneven and speckled and its edge breaks up where the field bites through,
rather than the outline being pushed about.

| knob      | what it does                                                                    |
| --------- | ------------------------------------------------------------------------------- |
| `texture` | how much the tooth eats into the ink, 0..1.5; past 1 the letters fall apart     |
| `grain`   | what the tooth is: coarse mottle at 0, fine per-cell speckle at 1               |
| `chunk`   | the speckle cell in px; the mottle scales with it                               |
| `rough`   | a small wobble of the outline, in px                                            |
| `bleed`   | thickens (+) or thins (−) the shape by that many px, like ink on soft paper     |
| `chroma`  | misregisters the colour plates by that many px, each plate on its own tooth     |
| `boil`    | re-rolls the noise that many times per loop, so the print boils                 |
| `hard`    | `false` keeps soft coverage; the default snaps it, like a stencil               |

`gritOptions(s, t, defaults)` in the Shared block declares all seven as
options in one go and returns what `s.grit` takes. Blobs, Tape, Polygons and
Ribbons carry them, with a Grit switch; **Torn** is the shader on its own, at
full strength, and its paper tooth is the same shader over a faint rectangle.
The shader is deterministic: the same frame renders byte-identical.

## Faces, colours, backgrounds

Two faces, loaded from Google Fonts and nothing else: **Archivo** (`sans`,
weights 100–900, with italics) and **Lora** (`serif`, 400–700, with italics).
The default Shared block declares them, the club's colours as `P`, named ink
sets as `SETS` (`club warm cool mono festival garden`), and fifteen background
systems, each a seamless loop:

- `confetti(ctx, s, t, {ground, inks, radius, swing, seed})` — a packed field
  of discs, each circling its home once per loop.
- `tape(ctx, s, t, {ground, columns, inks, speed, seed})` — columns of dots and
  stacked bars scrolling like punched tape, a whole number of repeats per loop.
- `stripes(ctx, s, t, {ground, rule, ink, count, dir})` — faint pale rules
  drifting one pitch per loop, with small dots breathing between them.
- `checker(ctx, s, t, {a, b, cells})` — coarse cells in two tints, flipped by
  a wave crossing the diagonal.
- `crosses(ctx, s, t, {ground, ink, cols, size})` — a grid of registration
  marks drifting a cell per loop, each blinking on its own phase.
- `rings(ctx, s, t, {ground, ink, bead, count})` — concentric hairlines
  growing from the centre, a bead orbiting each.
- `dashes(ctx, s, t, {ground, inks, count, tilt, seed})` — slanted strokes
  falling a whole number of heights per loop.
- `rays(ctx, s, t, {ground, color, count, width, origin, sway})` — a fan of
  amber bands from a point below the frame, rocking once per loop.
- `burst(ctx, s, t, {ground, inks, count, span, spin, seed})` — two fans of
  outlined wedges, up and down from a point, rocking once per loop.
- `ribbons(ctx, s, t, {ground, inks, count, width, angle, fan, wave, cross})`
  — a bundle of upright stripes converging downward, each swaying.
- `polygons(ctx, s, t, {ground, block, inks, sides, count})` — thick polygon
  rings growing from the centre one after another, dark slabs at the edges.
- `strings(ctx, s, t, {ground, line, inks, count, spin, seed})` — spokes from
  a centre with a leaf at the end of each, turning once per loop.
- `bricks(ctx, s, t, {ground, pairs, rows, cols, inset, seed})` — an inset
  running bond of two-colour rows, every other row sliding the other way.
- `network(ctx, s, t, {ground, inks, count, line, radius, seed})` — a cluster
  of overlapping discs, each on a thin pin, sliding a little.
- `blobs(ctx, s, t, {ground, line, count, seed})` — thin outlines of soft
  shapes drifting and wobbling.
- `sweep(ctx, s, t, {ground, band, pale, stripe, tape, swing})` — a thick
  black band curving up through the frame with a pale one beside it, striped
  tape on both edges.

The last nine were read off the club's own Instagram, frame by frame from a
screen recording, and matched against those frames side by side: the "3
exercises", "Build your path", "Taller para empezar", "You don't need more
options", "Don't just follow the tutorial", "You don't learn motion design",
"Make Genuine Connections", "You need more practice" and "Job titles are
getting abstract" posts. Their colours are sampled from the frames, so the
palette carries a few hexes beyond the site's (`orange`, `violet`, `sky`,
`forest`, `brown`, `hotpink`).

Over them, boxed type: `box(ctx, x, y, w, h, fill?, stroke?)` is the hairline
frame the type overhangs, `pill(ctx, s, text, cx, cy, {size, fx, …})` a line
of Lora in a pill under an entrance, `tag(ctx, s, text, cx, cy)` a small
numbered box, `echo(ctx, s, text, x, y, {size, color, offsets})` type with
hard offset copies behind it like a misregistered print, and
`footer(ctx, s, {text, color, fill, alpha, box})` the "the Motion Social
Club" line. Rich text also takes `__word__` for an underline, and
`s.scramble(text, p, t)` churns the unsettled part of a line through random
letters.

The starters: Confetti, Tape and Stripes are the three references, animated;
Checker, Crosses, Rings and Dashes extend the family; Rays, Burst, Ribbons,
Polygons, Strings, Bricks, Network, Blobs and Sweep are the Instagram posts;
Torn is the grit shader alone. Every one declares its colours, copy, an entrance and a
shake as options.

## The stage `s`

| name                                   | what it is                                                           |
| -------------------------------------- | -------------------------------------------------------------------- |
| `w`, `h`                               | the format's size in pixels                                          |
| `seconds`, `fps`, `frame`              | loop length, frame rate, current frame index                         |
| `index`, `count`                       | this slide's position and the number of slides                       |
| `TAU`                                  | 2π                                                                   |
| `span(t, from, to, ease?)`             | 0 before `from`, 1 after `to`, eased between                         |
| `stagger(t, i, n, {from,to,overlap,ease})` | progress of item `i` of `n`, windows overlapping (0..1, default 0.6) |
| `ping(t)`                              | 0 → 1 → 0, a triangle over the loop                                  |
| `wave(t, cycles)`                      | 0 → 1 → 0, smooth, a whole number of times per loop; always seamless |
| `ease.*`                               | `linear in out inOut quadIn quadOut expoIn expoOut backIn backOut elasticOut bounceOut` |
| `wrap(t)`, `clamp`, `lerp`, `map`      | the usual                                                            |
| `rand(seed)`                           | a seeded generator, identical every frame                            |
| `hash(i, seed?)`                       | one stable number in 0..1 for an index                               |
| `lines(text, maxWidth)`                | word-wrap with the current `ctx.font`; `\n` forces a break           |
| `fit(text, maxWidth, {max,min,weight,family})` | largest size that fits one line; sets `ctx.font`, returns the size |
| `circle(x, y, r)`, `roundRect(x, y, w, h, r)` | begin a path; you fill or stroke it                           |
| `font({size, weight, italic, family})` | builds a `ctx.font` string. Archivo has a width axis too: `ctx.fontStretch = "condensed"`, or `stretch` on `rich` |
| `rich(text, x, y, {size, weight, family, align})` | one line where `*word*` is italic and `**word**` bold; returns its width. `measure(text, o)` measures without drawing |
| `justify(text, x, y, width, spread)`   | spreads a line's words across `width`; `spread` 0 packs, 1 justifies |
| `layer(name)`                          | a cleared offscreen `{canvas, ctx}` the size of the post              |
| `warp(canvas, {slice, dx, sx})`        | draws a layer in horizontal slices, each shifted by `dx(v)` and stretched by `sx(v)`, `v` = 0 top, 1 bottom |
| `grit(canvas, {…})`, `on(ctx2)`        | the grit shader (see above); the same stage bound to another context      |

Anything that spins, scrolls or ripples should do so a whole number of times
per loop, so `t = 1` lands on `t = 0`. The starters show the idiom.

## Around the stage

- **Play / Space** plays the loop. The scrubber and **← →** step through it.
  **↑ ↓** move between slides.
- **+ Add slide** inserts a starter after the current slide. **New carousel**
  replaces the post with a five-slide one to take apart.
- The post autosaves in the browser. **Save** writes it as `.json`, **Open…**
  reads one back, **Copy link** puts the whole post in the URL.
- **PNG** and **All PNGs** take the scrubber's instant at full size.
  **Video** records one loop of this slide. **Reel** records every slide in
  order, one loop each, into one file, which is how a carousel becomes a reel.
  Recording draws every frame itself, in real time, so a six-second loop
  takes six seconds. Chrome writes MP4; a browser without that gets WebM.

## Files

- `index.html`, `style.css` — the shell.
- `formats.js` — the four formats.
- `runtime.js` — compiles a slide, the helper kit, renders one frame.
- `presets.js` — the Shared block, the starters and the carousel, written as real functions.
- `exporter.js` — PNG, and frame-by-frame video through MediaRecorder.
- `app.js` — the UI: rail, stage, transport, editor, files, links, export.
