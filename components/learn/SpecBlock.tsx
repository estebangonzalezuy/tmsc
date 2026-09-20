"use client";

// A live example inside a piece.
//
// This is the one thing the club can do that a motion blog cannot: an article
// about easing can show the easing, running, looping, at the bottom of the
// paragraph that describes it. It costs almost nothing, because the renderer
// already exists — PosterCanvas is the same live canvas the Posts Studio
// previews with.
//
// And because a poster is periodic in its own loop, the example closes
// seamlessly for free. That contract is enforced in lib/poster.ts; this
// spends it.
//
// `studio` stays a prop rather than being inlined away so a future second
// kind of running example has somewhere to land.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FORMATS, decodePoster } from "@/lib/poster";
import PosterCanvas from "@/components/postlab/PosterCanvas";
import { useFaces } from "@/components/postlab/useFonts";

export default function SpecBlock({
  studio,
  spec: encoded,
  caption,
}: {
  studio: "postlab";
  spec: string;
  caption?: string;
}) {
  void studio;
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const faces = useFaces();

  const poster = decodePoster(encoded);

  /* Drawn at the size it is displayed, so a pattern's cells land where they
     will instead of being smoothed on the way down. */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!poster) return null;

  /* The playhead is started once per page by ClockRunner, never here. Every
     canvas subscribes to the one shared clock, so a second rAF loop would not
     add a second animation — it would advance the same clock twice per frame
     and run everything on the page at double speed. Two examples in one
     article used to be enough to do it. */
  const ratio = FORMATS[poster.format].h / FORMATS[poster.format].w;
  const href = `/postlab#poster=${encoded}`;

  return (
    <figure className="mt-12">
      <div ref={box} className="card overflow-hidden p-0">
        {width > 0 && (
          <div style={{ aspectRatio: `1 / ${ratio}` }} className="w-full">
            <PosterCanvas poster={poster} width={width} faces={faces} live />
          </div>
        )}
      </div>
      <figcaption className="mt-3 flex items-baseline justify-between gap-4 text-xs text-muted">
        <span>{caption}</span>
        <Link href={href} className="underline underline-offset-4 whitespace-nowrap">
          Open in the studio →
        </Link>
      </figcaption>
    </figure>
  );
}
