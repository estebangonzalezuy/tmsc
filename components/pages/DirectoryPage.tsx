"use client";

import Link from "next/link";
import { hiddenSet, studioSection, useContent } from "@/components/content";
import { CircleLetter, SectionHeading } from "@/components/Motifs";
import Cta from "@/components/Cta";
import manifest from "@/content/directory/manifest.json";

// The hub reads the generated manifest rather than lib/directory, so the
// client bundle carries a couple of kilobytes of counts instead of every
// entry in every collection. The collection pages load their own data.

const shelves = manifest.shelves;
const collections = manifest.collections;

export default function DirectoryPage() {
  const content = useContent();
  const { site } = content;
  const hidden = hiddenSet(content);
  const directory = (content as { directory?: { label: string; intro: string; note: string } }).directory;

  return (
    <>
      <section
        {...studioSection("directory", "the Directory")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <p className="text-sm underline underline-offset-4 decoration-2 decoration-accent-warm">
          {directory?.label ?? "the Directory"}
        </p>
        <h1 className="mt-8 font-serif text-4xl md:text-6xl leading-tight max-w-4xl">
          It all already exists. The problem is that it&apos;s{" "}
          <em>scattered</em>.
        </h1>
        <p className="mt-8 max-w-md text-sm text-muted leading-relaxed">
          {directory?.intro ??
            "Every answer to every beginner question is online already, spread across a thousand tabs nobody keeps. The Directory is the club's attempt to hold it in one place: organised, filterable, and honest about where each entry came from."}
        </p>
      </section>

      <section className="border-t border-line grid grid-cols-2 md:grid-cols-4 gap-px bg-line">
        {[
          { value: String(manifest.total), label: "entries indexed" },
          { value: String(collections.length), label: "collections" },
          { value: "5", label: "shelves" },
          { value: "0", label: "opinions offered" },
        ].map((s) => (
          <div key={s.label} className="bg-background px-5 md:px-6 py-10">
            <p className="font-serif text-3xl md:text-4xl">{s.value}</p>
            <p className="mt-2 text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </section>

      {shelves.map((shelf) => {
        const shelved = collections.filter((c) => c.shelf === shelf.id);
        if (!shelved.length) return null;
        return (
          <section
            key={shelf.id}
            className="border-t border-line px-5 md:px-6 py-20 md:py-24"
          >
            <SectionHeading label={shelf.name} title={<em>{shelf.note}</em>} />
            <div className="mt-12 grid gap-px bg-line border border-line md:grid-cols-2">
              {shelved.map((c) => (
                <Link
                  key={c.id}
                  href={`/directory/${c.id}`}
                  className="group bg-background p-8 hover:bg-accent hover:text-background transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <CircleLetter>{c.letter}</CircleLetter>
                    <span className="text-xs text-muted group-hover:text-background/70">
                      {c.count} entries
                    </span>
                  </div>
                  <h3 className="mt-6 font-serif text-2xl group-hover:underline underline-offset-4">
                    {c.name}
                  </h3>
                  <p className="mt-4 text-sm text-muted group-hover:text-background/70 leading-relaxed">
                    {c.blurb}
                  </p>
                  {c.facets.length > 0 && (
                    <p className="mt-6 text-xs text-muted group-hover:text-background/70">
                      Filter by {c.facets.join(", ").toLowerCase()}
                    </p>
                  )}
                </Link>
              ))}
              {/* The gap-px grid shows the line colour through any cell the
                  shelf doesn't fill, so an odd count needs a blank one. */}
              {shelved.length % 2 === 1 && (
                <div className="hidden md:block bg-background" aria-hidden />
              )}
            </div>
          </section>
        );
      })}

      {!hidden.has("directoryNote") && (
        <section
          {...studioSection("directoryNote", "Directory: how it's kept")}
          className="border-t border-line px-5 md:px-6 py-20 md:py-24"
        >
          <SectionHeading
            label="How it's kept"
            title={
              <>
                A directory is only as good as its <em>last check</em>.
              </>
            }
          />
          <p className="mt-6 max-w-xl text-sm text-muted leading-relaxed">
            {directory?.note ??
              "The Directory is generated from plain text files, not typed into a page. Entries exported from the club's own databases are marked as such; entries seeded from experience are marked too, so you know which ones have been checked and which are still on trust."}
          </p>
          <p className="mt-8 text-sm">
            Found a dead link, or something that should be here and
            isn&apos;t?{" "}
            <a
              href={`mailto:${site.email}?subject=the%20Directory`}
              className="underline underline-offset-4"
            >
              Tell us
            </a>
            . This only stays true by being corrected.
          </p>
        </section>
      )}

      <Cta />
    </>
  );
}
