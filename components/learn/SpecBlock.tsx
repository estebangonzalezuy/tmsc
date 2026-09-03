"use client";

// A live example inside a piece.
//
// This is the one thing the club can do that a motion blog cannot: an article
// about easing can show the easing, running, looping, at the bottom of the
// paragraph that describes it. It costs almost nothing, because the renderer
// already exists — GraphPoster is the same throttled-live-canvas component
// the node-graph studio uses for every node's own thumbnail.
//
// And because every graph is periodic in its own duration, the example loops
// seamlessly for free. That contract is enforced elsewhere; this spends it.
//
// Only ever a Posts Studio graph now — the Tiles studio this once also
// supported was retired (AGENTS.md, "What became of the Kinetics and the
// Tiles"); `studio` stays a prop rather than being inlined away so a future
// second kind of running example has somewhere to land.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FORMATS, decodeGraph } from "@/lib/postgraph";
import GraphPoster from "@/components/postlab/GraphPoster";

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

  const graph = decodeGraph(encoded);
  const showreelId = graph?.nodes.find((n) => n.kind === "showreel")?.id ?? null;

  /* The playhead is started once per page by ClockRunner, never here. Every
     canvas subscribes to the one shared clock, so a second rAF loop would not
     add a second animation — it would advance the same clock twice per frame
     and run everything on the page at double speed. Two examples in one
     article used to be enough to do it. */

  /* Drawn at the size it is displayed, so the dither cells land where they
     will instead of being smoothed into gray on the way down. */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!graph || !showreelId) return null;

  const ratio = FORMATS[graph.format].h / FORMATS[graph.format].w;
  const href = `/postlab#graph=${encoded}`;

  return (
    <figure className="mt-12">
      <div ref={box} className="card overflow-hidden p-0">
        {width > 0 && (
          <div style={{ aspectRatio: `1 / ${ratio}` }} className="w-full">
            <GraphPoster graph={graph} targetId={showreelId} width={width} live />
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
