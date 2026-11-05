#!/usr/bin/env node
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
