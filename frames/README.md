# Frames

A small tool for making the club's posts and carousels as JavaScript
animations. It lives beside the site, not in it: no Next, no React, no
Tailwind, no build step, no dependencies. Open `index.html` in Chrome or
Edge (double-click it, or serve the folder with anything) and it works.

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

## Faces, colours, backgrounds

Two faces, loaded from Google Fonts and nothing else: **Archivo** (`sans`,
weights 100–900, with italics) and **Lora** (`serif`, 400–700, with italics).
The default Shared block declares them, the club's colours as `P`, and three
background systems, each a seamless loop:

- `confetti(ctx, s, t, {ground, inks, radius, seed})` — a packed field of discs
  on green, each circling its home once per loop.
- `tape(ctx, s, t, {columns, inks, seed})` — columns of dots and stacked bars
  scrolling like punched tape, a whole number of repeats per loop.
- `stripes(ctx, s, t, {count, dir})` — faint pale rules drifting one pitch per
  loop, with small dots breathing between them.

Over them, boxed type: `box(ctx, x, y, w, h, fill?)` is the hairline frame the
type overhangs, `pill(ctx, s, text, cx, cy, {size, scale, …})` is a line of
Lora in a white pill, and `footer(ctx, s, {text, color, alpha})` is the boxed
"the Motion Social Club" line. The Confetti, Tape and Stripes starters are the
three references, animated; the carousel uses all three.

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
| `font({size, weight, italic, family})` | builds a `ctx.font` string                                           |
| `rich(text, x, y, {size, weight, family, align})` | one line where `*word*` is italic and `**word**` bold; returns its width. `measure(text, o)` measures without drawing |
| `justify(text, x, y, width, spread)`   | spreads a line's words across `width`; `spread` 0 packs, 1 justifies |
| `layer(name)`                          | a cleared offscreen `{canvas, ctx}` the size of the post              |
| `warp(canvas, {slice, dx, sx})`        | draws a layer in horizontal slices, each shifted by `dx(v)` and stretched by `sx(v)`, `v` = 0 top, 1 bottom |

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
