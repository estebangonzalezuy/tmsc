"use client";

// A live example inside a piece.
//
// This is the one thing the club can do that a motion blog cannot: an article
// about easing can show the easing, running, looping, at the bottom of the
// paragraph that describes it. It costs almost nothing, because the renderer
// already exists and /tools already does exactly this on its wall — Poster with
// `live` is a self-contained canvas that subscribes to the shared clock and
// repaints itself without ever re-rendering React.
//
// And because every studio spec is periodic in its own duration, the example
// loops seamlessly for free. That contract is enforced elsewhere; this spends it.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FORMATS, decodeSpec } from "@/lib/postlab";
import { decodeSpec as decodeTile, normalize as normalizeTile } from "@/lib/tiles";
import Poster from "@/components/postlab/Poster";
import { useClockRunning } from "@/components/postlab/Stage";
import { loadFonts, type Fonts } from "@/components/postlab/overlay";
import TileStage from "@/components/tiles/Stage";

export default function SpecBlock({
  studio,
  spec: encoded,
  caption,
}: {
  studio: "postlab" | "tiles";
  spec: string;
  caption?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [fonts, setFonts] = useState<Fonts | null>(null);

  const post = useMemo(
    () => (studio === "postlab" ? decodeSpec(encoded) : null),
    [studio, encoded],
  );
  const tile = useMemo(
    () => (studio === "tiles" ? normalizeTile(decodeTile(encoded) ?? {}) : null),
    [studio, encoded],
  );

  useClockRunning(true, post?.duration ?? 6);

  useEffect(() => {
    if (studio === "postlab") loadFonts().then(setFonts);
  }, [studio]);

  /* Drawn at the size it is displayed, so the dither cells land where they will
     instead of being smoothed into gray on the way down. */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (studio === "postlab" && !post) return null;
  if (studio === "tiles" && !tile) return null;

  const ratio = post ? FORMATS[post.format].h / FORMATS[post.format].w : 1;
  const href = studio === "postlab" ? `/postlab#spec=${encoded}` : `/tiles#spec=${encoded}`;

  return (
    <figure className="mt-12">
      <div ref={box} className="card overflow-hidden p-0">
        {width > 0 && (
          <div style={{ aspectRatio: `1 / ${ratio}` }} className="w-full">
            {post ? (
              <Poster spec={post} index={0} fonts={fonts} width={width} live />
            ) : (
              <TileStage spec={tile!} width={width} height={width} />
            )}
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
