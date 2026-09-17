"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { CircleLetter } from "@/components/Motifs";
import Analytics from "@/components/scheduler/Analytics";
import Calendar from "@/components/scheduler/Calendar";
import Composer, { type SaveRequest } from "@/components/scheduler/Composer";
import PostCard from "@/components/scheduler/PostCard";
import { dispatch, load, recentRuns, save, type Run, type Source } from "@/components/scheduler/store";
import { chip } from "@/components/scheduler/chrome";
import { useNow } from "@/components/scheduler/useNow";
import { GH_REPO, checkAccess, tokenStore, type Access } from "@/lib/github";
import { site } from "@/lib/data";
import {
  EMPTY_LOG,
  EMPTY_POSTS,
  NETWORKS,
  RULES,
  startOfWeek,
  statusOf,
  type LogData,
  type Metrics,
  type Network,
  type PostsData,
  type ScheduledPost,
} from "@/lib/posts-shared";

// the Scheduler — where the club's posts are written, given their files and
// their date, and sent to LinkedIn, X, Instagram and Substack Notes.
//
// The page is the front half. It writes what you mean to post — the words,
// the media, the networks, the time — into the repo, through the GitHub API
// with a token pasted into the browser: zero-config like the Desk, the
// Curator and the Cutter, nothing on Vercel holds a secret. The back half is
// scripts/post-scheduler on GitHub Actions, the one place the networks' own
// tokens live: it wakes up every quarter hour, posts what is due, and writes
// back where each post landed and what the numbers were. The page reads that
// log and shows it beside the plan.
//
// Internal, so it is not in the nav and it is not indexed.

const LOCAL = process.env.NODE_ENV === "development";

type Tab = "calendar" | "queue" | "drafts" | "posted" | "analytics";

const TABS: { id: Tab; label: string }[] = [
  { id: "calendar", label: "Calendar" },
  { id: "queue", label: "Queue" },
  { id: "drafts", label: "Drafts" },
  { id: "posted", label: "Posted" },
  { id: "analytics", label: "Analytics" },
];

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

export default function Scheduler() {
  const token =
    useSyncExternalStore(tokenStore.subscribe, tokenStore.get, tokenStore.server) ?? "";
  const source: Source | null = token
    ? { mode: "github", token }
    : LOCAL
      ? { mode: "local" }
      : null;

  const [posts, setPosts] = useState<PostsData>(EMPTY_POSTS);
  const [log, setLog] = useState<LogData>(EMPTY_LOG);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [access, setAccess] = useState<Access | null>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [tab, setTab] = useState<Tab>("calendar");
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const now = useNow();

  const reload = useCallback(async () => {
    if (!source) return;
    try {
      const data = await load(source);
      setPosts(data.posts);
      setLog(data.log);
      setLoaded(true);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- source is derived from token
  }, [token]);

  const verify = useCallback(async () => {
    if (!token) return;
    try {
      setAccess(await checkAccess(token));
    } catch {
      setAccess(null);
    }
    setRuns(await recentRuns(token));
  }, [token]);

  useEffect(() => {
    if (!source) return;
    const id = window.setTimeout(() => {
      reload();
      verify();
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the token changes
  }, [token, reload, verify]);

  /* While the runner is going, keep looking, so "Post now" ends with the
     result on the page rather than a refresh. */
  useEffect(() => {
    if (!token || !runs?.some((r) => r.status !== "completed")) return;
    const id = window.setTimeout(async () => {
      setRuns(await recentRuns(token));
      reload();
    }, 8000);
    return () => window.clearTimeout(id);
  }, [token, runs, reload]);

  async function write(next: PostsData, args: Omit<Parameters<typeof save>[1], "posts">) {
    if (!source) throw new Error("No way to save — paste a token first.");
    setBusy(true);
    setProgress("");
    try {
      await save(source, {
        ...args,
        posts: next,
        onProgress: (done, total) => setProgress(`Uploading ${done}/${total}…`),
      });
      setPosts(next);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  async function onSave(req: SaveRequest) {
    const others = posts.posts.filter((p) => p.id !== req.post.id);
    const next: PostsData = { ...posts, posts: [...others, req.post] };
    const verb = req.post.scheduledAt ? "Schedule" : "Draft";
    await write(next, {
      add: req.add,
      remove: req.remove,
      message: `${verb} a post from the Scheduler`,
    });
    setEditing(null);
    if (req.postNow && token) {
      try {
        await dispatch(token, { job: "publish", post: req.post.id });
        setFlash("Saved, and the runner is on its way — about a minute.");
        setRuns(await recentRuns(token));
      } catch (err) {
        setFlash(`Saved. ${(err as Error).message}`);
      }
    } else {
      setFlash(req.post.scheduledAt ? "Scheduled." : "Draft saved.");
    }
    setTab(req.post.scheduledAt ? "calendar" : "drafts");
  }

  async function onDelete(post: ScheduledPost) {
    const next: PostsData = { ...posts, posts: posts.posts.filter((p) => p.id !== post.id) };
    const remove = post.media.flatMap((m) => [
      `public/${m.file}`,
      ...(m.jpeg ? [`public/${m.jpeg}`] : []),
    ]);
    await write(next, { add: new Map(), remove, message: "Delete a post from the Scheduler" });
    setEditing(null);
    setFlash("Deleted.");
  }

  async function onSaveMetrics(postId: string, network: Network, metrics: Metrics) {
    const next: PostsData = {
      ...posts,
      posts: posts.posts.map((p) =>
        p.id === postId
          ? {
              ...p,
              metrics: { ...(p.metrics ?? {}), [network]: metrics },
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    };
    await write(next, { add: new Map(), remove: [], message: "Note how a post landed" });
  }

  async function run(job: "publish" | "metrics") {
    if (!token) return;
    setFlash("");
    try {
      await dispatch(token, { job });
      setFlash(job === "publish" ? "The runner is checking the queue." : "Pulling the numbers — about a minute.");
      setRuns(await recentRuns(token));
    } catch (err) {
      setFlash((err as Error).message);
    }
  }

  if (!source) {
    return (
      <Shell>
        <Setup />
      </Shell>
    );
  }

  const all = posts.posts;
  const byTime = (a: ScheduledPost, b: ScheduledPost) =>
    (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "");
  const queue = all
    .filter((p) => p.scheduledAt && ["scheduled", "posting"].includes(statusOf(p, log, now)))
    .sort(byTime);
  const drafts = all.filter((p) => !p.scheduledAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const posted = all
    .filter((p) => p.scheduledAt && ["published", "partial", "failed"].includes(statusOf(p, log, now)))
    .sort((a, b) => byTime(b, a));
  const editingPost = editing && editing !== "new" ? all.find((p) => p.id === editing) : undefined;
  const working = runs?.some((r) => r.status !== "completed") ?? false;
  const thisWeek = all.filter((p) => {
    if (!p.scheduledAt) return false;
    const t = new Date(p.scheduledAt).getTime();
    return t >= now && t < now + 7 * 86400_000;
  }).length;

  return (
    <Shell>
      {error && (
        <p role="alert" className="card px-4 py-3 text-sm bg-foreground text-background">
          {error}
        </p>
      )}
      {LOCAL && !token && (
        <p className="card px-4 py-3 text-sm text-muted leading-relaxed">
          Running locally with no token. Everything you schedule is written into this
          checkout — <code>content/posts/posts.json</code> and <code>public/posts/</code> —
          instead of the repo, and nothing is posted anywhere.
        </p>
      )}
      {access && !access.canWrite && (
        <p role="alert" className="card px-4 py-3 text-sm bg-foreground text-background leading-relaxed">
          {access.problem}{" "}
          <button onClick={verify} className="underline underline-offset-4">
            Check again
          </button>
        </p>
      )}

      {editing ? (
        <Composer
          key={editing}
          existing={editingPost}
          log={log}
          assetBase={posts.assetBase}
          name={site.name}
          handle={site.short ? `@${site.short.toLowerCase().replace(/\s+/g, "")}` : "@club"}
          canPostNow={Boolean(token)}
          busy={busy}
          progress={progress}
          onSave={onSave}
          onDelete={editingPost ? onDelete : undefined}
          onClose={() => setEditing(null)}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5 text-sm">
              {TABS.map((t) => {
                const count =
                  t.id === "queue" ? queue.length : t.id === "drafts" ? drafts.length : t.id === "posted" ? posted.length : 0;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    aria-pressed={tab === t.id}
                    className={chip(tab === t.id, t.id)}
                  >
                    {t.label}
                    {count > 0 && <span className="tabular-nums opacity-60"> {count}</span>}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                setFlash("");
                setEditing("new");
              }}
              className="rounded-full bg-foreground text-background px-5 py-2 text-sm hover:opacity-80 transition-opacity"
            >
              + New post
            </button>
          </div>

          {flash && <p className="text-sm">{flash}</p>}

          {!loaded ? (
            <p className="text-sm text-muted">Reading…</p>
          ) : tab === "calendar" ? (
            <Calendar posts={all} log={log} now={now} weekStart={weekStart} onWeek={setWeekStart} onOpen={setEditing} />
          ) : tab === "queue" ? (
            <List
              posts={queue}
              log={log}
              now={now}
              onOpen={setEditing}
              empty="Nothing in the queue. Write one and give it a date."
              heading={`Up next · ${thisWeek} in the next seven days`}
            />
          ) : tab === "drafts" ? (
            <List posts={drafts} log={log} now={now} onOpen={setEditing} empty="No drafts." heading="Drafts" />
          ) : tab === "posted" ? (
            <List
              posts={posted}
              log={log}
              now={now}
              onOpen={setEditing}
              empty="Nothing has gone out yet."
              heading="Posted"
            />
          ) : (
            <Analytics posts={all} log={log} busy={busy} onSaveMetrics={onSaveMetrics} />
          )}
        </>
      )}

      {/* The runner. */}
      <section className="card p-5 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-serif text-xl">The runner</h2>
          <p className="text-xs text-muted">
            {log.lastRun ? `Last looked ${ago(log.lastRun)}` : "Hasn't run yet"}
            {working ? " · running now" : ""}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          {NETWORKS.map((n) => {
            const h = log.health?.[n];
            return (
              <div key={n} className="inset px-3 py-2 flex items-center gap-2">
                <CircleLetter size="size-6">{RULES[n].mark}</CircleLetter>
                <span>{RULES[n].label}</span>
                <span className="ml-auto text-muted text-right" title={h?.note}>
                  {!h ? "not connected" : h.ok ? `ok · ${ago(h.at)}` : `trouble · ${ago(h.at)}`}
                </span>
              </div>
            );
          })}
        </div>
        {NETWORKS.some((n) => log.health?.[n] && !log.health[n]!.ok) && (
          <ul className="text-xs space-y-1">
            {NETWORKS.filter((n) => log.health?.[n] && !log.health[n]!.ok).map((n) => (
              <li key={n}>
                <span className="font-medium">{RULES[n].label}:</span> {log.health![n]!.note}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            disabled={!token || working}
            onClick={() => run("publish")}
            className={`${chip(false, "publish")} disabled:opacity-40`}
          >
            Post what is due
          </button>
          <button
            type="button"
            disabled={!token || working}
            onClick={() => run("metrics")}
            className={`${chip(false, "metrics")} disabled:opacity-40`}
          >
            Pull the numbers
          </button>
          <button type="button" onClick={reload} className="underline underline-offset-4 text-muted hover:text-foreground">
            Reload
          </button>
          {runs && runs[0] && (
            <a href={runs[0].html_url} target="_blank" rel="noreferrer" className="ml-auto underline underline-offset-4 text-muted hover:text-foreground">
              Last run on GitHub →
            </a>
          )}
        </div>
        <p className="text-xs text-muted leading-relaxed">
          It wakes every fifteen minutes on GitHub Actions and posts anything whose time
          has come. GitHub&apos;s own timer can run late in a busy hour; <em>Post now</em> and
          the button above start it this minute. The networks&apos; keys live only in the
          repo&apos;s Actions secrets — see <code>scripts/post-scheduler/README.md</code> to
          connect one.
        </p>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-serif text-xl">The token</h2>
        <TokenField token={token} onChange={(v) => tokenStore.set(v || null)} />
      </section>
    </Shell>
  );
}

/* ---------- pieces ---------- */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-5 md:px-6 pt-4 pb-2">
        <div className="card rounded-full px-5 py-3 flex items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-3">
            <CircleLetter size="size-8" className="text-xs">S</CircleLetter>
            <span className="font-serif italic text-lg">the Scheduler</span>
          </div>
          <nav className="flex items-center gap-5 text-xs">
            <Link href="/desk" className="accent-hover-text">the Desk</Link>
            <Link href="/postlab" className="accent-hover-text">the Post Lab</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 md:px-6 py-6 space-y-6 flex-1">
        {children}
      </main>
    </div>
  );
}

function List({
  posts,
  log,
  now,
  onOpen,
  empty,
  heading,
}: {
  posts: ScheduledPost[];
  log: LogData;
  now: number;
  onOpen: (id: string) => void;
  empty: string;
  heading: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-xl">{heading}</h2>
      {posts.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} log={log} now={now} onOpen={onOpen} withDay />
          ))}
        </div>
      )}
    </section>
  );
}

function Setup() {
  const [value, setValue] = useState("");
  return (
    <section className="card p-6 max-w-2xl space-y-4">
      <h2 className="font-serif italic text-xl">One-time setup</h2>
      <p className="text-sm text-muted leading-relaxed">
        Paste a GitHub token to open the Scheduler. It is kept in this browser only —
        nothing is stored on the server, exactly like the Desk and the Studio, and it is
        the same token they use.
      </p>
      <ol className="space-y-2 text-sm text-muted list-decimal pl-5 leading-relaxed">
        <li>GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</li>
        <li>Repository access: only <strong>{GH_REPO}</strong></li>
        <li>
          Permissions → Repository → <strong>Contents: Read and write</strong> (to save posts) and{" "}
          <strong>Actions: Read and write</strong> (for Post now)
        </li>
      </ol>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        type="password"
        placeholder="github_pat_…"
        className="w-full inset px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
      />
      <button
        type="button"
        onClick={() => value.trim() && tokenStore.set(value.trim())}
        className="rounded-full bg-foreground text-background px-5 py-2 text-sm hover:opacity-80 transition-opacity"
      >
        Save
      </button>
    </section>
  );
}

function TokenField({ token, onChange }: { token: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="block text-xs text-muted leading-relaxed">
        GitHub token for {GH_REPO}, kept in this browser only. Contents: Read and write
        to save a post, Actions: Read and write to start the runner from here.
      </label>
      <input
        type="password"
        value={token}
        onChange={(e) => onChange(e.target.value)}
        placeholder="github_pat_…"
        className="w-full inset px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
      />
    </div>
  );
}
