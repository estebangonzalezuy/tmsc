// Where the Scheduler's data comes from and goes to.
//
// In production: the repo, through the GitHub API, with the token pasted into
// the page — the Curator's and the Cutter's road. In `next dev`: a dev-only
// route that reads and writes the working copy, so the whole loop can be
// driven without a token and without publishing to the live site.
//
// Whichever the source, the page writes posts.json and the media, and only
// those: log.json belongs to the runner (see lib/posts-shared.ts).

import { commitFiles, readJson, type CommitProgress } from "@/lib/github";
import {
  EMPTY_LOG,
  EMPTY_POSTS,
  LOG_FILE,
  POSTS_FILE,
  type LogData,
  type PostsData,
} from "@/lib/posts-shared";

export type Source = { mode: "github"; token: string } | { mode: "local" };

export const LOCAL_ROUTE = "/api/posts/local";

export async function load(source: Source): Promise<{ posts: PostsData; log: LogData }> {
  if (source.mode === "local") {
    const res = await fetch(LOCAL_ROUTE, { cache: "no-store" });
    if (!res.ok) throw new Error(`Couldn't read the checkout (${res.status}).`);
    const body = (await res.json()) as { posts?: PostsData; log?: LogData };
    return { posts: body.posts ?? EMPTY_POSTS, log: body.log ?? EMPTY_LOG };
  }
  const [posts, log] = await Promise.all([
    readJson<PostsData>(source.token, POSTS_FILE),
    readJson<LogData>(source.token, LOG_FILE).catch(() => ({ data: EMPTY_LOG })),
  ]);
  return { posts: posts.data, log: log.data };
}

export type SaveArgs = {
  posts: PostsData;
  /** New media, keyed by repo path (public/posts/…). */
  add: Map<string, Blob>;
  /** Media to take out, repo paths. */
  remove: string[];
  message: string;
  onProgress?: CommitProgress;
};

export async function save(source: Source, args: SaveArgs): Promise<void> {
  const json = JSON.stringify(args.posts, null, 2) + "\n";
  if (source.mode === "local") {
    const form = new FormData();
    form.set("data", json);
    form.set("remove", JSON.stringify(args.remove));
    for (const [path, blob] of args.add) form.append("file", blob, path);
    const res = await fetch(LOCAL_ROUTE, { method: "PUT", body: form });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `Couldn't write the checkout (${res.status}).`);
    }
    return;
  }
  await commitFiles(source.token, {
    message: args.message,
    text: { [POSTS_FILE]: json },
    binaries: args.add,
    remove: args.remove,
    onProgress: args.onProgress,
  });
}

/* ---------- the runner ---------- */

export const GH_REPO = "estebangonzalezuy/tmsc";
export const WORKFLOW = "post-scheduler.yml";

const ghHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

/** Starts the runner now rather than at its next tick — for "Post now", and
 *  for pulling the numbers on demand. Needs Actions: read and write on the
 *  token, which the Desk's token already has. */
export async function dispatch(
  token: string,
  inputs: { job: "publish" | "metrics"; post?: string },
): Promise<void> {
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(
      `https://api.github.com/repos/${GH_REPO}/actions/workflows/${WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: { ...ghHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ ref: "main", inputs: { job: inputs.job, post: inputs.post ?? "" } }),
      },
    );
    if (res.ok || res.status < 500) break;
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  if (!res || res.ok) return;
  if (res.status === 401 || res.status === 403) {
    throw new Error("GitHub rejected the token for starting a run — it needs Actions: read and write as well as Contents.");
  }
  if (res.status === 404) {
    throw new Error("GitHub can't see the runner's workflow with this token — it needs Actions: read and write, and the workflow has to be on main.");
  }
  if (res.status === 422) {
    throw new Error("GitHub refused to start the runner — the workflow may not be on main yet.");
  }
  throw new Error(`GitHub said ${res.status}.`);
}

export type Run = {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
};

/** The runner's last few runs, so the page can say whether one is going. */
export async function recentRuns(token: string): Promise<Run[] | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GH_REPO}/actions/workflows/${WORKFLOW}/runs?per_page=5`,
      { headers: ghHeaders(token), cache: "no-store" },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { workflow_runs: Run[] };
    return body.workflow_runs ?? [];
  } catch {
    return null;
  }
}
