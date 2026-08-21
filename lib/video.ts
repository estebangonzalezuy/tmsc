// Reading a video file in the browser, for whoever is cutting something out of it.
//
// The thing that shapes both the Stills and the Clips is that a browser cannot
// take pixels out of a YouTube or Vimeo embed: the player is a cross-origin
// iframe and a canvas drawn from it is tainted. That is true of an *embed*. It
// is not true of a file you picked off your own disk — an object URL is
// same-origin, the canvas stays clean, and getImageData works.
//
// So a video you have is the one case that needs no runner, no yt-dlp, no
// cookies and no upload. Everything here happens on the machine you are sitting
// at, and only the finished frames are ever sent anywhere.
//
// This module is the half that has nothing to do with what you are cutting: the
// decoder, the seek that cannot hang, the scratch canvases and the cut finder.
// What each wall does with them is next door — components/stills/localVideo.ts
// cuts single frames, components/clips/cutSheet.ts cuts filmstrips.

/** Downscale used for both differencing and the black/flat test. Small on
 *  purpose: it is measuring change, not detail. */
export const SCAN_W = 32;
export const SCAN_H = 18;
/** Frames per second sampled while hunting for cuts. Two is enough to catch a
 *  shot change and cheap enough to walk a five minute film in under a minute. */
export const SCAN_FPS = 2;

export type LocalVideo = {
  el: HTMLVideoElement;
  url: string;
  duration: number;
  width: number;
  height: number;
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
   than SEEK_TIMEOUT for anything else.

   Exported, because a filmstrip seeks three dozen times per clip and a second
   implementation of this is a second place for those two bugs to live. */
const SEEK_EPSILON = 0.001;
const SEEK_TIMEOUT = 15000;

export function seek(el: HTMLVideoElement, t: number): Promise<void> {
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

export function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function toBlob(c: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    c.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed."))),
      type,
      quality,
    ),
  );
}

/** WebP everywhere the browser has it, which is everywhere that matters, and a
 *  third smaller than JPEG — this is going into the repo. */
export function pictureType(probe: HTMLCanvasElement): {
  type: string;
  ext: string;
} {
  return probe.toDataURL("image/webp").startsWith("data:image/webp")
    ? { type: "image/webp", ext: "webp" }
    : { type: "image/jpeg", ext: "jpg" };
}

/** Grey samples of the current frame, downscaled. Used both to compare
 *  consecutive frames and to throw away black and flat ones. */
export function greySamples(
  video: LocalVideo,
  scratch: HTMLCanvasElement,
): number[] {
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
 *  stops being the previous picture.
 *
 *  The Stills reads the peaks as moments to cut a frame at. The Clips reads
 *  the gaps *between* the peaks as shots, which is the same measurement asked
 *  a different question. */
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
