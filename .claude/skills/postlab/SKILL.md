---
name: postlab
description: Turn a prompt, note, or Notion doc into a tMSC Posts Studio link — a poster for /postlab. Use when the user asks to "make a post", wants club content turned into social posts, or asks for a postlab link.
---

# Generating tMSC posts with the Posts Studio

The Posts Studio (`/postlab`) makes one kind of thing: a **poster** — a row of
vertical totems on a sheet of paper, with a line of type under them. A post is
fully described by a small JSON object, and your job is to build that object
and hand back a link.

This replaced the node-graph model in September 2026, which had replaced a
flat `PostSpec` before that. **Only `#poster=` links work.** A `#graph=` or
`#spec=` link from before is dead; the studio will open the nearest real
poster rather than failing, but it will not be the post that link described.

## The object

```json
{
  "format": "4:5",
  "ground": "#ffffff",
  "palette": "club",
  "columns": 4,
  "seed": "practice",
  "silhouette": "mix",
  "fill": "mix",
  "kicker": "the Motion Social Club",
  "title": "You don't need more tutorials. You need more practice.",
  "textPlace": "bottom",
  "motion": 1
}
```

Every field, and the only values each one takes:

- **`format`** — `"1:1"` (square), `"4:5"` (portrait, the default for the
  feed), `"9:16"` (story).
- **`ground`** — the sheet. `"#ffffff"` unless there is a real reason.
- **`palette`** — `"club"`, `"playa"`, `"monte"`, `"ink"`, `"citrus"`.
- **`columns`** — 2 to 7. Four is the club's usual row; two reads as a
  statement, six as a pattern.
- **`seed`** — any short string. It decides the shapes, the segments and the
  colours, so **the same seed always draws the same poster**. Use something
  from the post itself so a post is recognisable later.
- **`silhouette`** — `"mix"`, or pin every column to one of: `stadium`,
  `capsule`, `block`, `octagon`, `beads`, `ziggurat`, `hourglass`, `scallop`.
- **`fill`** — `"mix"`, or pin every segment to one of: `solid`, `stripes`,
  `waves`, `blobs`, `chain`, `clover`, `camo`, `dots`.
- **`kicker`** — the small caps line. Usually the club, a letter number, or a
  day.
- **`title`** — one honest line. It is set in the club's serif and sized to
  fit, so do not try to control the break; just write a good line.
- **`textPlace`** — `"bottom"` (default), `"top"`, or `"none"` for a poster
  that is only shapes.
- **`motion`** — whole cycles per six-second loop. `1` is right almost
  always; `0` holds it still.

## Making the link

Encode the JSON as base64url (standard base64, then `+`→`-`, `/`→`_`, strip
`=` padding) and hand back:

```
https://themotionsocialclub.vercel.app/postlab#poster=<encoded>
```

Say in one line what the poster is — the palette, the row, the line — so the
person knows what they are about to open.

## How to choose

- **`"mix"` for both, and roll the seed, is the right answer most of the
  time.** The composition is the club's; your job is the words.
- **Pin a silhouette when the post has one idea.** `beads` or `chain` for
  something about rhythm or steps; `ziggurat` for something about building
  up; `stadium` when the words should do all the work.
- **Pin a fill sparingly.** `stripes` and `waves` read as pattern, `blobs`
  and `camo` as texture, `chain` and `dots` as counting, `clover` as
  ornament, `solid` as rest.
- **Let the line breathe.** A long title is set smaller automatically, but a
  poster with thirty words on it is a screenshot of a paragraph, not a post.
- **Several posts is several posters.** There are no carousels in this model:
  make a poster per idea and hand back a link for each, sharing a seed if
  they should look like a set.

## The voice

The words matter more than the shapes. Honest, human, anti-hype, short lines;
`docs/voice/PROFILE.md` in a repo checkout is the full profile and its hard
rules. Never write a caption that promises a number the club cannot show.

## If you have a checkout

`lib/poster.ts` is the whole model and the whole renderer: the type
definitions, `makeTotems`, `drawPoster`, `encodePoster`/`decodePoster`. Read
it rather than guessing, and prefer calling `encodePoster` to hand-rolling
base64. There is no fetchable schema endpoint — a session with no checkout
works from this file, which is a real, disclosed limitation.
