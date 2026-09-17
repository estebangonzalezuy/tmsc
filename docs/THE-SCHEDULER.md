# the Scheduler

`/schedule` — where the club's posts are written, given their files and their
time, and sent to LinkedIn, X, Instagram and Substack Notes. Calendar, queue,
drafts, what has gone out and how it landed. Internal, not in the nav, not
indexed, like the Desk.

Modelled on the tools that do this for a living (a week of cards, a composer
with a preview beside it, one button to put it in the calendar) and built the
club's way: no product, no plan, no server.

## The shape

Two halves, and the seam between them is the design.

**The page** is the front. It runs entirely in the browser and writes what you
*mean* to post — the words, the media, which networks, when — into the repo
through the GitHub API, with the same token the Desk and the Cutter use,
pasted once and kept in `localStorage`. Nothing on Vercel holds a secret. In
`next dev` it needs no token at all and writes into the checkout through a
dev-only route (`app/api/posts/local`), which is how the whole loop gets
verified without a deploy.

**The runner** (`scripts/post-scheduler/`, on GitHub Actions) is the back. It
is the one place the networks' own keys live — in the repo's Actions secrets,
the same place the content cycle keeps its Notion token — and it is what
actually posts. Every fifteen minutes it reads the queue, posts what is due,
and writes where each post landed. Once a day it reads the numbers back.

The seam is **two files, two writers**:

| file | written by | holds |
|---|---|---|
| `content/posts/posts.json` | the page only | what you mean to post |
| `content/posts/log.json` | the runner only | what happened: outcomes, numbers, health |

A post's status is *derived* from both at read time (`statusOf` in
`lib/posts-shared.ts`) and stored in neither. So a commit from the page and a
push from the runner never touch the same line, git never has to merge them,
and the two can't disagree about what a post is — the runner's push, if it
lands on a moved ref, resets and re-applies a patch keyed by post id. The one
number the page does write that looks like a result — a metric typed in by
hand — lives on the post, because the page wrote it.

A post's media is committed with it, under `public/posts/<id>/`, in one commit
through the Git Data API (the Curator's road, `commitFiles` in
`lib/github.ts`, which grew a `remove` list for deleting a post's files with
it). That puts every file at a public URL on the site, which is exactly what
Instagram wants: it fetches media rather than taking an upload.

## What it does and doesn't

- **One set of words, or one per network.** The main text goes everywhere;
  *Customise for X* gives a network its own. X counts the way X counts
  (`RULES.x.count`: URLs as 23, emoji and CJK as two), and the toggle shows
  the count against the limit as you type.
- **Images, GIFs, videos**, read in the browser for their size and shape,
  never uploaded until Schedule. A PNG or WebP gets a JPEG sibling drawn on a
  canvas, because Instagram takes nothing else. What each network can't take
  is dropped for that network and said so, before you press anything.
- **An emoji picker** over a curated few hundred (`lib/emoji.ts`), no
  dependency, dropped at the caret.
- **Schedule, Post now, Save draft.** *Post now* saves with the current time
  and dispatches the runner this minute rather than waiting for its tick.
- **Analytics** — per-network tiles and per-post numbers, from the runner
  where an API gives them (reactions and comments from LinkedIn; likes, reach
  and saves from Instagram; everything from X on a paid tier) and typed in
  where it doesn't (LinkedIn impressions, anything on Substack). A typed
  number sits over a pulled one. The tiles say how old their numbers are.
- **The runner's health**, per network, on the page: ok, trouble with the
  network's own words, or not connected.

What it deliberately doesn't do: post late. A post due more than two days ago
and never attempted is skipped and marked, not sent — save it again with a
new time. And it doesn't retry a failure on its own: a network that failed is
retried when the post is saved again, so a dead token doesn't mean an attempt
every quarter hour (the health line says what's wrong instead).

## The honest list

- **GitHub's timer slips.** A `*/15` cron is best-effort; the content cycle
  dropped its own for this reason. Here the cost is a post going out some
  minutes late in a busy hour, which is acceptable for a scheduler and not for
  a button; *Post now* and *Post what is due* exist for when it isn't.
- **LinkedIn's token dies every 60 days** and can't be renewed by a script
  (refresh tokens are for approved partners). Instagram's can be renewed with
  one command, but the new value still has to be pasted into the secret by
  hand — an Actions run can't write the repo's secrets without a second token,
  which was one thing too many.
- **Substack Notes has no API.** The adapter speaks to the site's own
  endpoints with a session cookie. It works now and may break; the page will
  say so.
- **X reads cost money.** Posting is free; `public_metrics` need the Basic tier.
- **LinkedIn impressions** for a member's own posts are not in any self-serve
  API. That's what the typed-in numbers are for, and it's the same gap the
  content cycle's *How it landed* field already fills by hand.

## Files

- `lib/posts-shared.ts` — the types, `RULES` (what each network takes and how
  it counts), `statusOf`, `problemsFor`, `metricsFor`. Imported by the page
  and, through Node's type stripping, by the runner: one source of truth.
- `components/scheduler/` — `Scheduler.tsx` (shell, tabs, token, the runner
  panel), `Composer.tsx` (the post creator), `Preview.tsx`, `Calendar.tsx`,
  `PostCard.tsx`, `Analytics.tsx`, `EmojiPicker.tsx`, `media.ts` (reading
  files, JPEG siblings), `store.ts` (GitHub or the local route, dispatching
  the runner), `useNow.ts` (the minute as an external store, so nothing calls
  `Date.now()` in render).
- `app/schedule/page.tsx` — the wrapper. `app/api/posts/local/route.ts` — dev only.
- `scripts/post-scheduler/` — the runner; its README says how to connect each
  network. `.github/workflows/post-scheduler.yml` — the cron and the dispatch.
