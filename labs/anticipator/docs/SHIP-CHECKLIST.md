# Ship checklist (human, not agent)

Nothing below has been done. Each item is a decision or an outward-facing
action for Esteban.

## 0. Before anything public

- [ ] **Reconcile the seed presets** with the local
      `/workspace/creative-practice/tools-diarias/animate-text-springs/src/motion.js`.
      That folder wasn't in the cloud session, so `anticipate-pop-words`,
      `spring-rise-letters` and `heavy-drop-lines` were rebuilt from the
      brief's description. Edit physics in the Lab → Save (overwrite) →
      `npm run generate:skill`.
- [ ] **Port your DialKit motion builder in, or keep this one.** The original
      editor (and `reboot-editor/inception-prompt.md`) also wasn't here, so the
      Editor tab was built fresh on DialKit's timeline. Compare and keep the
      better parts.
- [ ] Watch `out/springs-side-by-side.mp4` and `out/tmsc-timeline.mp4` full
      screen. Tune anything that feels off in the Lab and re-export
      (`npm run export -- springs-side-by-side tmsc-timeline --verify`).
- [ ] Re-check upstream for a LICENSE
      (`github.com/pixel-point/animate-text`). If one appeared, update
      `docs/LICENSE-NOTES.md`. Either way we copy nothing; we match the format.

## 1. Repo

- [ ] Decide where it lives: its own repo (suggested: `anticipator`), or keep
      it in `tmsc/labs/anticipator`. To split it out:
      `git subtree split -P labs/anticipator -b anticipator` and push that
      branch to the new repo. It's self-contained (own package.json; nothing
      imports from the site).
- [ ] **Licence for our code: MIT suggested.** Add `LICENSE` with your name.
      Fonts stay OFL (licences already beside them in `app/public/fonts/`).
- [ ] Replace the README with `docs/README-PUBLIC.md` (fill `YOUR_GITHUB`,
      `YOUR_DEMO_URL`, `YOUR_LICENCE`).
- [ ] Make it public.
- [ ] `npx skills add YOUR_GITHUB/anticipator --skill anticipator` in a scratch
      project and ask an agent to "make this heading calm" / "give it a wind-up".
      That's the real test of `SKILL.md`.

## 2. Demo deploy

- [ ] `npm run build` → `app/dist/` is a static site. In a static build the Lab
      can't write files (it downloads JSON instead) and Save project downloads
      too. Say so on the page, or hide those buttons in production.
- [ ] Deploy to a **new** Vercel/Netlify project (not the tMSC site; its `main`
      deploys on push). Set the build to `npm run build`, output `app/dist`.
- [ ] That URL is `YOUR_DEMO_URL`.

## 3. Launch

- [ ] Cut the ~40s video (shot list at the bottom of `docs/tweet-draft.md`).
      Add a screen recording of the Lab dials.
- [ ] Edit and post `docs/tweet-draft.md`. It's all lowercase, it credits
      Alex as the base, and it tags `@alex_barashkov`.
- [ ] **Comment on Alex's launch post**
      (https://x.com/alex_barashkov/status/2047309188569666010): short, a
      thank-you plus the link. Something like "built an expansion of this with
      real springs + anticipation, same spec format. would love your take".
      No quote of Alex we don't have.
- [ ] **Ask whether he wants specs upstream.** Offer a PR to animate-text
      with a few specs (portable form: `node skills/anticipator/scripts/get-spec.mjs <id> --portable`,
      or with `x_*` if he wants the extensions). Ask first; don't open it
      unannounced.
- [ ] Post on the tMSC channels (Notion pipeline / Desk as usual).

## 4. Nice to have, later

- [ ] Spring exits (`exit.x_spring`) in a couple of specs. The runtime already
      supports it.
- [ ] Motion / GSAP adapter snippets generated per spec, like animate-text's
      library adapters (our own code, our own format).
- [ ] Audio in the editor export (MediaRecorder track or an ffmpeg mux).
- [ ] Per-clip exit toggle and swap choreography (`swap.mode`) in the editor.
