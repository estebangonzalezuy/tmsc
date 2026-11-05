#!/usr/bin/env node
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
