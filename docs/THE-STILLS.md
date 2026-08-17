# the Stills

The club's curated wall of style frames: single frames lifted out of real
motion work and kept, so there is somewhere to look that isn't a feed.

Cosmos, Are.na and Savee hand you a board and let you fill it. This is the
other shape. Nobody else curates here — the frames are chosen one project at a
time, credited, and linked back to the second they came from. The judgement is
the product.

Live at `/stills`. Curated at `/curate`.

---

## Why it is built the way it is

One constraint shapes everything: **a browser cannot take a frame out of a
YouTube or Vimeo embed.** The player is a cross-origin iframe, a canvas drawn
from it is tainted, and the IFrame API exposes no pixels.

That is true of an *embed*. It is not true of a file you picked off your own
disk — an object URL is same-origin, the canvas stays clean, and `getImageData`
works. So the Curator asks for the film itself, and does everything in the
page: decode it, difference downscaled frames to find the cuts, write the
stills. Nothing is uploaded, nothing runs on a server, and only the frames that
survive curation are ever committed.

### There used to be a second road

Paste a URL, and a GitHub Actions runner fetched it with `yt-dlp` and cut the
frames with `ffmpeg`. It is gone, deliberately.

It worked for Vimeo and for direct media URLs. It did not work for YouTube:
YouTube treats runners as datacentre traffic and challenges them, and no
arrangement of player clients talked it out of that reliably. Cookies would
have, at the cost of a secret that expires and a Google account you would
rather not put on a server. Meanwhile every film has to be downloaded before
anyone can watch it anyway, so the road mostly bought a four-minute wait before
a failure.

If it ever comes back, it belongs behind the same editor rather than beside it:
the lesson of having two was that the second one silently lacked half the
first one's abilities.

### The half that matters

Scene detection finds cuts, and a cut is not a composition. So the editor also
just shows you the film: pause anywhere, mark the moment, and it is cut at
once, exactly — not to the nearest second, because the video is right there.

## The wall, in two views

`/stills` opens on **Projects**: one card per film, four frames spread across
its length. Four consecutive frames from one shot say nothing a single frame
doesn't, so `pickSpread` takes them from end to end — the card is meant to show
what the whole thing looks like.

The **Stills** tab is every kept frame from every project, shuffled, so it
reads as a wall rather than a list of films.

The shuffle is seeded and the seed lives in the URL. That is not decoration:
these pages are prerendered, so `Math.random` at render time would have the
server and the browser disagree, and a wall that reorders on every render is
unusable. Arriving via the tab rolls a fresh seed (a click, not a render);
landing on `?view=stills` cold gives the deterministic order the build
produced; and Shuffle re-rolls. A given shuffle is therefore a link.

Search and tags filter the frames, and both views follow: Projects shows the
films that still have a matching frame, and says "4 of 12 frames" when a
filter is narrowing one.

## The loop

1. **Drop in the film.** The browser cuts a spread of frames from it.
2. **Curate.** Drop what isn't a style frame. Tag it, credit it, link it back,
   pick a cover.
3. **Find what it missed.** Scrub, mark, cut.
4. **Publish.** Only published projects reach the wall.

Reopening a project from the Projects list runs the same editor over what is
already in the repo. Attach the film again and steps 3 and 4 work exactly as
they did the first time; leave it off and everything except cutting still does.

### A project stops being new the moment it lands

Publishing binds the panel to the id it published under, and three things
change at once: the id stops following the title, a second Publish updates the
record in place instead of appending it, and the panel reads as an editor rather
than an intake — no rescan, and Remove is on the table.

None of that is tidiness. A published project's id is a URL *and* the directory
its images live in, so it has to be exactly one thing:

- Let the id keep following the title and renaming between two publishes moves
  the whole asset directory, orphaning every image the record names.
- Treat "not in projects.json" as "new" and Remove-then-Publish resurrects the
  project — the panel is still mounted holding the whole draft. That happened,
  and it appended a duplicate under `<id>-2` whose images had mostly been
  uploaded already under the first id, so the wall filled with 404s. Publishing
  now refuses when the id the panel is bound to has gone from the repo, and
  Remove empties the panel on the way out.

The two things `committed` has to get right, for the same reason: it is keyed by
**full repo path** and not by filename, and the draft sheds its dropped frames
when it publishes rather than only clearing the drop list — otherwise a second
publish quietly hands back the stills you had just thrown out.

Everything the footer counts is counted in **stills**, not files. Each frame is
three files, so "43 new files" for fourteen stills reads as a bug rather than as
an explanation.

## The pieces

| Path | What it is |
| --- | --- |
| `content/stills/projects.json` | The only source of truth. Every project, every frame. |
| `public/stills/<project-id>/` | The images: full size, `.mid`, `.thumb`. Older projects also carry `scrub-NNN.jpg` sheets, which nothing reads any more. |
| `lib/stills-shared.ts` | Types and pure helpers. No data — safe in a client component. |
| `components/stills/localVideo.ts` | The browser extractor: decode, difference, cut. |
| `lib/stills.ts` | Reads projects.json. **Server components only.** |
| `scripts/stills/prune.mjs` | Deletes images no project claims any more. |
| `components/pages/StillsPage.tsx` | The wall. |
| `components/pages/StillsProjectPage.tsx` | One project. |
| `components/stills/Curator.tsx` | The tool at `/curate`: the token, the project list, the editor. |
| `components/stills/ProjectEditor.tsx` | The editor, for a new project and an existing one alike. |
| `components/stills/FrameGrid.tsx` | The frame grid and the shared fields. |

**The entries are data, the framing is copy** — the same split the Directory
keeps. The wall's intro lives in `content/site.json` under `stills` and is
edited in the Studio; the frames never go near that file, which the Studio
rewrites wholesale.

### There is no generated index

The wall needs every frame at once so it can filter without a round trip, but
none of the detail. That lean index is **derived at build time** by `buildWall`
in `lib/stills-shared.ts`, and handed to the client component as a prop.

It is deliberately not a committed `wall.json`. Such a file would have to be
written by whatever cuts the frames *and* read by the site, and the two would
drift the first time either changed. One function, called at build, cannot.

## Zero configuration, still

The Curator holds to the same contract as the Studio and the Desk: the GitHub
token is pasted into the page, kept in `localStorage` (under `desk-github-token`,
shared with the Desk), and every call goes straight to api.github.com. Nothing
on Vercel holds a secret and the deployed app needs no environment at all.
Don't move any of it server-side.

### The token needs Contents: Read and write

That is the only permission, and it covers both halves of the job: reading
`projects.json` and committing the frames.

The key is shared with the Desk, which is a convenience with one sharp edge —
the Desk only ever needed Actions, so a token made for it reads fine and then
fails at the moment you publish, after all the curation work is done. That is
why the Curator asks GitHub what the token may do when it loads and says so up
front. If publishing reports *"Resource not accessible by personal access
token"*, that is this.

## YouTube

There is nothing to configure. Download the film the way you normally would —
yt-dlp on your own machine, a browser extension, whatever you use — and drop
the file in. Your own connection is not a datacentre address, so nothing
refuses it, and a downloaded file gives better frames than any capture of a
player would.

## Three sizes, and why

Each frame is written at ~1600px, ~900px and ~400px, and every `<img>` hands
the browser the whole list through `frameSrcSet` plus a `sizes` hint. The wall
takes a small rung, the project page a large one, and a retina screen doubles
whatever it asked for.

This is not premature: the project grid renders cells past 500 CSS pixels, so
serving the 400px thumb there — which is what it did at first — is a visibly
soft picture on any modern display.

`mid` arrived after the first projects did, so it is optional and `frameSrcSet`
builds its list from whatever exists. Older projects serve thumb and full and
look right; they simply pull a heavier file on the wall than they need to.
Re-extracting one is the only way to give it the middle rung, and it is not
worth doing for that alone.

## Where the images live

In the repo, under `public/stills/`, served as static files by Vercel's CDN.
No accounts, no buckets, no secrets — which is why it was chosen.

The cost is repo weight. A frame is roughly 120KB in webp; a project of a dozen
frames plus its scrub sheets is about two megabytes. That is comfortable into
the low hundreds of projects and uncomfortable after.

**The migration is one string.** Every path the site renders goes through
`frameSrc`/`scrubSrc`, which prefix `assetBase` from `projects.json`. Moving to
a separate assets repo on jsDelivr, or to a bucket, means moving the files and
changing `assetBase` — not touching a component.

## Housekeeping

This only applies to the link road. A local extraction uploads nothing until
you publish, so a frame you dropped was never committed and leaves nothing
behind.

Dropping a frame from a project the *runner* cut removes it from
`projects.json` and leaves the file behind. That is deliberate: publishing stays a single small JSON write
through the contents API instead of a multi-file tree commit that can half-fail.
Sweep up when it bothers you, from a fresh pull:

```bash
node scripts/stills/prune.mjs           # say what it would remove
node scripts/stills/prune.mjs --delete  # remove it
```

## Running the extractor by hand

Needs `yt-dlp` and `ffmpeg` on PATH. Neither is a repo dependency and neither
ever runs on Vercel.

```bash
node scripts/stills/extract.mjs --url https://vimeo.com/76979871
node scripts/stills/extract.mjs --url https://vimeo.com/76979871 --times 12.4,88.1
```

Frames are keyed by timestamp (`frameId`), so re-running either pass can never
duplicate a moment. The same function exists in `lib/stills-shared.ts`; if you
change one, change both.

## On other people's work

Every frame credits its source and links back to the exact second, and the
project page sends you to the video. Keep it that way. The value here is the
selection and the ordering — the frames are the evidence, not the product, and
a reference library that obscures where its references came from is just theft
with a grid on it.

## Adding a field

1. Add it to the types in `lib/stills-shared.ts`.
2. Write it in `scripts/stills/extract.mjs`, or edit it in
   `components/stills/Curator.tsx`.
3. If the wall needs it, add it to `WallFrame`/`WallProject` and to `buildWall`.
4. Old projects won't have it. Make it optional and handle its absence — the
   extractor is not re-run over the archive.
