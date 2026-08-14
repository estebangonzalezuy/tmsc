"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FrameGrid, {
  LinkField,
  ProjectFields,
  SourceField,
} from "@/components/stills/FrameGrid";
import { commitFiles, readProjects } from "@/components/stills/github";
import {
  closeVideo,
  extractSuggested,
  extractTimes,
  openVideo,
  type LocalVideo,
} from "@/components/stills/localVideo";
import { frameSrc, slugify, timecode } from "@/lib/stills-shared";
import type { Frame, Project, StillsData } from "@/lib/stills-shared";

// One editor, for a project being made and a project being fixed.
//
// There used to be two: a browser one for a dropped file and a separate panel
// for whatever the runner had committed. Once the runner went, keeping them
// apart bought nothing and cost the obvious thing — a published project could
// have its title changed but never another frame, because cutting lived in the
// half that only new projects reached.
//
// So the difference is now one prop. Without `existing` this is a new project
// and the file is what starts it; with `existing` the frames come off the repo
// and attaching the file again is what lets you cut more. Everything after
// that — dropping, tagging, the cover, publishing — is one path.
//
// The video never leaves the machine either way. Only the frames that survive
// curation are committed, which is why a dropped frame leaves nothing behind.

const MAX_SENSIBLE_MB = 500;

type Stage =
  | { kind: "idle" }
  | { kind: "working"; label: string; done: number; total: number }
  | { kind: "error"; message: string }
  | { kind: "done"; message: string };

function StageLine({ stage }: { stage: Stage }) {
  if (stage.kind === "idle") return null;
  if (stage.kind === "working") {
    return (
      <div className="space-y-2">
        <p className="text-sm">
          {stage.label}… {stage.done}/{stage.total}
        </p>
        <div className="h-px w-full bg-line">
          <div
            className="h-px bg-foreground transition-all"
            style={{ width: `${(stage.done / Math.max(1, stage.total)) * 100}%` }}
          />
        </div>
      </div>
    );
  }
  if (stage.kind === "error") {
    return (
      <p
        role="alert"
        className="border border-line bg-foreground text-background px-4 py-3 text-sm"
      >
        {stage.message}
      </p>
    );
  }
  return <p className="text-sm">{stage.message}</p>;
}

export default function ProjectEditor({
  token,
  assetBase,
  existing,
  onPublished,
  onClose,
}: {
  token: string;
  assetBase: string;
  /** A project already committed to the repo. Absent when making a new one.
   *  The Curator gives this component a `key` per project, so switching
   *  projects remounts it and the state below starts fresh — no effect
   *  chasing a prop. */
  existing?: Project;
  onPublished: () => void;
  onClose?: () => void;
}) {
  const [video, setVideo] = useState<LocalVideo | null>(null);
  const [fileName, setFileName] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [count, setCount] = useState("18");

  const [draft, setDraft] = useState<Project | null>(
    existing ? structuredClone(existing) : null,
  );
  /** Blobs cut in this session, keyed by filename. A project reopened from the
   *  repo starts empty here: its existing frames are already committed.
   *
   *  These are kept after publishing, not cleared. Vercel takes a minute to
   *  deploy the commit, and dropping them would send the grid straight back to
   *  repo paths that 404 until it does — the frames you just published would
   *  blink out. `committed` is what stops them being uploaded twice. */
  const [files, setFiles] = useState<Map<string, Blob>>(new Map());
  const [committed, setCommitted] = useState<Set<string>>(new Set());
  const [dropped, setDropped] = useState<string[]>([]);
  const [activeFrame, setActiveFrame] = useState("");
  const [marks, setMarks] = useState<number[]>([]);

  const playerRef = useRef<HTMLVideoElement | null>(null);
  const urlsRef = useRef<Map<string, string>>(new Map());

  // Object URLs are a manual allocation; forty frames leak forty of them per
  // re-extraction if nobody hands them back.
  const releaseUrls = useCallback(() => {
    for (const url of urlsRef.current.values()) URL.revokeObjectURL(url);
    urlsRef.current.clear();
  }, []);
  useEffect(() => releaseUrls, [releaseUrls]);

  /* A frame is either a blob still sitting in this page or a file already in
     the repo, and the grid should not care which. */
  const srcFor = useCallback(
    (frame: Frame) => {
      const blob = files.get(frame.thumb ?? frame.file) ?? files.get(frame.file);
      if (!blob) {
        return draft ? frameSrc(assetBase, draft.id, frame, "thumb") : "";
      }
      const existingUrl = urlsRef.current.get(frame.id);
      if (existingUrl) return existingUrl;
      const url = URL.createObjectURL(blob);
      urlsRef.current.set(frame.id, url);
      return url;
    },
    [files, draft, assetBase],
  );

  const chooseFile = useCallback(
    async (file: File) => {
      if (video) closeVideo(video);
      setStage({ kind: "idle" });
      setFileName(file.name);
      if (file.size > MAX_SENSIBLE_MB * 1024 * 1024) {
        setStage({
          kind: "error",
          message: `That file is ${Math.round(file.size / 1024 / 1024)}MB. Nothing breaks, but scanning it will take a while — a 1080p export of the cut is plenty.`,
        });
      }
      try {
        setVideo(await openVideo(file));
      } catch (err) {
        setVideo(null);
        setStage({ kind: "error", message: (err as Error).message });
      }
    },
    [video],
  );

  const find = useCallback(async () => {
    if (!video) return;
    releaseUrls();
    try {
      const result = await extractSuggested(
        video,
        Number(count) || 18,
        (label, done, total) => setStage({ kind: "working", label, done, total }),
      );
      const title = fileName.replace(/\.[a-z0-9]+$/i, "");
      setFiles(result.files);
      setDropped([]);
      setDraft({
        id: slugify(title),
        title,
        credit: "",
        year: String(new Date().getFullYear()),
        note: "",
        tags: [],
        status: "draft",
        addedAt: new Date().toISOString().slice(0, 10),
        source: { url: "", platform: "other" },
        duration: Number(video.duration.toFixed(2)),
        width: video.width,
        height: video.height,
        cover: result.frames[Math.floor(result.frames.length / 3)]?.id,
        frames: result.frames,
      });
      setStage({
        kind: "done",
        message: `${result.frames.length} frames${result.rejected ? `, ${result.rejected} skipped as black or flat` : ""}. Nothing has left this browser yet.`,
      });
    } catch (err) {
      setStage({ kind: "error", message: (err as Error).message });
    }
  }, [video, count, fileName, releaseUrls]);

  const cutMarks = useCallback(async () => {
    if (!video || !draft || !marks.length) return;
    try {
      const wanted = marks.filter(
        (t) => !draft.frames.some((f) => Math.abs(f.t - t) < 0.05),
      );
      const result = await extractTimes(video, wanted, (label, done, total) =>
        setStage({ kind: "working", label, done, total }),
      );
      setFiles((current) => {
        const next = new Map(current);
        for (const [name, blob] of result.files) next.set(name, blob);
        return next;
      });
      setDraft((current) =>
        current
          ? {
              ...current,
              frames: [...current.frames, ...result.frames].sort(
                (a, b) => a.t - b.t,
              ),
            }
          : current,
      );
      setMarks([]);
      setStage({ kind: "done", message: `Cut ${result.frames.length} more.` });
    } catch (err) {
      setStage({ kind: "error", message: (err as Error).message });
    }
  }, [video, draft, marks]);

  const publish = useCallback(async () => {
    if (!draft) return;
    try {
      setStage({ kind: "working", label: "Reading the projects", done: 0, total: 1 });
      const fresh = await readProjects<StillsData>(token);

      const cleaned: Project = {
        ...draft,
        tags: draft.tags.map((t) => t.trim()).filter(Boolean),
        frames: draft.frames.filter((f) => !dropped.includes(f.id)),
      };
      if (!cleaned.frames.length) {
        setStage({
          kind: "error",
          message: "Every frame is dropped. Keep at least one.",
        });
        return;
      }
      if (!cleaned.frames.some((f) => f.id === cleaned.cover)) {
        cleaned.cover = cleaned.frames[0]?.id;
      }

      // A new project takes the next free name rather than overwriting a
      // curation that happens to share a title. A reopened one keeps its id,
      // which is its URL and its asset directory.
      if (!existing && fresh.data.projects.some((p) => p.id === cleaned.id)) {
        let n = 2;
        while (fresh.data.projects.some((p) => p.id === `${cleaned.id}-${n}`)) n++;
        cleaned.id = `${cleaned.id}-${n}`;
      }

      // Only frames that survived, and only the ones cut in this session —
      // everything else is already in the repo. A dropped frame was never
      // uploaded, so this leaves no orphans.
      const wanted = new Set<string>();
      for (const frame of cleaned.frames) {
        wanted.add(frame.file);
        if (frame.mid) wanted.add(frame.mid);
        if (frame.thumb) wanted.add(frame.thumb);
      }
      const binaries = new Map<string, Blob>();
      for (const [name, blob] of files) {
        if (wanted.has(name) && !committed.has(name)) {
          binaries.set(`public/stills/${cleaned.id}/${name}`, blob);
        }
      }

      const next: StillsData = {
        ...fresh.data,
        projects: fresh.data.projects.some((p) => p.id === cleaned.id)
          ? fresh.data.projects.map((p) => (p.id === cleaned.id ? cleaned : p))
          : [...fresh.data.projects, cleaned],
      };

      await commitFiles(token, {
        message: existing
          ? `Curate the Stills: ${cleaned.title}`
          : `Add ${cleaned.title} to the Stills`,
        text: {
          "content/stills/projects.json": JSON.stringify(next, null, 2) + "\n",
        },
        binaries,
        onProgress: (done, total) =>
          setStage({ kind: "working", label: "Uploading", done, total }),
      });

      setStage({
        kind: "done",
        message: binaries.size
          ? `Committed ${binaries.size} files. Vercel takes about a minute.`
          : "Published. Vercel takes about a minute.",
      });
      setCommitted((current) => {
        const next = new Set(current);
        for (const name of binaries.keys()) next.add(name.split("/").pop()!);
        return next;
      });
      setDropped([]);
      onPublished();
    } catch (err) {
      setStage({ kind: "error", message: (err as Error).message });
    }
  }, [draft, dropped, files, committed, token, existing, onPublished]);

  const remove = useCallback(async () => {
    if (!draft || !existing) return;
    if (
      !window.confirm(
        `Remove "${draft.title}" from the Stills? The images stay in the repo — run scripts/stills/prune.mjs to clear them.`,
      )
    ) {
      return;
    }
    try {
      setStage({ kind: "working", label: "Removing", done: 0, total: 1 });
      const fresh = await readProjects<StillsData>(token);
      await commitFiles(token, {
        message: `Remove ${draft.title} from the Stills`,
        text: {
          "content/stills/projects.json":
            JSON.stringify(
              {
                ...fresh.data,
                projects: fresh.data.projects.filter((p) => p.id !== draft.id),
              },
              null,
              2,
            ) + "\n",
        },
      });
      setStage({ kind: "done", message: "Removed." });
      onPublished();
      onClose?.();
    } catch (err) {
      setStage({ kind: "error", message: (err as Error).message });
    }
  }, [draft, existing, token, onPublished, onClose]);

  const kept = draft ? draft.frames.filter((f) => !dropped.includes(f.id)) : [];
  const busy = stage.kind === "working";

  return (
    <section className="border border-line p-5 space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-2xl">
          {existing ? draft?.title : "Add a project"}
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs underline underline-offset-4 hover:text-muted transition-colors"
          >
            Close
          </button>
        )}
      </div>

      {!existing && (
        <p className="max-w-2xl text-sm text-muted leading-relaxed">
          Drop in the video and your browser cuts the frames itself — nothing is
          uploaded, nothing runs on a server. Download the film however you
          normally would; any file your browser can play will do.
        </p>
      )}

      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <label className="flex-1">
          <span className="sr-only">
            {existing ? "Attach the video to cut more frames" : "Choose a video file"}
          </span>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) chooseFile(file);
            }}
            className="w-full border border-line bg-background px-4 py-3 text-sm file:mr-4 file:border file:border-line file:bg-background file:px-3 file:py-1 file:text-sm hover:file:bg-foreground hover:file:text-background file:transition-colors"
          />
        </label>
        {!existing && (
          <>
            <label className="flex items-center gap-2 text-xs text-muted">
              frames
              <input
                type="number"
                min={4}
                max={40}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="w-20 border border-line bg-background px-3 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
              />
            </label>
            <button
              onClick={find}
              disabled={!video || busy}
              className="border border-line px-6 py-3 text-sm hover:bg-foreground hover:text-background transition-colors disabled:opacity-40 disabled:hover:bg-background disabled:hover:text-foreground"
            >
              Find frames
            </button>
          </>
        )}
      </div>

      {existing && (
        <p className="text-xs text-muted">
          Attach the film again to cut more frames into this project. Everything
          else here can be changed without it.
        </p>
      )}
      {video && (
        <p className="text-xs text-muted">
          {fileName} · {video.width}×{video.height} · {timecode(video.duration)}
        </p>
      )}

      <StageLine stage={stage} />

      {draft && (
        <div className="space-y-5 border-t border-line pt-5">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm text-muted">
              /stills/{draft.id}
            </p>
            <span className="text-xs text-muted">
              {kept.length} of {draft.frames.length} frames kept
            </span>
          </div>

          <ProjectFields
            project={draft}
            onPatch={(changes) =>
              setDraft((c) => {
                if (!c) return c;
                const next = { ...c, ...changes };
                // The id is the URL and the asset directory. For a new project
                // nothing is uploaded yet so it can still follow the title; for
                // one already in the repo it is fixed, or the images would be
                // orphaned from the record that names them.
                if (!existing && changes.title !== undefined) {
                  next.id = slugify(changes.title);
                }
                return next;
              })
            }
          />

          <SourceField
            source={draft.source}
            onChange={(source) => setDraft((c) => (c ? { ...c, source } : c))}
          />

          <LinkField
            value={draft.link ?? ""}
            onChange={(link) => setDraft((c) => (c ? { ...c, link } : c))}
          />

          <FrameGrid
            frames={draft.frames}
            cover={draft.cover}
            dropped={dropped}
            activeFrame={activeFrame}
            srcFor={srcFor}
            onActivate={setActiveFrame}
            onToggleDrop={(id) =>
              setDropped((c) =>
                c.includes(id) ? c.filter((x) => x !== id) : [...c, id],
              )
            }
            onCover={(id) => setDraft((c) => (c ? { ...c, cover: id } : c))}
            onFrameChange={(id, changes) =>
              setDraft((c) =>
                c
                  ? {
                      ...c,
                      frames: c.frames.map((f) =>
                        f.id === id ? { ...f, ...changes } : f,
                      ),
                    }
                  : c,
              )
            }
          />

          {/* The film itself, not a contact sheet: it can be paused on any
              frame rather than on the nearest second, so a mark is exact. */}
          {video && (
            <div className="space-y-3 border-t border-line pt-5">
              <h3 className="font-serif text-xl">Find the ones it missed</h3>
              <p className="max-w-2xl text-sm text-muted leading-relaxed">
                Scrub the film and mark the compositions the scan walked past.
              </p>
              <video
                ref={playerRef}
                src={video.url}
                controls
                muted
                playsInline
                className="w-full border border-line bg-foreground/5"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    const t = playerRef.current?.currentTime;
                    if (typeof t === "number") {
                      setMarks((m) =>
                        m.some((x) => Math.abs(x - t) < 0.05)
                          ? m
                          : [...m, t].sort((a, b) => a - b),
                      );
                    }
                  }}
                  className="border border-line px-4 py-2 text-sm hover:bg-foreground hover:text-background transition-colors"
                >
                  Mark this moment
                </button>
                {marks.length > 0 && (
                  <>
                    <ul className="flex flex-wrap gap-2">
                      {marks.map((t, i) => (
                        <li
                          key={`${t}-${i}`}
                          className="flex items-center gap-2 border border-line px-2 py-1 text-xs"
                        >
                          <span className="tabular-nums">{t.toFixed(2)}s</span>
                          <button
                            onClick={() =>
                              setMarks((m) => m.filter((_, x) => x !== i))
                            }
                            aria-label={`Unmark ${timecode(t)}`}
                            className="text-muted hover:text-foreground"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={cutMarks}
                      disabled={busy}
                      className="border border-line px-4 py-2 text-sm hover:bg-foreground hover:text-background transition-colors disabled:opacity-40"
                    >
                      Cut {marks.length}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3 border-t border-line pt-5">
            {/* Publishing is the bottom of a long panel, and a message at the
                top of it is a message off the screen. */}
            <StageLine stage={stage} />
            {marks.length > 0 && (
              <p className="text-xs text-muted">
                {marks.length} marked{" "}
                {marks.length === 1 ? "moment has" : "moments have"} not been cut
                yet — publishing now leaves{" "}
                {marks.length === 1 ? "it" : "them"} behind.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.status === "published"}
                  onChange={(e) =>
                    setDraft((c) =>
                      c
                        ? {
                            ...c,
                            status: e.target.checked ? "published" : "draft",
                          }
                        : c,
                    )
                  }
                  className="accent-foreground"
                />
                On the wall
              </label>
              {files.size > committed.size && (
                <span className="text-xs text-muted">
                  {files.size - committed.size} new files to upload
                </span>
              )}
              {existing && (
                <button
                  onClick={remove}
                  className="text-xs text-muted underline underline-offset-4 hover:text-foreground transition-colors"
                >
                  Remove project
                </button>
              )}
              <button
                onClick={publish}
                disabled={busy || !token}
                className="ml-auto border border-line px-6 py-3 text-sm hover:bg-foreground hover:text-background transition-colors disabled:opacity-40"
              >
                {busy ? "Working…" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
