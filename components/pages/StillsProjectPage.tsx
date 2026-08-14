"use client";

/* eslint-disable @next/next/no-img-element -- see the note in Lightbox.tsx. */

import Link from "next/link";
import { useState } from "react";
import Cta from "@/components/Cta";
import GridFillers from "@/components/stills/GridFillers";
import Lightbox, { type LightboxItem } from "@/components/stills/Lightbox";
import { frameSrc, frameSrcSet, hasSource, timecode } from "@/lib/stills-shared";
import type { Project } from "@/lib/stills-shared";

// One project: every frame kept from one video, in the order they happen.
// The server wrapper passes the full record down, so this page carries only
// its own project's frames — the wall is the place that holds all of them.

export default function StillsProjectPage({
  project,
  assetBase,
}: {
  project: Project;
  assetBase: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const items: LightboxItem[] = project.frames.map((frame) => ({
    src: frameSrc(assetBase, project.id, frame),
    w: frame.w,
    h: frame.h,
    t: frame.t,
    origin: frame.origin,
    projectId: project.id,
    projectTitle: project.title,
    credit: project.credit,
    year: project.year,
    source: project.source,
  }));

  const handPicked = project.frames.filter((f) => f.origin === "hand").length;

  return (
    <>
      <section className="px-5 md:px-6 pt-16 pb-12 md:pt-20">
        <p className="text-sm">
          <Link href="/stills" className="underline underline-offset-4">
            the Stills
          </Link>
          <span className="text-muted"> / {project.title}</span>
        </p>
        <h1 className="mt-8 font-serif text-4xl md:text-6xl leading-tight max-w-4xl">
          {project.title}
        </h1>
        <p className="mt-6 text-sm text-muted">
          {[project.credit, project.year].filter(Boolean).join(" · ")}
        </p>
        {project.note && (
          <p className="mt-6 max-w-xl text-sm text-muted leading-relaxed">
            {project.note}
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          {hasSource(project.source) && (
            <a
              href={project.source.url}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 accent-hover-text transition-colors"
            >
              Watch the source →
            </a>
          )}
          <span className="text-muted">
            {project.frames.length} frames from {timecode(project.duration)}
            {handPicked > 0 && `, ${handPicked} picked by hand`}
          </span>
        </div>
        {project.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <Link
                key={tag}
                href={`/stills?tag=${encodeURIComponent(tag)}`}
                className="card rounded-full px-3 py-1 text-xs accent-hover transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Where the kept frames sit in the film. A curation is as much about
          what was skipped as what was taken, and this is the only place that
          shows it. */}
      {project.duration > 0 && (
        <section className="px-5 md:px-6 py-8">
          <div className="relative h-8">
            {project.frames.map((frame, i) => (
              <button
                key={frame.id}
                onClick={() => setOpenIndex(i)}
                aria-label={`Frame at ${timecode(frame.t)}`}
                title={timecode(frame.t)}
                className="absolute bottom-0 w-px h-4 bg-foreground hover:h-8 transition-all"
                style={{ left: `${(frame.t / project.duration) * 100}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>0:00</span>
            <span>{timecode(project.duration)}</span>
          </div>
        </section>
      )}

      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {project.frames.map((frame, i) => (
            <button
              key={frame.id}
              onClick={() => setOpenIndex(i)}
              className="group relative block aspect-video bg-background overflow-hidden text-left"
            >
              <img
                src={frameSrc(assetBase, project.id, frame)}
                srcSet={frameSrcSet(assetBase, project.id, frame)}
                sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                alt={`Style frame from ${project.title} at ${timecode(frame.t)}`}
                width={frame.w}
                height={frame.h}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span className="absolute bottom-0 left-0 bg-background px-2 py-1 text-xs">
                {timecode(frame.t)}
              </span>
            </button>
          ))}
          <GridFillers count={project.frames.length} cols={[1, 2, 3]} />
        </div>
      </section>

      <Cta />

      {openIndex !== null && items[openIndex] && (
        <Lightbox
          item={items[openIndex]}
          position={{ index: openIndex, total: items.length }}
          onClose={() => setOpenIndex(null)}
          onStep={(delta) =>
            setOpenIndex((current) => {
              if (current === null) return current;
              return (current + delta + items.length) % items.length;
            })
          }
        />
      )}
    </>
  );
}
