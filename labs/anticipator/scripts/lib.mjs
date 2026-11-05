// Shared catalog I/O for the scripts and the Vite dev middleware.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CATALOG_DIR = path.join(ROOT, "catalog", "text-animations");
export const SPECS_DIR = path.join(CATALOG_DIR, "specs");
export const CATALOG_FILE = path.join(CATALOG_DIR, "catalog.json");

// Field order in written files: the compatible core first, extensions after,
// so a spec reads like an animate-text spec with notes in the margin.
const SPEC_ORDER = [
  "id", "display_name", "description", "inspiration", "target", "signature_easing",
  "stagger_mode", "enter", "exit", "swap", "usage_notes",
  "x_intent", "x_intent_notes", "x_variant_of", "x_hold_ms", "x_hold_per_word_ms",
  "x_exit_stagger_mode", "x_built_on",
];
const PHASE_ORDER = [
  "duration_ms", "stagger_ms", "easing", "from", "to",
  "x_spring", "x_anticipation", "x_opacity_duration_ms", "x_fallback", "x_css_linear",
];

function ordered(obj, order) {
  const out = {};
  for (const k of order) if (obj[k] !== undefined) out[k] = obj[k];
  for (const k of Object.keys(obj)) if (!(k in out)) out[k] = obj[k];
  return out;
}

/** Canonical key order, so writes are stable and diffs stay small. */
export function canonicalSpec(spec) {
  const s = ordered(spec, SPEC_ORDER);
  if (s.enter) s.enter = ordered(s.enter, PHASE_ORDER);
  if (s.exit) s.exit = ordered(s.exit, PHASE_ORDER);
  return s;
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = JSON.stringify(data, null, 2) + "\n";
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === text) return false;
  fs.writeFileSync(file, text);
  return true;
}

export function listSpecFiles() {
  return fs.readdirSync(SPECS_DIR).filter((f) => f.endsWith(".json")).sort();
}

export function loadCatalog() {
  const catalog = readJson(CATALOG_FILE);
  const specs = {};
  for (const f of listSpecFiles()) specs[f.replace(/\.json$/, "")] = readJson(path.join(SPECS_DIR, f));
  return { catalog, specs };
}

/** Write a spec and make sure catalog.json lists it. */
export function saveSpec(spec, { group = "lab" } = {}) {
  writeJson(path.join(SPECS_DIR, `${spec.id}.json`), canonicalSpec(spec));
  const catalog = readJson(CATALOG_FILE);
  if (!catalog.visible_ids.includes(spec.id)) catalog.visible_ids.push(spec.id);
  catalog.groups = catalog.groups || {};
  const inGroup = Object.values(catalog.groups).some((ids) => ids.includes(spec.id));
  if (!inGroup) (catalog.groups[group] = catalog.groups[group] || []).push(spec.id);
  writeJson(CATALOG_FILE, catalog);
}
