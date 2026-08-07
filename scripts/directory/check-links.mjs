#!/usr/bin/env node
// Checks every href in the Directory for dead links.
//
//   node scripts/directory/check-links.mjs            # everything
//   node scripts/directory/check-links.mjs tools      # one collection
//
// A directory is only as good as its links, and the seeded collections
// (see #source: in scripts/directory/sources/*.tsv) have never been fetched —
// they are the club's best knowledge written down, not a verified export.
// Run this from a machine with open outbound HTTPS before trusting them.
//
// Exits non-zero if anything failed, so it can gate a commit.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = join(root, "content", "directory");
const CONCURRENCY = 8;
const TIMEOUT_MS = 15000;

const only = process.argv[2];
const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".json") && f !== "manifest.json")
  .filter((f) => !only || f === `${only}.json`);

if (!files.length) {
  console.error(only ? `No collection named "${only}".` : "No collections built yet — run build.mjs first.");
  process.exit(1);
}

const targets = [];
for (const file of files) {
  const collection = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  for (const entry of collection.entries) {
    if (entry.href) targets.push({ collection: collection.id, name: entry.name, href: entry.href });
  }
}

console.log(`Checking ${targets.length} links across ${files.length} collection(s)…\n`);

async function check(target) {
  const attempt = async (method) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(target.href, {
        method,
        redirect: "follow",
        signal: controller.signal,
        // Plenty of sites 403 anything that does not look like a browser.
        headers: { "user-agent": "Mozilla/5.0 (compatible; tMSC-index-linkcheck/1.0)" },
      });
      return { status: res.status };
    } catch (err) {
      return { status: 0, error: err.name === "AbortError" ? "timeout" : err.message };
    } finally {
      clearTimeout(timer);
    }
  };

  // HEAD first because it is cheap; a lot of servers refuse it, so fall back.
  let result = await attempt("HEAD");
  if (result.status === 0 || result.status === 405 || result.status === 403 || result.status === 404) {
    result = await attempt("GET");
  }
  return { ...target, ...result };
}

const failures = [];
let done = 0;

const queue = [...targets];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const target = queue.shift();
      const result = await check(target);
      done += 1;
      const ok = result.status >= 200 && result.status < 400;
      if (!ok) failures.push(result);
      process.stdout.write(`\r${done}/${targets.length} checked, ${failures.length} failing`);
    }
  }),
);

process.stdout.write("\n\n");

if (!failures.length) {
  console.log("All links resolved.");
  process.exit(0);
}

failures.sort((a, b) => a.collection.localeCompare(b.collection) || a.name.localeCompare(b.name));
for (const f of failures) {
  console.log(`${f.collection.padEnd(11)} ${String(f.status || f.error).padEnd(8)} ${f.name}`);
  console.log(`${" ".repeat(20)}${f.href}`);
}
console.log(`\n${failures.length} of ${targets.length} links need attention.`);
console.log("Fix them in scripts/directory/sources/*.tsv, then re-run build.mjs.");
process.exit(1);
