// Getting a piece out.
//
// The rule that makes this trustworthy: **a recording is a function of the
// frame number, never of the wall clock.** Every frame is drawn at its exact
// moment — frame i of n is p = i/n — into an offscreen canvas at the export
// size, and the stream is driven by hand rather than by filming the page. Two
// exports of the same piece are identical, a slow machine produces the same
// file as a fast one, and the last frame meets the first because p never
// reaches 1.
//
// That is only possible because every scene is periodic in p and reads no
// clock of its own. It is the whole reason the loop is a contract in this
// studio rather than a hope.

import { FORMATS, type KineticSpec } from "@/lib/kinetics";
import { paint } from "./scenes";

export type Job = { label: string; frac: number } | null;

const stamp = (spec: KineticSpec) =>
  `${spec.scene}-${spec.text.split("\n")[0].slice(0, 24).replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "piece"}`;

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function surface(spec: KineticSpec, scale: number) {
  const { w, h } = FORMATS[spec.format];
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  return { canvas, ctx: canvas.getContext("2d")!, w: canvas.width, h: canvas.height };
}

/** One frame, at the moment showing. */
export async function exportPng(spec: KineticSpec, p: number, scale: number) {
  const { canvas, ctx, w, h } = surface(spec, scale);
  paint(ctx, spec, p, w, h);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (blob) save(blob, `${stamp(spec)}.png`);
}

const mime = () => {
  for (const t of ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
};

export const canRecord = () =>
  typeof MediaRecorder !== "undefined" && !!mime();

/**
 * The loop as a film.
 *
 * `captureStream(0)` gives a stream nothing is pushed to until we say so, and
 * `requestFrame` is that say-so — so the recorder receives exactly `fps ×
 * seconds` frames, each drawn at its own p, whatever the machine was doing at
 * the time.
 */
export async function recordVideo(
  spec: KineticSpec,
  scale: number,
  fps: number,
  onProgress: (frac: number) => void,
): Promise<void> {
  const type = mime();
  if (!type) throw new Error("This browser can't record video — export the PNG instead.");
  const { canvas, ctx, w, h } = surface(spec, scale);
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const rec = new MediaRecorder(stream, {
    mimeType: type,
    videoBitsPerSecond: 12_000_000,
  });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((res) => {
    rec.onstop = () => res();
  });
  rec.start();

  const total = Math.max(1, Math.round(spec.duration * fps));
  for (let i = 0; i < total; i++) {
    /* i/total, never i/(total-1): the last frame must not be the first one
       again or the loop stutters by exactly one frame. */
    paint(ctx, spec, i / total, w, h);
    track.requestFrame();
    onProgress(i / total);
    /* Yield so the recorder can drain, and so the page stays alive. */
    await new Promise((r) => setTimeout(r, 0));
  }
  await new Promise((r) => setTimeout(r, 120));
  rec.stop();
  await done;
  save(new Blob(chunks, { type }), `${stamp(spec)}.webm`);
  onProgress(1);
}

/* MediaRecorder's own type for the pushed-frame API, which lib.dom doesn't
   carry on the base MediaStreamTrack. */
interface CanvasCaptureMediaStreamTrack extends MediaStreamTrack {
  requestFrame: () => void;
}

/** Every frame as a PNG, for anyone who'd rather assemble it themselves. */
export async function exportFrames(
  spec: KineticSpec,
  scale: number,
  count: number,
  onProgress: (frac: number) => void,
) {
  const { canvas, ctx, w, h } = surface(spec, scale);
  for (let i = 0; i < count; i++) {
    paint(ctx, spec, i / count, w, h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    if (blob) save(blob, `${stamp(spec)}-${String(i).padStart(3, "0")}.png`);
    onProgress((i + 1) / count);
    await new Promise((r) => setTimeout(r, 30));
  }
}
