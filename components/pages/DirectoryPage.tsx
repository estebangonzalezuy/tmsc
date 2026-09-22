"use client";

import Link from "next/link";
import { hiddenSet, studioSection, useContent } from "@/components/content";
import {
  CircleLetter,
  Label,
  PageHeader,
  SectionHeading,
} from "@/components/Motifs";
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
      <PageHeader
        label={`${directory?.label ?? "the Directory"} · ${manifest.total} entries · ${collections.length} collections`}
        title={
          <>
            It all already exists. The problem is that it&apos;s{" "}
            <em>scattered</em>.
          </>
        }
        intro={
          directory?.intro ??
          "Every answer to every beginner question is online already, spread across a thousand tabs nobody keeps. The Directory is the club's attempt to hold it in one place: organised, filterable, and honest about where each entry came from."
        }
      />
      <div {...studioSection("directory", "the Directory")} />

      {/* A shelf is a heading and its collections as rows. The cards this used
          to be were four to a screen and told you less: a row fits the letter,
          the name, what is in it, how much of it there is and where it came
          from on one line, which is what you are actually comparing. */}
      {shelves.map((shelf) => {
        const shelved = collections.filter((c) => c.shelf === shelf.id);
        if (!shelved.length) return null;
        return (
          <section key={shelf.id} className="px-5 md:px-6 pb-14">
            <div className="grid gap-x-6 gap-y-1 pb-4 md:grid-cols-[6rem_1fr]">
              <Label>Shelf</Label>
              <div>
                <h2 className="font-serif text-[1.4rem] leading-tight tracking-tight">
                  {shelf.name}
                </h2>
                <p className="mt-1 text-sm text-muted">{shelf.note}</p>
              </div>
            </div>
            <div className="row-divide border-t border-line">
              {shelved.map((c) => (
                <Link
                  key={c.id}
                  href={`/directory/${c.id}`}
                  className="group grid grid-cols-[2rem_1fr_auto] items-center gap-x-5 gap-y-1.5 py-4 md:grid-cols-[6rem_1.1fr_1.9fr_auto_5.5rem]"
                >
                  <CircleLetter size="size-[30px] text-[13px]">
                    {c.letter}
                  </CircleLetter>
                  <h3 className="font-serif text-xl leading-tight tracking-tight group-hover:underline underline-offset-4 decoration-1">
                    {c.name}
                  </h3>
                  <p className="col-span-2 text-sm leading-snug text-muted md:col-span-1 md:col-start-3">
                    {c.blurb}
                  </p>
                  <span className="label col-start-3 row-start-1 justify-self-end md:col-start-4 md:row-start-auto">
                    {c.count} entries
                  </span>
                  <span
                    className={`pill hidden justify-self-end md:inline-block ${
                      c.source === "notion" ? "pill-notion" : ""
                    }`}
                  >
                    {c.source}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      {!hidden.has("directoryNote") && (
        <section
          {...studioSection("directoryNote", "Directory: how it's kept")}
          className="px-5 md:px-6 py-16 md:py-20"
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
              className="underline underline-offset-4 accent-hover-text"
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
