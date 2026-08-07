#!/usr/bin/env node
// Deletes images in public/stills/ that no project claims any more.
//
// Dropping a frame in the Curator removes it from projects.json and leaves
// the file behind. That is deliberate: the Curator commits one small JSON
// file through the contents API, and deleting a dozen binaries in the same
// breath would make publishing a multi-step tree write that can half-fail.
// Orphans cost a little repo weight and nothing else, so they are swept up
// here instead, on purpose, by a human who can see what is about to go.
//
//   node scripts/stills/prune.mjs           # say what it would remove
//   node scripts/stills/prune.mjs --delete  # actually remove it
//
// Run it from a fresh pull, or it will happily delete the frames of a project
// somebody added while you weren't looking.

import { readFile, readdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROJECTS = path.join(root, "content/stills/projects.json");
const ASSETS = path.join(root, "public/stills");

function human(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.round(bytes / 1024)}KB`;
}

async function main() {
  const doDelete = process.argv.includes("--delete");
  if (!existsSync(ASSETS)) {
    console.log("No public/stills yet — nothing to prune.");
    return;
  }

  const data = JSON.parse(await readFile(PROJECTS, "utf8"));
  const byProject = new Map(
    data.projects.map((project) => [
      project.id,
      new Set([
        ...project.frames.flatMap((f) => [f.file, f.thumb].filter(Boolean)),
        ...(project.scrub?.files ?? []),
      ]),
    ]),
  );

  const orphans = [];
  for (const dir of await readdir(ASSETS, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const claimed = byProject.get(dir.name);
    const dirPath = path.join(ASSETS, dir.name);
    // A directory no project mentions at all is orphaned whole — a removed
    // project, or a run that failed before it wrote the JSON.
    if (!claimed) {
      orphans.push({ path: dirPath, why: `no project named ${dir.name}` });
      continue;
    }
    for (const file of await readdir(dirPath)) {
      if (!claimed.has(file)) {
        orphans.push({ path: path.join(dirPath, file), why: "dropped frame" });
      }
    }
  }

  if (!orphans.length) {
    console.log("Nothing orphaned. public/stills matches projects.json.");
    return;
  }

  let total = 0;
  for (const orphan of orphans) {
    const info = await stat(orphan.path);
    total += info.size;
    console.log(
      `${doDelete ? "removing" : "would remove"} ${path.relative(root, orphan.path)} — ${orphan.why}`,
    );
  }
  console.log(
    `\n${orphans.length} orphaned ${orphans.length === 1 ? "path" : "paths"}, ${human(total)}`,
  );

  if (!doDelete) {
    console.log("Nothing was touched. Pass --delete to remove them.");
    return;
  }
  for (const orphan of orphans) {
    await rm(orphan.path, { recursive: true, force: true });
  }
  console.log("Removed. Commit public/stills to make it stick.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
