"use client";

import Link from "next/link";
import { hiddenSet, studioSection, useContent } from "@/components/content";
import { CircleLetter, SectionHeading, Emphasize } from "@/components/Motifs";
import { accentHover } from "@/lib/accent";
import Cta from "@/components/Cta";
import Cover from "@/components/learn/Cover";
import PieceGrid from "@/components/learn/PieceGrid";
import OfferBlock from "@/components/learn/OfferBlock";
import { useProgress } from "@/components/learn/useProgress";
import manifest from "@/content/learn/manifest.json";
import type { PieceCard } from "@/lib/learn";

/* The library's front page. It imports the manifest directly rather than
   lib/learn, because this is a client component and the manifest is cards and
   counts with no piece bodies in it — the same split the Directory's hub makes. */

const { tracks, path, counts } = manifest;
/* A JSON import widens "free" | "paid" back to string, so the cards are named
   here once rather than at every use. */
const pieces = manifest.pieces as PieceCard[];

/* The sample, in curriculum order. */
const open = tracks
  .flatMap((t) => t.pieces)
  .map((slug) => pieces.find((p) => p.slug === slug))
  .filter(
    (p): p is PieceCard =>
      !!p && p.state === "published" && p.access === "free",
  );

const fallback = {
  label: "Learn",
  headline: "Start in motion *today*, from the base.",
  intro:
    "You don't need more tutorials. You need an order to do things in, a constraint, and a reason to finish. Seven days that everyone walks, then a shelf you pick from.",
  inside: "Written by the club, in one place, in the order the club would teach it.",
  forWho: "",
  note: "",
};

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="card px-5 md:px-6 py-8">
      <p className="font-serif text-4xl">{n}</p>
      <p className="mt-3 text-xs text-muted leading-relaxed">{label}</p>
    </div>
  );
}

export default function LearnPage() {
  const content = useContent();
  const { learningPaths, practiceFiles, site } = content;
  const hidden = hiddenSet(content);
  const learn = (content as { learn?: typeof fallback }).learn;
  const { done, toggle, ready } = useProgress();

  const walked = path.filter((d) => done.has(d.piece)).length;

  return (
    <>
      <section
        {...studioSection("learn", "Learn")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <p className="text-sm underline underline-offset-4">
          {learn?.label ?? fallback.label}
        </p>
        <h1 className="mt-8 font-serif text-4xl md:text-6xl leading-tight max-w-4xl">
          <Emphasize text={learn?.headline ?? fallback.headline} />
        </h1>
        <p className="mt-8 max-w-md text-sm text-muted leading-relaxed">
          {learn?.intro ?? fallback.intro}
        </p>
      </section>

      {/* What's inside, counted from the library itself, so the numbers can
          never drift from what was actually built. */}
      <section className="px-5 md:px-6 py-16">
        <SectionHeading
          label="What's inside"
          title={<>{learn?.inside ?? fallback.inside}</>}
        />
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat n={counts.total} label={`pieces, ${counts.published} written so far`} />
          <Stat n={counts.tracks} label="tracks, in the order they get useful" />
          <Stat n={counts.days} label="days on the path, start to finish" />
          <Stat n={counts.free} label="open to read, no strings" />
        </div>
        <p className="mt-6 text-xs text-muted">
          {counts.articles} to read · {counts.videos} to watch · {counts.audio} to
          listen to. The rest are named and not yet made.
        </p>
      </section>

      {/* The collections. */}
      <section className="px-5 md:px-6 py-16">
        <SectionHeading
          label="The tracks"
          title={
            <>
              Three shelves, <em>in the order they get useful</em>.
            </>
          }
        />
        <div className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {tracks.map((t) => (
            <Link
              key={t.id}
              href={`/learn/${t.id}`}
              className={`group card card-lift overflow-hidden ${accentHover(t.id)}`}
            >
              <Cover slug={`track-${t.id}`} title={t.name} />
              <div className="p-6">
                {/* The card says the name; this keeps it as text for a screen
                    reader, for search, and for find-on-page. */}
                <h3 className="sr-only">{t.name}</h3>
                <div className="flex items-baseline justify-between gap-4">
                  <CircleLetter>{t.letter}</CircleLetter>
                  <span className="text-xs text-muted accent-hover-sub">
                    {t.published} of {t.count}
                  </span>
                </div>
                <p className="mt-5 text-sm text-muted accent-hover-sub leading-relaxed">
                  {t.blurb}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* The sample. */}
      {open.length > 0 && (
        <section className="px-5 md:px-6 py-16">
          <SectionHeading
            label="Open to read"
            title={
              <>
                Start here, <em>for nothing</em>.
              </>
            }
          />
          <p className="mt-6 max-w-md text-sm text-muted leading-relaxed">
            {open.length === 1 ? "This one is" : `These ${open.length} are`} out from
            behind the library, in full, so you can decide what the rest is worth.
          </p>
          <div className="mt-12">
            <PieceGrid pieces={open} />
          </div>
        </section>
      )}

      {/* Who it's for. A library that says who it isn't for is more useful than
          one that claims to be for everybody. */}
      {learn?.forWho && (
        <section className="px-5 md:px-6 py-16">
          <SectionHeading
            label="Who it's for"
            title={
              <>
                Not a first tutorial, <em>and not a reference</em>.
              </>
            }
          />
          <p className="mt-8 max-w-xl text-sm text-muted leading-relaxed">
            {learn.forWho}
          </p>
        </section>
      )}

      <section className="px-5 md:px-6 py-16">
        <OfferBlock />
      </section>

      {/* The on-ramp. */}
      <section className="px-5 md:px-6 py-16">
        <SectionHeading
          label="The first seven days"
          title={
            <>
              One piece a day, and <em>one thing to go and do</em>.
            </>
          }
        />
        <p className="mt-6 max-w-md text-sm text-muted leading-relaxed">
          In order, because the order is the point. Each day is short, and each
          one ends with something to make. Ticking a day is just for you, and it
          stays in this browser.
        </p>

        <p className="mt-8 text-xs text-muted" aria-live="polite">
          {ready && walked > 0
            ? `Day ${Math.min(walked + 1, path.length)} of ${path.length}. ${walked} done.`
            : `${path.length} days.`}
        </p>

        <ul className="mt-6 card row-divide px-6">
          {path.map((d) => {
            const isDone = ready && done.has(d.piece);
            const card = pieces.find((p) => p.slug === d.piece);
            /* The curriculum is allowed to plan a day for a piece that is not
               written yet — that is what the path is for. What it must not do is
               link to it, because a placeholder has no page. */
            const written = card?.state === "published";
            return (
              <li
                key={d.day}
                className="grid grid-cols-[3rem_1fr_auto] items-baseline gap-4 py-5"
              >
                <span className="text-xs text-muted">
                  Day {String(d.day).padStart(2, "0")}
                </span>
                <span>
                  {written ? (
                    <Link
                      href={`/learn/${d.track}/${d.piece}`}
                      className={`font-serif text-xl underline-offset-4 hover:underline ${
                        isDone ? "text-muted" : ""
                      }`}
                    >
                      {d.title}
                    </Link>
                  ) : (
                    <span className="font-serif text-xl text-muted">{d.title}</span>
                  )}
                  {written && card?.access === "free" && (
                    <span className="ml-3 pill text-xs">Open</span>
                  )}
                  {!written && <span className="ml-3 pill text-xs">Coming</span>}
                  <span className="mt-2 block text-sm text-muted leading-relaxed">
                    {d.todo}
                  </span>
                </span>
                {written ? (
                  <button
                    type="button"
                    onClick={() => toggle(d.piece)}
                    aria-pressed={isDone}
                    className={`rounded-full px-3 py-1 text-xs transition-colors whitespace-nowrap ${
                      isDone ? "bg-foreground text-background" : `card ${accentHover(d.piece)}`
                    }`}
                  >
                    {isDone ? "Done" : `${d.minutes} min`}
                  </button>
                ) : (
                  <span className="text-xs text-muted whitespace-nowrap">
                    {d.minutes} min
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-8 text-sm">
          <Link href="/learn/updates" className="underline underline-offset-4">
            What&apos;s been added lately →
          </Link>
        </p>
      </section>

      {!hidden.has("learningPaths") && (
        <section
          {...studioSection("learningPaths", "Learning paths")}
          className="px-5 md:px-6 py-16"
        >
          <SectionHeading
            label="Still on Notion"
            title={
              <>
                The club&apos;s older paths, <em>until they move in here</em>.
              </>
            }
          />
          <p className="mt-6 max-w-md text-sm text-muted leading-relaxed">
            These were written before the library existed and have not been
            rebuilt yet. They open in Notion, and they are free.
          </p>
          <div className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {learningPaths.map((p) => (
              <a
                key={p.name}
                href={p.href}
                target="_blank"
                rel="noreferrer"
                className={`group card card-lift p-8 ${accentHover(p.name)}`}
              >
                <p className="text-xs text-muted accent-hover-sub pill inline-block">
                  {p.tag}
                </p>
                <h3 className="mt-4 font-serif text-2xl group-hover:underline underline-offset-4">
                  {p.name}
                </h3>
                <p className="mt-4 text-sm text-muted accent-hover-sub leading-relaxed">
                  {p.blurb}
                </p>
              </a>
            ))}
          </div>
        </section>
      )}

      {!hidden.has("practiceFiles") && (
        <section
          {...studioSection("practiceFiles", "Practice Files")}
          className="px-5 md:px-6 py-24 md:py-32"
        >
          <SectionHeading
            label="the Practice File"
            title={
              <>
                Six fundamentals, <em>six exercises</em>.
              </>
            }
          />
          <p className="mt-6 max-w-md text-sm text-muted leading-relaxed">
            The club&apos;s creative gym: one bounded exercise per file, built
            around a single fundamental. Pick one, give it a week, finish it.
          </p>
          <ul className="mt-12 card row-divide px-6">
            {practiceFiles.map((f) => (
              <li
                key={f.number}
                className="grid grid-cols-[4.5rem_1fr_auto] items-baseline gap-4 py-4"
              >
                <span className="text-xs text-muted">{f.number}</span>
                <span className="font-serif text-xl">{f.name}</span>
                <span className="text-sm text-muted">{f.note}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-muted">
            Published as{" "}
            <a
              href={site.substack}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              the Practice File on Substack
            </a>
            .
          </p>
        </section>
      )}

      {!hidden.has("learnNote") && learn?.note && (
        <section
          {...studioSection("learnNote", "Learn: how it's kept")}
          className="px-5 md:px-6 py-16"
        >
          <div className="card px-6 py-8 max-w-2xl">
            <p className="text-xs underline underline-offset-4">How it&apos;s kept</p>
            <p className="mt-4 text-sm text-muted leading-relaxed">{learn.note}</p>
          </div>
        </section>
      )}

      <Cta />
    </>
  );
}
