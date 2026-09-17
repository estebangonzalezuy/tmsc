"use client";

import type { ReactNode, RefObject } from "react";

/* The shell every interactive figure shares. A card: the stage on top, on
   the white surface, at a fixed aspect when the figure draws and at its own
   height when it is set type; the controls underneath in an inset, because a
   second card inside a card is white on white; and the caption below the
   card in the same muted size SpecBlock uses.

   The stage is a size container, so a figure that sets real type can size it
   in `cqw` and stay in proportion from a phone to a desktop column. */

export default function Figure({
  stage,
  stageRef,
  aspect = "16 / 10",
  controls,
  caption,
  readout,
}: {
  stage: ReactNode;
  /** The element useLoop watches for being on screen. */
  stageRef?: RefObject<HTMLDivElement | null>;
  /** CSS aspect-ratio for the stage, or null to let the content set the height. */
  aspect?: string | null;
  controls?: ReactNode;
  caption?: string;
  /** A live one-liner about the current settings, right of the caption. */
  readout?: ReactNode;
}) {
  return (
    <figure className="mt-12">
      <div className="card overflow-hidden">
        <div
          ref={stageRef}
          className="relative w-full overflow-hidden select-none"
          style={{ aspectRatio: aspect ?? undefined, containerType: "inline-size" }}
        >
          {stage}
        </div>
        {controls && (
          <div className="inset mx-3 mb-3 mt-1 px-4 py-3 flex flex-col gap-2.5">
            {controls}
          </div>
        )}
      </div>
      {(caption || readout) && (
        <figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted">
          <span>{caption}</span>
          {readout && <span className="tabular-nums">{readout}</span>}
        </figcaption>
      )}
    </figure>
  );
}
