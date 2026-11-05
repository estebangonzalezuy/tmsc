# License notes

## Upstream: pixel-point/animate-text

Checked 2026-11-05 by cloning `https://github.com/pixel-point/animate-text`
into `_ref/animate-text/` (gitignored, never published) at commit `0f783e459d62d851b7e5308e0596fa5fbac00c7e` (2026-04-24).

- No `LICENSE`, `LICENSE.md` or `COPYING` file at the root.
- `package.json` has `"private": true` and no `license` field.
- So: **all rights reserved by default.** Nothing from that repo is copied
  here. No code, adapters, generated effects, sample copy or assets.

What we did with it:

- **Read** `catalog/text-animations/schema.md` and a handful of
  `specs/*.json` as a *format reference*, so our specs keep the same
  top-level shape (`id`, `display_name`, `description`, `target`,
  `signature_easing`, `enter`/`exit` with `duration_ms`, `stagger_ms`,
  `easing`, `from`/`to`, `swap`, `stagger_mode`, `usage_notes`) and the
  same frame keys (`opacity`, `x_px`, `y_px`, `scale`, `rotate_deg`,
  `blur_px`, …). A schema is a set of field names. Matching it is what
  lets a runtime built for animate-text read our specs.
- Everything else (`schema.md` prose, validator, generator, runtime, specs,
  SKILL.md) was written from scratch for this lab.
- Our additions are **optional `x_*` fields** (see
  `catalog/text-animations/schema.md`). A runtime that ignores them falls
  back to the `easing` + `duration_ms` we fit automatically.

If Pixel Point later adds a permissive licence (MIT etc.), note it here with
the date and commit before quoting any of their files.

## Our dependencies

| What | Licence | Where |
| --- | --- | --- |
| DialKit (`dialkit`, Josh Puckett) | MIT | npm dependency of `app/` |
| React, Vite, motion, TypeScript | MIT / Apache-2.0 (TypeScript) | npm dependencies |
| Archivo Narrow (Omnibus-Type) | SIL OFL 1.1 | `app/public/fonts/`, `OFL-ArchivoNarrow.txt` |
| Archivo (Omnibus-Type) | SIL OFL 1.1 | `app/public/fonts/`, `OFL-Archivo.txt` |

Fonts were downloaded from `github.com/google/fonts` (`ofl/archivonarrow`,
`ofl/archivo`) with their OFL texts kept beside them.

## Our own licence

**MIT** for this lab's own code (`LICENSE`, per the brief). Fonts stay OFL.
