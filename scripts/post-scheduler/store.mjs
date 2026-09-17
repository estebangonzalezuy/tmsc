// The two data files, and committing the one the runner owns.
//
// posts.json is read and never written here: it belongs to the page. log.json
// is this program's, and nothing else writes it — so a push from here and a
// commit from the browser can never collide on a line. If the ref has moved
// under us anyway (the page saved a post while we were posting one), the push
// is rejected, we reset to origin and re-apply the same log changes on top —
// they are keyed by post id, so applying them twice is applying them once.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { ROOT } from "./media.mjs";

const execFile = promisify(execFileCb);

const POSTS = resolve(ROOT, "content/posts/posts.json");
const LOG = resolve(ROOT, "content/posts/log.json");

export async function readPosts() {
  return JSON.parse(await readFile(POSTS, "utf8"));
}

export async function readLog() {
  try {
    return JSON.parse(await readFile(LOG, "utf8"));
  } catch {
    return { version: 1, entries: {} };
  }
}

async function git(...args) {
  const { stdout } = await execFile("git", args, { cwd: ROOT });
  return stdout.trim();
}

/**
 * Applies `patch(log)` to the log on disk, commits, pushes. `patch` must be
 * idempotent: on a rejected push it runs again over the fresh file.
 */
export async function commitLog(patch, message, { dry = false, tries = 4 } = {}) {
  for (let attempt = 0; attempt < tries; attempt++) {
    const log = await readLog();
    const before = JSON.stringify(log);
    patch(log);
    if (dry) {
      const same = JSON.stringify(log) === before;
      console.log(`(dry run) would ${same ? "leave the log alone" : `commit: ${message}`}`);
      return;
    }
    await writeFile(LOG, JSON.stringify(log, null, 2) + "\n");
    const changed = await git("status", "--porcelain", "--", "content/posts/log.json");
    if (!changed) {
      console.log("Nothing changed in the log.");
      return;
    }
    await git("add", "content/posts/log.json");
    await git("-c", "user.name=post-scheduler", "-c", "user.email=actions@github.com", "commit", "-m", message);
    try {
      await git("push");
      console.log(`Pushed: ${message}`);
      return;
    } catch {
      console.log(`Push rejected (${attempt + 1}/${tries}); refreshing and retrying.`);
      await git("fetch", "origin");
      await git("reset", "--hard", "origin/main");
    }
  }
  throw new Error("Couldn't push the log after several tries.");
}
