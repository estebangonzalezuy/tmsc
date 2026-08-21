// Cutting style frames out of a video file, in the browser.
//
// The decoder, the seek that cannot hang and the cut finder live in
// lib/video.ts now — the Clips needs all three to cut filmstrips out of the
// same kind of file, and two copies of that seek is two places for its two
// documented hangs to come back. What is left here is the part that is about a
// *still*: three sizes of one moment, written as WebP.
//
// Candidates are found by differencing downscaled frames: the browser's answer
// to a scene-detection filter. What happens to those candidates afterwards —
// the spread across the timeline, the black-and-flat test — lives in
// lib/stills-shared.ts, next to everything else the site reasons about.

import {
  SCAN_H,
  SCAN_W,
  canvas,
  findCuts,
  greySamples,
  pictureType,
  seek,
  toBlob,
  type LocalVideo,
  type Progress,
} from "@/lib/video";
import {
  chooseTimes,
  frameId,
  greyStats,
  isWorthKeeping,
} from "@/lib/stills-shared";
import type { Frame } from "@/lib/stills-shared";

export { closeVideo, findCuts, openVideo } from "@/lib/video";
export type { LocalVideo, Progress } from "@/lib/video";

const FULL_WIDTH = 1600;
/* A middle rung, so a project-page cell (roughly 500 CSS pixels, doubled on a
   retina screen) is served something close to its size instead of choosing
   between a soft 400 and a wasteful 1600. */
const MID_WIDTH = 900;
const THUMB_WIDTH = 400;

export type ExtractResult = {
  frames: Frame[];
  /** Blobs to commit, keyed by the filename the project refers to. */
  files: Map<string, Blob>;
  rejected: number;
};

/** Cuts one moment at full size and thumb size. */
async function cutFrame(
  video: LocalVideo,
  t: number,
  sizes: { full: HTMLCanvasElement; mid: HTMLCanvasElement; thumb: HTMLCanvasElement },
  origin: "auto" | "hand",
): Promise<{ frame: Frame; files: Map<string, Blob> }> {
  const { full, mid, thumb } = sizes;
  await seek(video.el, t);
  for (const c of [full, mid, thumb]) {
    c.getContext("2d")!.drawImage(video.el, 0, 0, c.width, c.height);
  }

  const id = frameId(t);
  const { type, ext } = pictureType(full);

  const files = new Map<string, Blob>();
  files.set(`${id}.${ext}`, await toBlob(full, type, 0.82));
  files.set(`${id}.mid.${ext}`, await toBlob(mid, type, 0.8));
  files.set(`${id}.thumb.${ext}`, await toBlob(thumb, type, 0.75));

  return {
    files,
    frame: {
      id,
      t: Number(t.toFixed(3)),
      file: `${id}.${ext}`,
      mid: `${id}.mid.${ext}`,
      thumb: `${id}.thumb.${ext}`,
      w: full.width,
      h: full.height,
      origin,
    },
  };
}

/** The three canvases a cut writes into, sized once per run rather than per
 *  frame — allocating three canvases forty times is forty times the garbage. */
function sizeSet(video: LocalVideo) {
  const at = (width: number) => {
    const scale = Math.min(1, width / video.width);
    return canvas(
      Math.round(video.width * scale),
      Math.round(video.height * scale),
    );
  };
  return { full: at(FULL_WIDTH), mid: at(MID_WIDTH), thumb: at(THUMB_WIDTH) };
}

/** The whole first pass: find the cuts, keep a spread of them, cut those
 *  frames. */
export async function extractSuggested(
  video: LocalVideo,
  count: number,
  onProgress?: Progress,
): Promise<ExtractResult> {
  const cuts = await findCuts(video, onProgress);
  const wanted = chooseTimes(cuts, video.duration, count);

  const sizes = sizeSet(video);
  const scratch = canvas(SCAN_W, SCAN_H);

  const frames: Frame[] = [];
  const files = new Map<string, Blob>();
  let rejected = 0;

  for (const [i, t] of wanted.entries()) {
    await seek(video.el, t);
    // Same test the Actions extractor applied, on the same kind of sample.
    if (!isWorthKeeping(greyStats(greySamples(video, scratch)))) {
      rejected++;
      continue;
    }
    const cut = await cutFrame(video, t, sizes, "auto");
    frames.push(cut.frame);
    for (const [name, blob] of cut.files) files.set(name, blob);
    onProgress?.("Cutting the frames", i + 1, wanted.length);
  }

  return { frames, files, rejected };
}

/** The second pass: exactly these moments, no filtering. A frame picked by
 *  hand is wanted whatever its histogram says. */
export async function extractTimes(
  video: LocalVideo,
  times: number[],
  onProgress?: Progress,
): Promise<{ frames: Frame[]; files: Map<string, Blob> }> {
  const sizes = sizeSet(video);
  const frames: Frame[] = [];
  const files = new Map<string, Blob>();
  for (const [i, t] of times.entries()) {
    const cut = await cutFrame(video, t, sizes, "hand");
    frames.push(cut.frame);
    for (const [name, blob] of cut.files) files.set(name, blob);
    onProgress?.("Cutting the frames", i + 1, times.length);
  }
  return { frames, files };
}
