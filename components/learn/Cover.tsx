"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Poster from "@/components/postlab/Poster";
import { useSharedFonts } from "@/components/postlab/useFonts";
import { coverSpec } from "@/lib/learnCover";

/* The title card, drawn by the studio's own renderer at the size it is shown.
   
   It is still. A sheet with a layer of type "none" draws no graphic, so there is
   nothing to animate — which is why this takes no clock, no `live`, and no
   IntersectionObserver. Poster paints frame zero once, and repaints when the
   fonts arrive.
   
   The words it draws are pixels, not text. Every tile therefore keeps a real
   heading in the markup beside this — see PieceGrid — or the title would be
   invisible to a screen reader, to search, and to find-on-page. */

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
  const fonts = useSharedFonts();

  const spec = useMemo(() => coverSpec(slug, title), [slug, title]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} className={`aspect-square overflow-hidden ${className}`}>
      {width > 0 && (
        <Poster spec={spec} index={0} fonts={fonts} width={width} />
      )}
    </div>
  );
}
