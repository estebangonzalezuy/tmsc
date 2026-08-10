"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FrameGrid, {
  Field,
  ProjectFields,
  inputClass,
} from "@/components/stills/FrameGrid";
import { commitFiles, readProjects } from "@/components/stills/github";
import {
  closeVideo,
  extractSuggested,
  extractTimes,
  openVideo,
  type LocalVideo,
} from "@/components/stills/localVideo";
import { slugify } from "@/lib/stills-select.mjs";
import { timecode } from "@/lib/stills-shared";
import type { Frame, Project, StillsData } from "@/lib/stills-shared";

// Drop in a video, get a project. No runner, no yt-dlp, no cookies, no upload.
//
// This is the path that exists because the other one keeps being refused:
// YouTube challenges GitHub's servers as datacentre traffic, and no amount of
// cleverness in the workflow reliably talks it out of that. A file you
// already have has no such opinion. The browser decodes it, cuts the frames,
// builds the scrubber, and commits the result — the video itself never leaves
// the machine, only the frames you decided to keep.
//
// It is also the only path that works for a site the extractor can't parse, a
// private link, a client's review copy, or your own export.

const MAX_SENSIBLE_MB = 500;

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

type Stage =
  | { kind: "idle" }
  | { kind: "working"; label: string; done: number; total: number }
  | { kind: "error"; message: string }
  | { kind: "done"; message: string };

export default function LocalExtractor({
  token,
  assetBase,
  onPublished,
}: {
  token: string;
  assetBase: string;
  onPublished: () => void;
}) {
  const [video, setVideo] = useState<LocalVideo | null>(null);
  const [fileName, setFileName] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [count, setCount] = useState("18");

  const [draft, setDraft] = useState<Project | null>(null);
  const [files, setFiles] = useState<Map<string, Blob>>(new Map());
  const [dropped, setDropped] = useState<string[]>([]);
  const [activeFrame, setActiveFrame] = useState("");
  const [marks, setMarks] = useState<number[]>([]);

  const playerRef = useRef<HTMLVideoElement | null>(null);
  const urlsRef = useRef<Map<string, string>>(new Map());

  // Object URLs are a manual allocation; a project of forty frames leaks
  // forty of them per re-extraction if nobody hands them back.
  const srcFor = useCallback(
    (frame: Frame) => {
      const existing = urlsRef.current.get(frame.id);
      if (existing) return existing;
      const blob = files.get(frame.thumb ?? frame.file) ?? files.get(frame.file);
      if (!blob) return "";
      const url = URL.createObjectURL(blob);
      urlsRef.current.set(frame.id, url);
      return url;
    },
    [files],
  );

  const releaseUrls = useCallback(() => {
    for (const url of urlsRef.current.values()) URL.revokeObjectURL(url);
    urlsRef.current.clear();
  }, []);

  useEffect(() => releaseUrls, [releaseUrls]);

  const reset = useCallback(() => {
    releaseUrls();
    setDraft(null);
    setFiles(new Map());
    setDropped([]);
    setMarks([]);
    setActiveFrame("");
  }, [releaseUrls]);

  const chooseFile = useCallback(
    async (file: File) => {
      if (video) closeVideo(video);
      reset();
      setStage({ kind: "idle" });
      setFileName(file.name);
      if (file.size > MAX_SENSIBLE_MB * 1024 * 1024) {
        setStage({
          kind: "error",
          message: `That file is ${Math.round(file.size / 1024 / 1024)}MB. Nothing breaks, but scanning it will take a while — a 1080p export of the cut is plenty.`,
        });
      }
      try {
        const opened = await openVideo(file);
        setVideo(opened);
      } catch (err) {
        setVideo(null);
        setStage({ kind: "error", message: (err as Error).message });
      }
    },
    [video, reset],
  );

  const find = useCallback(async () => {
    if (!video) return;
    reset();
    try {
      const result = await extractSuggested(
        video,
        Number(count) || 18,
        (label, done, total) => setStage({ kind: "working", label, done, total }),
      );
      const title = fileName.replace(/\.[a-z0-9]+$/i, "");
      setFiles(result.files);
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
        scrub: result.scrub,
        frames: result.frames,
      });
      setStage({
        kind: "done",
        message: `${result.frames.length} frames${result.rejected ? `, ${result.rejected} skipped as black or flat` : ""}. Nothing has left this browser yet.`,
      });
    } catch (err) {
      setStage({ kind: "error", message: (err as Error).message });
    }
  }, [video, count, fileName, reset]);

  const cutMarks = useCallback(async () => {
    if (!video || !draft || !marks.length) return;
    try {
      const fresh = marks.filter(
        (t) => !draft.frames.some((f) => Math.abs(f.t - t) < 0.05),
      );
      const result = await extractTimes(video, fresh, (label, done, total) =>
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

      const keptFrames = draft.frames.filter((f) => !dropped.includes(f.id));
      const cleaned: Project = {
        ...draft,
        tags: draft.tags.map((t) => t.trim()).filter(Boolean),
        frames: keptFrames,
      };
      if (!cleaned.frames.some((f) => f.id === cleaned.cover)) {
        cleaned.cover = cleaned.frames[0]?.id;
      }
      if (!cleaned.frames.length) {
        setStage({ kind: "error", message: "Every frame is dropped. Keep at least one." });
        return;
      }

      // A local extraction is always a new project. If the title slugs to one
      // that already exists, take the next free name rather than overwriting
      // somebody's curation with this one.
      if (fresh.data.projects.some((p) => p.id === cleaned.id)) {
        let n = 2;
        while (fresh.data.projects.some((p) => p.id === `${cleaned.id}-${n}`)) n++;
        cleaned.id = `${cleaned.id}-${n}`;
      }

      // Only the frames that survived get uploaded. A dropped frame was never
      // committed in the first place, so this path leaves no orphans behind —
      // unlike the Actions one, which cuts before anybody has judged.
      const wanted = new Set<string>();
      for (const frame of cleaned.frames) {
        wanted.add(frame.file);
        if (frame.thumb) wanted.add(frame.thumb);
      }
      for (const name of cleaned.scrub?.files ?? []) wanted.add(name);

      const binaries = new Map<string, Blob>();
      for (const [name, blob] of files) {
        if (wanted.has(name)) {
          binaries.set(`public/stills/${cleaned.id}/${name}`, blob);
        }
      }

      const next: StillsData = {
        ...fresh.data,
        projects: [...fresh.data.projects, cleaned],
      };

      await commitFiles(token, {
        message: `Add ${cleaned.title} to the Stills`,
        text: {
          "content/stills/projects.json": JSON.stringify(next, null, 2) + "\n",
        },
        binaries,
        onProgress: (done, total) =>
          setStage({ kind: "working", label: "Uploading", done, total }),
      });

      setStage({
        kind: "done",
        message: `Committed ${binaries.size} files. Vercel takes about a minute; then it's in the Projects list below and on the wall if you marked it published.`,
      });
      onPublished();
    } catch (err) {
      setStage({ kind: "error", message: (err as Error).message });
    }
  }, [draft, dropped, files, token, onPublished]);

  const kept = draft ? draft.frames.filter((f) => !dropped.includes(f.id)) : [];
  const busy = stage.kind === "working";

  return (
    <section className="border border-line p-5 space-y-5">
      <div>
        <h2 className="font-serif text-2xl">Drop in a video</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted leading-relaxed">
          The fastest way, and the one that always works. Your browser cuts the
          frames itself — nothing is uploaded, nothing runs on a server, and
          YouTube never gets a say. Use it for a file you have: a download, a
          client copy, your own export.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <label className="flex-1">
          <span className="sr-only">Choose a video file</span>
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
      </div>

      {video && (
        <p className="text-xs text-muted">
          {fileName} · {video.width}×{video.height} · {timecode(video.duration)}
        </p>
      )}

      <StageLine stage={stage} />

      {draft && video && (
        <div className="space-y-5 border-t border-line pt-5">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-serif text-xl">{draft.title}</h3>
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
                // The id is the URL and the asset directory, and nothing has
                // been uploaded yet, so it can still follow the title. A file
                // called final_v3.mp4 should not become /stills/final-v3.
                if (changes.title !== undefined) next.id = slugify(changes.title);
                return next;
              })
            }
          />

          {/* A curated frame has to be checkable against the thing it came
              from, and a local file has no address. Without this the wall
              would carry a still nobody can trace. */}
          <Field label="Source link — where this video lives, so every frame can point back">
            <input
              value={draft.source.url}
              onChange={(e) =>
                setDraft((c) =>
                  c
                    ? {
                        ...c,
                        source: {
                          ...c.source,
                          url: e.target.value,
                          platform: /youtu/.test(e.target.value)
                            ? "youtube"
                            : /vimeo/.test(e.target.value)
                              ? "vimeo"
                              : "other",
                          videoId:
                            e.target.value.match(
                              /(?:v=|youtu\.be\/|vimeo\.com\/)([A-Za-z0-9_-]+)/,
                            )?.[1] ?? undefined,
                        },
                      }
                    : c,
                )
              }
              placeholder="https://vimeo.com/… or https://framerate.tv/…"
              className={inputClass}
            />
          </Field>

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

          {/* While the file is open there is no reason to scrub a sprite
              sheet: the real video is right here, and it can be paused on any
              frame rather than on the nearest second. */}
          <div className="space-y-3 border-t border-line pt-5">
            <h3 className="font-serif text-xl">Find the ones it missed</h3>
            <p className="max-w-2xl text-sm text-muted leading-relaxed">
              Scrub the film and mark the compositions the scan walked past.
              Pause anywhere — this is the video itself, not a contact sheet,
              so a mark is exact.
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

          <div className="space-y-3 border-t border-line pt-5">
            {/* Publishing is the bottom of a long panel, and a message at the
                top of it is a message off the screen. Whatever the state is,
                it belongs next to the button that caused it. */}
            <StageLine stage={stage} />
            {marks.length > 0 && (
              <p className="text-xs text-muted">
                {marks.length} marked{" "}
                {marks.length === 1 ? "moment has" : "moments have"} not been
                cut yet — publishing now leaves {marks.length === 1 ? "it" : "them"}{" "}
                behind. Hit Cut {marks.length} first.
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
                        ? { ...c, status: e.target.checked ? "published" : "draft" }
                        : c,
                    )
                  }
                  className="accent-foreground"
                />
                Put it on the wall
              </label>
              <span className="text-xs text-muted">
                {kept.length} frames will be committed to {assetBase}/{draft.id}/
              </span>
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
