"use client";

/* eslint-disable @next/next/no-img-element -- the extractor already wrote the
   two sizes each still needs (see scripts/stills/extract.mjs), so these are
   pre-sized static files. Running them through next/image would spend Vercel
   transformations to produce what is already on disk. */

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { hasSource, momentUrl, timecode } from "@/lib/stills-shared";
import type { StillsSource } from "@/lib/stills-shared";

/** What the lightbox needs to know about the still it is showing. Deliberately
 *  not a Frame or a WallFrame: the wall and a project page hold their frames
 *  in different shapes, and both can fill this in. */
export type LightboxItem = {
  src: string;
  w: number;
  h: number;
  t: number;
  origin?: "auto" | "hand";
  projectId: string;
  projectTitle: string;
  credit: string;
  year: string;
  source: StillsSource;
  /** The studio's page for the work, when there is one. */
  link?: string;
};

export default function Lightbox({
  item,
  onClose,
  onStep,
  position,
}: {
  item: LightboxItem;
  onClose: () => void;
  /** -1 and 1. Absent when there is nothing to step through. */
  onStep?: (delta: number) => void;
  position?: { index: number; total: number };
}) {
  const handleKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onStep?.(-1);
      if (event.key === "ArrowRight") onStep?.(1);
    },
    [onClose, onStep],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    // The wall behind is long; letting it scroll under the overlay loses your
    // place the moment you close it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previous;
    };
  }, [handleKey]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${item.projectTitle} at ${timecode(item.t)}`}
      className="fixed inset-0 z-50 flex flex-col bg-foreground/95"
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-4 px-5 md:px-6 py-4 text-background text-xs">
        <p>
          {position ? `${position.index + 1} / ${position.total}` : ""}
        </p>
        <button
          onClick={onClose}
          className="underline underline-offset-4 hover:opacity-60 transition-opacity"
        >
          Close
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center px-5 md:px-6">
        <img
          src={item.src}
          alt={`Style frame from ${item.projectTitle} at ${timecode(item.t)}`}
          width={item.w}
          height={item.h}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        className="px-5 md:px-6 py-5 text-background"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div>
            <p className="font-serif text-xl md:text-2xl">
              <Link
                href={`/stills/${item.projectId}`}
                className="hover:underline underline-offset-4"
              >
                {item.projectTitle}
              </Link>
            </p>
            <p className="mt-1 text-xs text-background/60">
              {[item.credit, item.year].filter(Boolean).join(" · ")}
              {item.origin === "hand" && " · picked by hand"}
            </p>
          </div>
          <div className="flex items-center gap-5 text-xs">
            {onStep && (
              <span className="flex items-center gap-3">
                <button
                  onClick={() => onStep(-1)}
                  aria-label="Previous frame"
                  className="hover:opacity-60 transition-opacity"
                >
                  ←
                </button>
                <button
                  onClick={() => onStep(1)}
                  aria-label="Next frame"
                  className="hover:opacity-60 transition-opacity"
                >
                  →
                </button>
              </span>
            )}
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:opacity-60 transition-opacity"
              >
                The project →
              </a>
            )}
            {hasSource(item.source) ? (
              <a
                href={momentUrl(item.source, item.t)}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:opacity-60 transition-opacity"
              >
                Watch at {timecode(item.t)} →
              </a>
            ) : (
              <span className="text-background/60">{timecode(item.t)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
