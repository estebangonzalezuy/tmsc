#!/usr/bin/env node
// Deletes sheets in public/clips/ that no project claims any more.
//
// Dropping a clip in the Cutter removes it from clips.json and leaves the files
// behind. That is deliberate, and it matters more here than it does for the
// Stills: a filmstrip is the heaviest thing the club commits, so the temptation
// is to have the Cutter tidy up as it goes — which would make publishing a
// multi-step tree write that can half-fail. Orphans cost repo weight and
// nothing else, so they are swept up here instead, on purpose, by a human who
// can see what is about to go.
//
//   node scripts/clips/prune.mjs           # say what it would remove
//   node scripts/clips/prune.mjs --delete  # actually remove it
//
// Run it from a fresh pull, or it will happily delete the clips of a project
// somebody added while you weren't looking.

import { readFile, readdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA = path.join(root, "content/clips/clips.json");
const ASSETS = path.join(root, "public/clips");

function human(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.round(bytes / 1024)}KB`;
}

const doIt = process.argv.includes("--delete");

if (!existsSync(ASSETS)) {
  console.log("Nothing in public/clips yet.");
  process.exit(0);
}

const data = JSON.parse(await readFile(DATA, "utf8"));

/** Every path the library still refers to. */
const claimed = new Set();
for (const project of data.projects ?? []) {
  for (const clip of project.clips ?? []) {
    claimed.add(`${project.id}/${clip.file}`);
    claimed.add(`${project.id}/${clip.poster}`);
  }
}

const orphans = [];
let total = 0;

for (const dir of await readdir(ASSETS, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  for (const file of await readdir(path.join(ASSETS, dir.name))) {
    const rel = `${dir.name}/${file}`;
    if (claimed.has(rel)) continue;
    const { size } = await stat(path.join(ASSETS, rel));
    orphans.push({ rel, size });
    total += size;
  }
}

if (!orphans.length) {
  console.log(`Nothing to sweep — every file in public/clips is claimed by ${claimed.size / 2} clips.`);
  process.exit(0);
}

for (const { rel, size } of orphans) {
  console.log(`${doIt ? "removed" : "would remove"}  ${rel}  ${human(size)}`);
  if (doIt) await rm(path.join(ASSETS, rel));
}

console.log(
  `\n${orphans.length} orphan${orphans.length === 1 ? "" : "s"}, ${human(total)}${
    doIt ? " removed." : ". Run again with --delete to remove them."
  }`,
);
