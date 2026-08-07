# the Directory

The club's public, filterable index of motion design resources. Live at
`/directory`, one page per collection at `/directory/<id>`.

The premise, in one line: **everything a motion designer needs to learn is
already online, and that is exactly the problem.** Two hundred YouTube
channels exist. Nobody has a list of them. The Directory is the club's
attempt to hold the scattered thing in one place — organised, filterable,
and honest about where each entry came from.

The rule that shapes it: **index, don't opine.** The Directory says what
exists and how to find it. It does not rank studios, score courses or tell
you who is good. Judgement is what the newsletter and the Practice File are
for. A directory that editorialises stops being usable the moment you
disagree with it.

---

## The shape

Five **shelves**, twelve **collections**, one **entry** schema. The shelves
are the reading order on the hub; the collections are the pages; the entries
are the rows.

| Shelf | Question it answers | Collections |
| --- | --- | --- |
| Learning, centralised | Where do I learn this? | Channels, Courses, Schools & Teachers, Books |
| Reference and inspiration | Where do I look? | Studios, Galleries & Archives, Awards & Festivals |
| Tools and technique | What do I open, and what does it cost? | Tools & Plugins, Free Files |
| Community and opportunity | Who else is doing this, and how do they get paid? | Communities & Podcasts |
| Context and language | What are the words, and where did this come from? | Glossary, Timeline |

### What's in it now

| Collection | Entries | Source | Facets |
| --- | ---: | --- | --- |
| YouTube Channels | 41 | Notion export | software, content |
| Courses | 102 | Notion export | school, skill, price, level, format, engagement |
| Schools & Teachers | 13 | seeded | budget, kind |
| Books | 18 | seeded | subject |
| Studios | 393 | Notion export | city, style, country |
| Galleries & Archives | 14 | seeded | kind |
| Awards & Festivals | 15 | seeded | kind |
| Tools & Plugins | 44 | seeded | kind, software |
| Free Files | 21 | Notion export | what, software |
| Communities & Podcasts | 15 | seeded | kind |
| Glossary | 46 | seeded | subject |
| Timeline | 22 | seeded | era |
| **Total** | **744** | | |

**`source` is a promise, and the site shows it.** `notion` means the rows
came out of the club's own databases — real curation, already used. `seed`
means the entries were written from knowledge and the links have never been
fetched. Every collection page states which it is, under the title. Nothing
in here pretends to be verified when it isn't.

---

## The entry schema

One shape for every collection, so a new collection costs a text file and a
registry line rather than a new page.

```jsonc
{
  "id": "ben-marriott",           // slug, unique within the collection
  "name": "Ben Marriott",
  "href": "https://…",            // optional — books, glossary and timeline carry none
  "note": "Modern Design, Animation Principles, 2D Effects",
  "meta": "Jake Bartlett · US$349", // right-aligned: author, teacher, price, year
  "facets": {                     // everything filterable
    "software": ["After Effects"],
    "content": ["Tutorials", "Projects"]
  }
}
```

`name`, `href`, `note` and `meta` are the row. Everything else is a facet.
Facets are multi-valued, counted, and rendered as toggle chips: values
within one facet are OR'd, separate facets are AND'd. So *(London or
Barcelona) and Mostly 3D* is two clicks.

Filters live in the query string — `/directory/studios?city=London&style=Mostly+3D`
— so a filtered view is a link you can send someone. Same contract the Post
Lab has with its `#spec=`.

---

## How it's built

Data lives in **`scripts/directory/sources/*.tsv`** — one line per entry, tab
separated, no punctuation to get wrong. Each file declares its own columns:

```
#source: notion
#cols: name	href	note	software	content
Ben Marriott	https://…	Modern Design, Animation Principles	After Effects	Tutorials;Projects
```

`name`, `href`, `note`, `meta` are entry fields; every other column becomes a
facet, semicolon-separated. Column order is filter-rail order.

```bash
node scripts/directory/build.mjs      # sources → content/directory/*.json
node scripts/directory/check-links.mjs [collection]   # fetch every href
```

`build.mjs` also does the work that would be tedious by hand: splitting
studio locations into city and country, bucketing free-text course prices
into bands, merging rows that share a name, counting facet values, and
writing `manifest.json` (the small counts-only file the hub imports so the
client bundle doesn't carry 400 studios).

**`check-links.mjs` has never been run against the seeded collections** —
this container's egress is restricted. Run it from anywhere with open
outbound HTTPS before treating a seeded link as true. It exits non-zero on
failures, so it can gate a commit.

### Why not `content/site.json`

Because the Studio rewrites that file wholesale on every publish, and a
744-row database does not belong in a visual copy editor. The split:

- **`content/directory/*.json`** — the entries. Data. Never touched by the Studio.
- **`content/site.json` → `directory`** — the framing copy (label, intro,
  the "how it's kept" note). Editable in the Studio like every other section.

That also means a Studio publish can never clobber the Directory, and a
Directory rebuild can never clobber the owner's copy.

---

## Growing it

### To 200 channels

The 41 in here are Esteban's own curated list, exported from Notion with
their real URLs. Getting to 200 is a data job, not a code job: add lines to
`scripts/directory/sources/channels.tsv`, run `build.mjs`, run
`check-links.mjs`. No component changes.

Three channel links in the Notion source were saved as broken
`google.com/search?q=…` wrappers (Motion Ape, Fredpelle, Voxyde) and were
unwrapped on export. Worth fixing in Notion too, so the next sync is clean.

The Courses export is **102 of 118 rows** — the Notion API query quota ran
out mid-export. The missing 16 are alphabetically scattered; re-run the
export to complete them.

### Collections designed but not yet built

The schema carries these with no code changes — each needs a TSV and one
entry in `COLLECTIONS` in `build.mjs`:

- **Talks & Conference Archive** — individual talks from OFFF, Semi
  Permanent, SIGGRAPH, faceted by speaker and theme. (The *festivals* are in
  Awards; the *talks* would be their own thing.)
- **Style Reference Library** — collections tagged by visual style
  (isometric, claymation, kinetic type, cel, dithered, brutalist), pointing
  at existing Behance/Vimeo/Savee collections. Categorisation of published
  work, not evaluation.
- **Artists & Portfolios** — individuals, as distinct from studios.
- **Job Boards** — where the work is actually posted.
- **Rate Benchmarks** — aggregating rate surveys that already exist
  (Motion Hatch's especially). Aggregate, never invent a number.
- **Newsletters** — currently folded into Communities; deserves its own
  shelf once there are twenty of them.
- **AI Tools for Motion** — a categorised directory. This is the one that
  connects to the Human & Motion angle: tools versus judgement. It dates
  fastest, so it needs a review cadence or it should not exist.
- **Challenges & Prompts** — 36 Days of Type, Everyday, and the rest.
- **Canon** — landmark title sequences, idents and music videos, with the
  year and who made them.
- **Software Comparison** — when to reach for AE vs C4D vs Blender vs Rive.
  Prose, not a directory; probably belongs in the newsletter instead.

### Facet vocabularies worth keeping consistent

The facets are derived from the data rather than declared, which keeps the
build simple but means **spelling is the schema**. "After Effects" and "AE"
would become two filters. Keep to the vocabularies already in use:

- **software** — After Effects, Cinema 4D, Blender, Houdini, Cavalry, Rive,
  Spline, Figma, Unreal Engine, TouchDesigner, Nuke, DaVinci Resolve,
  Illustrator, Photoshop, Premiere Pro, Procreate, Adobe Animate, Womp, Lottie
- **level** — Beginners, Intermediate, Advanced
- **content** (channels) — Tutorials, Projects, Rigs, Scripts, Plugins,
  Presets, Expressions, Templates, Breakdowns, Brushes, Inspiration
- **style** (studios) — the twelve tags already in the Notion database
- **kind** — reused per collection with its own values; keep them few

A future `build.mjs` check could fail the build on a facet value that appears
exactly once, which is usually a typo. Not built yet.

---

## Adding a collection

1. Write `scripts/directory/sources/<id>.tsv` with `#source:` and `#cols:`.
2. Add an entry to `COLLECTIONS` in `scripts/directory/build.mjs` — id,
   shelf, name, letter, blurb, and the verb for its outbound links (`""` if
   it doesn't link out, like Books).
3. `node scripts/directory/build.mjs`
4. Add the import to `lib/directory.ts`.
5. `node scripts/directory/check-links.mjs <id>`

No page, route or component changes — `/directory/<id>` is generated from
`generateStaticParams`, and the hub reads the manifest.
