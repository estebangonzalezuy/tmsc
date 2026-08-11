"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  GH_REPO,
  checkAccess,
  dispatchExtract,
  listRuns,
  readProjects,
  tokenStore,
  writeProjects,
  type Access,
  type Run,
} from "@/components/stills/github";
import Scrubber from "@/components/stills/Scrubber";
import LocalExtractor from "@/components/stills/LocalExtractor";
import FrameGrid, {
  ProjectFields,
  SourceField,
  inputClass,
} from "@/components/stills/FrameGrid";
import { frameSrc, timecode } from "@/lib/stills-shared";
import type { Frame, Project, StillsData } from "@/lib/stills-shared";

// the Curator — where a video becomes a curated project.
//
// The loop it exists to close:
//   1. Paste a URL. That starts the extractor in GitHub Actions, which
//      downloads the video, suggests frames by scene detection, and builds
//      the scrub sheets.
//   2. Go through the suggestions and drop the ones that aren't style frames.
//   3. Scrub the whole film for the moments the machine missed, mark them,
//      and run the second pass to cut them at full size.
//   4. Name it, credit it, tag it, publish. Published is what the wall shows.
//
// Zero-config like the Studio and the Desk: the token lives in the browser,
// every call goes straight to api.github.com, and nothing on Vercel holds a
// secret. Internal, so it is not in the nav and it is not indexed.

const EMPTY: StillsData = { version: 1, assetBase: "/stills", projects: [] };

type Status =
  | { kind: "idle" }
  | { kind: "busy"; what: string }
  | { kind: "done"; what: string }
  | { kind: "error"; message: string };

export default function Curator() {
  const token =
    useSyncExternalStore(
      tokenStore.subscribe,
      tokenStore.get,
      tokenStore.server,
    ) ?? "";
  const [data, setData] = useState<StillsData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [runs, setRuns] = useState<Run[]>([]);
  const [access, setAccess] = useState<Access | null>(null);

  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Project | null>(null);
  const [dropped, setDropped] = useState<string[]>([]);
  const [marks, setMarks] = useState<number[]>([]);
  const [activeFrame, setActiveFrame] = useState("");

  const [newUrl, setNewUrl] = useState("");
  const [newCount, setNewCount] = useState("18");

  const saveToken = useCallback((value: string) => {
    tokenStore.set(value || null);
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setStatus({ kind: "busy", what: "Reading the projects" });
      try {
        const result = await readProjects<StillsData>(token);
        setData(result.data);
        setLoaded(true);
        if (!silent) setStatus({ kind: "idle" });
      } catch (err) {
        setStatus({ kind: "error", message: (err as Error).message });
      }
    },
    [token],
  );

  const verifyAccess = useCallback(async () => {
    if (!token) return;
    try {
      setAccess(await checkAccess(token));
    } catch {
      // Not being able to ask is not the same as being told no; publishing
      // will report the truth either way.
      setAccess(null);
    }
  }, [token]);

  const refreshRuns = useCallback(async () => {
    if (!token) return;
    try {
      setRuns(await listRuns(token));
    } catch {
      // The run list is a convenience. A failure here should never take the
      // editor down with it.
    }
  }, [token]);

  // Deferred to a timeout rather than run in the effect body: the first read
  // is a network call, and setting state synchronously while the effect runs
  // just cascades a render for nothing.
  useEffect(() => {
    if (!token) return;
    const id = window.setTimeout(() => {
      load();
      refreshRuns();
      verifyAccess();
    }, 0);
    return () => window.clearTimeout(id);
  }, [token, load, refreshRuns, verifyAccess]);

  // Poll only while something is actually running.
  const running = runs.some((r) => r.status !== "completed");
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(refreshRuns, 10000);
    return () => window.clearInterval(id);
  }, [running, refreshRuns]);

  // Selecting a project takes a working copy. Everything is edited locally
  // and nothing reaches GitHub until Publish.
  const selectProject = useCallback(
    (id: string) => {
      const project = data.projects.find((p) => p.id === id);
      setSelectedId(id);
      setDraft(project ? structuredClone(project) : null);
      setDropped([]);
      setMarks([]);
      setActiveFrame("");
    },
    [data.projects],
  );

  const kept = useMemo(
    () => draft?.frames.filter((f) => !dropped.includes(f.id)) ?? [],
    [draft, dropped],
  );

  const patch = useCallback((changes: Partial<Project>) => {
    setDraft((current) => (current ? { ...current, ...changes } : current));
  }, []);

  const patchFrame = useCallback((id: string, changes: Partial<Frame>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            frames: current.frames.map((f) =>
              f.id === id ? { ...f, ...changes } : f,
            ),
          }
        : current,
    );
  }, []);

  const startExtraction = useCallback(async () => {
    if (!newUrl.trim()) return;
    setStatus({ kind: "busy", what: "Starting the extractor" });
    try {
      await dispatchExtract(token, { url: newUrl.trim(), count: newCount });
      setNewUrl("");
      setStatus({
        kind: "done",
        what: "Extractor started. It takes a few minutes, then reload.",
      });
      setTimeout(refreshRuns, 3000);
    } catch (err) {
      setStatus({ kind: "error", message: (err as Error).message });
    }
  }, [token, newUrl, newCount, refreshRuns]);

  const extractMarks = useCallback(async () => {
    if (!draft || !marks.length) return;
    setStatus({ kind: "busy", what: "Cutting the marked frames" });
    try {
      await dispatchExtract(token, {
        url: draft.source.url,
        id: draft.id,
        times: marks.map((m) => m.toFixed(2)).join(","),
      });
      setMarks([]);
      setStatus({
        kind: "done",
        what: `Cutting ${marks.length} frames. Publish your edits first — the run rewrites this file.`,
      });
      setTimeout(refreshRuns, 3000);
    } catch (err) {
      setStatus({ kind: "error", message: (err as Error).message });
    }
  }, [token, draft, marks, refreshRuns]);

  const publish = useCallback(async () => {
    if (!draft) return;
    setStatus({ kind: "busy", what: "Publishing" });
    try {
      // Re-read first: the extractor pushes to the same file, and a run that
      // finished while you were curating must not be overwritten.
      const fresh = await readProjects<StillsData>(token);
      const cleaned: Project = {
        ...draft,
        tags: draft.tags.map((t) => t.trim()).filter(Boolean),
        frames: draft.frames.filter((f) => !dropped.includes(f.id)),
      };
      if (!cleaned.frames.some((f) => f.id === cleaned.cover)) {
        cleaned.cover = cleaned.frames[0]?.id;
      }
      const next: StillsData = {
        ...fresh.data,
        projects: fresh.data.projects.map((p) =>
          p.id === cleaned.id ? cleaned : p,
        ),
      };
      await writeProjects(
        token,
        next,
        fresh.sha,
        `Curate the Stills: ${cleaned.title}`,
      );
      setData(next);
      setDropped([]);
      setDraft(structuredClone(cleaned));
      setStatus({
        kind: "done",
        what: "Published. Vercel takes about a minute to put it on the wall.",
      });
    } catch (err) {
      setStatus({ kind: "error", message: (err as Error).message });
    }
  }, [token, draft, dropped]);

  const removeProject = useCallback(async () => {
    if (!draft) return;
    if (
      !window.confirm(
        `Remove "${draft.title}" from the Stills? The images stay in the repo — run scripts/stills/prune.mjs to clear them.`,
      )
    ) {
      return;
    }
    setStatus({ kind: "busy", what: "Removing" });
    try {
      const fresh = await readProjects<StillsData>(token);
      const next: StillsData = {
        ...fresh.data,
        projects: fresh.data.projects.filter((p) => p.id !== draft.id),
      };
      await writeProjects(
        token,
        next,
        fresh.sha,
        `Remove ${draft.title} from the Stills`,
      );
      setData(next);
      setSelectedId("");
      setDraft(null);
      setStatus({ kind: "done", what: "Removed." });
    } catch (err) {
      setStatus({ kind: "error", message: (err as Error).message });
    }
  }, [token, draft]);

  /* ---------- render ---------- */

  if (!token) {
    return (
      <Shell>
        <TokenField token={token} onChange={saveToken} />
      </Shell>
    );
  }

  const drafts = data.projects.filter((p) => p.status === "draft");
  const published = data.projects.filter((p) => p.status === "published");
  const selected = draft;

  return (
    <Shell>
      <StatusLine status={status} />

      {access && !access.canWrite && (
        <p
          role="alert"
          className="border border-line bg-foreground text-background px-4 py-3 text-sm leading-relaxed"
        >
          {access.problem}{" "}
          <button
            onClick={verifyAccess}
            className="underline underline-offset-4"
          >
            Check again
          </button>
        </p>
      )}

      <LocalExtractor
        token={token}
        assetBase={data.assetBase}
        onPublished={() => load(true)}
      />

      <section className="border border-line p-5 space-y-4">
        <h2 className="font-serif text-2xl">Or fetch one by link</h2>
        <p className="text-sm text-muted leading-relaxed">
          For when you don&rsquo;t have the file. A runner downloads it with
          yt-dlp and cuts the frames there — a few minutes, and it lands as a
          draft below. Vimeo and direct .mp4 links are reliable; YouTube
          usually refuses GitHub&rsquo;s servers unless the{" "}
          <code>YTDLP_COOKIES</code> secret is set, so for YouTube the drop-in
          above is the shorter road.
        </p>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://vimeo.com/… or https://…/film.mp4"
            className="flex-1 border border-line bg-background px-4 py-3 text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground"
          />
          <label className="flex items-center gap-2 text-xs text-muted">
            frames
            <input
              type="number"
              min={4}
              max={40}
              value={newCount}
              onChange={(e) => setNewCount(e.target.value)}
              className="w-20 border border-line bg-background px-3 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </label>
          <button
            onClick={startExtraction}
            disabled={!newUrl.trim() || status.kind === "busy"}
            className="border border-line px-6 py-3 text-sm hover:bg-foreground hover:text-background transition-colors disabled:opacity-40 disabled:hover:bg-background disabled:hover:text-foreground"
          >
            Extract
          </button>
        </div>
      </section>

      <RunList runs={runs} onRefresh={refreshRuns} />

      <section className="border border-line p-5 space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-2xl">Projects</h2>
          <button
            onClick={() => load()}
            className="text-xs underline underline-offset-4 hover:text-muted transition-colors"
          >
            Reload
          </button>
        </div>
        {!loaded ? (
          <p className="text-sm text-muted">Reading…</p>
        ) : data.projects.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing yet. Drop in a video above, or fetch one by link.
          </p>
        ) : (
          <div className="space-y-4">
            <ProjectRow
              label="Drafts"
              projects={drafts}
              selectedId={selectedId}
              onSelect={selectProject}
            />
            <ProjectRow
              label="On the wall"
              projects={published}
              selectedId={selectedId}
              onSelect={selectProject}
            />
          </div>
        )}
      </section>

      {selected && (
        <>
          <section className="border border-line p-5 space-y-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-serif text-2xl">{selected.title}</h2>
              <span className="text-xs text-muted">
                {kept.length} of {selected.frames.length} frames kept
              </span>
            </div>

            <ProjectFields project={selected} onPatch={patch} />

            <SourceField
              source={selected.source}
              onChange={(source) => patch({ source })}
            />

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.status === "published"}
                  onChange={(e) =>
                    patch({ status: e.target.checked ? "published" : "draft" })
                  }
                  className="accent-foreground"
                />
                On the wall
              </label>
              <a
                href={selected.source.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline underline-offset-4 hover:text-muted transition-colors"
              >
                Source →
              </a>
              {selected.status === "published" && (
                <Link
                  href={`/stills/${selected.id}`}
                  target="_blank"
                  className="text-xs underline underline-offset-4 hover:text-muted transition-colors"
                >
                  Its page →
                </Link>
              )}
              <div className="ml-auto flex items-center gap-4">
                <button
                  onClick={removeProject}
                  className="text-xs text-muted underline underline-offset-4 hover:text-foreground transition-colors"
                >
                  Remove project
                </button>
                <button
                  onClick={publish}
                  disabled={status.kind === "busy"}
                  className="border border-line px-6 py-3 text-sm hover:bg-foreground hover:text-background transition-colors disabled:opacity-40"
                >
                  Publish
                </button>
              </div>
            </div>
          </section>

          <section className="border border-line p-5 space-y-5">
            <div>
              <h2 className="font-serif text-2xl">The frames</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted leading-relaxed">
                Drop what isn&apos;t a style frame. Click one to tag it or make
                it the cover. Images appear once Vercel has deployed the
                extractor&apos;s commit.
              </p>
            </div>
            <FrameGrid
              frames={selected.frames}
              cover={selected.cover}
              dropped={dropped}
              activeFrame={activeFrame}
              srcFor={(frame) =>
                frameSrc(data.assetBase, selected.id, frame, "thumb")
              }
              onActivate={setActiveFrame}
              onToggleDrop={(id) =>
                setDropped((current) =>
                  current.includes(id)
                    ? current.filter((x) => x !== id)
                    : [...current, id],
                )
              }
              onCover={(id) => patch({ cover: id })}
              onFrameChange={patchFrame}
            />
          </section>

          {selected.scrub ? (
            <section className="border border-line p-5 space-y-5">
              <div>
                <h2 className="font-serif text-2xl">Find the ones it missed</h2>
                <p className="mt-2 max-w-2xl text-sm text-muted leading-relaxed">
                  Scene detection finds cuts, not compositions. Scrub the film,
                  mark what it skipped, and cut those moments at full size.
                </p>
              </div>
              <Scrubber
                projectId={selected.id}
                assetBase={data.assetBase}
                scrub={selected.scrub}
                duration={selected.duration}
                marks={marks}
                onMark={(t) => setMarks((m) => [...m, t].sort((a, b) => a - b))}
                onUnmark={(t) =>
                  setMarks((m) => m.filter((x) => Math.floor(x) !== Math.floor(t)))
                }
              />
              <MarkList
                marks={marks}
                duration={selected.duration}
                onNudge={(index, delta) =>
                  setMarks((m) =>
                    m
                      .map((t, i) =>
                        i === index
                          ? Math.min(selected.duration, Math.max(0, t + delta))
                          : t,
                      )
                      .sort((a, b) => a - b),
                  )
                }
                onRemove={(index) =>
                  setMarks((m) => m.filter((_, i) => i !== index))
                }
                onExtract={extractMarks}
                busy={status.kind === "busy"}
              />
            </section>
          ) : (
            <section className="border border-line p-5">
              <p className="text-sm text-muted">
                No scrub sheets for this project — it predates them, or the run
                that built it failed partway. Extract it again to get them.
              </p>
            </section>
          )}
        </>
      )}

      <section className="border border-line p-5 space-y-3">
        <h2 className="font-serif text-xl">The token</h2>
        <TokenField token={token} onChange={saveToken} />
      </section>
    </Shell>
  );
}

/* ---------- pieces ---------- */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line px-5 md:px-6 py-4 flex items-baseline justify-between gap-4">
        <p className="text-sm underline underline-offset-4">the Curator</p>
        <nav className="flex items-center gap-5 text-xs text-muted">
          <Link href="/stills" className="hover:text-foreground transition-colors">
            the Stills
          </Link>
          <Link href="/desk" className="hover:text-foreground transition-colors">
            the Desk
          </Link>
          <Link href="/studio" className="hover:text-foreground transition-colors">
            the Studio
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-5 md:px-6 py-10 space-y-6">
        {children}
      </main>
    </div>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (status.kind === "idle") return null;
  return (
    <p
      className={`border border-line px-4 py-3 text-sm ${
        status.kind === "error" ? "bg-foreground text-background" : ""
      }`}
    >
      {status.kind === "busy" && `${status.what}…`}
      {status.kind === "done" && status.what}
      {status.kind === "error" && status.message}
    </p>
  );
}

function TokenField({
  token,
  onChange,
}: {
  token: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs text-muted">
        GitHub token for {GH_REPO}, kept in this browser only. It needs two
        repository permissions: <strong>Contents: Read and write</strong> to
        commit frames, and <strong>Actions: Read and write</strong> to fetch a
        video by link. A token made for the Desk only has the second.
      </label>
      <input
        type="password"
        value={token}
        onChange={(e) => onChange(e.target.value)}
        placeholder="github_pat_…"
        className={inputClass}
      />
    </div>
  );
}

function RunList({
  runs,
  onRefresh,
}: {
  runs: Run[];
  onRefresh: () => void;
}) {
  if (!runs.length) return null;
  return (
    <section className="border border-line p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-xl">Runs</h2>
        <button
          onClick={onRefresh}
          className="text-xs underline underline-offset-4 hover:text-muted transition-colors"
        >
          Refresh
        </button>
      </div>
      <ul className="divide-y divide-line/30 text-sm">
        {runs.map((run) => {
          const failed = run.conclusion === "failure";
          return (
            <li
              key={run.id}
              className="flex items-baseline justify-between gap-4 py-2"
            >
              <a
                href={run.html_url}
                target="_blank"
                rel="noreferrer"
                className="truncate hover:underline underline-offset-4"
              >
                {run.display_title}
              </a>
              {/* A bare "failure" tells you nothing you can act on, and the
                  reason only ever lives in the log. Make the word the way in. */}
              <a
                href={run.html_url}
                target="_blank"
                rel="noreferrer"
                className={`shrink-0 text-xs underline underline-offset-4 ${
                  failed ? "" : "text-muted"
                }`}
              >
                {run.status === "completed" ? run.conclusion : run.status}
                {failed && " — read the log"}
              </a>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted leading-relaxed">
        A YouTube link that fails with &ldquo;sign in to confirm you&rsquo;re
        not a bot&rdquo; is YouTube turning away GitHub&rsquo;s servers, not a
        broken video. Use a Vimeo link, or add the{" "}
        <code>YTDLP_COOKIES</code> secret — see docs/THE-STILLS.md.
      </p>
    </section>
  );
}

function ProjectRow({
  label,
  projects,
  selectedId,
  onSelect,
}: {
  label: string;
  projects: Project[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (!projects.length) return null;
  return (
    <div className="grid md:grid-cols-[7rem_1fr] gap-2 md:gap-4 items-baseline">
      <p className="text-xs text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {projects.map((project) => {
          const on = project.id === selectedId;
          return (
            <button
              key={project.id}
              onClick={() => onSelect(project.id)}
              aria-pressed={on}
              className={`border border-line rounded-full px-3 py-1 text-xs transition-colors ${
                on
                  ? "bg-foreground text-background"
                  : "hover:bg-foreground hover:text-background"
              }`}
            >
              {project.title}{" "}
              <span className={on ? "text-background/60" : "text-muted"}>
                {project.frames.length}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MarkList({
  marks,
  duration,
  onNudge,
  onRemove,
  onExtract,
  busy,
}: {
  marks: number[];
  duration: number;
  onNudge: (index: number, delta: number) => void;
  onRemove: (index: number) => void;
  onExtract: () => void;
  busy: boolean;
}) {
  if (!marks.length) {
    return (
      <p className="text-xs text-muted">
        Nothing marked yet. The scrubber steps a second at a time over{" "}
        {timecode(duration)}.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-2">
        {marks.map((t, i) => (
          <li
            key={`${t}-${i}`}
            className="flex items-center gap-1 border border-line px-2 py-1 text-xs"
          >
            {/* The sheets are one tile a second, so a mark lands on a whole
                second. A quarter either way is usually the difference between
                the cut and the composition. */}
            <button
              onClick={() => onNudge(i, -0.25)}
              aria-label={`Quarter second earlier than ${timecode(t)}`}
              className="hover:text-muted"
            >
              −
            </button>
            <span className="tabular-nums">{t.toFixed(2)}s</span>
            <button
              onClick={() => onNudge(i, 0.25)}
              aria-label={`Quarter second later than ${timecode(t)}`}
              className="hover:text-muted"
            >
              +
            </button>
            <button
              onClick={() => onRemove(i)}
              aria-label={`Unmark ${timecode(t)}`}
              className="ml-1 text-muted hover:text-foreground"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={onExtract}
        disabled={busy}
        className="border border-line px-6 py-3 text-sm hover:bg-foreground hover:text-background transition-colors disabled:opacity-40"
      >
        Cut {marks.length} {marks.length === 1 ? "frame" : "frames"}
      </button>
    </div>
  );
}
