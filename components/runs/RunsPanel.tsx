"use client";

// the Desk — the club's control panel for the content cycle. Buttons that
// start the GitHub Actions jobs, and a live view of what's running, so the
// whole loop can be driven from a phone without opening GitHub.
//
// Zero-config like the Studio, and for the same reason: the token lives in
// the browser's localStorage and every call goes straight to api.github.com
// from the page. Nothing is stored on Vercel, no server route holds a
// secret, and the deployed app keeps needing no environment at all.

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const GH_REPO = "estebangonzalezuy/tmsc";
const WORKFLOW = "content-cycle.yml";
const TOKEN_KEY = "desk-github-token";

/* Notion's app.notion.com links open the native app on a phone, which is
   where this gets used. */
const NOTION = {
  journal: "https://app.notion.com/p/a1760675de4644978f03e1d158aa2817",
  pipeline: "https://app.notion.com/p/646f0309b2d34014904569d0ed95ad93",
  library: "https://app.notion.com/p/d368165d8fd54e548aea7eaecf27d9e7",
  objectives: "https://app.notion.com/p/d33ba4bc712b422f8bfecfb653a3507c",
};

type Job = {
  id: string;
  label: string;
  blurb: string;
  /** Roughly what it spends, so nothing is a surprise. */
  cost: string;
  /** Where the result shows up — the run finishes in Notion, not here. */
  lands: { href: string; name: string };
};

/* The four things worth a button. The rest of the jobs still exist on the
   command line and on their schedules; these are the ones you'd reach for
   standing in a kitchen. */
const JOBS: Job[] = [
  {
    id: "journal",
    label: "Make the journal posts",
    blurb:
      "Every Journal entry marked “Make post” becomes a finished post — draft, visual and all.",
    cost: "one call per entry",
    lands: { href: NOTION.pipeline, name: "the Pipeline" },
  },
  {
    id: "angles",
    label: "Give me three angles",
    blurb:
      "Reads everything the club has published and proposes three things to write next.",
    cost: "one call",
    lands: { href: NOTION.pipeline, name: "the Pipeline" },
  },
  {
    id: "now",
    label: "Finish what I chose",
    blurb:
      "Every Pipeline row marked “Chosen” gets its LinkedIn draft and its Post link, in one pass. Tick “Text on visual” on the row to put words on the image.",
    cost: "one call per row, two with text",
    lands: { href: NOTION.pipeline, name: "the Pipeline" },
  },
  {
    id: "queue",
    label: "Catch up",
    blurb:
      "Runs the whole queue once: journal, drafts, visuals, and files anything posted into the library.",
    cost: "nothing if the queue is empty",
    lands: { href: NOTION.pipeline, name: "the Pipeline" },
  },
];

type Run = {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
  name: string;
};

/* The saved token as a subscribable store, so the component can read
   browser-only state without a render-then-correct effect — and so saving
   or forgetting it updates every open tab. */
const listeners = new Set<() => void>();
const tokenStore = {
  get: () =>
    typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY),
  server: () => null,
  set(value: string | null) {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    window.addEventListener("storage", l);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", l);
    };
  },
};

const ghHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

/* Human words for GitHub's two-field status model. */
function runState(r: Run): { text: string; done: boolean; bad: boolean } {
  if (r.status !== "completed") {
    return { text: r.status === "queued" ? "waiting" : "running", done: false, bad: false };
  }
  if (r.conclusion === "success") return { text: "done", done: true, bad: false };
  if (r.conclusion === "cancelled") return { text: "cancelled", done: true, bad: false };
  return { text: r.conclusion ?? "failed", done: true, bad: true };
}

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

export default function RunsPanel() {
  const token = useSyncExternalStore(
    tokenStore.subscribe,
    tokenStore.get,
    tokenStore.server,
  );
  const [tokenInput, setTokenInput] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [checking, setChecking] = useState(false);

  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  /* The job you last started, so the page can point at where its result
     lands the moment it lands there. */
  const [started, setStarted] = useState<Job | null>(null);

  /** Refreshes the list; answers whether anything is still in flight. */
  const loadRuns = useCallback(async (t: string) => {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GH_REPO}/actions/workflows/${WORKFLOW}/runs?per_page=8`,
        { headers: ghHeaders(t), cache: "no-store" },
      );
      if (!res.ok) return false;
      const data = (await res.json()) as { workflow_runs: Run[] };
      const list = data.workflow_runs ?? [];
      setRuns(list);
      return list.some((r) => r.status !== "completed");
    } catch {
      /* offline or rate-limited; the next tick will catch up */
      return false;
    }
  }, []);

  /* Poll fast while a run is in flight, slowly when idle — a run takes about
     a minute, so this is the difference between watching and refreshing.
     Self-scheduling rather than setInterval so the cadence can change
     without tearing the timer down on every state update. */
  useEffect(() => {
    if (!token) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const live = await loadRuns(token);
      if (stopped) return;
      timer = setTimeout(tick, live ? 5000 : 30000);
    };
    timer = setTimeout(tick, 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [token, loadRuns]);

  async function saveToken() {
    const t = tokenInput.trim();
    if (!t) return setTokenError("Paste a token first.");
    setChecking(true);
    setTokenError("");
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GH_REPO}/actions/workflows/${WORKFLOW}`,
        { headers: ghHeaders(t), cache: "no-store" },
      );
      if (res.status === 401 || res.status === 403) {
        throw new Error("GitHub rejected the token.");
      }
      if (res.status === 404) {
        throw new Error(
          "That token can't see the workflow — it needs Actions: read and write on " +
            GH_REPO +
            ".",
        );
      }
      if (!res.ok) throw new Error(`GitHub said ${res.status}.`);
      tokenStore.set(t);
      setTokenInput("");
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setChecking(false);
    }
  }

  async function start(job: Job) {
    if (!token) return;
    setBusy(job.id);
    setFlash("");
    setStarted(null);
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GH_REPO}/actions/workflows/${WORKFLOW}/dispatches`,
        {
          method: "POST",
          headers: { ...ghHeaders(token), "Content-Type": "application/json" },
          body: JSON.stringify({ ref: "main", inputs: { job: job.id } }),
        },
      );
      if (!res.ok) throw new Error(`GitHub said ${res.status}`);
      setStarted(job);
      /* The run takes a moment to appear in the list. */
      setTimeout(() => loadRuns(token), 3000);
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Couldn't start it.");
    } finally {
      setBusy(null);
    }
  }

  function forget() {
    tokenStore.set(null);
    setRuns([]);
    setStarted(null);
  }

  const working = runs.some((r) => r.status !== "completed");

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-line px-5 py-3 flex items-center justify-between text-sm shrink-0">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center rounded-full border border-line size-8 text-xs">
            D
          </span>
          <span className="font-serif italic text-lg">the Desk</span>
        </div>
        <div className="flex items-center gap-5 text-xs">
          <Link href="/postlab" className="underline underline-offset-4">
            the Post Lab
          </Link>
          <Link href="/studio" className="underline underline-offset-4">
            the Studio
          </Link>
        </div>
      </header>

      {!token ? (
        <section className="mx-auto w-full max-w-lg px-5 py-12">
          <h1 className="font-serif italic text-2xl">One-time setup</h1>
          <p className="mt-4 text-sm text-muted leading-relaxed">
            Paste a GitHub token. It is kept in this browser only — nothing is
            stored on the server, exactly like the Studio.
          </p>
          <ol className="mt-6 space-y-2 text-sm text-muted list-decimal pl-5 leading-relaxed">
            <li>
              GitHub → Settings → Developer settings → Personal access tokens →
              Fine-grained tokens → Generate new token
            </li>
            <li>
              Repository access: only <strong>{GH_REPO}</strong>
            </li>
            <li>
              Permissions → Repository → <strong>Actions: Read and write</strong>
            </li>
          </ol>
          <input
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            type="password"
            placeholder="github_pat_…"
            className="mt-6 w-full border border-line px-3 py-2 text-sm bg-background"
          />
          {tokenError && <p className="mt-2 text-sm">{tokenError}</p>}
          <button
            onClick={saveToken}
            disabled={checking}
            className="mt-4 w-full border border-line px-4 py-3 text-sm hover:bg-foreground hover:text-background transition-colors disabled:opacity-40"
          >
            {checking ? "Checking…" : "Save"}
          </button>
        </section>
      ) : (
        <main className="mx-auto w-full max-w-2xl px-5 py-8 flex-1">
          <div className="grid gap-px bg-line border border-line">
            {JOBS.map((job) => (
              <button
                key={job.id}
                onClick={() => start(job)}
                disabled={busy !== null}
                className="bg-background text-left px-5 py-5 hover:bg-foreground hover:text-background transition-colors disabled:opacity-40 group"
              >
                <span className="flex items-baseline justify-between gap-4">
                  <span className="text-base">{job.label}</span>
                  <span className="text-xs opacity-60 shrink-0">
                    {busy === job.id ? "starting…" : job.cost}
                  </span>
                </span>
                <span className="mt-1 block text-sm opacity-60 leading-relaxed">
                  {job.blurb}
                </span>
              </button>
            ))}
          </div>

          {started && (
            <div className="mt-px border border-line border-t-0 px-5 py-4 flex items-center justify-between gap-4 text-sm">
              <span>
                {working
                  ? `${started.label} — running, about a minute.`
                  : `${started.label} — done.`}
              </span>
              <a
                href={started.lands.href}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 shrink-0"
              >
                Open {started.lands.name} →
              </a>
            </div>
          )}

          {flash && <p className="mt-4 text-sm">{flash}</p>}

          <h2 className="mt-10 text-xs uppercase tracking-widest text-muted underline underline-offset-4">
            Recent runs
          </h2>
          <ul className="mt-4 border-t border-line">
            {runs.length === 0 && (
              <li className="py-4 text-sm text-muted">Nothing yet.</li>
            )}
            {runs.map((r) => {
              const s = runState(r);
              return (
                <li
                  key={r.id}
                  className="border-b border-line py-3 flex items-center justify-between gap-4 text-sm"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span
                      aria-hidden
                      className={`size-2 rounded-full shrink-0 ${
                        s.done
                          ? s.bad
                            ? "bg-foreground"
                            : "border border-line"
                          : "bg-foreground animate-pulse"
                      }`}
                    />
                    <span className="truncate">{s.text}</span>
                  </span>
                  <span className="flex items-center gap-4 shrink-0 text-muted text-xs">
                    <span>{ago(r.created_at)}</span>
                    <a
                      href={r.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4"
                    >
                      log
                    </a>
                  </span>
                </li>
              );
            })}
          </ul>

          {/* Two maps side by side on a desk, stacked on a phone. */}
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <section>
              <h2 className="text-xs uppercase tracking-widest text-muted underline underline-offset-4">
                In Notion
              </h2>
              <ul className="mt-4 grid gap-px bg-line border border-line text-sm">
                {[
                  [NOTION.journal, "the Journal", "where a thought goes in"],
                  [NOTION.pipeline, "the Pipeline", "every post, start to finish"],
                  [NOTION.library, "the library", "everything published"],
                  [NOTION.objectives, "the Objectives", "what this month is for"],
                ].map(([href, name, what]) => (
                  <li key={name}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-background flex items-baseline justify-between gap-4 px-5 py-3 hover:bg-foreground hover:text-background transition-colors"
                    >
                      <span>{name}</span>
                      <span className="text-xs opacity-60 text-right">{what}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-xs uppercase tracking-widest text-muted underline underline-offset-4">
                On the site
              </h2>
              <ul className="mt-4 grid gap-px bg-line border border-line text-sm">
                {[
                  ["/postlab", "the Post Lab", "open a Post link, tweak, export"],
                  ["/studio", "the Studio", "the site's own words"],
                  ["/hub", "the Hub", "everything tMSC, in one list"],
                ].map(([href, name, what]) => (
                  <li key={name}>
                    <Link
                      href={href}
                      className="bg-background flex items-baseline justify-between gap-4 px-5 py-3 hover:bg-foreground hover:text-background transition-colors"
                    >
                      <span>{name}</span>
                      <span className="text-xs opacity-60 text-right">{what}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <p className="mt-10 text-xs text-muted leading-relaxed">
            Results land in Notion, not here. A run takes about a minute.
          </p>
          <button
            onClick={forget}
            className="mt-4 text-xs text-muted underline underline-offset-4"
          >
            Forget the token on this device
          </button>
        </main>
      )}
    </div>
  );
}
