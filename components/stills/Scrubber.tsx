"use client";

import { useCallback, useEffect, useState } from "react";
import { scrubSrc, timecode } from "@/lib/stills-shared";
import type { ScrubStrip } from "@/lib/stills-shared";

// Scrubbing a video the browser is never allowed to touch.
//
// A YouTube or Vimeo embed hands back no pixels — the iframe is another
// origin and a canvas drawn from it is tainted, so "capture the current
// frame" is not a thing a page can do. The extractor solves it from the other
// side: while it has the file, it writes one 160px tile per second and packs
// them a hundred to a sheet. That's what this scrubs. You move through the
// whole film a second at a time, mark the moments worth having, and the
// second pass cuts those exact timestamps at full size.
//
// So the tiles are a contact sheet, not a player: low resolution on purpose,
// and never what ends up on the wall.

export default function Scrubber({
  projectId,
  assetBase,
  scrub,
  duration,
  marks,
  onMark,
  onUnmark,
}: {
  projectId: string;
  assetBase: string;
  scrub: ScrubStrip;
  duration: number;
  marks: number[];
  onMark: (t: number) => void;
  onUnmark: (t: number) => void;
}) {
  const [second, setSecond] = useState(0);
  const last = Math.max(0, scrub.count - 1);

  const step = useCallback(
    (delta: number) =>
      setSecond((s) => Math.min(last, Math.max(0, s + delta))),
    [last],
  );

  // Arrow keys are how you actually scrub. The range input handles them when
  // it has focus; this covers the rest of the panel.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(event.shiftKey ? -10 : -1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        step(event.shiftKey ? 10 : 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const perSheet = scrub.cols * scrub.rows;
  const sheet = Math.floor(second / perSheet);
  const within = second % perSheet;
  const col = within % scrub.cols;
  const row = Math.floor(within / scrub.cols);
  const file = scrub.files[sheet];

  // The classic sprite trick: size the background to the whole sheet in
  // percentages so it scales with the element, then position by tile index.
  const tileStyle = file
    ? {
        backgroundImage: `url(${scrubSrc(assetBase, projectId, file)})`,
        backgroundSize: `${scrub.cols * 100}% ${scrub.rows * 100}%`,
        backgroundPosition: `${scrub.cols > 1 ? (col / (scrub.cols - 1)) * 100 : 0}% ${
          scrub.rows > 1 ? (row / (scrub.rows - 1)) * 100 : 0
        }%`,
        aspectRatio: `${scrub.tileW} / ${scrub.tileH}`,
      }
    : undefined;

  const marked = marks.some((m) => Math.floor(m) === second);

  return (
    <div className="space-y-4">
      <div
        className="w-full border border-line bg-foreground/5 bg-no-repeat"
        style={tileStyle}
        role="img"
        aria-label={`Frame at ${timecode(second)}`}
      />

      <div className="flex items-center gap-3">
        <button
          onClick={() => step(-1)}
          aria-label="Back one second"
          className="border border-line px-3 py-1 text-xs hover:bg-foreground hover:text-background transition-colors"
        >
          ←
        </button>
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={second}
          onChange={(e) => setSecond(Number(e.target.value))}
          aria-label="Scrub the video"
          className="flex-1 accent-foreground"
        />
        <button
          onClick={() => step(1)}
          aria-label="Forward one second"
          className="border border-line px-3 py-1 text-xs hover:bg-foreground hover:text-background transition-colors"
        >
          →
        </button>
        <span className="w-24 shrink-0 text-right font-serif text-lg tabular-nums">
          {timecode(second)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => (marked ? onUnmark(second) : onMark(second))}
          className={`border border-line px-4 py-2 text-sm transition-colors ${
            marked
              ? "bg-foreground text-background"
              : "hover:bg-foreground hover:text-background"
          }`}
        >
          {marked ? `Marked ${timecode(second)}` : `Mark ${timecode(second)}`}
        </button>
        <p className="text-xs text-muted">
          Arrow keys move a second, shift + arrows move ten. Of{" "}
          {timecode(duration)}.
        </p>
      </div>
    </div>
  );
}
