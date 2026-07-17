# the Motion Social Club

Website for the Motion Social Club — the side companion on your motion design
path. Built with Next.js (App Router), React, TypeScript, and Tailwind CSS v4.

Black-and-white identity, set in Archivo (sans) and Lora (serif), using the
club's poster motifs: circled letters, orbital rings, and boxed headlines.

## Pages

- `/` — homepage: manifesto hero, club intro, editorial pillars, newsletter,
  Practice File, learn/resources previews, offerings
- `/about` — what the club is, the editorial spine, recurring threads
- `/newsletter` — full Substack archive (2024–2026)
- `/resources` — curated resources and worksheets
- `/learn` — learning paths and the Practice File exercises
- `/offerings` — course, workshops, and residency with honest statuses

## The Studio (CMS)

All site copy lives in `content/site.json`. The Studio at `/studio` is a
password-protected, section-by-section editor for that file. Publishing from
the Studio commits the JSON to GitHub, which triggers a Vercel redeploy —
changes are live in about a minute.

Environment variables (set these in Vercel → Project → Settings →
Environment Variables):

- `STUDIO_PASSWORD` — required in production; the password for `/studio`
- `STUDIO_GITHUB_TOKEN` — fine-grained GitHub token with **Contents:
  read & write** on this repo (create at github.com/settings/personal-access-tokens)
- `STUDIO_GITHUB_REPO` — optional, defaults to `estebangonzalezuy/tmsc`
- `STUDIO_GITHUB_BRANCH` — optional, defaults to `main`

In local development no variables are needed: the Studio edits
`content/site.json` on disk directly.

## Development

```bash
npm install
npm run dev    # local dev server
npm run build  # production build
npm run lint
```

Site content lives in `lib/data.ts`.
