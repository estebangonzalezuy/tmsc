"use client";

import Link from "next/link";
import { useState } from "react";
import ClipCanvas from "@/components/clips/ClipCanvas";
import ClipLightbox, { type LightboxClip } from "@/components/clips/ClipLightbox";
import {
  useNearViewport,
  useReducedMotion,
} from "@/components/clips/useNearViewport";
import Cta from "@/components/Cta";
import {
  clipSeconds,
  clipcode,
  hasSource,
  sheetSrc,
  type Clip,
  type ClipProject,
  type WallClip,
} from "@/lib/clips-shared";

// One project: every clip kept from one film, in the order they happen.
//
// The server wrapper passes the full record down, so this page carries only its
// own project's clips — the wall is the place that holds all of them. Read in
// order it is a reading of the film itself, which is the thing the shuffled
// wall deliberately gives up.

/** The lightbox and the canvas both speak WallClip, which is a project's clip
 *  with the project's index on it. On this page there is one project, so the
 *  index is always zero. */
const asWallClip = (clip: Clip): WallClip => ({ ...clip, p: 0 });

export default function ClipsProjectPage({
  project,
  assetBase,
}: {
  project: ClipProject;
  assetBase: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  useReducedMotion();

  const items: LightboxClip[] = project.clips.map((clip) => ({
    clip: asWallClip(clip),
    projectId: project.id,
    projectTitle: project.title,
    credit: project.credit,
    year: project.year,
    source: project.source,
    ...(project.link ? { link: project.link } : {}),
  }));

  const handPicked = project.clips.filter((c) => c.origin === "hand").length;
  const seconds = project.clips.reduce((n, c) => n + clipSeconds(c), 0);

  return (
    <>
      <section className="mx-auto max-w-[1600px] px-5 md:px-6 pt-16 pb-12 md:pt-20">
        <p className="text-sm">
          <Link href="/clips" className="underline underline-offset-4">
            the Clips
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
          {project.link && (
            <a
              href={project.link}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 accent-hover-text transition-colors"
            >
              The project →
            </a>
          )}
          <span className="text-muted">
            {project.clips.length}{" "}
            {project.clips.length === 1 ? "clip" : "clips"} ·{" "}
            {seconds.toFixed(1)}s in all
            {handPicked ? ` · ${handPicked} picked by hand` : ""}
          </span>
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-5 md:px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {project.clips.map((clip, i) => (
            <button
              key={clip.id}
              onClick={() => setOpenIndex(i)}
              className="group block text-left card card-lift overflow-hidden p-3"
            >
              <Row clip={clip} project={project} assetBase={assetBase} />
              <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="tabular-nums text-xs text-muted">
                  {clipcode(clip.in)}–{clipcode(clip.out)}
                </span>
                <span className="flex flex-wrap gap-1">
                  {[...clip.subject, ...clip.technique, ...(clip.feel ?? [])].map(
                    (value) => (
                      <span key={value} className="pill px-2 py-0.5 text-[10px]">
                        {value}
                      </span>
                    ),
                  )}
                </span>
              </div>
              {clip.note && (
                <p className="mt-2 text-xs text-muted leading-relaxed">
                  {clip.note}
                </p>
              )}
            </button>
          ))}
        </div>
      </section>

      <Cta />

      {openIndex !== null && items[openIndex] && (
        <ClipLightbox
          key={items[openIndex].clip.id}
          item={items[openIndex]}
          assetBase={assetBase}
          position={{ index: openIndex, total: items.length }}
          onClose={() => setOpenIndex(null)}
          onStep={(delta) =>
            setOpenIndex((current) =>
              current === null
                ? current
                : (current + delta + items.length) % items.length,
            )
          }
        />
      )}
    </>
  );
}

function Row({
  clip,
  project,
  assetBase,
}: {
  clip: Clip;
  project: ClipProject;
  assetBase: string;
}) {
  const [ref, near] = useNearViewport<HTMLSpanElement>();
  return (
    <span ref={ref} className="block">
      <ClipCanvas
        clip={clip}
        sheet={sheetSrc(assetBase, project.id, clip)}
        poster={sheetSrc(assetBase, project.id, clip, "poster")}
        alt={`Clip from ${project.title} at ${clipcode(clip.in)}`}
        active={near}
        className="w-full bg-surface card-sm"
      />
    </span>
  );
}
