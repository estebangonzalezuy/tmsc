"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import ClipCanvas from "@/components/clips/ClipCanvas";
import ClipLightbox, { type LightboxClip } from "@/components/clips/ClipLightbox";
import { ticker } from "@/components/clips/ticker";
import {
  useNearViewport,
  useReducedMotion,
} from "@/components/clips/useNearViewport";
import { studioSection, useContent } from "@/components/content";
import Cta from "@/components/Cta";
import { accentHover, Emphasize } from "@/components/Motifs";
import {
  clipcode,
  clipSeconds,
  emptyClipWall,
  FACET_KEYS,
  hashSeed,
  seededShuffle,
  sheetSrc,
  type ClipWall,
  type FacetKey,
  type WallClip,
  type WallClipProject,
} from "@/lib/clips-shared";

// the Clips — the wall, in two views.
//
// **Clips** is what it opens on: every clip from every project, shuffled, so
// somebody arriving sees motion rather than a list of films. The shuffle is
// seeded and the seed rides in the URL, for the reason the Stills gives — a
// prerendered page cannot use Math.random without the server and the browser
// disagreeing.
//
// **Projects** is the other half, a film at a time.
//
// What is different from the Stills is the filtering, and it is the point of
// the page. A flat tag list ANDed together answers "staggered *and* ui". It
// cannot answer "ui *or* transition, and staggered", which is the query a
// motion designer actually has. So the vocabulary is three axes, values OR
// within an axis and AND across them, and the rails are in the vocabulary's own
// order rather than by count — a rail that reorders itself as clips land is one
// you have to re-read every visit.

const fallback = {
  label: "Clips",
  headline: "A library of *motion components*, a few seconds at a time.",
  note: "Every clip links back to the second it came from, and steps frame by frame, because a stagger is not something you can see at speed.",
};

export default function ClipsPage({ wall = emptyClipWall }: { wall?: ClipWall }) {
  // Filters live in the query string, so a filtered wall is a shareable link —
  // the same contract the Stills, the Directory and the Posts Studio keep. That
  // needs a Suspense boundary to stay statically rendered, and the Studio
  // preview renders this component directly, so the boundary belongs here.
  return (
    <Suspense>
      <ClipsWall wall={wall} />
    </Suspense>
  );
}

function ClipsWall({ wall }: { wall: ClipWall }) {
  const content = useContent();
  const clips = (content as { clips?: typeof fallback }).clips ?? fallback;

  const router = useRouter();
  const params = useSearchParams();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const reduced = useReducedMotion();
  /* Null means "whatever the viewer's system says". Pressing the button sets an
     explicit answer, which is the point of having one: somebody who runs their
     machine on reduce all the time still has to be able to watch a wall of
     motion on the page that is about motion. Storing `playing` on its own made
     that impossible — the system preference won every time and the button did
     nothing. */
  const [want, setWant] = useState<boolean | null>(null);

  /* One switch over the whole wall, and the viewer's own setting decides where
     it starts: a page of forty things moving is a choice somebody is allowed to
     have already made. Derived rather than stored, so the button always says
     what is actually happening. */
  const moving = want ?? !reduced;
  useEffect(() => {
    ticker.setPaused(!moving);
  }, [moving]);

  const query = params.get("q") ?? "";
  const activeProject = params.get("project") ?? "";
  const view = params.get("view") === "projects" ? "projects" : "clips";
  const seed = params.get("seed") ?? "";

  /** What is on in each axis. One query parameter per axis, named for it, so
   *  the URL reads as the question: ?subject=ui&subject=transition&technique=stagger */
  const active = useMemo(() => {
    const out = {} as Record<FacetKey, string[]>;
    for (const key of FACET_KEYS) out[key] = params.getAll(key);
    return out;
  }, [params]);

  const activeCount = FACET_KEYS.reduce((n, k) => n + active[k].length, 0);

  /* push — a change to *what you are looking at*: a facet on or off, the two
     views, clearing. Back should undo exactly one.
     replace — a refinement of the same view: a keystroke, a re-rolled shuffle.
     One history entry per letter typed would make Back useless. */
  const setParams = useCallback(
    (
      mutate: (next: URLSearchParams) => void,
      history: "push" | "replace" = "replace",
    ) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      const qs = next.toString();
      router[history === "push" ? "push" : "replace"](qs ? `?${qs}` : "?", {
        scroll: false,
      });
    },
    [params, router],
  );

  const toggleFacet = useCallback(
    (key: FacetKey, value: string) => {
      setParams((next) => {
        const current = next.getAll(key);
        next.delete(key);
        for (const v of current) if (v !== value) next.append(key, v);
        if (!current.includes(value)) next.append(key, value);
      }, "push");
    },
    [setParams],
  );

  const results = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return wall.clips
      .map((clip, index) => ({ clip, index }))
      .filter(({ clip }) => {
        const project = wall.projects[clip.p];
        if (!project) return false;
        if (activeProject && project.id !== activeProject) return false;
        // OR within an axis, AND across them.
        for (const key of FACET_KEYS) {
          const wanted = active[key];
          if (!wanted.length) continue;
          const held = (clip[key] ?? []) as string[];
          if (!wanted.some((v) => held.includes(v))) return false;
        }
        if (!terms.length) return true;
        const haystack = [
          project.title,
          project.credit,
          project.year,
          clip.note ?? "",
          ...clip.subject,
          ...clip.technique,
          ...(clip.feel ?? []),
          ...(clip.tags ?? []),
        ]
          .join(" ")
          .toLowerCase();
        return terms.every((term) => haystack.includes(term));
      });
  }, [wall, query, active, activeProject]);

  const grouped = useMemo(() => {
    const byProject = new Map<number, WallClip[]>();
    for (const { clip } of results) {
      const list = byProject.get(clip.p);
      if (list) list.push(clip);
      else byProject.set(clip.p, [clip]);
    }
    return [...byProject.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([p, list]) => ({
        project: wall.projects[p] as WallClipProject,
        clips: list,
      }));
  }, [wall, results]);

  const shuffled = useMemo(
    () => seededShuffle(results, hashSeed(seed || "the-clips")),
    [results, seed],
  );

  const items: LightboxClip[] = useMemo(
    () =>
      shuffled.map(({ clip }) => {
        const project = wall.projects[clip.p];
        return {
          clip,
          projectId: project.id,
          projectTitle: project.title,
          credit: project.credit,
          year: project.year,
          source: project.source,
          ...(project.link ? { link: project.link } : {}),
        };
      }),
    [wall, shuffled],
  );

  const filtering = Boolean(query || activeCount || activeProject);

  return (
    <>
      <section
        {...studioSection("clips", "Clips")}
        className="px-5 md:px-6 pt-12 md:pt-16 pb-7 text-center"
      >
        <h1 className="mx-auto max-w-3xl font-serif text-4xl md:text-6xl leading-tight">
          <Emphasize text={clips.headline || fallback.headline} />
        </h1>
      </section>

      {wall.clipCount === 0 ? (
        <section className="px-5 md:px-6 py-24">
          <p className="max-w-md text-sm text-muted leading-relaxed">
            The library is empty. The first clips go up as soon as a film has
            been through shot by shot. This is a curation, so nothing lands here
            automatically.
          </p>
        </section>
      ) : (
        <>
          <section className="px-5 md:px-6 pb-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-3 text-sm">
            <div className="flex items-center gap-1.5">
              <Tab
                on={view === "clips"}
                onClick={() =>
                  setParams(
                    (next) => {
                      next.delete("view");
                      next.set("seed", Math.random().toString(36).slice(2, 8));
                    },
                    view === "clips" ? "replace" : "push",
                  )
                }
              >
                Clips <Count on={view === "clips"}>{results.length}</Count>
              </Tab>
              <Tab
                on={view === "projects"}
                onClick={() =>
                  setParams(
                    (next) => {
                      next.set("view", "projects");
                      next.delete("seed");
                    },
                    view === "projects" ? "replace" : "push",
                  )
                }
              >
                Projects <Count on={view === "projects"}>{grouped.length}</Count>
              </Tab>
            </div>

            <label className="block w-full max-w-xs">
              <span className="sr-only">Search the Clips</span>
              <input
                type="search"
                value={query}
                onChange={(e) =>
                  setParams((next) => {
                    if (e.target.value) next.set("q", e.target.value);
                    else next.delete("q");
                  })
                }
                placeholder="Search project, studio or note…"
                className="w-full card rounded-full px-4 py-2 text-sm placeholder:text-muted focus:outline-none"
              />
            </label>

            <div className="flex items-center gap-5">
              <button
                onClick={() => setWant(!moving)}
                aria-pressed={!moving}
                className="text-xs underline underline-offset-4 accent-hover-text transition-colors"
              >
                {moving ? "Hold everything still" : "Let it move"}
              </button>
              {view === "clips" && results.length > 1 && (
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
                      next.delete("project");
                      for (const key of FACET_KEYS) next.delete(key);
                    }, "push")
                  }
                  className="text-xs underline underline-offset-4 accent-hover-text transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </section>

          <section className="px-5 md:px-6 py-2 space-y-2">
            {wall.facets.map((facet) => (
              <div
                key={facet.key}
                className="grid md:grid-cols-[9rem_1fr] gap-2 md:gap-4 items-baseline"
              >
                <p className="text-xs text-muted">{facet.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {facet.values.map((value) => {
                    const on = active[facet.key].includes(value.value);
                    return (
                      <button
                        key={value.value}
                        onClick={() => toggleFacet(facet.key, value.value)}
                        aria-pressed={on}
                        className={`rounded-full px-3 py-1 text-xs transition-colors ${
                          on ? "bg-foreground text-background" : "accent-hover"
                        }`}
                      >
                        {value.value}{" "}
                        <Count on={on}>{value.count}</Count>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {activeCount > 1 && (
              <p className="md:pl-[calc(9rem+1rem)] text-xs text-muted">
                Anything matching one of the chips in a row, and every row you
                have used.
              </p>
            )}
          </section>

          <section className="mx-auto max-w-[1600px] px-5 md:px-6 py-8">
            {results.length === 0 ? (
              <p className="py-24 text-sm text-muted">
                Nothing matches that. Try one fewer row.
              </p>
            ) : view === "projects" ? (
              <div className="grid md:grid-cols-2 gap-3">
                {grouped.map(({ project, clips: list }) => (
                  <Link
                    key={project.id}
                    href={`/clips/${project.id}`}
                    className={`group block card card-lift p-5 md:p-6 ${accentHover(project.id)}`}
                  >
                    <div className="grid grid-cols-3 gap-3">
                      {list.slice(0, 3).map((clip) => (
                        <Tile
                          key={clip.id}
                          clip={clip}
                          assetBase={wall.assetBase}
                          projectId={project.id}
                          title={project.title}
                        />
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
                      {list.length}
                      {list.length === project.clipCount
                        ? " clips"
                        : ` of ${project.clipCount} clips`}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {shuffled.map(({ clip }, i) => {
                  const project = wall.projects[clip.p];
                  return (
                    <button
                      key={`${project.id}-${clip.id}`}
                      onClick={() => setOpenIndex(i)}
                      className="group relative block text-left card-sm overflow-hidden bg-surface"
                    >
                      <Tile
                        clip={clip}
                        assetBase={wall.assetBase}
                        projectId={project.id}
                        title={project.title}
                      />
                      <span className="absolute inset-0 flex flex-col justify-end bg-foreground/0 group-hover:bg-foreground/70 transition-colors">
                        <span className="p-3 opacity-0 group-hover:opacity-100 transition-opacity text-background">
                          <span className="block truncate text-sm">
                            {project.title}
                          </span>
                          <span className="block truncate text-xs text-background/60">
                            {[...clip.subject, ...clip.technique]
                              .slice(0, 3)
                              .join(" · ") || project.credit || "Uncredited"}
                          </span>
                        </span>
                      </span>
                      <span className="pointer-events-none absolute top-2 right-2 rounded-full bg-background/85 px-2 py-0.5 text-[10px] tabular-nums">
                        {clipSeconds(clip).toFixed(1)}s
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <section className="px-5 md:px-6 py-10">
        <p className="max-w-xl text-xs text-muted leading-relaxed">{clips.note}</p>
      </section>

      <Cta />

      {openIndex !== null && items[openIndex] && (
        <ClipLightbox
          /* Keyed by the clip, so stepping to the next one remounts it and its
             held frame starts fresh — rather than an effect chasing the prop. */
          key={items[openIndex].clip.id}
          item={items[openIndex]}
          assetBase={wall.assetBase}
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

/* A clip on the wall. It animates once it is near enough to be worth it — see
   useNearViewport for why that is not just "animate everything". */
function Tile({
  clip,
  assetBase,
  projectId,
  title,
}: {
  clip: WallClip;
  assetBase: string;
  projectId: string;
  title: string;
}) {
  const [ref, near] = useNearViewport<HTMLSpanElement>();
  return (
    <span ref={ref} className="block">
      <ClipCanvas
        clip={clip}
        sheet={sheetSrc(assetBase, projectId, clip)}
        poster={sheetSrc(assetBase, projectId, clip, "poster")}
        alt={`Clip from ${title} at ${clipcode(clip.in)}`}
        active={near}
        className="w-full bg-surface card-sm"
      />
    </span>
  );
}

/* The two views. A pill, like the facet chips, because it is the same kind of
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
