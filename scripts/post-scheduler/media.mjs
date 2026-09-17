// A post's files, as the networks want them: bytes off the checkout for the
// APIs that take an upload, and a public URL for the one that insists on
// fetching (Instagram).

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

export const ROOT = resolve(new URL("../../", import.meta.url).pathname);
export const ORIGIN = process.env.SITE_ORIGIN ?? "https://themotionsocialclub.vercel.app";

/** The bytes of one committed file, `file` being `posts/<id>/1.jpg`. */
export async function readMedia(file) {
  return readFile(resolve(ROOT, "public", file));
}

export async function sizeOf(file) {
  return (await stat(resolve(ROOT, "public", file))).size;
}

/** Where the deployed site serves it. */
export function publicUrl(assetBase, file) {
  return `${ORIGIN}${assetBase}/${file.replace(/^posts\//, "")}`;
}

/**
 * Waits for the deploy to catch up with the commit. The page commits a post's
 * files and Vercel takes about a minute to put them at their URL; a post
 * scheduled for later is long since live by the time it is due, but "Post
 * now" isn't, and Instagram fetches the URL itself.
 */
export async function waitForUrl(url, { tries = 12, gapMs = 10_000 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { method: "HEAD", redirect: "follow" });
      if (res.ok) return true;
    } catch {
      // not there yet
    }
    await new Promise((r) => setTimeout(r, gapMs));
  }
  return false;
}

export const mimeOf = (m) => m.mime;
