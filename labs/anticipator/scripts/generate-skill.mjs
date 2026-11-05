// npm run generate:skill: the only way skills/anticipator/ changes.
//
// Reads catalog/text-animations/, writes a self-contained agent skill:
//   SKILL.md, references/*.md, assets/specs/*.json (+ x_css_linear),
//   assets/catalog.json, scripts/{list-specs,get-spec}.mjs, scripts/runtime/*.js
//
// Deterministic (no dates, sorted keys/ids) and idempotent: it wipes the
// output folder and rewrites it, so running it twice changes nothing.
//   node scripts/generate-skill.mjs [--out <dir>]

import fs from "node:fs";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { ROOT, CATALOG_DIR, loadCatalog, canonicalSpec } from "./lib.mjs";
import { validateSpec } from "../core/validate.ts";
import { cssLinear } from "../core/fit.ts";
import { zetaOf, overshoot, springCharacter } from "../core/spring.ts";
import { phaseMs } from "../core/phase.ts";

const outArg = process.argv.indexOf("--out");
const OUT = outArg > -1 ? path.resolve(process.argv[outArg + 1]) : path.join(ROOT, "skills", "anticipator");
const UPSTREAM = "https://github.com/pixel-point/animate-text";

// ------------------------------------------------------------ load + check
const { catalog, specs } = loadCatalog();
const ids = catalog.visible_ids.slice();
for (const id of ids) {
  const errors = validateSpec(specs[id], { fileId: id });
  if (errors.length) {
    console.error(`Refusing to generate: ${id} is invalid. Run npm run validate:catalog.\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
}

// ------------------------------------------------------------ writers
fs.rmSync(OUT, { recursive: true, force: true });
const write = (rel, text) => {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.endsWith("\n") ? text : text + "\n");
};
const json = (rel, data) => write(rel, JSON.stringify(data, null, 2));

// ------------------------------------------------------------ facts per spec
const facts = {};
for (const id of ids) {
  const s = specs[id];
  const e = s.enter;
  const amount = e.x_anticipation?.amount || 0;
  const v0 = e.x_spring?.velocity || 0;
  facts[id] = e.x_spring
    ? {
        zeta: zetaOf(e.x_spring),
        character: springCharacter(e.x_spring),
        overshoot: overshoot(e.x_spring, -(1 + amount), v0),
        unitMs: Math.round(phaseMs(e, "spring")),
        windUp: amount ? `${Math.round(amount * 100)}% / ${e.x_anticipation.duration_ms}ms` : "none",
        maxError: e.x_fallback?.max_error,
      }
    : { zeta: null, character: "bezier only", overshoot: 0, unitMs: e.duration_ms, windUp: "none", maxError: 0 };
}
const fmtZ = (f) => (f.zeta == null ? "n/a" : f.zeta.toFixed(2));
const keysOf = (s) => Object.keys(s.enter.to).join(", ");

// ------------------------------------------------------------ assets
for (const id of ids) {
  const s = canonicalSpec(JSON.parse(JSON.stringify(specs[id])));
  for (const k of ["enter", "exit"]) if (s[k]?.x_spring) s[k].x_css_linear = cssLinear(s[k], 48);
  json(`assets/specs/${id}.json`, canonicalSpec(s));
}
json("assets/catalog.json", {
  skill: "anticipator",
  built_on: "pixel-point/animate-text",
  visible_ids: ids,
  groups: catalog.groups || {},
  specs: ids.map((id) => ({
    id,
    display_name: specs[id].display_name,
    target: specs[id].target,
    intent: specs[id].x_intent || null,
    variant_of: specs[id].x_variant_of || null,
    zeta: facts[id].zeta == null ? null : Math.round(facts[id].zeta * 100) / 100,
    unit_ms: facts[id].unitMs,
    description: specs[id].description,
  })),
});

// ------------------------------------------------------------ scripts
write("scripts/list-specs.mjs", `#!/usr/bin/env node
// List every Anticipator spec. Usage: node scripts/list-specs.mjs [--intent calm] [--target per-word] [--json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const cat = JSON.parse(fs.readFileSync(path.join(here, "..", "assets", "catalog.json"), "utf8"));
const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
let rows = cat.specs;
if (arg("--intent")) rows = rows.filter((r) => r.intent === arg("--intent"));
if (arg("--target")) rows = rows.filter((r) => r.target === arg("--target"));
if (process.argv.includes("--json")) console.log(JSON.stringify(rows, null, 2));
else for (const r of rows) console.log([r.id.padEnd(34), (r.target || "").padEnd(14), (r.intent || "").padEnd(10), "ζ " + (r.zeta ?? "n/a")].join(" ") + "  " + r.description);
`);
write("scripts/get-spec.mjs", `#!/usr/bin/env node
// Print one spec as JSON. Usage: node scripts/get-spec.mjs <id> [--portable]
//   --portable strips every x_* field: exactly what a plain animate-text runtime reads.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const id = process.argv[2];
const file = path.join(here, "..", "assets", "specs", id + ".json");
if (!id || !fs.existsSync(file)) {
  console.error("Unknown spec id: " + id + ". Run node scripts/list-specs.mjs");
  process.exit(1);
}
let spec = JSON.parse(fs.readFileSync(file, "utf8"));
const strip = (o) => Array.isArray(o) ? o.map(strip) : o && typeof o === "object"
  ? Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("x_")).map(([k, v]) => [k, strip(v)])) : o;
if (process.argv.includes("--portable")) spec = strip(spec);
console.log(JSON.stringify(spec, null, 2));
`);
// The skill ships the runtime as plain JS: the same core/*.ts the app runs,
// with types stripped by Node and .ts import specifiers rewritten to .js.
for (const f of ["spring", "easing", "phase"]) {
  const ts = fs.readFileSync(path.join(ROOT, "core", `${f}.ts`), "utf8");
  const js = stripTypeScriptTypes(ts, { mode: "transform" })
    .replace(/from "\.\/([a-z]+)\.ts"/g, 'from "./$1.js"')
    .replace(/^[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n");
  write(`scripts/runtime/${f}.js`, `// Generated from core/${f}.ts by generate-skill.mjs.\n${js}`);
}
json("scripts/runtime/package.json", { type: "module", private: true });
write("scripts/runtime/README.md", `# Reference runtime

Exact, dependency-free JS for the curves in \`assets/specs\`. These are the same
files the Anticipator Lab and its exporter run.

\`\`\`js
import { progressAt, opacityProgressAt, phaseMs } from "./phase.js";
const spec = JSON.parse(fs.readFileSync("../../assets/specs/spring-rise-letters.json"));
const total = phaseMs(spec.enter);            // one unit's enter, in ms
const p = progressAt(spec.enter, 120);        // travel at 120ms: <0 wind-up, >1 overshoot
const o = opacityProgressAt(spec.enter, 120); // opacity 0–1 on its own clock
const y = spec.enter.from.y_px + (spec.enter.to.y_px - spec.enter.from.y_px) * p;
\`\`\`

Use it to drive a JS animation loop (rAF, GSAP ticker, Remotion, After Effects
expression port) when neither a native spring nor CSS \`linear()\` is available.
`);

// ------------------------------------------------------------ references
write("references/schema.md", fs.readFileSync(path.join(CATALOG_DIR, "schema.md"), "utf8"));

const byIntent = {};
for (const id of ids) (byIntent[specs[id].x_intent || "other"] ||= []).push(id);
let guide = `# Selection guide

Pick by **intent** first (what it should feel like), then by **target** (what
moves: letters, words, lines), then by **physics** (ζ).

| ζ | reads as |
| --- | --- |
| < 0.35 | bouncy, toy-like. Use sparingly. |
| 0.35–0.65 | lively, with a visible overshoot |
| 0.65–0.95 | firm, one overshoot you feel more than see |
| ≈ 1 | critical: the fastest arrival with no overshoot. Calm. |
| > 1 | soft, creeping, a bit lazy |

Mass is the "heavy" control. Raising stiffness to compensate keeps the
duration but loses the weight.

## By intent
`;
for (const intent of Object.keys(byIntent).sort()) {
  guide += `\n### ${intent}\n\n| id | target | moves | ζ | wind-up | unit ms | notes |\n| --- | --- | --- | --- | --- | --- | --- |\n`;
  for (const id of byIntent[intent]) {
    const s = specs[id], f = facts[id];
    guide += `| \`${id}\` | ${s.target} | ${keysOf(s)} | ${fmtZ(f)} | ${f.windUp} | ${f.unitMs} | ${s.x_intent_notes || ""} |\n`;
  }
}
const families = {};
for (const id of ids) {
  const base = specs[id].x_variant_of || id;
  (families[base] ||= []).push(id);
}
guide += `\n## Same effect, different physics\n\nThese share \`from\`/\`to\` with their base and change only the spring, so they are\nsafe to swap for one another without touching layout.\n\n`;
for (const [base, list] of Object.entries(families)) {
  if (list.length < 2) continue;
  guide += `- **${base}**: ${list.map((id) => `\`${id}\` (${specs[id].x_intent}, ζ ${fmtZ(facts[id])})`).join(" · ")}\n`;
}
guide += `\n## By request\n\n- "make it calm / quieter / less bouncy" → same family, \`calm\` intent (ζ ≈ 1).\n- "more punch / energy / snappy" → same family, \`energetic\` intent.\n- "heavy / weighty / lands" → \`heavy-drop-lines\`, or raise \`mass\`.\n- "playful / cartoon / pop" → \`anticipate-pop-words\`.\n- "variable font / weight" → \`weight-wave-letters\`.\n- "subtitles / lower third / make sure it's readable" → \`hold-aware-rise\`, and respect \`x_hold_ms\`.\n- Anything in Pixel Point's animate-text catalog (soft blur, typewriter, shared axis…) → use **that** skill. This one adds physics on top; it doesn't replace it.\n`;
write("references/selection-guide.md", guide);

let catMd = `# Catalog\n\n${ids.length} specs. Built on [Pixel Point's animate-text](${UPSTREAM}) spec format.\n\n| id | name | target | intent | ζ | overshoot | wind-up | unit ms | fallback max error |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
for (const id of ids) {
  const s = specs[id], f = facts[id];
  catMd += `| \`${id}\` | ${s.display_name} | ${s.target} | ${s.x_intent || ""} | ${fmtZ(f)} | ${(f.overshoot * 100).toFixed(1)}% | ${f.windUp} | ${f.unitMs} | ${f.maxError ?? "n/a"} |\n`;
}
catMd += `\n## Descriptions\n\n`;
for (const id of ids) catMd += `- **\`${id}\`**: ${specs[id].description} *${specs[id].usage_notes}*\n`;
write("references/catalog.md", catMd);

write("references/implementation-notes.md", `# Implementation notes

## The phase, exactly

Progress \`p\` is in travel units: 0 = \`from\`, 1 = \`to\`. For one unit, at
\`ms\` since its own start (after stagger):

\`\`\`
a  = x_anticipation.amount        (0 if absent)
Ta = x_anticipation.duration_ms   (0 if absent)

Ea = x_anticipation.easing        (default cubic-bezier(0.45, 0, 0.55, 1))
v0 = x_spring.velocity            (travel/s, default 0)

ms < Ta:  p = −a · Ea(ms / Ta)                              // wind-up
ms ≥ Ta:  p = 1 + d(t),  t = (ms − Ta)/1000,  d(0) = −(1 + a),  d'(0) = v0
          m·d'' = −k·d − c·d'          (F = −k(x−1) − c·v, a = F/m; solved in closed form)
          ω0 = √(k/m),  ζ = c / (2√(k·m))
          ζ < 1: d = e^(−ζω0t) · (d0·cos ωd t + ((v0 + ζω0·d0)/ωd)·sin ωd t),  ωd = ω0√(1−ζ²)
          ζ = 1: d = e^(−ω0t) · (d0 + (v0 + ω0·d0)·t)
          ζ > 1: two real roots; see scripts/runtime/spring.js
end:      first ms after which |d| stays < rest_delta · (1 + a)
\`\`\`

Every key except \`opacity\` and \`color\` is \`from + (to − from) · p\`, so it can go
below \`from\` (wind-up) and past \`to\` (overshoot). Clamp \`blur_px\` and
\`scale\` at 0.

Opacity has its own clock: \`easeOutCubic(min(1, ms / x_opacity_duration_ms))\`,
starting with the unit. Never spring opacity.

\`px\` values are authored for 48px type. Scale them by \`fontSize / 48\`.

## Stagger

\`delay(i) = rank(i) · stagger_ms\`, where for \`n\` units and \`mid = (n−1)/2\`:

- \`normal\`: \`rank = i\`
- \`reverse\`: \`rank = n − 1 − i\`
- \`center-out\`: \`rank = round(|i − mid|)\` (minus 1 when \`n\` is even, so the middle pair starts together)
- \`edges-in\`: \`rank = round(mid) − round(|i − mid|)\`

## A clip: enter → hold → exit

- enter total = \`maxRank · enter.stagger_ms + unit ms\`
- hold = \`enter.x_hold_ms + words · enter.x_hold_per_word_ms\` (default 1200ms), counted **after** the enter total
- exit starts at enter total + hold, staggered with \`exit.stagger_ms\` (and \`x_exit_stagger_mode\` if set)

When a layout or loop is longer than the natural clip, stretch the **hold**,
never the springs. A slowed-down spring is a different spring.

## Determinism

The runtime in \`scripts/runtime/\` is closed form with no integrator, so the
frame at time \`t\` is a pure function of \`t\`. Scrubbing, rendering at any fps
and real-time playback all agree. That's what lets the Anticipator Lab
export video frame by frame and have it match the preview.
`);

// ------------------------------------------------------------ SKILL.md
const keywords = [
  "spring text animation", "anticipation", "wind-up", "overshoot", "stiffness damping mass",
  "per-character", "per-word", "per-line", "stagger", "headline reveal", "title card",
  "kinetic type", "variable font weight", "lower third", "subtitles", "WAAPI", "CSS linear()",
  "Motion / Framer Motion", "GSAP", "React", "Remotion", "After Effects",
];
const skill = `---
name: anticipator
description: Text animation specs with real spring physics (stiffness, damping, mass) and anticipation (a wind-up before the move). An expansion of Pixel Point's animate-text. Use when animating headings, titles, labels, kinetic type or text swaps that should feel physical (springy, bouncy, heavy, calm, energetic, playful, a pop, a drop, a rise), when someone asks for "spring", "overshoot", "anticipation", "wind-up", "weight", "squash", or a calm/energetic version of a text effect, or to translate such a spec into ${["WAAPI", "CSS", "Motion / Framer Motion", "GSAP", "React", "Remotion"].join(", ")}. Keywords: ${keywords.join(", ")}.
---

# Anticipator

**Built on [Pixel Point's animate-text](${UPSTREAM}) by Alex Barashkov.** This
skill uses the same portable spec format (\`target\`, \`enter\`/\`exit\`,
\`duration_ms\`, \`stagger_ms\`, \`easing\`, \`from\`/\`to\`, \`swap\`, \`stagger_mode\`)
and extends it with optional \`x_*\` fields for **real springs** and
**anticipation**. It is an expansion, not a replacement. For the broader
catalog of text effects (blur-ins, typewriters, shared-axis, kinetic builds),
use animate-text. Use this one when the motion should have mass.

This skill ships ${ids.length} specs. See \`references/catalog.md\`.

**Rule:** prefer \`x_spring\` (with \`x_anticipation\`) whenever the target runtime supports springs or an exact curve. Otherwise play the bezier fallback, \`easing\` over \`duration_ms\`, which every spec carries and which any animate-text runtime already understands.

## When To Use

- Animating a heading, title card, label, caption or kinetic-type line that
  should **spring**, **overshoot**, **wind up** first, feel **heavy**, or **pop**.
- Making a **calm** or **energetic** version of the same text effect. The
  variants share \`from\`/\`to\` and only change physics.
- A **variable-font weight** animation (\`weight-wave-letters\`).
- Text that must stay up **long enough to read** (\`hold-aware-rise\`, \`x_hold_ms\`).
- Translating a spec into WAAPI, CSS, Motion / Framer Motion, GSAP, React,
  Remotion, or a hand-rolled loop.

Not for: typewriter, blur-only, shimmer or shared-axis transitions. Those
live in animate-text.

## Workflow

1. **Pick a spec.** If the user names one, use it. Otherwise read
   \`references/selection-guide.md\` (by intent → target → ζ), or run
   \`node scripts/list-specs.mjs [--intent calm] [--target per-word]\`.
2. **Read it.** Run \`node scripts/get-spec.mjs <id>\` (full, with \`x_*\` and the
   generated \`x_css_linear\`), or add \`--portable\` for the plain animate-text
   view.
3. **Choose the most faithful path the target stack supports**, in this order:
   1. **Native spring** (Motion / Framer Motion, React Spring, SwiftUI, Compose):
      use \`x_spring\` directly, and run the wind-up as a short first leg (see
      Translation Rules).
   2. **CSS \`linear()\`** (WAAPI, CSS transitions/animations): use the phase's
      \`x_css_linear\` as \`easing\` over \`duration_ms\`. This includes the
      anticipation and is exact to 48 samples.
   3. **JS loop** (canvas, GSAP ticker, Remotion, rAF): call
      \`scripts/runtime/phase.js\` → \`progressAt(phase, ms)\`. Exact.
   4. **Fallback**: \`easing\` + \`duration_ms\`, a cubic-bezier fitted to the
      spring. Always valid, and it is what a runtime that ignores \`x_*\` plays.
      \`x_fallback.max_error\` says how far it strays: under ~0.05 is
      indistinguishable, over ~0.2 loses the second bounce.
4. **Opacity on its own clock**: \`x_opacity_duration_ms\`, ease-out, starting
   with the unit. Never spring opacity.
5. **Stagger** per \`stagger_mode\` (formulas in \`references/implementation-notes.md\`).
6. **Hold** for \`enter.x_hold_ms + words × enter.x_hold_per_word_ms\` after the enter
   finishes, before any exit. Don't shorten it to fit a loop; lengthen the loop.
7. **Preserve the user's text and styling.** Specs carry motion only, never
   copy, colour or font size (except \`x_font_weight\`, which needs a variable font).

## Translation Rules

- **Travel**: every key except \`opacity\`/\`color\` = \`from + (to − from) · p\`, and
  \`p\` may go below 0 (wind-up) and above 1 (overshoot). Don't clamp it except
  \`blur_px ≥ 0\`, \`scale ≥ 0\`.
- **px scale**: \`*_px\` values are authored for 48px type, so multiply by
  \`fontSize / 48\`.
- **Motion / Framer Motion**: wind-up leg
  \`{ duration: Ta/1000, ease: "easeInOut" }\` to \`from − a·(to − from)\`, then
  \`{ type: "spring", stiffness, damping, mass }\` to \`to\`. Motion's
  \`restDelta\` is in value units, not a fraction: use \`rest_delta × |to − from|\`.
  Or run the whole thing as one tween with \`ease\` from \`x_css_linear\` points
  and \`duration: duration_ms/1000\`.
- **WAAPI / CSS**: \`element.animate([from, to], { duration: duration_ms,
  easing: x_css_linear, delay: rank·stagger_ms, fill: "both" })\` plus a
  separate opacity animation over \`x_opacity_duration_ms\` with \`ease-out\`.
- **GSAP**: no native spring. Use \`ease: (t) => progress\` from
  \`scripts/runtime/phase.js\` (normalized by \`phaseMs\`), or the fitted bezier
  through \`CustomEase\`.
- **Remotion / frame-based**: \`progressAt(phase, (frame / fps) * 1000 −
  delay)\`. It's closed form, so any frame renders on its own.
- **Exit phases** in the current catalog are plain cubic-beziers (no
  \`x_spring\`); play them as written.
- **Credit**: when you show or ship an Anticipator effect, the spec format is
  Pixel Point's animate-text. Keep \`x_built_on\` in any copied JSON.

## Files

- \`assets/specs/<id>.json\`: specs (with generated \`x_css_linear\`)
- \`assets/catalog.json\`: index with intent, ζ, unit ms
- \`references/schema.md\`: the format, core + \`x_*\`
- \`references/selection-guide.md\`: choosing by intent and physics
- \`references/catalog.md\`: every spec with ζ, overshoot, fallback error
- \`references/implementation-notes.md\`: exact math, stagger, hold
- \`scripts/list-specs.mjs\`, \`scripts/get-spec.mjs\`: lookups (Node, no deps)
- \`scripts/runtime/\`: the reference runtime (closed-form spring, CSS easing, phase)

Specs are designed in the Anticipator Lab (dials + side-by-side against the
bezier reference) and generated with \`npm run generate:skill\`. Don't edit
this folder by hand.
`;
write("SKILL.md", skill);

console.log(`skills/anticipator generated at ${path.relative(ROOT, OUT) || "."}: ${ids.length} specs.`);
