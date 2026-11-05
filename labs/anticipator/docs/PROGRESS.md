# Progress — Anticipator Skill Lab

## Etapa 0 — Recon ✅

**Where things are (real paths, in this cloud session):**

| Thing | Path | Status |
| --- | --- | --- |
| This lab | `tmsc/labs/anticipator/` (repo `estebangonzalezuy/tmsc`, branch `claude/new-session-3sl55y`) | created tonight |
| animate-text-springs seed | `/workspace/creative-practice/tools-diarias/animate-text-springs/` | **not in this container.** Lives on Esteban's machine. The three seed presets were rebuilt from the brief's description. Reconcile values with the local `src/motion.js` tomorrow. |
| reboot-editor inception prompt | `/workspace/creative-practice/reboot-editor/inception-prompt.md` | **not in this container** |
| Motion builder (Claude Code + DialKit) | not found (searched repo, `/`, `~`) | Editor rebuilt fresh on DialKit's `useDialTimeline` + `<DialTimeline />` |
| Upstream reference clone | scratchpad only, not committed (`pixel-point/animate-text@0f783e4`) | read for format only |
| DialKit | npm `dialkit@2.1.0`, MIT | dependency |
| ffmpeg | `/usr/bin/ffmpeg` | used by export script |

**Upstream licence:** none (no LICENSE file, `"private": true`). Zero copy-paste. See `LICENSE-NOTES.md`.

**Where the lab lives:** inside `tmsc` as a self-contained folder with its own
`package.json`, like `scripts/content-cycle/`. It's ignored by the site's
ESLint/TypeScript, not wired into `app/`, and not merged to `main`, so
nothing deploys.
