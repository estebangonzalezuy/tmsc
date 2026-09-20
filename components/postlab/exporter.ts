// Getting a post out: a still (PNG), a recording (MP4 where the browser
// supports it, WebM otherwise), or a GIF.
//
// The pipeline knows nothing about what a post *is*. It is handed a `Sheet`:
// a size, a duration, the colours it can put on screen, and one function that
// paints the whole picture at a named instant. That is the only contract, and
// it is the same one the preview canvas uses, so what is exported is what was
// on screen — at export resolution, drawn again, never scraped off the
// preview.
//
// A recording is always a function of the frame number rather than a capture
// of the clock going past, so frame i of n is drawn at exactly p = i/n and
// two exports of the same poster are byte-identical.

import { PALETTE } from "@/lib/palette";
import { GifEncoder } from "./gif";

export type Sheet = {
  w: number;
  h: number;
  /** Seconds in one loop. */
  duration: number;
  /** Every colour the picture can use, for the GIF's table. */
  colours: string[];
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number, p: number) => void;
};

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function pickMime(): { mime: string; ext: string } {
  const candidates: [string, string][] = [
    ["video/mp4;codecs=avc1", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [mime, ext] of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) {
      return { mime, ext };
    }
  }
  return { mime: "", ext: "webm" };
}

function surface(w: number, h: number, readBack = false) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", readBack ? { willReadFrequently: true } : undefined)!;
  return { canvas, ctx };
}

const sized = (sheet: Sheet, scale: number) => ({
  w: Math.round(sheet.w * scale),
  h: Math.round(sheet.h * scale),
});

export function exportPng(sheet: Sheet, name = "tmsc-post", scale = 1): Promise<void> {
  const { w, h } = sized(sheet, scale);
  const { canvas, ctx } = surface(w, h);
  sheet.paint(ctx, w, h, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("PNG export produced no data"));
        return;
      }
      download(blob, `${name}.png`);
      resolve();
    }, "image/png");
  });
}

export function recordVideo(
  sheet: Sheet,
  onProgress: (fraction: number) => void,
  name = "tmsc-reel",
  scale = 1,
): Promise<void> {
  const { w, h } = sized(sheet, scale);
  const fps = 30;
  const totalFrames = Math.max(1, Math.round(sheet.duration * fps));
  const { canvas, ctx } = surface(w, h);

  const { mime, ext } = pickMime();
  const stream = canvas.captureStream(0);
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
    let pushed = 0;

    recorder.onstop = () => {
      cancelAnimationFrame(raf);
      onProgress(0);
      const blob = new Blob(chunks, { type: mime || "video/webm" });
      if (!blob.size) {
        reject(new Error("Recorder produced no data"));
        return;
      }
      download(blob, `${name}.${ext}`);
      resolve();
    };
    recorder.onerror = () => reject(new Error("Recording failed"));

    const frame = (now: number) => {
      if (now - lastPush >= 1000 / fps - 1) {
        lastPush = now;
        sheet.paint(ctx, w, h, pushed / totalFrames);
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

/** A GIF: half resolution, 12.5fps, drawn as fast as the machine allows at
    exactly the right instants. */
export function recordGif(
  sheet: Sheet,
  onProgress: (fraction: number) => void,
  name = "tmsc-post",
  scale = 1,
): Promise<void> {
  const gifScale = Math.min(2, scale);
  const { w, h } = sized(sheet, gifScale);
  const gw = Math.round(w / 2);
  const gh = Math.round(h / 2);
  const delay = 8; // hundredths of a second -> 12.5fps

  const full = surface(w, h);
  const small = surface(gw, gh, true);

  const colours = [...new Set([...PALETTE, ...sheet.colours])].slice(0, 40);
  const gif = new GifEncoder(gw, gh, delay, colours);
  const totalFrames = Math.max(1, Math.round((sheet.duration * 100) / delay));

  return (async () => {
    for (let i = 0; i < totalFrames; i++) {
      sheet.paint(full.ctx, w, h, i / totalFrames);
      small.ctx.drawImage(full.canvas, 0, 0, gw, gh);
      gif.addFrame(small.ctx.getImageData(0, 0, gw, gh).data);
      onProgress((i + 1) / totalFrames);
      if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
    }
    download(gif.toBlob(), `${name}.gif`);
    onProgress(0);
  })();
}
