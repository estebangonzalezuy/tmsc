// npm run fit:catalog: re-fit the Pixel-compatible fallback (easing,
// duration_ms, signature_easing, x_fallback) of every spring phase from its
// physics. Idempotent: files whose physics didn't change are left alone.

import path from "node:path";
import { SPECS_DIR, listSpecFiles, readJson, writeJson, canonicalSpec } from "./lib.mjs";
import { applyFallback, physicsHash } from "../core/fit.ts";

const force = process.argv.includes("--force");
let changed = 0;
for (const f of listSpecFiles()) {
  const file = path.join(SPECS_DIR, f);
  const spec = readJson(file);
  for (const key of ["enter", "exit"]) {
    const p = spec[key];
    if (!p?.x_spring) continue;
    if (!force && p.x_fallback?.fitted_from === physicsHash(p)) continue;
    applyFallback(p);
  }
  if (spec.enter?.x_spring) spec.signature_easing = spec.enter.easing;
  if (writeJson(file, canonicalSpec(spec))) { changed++; console.log(`  fitted ${f}`); }
}
console.log(changed ? `${changed} spec(s) re-fitted.` : "All fallbacks fresh.");
