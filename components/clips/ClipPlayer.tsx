"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ClipCanvas from "@/components/clips/ClipCanvas";
import { clipSeconds, type WallClip } from "@/lib/clips-shared";

// A clip at the size you actually want to look at one.
//
// The wall draws the sheet, because forty filmstrips animate at once and a
// sheet has no decoder. Here there is one clip and it is large, which is the
// other half of the bargain: a sheet cannot hold thirty-six frames at 1280px
// (the canvas would be past what iOS will allocate), so what plays here is the
// video the Cutter wrote beside it.
//
// **Stepping still works.** The video was encoded from the same thirty-six
// samples as the sheet, in the same pass, so stepping walks the clip one cut
// frame at a time. It is not exact to the sheet's own index and cannot be:
// MediaRecorder timestamps by the wall clock, so the gaps between frames are
// however long each seek took, and indexing them uniformly drifts by up to a
// frame. Measured at about ±1. Nothing ever shows both assets at once — the
// sheet is the wall, the video is here — so that drift is invisible, and the
// alternative (shipping thirty-six timestamps per clip in the wall's payload)
// buys nobody anything.
//
// A clip cut before there were videos, or on a browser whose MediaRecorder
// refused, simply has no `video`. Then this is the sheet, exactly as before.

export default function ClipPlayer({
  clip,
  src,
  sheet,
  poster,
  alt,
  running,
  /** Which frame to hold on. Ignored while running. */
  frame,
  className = "",
}: {
  clip: WallClip;
  /** The video, or "" when this clip hasn't got one. */
  src: string;
  sheet: string;
  poster: string;
  alt: string;
  running: boolean;
  frame: number;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  /* How much of the recording is the clip.
  
     Not the file's own duration: the muxer needs the last frame to have a
     moment of its own, so a file always runs past its content. Indexing frames
     against `duration` therefore landed late — measurably, the video showed a
     moment two frames ahead of the sheet's. The Cutter writes down what it
     actually recorded; the file's duration is only the fallback for clips cut
     before it did. */
  const content = useCallback(() => {
    if (clip.videoSeconds) return clip.videoSeconds;
    const el = ref.current;
    return el && Number.isFinite(el.duration) ? el.duration : clipSeconds(clip);
  }, [clip]);

  /** Where frame `i` sits in the recording. Mid-frame, so rounding never lands
   *  on the join between two of them. */
  const timeOf = useCallback(
    (i: number) => ((i + 0.5) / clip.frames) * content(),
    [clip, content],
  );

  const usable = Boolean(src) && !failed;

  useEffect(() => {
    const el = ref.current;
    if (!el || !usable || !ready) return;
    if (running) {
      /* The same correction for playback: the Cutter paces its pushes at the
         clip's own frame rate, but a machine whose seeks are slower than a
         frame is long still writes a recording longer than the clip. Playing it
         faster puts the motion back at the tempo it was cut at, which is the
         one thing a reference library must not get wrong. */
      const wanted = clipSeconds(clip);
      const total = content();
      el.playbackRate = total > 0 ? Math.min(4, Math.max(0.25, total / wanted)) : 1;
      void el.play().catch(() => {});

      /* Loop on the *content*, not on the file. `loop` on the element would
         replay the muxer's tail — the held last frame — as a hitch at the end
         of every pass. The loop is a contract everywhere else in the club; it
         is one here too. rAF rather than `timeupdate`, which only fires about
         four times a second and would miss a tail this short. */
      let raf = 0;
      const wrap = () => {
        if (el.currentTime >= total - 0.001) el.currentTime = 0;
        raf = requestAnimationFrame(wrap);
      };
      raf = requestAnimationFrame(wrap);
      return () => cancelAnimationFrame(raf);
    }
    el.pause();
    el.currentTime = timeOf(frame);
  }, [running, frame, usable, ready, timeOf, content, clip]);

  if (!usable) {
    return (
      <ClipCanvas
        clip={clip}
        sheet={sheet}
        poster={poster}
        alt={alt}
        active={running}
        {...(running ? {} : { frame })}
        className={className}
      />
    );
  }

  return (
    <span
      style={{ aspectRatio: `${clip.w} / ${clip.h}` }}
      className={`relative block overflow-hidden ${className}`}
    >
      {/* The poster carries the first paint, so opening a clip is never a hole
          in the page while a few hundred kilobytes arrive. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- the Cutter wrote
          this file at the size it is shown; there is nothing to optimise. */}
      <img
        src={poster}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <video
        ref={ref}
        src={src}
        muted
        playsInline
        preload="auto"
        onLoadedData={() => setReady(true)}
        onError={() => setFailed(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      />
    </span>
  );
}
