"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Poster from "@/components/postlab/Poster";
import { useSharedFonts } from "@/components/postlab/useFonts";
import { coverSpec } from "@/lib/learnCover";

/* One tile's picture: the piece's own rolled sheet, drawn by the studio's
   renderer at the size it is displayed, so the dither cells land where they will
   instead of being smoothed into gray on the way down.
   
   Two things keep a wall of these affordable:
   
   - The clock is shared and lives outside React, so a cover repaints its own
     canvas without re-rendering anything. The page calls useClockRunning once;
     a cover never does, because twenty rAF loops driving one clock is nineteen
     too many.
   - `live` follows an IntersectionObserver, so only the tiles actually on screen
     are drawing. /tools gets away without this at nine posters; a library that
     keeps growing does not. */

export default function Cover({
  slug,
  title,
  className = "",
}: {
  slug: string;
  title: string;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [inView, setInView] = useState(false);
  const fonts = useSharedFonts();

  const spec = useMemo(() => coverSpec(slug, title), [slug, title]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;

    const ro = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    ro.observe(el);

    /* A margin, so a tile is already moving by the time it is scrolled to
       rather than starting from frame zero under the reader's eye. */
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "200px" },
    );
    io.observe(el);

    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div ref={box} className={`aspect-square overflow-hidden ${className}`}>
      {width > 0 && (
        <Poster spec={spec} index={0} fonts={fonts} width={width} live={inView} />
      )}
    </div>
  );
}
