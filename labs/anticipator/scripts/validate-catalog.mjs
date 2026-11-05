// npm run validate:catalog: exits 1 if any spec breaks the schema, if the
// catalog lists a missing file, or if a file isn't listed.

import path from "node:path";
import { CATALOG_FILE, SPECS_DIR, listSpecFiles, readJson } from "./lib.mjs";
import { validateSpec } from "../core/validate.ts";

let failures = 0;
const fail = (msg) => { failures++; console.error(`  ✗ ${msg}`); };

let catalog;
try { catalog = readJson(CATALOG_FILE); } catch (e) { fail(`catalog.json: ${e.message}`); }

const files = listSpecFiles();
const ids = files.map((f) => f.replace(/\.json$/, ""));
const specs = {};
for (const f of files) {
  const id = f.replace(/\.json$/, "");
  let spec;
  try { spec = readJson(path.join(SPECS_DIR, f)); } catch (e) { fail(`${f}: invalid JSON (${e.message})`); continue; }
  specs[id] = spec;
  const errors = validateSpec(spec, { fileId: id });
  if (errors.length) { console.error(`${f}`); errors.forEach(fail); }
  else console.log(`  ✓ ${id}`);
}

if (catalog) {
  if (!Array.isArray(catalog.visible_ids)) fail("catalog.json: visible_ids must be an array");
  else {
    for (const id of catalog.visible_ids) if (!ids.includes(id)) fail(`catalog.json lists "${id}" but specs/${id}.json does not exist`);
    for (const id of ids) if (!catalog.visible_ids.includes(id)) fail(`specs/${id}.json is not listed in catalog.json visible_ids`);
    const dupes = catalog.visible_ids.filter((id, i, a) => a.indexOf(id) !== i);
    if (dupes.length) fail(`catalog.json: duplicate ids ${dupes.join(", ")}`);
  }
  for (const [g, list] of Object.entries(catalog.groups || {})) {
    for (const id of list) if (!ids.includes(id)) fail(`catalog.json group "${g}" lists missing "${id}"`);
  }
}
for (const [id, spec] of Object.entries(specs)) {
  if (spec.x_variant_of && !specs[spec.x_variant_of]) fail(`${id}: x_variant_of "${spec.x_variant_of}" does not exist`);
  if (spec.x_variant_of && specs[spec.x_variant_of]) {
    const base = specs[spec.x_variant_of];
    const same = JSON.stringify([base.enter.from, base.enter.to]) === JSON.stringify([spec.enter.from, spec.enter.to]);
    if (!same) fail(`${id}: a variant must keep the base effect's enter from/to (only the physics changes)`);
  }
}

if (failures) {
  console.error(`\n${failures} problem${failures === 1 ? "" : "s"}. Catalog is invalid.`);
  process.exit(1);
}
console.log(`\nCatalog valid: ${ids.length} specs.`);
