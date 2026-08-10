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

The whole design follows from one constraint: **a browser cannot take a frame
out of a YouTube or Vimeo embed.** The player is a cross-origin iframe, a
canvas drawn from it is tainted, and the IFrame API exposes no pixels. There
is no clever way around it, so "open the video and screenshot it" cannot be a
feature of the website.

The frames therefore get cut where the video file actually exists: in a GitHub
Actions runner, by `yt-dlp` and `ffmpeg`. The website's job is to decide which
ones are worth keeping.

That splits the work in two, and the second half is the interesting one — the
extractor's suggestions are only ever scene *cuts*, and a cut is not a
composition. So the extractor also writes a **scrub strip**: one 160px tile per
second of the film, packed a hundred to a sheet. The Curator scrubs those
sheets, and marking a moment sends its timestamp back to the extractor to be
cut at full size. That is how you get frames out of a video the browser is
never allowed to touch.

## The loop

1. **Paste a URL** into the Curator. It dispatches `.github/workflows/stills.yml`
   straight from the browser.
2. **The extractor runs** (a few minutes): downloads the video, scene-detects
   candidates, throws away the black and the flat, cuts a full-size still and a
   400px thumb for each, builds the scrub sheets, and commits the lot as a
   **draft**.
3. **Curate.** Drop what isn't a style frame. Tag it, credit it, pick a cover.
4. **Scrub for what it missed.** Mark moments, hit Cut, and the second pass
   adds exactly those timestamps.
5. **Publish.** Only published projects reach the wall.

Steps 2 and 4 are the same workflow. Empty `times` means "suggest"; a list of
seconds means "cut exactly these".

## The pieces

| Path | What it is |
| --- | --- |
| `content/stills/projects.json` | The only source of truth. Every project, every frame, the scrub sheets. |
| `public/stills/<project-id>/` | The images. Full size, `.thumb`, and `scrub-NNN.jpg`. |
| `lib/stills-shared.ts` | Types and pure helpers. No data — safe in a client component. |
| `lib/stills.ts` | Reads projects.json. **Server components only.** |
| `scripts/stills/extract.mjs` | The extractor. yt-dlp + ffmpeg. |
| `scripts/stills/prune.mjs` | Deletes images no project claims any more. |
| `.github/workflows/stills.yml` | Where the extractor runs. |
| `components/pages/StillsPage.tsx` | The wall. |
| `components/pages/StillsProjectPage.tsx` | One project. |
| `components/stills/Curator.tsx` | The curation tool at `/curate`. |
| `components/stills/Scrubber.tsx` | The sprite-sheet scrubber. |

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

**The reliable fix is cookies.** Add one repository secret, used only inside
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

Dropping a frame in the Curator removes it from `projects.json` and leaves the
file behind. That is deliberate: publishing stays a single small JSON write
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
