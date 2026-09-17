// Reading the files dropped into the composer, in the browser.
//
// Nothing is uploaded here: a file is read for its size, its kind and its
// dimensions, and a JPEG sibling is drawn for Instagram when the original is
// something Instagram will not take. The bytes travel to the repo only when
// the post is scheduled, in the same commit as the JSON — the Curator's road,
// so a post abandoned half-written leaves nothing behind.

import type { MediaItem, MediaKind } from "@/lib/posts-shared";

/** A file on its way into a post: the item the JSON will carry, the blob(s)
 *  the commit will, and a URL the composer can show it with. */
export type Attached = {
  item: MediaItem;
  /** Missing once the file is already in the repo — reopening a post. */
  blob?: Blob;
  jpegBlob?: Blob;
  previewUrl: string;
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

export function kindOf(file: File): MediaKind | null {
  if (file.type === "image/gif") return "gif";
  if (IMAGE_TYPES.has(file.type)) return "image";
  if (VIDEO_TYPES.has(file.type)) return "video";
  return null;
}

function extension(file: File): string {
  const known: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  };
  return known[file.type] ?? file.name.split(".").pop()?.toLowerCase() ?? "bin";
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't read that image."));
    img.src = url;
  });
}

function probeVideo(url: string): Promise<{ width: number; height: number; seconds: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () =>
      resolve({ width: v.videoWidth, height: v.videoHeight, seconds: v.duration });
    v.onerror = () => reject(new Error("Couldn't read that video — MP4 (H.264) is the safe format."));
    v.src = url;
  });
}

/** A JPEG of the image, on white — Instagram takes nothing else, and a PNG
 *  with transparency has to land on something. */
async function toJpeg(img: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn't encode a JPEG."))),
      "image/jpeg",
      0.92,
    );
  });
}

/** Reads one dropped file. `postId` and `index` decide where it will live. */
export async function attach(file: File, postId: string, index: number): Promise<Attached> {
  const kind = kindOf(file);
  if (!kind) {
    throw new Error(`${file.name}: images (JPG, PNG, WebP), GIFs and videos (MP4, MOV, WebM) only.`);
  }
  const previewUrl = URL.createObjectURL(file);
  const base = `posts/${postId}/${index}`;
  const item: MediaItem = {
    file: `${base}.${extension(file)}`,
    kind,
    mime: file.type,
    bytes: file.size,
    width: 0,
    height: 0,
  };
  let jpegBlob: Blob | undefined;

  if (kind === "video") {
    const meta = await probeVideo(previewUrl);
    item.width = meta.width;
    item.height = meta.height;
    item.seconds = Math.round(meta.seconds * 10) / 10;
  } else {
    const img = await loadImage(previewUrl);
    item.width = img.naturalWidth;
    item.height = img.naturalHeight;
    if (kind === "image" && file.type !== "image/jpeg") {
      jpegBlob = await toJpeg(img);
      item.jpeg = `${base}.ig.jpg`;
    }
  }

  return { item, blob: file, jpegBlob, previewUrl };
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
