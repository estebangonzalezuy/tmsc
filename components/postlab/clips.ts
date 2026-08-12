// Film and GIFs for the studio's photo pattern.
//
// A picture is one frame; a clip is a few dozen. Both end up as the same thing
// here — **a grayscale source the club's screen can dither** — so a film mixes,
// folds, inks and screens exactly like a drawn form. That is the whole reason
// it is worth having: a clip is not a new layer type, it is a `src` on a `forms`
// layer whose `pattern` is `photo`, and nothing downstream has to know.
//
// Three decisions do the work.
//
// **Decode once, on the way in.** A picked file is sampled down to at most 512px
// on its long edge and at most 96 frames, and each frame is kept as one
// `Uint8ClampedArray` of luminance — one byte a pixel, ~14MB for a full clip.
// Keeping a `<video>` element and calling `drawImage` per frame would be neither
// seekable at export time nor deterministic; this is both.
//
// **A clip loops by construction.** The frame at loop position `p` is
// `floor(p · cycles · n) mod n` with `cycles` a whole number, so the last frame
// runs into the first with no seam — the same contract every travelling number
// in this studio keeps, and the reason the exporter can still be a function of
// the frame number.
//
// **Nothing is uploaded.** The frames live in this browser's IndexedDB and the
// layer carries only `clip:<id>` — the same bargain the photo, the Studio and
// the Desk make. A link opened somewhere else won't have the film, and the UI
// says so where the file is picked.

/** How a decoded clip is held: grayscale, one byte a pixel, frame by frame. */
export type Clip = {
  w: number;
  h: number;
  /** Luminance 0-255, `w * h` bytes each. */
  frames: Uint8ClampedArray[];
  /** What it was, for the caption. */
  kind: "film" | "gif";
  /** Seconds of the original, for the caption. */
  seconds: number;
};

/** The longest edge we sample to. A dithered post is cells, not pixels. */
const MAX_EDGE = 512;
/** The most frames we keep. Past this a post is a video, not a post. */
const MAX_FRAMES = 96;
/** How often we sample. Twelve a second reads as motion under a dither. */
const FPS = 12;

const memory = new Map<string, Clip>();
const pending = new Map<string, Promise<Clip | null>>();

export const isClip = (src: string | undefined): boolean =>
  !!src && src.startsWith("clip:");

/* ------------------------------------------------------------- the store */

/* One tiny object store. localStorage tops out around 5MB and a clip is
   fifteen, so this is the only place it can go without a server. */
const DB = "tmsc-clips";
const STORE = "clips";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function put(id: string, clip: Clip) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(clip, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function get(id: string): Promise<Clip | null> {
  const db = await open();
  const clip = await new Promise<Clip | null>((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Clip) ?? null);
    req.onerror = () => resolve(null);
  });
  db.close();
  return clip;
}

/* --------------------------------------------------------------- reading */

/** The clip if it's in hand, without waiting. Null means not yet, or never. */
export const clip = (src: string | undefined): Clip | null =>
  src && isClip(src) ? (memory.get(src) ?? null) : null;

/** Fetch a clip out of this browser, once, and remember it. */
export function loadClip(src: string | undefined): Promise<Clip | null> {
  if (!src || !isClip(src)) return Promise.resolve(null);
  const done = memory.get(src);
  if (done) return Promise.resolve(done);
  const already = pending.get(src);
  if (already) return already;
  const job = get(src.slice(5))
    .then((c) => {
      pending.delete(src);
      if (c) memory.set(src, c);
      return c;
    })
    .catch(() => {
      pending.delete(src);
      return null;
    });
  pending.set(src, job);
  return job;
}

/**
 * Which frame a clip shows at loop position `p`. Whole `cycles` only, which is
 * what makes a clip incapable of opening a seam.
 */
export function frameAt(c: Clip, p: number, cycles = 1): Uint8ClampedArray {
  const n = c.frames.length;
  const trips = Math.max(1, Math.round(cycles));
  const i = Math.floor(((p % 1) + 1) % 1 * trips * n) % n;
  return c.frames[i];
}

/* -------------------------------------------------------------- decoding */

type Say = (stage: string, done: number, total: number) => void;

const box = (w: number, h: number) => {
  const k = Math.min(1, MAX_EDGE / Math.max(w, h));
  return { w: Math.max(2, Math.round(w * k)), h: Math.max(2, Math.round(h * k)) };
};

/** RGBA at sample size → one byte of luminance a pixel. */
function gray(data: Uint8ClampedArray, n: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const a = data[o + 3] / 255;
    /* An alpha hole reads as paper, not as ink: a GIF with a transparent
       background should dither to nothing there, not to black. */
    out[i] = (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) * a + 255 * (1 - a);
  }
  return out;
}

async function decodeFilm(file: File, say?: Say): Promise<Clip> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("That file isn't a film this browser can read"));
    });
    const seconds = Number.isFinite(video.duration) ? video.duration : 2;
    const { w, h } = box(video.videoWidth || 2, video.videoHeight || 2);
    const n = Math.max(2, Math.min(MAX_FRAMES, Math.round(seconds * FPS)));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    const frames: Uint8ClampedArray[] = [];
    for (let i = 0; i < n; i++) {
      /* Sampled across the whole film, never landing on its last moment: the
         frame after the last one is the first one again. */
      const t = (i / n) * seconds;
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
        video.currentTime = Math.min(seconds - 0.001, t);
      });
      ctx.drawImage(video, 0, 0, w, h);
      frames.push(gray(ctx.getImageData(0, 0, w, h).data, w * h));
      say?.("Reading the film", i + 1, n);
    }
    return { w, h, frames, kind: "film", seconds };
  } finally {
    URL.revokeObjectURL(url);
    video.src = "";
  }
}

/* A GIF (or an animated WebP) comes apart with ImageDecoder, which Chromium
   has and which hands us real frames rather than a element that has to be
   played. Same output as a film: grayscale, one byte a pixel. */
async function decodeGif(file: File, say?: Say): Promise<Clip> {
  type Decoder = {
    tracks: { ready: Promise<void>; selectedTrack?: { frameCount: number } };
    decode: (o: { frameIndex: number }) => Promise<{ image: CanvasImageSource & { close?: () => void; displayWidth?: number; displayHeight?: number } }>;
    close: () => void;
  };
  const Ctor = (globalThis as unknown as { ImageDecoder?: new (o: { data: ArrayBuffer; type: string }) => Decoder })
    .ImageDecoder;
  if (!Ctor) throw new Error("This browser can't take a GIF apart — try a film");

  const dec = new Ctor({ data: await file.arrayBuffer(), type: file.type || "image/gif" });
  try {
    await dec.tracks.ready;
    const count = Math.max(1, dec.tracks.selectedTrack?.frameCount ?? 1);
    const n = Math.min(MAX_FRAMES, count);

    const first = await dec.decode({ frameIndex: 0 });
    const { w, h } = box(
      first.image.displayWidth ?? 2,
      first.image.displayHeight ?? 2,
    );
    first.image.close?.();

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    const frames: Uint8ClampedArray[] = [];
    for (let i = 0; i < n; i++) {
      /* Every frame when it fits, evenly spread when it doesn't. */
      const index = n === count ? i : Math.round((i / n) * count);
      const { image } = await dec.decode({ frameIndex: index });
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(image, 0, 0, w, h);
      image.close?.();
      frames.push(gray(ctx.getImageData(0, 0, w, h).data, w * h));
      say?.("Taking the GIF apart", i + 1, n);
    }
    return { w, h, frames, kind: "gif", seconds: n / FPS };
  } finally {
    dec.close();
  }
}

/**
 * Take a film or a GIF in and hand back the `clip:<id>` to put on the layer.
 * Throws with something worth reading when the file isn't one we can read.
 */
export async function saveClip(file: File, say?: Say): Promise<string> {
  const gif = /gif|webp/i.test(file.type) || /\.(gif|webp)$/i.test(file.name);
  const decoded = gif ? await decodeGif(file, say) : await decodeFilm(file, say);
  if (!decoded.frames.length) throw new Error("Nothing came out of that file");
  const id = Math.random().toString(36).slice(2, 10);
  const src = `clip:${id}`;
  memory.set(src, decoded);
  /* Written after it's usable, so a slow disk never holds up the first frame. */
  void put(id, decoded).catch(() => {});
  return src;
}

/** Paint one frame of a clip into a canvas, for a thumbnail. */
export function paintFrame(canvas: HTMLCanvasElement, c: Clip, p: number, cycles = 1) {
  canvas.width = c.w;
  canvas.height = c.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const g = frameAt(c, p, cycles);
  const img = ctx.createImageData(c.w, c.h);
  for (let i = 0; i < g.length; i++) {
    const o = i * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = g[i];
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** Have every clip a slide needs in hand before drawing frames of it. */
export const loadSlideClips = (layers: { src?: string }[]) =>
  Promise.all(layers.map((l) => loadClip(l.src)));
