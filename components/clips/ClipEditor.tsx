"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ClipCanvas from "@/components/clips/ClipCanvas";
import {
  FacetPicker,
  Field,
  LinkField,
  ProjectFields,
  SourceField,
  inputClass,
} from "@/components/clips/ClipFields";
import { cutRanges, isCuttable } from "@/components/clips/cutSheet";
import { commitFiles, readJson } from "@/lib/github";
import {
  CLIPS_FILE,
  MAX_SECONDS,
  MIN_SECONDS,
  chooseShots,
  clipSeconds,
  clipcode,
  sheetSrc,
  slugify,
  type Clip,
  type ClipProject,
  type ClipsData,
} from "@/lib/clips-shared";
import { closeVideo, findCuts, openVideo, type LocalVideo } from "@/lib/video";

// One editor, for a project being cut and a project being fixed.
//
// The same one-prop split the Stills' ProjectEditor argues for: without
// `existing` this is a new project and the film is what starts it; with
// `existing` the clips come off the repo and attaching the film again is what
// lets you cut more. The Cutter gives it a `key` per project, so switching
// remounts it rather than an effect chasing the prop.
//
// **A pending clip animates.** Every sheet cut in this session gets an object
// URL and renders as a live tile immediately, before anything is committed.
// That is not a nicety: you cannot judge a clip from a poster, and judging
// clips is the entire job of this panel. The Stills could show you a still and
// ask "keep it?"; here the question is only answerable in motion.
//
// The film never leaves the machine either way. Only the sheets that survive
// are committed, so a dropped clip leaves nothing behind.

const MAX_SENSIBLE_MB = 500;
/* `next dev` only. The wall is a build-time derivation of a file the Cutter
   writes through the GitHub API, so without this the only way to see a real
   clip on a real wall is to publish one to the live site — which is no way to
   check that the wall works. Inlined by the bundler, so the button and its
   fetch are not in the production build at all. */
const LOCAL = process.env.NODE_ENV === "development";
/** Long enough to be worth filing, short enough to still be a citation. */
const DEFAULT_WANTED = "12";

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

export default function ClipEditor({
  token,
  assetBase,
  existing,
  onPublished,
  onClose,
}: {
  token: string;
  assetBase: string;
  existing?: ClipProject;
  onPublished: () => void;
  onClose?: () => void;
}) {
  const [video, setVideo] = useState<LocalVideo | null>(null);
  const [fileName, setFileName] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [wanted, setWanted] = useState(DEFAULT_WANTED);

  const [draft, setDraft] = useState<ClipProject | null>(
    existing ? structuredClone(existing) : null,
  );
  /** Sheets cut in this session, keyed by filename. Kept after publishing, not
   *  cleared: Vercel takes a minute, and dropping them would send the grid back
   *  to repo paths that 404 until it deploys. `committed` is what stops them
   *  being uploaded twice. */
  const [files, setFiles] = useState<Map<string, Blob>>(new Map());
  /** What has been committed, keyed by **full repo path** and not by filename.
   *  A new project's id follows its title, so editing the title between two
   *  publishes moves the whole asset directory — bare filenames would then
   *  claim the sheets were already uploaded and skip them, leaving the new
   *  directory empty and the wall full of 404s. */
  const [committed, setCommitted] = useState<Set<string>>(new Set());
  const [publishedAs, setPublishedAs] = useState("");
  const [saved, setSaved] = useState(existing ? JSON.stringify(existing) : "");
  const [dropped, setDropped] = useState<string[]>([]);
  const [activeClip, setActiveClip] = useState("");

  /** In and out for the range being set by hand, in seconds. */
  const [mark, setMark] = useState<{ in: number | null; out: number | null }>({
    in: null,
    out: null,
  });
  const [pending, setPending] = useState<{ in: number; out: number }[]>([]);

  const posted = Boolean(existing) || Boolean(publishedAs);
  const boundId = publishedAs || existing?.id || "";

  const playerRef = useRef<HTMLVideoElement | null>(null);

  /* One object URL per blob, minted when the set of blobs changes rather than
     while rendering the grid that uses them. An object URL is a manual
     allocation: a dozen clips leak two dozen of them per re-cut if nobody hands
     them back, and minting one inside the render pass means minting it again on
     every render. */
  const previews = useMemo(() => {
    const map = new Map<string, string>();
    for (const [name, blob] of files) map.set(name, URL.createObjectURL(blob));
    return map;
  }, [files]);

  useEffect(
    () => () => {
      for (const url of previews.values()) URL.revokeObjectURL(url);
    },
    [previews],
  );

  /* A sheet is either a blob still sitting in this page or a file already in
     the repo, and the grid should not care which. */
  const srcFor = useCallback(
    (clip: Clip, which: "sheet" | "poster") => {
      const name = which === "poster" ? clip.poster : clip.file;
      return (
        previews.get(name) ??
        (draft ? sheetSrc(assetBase, draft.id, clip, which) : "")
      );
    },
    [previews, draft, assetBase],
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

  const say = useCallback(
    (label: string, done: number, total: number) =>
      setStage({ kind: "working", label, done, total }),
    [],
  );

  /** The first pass: read the film's shots and cut the longest of them.
   *
   *  findCuts scores how much each half-second differs from the last; the
   *  Stills reads its peaks as moments to freeze. A clip wants the span
   *  *between* two peaks, which is the same measurement asked a different
   *  question — so chooseShots turns the same scores into ranges. */
  const findShots = useCallback(async () => {
    if (!video) return;
    try {
      const cuts = await findCuts(video, say);
      const shots = chooseShots(cuts, video.duration, Number(wanted) || 12);
      if (!shots.length) {
        setStage({
          kind: "error",
          message:
            "No shot in that film is long enough to be a clip. Mark the ranges by hand below.",
        });
        return;
      }
      const result = await cutRanges(video, shots, "auto", say);
      const title = fileName.replace(/\.[a-z0-9]+$/i, "");
      setFiles(result.files);
      setDropped([]);
      setDraft({
        id: slugify(title),
        title,
        credit: "",
        year: String(new Date().getFullYear()),
        note: "",
        status: "draft",
        addedAt: new Date().toISOString().slice(0, 10),
        source: { url: "", platform: "other" },
        duration: Number(video.duration.toFixed(2)),
        cover: result.clips[0]?.id,
        clips: result.clips,
      });
      setActiveClip(result.clips[0]?.id ?? "");
      setStage({
        kind: "done",
        message: `${result.clips.length} clips. Nothing has left this browser yet — file each one below.`,
      });
    } catch (err) {
      setStage({ kind: "error", message: (err as Error).message });
    }
  }, [video, wanted, fileName, say]);

  /** The second pass: exactly these ranges, no judgement about their length
   *  beyond what a clip physically is. */
  const cutMarked = useCallback(async () => {
    if (!video || !draft || !pending.length) return;
    try {
      const fresh = pending.filter(
        (r) => !draft.clips.some((c) => Math.abs(c.in - r.in) < 0.05 && Math.abs(c.out - r.out) < 0.05),
      );
      const result = await cutRanges(video, fresh, "hand", say);
      setFiles((current) => {
        const next = new Map(current);
        for (const [name, blob] of result.files) next.set(name, blob);
        return next;
      });
      setDraft((current) =>
        current
          ? {
              ...current,
              clips: [...current.clips, ...result.clips].sort((a, b) => a.in - b.in),
            }
          : current,
      );
      setPending([]);
      setActiveClip(result.clips[0]?.id ?? activeClip);
      setStage({ kind: "done", message: `Cut ${result.clips.length} more.` });
    } catch (err) {
      setStage({ kind: "error", message: (err as Error).message });
    }
  }, [video, draft, pending, say, activeClip]);

  /**
   * Cut every range this project already has, again, from the attached film.
   *
   * A clip's id is derived from its range, so a re-cut lands on the same ids
   * and the same filenames — the facets, the notes and the cover survive, and
   * the new files simply replace the old ones. That is what makes changing what
   * a clip *is* (a bigger sheet, a video beside it) a thing the owner can do to
   * work already on the wall, rather than a migration.
   */
  const recut = useCallback(async () => {
    if (!video || !draft || !draft.clips.length) return;
    try {
      const ranges = draft.clips.map((c) => ({ in: c.in, out: c.out }));
      const result = await cutRanges(video, ranges, "hand", say);
      const fresh = new Map(result.clips.map((c) => [c.id, c]));
      setFiles((current) => {
        const next = new Map(current);
        for (const [name, blob] of result.files) next.set(name, blob);
        return next;
      });
      setDraft((current) =>
        current
          ? {
              ...current,
              clips: current.clips.map((clip) => {
                const cut = fresh.get(clip.id);
                /* The new files and shape, the old filing. Origin stays put
                   too: re-cutting is not a fresh judgement about the range. */
                return cut
                  ? {
                      ...cut,
                      subject: clip.subject,
                      technique: clip.technique,
                      ...(clip.feel ? { feel: clip.feel } : {}),
                      ...(clip.tags ? { tags: clip.tags } : {}),
                      ...(clip.note ? { note: clip.note } : {}),
                      ...(clip.origin ? { origin: clip.origin } : {}),
                    }
                  : clip;
              }),
            }
          : current,
      );
      /* These filenames exist in the repo already, so the uploader would skip
         them as "already committed". They have new contents now. */
      setCommitted((current) => {
        const next = new Set(current);
        for (const name of result.files.keys()) {
          next.delete(`public/clips/${publishedAs || draft.id}/${name}`);
        }
        return next;
      });
      setStage({
        kind: "done",
        message: `Re-cut ${result.clips.length} ${result.clips.length === 1 ? "clip" : "clips"}. Save to send the new files up.`,
      });
    } catch (err) {
      setStage({ kind: "error", message: (err as Error).message });
    }
  }, [video, draft, say, publishedAs]);

  /** The record as it would be written right now: dropped clips gone, facets
   *  as chosen, the cover guaranteed to be one of the survivors. The footer
   *  measures against this and the commit writes it, so the two cannot
   *  disagree about whether there is anything to save. */
  const record = useCallback(
    (status?: ClipProject["status"]): ClipProject | null => {
      if (!draft) return null;
      const out: ClipProject = {
        ...draft,
        status: status ?? draft.status,
        clips: draft.clips.filter((c) => !dropped.includes(c.id)),
      };
      if (!out.clips.some((c) => c.id === out.cover)) {
        out.cover = out.clips[0]?.id;
      }
      return out;
    },
    [draft, dropped],
  );

  const kept = useMemo(
    () => (draft ? draft.clips.filter((c) => !dropped.includes(c.id)) : []),
    [draft, dropped],
  );

  /** Clips with nothing in either of the two axes that matter. A clip filed
   *  under nothing cannot be found, which makes committing it the same as not
   *  committing it. */
  const unfiled = kept.filter((c) => !c.subject.length && !c.technique.length);

  /** Clips cut before there was a video beside the sheet. They still work —
   *  the lightbox falls back to the filmstrip — they are just small. */
  const stale = kept.filter((c) => !c.video).length;

  const publish = useCallback(
    async (status?: ClipProject["status"]) => {
      if (!draft) return;
      try {
        setStage({ kind: "working", label: "Reading the library", done: 0, total: 1 });
        const fresh = await readJson<ClipsData>(token, CLIPS_FILE);

        // A project this editor knows, missing from the repo, was removed —
        // here, in another tab, or by hand. Publishing would put it back, so
        // refuse and say why.
        if (boundId && !fresh.data.projects.some((p) => p.id === boundId)) {
          setStage({
            kind: "error",
            message: `"${draft.title}" is no longer in the Clips — it was removed after this panel opened. Close it and start again if you want it back; saving now would resurrect it.`,
          });
          return;
        }

        const cleaned = record(status);
        if (!cleaned || !cleaned.clips.length) {
          setStage({
            kind: "error",
            message: "Every clip is dropped. Keep at least one.",
          });
          return;
        }

        if (boundId) {
          cleaned.id = boundId;
        } else if (fresh.data.projects.some((p) => p.id === cleaned.id)) {
          let n = 2;
          while (fresh.data.projects.some((p) => p.id === `${cleaned.id}-${n}`)) n++;
          cleaned.id = `${cleaned.id}-${n}`;
        }

        // Only sheets that survived, and only the ones cut in this session —
        // everything else is already in the repo. A dropped clip was never
        // uploaded, so this leaves no orphans.
        const want = new Set<string>();
        for (const clip of cleaned.clips) {
          want.add(clip.file);
          want.add(clip.poster);
          if (clip.video) want.add(clip.video);
        }
        const binaries = new Map<string, Blob>();
        for (const [name, blob] of files) {
          const path = `public/clips/${cleaned.id}/${name}`;
          if (want.has(name) && !committed.has(path)) binaries.set(path, blob);
        }

        const next: ClipsData = {
          ...fresh.data,
          projects: fresh.data.projects.some((p) => p.id === cleaned.id)
            ? fresh.data.projects.map((p) => (p.id === cleaned.id ? cleaned : p))
            : [...fresh.data.projects, cleaned],
        };

        await commitFiles(token, {
          message: posted
            ? `Curate the Clips: ${cleaned.title}`
            : `Add ${cleaned.title} to the Clips`,
          text: { [CLIPS_FILE]: JSON.stringify(next, null, 2) + "\n" },
          binaries,
          onProgress: (done, total) =>
            setStage({ kind: "working", label: "Uploading", done, total }),
        });

        const where =
          cleaned.status === "published"
            ? "It is in the library"
            : "It is a draft — not in the library";
        setStage({
          kind: "done",
          message: binaries.size
            ? `${where}, with ${binaries.size} new files. Vercel takes about a minute.`
            : `${where}. Vercel takes about a minute.`,
        });
        setSaved(JSON.stringify(cleaned));
        setCommitted((current) => {
          const nextSet = new Set(current);
          for (const path of binaries.keys()) nextSet.add(path);
          return nextSet;
        });
        setPublishedAs(cleaned.id);
        setDraft(cleaned);
        setDropped([]);
        onPublished();
      } catch (err) {
        setStage({ kind: "error", message: (err as Error).message });
      }
    },
    [draft, record, files, committed, token, boundId, posted, onPublished],
  );

  /** Land the project in this checkout instead of in the repo: the JSON to
   *  content/clips/, every sheet to public/clips/. Dev only — see LOCAL. */
  const saveLocally = useCallback(async () => {
    if (!draft) return;
    try {
      setStage({ kind: "working", label: "Writing to this checkout", done: 0, total: 1 });
      const current = await fetch("/api/clips/local", { cache: "no-store" });
      if (!current.ok) throw new Error("The dev helper isn't there — is this `next dev`?");
      const { data: held } = (await current.json()) as { data: ClipsData };

      const cleaned = record("published");
      if (!cleaned || !cleaned.clips.length) {
        setStage({ kind: "error", message: "Every clip is dropped. Keep at least one." });
        return;
      }
      if (boundId) cleaned.id = boundId;

      const next: ClipsData = {
        ...held,
        projects: held.projects.some((p) => p.id === cleaned.id)
          ? held.projects.map((p) => (p.id === cleaned.id ? cleaned : p))
          : [...held.projects, cleaned],
      };

      const body = new FormData();
      body.set("data", JSON.stringify(next, null, 2));
      const want = new Set(
        cleaned.clips.flatMap((c) => [c.file, c.poster, c.video ?? ""]),
      );
      for (const [name, blob] of files) {
        if (want.has(name)) body.set(`public/clips/${cleaned.id}/${name}`, blob, name);
      }

      const res = await fetch("/api/clips/local", { method: "PUT", body });
      const result = (await res.json()) as { error?: string; written?: number };
      if (!res.ok) throw new Error(result.error ?? "Write failed");

      setStage({
        kind: "done",
        message: `Written to this checkout — ${result.written} files under public/clips/${cleaned.id}/. Reload /clips to see it.`,
      });
      setPublishedAs(cleaned.id);
      setDraft(cleaned);
      setDropped([]);
    } catch (err) {
      setStage({ kind: "error", message: (err as Error).message });
    }
  }, [draft, record, files, boundId]);

  const remove = useCallback(async () => {
    if (!draft || !posted) return;
    if (
      !window.confirm(
        `Remove "${draft.title}" from the Clips? The sheets stay in the repo — run scripts/clips/prune.mjs to clear them.`,
      )
    ) {
      return;
    }
    try {
      setStage({ kind: "working", label: "Removing", done: 0, total: 1 });
      const fresh = await readJson<ClipsData>(token, CLIPS_FILE);
      await commitFiles(token, {
        message: `Remove ${draft.title} from the Clips`,
        text: {
          [CLIPS_FILE]:
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
      setStage({ kind: "done", message: "Removed from the Clips entirely." });
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

  const busy = stage.kind === "working";
  const online = draft?.status === "published";
  const dirty = draft ? JSON.stringify(record()) !== saved : false;
  const active = draft?.clips.find((c) => c.id === activeClip);
  const patchClip = (id: string, changes: Partial<Clip>) =>
    setDraft((c) =>
      c
        ? { ...c, clips: c.clips.map((x) => (x.id === id ? { ...x, ...changes } : x)) }
        : c,
    );

  const toUpload = draft
    ? kept.filter((clip) => {
        const dir = `public/clips/${publishedAs || draft.id}/`;
        return [clip.file, clip.poster, clip.video].some(
          (name) => name && files.has(name) && !committed.has(dir + name),
        );
      }).length
    : 0;

  const markSpan =
    mark.in !== null && mark.out !== null ? mark.out - mark.in : null;

  return (
    <section className="border border-line p-5 space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-2xl">
          {posted ? draft?.title : "Take a film apart"}
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
          Drop in the film and your browser cuts the clips itself — nothing is
          uploaded, nothing runs on a server. Each clip is committed as a strip
          of its frames, so it loops and it steps.
        </p>
      )}

      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <label className="flex-1">
          <span className="sr-only">
            {posted ? "Attach the film to cut more clips" : "Choose a video file"}
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
              clips
              <input
                type="number"
                min={2}
                max={40}
                value={wanted}
                onChange={(e) => setWanted(e.target.value)}
                className="w-20 border border-line bg-background px-3 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
              />
            </label>
            <button
              onClick={findShots}
              disabled={!video || busy}
              className="border border-line px-6 py-3 text-sm hover:bg-foreground hover:text-background transition-colors disabled:opacity-40 disabled:hover:bg-background disabled:hover:text-foreground"
            >
              Find the shots
            </button>
          </>
        )}
      </div>

      {posted && (
        <p className="text-xs text-muted">
          Attach the film again to cut more clips into this project. Everything
          else here can be changed without it.
        </p>
      )}
      {video && (
        <p className="text-xs text-muted">
          {fileName} · {video.width}×{video.height} · {clipcode(video.duration)}
        </p>
      )}

      <StageLine stage={stage} />

      {draft && (
        <div className="space-y-5 border-t border-line pt-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                online ? "bg-foreground text-background" : "pill"
              }`}
            >
              {!posted ? "Not saved yet" : online ? "In the library" : "Draft"}
            </span>
            <span className="text-xs text-muted">
              {!posted
                ? "Nothing has left this browser."
                : online
                  ? "Anybody with the link to the Clips can see it."
                  : "Saved, but nobody can see it."}
            </span>
            {posted && dirty && <span className="pill text-xs">Unsaved changes</span>}
          </div>

          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm text-muted">/clips/{draft.id}</p>
            <span className="text-xs text-muted">
              {kept.length} of {draft.clips.length} clips kept
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
                // the title; once it is in the repo it is fixed, or the sheets
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

          {/* Every clip, moving. This is the panel's whole argument: a poster
              tells you nothing about whether a clip is worth keeping. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {draft.clips.map((clip) => {
              const out = dropped.includes(clip.id);
              const isCover = clip.id === draft.cover;
              const filed = clip.subject.length + clip.technique.length > 0;
              return (
                <div key={clip.id} className="relative">
                  <button
                    onClick={() => setActiveClip(clip.id)}
                    className={`block w-full text-left ${out ? "opacity-25" : ""}`}
                    aria-label={`File the clip at ${clipcode(clip.in)}`}
                  >
                    <ClipCanvas
                      clip={clip}
                      sheet={srcFor(clip, "sheet")}
                      poster={srcFor(clip, "poster")}
                      alt=""
                      active
                      className={`w-full bg-surface border ${
                        clip.id === activeClip ? "border-foreground" : "border-line"
                      }`}
                    />
                  </button>
                  <span className="pointer-events-none absolute bottom-0 left-0 bg-background px-1.5 py-0.5 text-[10px] tabular-nums">
                    {clipcode(clip.in)} · {clipSeconds(clip).toFixed(1)}s
                    {clip.origin === "hand" && " ✋"}
                    {!filed && " · unfiled"}
                  </span>
                  {isCover && (
                    <span className="pointer-events-none absolute top-0 left-0 bg-foreground text-background px-1.5 py-0.5 text-[10px]">
                      cover
                    </span>
                  )}
                  <button
                    onClick={() =>
                      setDropped((c) =>
                        c.includes(clip.id)
                          ? c.filter((x) => x !== clip.id)
                          : [...c, clip.id],
                      )
                    }
                    className="absolute top-0 right-0 bg-background border-l border-b border-line px-2 py-0.5 text-[10px] hover:bg-foreground hover:text-background transition-colors"
                  >
                    {out ? "keep" : "drop"}
                  </button>
                </div>
              );
            })}
          </div>

          {active && (
            <div className="border border-line p-4 space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <p className="text-sm tabular-nums">
                  {clipcode(active.in)}–{clipcode(active.out)} ·{" "}
                  {active.frames} frames over {clipSeconds(active).toFixed(1)}s
                </p>
                <button
                  onClick={() => setDraft((c) => (c ? { ...c, cover: active.id } : c))}
                  className="text-xs underline underline-offset-4 hover:text-muted transition-colors"
                >
                  Make it the cover
                </button>
              </div>

              <FacetPicker
                clip={active}
                onChange={(changes) => patchClip(active.id, changes)}
              />

              <Field label="What to notice — the sentence that makes this worth filing">
                <textarea
                  value={active.note ?? ""}
                  onChange={(e) => patchClip(active.id, { note: e.target.value })}
                  rows={2}
                  placeholder="Three-frame stagger, and only the last item overshoots."
                  className={inputClass}
                />
              </Field>

              <Field label="Anything the three rows don't have — comma separated">
                <input
                  value={(active.tags ?? []).join(", ")}
                  onChange={(e) =>
                    patchClip(active.id, {
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="risograph, isometric"
                  className={inputClass}
                />
              </Field>
            </div>
          )}

          {/* The film itself, so a range can be set where it actually is rather
              than where the scan guessed. */}
          {video && (
            <div className="space-y-3 border-t border-line pt-5">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <h3 className="font-serif text-xl">Cut one by hand</h3>
                {draft.clips.length > 0 && (
                  <button
                    onClick={recut}
                    disabled={busy}
                    className="text-xs underline underline-offset-4 hover:text-muted transition-colors disabled:opacity-40"
                  >
                    {stale > 0
                      ? `Re-cut all ${draft.clips.length} — ${stale} ${stale === 1 ? "has" : "have"} no video`
                      : `Re-cut all ${draft.clips.length} from this film`}
                  </button>
                )}
              </div>
              <p className="max-w-2xl text-sm text-muted leading-relaxed">
                Scrub to where the movement starts and press In, then to where it
                finishes and press Out. Between {MIN_SECONDS}s and {MAX_SECONDS}s.
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
                    if (typeof t === "number") setMark((m) => ({ ...m, in: t }));
                  }}
                  className="border border-line px-4 py-2 text-sm hover:bg-foreground hover:text-background transition-colors"
                >
                  In
                </button>
                <button
                  onClick={() => {
                    const t = playerRef.current?.currentTime;
                    if (typeof t === "number") setMark((m) => ({ ...m, out: t }));
                  }}
                  className="border border-line px-4 py-2 text-sm hover:bg-foreground hover:text-background transition-colors"
                >
                  Out
                </button>
                <span className="text-xs text-muted tabular-nums">
                  {mark.in === null ? "—" : clipcode(mark.in)} →{" "}
                  {mark.out === null ? "—" : clipcode(mark.out)}
                  {markSpan !== null && ` · ${markSpan.toFixed(1)}s`}
                </span>
                <button
                  onClick={() => {
                    if (mark.in === null || mark.out === null) return;
                    setPending((p) => [...p, { in: mark.in!, out: mark.out! }]);
                    setMark({ in: null, out: null });
                  }}
                  disabled={
                    mark.in === null ||
                    mark.out === null ||
                    !isCuttable(mark.in, mark.out)
                  }
                  className="border border-line px-4 py-2 text-sm hover:bg-foreground hover:text-background transition-colors disabled:opacity-40 disabled:hover:bg-background disabled:hover:text-foreground"
                >
                  Add the range
                </button>
              </div>
              {markSpan !== null && !isCuttable(mark.in!, mark.out!) && (
                <p className="text-xs text-muted">
                  {markSpan < MIN_SECONDS
                    ? `That's ${markSpan.toFixed(1)}s — under ${MIN_SECONDS}s there is nothing to see.`
                    : `That's ${markSpan.toFixed(1)}s — over ${MAX_SECONDS}s you are quoting the film rather than citing it.`}
                </p>
              )}
              {pending.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <ul className="flex flex-wrap gap-2">
                    {pending.map((r, i) => (
                      <li
                        key={`${r.in}-${i}`}
                        className="flex items-center gap-2 border border-line px-2 py-1 text-xs"
                      >
                        <span className="tabular-nums">
                          {clipcode(r.in)}–{clipcode(r.out)}
                        </span>
                        <button
                          onClick={() => setPending((p) => p.filter((_, x) => x !== i))}
                          aria-label={`Drop the range at ${clipcode(r.in)}`}
                          className="text-muted hover:text-foreground"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={cutMarked}
                    disabled={busy}
                    className="border border-line px-4 py-2 text-sm hover:bg-foreground hover:text-background transition-colors disabled:opacity-40"
                  >
                    Cut {pending.length}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 border-t border-line pt-5">
            <StageLine stage={stage} />
            {pending.length > 0 && (
              <p className="text-xs text-muted">
                {pending.length} marked{" "}
                {pending.length === 1 ? "range has" : "ranges have"} not been cut
                yet — saving now leaves {pending.length === 1 ? "it" : "them"}{" "}
                behind.
              </p>
            )}
            {stale > 0 && (
              <p className="text-xs text-muted">
                {stale} {stale === 1 ? "clip has" : "clips have"} only the
                filmstrip, so {stale === 1 ? "it opens" : "they open"} small.
                Attach the film and press <em>Re-cut all</em> to give{" "}
                {stale === 1 ? "it" : "them"} a full-size video.
              </p>
            )}
            {unfiled.length > 0 && (
              <p className="text-xs text-muted">
                {unfiled.length}{" "}
                {unfiled.length === 1 ? "clip has" : "clips have"} nothing in
                &ldquo;What it is&rdquo; or &ldquo;How it moves&rdquo;. Nothing
                stops you, but a clip filed under nothing can&apos;t be found.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              {toUpload > 0 && (
                <span className="text-xs text-muted">
                  {toUpload} new {toUpload === 1 ? "sheet" : "sheets"} to upload
                </span>
              )}
              {posted && (
                <button
                  onClick={remove}
                  disabled={busy}
                  className="text-xs text-muted underline underline-offset-4 hover:text-foreground transition-colors disabled:opacity-40"
                >
                  Remove from Clips
                </button>
              )}
              {LOCAL && (
                <button
                  onClick={saveLocally}
                  disabled={busy}
                  className="text-xs text-muted underline underline-offset-4 hover:text-foreground transition-colors disabled:opacity-40"
                >
                  Save to this checkout
                </button>
              )}
              <div className="ml-auto flex flex-wrap items-center gap-3">
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
                      ? "Take it out of the library"
                      : "Put it in the library"}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted">
              {online
                ? "Taking it out loses nothing — every clip stays where it is, it just stops being public. Remove is the one that undoes the curation."
                : "Putting it in the library is what makes it public. A draft is saved and safe, and visible only here."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
