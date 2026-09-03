"use client";

// Getting a post out: a still, a video, a GIF — one frame or every frame in
// the showreel. Retargeted from the old slide-array walk to
// showreelFrames(graph, showreelId): each iteration renders that frame
// node's own ancestor subgraph directly (no DOM canvas query — the graph
// already produces the final composited image, so there's no separate
// "layers then type" step left to walk).

import { useState } from "react";
import { FORMATS, ancestorSubgraph, showreelFrames, type PostGraph } from "@/lib/postgraph";
import { exportFramePng, recordGif, recordVideo } from "./exporter";
import { loadSlidePhotos } from "./photos";
import { loadSlideClips } from "./clips";

export type Quality = "mid" | "high" | "max";

export function useExports({ graph, showreelId, say }: { graph: PostGraph; showreelId: string | null; say: (msg: string) => void }) {
  const [job, setJob] = useState<{ label: string; frac: number } | null>(null);
  /* An export setting, not a design one, so it stays out of the graph and
     out of shared links. */
  const [quality, setQuality] = useState<Quality>("high");

  /* 1080 is the Instagram baseline; "max" targets 4K on the long-ish edge. */
  const scale = quality === "mid" ? 1 : quality === "high" ? 2 : 3840 / 1080;
  const outW = Math.round(FORMATS[graph.format].w * scale);
  const outH = Math.round(FORMATS[graph.format].h * scale);

  const frames = showreelId ? showreelFrames(graph, showreelId) : [];

  /* Nothing gets exported holding a picture or a film that hasn't decoded
     yet — every photo node the frame depends on, resolved before capture. */
  const preload = async (frameId: string) => {
    const photos = ancestorSubgraph(graph, frameId)
      .filter((n) => n.kind === "photo")
      .map((n) => ({ src: typeof n.params.src === "string" ? n.params.src : undefined }));
    await loadSlidePhotos(photos);
    await loadSlideClips(photos);
  };

  const eachFrame = async (
    label: string,
    fn: (id: string, index: number, total: number, report: (f: number) => void) => Promise<void> | void,
    only?: string,
  ) => {
    if (job || !frames.length) return;
    const ids = only ? [only] : frames;
    try {
      for (const id of ids) {
        const i = frames.indexOf(id);
        const tag = ids.length > 1 ? `${label} ${i + 1}/${frames.length}` : label;
        setJob({ label: tag, frac: 0 });
        await preload(id);
        await new Promise((r) => setTimeout(r, 300));
        await fn(id, i, frames.length, (f) => setJob({ label: tag, frac: f }));
      }
      say("Saved");
    } catch {
      say(`${label} export failed in this browser`);
    } finally {
      setJob(null);
    }
  };

  return {
    job,
    quality,
    setQuality,
    outW,
    outH,
    frames,
    savePng: (frameId: string) => eachFrame("PNG", (id, i, total) => exportFramePng(graph, id, i, total, scale), frameId),
    saveAllPngs: () => eachFrame("PNG", (id, i, total) => exportFramePng(graph, id, i, total, scale)),
    saveVideo: (frameId: string) => eachFrame("Video", (id, i, total, rep) => recordVideo(graph, id, i, total, rep, scale), frameId),
    saveAllVideos: () => eachFrame("Video", (id, i, total, rep) => recordVideo(graph, id, i, total, rep, scale)),
    saveGif: (frameId: string) => eachFrame("GIF", (id, i, total, rep) => recordGif(graph, id, i, total, rep, scale), frameId),
    saveAllGifs: () => eachFrame("GIF", (id, i, total, rep) => recordGif(graph, id, i, total, rep, scale)),
  };
}
