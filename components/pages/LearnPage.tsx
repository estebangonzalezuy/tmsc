"use client";

import Link from "next/link";
import { hiddenSet, studioSection, useContent } from "@/components/content";
import { CircleLetter, SectionHeading, accentHover, Emphasize } from "@/components/Motifs";
import Cta from "@/components/Cta";
import { useProgress } from "@/components/learn/useProgress";
import manifest from "@/content/learn/manifest.json";

/* The hub. It imports the manifest directly rather than lib/learn, because this
   is a client component and the manifest is cards and counts with no piece
   bodies in it — the same split the Directory's hub makes with its own. */

const { tracks, path, counts } = manifest;

const fallback = {
  label: "Learn",
  headline: "Start in motion *today*, from the base.",
  intro:
    "You don't need more tutorials. You need an order to do things in, a constraint, and a reason to finish. Seven days that everyone walks, then a shelf you pick from.",
  note: "The club is writing this library one piece at a time. A piece marked as coming is a promise, not a page, and it says so rather than sitting behind a link that goes nowhere.",
};

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
        <p className="text-sm underline underline-offset-4">{learn?.label ?? fallback.label}</p>
        <h1 className="mt-8 font-serif text-4xl md:text-6xl leading-tight max-w-4xl">
          <Emphasize text={learn?.headline ?? fallback.headline} />
        </h1>
        <p className="mt-8 max-w-md text-sm text-muted leading-relaxed">
          {learn?.intro ?? fallback.intro}
        </p>
        <p className="mt-8 text-sm">
          <Link href="/practice" className="underline underline-offset-4">
            Only have half an hour? Let the club pick the exercise →
          </Link>
        </p>
      </section>

      {/* The on-ramp. Everyone walks this before picking a shelf. */}
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
            return (
              <li
                key={d.day}
                className="grid grid-cols-[3rem_1fr_auto] items-baseline gap-4 py-5"
              >
                <span className="text-xs text-muted">
                  Day {String(d.day).padStart(2, "0")}
                </span>
                <span>
                  <Link
                    href={`/learn/${d.track}/${d.piece}`}
                    className={`font-serif text-xl underline-offset-4 hover:underline ${
                      isDone ? "text-muted" : ""
                    }`}
                  >
                    {d.title}
                  </Link>
                  <span className="mt-2 block text-sm text-muted leading-relaxed">
                    {d.todo}
                  </span>
                </span>
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
              </li>
            );
          })}
        </ul>
      </section>

      {/* The shelves. */}
      <section className="px-5 md:px-6 py-16">
        <SectionHeading
          label="Then pick a track"
          title={
            <>
              Three shelves, <em>in the order they get useful</em>.
            </>
          }
        />
        <div className="mt-12 grid gap-3 md:grid-cols-3">
          {tracks.map((t) => (
            <Link
              key={t.id}
              href={`/learn/${t.id}`}
              className={`group card card-lift p-8 ${accentHover(t.id)}`}
            >
              <div className="flex items-baseline justify-between gap-4">
                <CircleLetter>{t.letter}</CircleLetter>
                <span className="text-xs text-muted accent-hover-sub">
                  {t.published} of {t.count}
                </span>
              </div>
              <h3 className="mt-6 font-serif text-2xl group-hover:underline underline-offset-4">
                {t.name}
              </h3>
              <p className="mt-4 text-sm text-muted accent-hover-sub leading-relaxed">
                {t.blurb}
              </p>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-xs text-muted">
          {counts.published} of {counts.total} pieces written so far, across{" "}
          {counts.tracks} tracks. The rest are named and not yet made.
        </p>
      </section>

      {/* Until the library is written, the club's paths still live on Notion.
          Saying so beats quietly linking out of a page that claims to be one. */}
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
            rebuilt yet. They open in Notion.
          </p>
          <div className="mt-12 grid gap-3 md:grid-cols-2">
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

      {!hidden.has("learnNote") && (
        <section
          {...studioSection("learnNote", "Learn: how it's kept")}
          className="px-5 md:px-6 py-16"
        >
          <div className="card px-6 py-8 max-w-2xl">
            <p className="text-xs underline underline-offset-4">How it&apos;s kept</p>
            <p className="mt-4 text-sm text-muted leading-relaxed">
              {learn?.note ?? fallback.note}
            </p>
          </div>
        </section>
      )}

      <Cta />
    </>
  );
}
