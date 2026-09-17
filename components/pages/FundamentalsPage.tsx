"use client";

import Link from "next/link";
import { studioSection, useContent } from "@/components/content";
import { CircleLetter, Emphasize } from "@/components/Motifs";
import { accentHover } from "@/lib/accent";
import Cta from "@/components/Cta";
import Cover from "@/components/learn/Cover";
import manifest from "@/content/fundamentals/manifest.json";
import type { LessonCard } from "@/lib/fundamentals";

/* The Fundamentals' front page: four cards, in the order they are taught.
   It imports the manifest directly rather than lib/fundamentals, because this
   is a client component and the manifest is cards with no bodies in it — the
   same split the Learn hub makes. */

const lessons = manifest.lessons as LessonCard[];
const { counts } = manifest;

const fallback = {
  label: "Fundamentals",
  headline: "Four things to *feel* before you learn a tool.",
  intro:
    "Grids, typography, composition and motion, one page each. Every page has figures you can play with, because these are things you learn with your hands.",
  note: "",
};

export default function FundamentalsPage() {
  const content = useContent();
  /* Older published copies of site.json predate the object. */
  const copy = (content as { fundamentals?: typeof fallback }).fundamentals ?? fallback;

  return (
    <>
      <section
        {...studioSection("fundamentals", "Fundamentals")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <p className="text-sm underline underline-offset-4">{copy.label}</p>
        <h1 className="mt-8 font-serif text-4xl md:text-6xl leading-tight max-w-4xl">
          <Emphasize text={copy.headline} />
        </h1>
        <p className="mt-8 max-w-md text-sm text-muted leading-relaxed">{copy.intro}</p>
        <p className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="pill">{counts.lessons} pages</span>
          <span className="pill">{counts.figures} figures to play with</span>
          <span className="pill">{counts.minutes} min in all</span>
          <span className="pill">Free</span>
        </p>
      </section>

      <section className="px-5 md:px-6 pb-16">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {lessons.map((l, i) => (
            <Link
              key={l.slug}
              href={`/fundamentals/${l.slug}`}
              className={`group card card-lift overflow-hidden ${accentHover(l.slug)}`}
            >
              <Cover slug={`fundamental-${l.slug}`} title={l.title} />
              <div className="p-6">
                {/* The card says the name; this keeps it as text for a screen
                    reader, for search, and for find-on-page. */}
                <h2 className="sr-only">{l.title}</h2>
                <div className="flex items-baseline justify-between gap-4">
                  <CircleLetter>{l.letter}</CircleLetter>
                  <span className="text-xs text-muted accent-hover-sub tabular-nums">
                    {String(i + 1).padStart(2, "0")} · {l.minutes} min
                  </span>
                </div>
                <p className="mt-5 text-sm text-muted accent-hover-sub leading-relaxed">{l.blurb}</p>
              </div>
            </Link>
          ))}
        </div>
        {copy.note && (
          <p className="mt-8 max-w-md text-xs text-muted leading-relaxed">{copy.note}</p>
        )}
      </section>

      <Cta />
    </>
  );
}
