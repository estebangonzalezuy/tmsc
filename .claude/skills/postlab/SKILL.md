---
name: postlab
description: Turn a prompt, note, or Notion doc into a tMSC Post Lab link — an animated Instagram post, carousel, or reel spec for /postlab. Use when the user asks to "make a post", "create a carousel/reel", or wants club content turned into social posts.
---

# Generating tMSC posts with the Post Lab

The Post Lab (`/postlab`) renders the club's posts: a grayscale animated
shader background (Paper Shaders) plus the club's typography (Archivo/Lora,
circled letters, boxed headlines, orbit rings). A post is fully described by
a **PostSpec** JSON; your job is to write that JSON and hand back a link.

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
  "v": 1,
  "format": "square" | "portrait" | "story",  // 1:1 post, 4:5 feed/carousel, 9:16 reel
  "duration": 6,                               // seconds recorded for video export
  "slides": [{
    "kicker": "the Motion Social Club",        // small underlined label
    "title": "Line one\nLine two",             // headline
    "body": "",                                // optional supporting sentence
    "footer": "@themotionsocialclub",
    "letter": "M",                             // circled letter top right, "" hides
    "titleFont": "serif" | "sans",             // serif = editorial, sans = poster
    "italic": false,                            // serif italic = the club's emphasis
    "titleSize": "s" | "m" | "l",
    "boxed": false,                             // outlined box around headline
    "plate": false,                             // filled bg behind headline (legibility)
    "align": "left" | "center",
    "ring": false,                              // orbit ring of circled letters
    "veil": 0.25,                               // 0-0.9 wash dimming the shader
    "theme": "light" | "dark",
    "shader": { "type": "dithering", "shape": "sphere", "speed": 0.5 }
  }]
}
```

Backgrounds (`shader.type` + params, all optional with defaults) come in
two kinds. **Generative** — Cavalry-style procedural motion that loops
seamlessly over `duration`; prefer these for reels and motion-forward
posts: `grid` (staggered pulsing grid; shape: circle|square|cross, density,
size, stagger, speed), `rays` (radial burst; count, inner, weight, speed),
`tunnel` (expanding rings; shape: circle|square, count, weight, speed),
`bars` (kinetic bar field; rows, phase, fill, speed), `orbits` (the club's
orbit motif animated; rings, dots, dotSize, speed), `bloom` (golden-angle
dot spiral; count, size, speed), `field` (oscillating line waves; rows,
amplitude, frequency, speed). **Shaders** (Paper Shaders textures): `none`,
`dithering` (shape: simplex|warp|dots|wave|ripple|swirl|sphere, size, speed,
scale), `waves` (still; shape 0-3, amplitude, frequency, spacing, rotation),
`mesh` (distortion, swirl, grainOverlay, speed), `perlin` (proportion,
softness, scale, speed), `voronoi` (gap, glow, scale, speed), `metaballs`
(count, size, speed), `warp` (shape: checks|stripes|edge, distortion, swirl,
speed), `spiral` (density, strokeWidth, distortion, speed), `smoke`
(thickness, radius, speed). Colors are never specified — everything is
black & white by design.

## Editorial defaults

- Single quote/thought → `square`, dark theme, `dithering` sphere, serif
  italic, centered, no letter.
- Announcement → `portrait`, light, `waves` rotated 90°, sans `l` boxed.
- Carousel → `portrait`, dark hook slide first, then one idea per slide,
  numbered circled letters ("1", "2", …), kickers like "01 — idea name".
- Reel → `story`, one slide, a generative background (`orbits`, `bloom`,
  `grid`), duration 6-10 — generative motion loops seamlessly at exactly
  that length.
- Content to draw from lives in `content/site.json` (quotes, threads,
  pillars, archive titles).
