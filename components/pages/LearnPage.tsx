"use client";

import { hiddenSet, studioSection, useContent } from "@/components/content";
import { SectionHeading } from "@/components/Motifs";
import Cta from "@/components/Cta";

export default function LearnPage() {
  const content = useContent();
  const { site, learningPaths, practiceFiles } = content;
  const hidden = hiddenSet(content);

  return (
    <>
      <section
        {...studioSection("learningPaths", "Learning paths")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <p className="text-sm underline underline-offset-4">Learn</p>
        <h1 className="mt-8 font-serif text-4xl md:text-6xl leading-tight max-w-4xl">
          Start in motion <em>from the base</em> — fundamentals first, tools
          second.
        </h1>
        <p className="mt-8 max-w-md text-sm text-muted leading-relaxed">
          You don&apos;t need more tutorials. You need a path, a constraint,
          and a reason to finish. These are the club&apos;s routes in.
        </p>
      </section>

      {!hidden.has("learningPaths") && (
      <section
        {...studioSection("learningPaths", "Learning paths")}
        className="border-t border-line px-5 md:px-6 py-24"
      >
        <div className="grid gap-px bg-line border border-line md:grid-cols-2">
          {learningPaths.map((p) => (
            <a
              key={p.name}
              href={p.href}
              target="_blank"
              rel="noreferrer"
              className="group bg-background p-8 hover:bg-foreground hover:text-background transition-colors"
            >
              <p className="text-xs text-muted group-hover:text-background/70 border border-line/40 rounded-full inline-block px-2.5 py-0.5">
                {p.tag}
              </p>
              <h2 className="mt-4 font-serif text-2xl group-hover:underline underline-offset-4">
                {p.name}
              </h2>
              <p className="mt-4 text-sm text-muted group-hover:text-background/70 leading-relaxed">
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
        className="border-t border-line px-5 md:px-6 py-24 md:py-32"
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
        <ul className="mt-12 divide-y divide-line/30 border-y border-line/30">
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

      <Cta />
    </>
  );
}
