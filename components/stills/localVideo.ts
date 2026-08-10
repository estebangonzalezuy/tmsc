// Cutting style frames out of a video file, in the browser.
//
// The thing that shapes the whole of the Stills is that a browser cannot take
// a frame out of a YouTube or Vimeo embed: the player is a cross-origin
// iframe and a canvas drawn from it is tainted. That is true of an *embed*.
// It is not true of a file you picked off your own disk — an object URL is
// same-origin, the canvas stays clean, and getImageData works.
//
// So a video you have is the one case that needs no runner, no yt-dlp, no
// cookies and no upload. Everything here happens on the machine you are
// sitting at, and only the finished frames are ever sent anywhere.
//
// The candidate-picking is deliberately the same as the Actions extractor's:
// both call chooseTimes in lib/stills-select.mjs, so a film curated here and
// a film curated there are curated the same way. Only the way candidates are
// *found* differs — ffmpeg scores scene changes, and this differences
// downscaled frames by hand, because that is what each side can do.

import {
  chooseTimes,
  frameId,
  greyStats,
  isWorthKeeping,
} from "@/lib/stills-select.mjs";
import type { Frame, ScrubStrip } from "@/lib/stills-shared";

/* Matches the Actions extractor so the two produce interchangeable projects. */
const FULL_WIDTH = 1600;
const THUMB_WIDTH = 400;
const SCRUB_WIDTH = 160;
const SCRUB_COLS = 10;
const SCRUB_ROWS = 10;
/* Frames per second sampled while hunting for cuts. Two is enough to catch a
   shot change and cheap enough to walk a five minute film in under a minute. */
const SCAN_FPS = 2;
/* Downscale used for both differencing and the black/flat test. Small on
   purpose: it is measuring change, not detail. */
const SCAN_W = 32;
const SCAN_H = 18;

export type LocalVideo = {
  el: HTMLVideoElement;
  url: string;
  duration: number;
  width: number;
  height: number;
};

export type ExtractResult = {
  frames: Frame[];
  /** Blobs to commit, keyed by the filename the project refers to. */
  files: Map<string, Blob>;
  scrub: ScrubStrip;
  rejected: number;
};

export type Progress = (stage: string, done: number, total: number) => void;

/** Loads a file into a detached <video> and waits until it can be seeked. */
export function openVideo(file: File): Promise<LocalVideo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "auto";
    el.muted = true;
    // Not in the document, so nothing about this is visible; it is a decoder.
    el.addEventListener(
      "loadedmetadata",
      () => {
        // A stream written by MediaRecorder can report Infinity until it has
        // been walked to the end. Nudging it there settles the real duration.
        if (!Number.isFinite(el.duration) || el.duration === 0) {
          el.currentTime = 1e6;
          el.addEventListener(
            "seeked",
            () => {
              el.currentTime = 0;
              resolve({
                el,
                url,
                duration: el.duration,
                width: el.videoWidth,
                height: el.videoHeight,
              });
            },
            { once: true },
          );
          return;
        }
        resolve({
          el,
          url,
          duration: el.duration,
          width: el.videoWidth,
          height: el.videoHeight,
        });
      },
      { once: true },
    );
    el.addEventListener("error", () =>
      reject(
        new Error(
          "The browser can't decode that file. It plays whatever it plays natively — an MP4 (H.264) or a WebM is safest.",
        ),
      ),
    );
    el.src = url;
  });
}

export function closeVideo(video: LocalVideo) {
  video.el.removeAttribute("src");
  video.el.load();
  URL.revokeObjectURL(video.url);
}

/* A seek that can't hang.

   Two ways the naive version never settles, both of which cost you the whole
   panel, because everything here is sequential and the UI disables itself
   while work is in flight:

   1. Assigning currentTime the value it already holds fires no `seeked` event
      at all. Marking 0.00s on a decoder already parked at 0 was enough to
      wedge it forever.
   2. A decoder can simply not answer — a damaged stream, a frame it can't
      reach.

   So: settle at once when there is nothing to seek, and never wait longer
   than SEEK_TIMEOUT for anything else. */
const SEEK_EPSILON = 0.001;
const SEEK_TIMEOUT = 15000;

function seek(el: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const duration = Number.isFinite(el.duration) ? el.duration : t + 1;
    const target = Math.max(0, Math.min(t, Math.max(0, duration - 0.05)));

    // HAVE_CURRENT_DATA or better means the frame at this position is already
    // decoded and drawImage will get it.
    if (Math.abs(el.currentTime - target) < SEEK_EPSILON && el.readyState >= 2) {
      requestAnimationFrame(() => resolve());
      return;
    }

    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timer);
      el.removeEventListener("seeked", onSeeked);
      el.removeEventListener("error", onError);
    };
    const onSeeked = () => {
      if (settled) return;
      settled = true;
      cleanup();
      // One rAF gives the compositor the frame it just decoded, which some
      // builds need before drawImage sees the new one rather than the old.
      requestAnimationFrame(() => resolve());
    };
    const onError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`The video stopped decoding around ${target.toFixed(2)}s.`));
    };
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        new Error(
          `Seeking to ${target.toFixed(2)}s took too long and was given up on. The rest of the frames are untouched.`,
        ),
      );
    }, SEEK_TIMEOUT);

    el.addEventListener("seeked", onSeeked);
    el.addEventListener("error", onError);
    el.currentTime = target;
  });
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function toBlob(c: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    c.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed."))),
      type,
      quality,
    ),
  );
}

/** Grey samples of the current frame, downscaled. Used both to compare
 *  consecutive frames and to throw away black and flat ones. */
function greySamples(video: LocalVideo, scratch: HTMLCanvasElement): number[] {
  const ctx = scratch.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(video.el, 0, 0, SCAN_W, SCAN_H);
  const { data } = ctx.getImageData(0, 0, SCAN_W, SCAN_H);
  const grey: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    grey.push((data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000);
  }
  return grey;
}

/** Walks the film at SCAN_FPS and scores each step by how much it changed
 *  from the one before. That is the browser's answer to ffmpeg's scene
 *  filter: cruder, but looking for the same thing — the moment the picture
 *  stops being the previous picture. */
export async function findCuts(
  video: LocalVideo,
  onProgress?: Progress,
): Promise<{ t: number; score: number }[]> {
  const scratch = canvas(SCAN_W, SCAN_H);
  const cuts: { t: number; score: number }[] = [];
  const step = 1 / SCAN_FPS;
  const steps = Math.max(1, Math.floor(video.duration / step));
  let previous: number[] | null = null;

  for (let i = 0; i < steps; i++) {
    const t = i * step;
    await seek(video.el, t);
    const grey = greySamples(video, scratch);
    if (previous) {
      let diff = 0;
      for (let p = 0; p < grey.length; p++) diff += Math.abs(grey[p] - previous[p]);
      // 0..1, so the numbers mean roughly what ffmpeg's scene score means and
      // chooseTimes can treat both the same way.
      cuts.push({ t, score: diff / grey.length / 255 });
    }
    previous = grey;
    onProgress?.("Looking for the cuts", i + 1, steps);
  }
  return cuts;
}

/** Cuts one moment at full size and thumb size. */
async function cutFrame(
  video: LocalVideo,
  t: number,
  full: HTMLCanvasElement,
  thumb: HTMLCanvasElement,
  origin: "auto" | "hand",
): Promise<{ frame: Frame; files: Map<string, Blob> }> {
  await seek(video.el, t);
  full.getContext("2d")!.drawImage(video.el, 0, 0, full.width, full.height);
  thumb.getContext("2d")!.drawImage(video.el, 0, 0, thumb.width, thumb.height);

  const id = frameId(t);
  // WebP everywhere the browser has it, which is everywhere that matters, and
  // a third smaller than JPEG — this is going into the repo.
  const type = full.toDataURL("image/webp").startsWith("data:image/webp")
    ? "image/webp"
    : "image/jpeg";
  const ext = type === "image/webp" ? "webp" : "jpg";

  const files = new Map<string, Blob>();
  files.set(`${id}.${ext}`, await toBlob(full, type, 0.82));
  files.set(`${id}.thumb.${ext}`, await toBlob(thumb, type, 0.75));

  return {
    files,
    frame: {
      id,
      t: Number(t.toFixed(3)),
      file: `${id}.${ext}`,
      thumb: `${id}.thumb.${ext}`,
      w: full.width,
      h: full.height,
      origin,
    },
  };
}

/** One 160px tile per second, a hundred to a sheet: the same scrub strip the
 *  Actions extractor builds with ffmpeg's tile filter, so the Curator's
 *  scrubber cannot tell which extractor made a project. */
async function buildScrub(
  video: LocalVideo,
  onProgress?: Progress,
): Promise<{ scrub: ScrubStrip; files: Map<string, Blob> }> {
  const tileW = SCRUB_WIDTH;
  const tileH = Math.round((SCRUB_WIDTH * video.height) / video.width / 2) * 2;
  const perSheet = SCRUB_COLS * SCRUB_ROWS;
  const count = Math.max(1, Math.ceil(video.duration));
  const sheets = Math.ceil(count / perSheet);

  const files = new Map<string, Blob>();
  const names: string[] = [];

  for (let s = 0; s < sheets; s++) {
    const sheet = canvas(SCRUB_COLS * tileW, SCRUB_ROWS * tileH);
    const ctx = sheet.getContext("2d")!;
    for (let i = 0; i < perSheet; i++) {
      const second = s * perSheet + i;
      if (second >= count) break;
      await seek(video.el, second);
      ctx.drawImage(
        video.el,
        (i % SCRUB_COLS) * tileW,
        Math.floor(i / SCRUB_COLS) * tileH,
        tileW,
        tileH,
      );
      onProgress?.("Building the scrubber", second + 1, count);
    }
    const name = `scrub-${String(s + 1).padStart(3, "0")}.jpg`;
    files.set(name, await toBlob(sheet, "image/jpeg", 0.7));
    names.push(name);
  }

  return {
    files,
    scrub: {
      files: names,
      cols: SCRUB_COLS,
      rows: SCRUB_ROWS,
      tileW,
      tileH,
      fps: 1,
      count,
    },
  };
}

/** The whole first pass: find the cuts, keep a spread of them, cut those
 *  frames, and build the scrubber. */
export async function extractSuggested(
  video: LocalVideo,
  count: number,
  onProgress?: Progress,
): Promise<ExtractResult> {
  const cuts = await findCuts(video, onProgress);
  const wanted = chooseTimes(cuts, video.duration, count);

  const scale = Math.min(1, FULL_WIDTH / video.width);
  const full = canvas(
    Math.round(video.width * scale),
    Math.round(video.height * scale),
  );
  const thumbScale = Math.min(1, THUMB_WIDTH / video.width);
  const thumb = canvas(
    Math.round(video.width * thumbScale),
    Math.round(video.height * thumbScale),
  );
  const scratch = canvas(SCAN_W, SCAN_H);

  const frames: Frame[] = [];
  const files = new Map<string, Blob>();
  let rejected = 0;

  for (const [i, t] of wanted.entries()) {
    await seek(video.el, t);
    // Same test the Actions extractor applies, on the same kind of sample.
    if (!isWorthKeeping(greyStats(greySamples(video, scratch)))) {
      rejected++;
      continue;
    }
    const cut = await cutFrame(video, t, full, thumb, "auto");
    frames.push(cut.frame);
    for (const [name, blob] of cut.files) files.set(name, blob);
    onProgress?.("Cutting the frames", i + 1, wanted.length);
  }

  const built = await buildScrub(video, onProgress);
  for (const [name, blob] of built.files) files.set(name, blob);

  return { frames, files, scrub: built.scrub, rejected };
}

/** The second pass: exactly these moments, no filtering. A frame picked by
 *  hand is wanted whatever its histogram says. */
export async function extractTimes(
  video: LocalVideo,
  times: number[],
  onProgress?: Progress,
): Promise<{ frames: Frame[]; files: Map<string, Blob> }> {
  const scale = Math.min(1, FULL_WIDTH / video.width);
  const full = canvas(
    Math.round(video.width * scale),
    Math.round(video.height * scale),
  );
  const thumbScale = Math.min(1, THUMB_WIDTH / video.width);
  const thumb = canvas(
    Math.round(video.width * thumbScale),
    Math.round(video.height * thumbScale),
  );

  const frames: Frame[] = [];
  const files = new Map<string, Blob>();
  for (const [i, t] of times.entries()) {
    const cut = await cutFrame(video, t, full, thumb, "hand");
    frames.push(cut.frame);
    for (const [name, blob] of cut.files) files.set(name, blob);
    onProgress?.("Cutting the frames", i + 1, times.length);
  }
  return { frames, files };
}
