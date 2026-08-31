"use client";

import { hiddenSet, studioSection, useContent } from "@/components/content";
import {
  Boxed,
  Emphasize,
  LetterMarquee,
  accentHover,
} from "@/components/Motifs";
import ClipCanvas, { type ClipShape } from "@/components/clips/ClipCanvas";
import { useNearViewport } from "@/components/clips/useNearViewport";
import Cta from "@/components/Cta";

/* A take on the hero band. Resolved on the server (see the route) because
   lib/clips holds every clip of every project and must not reach the client. */
export type DemoTake = {
  id: string;
  credit: string;
  sheet: string;
  poster: string;
  shape: ClipShape;
};

/* The shape of a practice year, drawn rather than described: how many takes
   landed in each of twenty-four weeks. An illustration, not the owner's copy,
   so it lives here — the sentence explaining it comes from the Studio like
   everything else. The run dips, stops entirely three times, and comes back,
   because that is the argument the picture is making. */
const WEEK_SHAPE = [
  3, 4, 2, 5, 1, 0, 0, 2, 4, 3, 5, 1, 0, 2, 4, 3, 5, 2, 1, 0, 3, 5, 4, 2,
];
const WEEK_ROWS = 5;
const EMPTY_WEEKS = WEEK_SHAPE.filter((n) => n === 0);

/* The three sides of the economy. Not in site.json: this is the argument the
   page makes about how the club works, and it moves when the design moves,
   unlike the copy around it. */
const CURRENCY = [
  [
    "You are paid for helping",
    "A credit is minted by the person who received the feedback, never by the act of posting one. Leaving a comment earns nothing on its own, which is what keeps a feed clear of applause.",
  ],
  [
    "Credits buy time, not things",
    "Every mentor keeps a few free slots each month, and credits are the only way to reach one. The rest are paid, and the mentor sets the price.",
  ],
  [
    "The feed picks the mentors",
    "Eligibility is read off the record you already built: credits earned, weeks shown up. Then a call with every candidate before anybody is approved.",
  ],
];

/* `takes` is optional for the same reason the two walls' is: the Studio
   preview renders this page from the client and would otherwise show an empty
   hero while the owner edits the copy under it. */
export default function GroundPage({ takes = [] }: { takes?: DemoTake[] }) {
  const content = useContent();
  const { site, ground, groundSteps, groundFirst, groundRoadmap } = content;
  const hidden = hiddenSet(content);
  const shipped = groundFirst.filter((f) => f.state === "in");
  const later = groundFirst.filter((f) => f.state !== "in");

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section
        {...studioSection("ground", "the Ground")}
        className="pt-14 md:pt-20 pb-20 md:pb-28"
      >
        <div className="px-5 md:px-6">
          <p className="text-sm underline underline-offset-4">{ground.label}</p>
          {/* The loudest thing on the site, on purpose: the page has to land
              in one screen, and the club's display face is what it lands
              with. */}
          <h1 className="mt-6 font-serif leading-[0.88] tracking-[-0.02em] text-[clamp(2.9rem,10.5vw,9.5rem)]">
            <Emphasize text={ground.headline} />
          </h1>
        </div>

        {/* The product, moving, before a word of explanation. Two bands going
            opposite ways so the eye keeps crossing them. */}
        <div className="mt-12 md:mt-16 space-y-3 md:space-y-4">
          <TakeBand takes={takes} seconds={70} />
          <TakeBand takes={[...takes].reverse()} seconds={88} reverse />
        </div>

        <p className="px-5 md:px-6 mt-5 text-xs text-muted">
          Clips from the club&rsquo;s own library, standing in until the first
          takes land.
        </p>

        <div className="px-5 md:px-6 mt-12 md:mt-16 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <p className="max-w-xl text-base md:text-lg leading-relaxed">
            {ground.intro}
          </p>
          <a href={ground.ctaHref} target="_blank" rel="noreferrer">
            <Boxed className="text-lg accent-hover">{ground.ctaLabel}</Boxed>
          </a>
        </div>
        <p className="px-5 md:px-6 mt-8 max-w-md text-xs text-muted leading-relaxed">
          {ground.promise}
        </p>
      </section>

      <LetterMarquee text="PRACTICE IN PUBLIC · " />

      {/* ---------------------------------------------------- how it works */}
      <section
        {...studioSection("groundSteps", "the Ground — how it works")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <p className="text-sm underline underline-offset-4">
          {ground.howLabel}
        </p>
        <h2 className="mt-6 font-serif leading-[0.95] tracking-[-0.02em] text-[clamp(2.2rem,6.5vw,5.5rem)] max-w-5xl">
          <Emphasize text={ground.howTitle} />
        </h2>
        <p className="mt-10 max-w-xl text-sm text-muted leading-relaxed">
          {ground.howNote}
        </p>

        {/* Full-bleed rows rather than a row of cards: four cards make four
            equal things, and this is a sequence. */}
        <ol className="mt-16 card row-divide overflow-hidden px-6 md:px-10 max-w-[88rem]">
          {groundSteps.map((step) => (
            <li
              key={step.number}
              className={`group -mx-6 md:-mx-10 px-6 md:px-10 py-9 md:py-12 grid gap-4 md:gap-12 md:grid-cols-[6.5rem_22rem_minmax(0,1fr)] md:items-baseline transition-colors ${accentHover(
                step.name,
              )}`}
            >
              <span className="font-serif leading-none text-[clamp(3rem,7vw,6rem)] text-muted accent-hover-sub tabular-nums">
                {step.number}
              </span>
              <h3 className="font-serif text-3xl md:text-4xl leading-[1.05]">
                {step.name}
              </h3>
              <p className="text-sm md:text-base text-muted accent-hover-sub leading-relaxed max-w-xl">
                {step.note}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------- your weeks */}
      <section
        {...studioSection("ground", "the Ground")}
        className="py-24 md:py-32"
      >
        <div className="px-5 md:px-6">
          <p className="text-sm underline underline-offset-4">Your weeks</p>
          <h2 className="mt-6 font-serif leading-[0.95] tracking-[-0.02em] text-[clamp(2.2rem,6.5vw,5.5rem)] max-w-5xl">
            <Emphasize text={ground.weekTitle} />
          </h2>
          <p className="mt-10 max-w-xl text-sm text-muted leading-relaxed">
            {ground.weekNote}
          </p>
        </div>

        <div className="px-5 md:px-6 mt-16">
          <div className="card p-6 md:p-12">
            <div className="inset p-5 md:p-10 overflow-x-auto">
              <div className="flex items-end gap-1 md:gap-2 min-w-[46rem]">
                {WEEK_SHAPE.map((count, i) => (
                  <div
                    key={i}
                    className={`group flex flex-1 flex-col items-center gap-2 rounded-[0.7rem] px-1 md:px-1.5 py-2 transition-colors ${accentHover(
                      `week-${i}`,
                    )}`}
                  >
                    <div className="flex w-full flex-col-reverse gap-1 md:gap-1.5">
                      {Array.from({ length: WEEK_ROWS }).map((_, row) => (
                        <span
                          key={row}
                          /* An empty cell has to stay lighter than a full one
                             in both states. Left at a flat 8% black it went
                             darker than the fill once the column lit up, which
                             read as more rather than less, so it follows
                             --hover-type at the same 18% a .pill takes inside
                             a hovering card. */
                          className={`block aspect-square w-full rounded-[0.25rem] ${
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
        </div>
      </section>

      {/* ------------------------------------------------- the turn, in ink */}
      {/* Near-black and full bleed. The club's own ground inverted, which the
          mobile menu already does. The page needs one moment that stops, and
          the economy is the part nobody has heard before. */}
      <section
        {...studioSection("groundSteps", "the Ground — how it works")}
        className="bg-foreground text-background px-5 md:px-6 py-28 md:py-40"
      >
        <p className="text-sm underline underline-offset-4 text-background/70">
          Feedback is the currency
        </p>
        <h2 className="mt-6 font-serif leading-[0.95] tracking-[-0.02em] text-[clamp(2.2rem,7vw,6rem)] max-w-5xl">
          Everywhere else a comment is <em>exhaust</em>. Here it buys something.
        </h2>
        <div className="mt-16 md:mt-24 grid gap-12 md:gap-10 md:grid-cols-3 max-w-6xl">
          {CURRENCY.map(([title, body]) => (
            <div key={title}>
              <h3 className="font-serif text-2xl md:text-3xl leading-snug">
                {title}
              </h3>
              <p className="mt-4 text-sm md:text-base text-background/70 leading-relaxed">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <LetterMarquee text="POST THE ROUGH ONES · " />

      {/* ---------------------------------------------- what ships, and not */}
      <section
        {...studioSection("groundFirst", "the Ground — the first version")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <p className="text-sm underline underline-offset-4">
          The first version
        </p>
        <h2 className="mt-6 font-serif leading-[0.95] tracking-[-0.02em] text-[clamp(2.2rem,6.5vw,5.5rem)] max-w-5xl">
          <Emphasize text={ground.firstTitle} />
        </h2>
        <p className="mt-10 max-w-xl text-sm text-muted leading-relaxed">
          {ground.firstNote}
        </p>

        <div className="mt-16 grid gap-3 md:grid-cols-2">
          <div className="card p-7 md:p-10">
            <p className="text-sm underline underline-offset-4">
              In from day one
            </p>
            <ul className="mt-8 row-divide">
              {shipped.map((item) => (
                <li key={item.name} className="flex gap-4 py-5 first:pt-0">
                  <span className="mt-2.5 size-2.5 shrink-0 rounded-full bg-foreground" />
                  <div>
                    <p className="font-serif text-xl leading-snug">
                      {item.name}
                    </p>
                    <p className="mt-1.5 text-sm text-muted leading-relaxed">
                      {item.note}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-7 md:p-10">
            <p className="text-sm underline underline-offset-4">Not yet</p>
            <ul className="mt-8 row-divide">
              {later.map((item) => (
                <li key={item.name} className="flex gap-4 py-5 first:pt-0">
                  <span className="mt-2.5 size-2.5 shrink-0 rounded-full border border-foreground/40" />
                  <div>
                    <p className="font-serif text-xl leading-snug text-muted">
                      {item.name}
                    </p>
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

      {/* ---------------------------------------------------------- roadmap */}
      <section
        {...studioSection("groundRoadmap", "the Ground — roadmap")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <p className="text-sm underline underline-offset-4">Roadmap</p>
        <h2 className="mt-6 font-serif leading-[0.95] tracking-[-0.02em] text-[clamp(2.2rem,6.5vw,5.5rem)] max-w-5xl">
          <Emphasize text={ground.roadmapTitle} />
        </h2>
        <p className="mt-10 max-w-xl text-sm text-muted leading-relaxed">
          {ground.roadmapNote}
        </p>

        <ol className="mt-16 card row-divide overflow-hidden px-6 md:px-10">
          {groundRoadmap.map((item) => (
            <li
              key={item.number}
              className={`group -mx-6 md:-mx-10 px-6 md:px-10 py-8 md:py-10 grid gap-3 md:gap-10 md:grid-cols-[5rem_8rem_1fr] md:items-baseline transition-colors ${accentHover(
                item.name,
              )}`}
            >
              <span className="font-serif leading-none text-[clamp(2rem,4vw,3.25rem)] text-muted accent-hover-sub tabular-nums">
                {item.number}
              </span>
              <div>
                <span className="pill text-xs">{item.state}</span>
              </div>
              <div>
                <h3 className="font-serif text-2xl md:text-3xl leading-snug">
                  {item.name}
                </h3>
                <p className="mt-2 max-w-2xl text-sm text-muted accent-hover-sub leading-relaxed">
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

/* A band of takes crossing the page.

   The row is rendered twice and shifted by exactly half the track, which is
   what `.animate-marquee` already does for the letter band — so this needs no
   new keyframe, and it stops under prefers-reduced-motion for free. Only the
   first copy is announced; the second is the same pictures again. */
function TakeBand({
  takes,
  seconds,
  reverse = false,
}: {
  takes: DemoTake[];
  seconds: number;
  reverse?: boolean;
}) {
  if (!takes.length) return null;
  return (
    <div className="overflow-hidden">
      <div
        className="flex w-max animate-marquee gap-3 md:gap-4"
        style={{
          animationDuration: `${seconds}s`,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="flex shrink-0 gap-3 md:gap-4"
            aria-hidden={copy === 1}
          >
            {takes.map((take) => (
              <TakeTile key={`${copy}-${take.id}`} take={take} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* One take, animating once it is near enough to be worth it. The sheet is only
   fetched then, which is what lets a landing page show real motion. */
function TakeTile({ take }: { take: DemoTake }) {
  const [ref, near] = useNearViewport<HTMLSpanElement>();
  return (
    <span ref={ref} className="block w-[15rem] md:w-[21rem] shrink-0">
      <ClipCanvas
        clip={take.shape}
        sheet={take.sheet}
        poster={take.poster}
        alt={`A few seconds from ${take.credit}`}
        active={near}
        className="w-full bg-surface card card-sm"
      />
    </span>
  );
}
