// Export pipeline: composites the slide's layer stack (shader / generative
// canvases with their blend modes and opacities) plus the overlay canvas
// into a full-resolution frame, then saves stills (PNG) or records the
// animation (MP4 where the browser supports it, WebM otherwise).

import { FORMATS, tones, type BlendMode, type PostSpec } from "@/lib/postlab";
import { drawOverlay, type Fonts } from "./overlay";

// CSS mix-blend-mode → canvas globalCompositeOperation (same names except
// "normal").
const compositeOp = (blend: BlendMode): GlobalCompositeOperation =>
  blend === "normal" ? "source-over" : blend;

function drawLayers(
  ctx: CanvasRenderingContext2D,
  spec: PostSpec,
  index: number,
  layerCanvases: (HTMLCanvasElement | null)[],
  w: number,
  h: number,
) {
  const slide = spec.slides[index];
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = tones(slide.theme).bg;
  ctx.fillRect(0, 0, w, h);
  slide.layers.forEach((layer, i) => {
    const canvas = layerCanvases[i];
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = compositeOp(layer.blend);
    if (canvas) {
      ctx.drawImage(canvas, 0, 0, w, h);
    } else {
      // "plain" layers render as a solid div in the preview
      ctx.fillStyle = tones(slide.theme).bg;
      ctx.fillRect(0, 0, w, h);
    }
  });
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function exportPng(
  spec: PostSpec,
  index: number,
  layerCanvases: (HTMLCanvasElement | null)[],
  overlay: HTMLCanvasElement,
) {
  const { w, h } = FORMATS[spec.format];
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  drawLayers(ctx, spec, index, layerCanvases, w, h);
  ctx.drawImage(overlay, 0, 0, w, h);
  out.toBlob((blob) => {
    if (blob)
      download(
        blob,
        spec.slides.length > 1
          ? `tmsc-post-${String(index + 1).padStart(2, "0")}.png`
          : "tmsc-post.png",
      );
  }, "image/png");
}

function pickMime(): { mime: string; ext: string } {
  const candidates: [string, string][] = [
    ["video/mp4;codecs=avc1", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [mime, ext] of candidates)
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime))
      return { mime, ext };
  return { mime: "", ext: "webm" };
}

/**
 * Record `spec.duration` seconds of the animated slide. The layer canvases
 * keep animating on their own; each frame we re-composite them (with blends)
 * under a freshly drawn overlay (so the orbit ring spins too).
 */
export function recordVideo(
  spec: PostSpec,
  index: number,
  layerCanvases: (HTMLCanvasElement | null)[],
  fonts: Fonts,
  onProgress: (fraction: number) => void,
): Promise<void> {
  const { w, h } = FORMATS[spec.format];
  const fps = 30;
  const durationMs = spec.duration * 1000;

  const overlay = document.createElement("canvas");
  overlay.width = w;
  overlay.height = h;
  const overlayCtx = overlay.getContext("2d")!;

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;

  const { mime, ext } = pickMime();
  // captureStream(0) + requestFrame(): frames are pushed explicitly after
  // each draw, which records reliably even when the canvas is off-DOM.
  const stream = out.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const recorder = new MediaRecorder(stream, {
    ...(mime ? { mimeType: mime } : {}),
    videoBitsPerSecond: 12_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  return new Promise((resolve, reject) => {
    let raf = 0;
    let lastPush = -Infinity;
    const start = performance.now();

    recorder.onstop = () => {
      cancelAnimationFrame(raf);
      onProgress(0);
      const blob = new Blob(chunks, { type: mime || "video/webm" });
      if (!blob.size) {
        reject(new Error("Recorder produced no data"));
        return;
      }
      download(blob, `tmsc-reel.${ext}`);
      resolve();
    };
    recorder.onerror = () => reject(new Error("Recording failed"));

    // Frames are wall-clock timestamped by the muxer, so the clip length is
    // governed by elapsed time; pacing pushes to ≤30fps keeps the encoder
    // from being flooded (which silently drops frames).
    const frame = (now: number) => {
      const elapsed = now - start;
      if (now - lastPush >= 1000 / fps - 1) {
        lastPush = now;
        drawOverlay(overlayCtx, spec, index, fonts, elapsed / 1000);
        drawLayers(ctx, spec, index, layerCanvases, w, h);
        ctx.drawImage(overlay, 0, 0, w, h);
        track.requestFrame();
        onProgress(Math.min(1, elapsed / durationMs));
      }
      if (elapsed >= durationMs) {
        recorder.stop();
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    // 1s timeslice makes the encoder flush as it goes instead of only at stop.
    recorder.start(1000);
    raf = requestAnimationFrame(frame);
  });
}
