// Shared catalog I/O for the scripts and the Vite dev middleware.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalSpec } from "../core/canonical.ts";

export { canonicalSpec };

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CATALOG_DIR = path.join(ROOT, "catalog", "text-animations");
export const SPECS_DIR = path.join(CATALOG_DIR, "specs");
export const CATALOG_FILE = path.join(CATALOG_DIR, "catalog.json");

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
