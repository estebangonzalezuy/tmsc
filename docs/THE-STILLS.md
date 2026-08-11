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
works. So there are two ways in, and which one applies depends on whether you
have the video or only a link to it.

### Two roads

**Drop in a video (the short one).** The browser decodes the file, differences
downscaled frames to find the cuts, and writes the stills, the thumbs and the
scrub sheets itself. Nothing is uploaded, nothing runs on a server, and no
site gets a vote on whether you may have the frames. Only the frames you keep
are ever committed. `components/stills/localVideo.ts`.

**Fetch it by link (the long one).** For when you don't have the file. A GitHub
Actions runner downloads it with `yt-dlp`, cuts the frames with `ffmpeg`, and
commits them. Vimeo and direct media URLs are reliable here; YouTube usually
refuses — see below. `scripts/stills/extract.mjs`.

Both produce the same thing, and deliberately so: they call the same
`chooseTimes` in `lib/stills-select.mjs`, so a film curated one way and a film
curated the other are curated by the same rules. Only the way candidates are
*found* differs, because that is what each side can do — ffmpeg scores scene
changes, the browser differences pixels by hand.

### The half that matters

Scene detection finds cuts, and a cut is not a composition. So both roads have
a second pass for the frames the machine walked past.

With a local file, the Curator just shows you the video: pause anywhere, mark
the moment, and it is cut at once, exactly. With a link, the video is not in
the browser to show — so the extractor writes a **scrub strip**, one 160px tile
per second packed a hundred to a sheet, and the Curator scrubs that instead,
sending marked timestamps back for a second cutting pass.

Either way the scrub sheets get committed, so a project can be scrubbed again
months later when the file is long gone.

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

1. **Drop in a video**, or paste a link and wait for the runner.
2. **Curate.** Drop what isn't a style frame. Tag it, credit it, pick a cover.
3. **Find what it missed.** Mark moments and cut them.
4. **Publish.** Only published projects reach the wall.

For the link road, steps 1 and 3 are the same workflow: empty `times` means
"suggest", a list of seconds means "cut exactly these".

## The pieces

| Path | What it is |
| --- | --- |
| `content/stills/projects.json` | The only source of truth. Every project, every frame, the scrub sheets. |
| `public/stills/<project-id>/` | The images. Full size, `.mid`, `.thumb`, and `scrub-NNN.jpg`. |
| `lib/stills-shared.ts` | Types and pure helpers. No data — safe in a client component. |
| `lib/stills-select.mjs` | Which moments to keep. Plain JS with no imports, because Node and the browser both need it and can share nothing else. |
| `components/stills/localVideo.ts` | The browser extractor: decode, difference, cut, tile. |
| `lib/stills.ts` | Reads projects.json. **Server components only.** |
| `scripts/stills/extract.mjs` | The extractor. yt-dlp + ffmpeg. |
| `scripts/stills/prune.mjs` | Deletes images no project claims any more. |
| `.github/workflows/stills.yml` | Where the extractor runs. |
| `components/pages/StillsPage.tsx` | The wall. |
| `components/pages/StillsProjectPage.tsx` | One project. |
| `components/stills/Curator.tsx` | The curation tool at `/curate`. |
| `components/stills/Scrubber.tsx` | The sprite-sheet scrubber, for projects whose file is gone. |
| `components/stills/LocalExtractor.tsx` | The drop-in-a-video half of the Curator. |
| `components/stills/FrameGrid.tsx` | The frame grid, shared by both halves. |

**The entries are data, the framing is copy** — the same split the Directory
keeps. The wall's intro lives in `content/site.json` under `stills` and is
edited in the Studio; the frames never go near that file, which the Studio
rewrites wholesale.

### There is no generated index

The wall needs every frame at once so it can filter without a round trip, but
none of the detail. That lean index is **derived at build time** by `buildWall`
in `lib/stills-shared.ts`, and handed to the client component as a prop.

It is deliberately not a committed `wall.json`. Such a file would have to be
written by the extractor in Node *and* by the Curator in the browser, and the
two implementations would drift the first time either changed. One function,
called at build, cannot.

## Zero configuration, still

The Curator holds to the same contract as the Studio and the Desk: the GitHub
token is pasted into the page, kept in `localStorage` (under `desk-github-token`,
shared with the Desk), and every call goes straight to api.github.com. Nothing
on Vercel holds a secret and the deployed app needs no environment at all.
Don't move any of it server-side.

### The token needs two permissions

| Repository permission | What it is for |
| --- | --- |
| **Contents: Read and write** | Reading `projects.json`, and committing the frames when you publish. |
| **Actions: Read and write** | Dispatching the extractor and reading its runs — the link road only. |

Sharing the key with the Desk is a convenience that has one sharp edge: the
Desk only ever needed Actions, so a token created for it can dispatch a run
and then fail at the moment you publish, after all the curation work is done.
That is why the Curator asks GitHub what the token may do when it loads and
says so up front, rather than letting you find out at the end.

If publishing reports *"Resource not accessible by personal access token"*,
that is this: Contents is missing.

## YouTube and the bot check

The most common failure by far, and it is not a bug:

```
ERROR: [youtube] xxxx: Sign in to confirm you're not a bot.
```

YouTube treats GitHub's runners as datacentre traffic and challenges them. It
challenges a home connection far less, which is why a link that downloads fine
on your laptop fails in Actions.

The extractor already tries six of YouTube's player clients before giving up
(`YT_CLIENTS` in `extract.mjs`) — which of them is being served changes month
to month, so one of them often still works. That is a moving target, not a fix.

**The short answer is to stop asking YouTube.** Download the video however you
normally would and drop the file into the Curator — the browser cuts the frames
with nobody's permission, and it is faster than the runner anyway.

**If you want the link road to work,** the fix is cookies. Add one repository secret, used only inside
Actions:

| Secret | What |
| --- | --- |
| `YTDLP_COOKIES` | base64 of a `cookies.txt` exported from a signed-in browser. |

```bash
# after exporting cookies.txt with a cookies.txt browser extension
base64 -w0 cookies.txt
```

Paste the output into **Settings → Secrets and variables → Actions → New
repository secret**, named `YTDLP_COOKIES`. When it is set the extractor skips
the client hunt and uses the cookies directly.

Cookies expire. When YouTube starts refusing again, export a fresh
`cookies.txt` and update the secret.

**Vimeo does not do any of this.** A Vimeo link needs no secret at all.

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
