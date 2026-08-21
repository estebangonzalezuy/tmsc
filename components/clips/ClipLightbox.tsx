"use client";

import { useCallback, useEffect, useState } from "react";
import ClipCanvas from "@/components/clips/ClipCanvas";
import { ticker } from "@/components/clips/ticker";
import {
  clipSeconds,
  clipcode,
  frameAt,
  hasSource,
  momentUrl,
  sheetSrc,
  type SourceRef,
  type WallClip,
} from "@/lib/clips-shared";

// One clip, large, with the controls a reference library owes you.
//
// The reason the club commits a filmstrip rather than a video is here: **frame
// stepping**. A three-frame stagger is not something you can see at speed and
// not something a YouTube embed will ever let you walk through. Left and right
// step a frame; space runs it; the scrubber is the loop end to end.
//
// The clip runs on the shared ticker until somebody touches a control, at which
// point it holds the frame it was on. Stepping is therefore just arithmetic on
// a held index, and there is no second playback path to keep in step.
//
// A held frame is about the clip you were looking at, so stepping to the next
// one has to forget it. Both callers key this component by the clip's id, which
// remounts it — rather than an effect in here resetting state on a prop change.

export type LightboxClip = {
  clip: WallClip;
  projectId: string;
  projectTitle: string;
  credit: string;
  year: string;
  source: SourceRef;
  link?: string;
};

export default function ClipLightbox({
  item,
  assetBase,
  position,
  onClose,
  onStep,
}: {
  item: LightboxClip;
  assetBase: string;
  position: { index: number; total: number };
  onClose: () => void;
  onStep: (delta: number) => void;
}) {
  const { clip } = item;
  const seconds = clipSeconds(clip);
  /** Null means running. A number means held on that frame. */
  const [held, setHeld] = useState<number | null>(null);

  const holdAt = useCallback(
    (index: number) => setHeld(((index % clip.frames) + clip.frames) % clip.frames),
    [clip.frames],
  );

  /* Stepping from wherever it happens to be, not from zero: pressing → on a
     running clip should advance the frame you are looking at. */
  const step = useCallback(
    (delta: number) =>
      setHeld((current) => {
        const from = current ?? frameAt(ticker.get(), seconds, clip.frames);
        return ((from + delta) % clip.frames + clip.frames) % clip.frames;
      }),
    [clip.frames, seconds],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key === "ArrowRight") {
        e.preventDefault();
        return step(1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        return step(-1);
      }
      if (e.key === " ") {
        e.preventDefault();
        return setHeld((c) => (c === null ? frameAt(ticker.get(), seconds, clip.frames) : null));
      }
      // Shift+arrows walk the wall, since the bare arrows are the clip's now.
      if (e.key === "ArrowDown" || (e.shiftKey && e.key === "ArrowRight")) onStep(1);
      if (e.key === "ArrowUp" || (e.shiftKey && e.key === "ArrowLeft")) onStep(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStep, step, seconds, clip.frames]);

  const moment = hasSource(item.source) ? momentUrl(item.source, clip.in) : "";
  const running = held === null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Clip from ${item.projectTitle}`}
      className="fixed inset-0 z-50 bg-foreground/90 overflow-y-auto"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="fixed inset-0 h-full w-full cursor-zoom-out"
      />

      {/* Never blown up past twice the size the sheet was cut at. A filmstrip
          is a few hundred kilobytes of intra-coded frames, so the tile is small
          on purpose — and a lightbox that stretches it across a desktop is
          advertising detail the club deliberately did not commit. */}
      <div
        style={{ maxWidth: clip.w * 2 }}
        className="pointer-events-none relative mx-auto flex min-h-full flex-col justify-center gap-4 px-5 py-10 md:px-6"
      >
        <div className="pointer-events-auto card overflow-hidden">
          <ClipCanvas
            clip={clip}
            sheet={sheetSrc(assetBase, item.projectId, clip)}
            poster={sheetSrc(assetBase, item.projectId, clip, "poster")}
            alt={`Clip from ${item.projectTitle} at ${clipcode(clip.in)}`}
            active={running}
            {...(held !== null ? { frame: held } : {})}
            className="w-full"
          />

          <div className="row-divide space-y-3 p-4 md:p-5">
            {/* The loop, end to end. Dragging it holds the frame, which is what
                scrubbing means — there is no separate paused state to manage. */}
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  setHeld((c) =>
                    c === null ? frameAt(ticker.get(), seconds, clip.frames) : null,
                  )
                }
                className="pill px-3 py-1 text-xs accent-hover"
              >
                {running ? "Pause" : "Play"}
              </button>
              <input
                type="range"
                min={0}
                max={clip.frames - 1}
                step={1}
                value={held ?? 0}
                onChange={(e) => holdAt(Number(e.target.value))}
                aria-label="Scrub the clip"
                className="h-1 flex-1 accent-foreground"
              />
              <span className="tabular-nums text-xs text-muted">
                {/* While it runs there is no frame to name — the number would
                    have to re-render sixty times a second to be true, which is
                    the one thing the ticker exists to avoid. */}
                {running ? `${clip.frames} frames` : `${(held ?? 0) + 1}/${clip.frames}`}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <button
                  onClick={() => step(-1)}
                  aria-label="Previous frame"
                  className="pill px-2 py-0.5 accent-hover"
                >
                  ‹
                </button>
                <button
                  onClick={() => step(1)}
                  aria-label="Next frame"
                  className="pill px-2 py-0.5 accent-hover"
                >
                  ›
                </button>
                frame by frame
              </span>
              <span className="tabular-nums">
                {clipcode(clip.in)}–{clipcode(clip.out)} · {seconds.toFixed(1)}s ·{" "}
                {Math.round(clip.frames / seconds)}fps
              </span>
              {clip.origin === "hand" && <span>picked by hand</span>}
              <span className="ml-auto">
                {position.index + 1} of {position.total}
              </span>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto card p-4 md:p-5 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-serif text-xl md:text-2xl">{item.projectTitle}</h2>
            <p className="text-xs text-muted">
              {[item.credit || "Uncredited", item.year].filter(Boolean).join(" · ")}
            </p>
          </div>

          {clip.note && (
            <p className="max-w-2xl text-sm leading-relaxed">{clip.note}</p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {[...clip.subject, ...clip.technique, ...(clip.feel ?? []), ...(clip.tags ?? [])].map(
              (value) => (
                <span key={value} className="pill px-2.5 py-0.5 text-xs">
                  {value}
                </span>
              ),
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            {moment && (
              <a
                href={moment}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 accent-hover-text transition-colors"
              >
                Watch the moment
              </a>
            )}
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 accent-hover-text transition-colors"
              >
                The project
              </a>
            )}
            <a
              href={`/clips/${item.projectId}`}
              className="underline underline-offset-4 accent-hover-text transition-colors"
            >
              Every clip from this
            </a>
            <button
              onClick={onClose}
              className="ml-auto underline underline-offset-4 accent-hover-text transition-colors"
            >
              Close
            </button>
          </div>
          <p className="text-xs text-muted">
            ← → step a frame · space runs it · shift + ← → for the next clip
          </p>
        </div>
      </div>
    </div>
  );
}
