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
// The prop is the *starting* condition, not the state: a new project becomes an
// existing one the moment it publishes, which is what `posted` means below. A
// panel that is still calling itself new after it has put something in the repo
// is how a project got resurrected and how its images got orphaned.
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
  /** What has actually been committed, keyed by **full repo path** and not by
   *  filename. A new project's id follows its title, so editing the title
   *  between two publishes moves the whole asset directory — and a set of bare
   *  filenames would then claim the images were already uploaded and skip them,
   *  leaving the new directory empty and the wall full of 404s. */
  const [committed, setCommitted] = useState<Set<string>>(new Set());
  /** The id this editor last published under, once it has published anything.
   *  A new project stops being new the moment it lands: its id is now a URL and
   *  an asset directory, so it may not follow the title any more, and it must
   *  be updated in place rather than appended again. */
  const [publishedAs, setPublishedAs] = useState("");
  /** The record as the repo currently holds it, stringified. Comparing the panel
   *  against it is how the footer can say whether there is anything to save —
   *  without it, "Save changes" is a button you press hoping. */
  const [saved, setSaved] = useState(existing ? JSON.stringify(existing) : "");
  const [dropped, setDropped] = useState<string[]>([]);
  const [activeFrame, setActiveFrame] = useState("");
  const [marks, setMarks] = useState<number[]>([]);

  /** Whether this project is in the repo — opened from it, or put there by this
   *  panel a moment ago. Everything that treats the panel as an intake rather
   *  than an editor turns off here: a project that has landed has a fixed id,
   *  an asset directory, and no business being scanned from scratch again. */
  const posted = Boolean(existing) || Boolean(publishedAs);
  /** The id this panel is bound to, when it is bound to one. */
  const boundId = publishedAs || existing?.id || "";

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

  /** The record as it would be written right now: tags trimmed, dropped frames
   *  gone, the cover guaranteed to be one of the survivors. The footer measures
   *  against this and the commit writes it, so the two cannot disagree about
   *  whether there is anything to save. */
  const record = useCallback(
    (status?: Project["status"]): Project | null => {
      if (!draft) return null;
      const out: Project = {
        ...draft,
        status: status ?? draft.status,
        tags: draft.tags.map((t) => t.trim()).filter(Boolean),
        frames: draft.frames.filter((f) => !dropped.includes(f.id)),
      };
      if (!out.frames.some((f) => f.id === out.cover)) {
        out.cover = out.frames[0]?.id;
      }
      return out;
    },
    [draft, dropped],
  );

  /** `status` given: put it on the wall, or take it off, and write that.
   *  Omitted: write the curation and leave the wall alone. Two actions rather
   *  than a tickbox you had to remember to tick before pressing the one
   *  button — "Publish" meant *commit*, and read as *make it public*. */
  const publish = useCallback(async (status?: Project["status"]) => {
    if (!draft) return;
    try {
      setStage({ kind: "working", label: "Reading the projects", done: 0, total: 1 });
      const fresh = await readProjects<StillsData>(token);

      // A project this editor already knows, missing from the repo, was removed
      // — here, in another tab, or by hand. Publishing would put it back, which
      // is how a deleted curation reappeared "like if it was on backlog": the
      // panel was still mounted holding the whole draft, and the append branch
      // below treats absence as "new". Refuse instead, and say why.
      if (boundId && !fresh.data.projects.some((p) => p.id === boundId)) {
        setStage({
          kind: "error",
          message: `"${draft.title}" is no longer in the Stills — it was removed after this panel opened. Close it and start again if you want it back; saving now would resurrect it.`,
        });
        return;
      }

      const cleaned = record(status);
      if (!cleaned || !cleaned.frames.length) {
        setStage({
          kind: "error",
          message: "Every frame is dropped. Keep at least one.",
        });
        return;
      }

      // A never-published project takes the next free name rather than
      // overwriting a curation that happens to share a title. One this editor is
      // bound to keeps its id, which is its URL and its asset directory.
      if (boundId) {
        cleaned.id = boundId;
      } else if (fresh.data.projects.some((p) => p.id === cleaned.id)) {
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
        const path = `public/stills/${cleaned.id}/${name}`;
        if (wanted.has(name) && !committed.has(path)) binaries.set(path, blob);
      }

      const next: StillsData = {
        ...fresh.data,
        projects: fresh.data.projects.some((p) => p.id === cleaned.id)
          ? fresh.data.projects.map((p) => (p.id === cleaned.id ? cleaned : p))
          : [...fresh.data.projects, cleaned],
      };

      await commitFiles(token, {
        message: posted
          ? `Curate the Stills: ${cleaned.title}`
          : `Add ${cleaned.title} to the Stills`,
        text: {
          "content/stills/projects.json": JSON.stringify(next, null, 2) + "\n",
        },
        binaries,
        onProgress: (done, total) =>
          setStage({ kind: "working", label: "Uploading", done, total }),
      });

      // Say what the wall will look like, not what git did. Whether the images
      // went up is the interesting half of "what did that press do", so it stays
      // — but "Committed 42 files" never answered the question people ask, which
      // is whether the thing is public now.
      const where =
        cleaned.status === "published"
          ? "It is on the wall"
          : "It is a draft — not on the wall";
      setStage({
        kind: "done",
        message: binaries.size
          ? `${where}, with ${binaries.size} new files. Vercel takes about a minute.`
          : `${where}. Vercel takes about a minute.`,
      });
      setSaved(JSON.stringify(cleaned));
      setCommitted((current) => {
        const next = new Set(current);
        for (const path of binaries.keys()) next.add(path);
        return next;
      });
      setPublishedAs(cleaned.id);
      // The draft becomes what was actually published: the id it landed under,
      // and without the frames that were dropped. Clearing `dropped` on its own
      // used to hand every dropped frame back to the grid as kept, so a second
      // publish quietly re-added the stills you had just thrown out.
      setDraft(cleaned);
      setDropped([]);
      onPublished();
    } catch (err) {
      setStage({ kind: "error", message: (err as Error).message });
    }
  }, [draft, record, files, committed, token, boundId, posted, onPublished]);

  const remove = useCallback(async () => {
    if (!draft || !posted) return;
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
      setStage({ kind: "done", message: "Removed from the Stills entirely." });
      // Nothing may publish out of this panel afterwards, or Remove-then-Publish
      // puts the project straight back.
      setDraft(null);
      setPublishedAs("");
      setSaved("");
      onPublished();
      onClose?.();
    } catch (err) {
      setStage({ kind: "error", message: (err as Error).message });
    }
  }, [draft, posted, token, onPublished, onClose]);

  const kept = draft ? draft.frames.filter((f) => !dropped.includes(f.id)) : [];
  const busy = stage.kind === "working";

  /* How many *stills* have yet to be uploaded. Each one is three files — full,
     mid and thumb — so counting files told you eighteen frames were forty-three
     things, which reads as a mistake rather than as an explanation. */
  const pending = draft
    ? kept.filter((frame) => {
        const dir = `public/stills/${publishedAs || draft.id}/`;
        return [frame.file, frame.mid, frame.thumb].some(
          (name) => name && files.has(name) && !committed.has(dir + name),
        );
      }).length
    : 0;

  /* Where the project stands, and whether the panel is ahead of it. Both were
     invisible before: the only sign of either was an "On the wall" tickbox that
     described what the *next* press would do, so a project could sit in front of
     you for a minute without telling you whether it was public. */
  const online = draft?.status === "published";
  const dirty = draft ? JSON.stringify(record()) !== saved : false;

  return (
    <section className="border border-line p-5 space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-2xl">
          {posted ? draft?.title : "Add a project"}
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

      {!posted && (
        <p className="max-w-2xl text-sm text-muted leading-relaxed">
          Drop in the video and your browser cuts the frames itself — nothing is
          uploaded, nothing runs on a server. Download the film however you
          normally would; any file your browser can play will do.
        </p>
      )}

      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <label className="flex-1">
          <span className="sr-only">
            {posted ? "Attach the video to cut more frames" : "Choose a video file"}
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
        {!posted && (
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

      {posted && (
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
          {/* Where it stands, first thing, in words rather than in the state of
              a tickbox further down the panel. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* Filled for the one state that is public, so the difference is
                visible before the words are read. Not `.pill` in that case: it
                brings its own translucent ground, which wins over a Tailwind
                background and leaves white type on near-white. */}
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                online ? "bg-foreground text-background" : "pill"
              }`}
            >
              {!posted ? "Not saved yet" : online ? "On the wall" : "Draft"}
            </span>
            <span className="text-xs text-muted">
              {!posted
                ? "Nothing has left this browser."
                : online
                  ? "Anybody with the link to the Stills can see it."
                  : "Saved, but nobody can see it."}
            </span>
            {posted && dirty && (
              <span className="pill text-xs">Unsaved changes</span>
            )}
          </div>

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
                // The id is the URL and the asset directory. Until the project
                // has been published nothing is uploaded, so it can still follow
                // the title; once it is in the repo it is fixed, or the images
                // would be orphaned from the record that names them.
                if (!posted && changes.title !== undefined) {
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
                yet — saving now leaves{" "}
                {marks.length === 1 ? "it" : "them"} behind.
              </p>
            )}
            {/* Two things, named. Saving the curation and putting it in front of
                people are separate decisions, and the panel used to conflate
                them: one button called Publish, which committed, next to a
                tickbox that decided whether the commit was public. Pressing
                Publish on a draft therefore saved a draft — the right thing, and
                the exact opposite of what the word says. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              {pending > 0 && (
                <span className="text-xs text-muted">
                  {pending} new {pending === 1 ? "still" : "stills"} to upload
                </span>
              )}
              {posted && (
                <button
                  onClick={remove}
                  disabled={busy}
                  className="text-xs text-muted underline underline-offset-4 hover:text-foreground transition-colors disabled:opacity-40"
                >
                  Remove from the Stills
                </button>
              )}
              <div className="ml-auto flex flex-wrap items-center gap-3">
                {/* Saving without changing the wall. Nothing to save is a
                    disabled button rather than a hidden one: a press that does
                    nothing and a control that isn't there read differently. */}
                {posted && (
                  <button
                    onClick={() => publish()}
                    disabled={busy || !token || !dirty}
                    className="border border-line px-5 py-3 text-sm hover:bg-foreground hover:text-background transition-colors disabled:opacity-40 disabled:hover:bg-background disabled:hover:text-foreground"
                  >
                    {busy ? "Working…" : dirty ? "Save changes" : "Saved"}
                  </button>
                )}
                {!posted && (
                  <button
                    onClick={() => publish("draft")}
                    disabled={busy || !token}
                    className="border border-line px-5 py-3 text-sm hover:bg-foreground hover:text-background transition-colors disabled:opacity-40"
                  >
                    {busy ? "Working…" : "Save as a draft"}
                  </button>
                )}
                <button
                  onClick={() => publish(online ? "draft" : "published")}
                  disabled={busy || !token}
                  className={`px-6 py-3 text-sm transition-colors disabled:opacity-40 ${
                    online
                      ? "border border-line hover:bg-foreground hover:text-background"
                      : "bg-foreground text-background hover:opacity-80"
                  }`}
                >
                  {busy
                    ? "Working…"
                    : online
                      ? "Take it off the wall"
                      : "Put it on the wall"}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted">
              {online
                ? "Taking it off the wall loses nothing — every frame stays where it is, it just stops being public. Remove is the one that undoes the curation."
                : "Putting it on the wall is what makes it public. A draft is saved and safe, and visible only here."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
