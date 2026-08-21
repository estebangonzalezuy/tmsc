// Cutting a filmstrip out of a video file, in the browser.
//
// The decoder and the seek that cannot hang are in lib/video.ts; this is the
// part that is about a *clip*. A range in, a sheet out: n frames tiled into one
// WebP, plus the first of them on its own as a poster.
//
// Two decisions are the whole of it.
//
// **The last frame runs into the first.** Frame i is sampled at
// `in + (i / n) · (out - in)`, so the sampling never lands on `out` — the frame
// after the last one is the first one again. That is what makes a clip loop
// with no seam, and it is the same arithmetic components/postlab/clips.ts uses
// to decode a film for the Posts Studio.
//
// **The sheet is a grid, not a strip.** A 36-frame strip one row high is
// 14,400px wide and past what several browsers will allocate. Six columns keeps
// every sheet inside 2400 × 1350 at the tile size, which is comfortable
// everywhere and still a real picture at wall size.

import {
  MAX_SECONDS,
  MIN_SECONDS,
  SHEET_COLS,
  TILE_EDGE,
  VIDEO_BITRATE,
  VIDEO_EDGE,
  clipId,
  frameCount,
  type Clip,
} from "@/lib/clips-shared";
import {
  canvas,
  pictureType,
  seek,
  toBlob,
  type LocalVideo,
  type Progress,
} from "@/lib/video";

/** Quality for the sheet. A filmstrip is a lot of intra-coded frames, so this
 *  number is most of the weight the club commits; 0.72 is where the motion
 *  still reads and the file stops doubling. */
const SHEET_QUALITY = 0.72;
const POSTER_QUALITY = 0.75;

/** mp4 where the browser will write it — it plays everywhere — and WebM where
 *  it won't. The extension travels in the clip's `video` field, so nothing
 *  downstream has to guess which one it got. */
function pickMime(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates: [string, string][] = [
    ["video/mp4;codecs=avc1", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9", "webm"],
    ["video/webm;codecs=vp8", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [mime, ext] of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  }
  return null;
}

/** The video's size: the source's aspect at VIDEO_EDGE, never upscaled past
 *  what the film actually has, and even so the encoder is happy. */
function videoSize(video: LocalVideo): { w: number; h: number } {
  const w = video.width || 16;
  const h = video.height || 9;
  const scale = Math.min(1, VIDEO_EDGE / Math.max(w, h));
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return { w: even(w), h: even(h) };
}

export type CutResult = {
  clips: Clip[];
  /** Blobs to commit, keyed by the filename the project refers to. */
  files: Map<string, Blob>;
  /** Ranges that were asked for and were too short or too long to be a clip. */
  rejected: number;
};

/** The tile size for this film: the source's aspect, longest edge at TILE_EDGE,
 *  both even so a cell never lands on a half pixel. */
export function tileSize(video: LocalVideo): { w: number; h: number } {
  const w = video.width || 16;
  const h = video.height || 9;
  const scale = Math.min(1, TILE_EDGE / Math.max(w, h));
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return { w: even(w), h: even(h) };
}

/** Whether a range is a clip at all. Under the floor there is nothing to see;
 *  past the ceiling you are quoting the film rather than citing it. */
export const isCuttable = (inT: number, outT: number): boolean => {
  const span = outT - inT;
  return span >= MIN_SECONDS && span <= MAX_SECONDS + 0.001;
};

/**
 * One range → one sheet, one poster, one video, in a **single seek pass**.
 *
 * Seeking a decoded film is the expensive part, so the same seek feeds the
 * sheet cell, the poster and the recorder rather than walking the range three
 * times.
 *
 * The recorder is the reason this loop is paced. MediaRecorder timestamps
 * frames by the wall clock, not by how many you pushed — so a pass that seeks
 * faster than real time produces a video shorter than the clip, and one that
 * seeks slower produces a longer one. Waiting until each frame's own moment
 * before pushing it is what makes the recording come out the length it is
 * supposed to be. (The lightbox still corrects for a drifting recording, on
 * the machines where a seek is slower than a frame is long.)
 */
async function cutOne(
  video: LocalVideo,
  inT: number,
  outT: number,
  tile: { w: number; h: number },
  origin: "auto" | "hand",
  say?: Progress,
  step?: { done: number; total: number },
): Promise<{ clip: Clip; files: Map<string, Blob> }> {
  const span = outT - inT;
  const frames = frameCount(span);
  const cols = Math.min(SHEET_COLS, frames);
  const rows = Math.ceil(frames / cols);

  const sheet = canvas(cols * tile.w, rows * tile.h);
  const sheetCtx = sheet.getContext("2d")!;
  const poster = canvas(tile.w, tile.h);
  const posterCtx = poster.getContext("2d")!;

  /* The recorder, when this browser has one. Everything about it is optional:
     a clip with no video is a clip the lightbox draws from the sheet. */
  const codec = pickMime();
  const size = videoSize(video);
  const film = codec ? canvas(size.w, size.h) : null;
  const filmCtx = film?.getContext("2d") ?? null;
  const chunks: Blob[] = [];
  let recorder: MediaRecorder | null = null;
  let track: CanvasCaptureMediaStreamTrack | null = null;

  if (film && codec) {
    try {
      // captureStream(0) + requestFrame(): frames are pushed explicitly after
      // each draw, which records reliably even when the canvas is off-DOM.
      const stream = film.captureStream(0);
      track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
      recorder = new MediaRecorder(stream, {
        mimeType: codec.mime,
        videoBitsPerSecond: VIDEO_BITRATE,
      });
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    } catch {
      // A browser that advertises a codec and then refuses to record it is not
      // a reason to lose the clip.
      recorder = null;
    }
  }

  const started = performance.now();
  const frameMs = (span * 1000) / frames;
  /* When the first frame was pushed and when the last one was, so the clip can
     write down how much of the recording is actually the clip. `start()` is
     called against the first push rather than before the loop, or the first
     seek's cost becomes a gap at the head of the file. */
  let firstPush = 0;
  let lastPush = 0;

  for (let i = 0; i < frames; i++) {
    /* Never landing on `out`: the frame after the last one is the first one. */
    await seek(video.el, inT + (i / frames) * span);
    const x = (i % cols) * tile.w;
    const y = Math.floor(i / cols) * tile.h;
    sheetCtx.drawImage(video.el, x, y, tile.w, tile.h);
    if (i === 0) posterCtx.drawImage(video.el, 0, 0, tile.w, tile.h);

    if (recorder && filmCtx && track) {
      filmCtx.drawImage(video.el, 0, 0, size.w, size.h);
      const due = started + i * frameMs;
      const wait = due - performance.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (!firstPush) {
        recorder.start();
        firstPush = performance.now();
      }
      track.requestFrame();
      lastPush = performance.now();
    }

    say?.(
      step ? `Cutting clip ${step.done + 1}/${step.total}` : "Cutting the clip",
      i + 1,
      frames,
    );
  }

  const id = clipId(inT, outT);
  const { type, ext } = pictureType(sheet);

  const files = new Map<string, Blob>();
  files.set(`${id}.${ext}`, await toBlob(sheet, type, SHEET_QUALITY));
  files.set(`${id}.poster.${ext}`, await toBlob(poster, type, POSTER_QUALITY));

  let videoName: string | undefined;
  let videoSeconds: number | undefined;
  if (recorder && codec && firstPush) {
    /* The last frame needs a moment of its own or the muxer drops it, and the
       recorder needs a beat to flush. That tail is why the file runs past its
       content — so it is counted, not ignored. */
    await new Promise((r) => setTimeout(r, Math.max(frameMs, 60)));
    const stopped = new Promise<void>((r) => {
      recorder!.onstop = () => r();
    });
    recorder.stop();
    await stopped;
    const blob = new Blob(chunks, { type: codec.mime });
    if (blob.size) {
      videoName = `${id}.${codec.ext}`;
      files.set(videoName, blob);
      /* First push to last push is frames - 1 gaps; the last frame is worth one
         more. Pacing means this is never shorter than the clip, so the player's
         rate correction only ever has to slow a recording down. */
      videoSeconds = Number(
        Math.max(0.05, (lastPush - firstPush + frameMs) / 1000).toFixed(3),
      );
    }
  }

  return {
    files,
    clip: {
      id,
      in: Number(inT.toFixed(3)),
      out: Number(outT.toFixed(3)),
      file: `${id}.${ext}`,
      poster: `${id}.poster.${ext}`,
      ...(videoName ? { video: videoName } : {}),
      ...(videoSeconds ? { videoSeconds } : {}),
      cols,
      rows,
      frames,
      w: tile.w,
      h: tile.h,
      subject: [],
      technique: [],
      origin,
    },
  };
}

/** Cut exactly these ranges. Anything that isn't a clip is counted, not cut. */
export async function cutRanges(
  video: LocalVideo,
  ranges: { in: number; out: number }[],
  origin: "auto" | "hand",
  say?: Progress,
): Promise<CutResult> {
  const tile = tileSize(video);
  const wanted = ranges.filter((r) => isCuttable(r.in, r.out));

  const clips: Clip[] = [];
  const files = new Map<string, Blob>();

  for (const [i, range] of wanted.entries()) {
    const cut = await cutOne(video, range.in, range.out, tile, origin, say, {
      done: i,
      total: wanted.length,
    });
    clips.push(cut.clip);
    for (const [name, blob] of cut.files) files.set(name, blob);
  }

  return { clips, files, rejected: ranges.length - wanted.length };
}
