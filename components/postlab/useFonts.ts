"use client";

// The families the poster's type is set in.
//
// next/font hashes its family names, so they are only knowable in the
// browser: the answer is read off the live page once per document by probing
// an element, and shared, because a wall of covers asking twenty times is
// silly. Until it resolves, the renderer falls back to generic families —
// the poster draws either way rather than waiting.

import { useEffect, useState } from "react";
import type { TypeFaces } from "@/lib/poster";

let cache: TypeFaces | null = null;
let pending: Promise<TypeFaces> | null = null;

function probe(className: string): string {
  const el = document.createElement("span");
  el.className = className;
  el.textContent = "x";
  document.body.appendChild(el);
  const family = getComputedStyle(el).fontFamily;
  el.remove();
  return family;
}

export function loadFaces(): Promise<TypeFaces> {
  if (cache) return Promise.resolve(cache);
  pending ??= document.fonts.ready.then(() => {
    cache = {
      sans: getComputedStyle(document.body).fontFamily,
      serif: probe("font-serif"),
    };
    return cache;
  });
  return pending;
}

export function useFaces(): TypeFaces | null {
  const [faces, setFaces] = useState<TypeFaces | null>(cache);
  useEffect(() => {
    let alive = true;
    loadFaces().then((f) => alive && setFaces(f));
    return () => {
      alive = false;
    };
  }, []);
  return faces;
}
