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
visual editor for that file: the real site renders in a preview, clicking any
section opens its fields, and edits show up live. Publishing commits the JSON
to GitHub, which triggers a Vercel redeploy — changes are live in about a
minute.

**No environment variables and no Vercel configuration are needed.** The
first time you publish, the Studio asks you to connect GitHub: create a
fine-grained token at github.com/settings/personal-access-tokens with
Repository access limited to this repo and the **Contents: Read and write**
permission, and paste it into the Studio. The token is stored only in your
browser and sent only to api.github.com. Publishing is protected by the token
itself — without it, visitors to `/studio` can only look at the editor.

In local development the Studio edits `content/site.json` on disk directly,
no token required.

## Development

```bash
npm install
npm run dev    # local dev server
npm run build  # production build
npm run lint
```

Site content lives in `lib/data.ts`.
