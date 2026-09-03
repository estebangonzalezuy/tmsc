// Export pipeline: render one `frame` node's ancestor subgraph at whatever
// instant is named and save it — a still (PNG), a recording (MP4 where the
// browser supports it, WebM otherwise), or a GIF.
//
// Every node kind in this pass is a pure canvas-2D function of `p` — there's
// no WebGL/live-clock node type to name as an exception, unlike the old
// model's Paper Shaders layers, whose own animation could only be recorded
// by watching it go past. So a recording here is *always* a function of the
// frame number: `canRenderDirectly` stays as a named predicate (useExports
// still calls it) but is trivially true, with this comment standing in for
// the branch the old exporter needed and this one doesn't.

import { FORMATS, ancestorSubgraph, renderFrame, type PostGraph } from "@/lib/postgraph";
import { PALETTE } from "@/lib/palette";
import { GifEncoder } from "./gif";

export const canRenderDirectly = () => true;

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const frameName = (base: string, index: number, total: number, ext: string) =>
  total > 1 ? `${base}-${String(index + 1).padStart(2, "0")}.${ext}` : `${base}.${ext}`;

function pickMime(): { mime: string; ext: string } {
  const candidates: [string, string][] = [
    ["video/mp4;codecs=avc1", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [mime, ext] of candidates)
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  return { mime: "", ext: "webm" };
}

/* Every colour a frame's ancestor subgraph can actually put on screen, for
   the GIF table — so a frame using a hand-picked ink still encodes as itself
   instead of being quantised to the nearest gray. */
function frameColours(graph: PostGraph, frameId: string): string[] {
  const seen = new Set<string>(PALETTE);
  for (const node of ancestorSubgraph(graph, frameId)) {
    const ink = node.params.ink;
    if (typeof ink === "string" && ink.startsWith("#")) seen.add(ink);
    const inks = node.params.inks;
    if (Array.isArray(inks)) for (const hex of inks) if (typeof hex === "string") seen.add(hex);
  }
  return [...seen].slice(0, 40);
}

/** Paint one frame node at loop position `p`, scaled to `w`x`h` — the small
    live thumbnails and the full-size stills both go through this. */
export function paintFrame(ctx: CanvasRenderingContext2D, graph: PostGraph, frameId: string, w: number, h: number, p = 0) {
  const canvas = renderFrame(graph, frameId, p, w, h);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(canvas, 0, 0, w, h);
}

export function exportFramePng(graph: PostGraph, frameId: string, index: number, total: number, scale = 1) {
  const base = FORMATS[graph.format];
  const w = Math.round(base.w * scale);
  const h = Math.round(base.h * scale);
  const canvas = renderFrame(graph, frameId, 0, w, h);
  canvas.toBlob((blob) => {
    if (blob) download(blob, frameName("tmsc-post", index, total, "png"));
  }, "image/png");
}

/**
 * Record `graph.duration` seconds of one frame node. Frame i of n is drawn
 * at exactly p = i/totalFrames, at full export resolution — never copied
 * from whatever the preview happens to be showing — so two exports of the
 * same graph are byte-identical.
 */
export function recordVideo(
  graph: PostGraph,
  frameId: string,
  index: number,
  total: number,
  onProgress: (fraction: number) => void,
  scale = 1,
): Promise<void> {
  const base = FORMATS[graph.format];
  const w = Math.round(base.w * scale);
  const h = Math.round(base.h * scale);
  const fps = 30;
  const totalFrames = Math.max(1, Math.round(graph.duration * fps));

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;

  const { mime, ext } = pickMime();
  const stream = out.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const recorder = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 12_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  return new Promise((resolve, reject) => {
    let raf = 0;
    let lastPush = -Infinity;
    let pushed = 0;

    recorder.onstop = () => {
      cancelAnimationFrame(raf);
      onProgress(0);
      const blob = new Blob(chunks, { type: mime || "video/webm" });
      if (!blob.size) {
        reject(new Error("Recorder produced no data"));
        return;
      }
      download(blob, frameName("tmsc-reel", index, total, ext));
      resolve();
    };
    recorder.onerror = () => reject(new Error("Recording failed"));

    const frame = (now: number) => {
      if (now - lastPush >= 1000 / fps - 1) {
        lastPush = now;
        paintFrame(ctx, graph, frameId, w, h, pushed / totalFrames);
        track.requestFrame();
        pushed++;
        onProgress(Math.min(1, pushed / totalFrames));
      }
      if (pushed >= totalFrames) {
        recorder.stop();
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    recorder.start(1000);
    raf = requestAnimationFrame(frame);
  });
}

/** Record `graph.duration` seconds as a GIF — grayscale-plus-palette table,
    half resolution, 12.5fps — drawn frame by frame as fast as the machine
    allows, at exactly the right instants. */
export function recordGif(
  graph: PostGraph,
  frameId: string,
  index: number,
  total: number,
  onProgress: (fraction: number) => void,
  scale = 1,
): Promise<void> {
  const base = FORMATS[graph.format];
  const gifScale = Math.min(2, scale);
  const w = Math.round(base.w * gifScale);
  const h = Math.round(base.h * gifScale);
  const gw = Math.round(w / 2);
  const gh = Math.round(h / 2);
  const delay = 8; // hundredths of a second -> 12.5fps

  const full = document.createElement("canvas");
  full.width = w;
  full.height = h;
  const fullCtx = full.getContext("2d")!;

  const small = document.createElement("canvas");
  small.width = gw;
  small.height = gh;
  const smallCtx = small.getContext("2d", { willReadFrequently: true })!;

  const gif = new GifEncoder(gw, gh, delay, frameColours(graph, frameId));
  const totalFrames = Math.max(1, Math.round((graph.duration * 100) / delay));

  return (async () => {
    for (let i = 0; i < totalFrames; i++) {
      paintFrame(fullCtx, graph, frameId, w, h, i / totalFrames);
      smallCtx.drawImage(full, 0, 0, gw, gh);
      gif.addFrame(smallCtx.getImageData(0, 0, gw, gh).data);
      onProgress((i + 1) / totalFrames);
      if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
    }
    download(gif.toBlob(), frameName("tmsc-post", index, total, "gif"));
    onProgress(0);
  })();
}
