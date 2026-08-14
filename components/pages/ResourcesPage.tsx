"use client";

import { hiddenSet, studioSection, useContent } from "@/components/content";
import { CircleLetter, SectionHeading, accentHover } from "@/components/Motifs";
import Cta from "@/components/Cta";

export default function ResourcesPage() {
  const content = useContent();
  const { site, resources, worksheets, quotes } = content;
  const hidden = hiddenSet(content);

  return (
    <>
      <section
        {...studioSection("resources", "Resources")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <p className="text-sm underline underline-offset-4">Resources</p>
        <h1 className="mt-8 font-serif text-4xl md:text-6xl leading-tight max-w-4xl">
          Everything curated, so you can spend the time <em>practicing</em>.
        </h1>
        <p className="mt-8 max-w-md text-sm text-muted leading-relaxed">
          The club exists because good resources were hard to find. These are
          the ones worth your attention: collected, organized, and kept alive.
        </p>
      </section>

      {!hidden.has("resources") && (
      <section
        {...studioSection("resources", "Resources")}
        className="px-5 md:px-6 grid gap-3 md:grid-cols-3"
      >
        {resources.map((r, i) => (
          <a
            key={r.name}
            href={r.href}
            target="_blank"
            rel="noreferrer"
            className={`group card card-lift px-8 py-14 ${accentHover(r.name)}`}
          >
            <CircleLetter>{String(i + 1)}</CircleLetter>
            <h2 className="mt-6 font-serif text-2xl group-hover:underline underline-offset-4">
              {r.name}
            </h2>
            <p className="mt-4 text-sm text-muted accent-hover-sub leading-relaxed">
              {r.blurb}
            </p>
            <p className="mt-6 text-sm underline underline-offset-4">
              Open →
            </p>
          </a>
        ))}
      </section>
      )}

      {!hidden.has("worksheets") && (
      <section
        {...studioSection("worksheets", "Worksheets")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <SectionHeading
          label="Worksheets"
          title={
            <>
              Made to be <em>printed, filled, and finished</em>.
            </>
          }
        />
        <p className="mt-6 max-w-md text-sm text-muted leading-relaxed">
          Shared over the years with newsletter subscribers. Each one a small
          tool to think with, not another thing to watch.
        </p>
        <ul className="mt-12 grid gap-3 sm:grid-cols-2">
          {worksheets.map((w) => (
            <li key={w.name}>
              <a
                href={w.href || site.substack}
                target="_blank"
                rel="noreferrer"
                className={`group flex items-baseline gap-4 card card-lift p-6 ${accentHover(w.name)}`}
              >
                <span className="text-xs text-muted accent-hover-sub">→</span>
                <span className="text-sm group-hover:underline underline-offset-4">
                  {w.name}
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-muted">
          Worksheets are shared through the{" "}
          <a
            href={site.substack}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            newsletter
          </a>
          .
        </p>
      </section>
      )}

      {!hidden.has("quotes") && quotes.length > 0 && (
      <section
        {...studioSection("quotes", "Quotes")}
        className="px-5 md:px-6 py-20 text-center"
      >
        <p className="font-serif italic text-3xl md:text-5xl leading-tight max-w-3xl mx-auto">
          {quotes[2] ?? quotes[0]}
        </p>
      </section>
      )}

      <Cta />
    </>
  );
}
