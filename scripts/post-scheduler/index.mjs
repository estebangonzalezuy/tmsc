// The club's posting runner.
//
//   node index.mjs publish            post everything whose time has come
//   node index.mjs publish --post=ID  post that one now, whatever its time
//   node index.mjs metrics            pull the numbers for what has gone out
//   node index.mjs check              try every connected network's token
//   … --dry-run                       say what would happen, write nothing
//
// It reads content/posts/posts.json (what the Scheduler page queued — the
// page's file, never written here) and writes content/posts/log.json (where
// each post landed, and the numbers — this program's file, never written by
// the page). See lib/posts-shared.ts for the split and why.
//
// The rules — what each network takes, how it counts characters — are
// imported straight from lib/posts-shared.ts, the same module the page uses,
// so the page's "this will go" and the runner's "this went" can't drift:
// Node strips the types on the way in.
//
// Stateless and safe to run twice: a network that has a `published` outcome
// in the log is never posted to again, and a `failed` one is retried only
// once the post has been saved again on the page (its updatedAt moves past
// the failure), so a broken token doesn't produce an attempt every fifteen
// minutes — and doesn't need to, because the health line says what's wrong.

import * as linkedin from "./networks/linkedin.mjs";
import * as x from "./networks/x.mjs";
import * as instagram from "./networks/instagram.mjs";
import * as substack from "./networks/substack.mjs";
import { publicUrl, readMedia, waitForUrl } from "./media.mjs";
import { commitLog, readLog, readPosts } from "./store.mjs";

const shared = await import("../../lib/posts-shared.ts");
const { RULES, NETWORKS, textFor, problemsFor } = shared;

const ADAPTERS = { linkedin, x, instagram, substack };

/* Which secrets say a network is connected at all. */
const CONNECTED = {
  linkedin: ["LINKEDIN_ACCESS_TOKEN"],
  x: ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET"],
  instagram: ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_USER_ID"],
  substack: ["SUBSTACK_SID"],
};
const connected = (n) => CONNECTED[n].every((k) => process.env[k]);

/** A post due more than this long ago and never attempted is not posted: a
 *  runner that was down for a week shouldn't wake up and send a week of
 *  posts at once. The page shows it as skipped, and saving it again with a
 *  new time sends it. */
const TOO_LATE_MS = 48 * 60 * 60 * 1000;

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const job = args.find((a) => !a.startsWith("--")) ?? "publish";
/* One post to send now, whatever its time. From the environment when the
   workflow passes it (it is text from a browser, and never belongs on a
   command line), `--post=` when run by hand. */
const only =
  process.env.ONLY_POST ||
  args.find((a) => a.startsWith("--post="))?.slice("--post=".length) ||
  "";

const now = () => new Date().toISOString();

/* ---------------------------------------------------------------- publish */

async function jobPublish() {
  const posts = await readPosts();
  const log = await readLog();
  const t = Date.now();
  const results = {}; // id → network → outcome
  const health = {};

  const due = posts.posts.filter((p) => {
    if (only) return p.id === only;
    return p.scheduledAt && new Date(p.scheduledAt).getTime() <= t;
  });
  if (only && due.length === 0) console.log(`No post with id ${only}.`);
  console.log(`${due.length} due of ${posts.posts.length}.`);

  for (const post of due) {
    const entry = log.entries[post.id] ?? { results: {} };
    const late = t - new Date(post.scheduledAt ?? t).getTime();
    for (const network of post.networks) {
      const prior = entry.results[network];
      if (prior?.state === "published") continue;
      if (prior && !only && prior.at >= post.updatedAt) continue; // retried once the page saves it again
      const label = RULES[network].label;

      const record = (o) => {
        (results[post.id] ??= {})[network] = { ...o, at: now() };
        console.log(`  ${post.id} · ${label}: ${o.state}${o.error ? ` — ${o.error}` : ""}${o.url ? ` ${o.url}` : ""}`);
      };

      if (!only && late > TOO_LATE_MS && !prior) {
        record({ state: "skipped", error: "Missed by more than two days. Save it again with a new time to send it." });
        continue;
      }
      if (!connected(network)) {
        record({ state: "failed", error: `${label} isn't connected — set ${CONNECTED[network].join(", ")} in the repo's Actions secrets.` });
        continue;
      }
      const problems = problemsFor(post, network);
      if (problems.length) {
        record({ state: "failed", error: problems.join("; ") });
        continue;
      }

      const rule = RULES[network];
      const media = post.media.filter((m) => rule.media.includes(m.kind)).slice(0, rule.maxMedia);
      const text = textFor(post, network);
      if (DRY) {
        console.log(`  (dry run) ${post.id} · ${label}: would post ${text.length} chars, ${media.length} files`);
        continue;
      }
      try {
        if (network === "instagram") {
          const first = media[0] && publicUrl(posts.assetBase, media[0].jpeg ?? media[0].file);
          if (first && !(await waitForUrl(first))) {
            throw new Error(`The media isn't live at ${first} yet — the site may still be deploying. It will be retried on the next save.`);
          }
        }
        const out = await ADAPTERS[network].publish({
          text,
          media,
          read: (m) => readMedia(m.file),
          url: (m) => publicUrl(posts.assetBase, m.jpeg ?? m.file),
        });
        record({ state: "published", id: out.id, url: out.url });
        health[network] = { at: now(), ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        record({ state: "failed", error: message });
        health[network] = { at: now(), ok: false, note: message };
      }
    }
  }

  await commitLog(
    (fresh) => {
      fresh.lastRun = now();
      fresh.health = { ...(fresh.health ?? {}), ...health };
      for (const [id, byNetwork] of Object.entries(results)) {
        const e = (fresh.entries[id] ??= { results: {} });
        Object.assign(e.results, byNetwork);
      }
    },
    `Post what was due (${Object.keys(results).length} ${Object.keys(results).length === 1 ? "post" : "posts"})`,
    { dry: DRY },
  );
}

/* ---------------------------------------------------------------- metrics */

async function jobMetrics() {
  const posts = await readPosts();
  const log = await readLog();
  const pulled = {}; // id → network → metrics
  const health = {};
  let calls = 0;

  for (const post of posts.posts) {
    const entry = log.entries[post.id];
    if (!entry) continue;
    for (const network of post.networks) {
      const o = entry.results[network];
      if (o?.state !== "published" || !o.id || !connected(network)) continue;
      /* Numbers move for about a month and then stop; after that a read is a
         wasted call, and X charges for reads. */
      if (Date.now() - new Date(o.at).getTime() > 35 * 24 * 60 * 60 * 1000) continue;
      if (DRY) {
        console.log(`  (dry run) would read ${RULES[network].label} for ${post.id}`);
        continue;
      }
      try {
        const m = await ADAPTERS[network].metrics({ id: o.id });
        const clean = { at: now() };
        for (const [k, v] of Object.entries(m)) if (typeof v === "number") clean[k] = v;
        (pulled[post.id] ??= {})[network] = clean;
        health[network] = { at: now(), ok: true };
        calls++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`  ${post.id} · ${RULES[network].label}: ${message}`);
        health[network] = { at: now(), ok: false, note: `Reading the numbers: ${message}` };
      }
    }
  }
  console.log(`Read ${calls} posts' numbers.`);

  await commitLog(
    (fresh) => {
      fresh.health = { ...(fresh.health ?? {}), ...health };
      for (const [id, byNetwork] of Object.entries(pulled)) {
        const e = (fresh.entries[id] ??= { results: {} });
        e.metrics = { ...(e.metrics ?? {}), ...byNetwork };
      }
    },
    "Pull the numbers",
    { dry: DRY },
  );
}

/* ------------------------------------------------------------------ check */

async function jobCheck() {
  const health = {};
  for (const network of NETWORKS) {
    const label = RULES[network].label;
    if (!connected(network)) {
      console.log(`${label}: not connected (${CONNECTED[network].join(", ")})`);
      continue;
    }
    try {
      await ADAPTERS[network].check();
      health[network] = { at: now(), ok: true };
      console.log(`${label}: ok`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      health[network] = { at: now(), ok: false, note: message };
      console.log(`${label}: ${message}`);
    }
  }
  await commitLog(
    (fresh) => {
      fresh.health = { ...(fresh.health ?? {}), ...health };
    },
    "Check the networks",
    { dry: DRY },
  );
}

const JOBS = { publish: jobPublish, metrics: jobMetrics, check: jobCheck };
if (!JOBS[job]) {
  console.error(`Unknown job "${job}". One of: ${Object.keys(JOBS).join(", ")}`);
  process.exit(2);
}
await JOBS[job]();
