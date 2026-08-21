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

/** One range → one sheet, one poster, one record. */
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

  for (let i = 0; i < frames; i++) {
    /* Never landing on `out`: the frame after the last one is the first one. */
    await seek(video.el, inT + (i / frames) * span);
    const x = (i % cols) * tile.w;
    const y = Math.floor(i / cols) * tile.h;
    sheetCtx.drawImage(video.el, x, y, tile.w, tile.h);
    if (i === 0) posterCtx.drawImage(video.el, 0, 0, tile.w, tile.h);
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

  return {
    files,
    clip: {
      id,
      in: Number(inT.toFixed(3)),
      out: Number(outT.toFixed(3)),
      file: `${id}.${ext}`,
      poster: `${id}.poster.${ext}`,
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
