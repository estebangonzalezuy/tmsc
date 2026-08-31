# the Ground

An open app for practising motion design next to other people. You post a
take, somebody tells you what they see, and useful answers earn credits that
reach a mentor.

Right now the repository holds **the landing page only** — `/ground`, static,
no accounts, no database. This document is the argument behind it and the
plan for what comes next, so the first session that builds the app is not
starting from a blank page.

---

## Why this exists

The club already promises it. `content/site.json` calls tMSC *"a place to
connect with other people, to practice, and to embrace failure."* One of the
five threads reads *"Motion design shouldn't feel this lonely."* A pull quote
reads *"You don't need more tutorials. You need more practice."*

What the club ships is a newsletter, a resource index, two walls of other
people's finished work, and four studios. Every one of those is something a
person uses **alone**. The connecting half of the promise had no surface, and
this is that surface.

The market has the same hole. framerate.tv, the Stills and the Clips all
answer *what does good look like*. Behance and Dribbble answer *how do I look
good*. Nothing answers *how do I get better this week, in public, next to
other people doing the same*.

---

## What practice is here, and why the week is the unit

`practiceRules` in `content/site.json` already decided this:

> "Consistency beats intensity."
> "Name every file yyyy-mm-dd so a month from now you can see the distance you
> covered."
> "It doesn't matter if you set an expectation and didn't fill it up. What
> matters is that you come back next week."

Not the day, which turns a missed evening into guilt. Not the month, which is
too slow to feel. The last rule says it outright.

That is the structural difference from every other feed. Instagram, Dribbble
and Behance are an infinite scroll of *now*. the Ground is **a stack of
weeks**, and a profile is a run of them in order rather than a grid of best
work. **The thin week stays on the page.** Deleting it is what a portfolio
does, and pretending a quiet week did not happen is how people quit.

The landing page argues this with a drawing rather than a paragraph: sixteen
weeks as columns of blocks, three of them empty. `WEEK_SHAPE` in
`components/pages/GroundPage.tsx` is that illustration. The caption counts the
empty weeks off the array rather than stating a number, so editing the shape
can never make the sentence lie.

Three units, and nothing is forced upward:

| Unit | What it is |
|---|---|
| **a take** | One attempt. A loop, a test, a frame. |
| **a week** | A focus, planned hours, the takes you made, a reflection. |
| **a project** | Work carried across several weeks. |

The week's fields come from the club's own Notion template, "Weekly motion
practice planner", already listed in `worksheets`. the Ground is that template
with other people in it.

---

## Feedback is the currency

Every other design site treats comments as exhaust. Here they buy something.

- Responses open with three questions rather than an empty box: **what is
  working · what I would change · how did you do it.** A blank box fills with
  fire emoji.
- **A credit is minted by the person who received the feedback**, never by the
  act of posting one. This is the single most important rule in the economy.
  Paying per comment produces "nice work!" inside a week.
- One credit per response, only from the author, with a weekly ceiling, and
  reciprocal pairs damped so two people cannot farm each other.
- Credits have no cash value and cannot be bought, sold or transferred. There
  is no market to game.
- **Every mentor keeps a few free slots and credits are the only way in.** The
  rest are paid and the mentor sets the price. Nothing has to be paid out of a
  fund, and the economy balances itself.
- Mentor eligibility is read off that record — credits received, weeks shown
  up — and **Esteban runs a 1:1 with every candidate before approving.** The
  best feedback-givers become the mentor pool, chosen on evidence rather than
  on a portfolio.

Ranking follows the same idea. **"Needs eyes" is the default tab**, sorting by
fewest responses and oldest first, so the take nobody answered is the one you
see. Follower counts, saves and response counts stay private. The public
number on a profile is weeks shown up and credits earned, which measures
showing up and helping rather than being admired.

---

## Media quality — do not reuse the Clips' settings

The Clips compresses hard on purpose: a clip is a **citation** of somebody
else's film, stored in a git repo, sized so forty animate at once on a wall.
1280px at 2 Mbps through MediaRecorder is right for evidence.

A member's take is **their own work**, and motion designers are exactly the
people who see the banding a re-encode puts in a gradient. So:

1. **Never re-encode the original.** Stored byte for byte, always downloadable
   by its author.
2. **No MediaRecorder in this path.** The Cutter uses it because it cuts a
   segment out of a longer film. the Ground receives a finished piece, so
   there is nothing to cut and nothing to re-encode.
3. **Serve the original when it is web-playable.** H.264, VP9 or AV1 in mp4 or
   webm under ~100MB goes straight from storage through the CDN. A 15s 1080p
   export is usually 5–30MB, so the common case is zero quality loss and no
   transcoding bill.
4. **Transcode only the exotic upload** (ProRes, an unplayable MOV, something
   very large), and keep the original beside it.
5. **A sprite sheet is a wall thumbnail and nothing else**, derived by canvas
   seeks. Never the thing anyone judges from.

| | Free | Member |
|---|---|---|
| Resolution | up to 1080p, never downscaled | up to 4K |
| Length | 60s | 3 min |
| File size | 100MB | 500MB |

---

## The architecture, and the rule it bends

`AGENTS.md` says the deployed app stays dependency- and secret-free, and that
nothing moves server-side. Accounts, uploads, comments, credits and payouts
are all writes from untrusted browsers, and a GitHub token in `localStorage`
cannot carry them.

**Supabase, as a new surface beside the static site.** The continuity is
honest: the club's pattern is already *the browser holds the credential and
talks straight to the API; nothing secret sits on Vercel.*
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are designed to
ship to the browser, and Row Level Security does the enforcement.

Two rules keep the bend contained:

- **The public site does not change.** It stays statically prerendered with no
  secrets in its render path, and **the build must pass with no Supabase env
  vars set.** Absent config, `/ground` renders the landing page it renders
  today. That is why the landing page is worth having as its own artifact.
- **No service-role key on Vercel, ever.** Money and credit minting need a
  server, so those are Supabase Edge Functions with the secrets held in
  Supabase. A browser that can mint its own credits is a browser that will.

---

## Reuse, and one thing not to reuse

Most of the media layer exists. Lift shared code the way `lib/video.ts` was
lifted out of `components/stills/`; do not fork these.

| Need | Reuse |
|---|---|
| Decode, and a seek that cannot hang | `openVideo` in `lib/video.ts` |
| Sheet derivation | the seek/tile half of `cutOne` in `components/clips/cutSheet.ts` |
| Dozens of tiles off one rAF | `ticker` in `components/clips/ticker.ts` |
| Tile playback, sheet memoisation | `ClipCanvas` |
| Lazy fetch, reduced motion | `useNearViewport` |
| Detail playback | `ClipPlayer`, `ClipLightbox` |
| Facets and cleaning | `FACETS`, `cleanFacet`, `frameAt`, `cellAt` in `lib/clips-shared.ts` |
| Asset URLs | `sheetSrc`, which already builds `${assetBase}/${id}/${name}` |
| Spec rendering in feed | `Stage`, `overlay.ts`, `ShaderLayer`, `decodeSpec` |

**The one thing not to reuse is the recorder half of `cutOne`.** It is the
part that re-encodes, and rule 2 above exists because of it.

---

## Order of work

The landing page is done. After it:

1. **Accounts, takes, feed, comments.** Three tables — `profiles`, `takes`,
   `responses` — one storage bucket, magic-link auth (not GitHub OAuth; the
   audience does not have GitHub). Moderation is a launch requirement, not a
   later one: a report button, a Desk queue, a takedown path and terms.
2. **The week.** A focus, a reflection, and a profile that reads as a run of
   weeks.
3. **Credits.** An append-only ledger, never a mutable integer, so every
   credit traces to the response that earned it and abuse is reversible.
4. **Mentors.** Applications, the eligibility view, the 1:1, free slots
   redeemed with credits. No money yet.
5. **Paid sessions.** Stripe Connect, payouts, refunds, no-shows. This makes
   the club a marketplace, which is a real step up in obligation.
6. **Specs, remixes and studies.** Post straight from the Posts Studio, the
   Kinetics and the Tiles. A spec-take costs zero storage, plays in the feed
   and forks in one click, which is the thing Behance structurally cannot do.
   A **study** cites a Clip or a Still and shows the reference beside the
   attempt, which turns the club's two walls from galleries into prompts.
7. **Challenges**, seeded from the 32 `practiceExercises`, which already carry
   `goal`, `brief`, `constraint`, `done`, `minutes` and `tool`. Entries show in
   a seeded shuffle with no counts while the window is open.
8. **Membership.**

Credits before mentors, and mentors before money, because credits are
worthless without a crowd and mentors cannot be chosen before there is a
record of who actually helps. Until then, mentoring happens by email and by
hand, which also tests the demand for it without building a marketplace.

**Two things deliberately not sold:** capped uploads, which tax the exact
habit the app needs and land hardest on the beginner posting rough work daily,
and paid challenge entry, which turns a club into a contest. Charging for
community feedback and ranking a challenge by payment are out for the same
reason.

---

## The page as it stands

- `components/pages/GroundPage.tsx` — the body. Hero, the four-step loop, the
  week strip, what the first version has, the roadmap.
- `app/(site)/ground/page.tsx` — the thin server wrapper, metadata only.
- `content/site.json` — `ground` (the framing copy), `groundSteps`,
  `groundFirst`, `groundRoadmap`. All Studio-editable; the schema lives in the
  `sections` array in `app/studio/StudioEditor.tsx`.
- Registered in `pageTabs` and `navItems` in the Studio, the `pages` map in
  `PreviewClient.tsx`, and the nav arrays in `SiteHeader` / `SiteFooter` with
  `navId: "ground"`.

It stays in the club's white. `AGENTS.md` draws this line for `/tools`
already: *"The wall is the club's; the instrument is the instrument."* The
reference this started from was a dark feed, and so is every design feed. A
warm-paper feed of motion tests will not look like anything else, and the work
supplies all the colour a feed needs.

Two details worth keeping if the page is reworked:

- **The orbit ring sits in the right half**, not centred. The home page's hero
  is centred so its rings surround the type; this hero is left-aligned, and a
  centred ring lands on top of the body copy.
- **An empty week cell follows `--hover-type` at 18%**, the same share a
  `.pill` takes inside a hovering card. Left at a flat 8% black it went
  *darker* than a filled cell once the column lit up, which read as more
  rather than less.
