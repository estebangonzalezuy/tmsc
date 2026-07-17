"use client";

import { studioSection, useContent } from "@/components/content";
import { Boxed } from "@/components/Motifs";
import PostList from "@/components/PostList";
import Cta from "@/components/Cta";

export default function NewsletterPage() {
  const { site, stats, archive } = useContent();

  return (
    <>
      <section
        {...studioSection("stats", "Stats")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <p className="text-sm underline underline-offset-4">The newsletter</p>
        <h1 className="mt-8 font-serif text-4xl md:text-6xl leading-tight max-w-4xl">
          Every letter the club has sent, <em>since day one</em>.
        </h1>
        <p className="mt-8 max-w-md text-sm text-muted leading-relaxed">
          Essays, exercises, interviews, and honest check-ins — published on
          Substack, free to read. This is the full archive.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a href={site.subscribe} target="_blank" rel="noreferrer">
            <Boxed className="hover:bg-foreground hover:text-background transition-colors">
              Subscribe on Substack
            </Boxed>
          </a>
          <a
            href={site.substack}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline underline-offset-4 hover:text-muted transition-colors"
          >
            humanandmotion.substack.com
          </a>
        </div>
        <dl className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-px bg-line border border-line">
          {stats.map((s) => (
            <div key={s.label} className="bg-background p-6">
              <dt className="text-xs text-muted">{s.label}</dt>
              <dd className="mt-2 font-serif text-3xl">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {archive.map((y) => (
        <section
          key={y.year}
          {...studioSection("archive", "Newsletter archive")}
          className="border-t border-line px-5 md:px-6 py-16"
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
