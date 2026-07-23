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
  "format": "square" | "portrait" | "story" | "landscape",  // 1:1 post, 4:5 feed/carousel, 9:16 reel, 16:9 link/video post
  "duration": 6,                               // seconds recorded for video export
  "slides": [{
    "kicker": "the Motion Social Club",        // small underlined label
    "title": "Line one\nLine two",             // headline
    "body": "",                                // optional supporting sentence
    "footer": "@themotionsocialclub",
    "letter": "M",                             // circled letter top right, "" hides
    "text": true,                              // false = pure background, no typography
    "titleFont": "serif" | "sans",             // serif = editorial, sans = poster
    "italic": false,                            // serif italic = the club's emphasis
    "titleSize": "s" | "m" | "l",
    "boxed": false,                             // outlined box around headline
    "plate": false,                             // filled bg behind headline (legibility)
    "align": "left" | "center",
    "ring": false,                              // orbit ring of circled letters
    "veil": 0.25,                               // 0-0.9 wash dimming the background
    "theme": "light" | "dark",
    "layers": [                                 // 1-4 background layers, bottom first
      { "type": "mesh", "speed": 0.4 },
      { "type": "dithering", "shape": "simplex", "size": 2,
        "blend": "multiply", "opacity": 0.8 }
    ]
  }]
}
```

Each layer also accepts `opacity` (0-1), `blend` (normal | multiply |
screen | overlay | darken | lighten | difference | exclusion), and a
transform: `offsetX`/`offsetY` (-1..1), `rotation` (degrees), `scale`
(0.1-4). Blending a texture over a gradient (mesh + dithering multiply)
is the signature look. v1 specs with a single `shader` field still load.

The Post Lab is a **dithering instrument** — every background is dithered
pixels in the slide's two tones. Two layer types (plus `none` for plain):

- `dithering` (Paper Shaders): `shape` simplex|warp|dots|wave|ripple|swirl|
  sphere, `dtype` 4x4|8x8|2x2|random, `size` (pixel 1-14), `speed`, `scale`.
- `forms` (canvas ordered dither, shapes the shader lacks): `pattern`
  rings|ramp|bars|letter (giant dithered type), `word` M|tMSC|MOTION|CLUB,
  `pixel` (2-16), `density`, `warp` (0-1 flow-field deformation), `speed`.

Colors are never specified — strictly black & white. Old type names from
earlier spec versions (grid, mesh, orbits, lattice…) are auto-mapped to the
closest dithering equivalent, so old links keep working.

## Instant links (no AI needed)

For a quick single-slide post, skip the spec entirely:
`/postlab?title=Line one // line two&body=...&kicker=...&format=portrait&theme=dark&shape=sphere`
— params build the spec in the browser; `//` becomes a line break. The
Notion queue's "Instant link" formula column assembles these automatically.
Use the encoded `#spec=` form when you need carousels or fine control.

## The queue automation (Notion → post)

The owner queues post ideas in the Notion database **"the Post Lab
queue"** (data source `collection://de912cbf-c9df-440c-8a17-c1ef8a9c1d1d`,
under "The Motion Social Club" hub page). Columns: Name (title), Status
(Draft | Ready | Generated | Posted), Format (auto | square | portrait |
story | carousel | reel), Post link (URL), Notes. The post content lives
in the page body; Notes carries style direction.

To process the queue (a scheduled Routine does this hourly; any session
can do it on demand):

1. Query the data source for pages with `Status = 'Ready'`. None → done,
   end quietly.
2. For each Ready page: fetch its body and Notes, distill into a PostSpec
   per this skill (Format `carousel` → portrait multi-slide; `reel` →
   story single slide, animated dithering background; `auto` → judge from
   the content). Respect the Notes.
3. Encode and write back: set **Post link** to
   `https://themotionsocialclub.vercel.app/postlab#spec=<base64url>` and
   **Status** to `Generated`. Touch nothing else — never edit rows in
   other statuses, and never modify repo code for this task.
4. If the row's Notes mention "canva", also produce a Canva design (for
   editing in the Canva app on phone/tablet): copy the master design
   `DAHPx9zFsfY` (poster — kicker/title/subtitle/footer) or `DAHPx5Abjpo`
   (serif quote — kicker/title) with the Canva `copy-design` tool, fill
   the copy's text via an editing transaction, commit, and write the
   copy's edit URL into the row's **Canva link** property.

## Editorial defaults

- Single quote/thought → `square`, dark theme, `dithering` sphere, serif
  italic, centered, no letter, veil ~0.5.
- Announcement → `portrait`, light, `dithering` wave, sans `l` boxed with
  plate.
- Carousel → `portrait`, dark hook slide first, then one idea per slide,
  numbered circled letters ("1", "2", …), kickers like "01 — idea name";
  vary the dithering shape (or a `forms` pattern) per slide.
- Reel → `story`, one slide, `dithering` sphere or `forms` rings/letter,
  duration 6-10 — everything loops seamlessly at exactly that length.
- Link / video share (YouTube, article) → `landscape`, one slide, shorter
  title (titleSize `s`/`m`), keep the block tight since the frame is short.
- Content to draw from lives in `content/site.json` (quotes, threads,
  pillars, archive titles).
