import Link from "next/link";
import Prose from "@/components/learn/Prose";
import Cta from "@/components/Cta";
import type { Lesson, LessonCard } from "@/lib/fundamentals";

/* One fundamental. A server component, like a Learn piece: the article is
   text, and the only things that need the browser are the figures, each its
   own island inside Prose. No clock runner here — every figure runs its own
   loop, and only while it is on screen (see figures/useLoop.ts). */

export default function FundamentalPage({
  lesson,
  label,
  prev,
  next,
}: {
  lesson: Lesson;
  /** The section's name, from content/site.json. */
  label: string;
  prev: LessonCard | null;
  next: LessonCard | null;
}) {
  return (
    <>
      <article className="px-5 md:px-6 py-24 md:py-32">
        <p className="text-sm">
          <Link href="/fundamentals" className="underline underline-offset-4">
            {label}
          </Link>
          <span className="text-muted"> / </span>
          <span>{lesson.title}</span>
        </p>

        <div className="mt-10 max-w-3xl">
          <h1 className="font-serif text-4xl md:text-6xl leading-tight">{lesson.title}</h1>
          <p className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="pill">{lesson.minutes} min</span>
            <span className="pill">
              {lesson.figures} {lesson.figures === 1 ? "figure" : "figures"} to play with
            </span>
            <span className="pill">Free</span>
          </p>
          <p className="mt-8 max-w-xl text-sm text-muted leading-relaxed">{lesson.blurb}</p>
        </div>

        <div className="mt-16">
          <Prose blocks={lesson.blocks} />
        </div>

        {(prev || next) && (
          <div className="mt-24 max-w-2xl grid gap-6 sm:grid-cols-2">
            <div>
              {prev && (
                <>
                  <p className="text-xs text-muted">Before this</p>
                  <Link
                    href={`/fundamentals/${prev.slug}`}
                    className="mt-3 block font-serif text-2xl underline-offset-4 hover:underline"
                  >
                    ← {prev.title}
                  </Link>
                </>
              )}
            </div>
            <div className="sm:text-right">
              {next && (
                <>
                  <p className="text-xs text-muted">Next</p>
                  <Link
                    href={`/fundamentals/${next.slug}`}
                    className="mt-3 block font-serif text-2xl underline-offset-4 hover:underline"
                  >
                    {next.title} →
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </article>

      <Cta />
    </>
  );
}
