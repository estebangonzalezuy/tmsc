"use client";

/* eslint-disable @next/next/no-img-element -- see the note in Lightbox.tsx:
   the extractor writes a 400px thumb next to every still, so the wall is
   already serving the right file at the right size. */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { studioSection, useContent } from "@/components/content";
import Cta from "@/components/Cta";
import GridFillers from "@/components/stills/GridFillers";
import Lightbox, { type LightboxItem } from "@/components/stills/Lightbox";
import { accentHover, Emphasize } from "@/components/Motifs";
import {
  emptyWall,
  frameSrc,
  frameSrcSet,
  hashSeed,
  pickSpread,
  seededShuffle,
  timecode,
} from "@/lib/stills-shared";
import type { WallData, WallFrame, WallProject } from "@/lib/stills-shared";

// the Stills — the wall, in two views.
//
// **Stills** is what it opens on: every kept frame from every project,
// shuffled, so somebody arriving sees the work rather than a list of films.
//
// The shuffle is seeded and the seed rides in the URL. Prerendered pages can't
// use Math.random without the server and the browser disagreeing, and a wall
// that reorders itself on every render is unusable — so a cold landing uses a
// fixed seed, which is shuffled to look at and identical on both sides, while
// the tab and Shuffle roll a new one. A seed also makes a particular shuffle a
// link somebody can send.
//
// **Projects** is the other half: a film chosen, gone through frame by frame,
// shown as four stills spread across its length so the card says what the
// whole thing looks like rather than what one second of it does.
//
// The wall index arrives as a prop: the route derives it from projects.json at
// build time (lib/stills), so the client gets every frame it needs to filter
// and none of the detail it doesn't. Project pages load the full record for
// the one project they show.

/* Enough tags to scan, not so many the rail buries the wall. */
const VISIBLE_TAGS = 18;
/* Frames on a project card. Four reads as a range at any width and divides
   evenly into the grid. */
const CARD_FRAMES = 4;

const fallback = {
  label: "Stills",
  /* `*...*` is italic — see Emphasize. The headline is the whole hero now, so
     it has to say what the page is to somebody who has never heard of the
     club, not just set a tone. */
  headline: "Style frames from the best projects in *motion design*.",
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

  const view = params.get("view") === "projects" ? "projects" : "stills";
  const seed = params.get("seed") ?? "";

  /* Projects that still have a frame after filtering, in the wall's own order
     (newest first), each carrying the four it will show. */
  const grouped = useMemo(() => {
    const byProject = new Map<number, WallFrame[]>();
    for (const { frame } of results) {
      const list = byProject.get(frame.p);
      if (list) list.push(frame);
      else byProject.set(frame.p, [frame]);
    }
    return [...byProject.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([p, frames]) => ({
        project: wall.projects[p] as WallProject,
        frames,
        shown: pickSpread(frames, CARD_FRAMES),
      }));
  }, [wall, results]);

  /* The shuffled order, and the frames in it. Shuffling the results rather
     than the whole wall keeps a filtered view filtered. */
  const shuffled = useMemo(
    () => seededShuffle(results, hashSeed(seed || "the-stills")),
    [results, seed],
  );

  const items: LightboxItem[] = useMemo(
    () =>
      shuffled.map(({ frame }) => {
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
          link: project.link,
        };
      }),
    [wall, shuffled],
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
        {...studioSection("stills", "Stills")}
        className="px-5 md:px-6 pt-12 md:pt-16 pb-7 text-center"
      >
        <h1 className="mx-auto max-w-3xl font-serif text-4xl md:text-6xl leading-tight">
          <Emphasize text={stills.headline || fallback.headline} />
        </h1>
      </section>

      {wall.frameCount === 0 ? (
        <section className="px-5 md:px-6 py-24">
          <p className="max-w-md text-sm text-muted leading-relaxed">
            The wall is empty. The first project goes up as soon as it&apos;s
            been through the frames one by one. This is a curation, so
            nothing lands here automatically.
          </p>
        </section>
      ) : (
        <>
          <section className="px-5 md:px-6 pb-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-3 text-sm">
            <div className="flex items-center gap-1.5">
              {/* Landing on Stills without a seed gives the deterministic
                  order the server prerendered. Arriving by the tab rolls a
                  fresh one, which is a click rather than a render, so the
                  hydration stays honest. */}
              <Tab
                on={view === "stills"}
                onClick={() =>
                  setParams((next) => {
                    next.delete("view");
                    next.set("seed", Math.random().toString(36).slice(2, 8));
                  })
                }
              >
                Stills <Count on={view === "stills"}>{results.length}</Count>
              </Tab>
              <Tab
                on={view === "projects"}
                onClick={() =>
                  setParams((next) => {
                    next.set("view", "projects");
                    next.delete("seed");
                  })
                }
              >
                Projects{" "}
                <Count on={view === "projects"}>{grouped.length}</Count>
              </Tab>
            </div>

            <label className="block w-full max-w-xs">
              <span className="sr-only">Search Stills</span>
              <input
                type="search"
                value={query}
                onChange={(e) =>
                  setParams((next) => {
                    if (e.target.value) next.set("q", e.target.value);
                    else next.delete("q");
                  })
                }
                placeholder="Search project, studio or tag…"
                className="w-full card rounded-full px-4 py-2 text-sm placeholder:text-muted focus:outline-none"
              />
            </label>

            <div className="flex items-center gap-5">
              {view === "stills" && results.length > 1 && (
                <button
                  onClick={() =>
                    setParams((next) =>
                      next.set("seed", Math.random().toString(36).slice(2, 8)),
                    )
                  }
                  className="text-xs underline underline-offset-4 accent-hover-text transition-colors"
                >
                  Shuffle
                </button>
              )}
              {filtering && (
                <button
                  onClick={() =>
                    setParams((next) => {
                      next.delete("q");
                      next.delete("tag");
                      next.delete("project");
                    })
                  }
                  className="text-xs underline underline-offset-4 accent-hover-text transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </section>


          {wall.tags.length > 0 && (
            <section className="px-5 md:px-6 py-6">
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
                        className={`rounded-full px-3 py-1 text-xs transition-colors ${
                          on
                            ? "bg-foreground text-background"
                            : "accent-hover"
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
                      className="px-2 py-1 text-xs underline underline-offset-4 accent-hover-text transition-colors"
                    >
                      {expanded ? "Show fewer" : `Show all ${wall.tags.length}`}
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}


          <section className="mx-auto max-w-[1600px] px-5 md:px-6 pb-10">
            {results.length === 0 ? (
              <p className="py-24 text-sm text-muted">
                Nothing matches that. Try fewer tags.
              </p>
            ) : view === "projects" ? (
              <div className="grid md:grid-cols-2 gap-3">
                {grouped.map(({ project, frames, shown }) => (
                  <Link
                    key={project.id}
                    href={`/stills/${project.id}`}
                    className={`group block card card-lift p-5 md:p-6 ${accentHover(project.id)}`}
                  >
                    <div className="grid grid-cols-4 gap-3">
                      {shown.map((frame) => (
                        <span
                          key={frame.id}
                          className="relative block aspect-video overflow-hidden bg-surface card-sm"
                        >
                          <img
                            src={frameSrc(
                              wall.assetBase,
                              project.id,
                              frame,
                              "thumb",
                            )}
                            srcSet={frameSrcSet(
                              wall.assetBase,
                              project.id,
                              frame,
                            )}
                            sizes="(min-width: 768px) 12vw, 24vw"
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        </span>
                      ))}
                    </div>
                    <h2 className="mt-5 font-serif text-xl md:text-2xl">
                      {project.title}
                    </h2>
                    <p className="mt-1 text-xs text-muted accent-hover-sub">
                      {[project.credit || "Uncredited", project.year]
                        .filter(Boolean)
                        .join(" · ")}
                      {" · "}
                      {frames.length}
                      {frames.length === project.frameCount
                        ? " frames"
                        : ` of ${project.frameCount} frames`}
                    </p>
                  </Link>
                ))}
                <GridFillers count={grouped.length} cols={[1, 2, 2]} />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {shuffled.map(({ frame }, i) => {
                  const project = wall.projects[frame.p];
                  return (
                    <button
                      key={`${project.id}-${frame.id}`}
                      onClick={() => setOpenIndex(i)}
                      className="group relative block aspect-video bg-surface card-sm overflow-hidden text-left"
                    >
                      <img
                        src={frameSrc(wall.assetBase, project.id, frame, "thumb")}
                        srcSet={frameSrcSet(wall.assetBase, project.id, frame)}
                        sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
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
                <GridFillers count={shuffled.length} cols={[2, 3, 4]} />
              </div>
            )}
          </section>
        </>
      )}

      <section className="px-5 md:px-6 py-10">
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

/* The two views. A pill, like the tag filters, because it is the same kind of
   control: something you switch on, not something you press. */
function Tab({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
        on ? "bg-foreground text-background" : "accent-hover"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ on, children }: { on: boolean; children: React.ReactNode }) {
  // Inside a filled pill plain text-muted would survive the fill and go
  // unreadable, which is what accent-hover-sub exists to prevent.
  return (
    <span className={on ? "text-background/60" : "text-muted accent-hover-sub"}>
      {children}
    </span>
  );
}
