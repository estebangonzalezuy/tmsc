"use client";

// Getting a post out: a still, a clip, a GIF — one slide or all of them.
//
// Shared by the studio and by every tool, because "export" has to mean exactly
// the same thing in both. The batch runner is the fiddly part: each slide has
// to be made current, remount, and finish rendering before it can be captured,
// which is why this is a hook holding a job rather than a plain function.

import { useState } from "react";
import { FORMATS, type PostSpec } from "@/lib/postlab";
import { drawOverlay, type Fonts } from "./overlay";
import { exportPng, recordGif, recordVideo } from "./exporter";
import { loadSlidePhotos } from "./photos";
import { loadSlideClips } from "./clips";

export type Quality = "mid" | "high" | "max";

export function useExports({
  spec,
  index,
  fonts,
  shaderBoxRef,
  overlayRef,
  setIndex,
  say,
}: {
  spec: PostSpec;
  index: number;
  fonts: Fonts | null;
  shaderBoxRef: React.RefObject<HTMLDivElement | null>;
  overlayRef: React.RefObject<HTMLCanvasElement | null>;
  setIndex: (i: number) => void;
  say: (msg: string) => void;
}) {
  const [job, setJob] = useState<{ label: string; frac: number } | null>(null);
  /* An export setting, not a design one, so it stays out of the spec and out
     of shared links. */
  const [quality, setQuality] = useState<Quality>("high");

  /* 1080 is the Instagram baseline; "max" targets 4K on the long-ish edge. */
  const scale = quality === "mid" ? 1 : quality === "high" ? 2 : 3840 / 1080;
  const outW = Math.round(FORMATS[spec.format].w * scale);
  const outH = Math.round(FORMATS[spec.format].h * scale);

  const layerCanvases = () => {
    const wrappers = shaderBoxRef.current?.querySelectorAll("[data-layer]");
    return Array.from(wrappers ?? []).map((el) => el.querySelector("canvas"));
  };

  const savePng = async () => {
    if (!overlayRef.current) return;
    await loadSlidePhotos(spec.slides[index]?.layers ?? []);
    await loadSlideClips(spec.slides[index]?.layers ?? []);
    exportPng(spec, index, layerCanvases(), overlayRef.current, fonts, scale);
  };

  /* Walks the slides, letting each one remount and render before the per-slide
     export (PNG capture, video or GIF recording). */
  const eachSlide = async (
    label: string,
    fn: (i: number, report: (f: number) => void) => Promise<void> | void,
    only?: number,
  ) => {
    if (!fonts || job) return;
    const idx = only !== undefined ? [only] : spec.slides.map((_, i) => i);
    try {
      for (const i of idx) {
        const tag = idx.length > 1 ? `${label} ${i + 1}/${idx.length}` : label;
        setJob({ label: tag, frac: 0 });
        setIndex(i);
        /* Nothing gets exported holding a picture that hasn't decoded. */
        await loadSlidePhotos(spec.slides[i]?.layers ?? []);
        await loadSlideClips(spec.slides[i]?.layers ?? []);
        await new Promise((r) => setTimeout(r, 600));
        await fn(i, (f) => setJob({ label: tag, frac: f }));
      }
      say("Saved");
    } catch {
      say(`${label} export failed in this browser`);
    } finally {
      setJob(null);
    }
  };

  const pngSlide = (i: number) => {
    const overlay = overlayRef.current;
    if (!overlay || !fonts) return;
    const ctx = overlay.getContext("2d");
    if (ctx) drawOverlay(ctx, spec, i, fonts, 0);
    exportPng(spec, i, layerCanvases(), overlay, fonts, scale);
  };

  return {
    job,
    quality,
    setQuality,
    outW,
    outH,
    savePng,
    saveAllPngs: () => eachSlide("PNG", pngSlide),
    saveVideo: () =>
      eachSlide(
        "Video",
        (i, rep) => recordVideo(spec, i, layerCanvases(), fonts!, rep, scale),
        index,
      ),
    saveAllVideos: () =>
      eachSlide("Video", (i, rep) =>
        recordVideo(spec, i, layerCanvases(), fonts!, rep, scale),
      ),
    saveGif: () =>
      eachSlide(
        "GIF",
        (i, rep) => recordGif(spec, i, layerCanvases(), fonts!, rep, scale),
        index,
      ),
    saveAllGifs: () =>
      eachSlide("GIF", (i, rep) =>
        recordGif(spec, i, layerCanvases(), fonts!, rep, scale),
      ),
  };
}
