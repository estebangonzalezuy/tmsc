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
    "titleFont": "serif" | "sans" | "gothic",  // serif = editorial, sans = poster, gothic = blackletter
    "italic": false,                            // serif italic = the club's emphasis
    "titleSize": "s" | "m" | "l",
    "boxed": false,                             // outlined box around headline
    "plate": false,                             // filled bg behind headline (legibility)
    "align": "left" | "center",
    "ring": false,                              // orbit ring of circled letters
    "veil": 0.25,                               // 0-0.9 wash dimming the background
    "titlePixel": 0,                            // 0-32, dithers the title into sharp blocks; 0 = off
    "metaPixel": 0,                             // 0-32, same dithering for kicker/body/footer/letter/ring
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
