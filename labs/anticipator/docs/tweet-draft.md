# tweet draft (NOT published)

> draft only. esteban posts it, or doesn't. replace `YOUR_DEMO_URL` before
> anything goes out. video: `out/springs-side-by-side.mp4` cut to ~40s (see
> the shot list at the bottom).

---

## main post (with ~40s video)

alex & pixel point shipped animate-text: text animations as json recipes + a skill your agent can install. i loved it, so i built on top of it.

anticipator is an expansion: same spec format, plus real springs (mass, stiffness, damping) and anticipation, the little wind-up before the move.

a tool to dial them in → exports the skill.

YOUR_DEMO_URL

@alex_barashkov would love your eyes on it 🙏

---

## reply 1 (the why)

a cubic-bezier can fake one overshoot. it can't do a second bounce, and it can't do weight.

so every spec keeps a bezier fallback (fitted to the spring, with its error written down) and adds `x_spring` + `x_anticipation`. runtimes that don't know them just play the bezier. nothing breaks.

## reply 2 (the tool)

the lab: side-by-side bezier vs spring, dials for k / c / m / wind-up / stagger, ζ live. save a preset with an intent (calm, energetic, heavy…) and `generate:skill` rebuilds the skill.

then a tiny editor on top (dialkit timeline) to cut clips like this one.

## reply 3 (credit + ask)

format, idea and the skill pattern are pixel point's. i added physics and a motion designer's eye. if you want any of these specs upstream in animate-text, they're yours.

---

### alt, shorter (if the thread feels like too much)

built on @alex_barashkov's animate-text: same json specs, now with real springs + anticipation, and a tool that exports the skill. calm, energetic, heavy, same words.

YOUR_DEMO_URL

---

### ~40s video, shot list

| t | shot | source |
| --- | --- | --- |
| 0–3s | "the motion social club" heavy drop, acid/ink | `out/tmsc-timeline.mp4` 0–3s |
| 3–13s | side-by-side round 1: pop, bezier vs spring + wind-up | `out/springs-side-by-side.mp4` 0–3.2s, played twice (2nd at 0.5×) |
| 13–20s | round 2: heavy drop, mass 2.2 | side-by-side 3.3–6.7s |
| 20–26s | round 3: ζ 0.39 rings twice | side-by-side 6.8–9.8s |
| 26–34s | screen recording: Lab dials, ζ moving, Save preset | record from `npm run dev` |
| 34–40s | "anticipator" weight wave + end card with YOUR_DEMO_URL | `out/tmsc-timeline.mp4` 8.3–11s |

no music needed; if any, cut round 3 to the beat.
