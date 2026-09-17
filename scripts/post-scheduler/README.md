# the post scheduler, as a program

The back half of [the Scheduler](https://themotionsocialclub.vercel.app/schedule).
The page writes what to post — words, files, networks, a time — into
`content/posts/posts.json`; this runs on GitHub Actions every fifteen minutes,
posts what is due to LinkedIn, X, Instagram and Substack Notes, and writes
where each one landed into `content/posts/log.json`. Once a day it reads the
numbers back. The page shows both beside the plan.

Nothing about the deployed site changes: Vercel holds no secrets, the app
gains no dependencies. This directory has no dependencies either — Node's own
`fetch` and `crypto` are the whole toolkit — and the rules it checks a post
against are imported straight from `lib/posts-shared.ts`, the same module the
page uses, so the two can't disagree about what a network takes.

## What runs when

| Job | When | What it does |
|---|---|---|
| `publish` | every 15 min, and on **Post now** / **Post what is due** from the page | posts everything whose time has come and isn't posted yet |
| `metrics` | daily, at the 06:00 UTC tick, and on **Pull the numbers** from the page | reads likes, comments, reach… for everything posted in the last five weeks |
| `check` | by hand | tries every connected network's token and writes the result to the page's health line |

GitHub's timer is best-effort — it slips in a busy hour and occasionally
skips a tick — which is why the page can start a run this minute, and why a
post that was due goes out at the first tick that actually fires. One missed
by more than **two days** is skipped and marked so, rather than sent late: a
runner that was down for a week should not wake up and post a week at once.
Save the post again with a new time and it goes.

A network that has posted is never posted to again. One that **failed** is
retried only after the post is saved again on the page (its `updatedAt` moves
past the failure), so a dead token doesn't mean an attempt every quarter hour.

## Connecting a network

Every key lives in the repo's Actions secrets (GitHub → Settings → Secrets and
variables → Actions → New repository secret) and nowhere else. Any subset
works: a network without its secrets shows as *not connected* on the page and
a post aimed at it fails with that reason, nothing more.

### LinkedIn — `LINKEDIN_ACCESS_TOKEN`

1. [linkedin.com/developers](https://www.linkedin.com/developers/) → Create
   app. It has to be tied to a LinkedIn Page (any page you admin; the club's).
2. Products → add **Share on LinkedIn** and **Sign In with LinkedIn using
   OpenID Connect**. Both are self-serve, no review.
3. Auth → Authorized redirect URLs → add `http://localhost:8787/callback`.
   Copy the Client ID and Client Secret.
4. On your machine:
   ```bash
   cd scripts/post-scheduler
   LINKEDIN_CLIENT_ID=… LINKEDIN_CLIENT_SECRET=… node connect.mjs linkedin
   ```
   Open the URL it prints, approve, and paste the token it gives you into the
   secret.

The token lasts **60 days**. LinkedIn issues refresh tokens only to approved
partners, so do step 4 again before it runs out; the page's health line says
*trouble* the first time LinkedIn refuses the old one.

Posts go out as you, to the main feed, public. One video or up to twenty
images. Reactions and comments come back through the API; **impressions for
a member's own posts are in no self-serve API** — type them in on the page
from LinkedIn's own analytics.

### X — `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`

1. [developer.x.com](https://developer.x.com/) → a project and an app on the
   Free tier.
2. User authentication settings → App permissions **Read and write**, type
   *Web App*, any callback URL (unused).
3. Keys and tokens → generate the **API Key and Secret** and the **Access
   Token and Secret** (they must be generated *after* the permissions were set
   to read and write, or they come out read-only). Four secrets, no expiry.

The free tier posts (a monthly cap applies) but does not read: `metrics` needs
the Basic tier, and until then the health line says so after the first daily
read. Up to four images, or one GIF, or one video under 140 seconds.

### Instagram — `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`

Needs a **Business or Creator** account (Settings → Account type in the app;
free, instant).

1. [developers.facebook.com](https://developers.facebook.com/) → Create app →
   *Other* → *Business* → add the **Instagram** product → *API setup with
   Instagram login*.
2. Add the Instagram account as a tester and accept the invite from the
   Instagram app (Settings → Website permissions → Apps and websites).
3. Business login settings → OAuth redirect URIs → `http://localhost:8787/callback`.
   Copy the Instagram app ID and secret (not the Facebook app's).
4. ```bash
   INSTAGRAM_APP_ID=… INSTAGRAM_APP_SECRET=… node connect.mjs instagram
   ```
   Open the URL, approve, paste both values it prints.

The token lasts **60 days** and, unlike LinkedIn's, can be renewed any time
after the first day:
```bash
INSTAGRAM_ACCESS_TOKEN=<the current one> node connect.mjs instagram --refresh
```
Put the new one in the secret. (It can't renew itself: an Actions run can't
write the repo's secrets without a second token to do it with, and a second
token was one thing too many.)

Instagram **fetches** the media from a URL rather than taking an upload, so
a post's files have to be live on the site — which they are, because the page
commits them to `public/posts/` and Vercel deploys `main`. A post scheduled
for later is long since deployed by then; **Post now** waits up to two minutes
for the deploy and says so if it isn't there. JPEG only for images (the page
writes a `.ig.jpg` beside any PNG or WebP), MP4 for video; one video posts as
a **Reel**, two to ten files as a **carousel**; no GIFs, no text-only posts.

### Substack Notes — `SUBSTACK_SID`

Substack has no public API. This talks to the endpoints the Substack site
itself uses when you write a note, signed with your session cookie:

1. Signed in to substack.com in a browser → devtools → Application (Chrome)
   or Storage (Firefox) → Cookies → `https://substack.com` → copy the value of
   **`substack.sid`**.
2. Put it in the secret.

It works as of September 2026 and may stop without notice; the page's health
line will say *trouble* with Substack's own words when it does. The cookie
lasts as long as the browser session it came from — signing out invalidates
it. Text and up to four images; no video. The numbers Substack reports for a
note (likes, replies, restacks) are read back on a best-effort basis.

## Running it by hand

```bash
cd scripts/post-scheduler
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON index.mjs publish --dry-run   # what would go
node index.mjs publish --post=2026-09-20-ab12cd                                    # that one, now
node index.mjs metrics
node index.mjs check
node test.mjs      # the signer, the note document, the shared rules
```

With no secrets in the environment every network is *not connected* and a
dry run still tells you which posts are due. The flag silences Node's note
about importing a `.ts` file from a package without `"type": "module"`;
it is cosmetic.

## How it's put together

- `index.mjs` — the three jobs and the CLI. Reads posts, decides what's due,
  hands each network what it takes, records the outcome.
- `store.mjs` — the two files, and committing the log: apply, commit, push;
  on a rejected push (the page saved a post meanwhile), reset to `origin/main`
  and apply again. The patch is keyed by post id, so twice is once.
- `media.mjs` — bytes off the checkout, public URLs on the site, and waiting
  for a deploy.
- `oauth1.mjs` — HMAC-SHA1 request signing for X, checked in `test.mjs`
  against X's own worked example.
- `networks/*.mjs` — one file per network, each exporting `publish`,
  `metrics` and `check`. Adding a network is one more file and one line in
  `RULES` (`lib/posts-shared.ts`) so the page knows what it takes.
- `connect.mjs` — the OAuth dance for LinkedIn and Instagram, on localhost.
