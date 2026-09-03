"use client";

import { useEffect, useState } from "react";
import { loadFonts, type Fonts } from "./nodes/type";

/* loadFonts() reads the hashed next/font family names off the live page, and it
   does that by appending a probe element and reading it back. That is cheap once
   and silly twenty times, which is what a wall of covers would do if every tile
   asked for itself.
   
   The answer can't change while the page is open, so it is fetched once per
   document and shared. Additive on purpose: nothing that already calls
   loadFonts directly had to change. */

let pending: Promise<Fonts> | null = null;

export function useSharedFonts(): Fonts | null {
  const [fonts, setFonts] = useState<Fonts | null>(null);

  useEffect(() => {
    let alive = true;
    pending ??= loadFonts();
    pending.then((f) => {
      if (alive) setFonts(f);
    });
    return () => {
      alive = false;
    };
  }, []);

  return fonts;
}
