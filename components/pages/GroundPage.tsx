"use client";

import { hiddenSet, studioSection, useContent } from "@/components/content";
import {
  Boxed,
  CircleLetter,
  Emphasize,
  OrbitRing,
  SectionHeading,
  accentHover,
} from "@/components/Motifs";
import Cta from "@/components/Cta";

/* The shape of a practice year, drawn rather than described: how many takes
   landed in each of sixteen weeks. It is an illustration, not the owner's
   copy, so it lives here — the sentence explaining it comes from the Studio
   like everything else. The run dips, stops entirely for two weeks, and comes
   back, because that is the argument the picture is making. */
const WEEK_SHAPE = [3, 4, 2, 5, 1, 0, 0, 2, 4, 3, 5, 1, 0, 2, 4, 3];
const WEEK_ROWS = 5;
const EMPTY_WEEKS = WEEK_SHAPE.filter((n) => n === 0);

export default function GroundPage() {
  const content = useContent();
  const { site, ground, groundSteps, groundFirst, groundRoadmap } = content;
  const hidden = hiddenSet(content);
  const shipped = groundFirst.filter((f) => f.state === "in");
  const later = groundFirst.filter((f) => f.state !== "in");

  return (
    <>
      {/* Hero. The orbit rings are the club's own mark for something that
          comes back around, which is what this page is about. */}
      <section
        {...studioSection("ground", "the Ground")}
        className="relative overflow-hidden px-5 md:px-6 py-24 md:py-32"
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-end">
          <OrbitRing
            letters={["G", "R", "O", "U", "N", "D"]}
            size={620}
            duration="90s"
            className="hidden lg:block -mr-32"
          />
        </div>
        <div className="relative">
          <p className="text-sm underline underline-offset-4">{ground.label}</p>
          <h1 className="mt-8 font-serif text-4xl md:text-6xl leading-tight max-w-4xl">
            <Emphasize text={ground.headline} />
          </h1>
          <p className="mt-8 max-w-xl text-sm text-muted leading-relaxed">
            {ground.intro}
          </p>
          <div className="mt-10">
            <a href={ground.ctaHref} target="_blank" rel="noreferrer">
              <Boxed className="accent-hover">{ground.ctaLabel}</Boxed>
            </a>
          </div>
          <p className="mt-8 max-w-md text-xs text-muted leading-relaxed">
            {ground.promise}
          </p>
        </div>
      </section>

      {/* How it works — the loop, as four cards that hand on to each other. */}
      <section
        {...studioSection("groundSteps", "the Ground — how it works")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <SectionHeading
          label={ground.howLabel}
          title={<Emphasize text={ground.howTitle} />}
        />
        <p className="mt-8 max-w-xl text-sm text-muted leading-relaxed">
          {ground.howNote}
        </p>

        <ol className="mt-14 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {groundSteps.map((step) => (
            <li
              key={step.number}
              className={`card card-lift p-7 flex flex-col ${accentHover(step.name)}`}
            >
              <CircleLetter>{step.number}</CircleLetter>
              <h3 className="mt-5 font-serif text-2xl leading-snug">
                {step.name}
              </h3>
              <p className="mt-3 text-sm text-muted accent-hover-sub leading-relaxed">
                {step.note}
              </p>
            </li>
          ))}
        </ol>

        {/* The fourth step hands back to the first, so the row of cards needs
            somebody to say so. */}
        <div className="mt-3 card p-7 md:p-8">
          <div className="inset p-6 md:p-7 flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <CircleLetter size="size-8" className="translate-y-1">
              ↺
            </CircleLetter>
            <p className="font-serif text-xl md:text-2xl leading-snug max-w-2xl">
              And the loop closes. The people who answer the most are the ones
              invited to sit on the other side of it.
            </p>
          </div>
        </div>
      </section>

      {/* The week strip. The one picture that makes the difference from a
          portfolio site obvious without a paragraph. */}
      <section
        {...studioSection("ground", "the Ground")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <SectionHeading
          label="Your weeks"
          title={<Emphasize text={ground.weekTitle} />}
        />
        <p className="mt-8 max-w-xl text-sm text-muted leading-relaxed">
          {ground.weekNote}
        </p>

        <div className="mt-14 card p-6 md:p-10">
          <div className="inset p-5 md:p-8 overflow-x-auto">
            <div className="flex items-end gap-1.5 md:gap-2.5 min-w-max">
              {WEEK_SHAPE.map((count, i) => (
                <div
                  key={i}
                  className={`group flex flex-col items-center gap-2 rounded-[0.6rem] px-1.5 md:px-2 py-2 ${accentHover(
                    `week-${i}`,
                  )}`}
                >
                  <div className="flex flex-col-reverse gap-1.5">
                    {Array.from({ length: WEEK_ROWS }).map((_, row) => (
                      <span
                        key={row}
                        /* An empty cell has to stay lighter than a full one
                           in both states. Left at a flat 8% black it went
                           darker than the fill once the column lit up, which
                           read as more rather than less, so it follows
                           --hover-type at the same 18% a .pill does inside a
                           hovering card. */
                        className={`block size-4 md:size-6 rounded-[0.3rem] ${
                          row < count
                            ? "bg-foreground group-hover:bg-[var(--hover-type)]"
                            : "bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] group-hover:bg-[color-mix(in_srgb,var(--hover-type)_18%,transparent)]"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] md:text-xs text-muted accent-hover-sub tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
            <span>{WEEK_SHAPE.length} weeks of one person&rsquo;s practice</span>
            <span className="pill">
              {EMPTY_WEEKS.length} of them empty, and they stay on the page
            </span>
          </div>
        </div>
      </section>

      {/* What ships first, and what deliberately does not. */}
      <section
        {...studioSection("groundFirst", "the Ground — the first version")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <SectionHeading
          label="The first version"
          title={<Emphasize text={ground.firstTitle} />}
        />
        <p className="mt-8 max-w-xl text-sm text-muted leading-relaxed">
          {ground.firstNote}
        </p>

        <div className="mt-14 grid gap-3 md:grid-cols-2">
          <div className="card p-7 md:p-9">
            <p className="text-sm underline underline-offset-4">In from day one</p>
            <ul className="mt-6 row-divide">
              {shipped.map((item) => (
                <li key={item.name} className="flex gap-4 py-5 first:pt-0">
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-foreground" />
                  <div>
                    <p className="text-base">{item.name}</p>
                    <p className="mt-1.5 text-sm text-muted leading-relaxed">
                      {item.note}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-7 md:p-9">
            <p className="text-sm underline underline-offset-4">Not yet</p>
            <ul className="mt-6 row-divide">
              {later.map((item) => (
                <li key={item.name} className="flex gap-4 py-5 first:pt-0">
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full border border-foreground/40" />
                  <div>
                    <p className="text-base text-muted">{item.name}</p>
                    <p className="mt-1.5 text-sm text-muted leading-relaxed">
                      {item.note}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* The roadmap, in order. */}
      <section
        {...studioSection("groundRoadmap", "the Ground — roadmap")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <SectionHeading
          label="Roadmap"
          title={<Emphasize text={ground.roadmapTitle} />}
        />
        <p className="mt-8 max-w-xl text-sm text-muted leading-relaxed">
          {ground.roadmapNote}
        </p>

        <ol className="mt-14 card row-divide px-6 md:px-8">
          {groundRoadmap.map((item) => (
            <li
              key={item.number}
              className="grid gap-3 py-7 md:grid-cols-[3rem_9rem_1fr] md:gap-8 md:items-baseline"
            >
              <span className="font-serif text-2xl text-muted tabular-nums">
                {item.number}
              </span>
              <div>
                <span className="pill text-xs">{item.state}</span>
              </div>
              <div>
                <h3 className="font-serif text-2xl leading-snug">{item.name}</h3>
                <p className="mt-2 max-w-2xl text-sm text-muted leading-relaxed">
                  {item.note}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {!hidden.has("ground") && (
          <p className="mt-10 max-w-xl text-sm text-muted leading-relaxed">
            Everything here is built in the open on {site.short}. The date any
            of it arrives depends on how many people are posting by then.
          </p>
        )}
      </section>

      <Cta
        title={
          <>
            the Ground opens to a <em>small group</em> first
          </>
        }
      />
    </>
  );
}
