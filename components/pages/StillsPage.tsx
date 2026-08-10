"use client";

/* eslint-disable @next/next/no-img-element -- see the note in Lightbox.tsx:
   the extractor writes a 400px thumb next to every still, so the wall is
   already serving the right file at the right size. */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { hiddenSet, studioSection, useContent } from "@/components/content";
import Cta from "@/components/Cta";
import GridFillers from "@/components/stills/GridFillers";
import Lightbox, { type LightboxItem } from "@/components/stills/Lightbox";
import { emptyWall, frameSrc, timecode } from "@/lib/stills-shared";
import type { WallData } from "@/lib/stills-shared";

// the Stills — the wall. Every curated frame from every project, in one
// contact sheet you can filter.
//
// The wall index arrives as a prop: the route derives it from projects.json at
// build time (lib/stills), so the client gets every frame it needs to filter
// and none of the detail it doesn't. Project pages load the full record for
// the one project they show.

/* Enough tags to scan, not so many the rail buries the wall. */
const VISIBLE_TAGS = 18;

const fallback = {
  label: "the Stills",
  intro:
    "Frames pulled out of motion work and kept: the compositions, the palettes, the type, the light. Not a mood board somebody else filled, and not a feed. A wall curated one project at a time.",
  note: "Every frame links back to the second it came from, so you can always check a still against the thing that moved.",
};

export default function StillsPage({ wall = emptyWall }: { wall?: WallData }) {
  // The filters live in the query string, so a filtered wall is a shareable
  // link — the same contract the Directory and the Post Lab keep. That needs
  // a Suspense boundary to stay statically rendered, and the Studio preview
  // renders this component directly, so the boundary belongs here.
  return (
    <Suspense>
      <StillsWall wall={wall} />
    </Suspense>
  );
}

function StillsWall({ wall }: { wall: WallData }) {
  const content = useContent();
  const hidden = hiddenSet(content);
  const stills =
    (content as { stills?: typeof fallback }).stills ?? fallback;

  const router = useRouter();
  const params = useSearchParams();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const query = params.get("q") ?? "";
  const activeTags = useMemo(() => params.getAll("tag"), [params]);
  const activeProject = params.get("project") ?? "";

  const setParams = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [params, router],
  );

  const toggleTag = useCallback(
    (tag: string) => {
      setParams((next) => {
        const current = next.getAll("tag");
        next.delete("tag");
        for (const value of current) if (value !== tag) next.append("tag", value);
        if (!current.includes(tag)) next.append("tag", tag);
      });
    },
    [setParams],
  );

  const results = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return wall.frames
      .map((frame, index) => ({ frame, index }))
      .filter(({ frame }) => {
        const project = wall.projects[frame.p];
        if (!project) return false;
        if (activeProject && project.id !== activeProject) return false;
        // Tags are AND'd: narrowing a wall of hundreds means every tag you
        // add should cut it down, not widen it.
        if (!activeTags.every((tag) => frame.tags?.includes(tag))) return false;
        if (!terms.length) return true;
        const haystack = [
          project.title,
          project.credit,
          project.year,
          ...(frame.tags ?? []),
        ]
          .join(" ")
          .toLowerCase();
        return terms.every((term) => haystack.includes(term));
      });
  }, [wall, query, activeTags, activeProject]);

  const items: LightboxItem[] = useMemo(
    () =>
      results.map(({ frame }) => {
        const project = wall.projects[frame.p];
        return {
          src: frameSrc(wall.assetBase, project.id, frame),
          w: frame.w,
          h: frame.h,
          t: frame.t,
          origin: frame.origin,
          projectId: project.id,
          projectTitle: project.title,
          credit: project.credit,
          year: project.year,
          source: project.source,
        };
      }),
    [wall, results],
  );

  const filtering = Boolean(query || activeTags.length || activeProject);
  const shownTags =
    expanded || wall.tags.length <= VISIBLE_TAGS
      ? wall.tags
      : wall.tags
          .slice(0, VISIBLE_TAGS)
          .concat(
            wall.tags.slice(VISIBLE_TAGS).filter((t) => activeTags.includes(t.value)),
          );

  return (
    <>
      <section
        {...studioSection("stills", "the Stills")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <p className="text-sm underline underline-offset-4 decoration-2 decoration-accent-warm">{stills.label}</p>
        <h1 className="mt-8 font-serif text-4xl md:text-6xl leading-tight max-w-4xl">
          The frame is where the <em>decisions</em> are.
        </h1>
        <p className="mt-8 max-w-md text-sm text-muted leading-relaxed">
          {stills.intro}
        </p>
      </section>

      <section className="border-t border-line grid grid-cols-2 md:grid-cols-4 gap-px bg-line">
        {[
          { value: String(wall.frameCount), label: "frames on the wall" },
          { value: String(wall.projectCount), label: "projects" },
          { value: String(wall.tags.length), label: "tags" },
          { value: "0", label: "boards to build yourself" },
        ].map((stat) => (
          <div key={stat.label} className="bg-background px-5 md:px-6 py-10">
            <p className="font-serif text-3xl md:text-4xl">{stat.value}</p>
            <p className="mt-2 text-xs text-muted">{stat.label}</p>
          </div>
        ))}
      </section>

      {wall.frameCount === 0 ? (
        <section className="border-t border-line px-5 md:px-6 py-24">
          <p className="max-w-md text-sm text-muted leading-relaxed">
            The wall is empty. The first project goes up as soon as it&apos;s
            been through the frames one by one. This is a curation, so
            nothing lands here automatically.
          </p>
        </section>
      ) : (
        <>
          <section className="border-t border-line px-5 md:px-6 py-6">
            <label className="block">
              <span className="sr-only">Search the Stills</span>
              <input
                type="search"
                value={query}
                onChange={(e) =>
                  setParams((next) => {
                    if (e.target.value) next.set("q", e.target.value);
                    else next.delete("q");
                  })
                }
                placeholder={`Search ${wall.frameCount} frames by project, studio or tag…`}
                className="w-full border border-line bg-background px-4 py-3 text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground"
              />
            </label>
          </section>

          {wall.tags.length > 0 && (
            <section className="border-t border-line px-5 md:px-6 py-6">
              <div className="grid md:grid-cols-[7rem_1fr] gap-2 md:gap-4 items-baseline">
                <p className="text-xs text-muted">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {shownTags.map((tag) => {
                    const on = activeTags.includes(tag.value);
                    return (
                      <button
                        key={tag.value}
                        onClick={() => toggleTag(tag.value)}
                        aria-pressed={on}
                        className={`border border-line rounded-full px-3 py-1 text-xs transition-colors ${
                          on
                            ? "bg-foreground text-background"
                            : "hover:bg-accent hover:text-background"
                        }`}
                      >
                        {tag.value}{" "}
                        <span className={on ? "text-background/60" : "text-muted"}>
                          {tag.count}
                        </span>
                      </button>
                    );
                  })}
                  {wall.tags.length > VISIBLE_TAGS && (
                    <button
                      onClick={() => setExpanded((e) => !e)}
                      className="px-2 py-1 text-xs underline underline-offset-4 hover:text-accent transition-colors"
                    >
                      {expanded ? "Show fewer" : `Show all ${wall.tags.length}`}
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className="border-t border-line px-5 md:px-6 py-4 flex items-baseline justify-between gap-4 text-sm">
            <p>
              <span className="font-serif text-xl">{results.length}</span>{" "}
              <span className="text-muted">
                {results.length === 1 ? "frame" : "frames"}
                {results.length !== wall.frameCount && ` of ${wall.frameCount}`}
              </span>
            </p>
            {filtering && (
              <button
                onClick={() => router.replace("?", { scroll: false })}
                className="underline underline-offset-4 hover:text-accent transition-colors"
              >
                Clear
              </button>
            )}
          </section>

          <section className="border-t border-line">
            {results.length === 0 ? (
              <p className="px-5 md:px-6 py-24 text-sm text-muted">
                Nothing matches that. Try fewer tags.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-px bg-line">
                {results.map(({ frame }, i) => {
                  const project = wall.projects[frame.p];
                  return (
                    <button
                      key={`${project.id}-${frame.id}`}
                      onClick={() => setOpenIndex(i)}
                      className="group relative block aspect-video bg-background overflow-hidden text-left"
                    >
                      <img
                        src={frameSrc(wall.assetBase, project.id, frame, "thumb")}
                        alt={`Style frame from ${project.title} at ${timecode(frame.t)}`}
                        width={frame.w}
                        height={frame.h}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <span className="absolute inset-0 flex flex-col justify-end bg-foreground/0 group-hover:bg-foreground/70 transition-colors">
                        <span className="p-3 opacity-0 group-hover:opacity-100 transition-opacity text-background">
                          <span className="block truncate text-sm">
                            {project.title}
                          </span>
                          <span className="block text-xs text-background/60">
                            {project.credit || "Uncredited"} · {timecode(frame.t)}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
                <GridFillers count={results.length} cols={[2, 3, 4]} />
              </div>
            )}
          </section>

          {!hidden.has("stillsIndex") && wall.projects.length > 0 && (
            <section className="border-t border-line px-5 md:px-6 py-16">
              <p className="text-sm underline underline-offset-4 decoration-2 decoration-accent-warm">By project</p>
              <ul className="mt-8 divide-y divide-line/30">
                {wall.projects.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={`/stills/${project.id}`}
                      className="group flex items-baseline justify-between gap-4 py-4"
                    >
                      <span className="font-serif text-xl md:text-2xl group-hover:underline underline-offset-4">
                        {project.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {[project.credit, project.year]
                          .filter(Boolean)
                          .join(" · ")}{" "}
                        · {project.frameCount} frames
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="border-t border-line px-5 md:px-6 py-10">
        <p className="max-w-xl text-xs text-muted leading-relaxed">
          {stills.note}
        </p>
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
