"use client";

import { studioSection, useContent } from "@/components/content";
import { Boxed, SectionHeading } from "@/components/Motifs";
import Cta from "@/components/Cta";

export default function AboutPage() {
  const { site, pillars, threads, quotes } = useContent();

  return (
    <>
      <section
        {...studioSection("site", "Site & links")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <p className="text-sm underline underline-offset-4">About the club</p>
        <h1 className="mt-8 font-serif text-4xl md:text-6xl leading-tight max-w-4xl">
          A club for the <em>psychological and creative</em> sides of motion
          design.
        </h1>
        <div className="mt-12 grid gap-10 md:grid-cols-2 text-sm leading-relaxed">
          <p>
            {site.positioning} Founded by Esteban González, a self-taught
            motion designer from Montevideo, the club started as an excuse to
            share as many resources as possible — posts, newsletter issues,
            worksheets, exercises — and grew into a place for the conversations
            that are harder to find: feedback, doubt, and growth beyond the
            technical.
          </p>
          <p className="text-muted">
            The club emphasizes that motion design is not just for &ldquo;rock
            stars&rdquo; or top artists, but a profession with diverse paths to
            success. Its aim is simple: create a space where motion designers
            can challenge themselves and grow, professionally and personally —
            posing questions rather than selling answers.
          </p>
        </div>
      </section>

      <section className="border-t border-line px-5 md:px-6 py-20 text-center">
        <Boxed className="font-serif text-2xl md:text-4xl leading-snug max-w-2xl">
          A place to question ourselves
        </Boxed>
      </section>

      <section
        {...studioSection("pillars", "Pillars")}
        className="border-t border-line px-5 md:px-6 py-24 md:py-32"
      >
        <SectionHeading
          label="The editorial spine"
          title={
            <>
              Everything the club publishes connects to <em>one of three
              layers</em>.
            </>
          }
        />
        <div className="mt-12 grid gap-px bg-line border border-line md:grid-cols-3">
          {pillars.map((p) => (
            <article key={p.number} className="bg-background p-8">
              <p className="text-xs text-muted">{p.number}</p>
              <h2 className="mt-4 font-serif text-2xl">{p.name}</h2>
              <p className="mt-4 text-sm text-muted leading-relaxed">
                {p.text}
              </p>
            </article>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted max-w-md leading-relaxed">
          Before publishing anything, one question: <em>am I publishing because
          there&apos;s something real to say, or because it&apos;s time to
          post?</em>
        </p>
      </section>

      <section
        {...studioSection("threads", "Recurring threads")}
        className="border-t border-line px-5 md:px-6 py-24 md:py-32"
      >
        <SectionHeading
          label="Recurring threads"
          title={
            <>
              The ideas that come back, <em>letter after letter</em>.
            </>
          }
        />
        <ul className="mt-12 divide-y divide-line/30 border-y border-line/30">
          {threads.map((t, i) => (
            <li
              key={t.name}
              className="grid gap-2 py-6 md:grid-cols-[4.5rem_16rem_1fr] md:gap-6"
            >
              <span className="text-xs text-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="font-serif text-xl">{t.name}</h2>
              <p className="text-sm text-muted leading-relaxed max-w-xl">
                {t.text}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        {...studioSection("quotes", "Quotes")}
        className="border-t border-line px-5 md:px-6 py-20 text-center"
      >
        <p className="font-serif italic text-3xl md:text-5xl leading-tight max-w-3xl mx-auto">
          &ldquo;{quotes[1] ?? quotes[0]}&rdquo;
        </p>
      </section>

      <Cta />
    </>
  );
}
