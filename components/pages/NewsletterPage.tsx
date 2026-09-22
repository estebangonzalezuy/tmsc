"use client";

import { hiddenSet, studioSection, useContent } from "@/components/content";
import { PageHeader } from "@/components/Motifs";
import PostList from "@/components/PostList";
import Cta from "@/components/Cta";

export default function NewsletterPage() {
  const content = useContent();
  const { site, stats, archive } = content;
  const hidden = hiddenSet(content);

  return (
    <>
      <PageHeader
        label="The newsletter"
        title={
          <>
            Every letter the club has sent, <em>since day one</em>.
          </>
        }
        intro="Essays, exercises, interviews, and honest check-ins, published on Substack, free to read. This is the full archive."
      />
      <section
        {...studioSection("stats", "Stats")}
        className="px-5 md:px-6 pb-16"
      >
        <div className="flex flex-wrap items-center gap-4">
          <a
            href={site.subscribe}
            target="_blank"
            rel="noreferrer"
            className="btn btn-lg btn-primary"
          >
            Subscribe on Substack
          </a>
          <a
            href={site.substack}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline underline-offset-4 accent-hover-text transition-colors"
          >
            humanandmotion.substack.com
          </a>
        </div>
        {!hidden.has("stats") && (
        <dl className="mt-12 grid grid-cols-2 border-y border-line md:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`py-7 ${i % 2 === 1 ? "border-l border-line pl-7" : ""} md:border-l md:pl-7 md:first:border-l-0 md:first:pl-0 ${i > 1 ? "border-t border-line md:border-t-0" : ""}`}
            >
              <dd className="font-serif text-[2.5rem] leading-none tracking-tight">
                {s.value}
              </dd>
              <dt className="label mt-2.5">{s.label}</dt>
            </div>
          ))}
        </dl>
        )}
      </section>

      {!hidden.has("archive") &&
        archive.map((y) => (
        <section
          key={y.year}
          {...studioSection("archive", "Newsletter archive")}
          className="px-5 md:px-6 py-16"
        >
          <h2 className="font-serif text-3xl md:text-5xl">{y.year}</h2>
          <div className="mt-8">
            <PostList posts={y.posts} />
          </div>
        </section>
        ))}

      <Cta />
    </>
  );
}
