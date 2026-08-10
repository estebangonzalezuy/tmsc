// Pictures for the Post Lab's photo pattern.
//
// A spec travels in a URL, and a photograph does not fit in one. So a
// picture the owner chooses is kept in this browser and the layer carries
// only `local:<id>` — the same bargain the Studio and the Desk make with
// the GitHub token: nothing on the server, nothing to configure, and the
// cost stated plainly (a link opened somewhere else won't have the photo).
//
// A `src` that starts with "/" is a path on this site instead, which does
// travel — that is the one to use for anything meant to be shared.

const KEY = (id: string) => `postlab-photo-${id}`;
const cache = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement | null>>();

/** Store a picked file and return the `local:<id>` to put on the layer. */
export function savePhoto(dataUrl: string): string {
  const id = Math.random().toString(36).slice(2, 10);
  localStorage.setItem(KEY(id), dataUrl);
  return `local:${id}`;
}

/** The URL a `src` actually resolves to, or null when it isn't here. */
export function photoUrl(src: string | undefined): string | null {
  if (!src) return null;
  if (!src.startsWith("local:")) {
    /* Same-origin only. A cross-origin image taints the canvas, and a
       tainted canvas can't be read back — which would break the dither,
       the export and the GIF all at once, silently. */
    return src.startsWith("/") ? src : null;
  }
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(KEY(src.slice(6)));
}

/** The decoded image if it's ready, without waiting. */
export const photo = (src: string | undefined): HTMLImageElement | null =>
  src ? (cache.get(src) ?? null) : null;

/** Decode a picture, once, and remember it. Null means it isn't available. */
export function loadPhoto(src: string | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  const done = cache.get(src);
  if (done) return Promise.resolve(done);
  const already = pending.get(src);
  if (already) return already;

  const url = photoUrl(src);
  if (!url) return Promise.resolve(null);

  const job = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      cache.set(src, img);
      pending.delete(src);
      resolve(img);
    };
    img.onerror = () => {
      pending.delete(src);
      resolve(null);
    };
    img.src = url;
  });
  pending.set(src, job);
  return job;
}

/** Have every picture a slide needs in hand before drawing frames of it. */
export const loadSlidePhotos = (layers: { src?: string }[]) =>
  Promise.all(layers.map((l) => loadPhoto(l.src)));

/** Read a File the owner picked into a data URL. */
export const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
