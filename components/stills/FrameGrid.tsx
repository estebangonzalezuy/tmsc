"use client";

/* eslint-disable @next/next/no-img-element -- the Curator shows the files the
   extractor wrote, at the size it wrote them. Half the time they aren't files
   yet, they're object URLs for blobs still sitting in the page. */

import { timecode } from "@/lib/stills-shared";
import type { Frame, Project, StillsSource } from "@/lib/stills-shared";

// The frame grid and the field wrapper, shared by both halves of the Curator.
//
// A project extracted here in the browser and a project extracted in Actions
// are curated identically — the only difference is where the pictures come
// from, which is why `srcFor` is a function. For a committed project it
// builds a path under /stills; for one still being cut, an object URL for a
// blob that has never left the page.

export const inputClass =
  "w-full border border-line bg-background px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground";

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

export function ProjectFields({
  project,
  onPatch,
}: {
  project: Pick<Project, "title" | "credit" | "year" | "tags" | "note">;
  onPatch: (changes: Partial<Project>) => void;
}) {
  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Title">
          <input
            value={project.title}
            onChange={(e) => onPatch({ title: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Credit — studio, director">
          <input
            value={project.credit}
            onChange={(e) => onPatch({ credit: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Year">
          <input
            value={project.year}
            onChange={(e) => onPatch({ year: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Tags — comma separated">
          <input
            value={project.tags.join(", ")}
            onChange={(e) =>
              onPatch({ tags: e.target.value.split(",").map((t) => t.trim()) })
            }
            placeholder="3d, type, warm, product"
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Note — why this one is worth looking at">
        <textarea
          value={project.note ?? ""}
          onChange={(e) => onPatch({ note: e.target.value })}
          rows={3}
          className={inputClass}
        />
      </Field>
    </>
  );
}

/** Where the video lives, so every frame can point back at the second it came
 *  from. A project cut from a local file starts with nothing here, and until
 *  it has something the wall shows a still with no way to check it — which is
 *  the one thing a reference library must not do. Shared by both halves of the
 *  Curator so a project can be given its link long after it was published. */
export function SourceField({
  source,
  onChange,
}: {
  source: StillsSource;
  onChange: (source: StillsSource) => void;
}) {
  return (
    <Field label="Source link — where this video lives, so every frame can point back">
      <input
        value={source.url}
        onChange={(e) => onChange(withUrl(source, e.target.value))}
        placeholder="https://vimeo.com/… or https://framerate.tv/…"
        className={inputClass}
      />
    </Field>
  );
}

/** Re-reads the platform and the id from the URL, because a link pasted by
 *  hand is the only thing that knows them for a locally cut project, and
 *  momentUrl needs the id to deep-link a YouTube timestamp. */
export function withUrl(source: StillsSource, url: string): StillsSource {
  const platform: StillsSource["platform"] = /youtu\.?be|youtube\./i.test(url)
    ? "youtube"
    : /vimeo\./i.test(url)
      ? "vimeo"
      : "other";
  const videoId =
    url.match(/[?&]v=([A-Za-z0-9_-]{6,})/)?.[1] ??
    url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/)?.[1] ??
    url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1];
  return { ...source, url, platform, ...(videoId ? { videoId } : {}) };
}

/** The studio's own page for the film. `source` is where a frame can be
 *  checked; this is where the work is credited and written up, and they are
 *  usually not the same address. */
export function LinkField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label="Project link — the studio's page for this work">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://oddfellows.tv/…"
        className={inputClass}
      />
    </Field>
  );
}

export default function FrameGrid({
  frames,
  cover,
  dropped,
  activeFrame,
  srcFor,
  onActivate,
  onToggleDrop,
  onCover,
  onFrameChange,
}: {
  frames: Frame[];
  cover?: string;
  dropped: string[];
  activeFrame: string;
  srcFor: (frame: Frame) => string;
  onActivate: (id: string) => void;
  onToggleDrop: (id: string) => void;
  onCover: (id: string) => void;
  onFrameChange: (id: string, changes: Partial<Frame>) => void;
}) {
  const active = frames.find((f) => f.id === activeFrame);

  if (frames.length === 0) {
    return <p className="text-sm text-muted">No frames yet.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line">
        {frames.map((frame) => {
          const out = dropped.includes(frame.id);
          const isCover = frame.id === cover;
          return (
            <div
              key={frame.id}
              className="relative aspect-video bg-background overflow-hidden"
            >
              <button
                onClick={() => onActivate(frame.id)}
                className="absolute inset-0 block"
                aria-label={`Inspect frame at ${timecode(frame.t)}`}
              >
                <img
                  src={srcFor(frame)}
                  alt=""
                  loading="lazy"
                  className={`h-full w-full object-cover transition-opacity ${
                    out ? "opacity-20" : ""
                  }`}
                />
              </button>
              <span className="pointer-events-none absolute bottom-0 left-0 bg-background px-1.5 py-0.5 text-[10px]">
                {timecode(frame.t)}
                {frame.origin === "hand" && " ✋"}
              </span>
              {isCover && (
                <span className="pointer-events-none absolute top-0 left-0 bg-foreground text-background px-1.5 py-0.5 text-[10px]">
                  cover
                </span>
              )}
              {frame.id === activeFrame && (
                <span className="pointer-events-none absolute inset-0 border-2 border-foreground" />
              )}
              <button
                onClick={() => onToggleDrop(frame.id)}
                className="absolute top-0 right-0 bg-background border-l border-b border-line px-2 py-0.5 text-[10px] hover:bg-foreground hover:text-background transition-colors"
              >
                {out ? "keep" : "drop"}
              </button>
            </div>
          );
        })}
      </div>

      {active && (
        <div className="border border-line p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm">Frame at {timecode(active.t)}</p>
            <button
              onClick={() => onCover(active.id)}
              className="text-xs underline underline-offset-4 hover:text-muted transition-colors"
            >
              Make it the cover
            </button>
          </div>
          <Field label="Tags for this frame — comma separated, on top of the project's">
            <input
              value={(active.tags ?? []).join(", ")}
              onChange={(e) =>
                onFrameChange(active.id, {
                  tags: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              placeholder="grain, split complementary, kinetic type"
              className={inputClass}
            />
          </Field>
        </div>
      )}
    </div>
  );
}
