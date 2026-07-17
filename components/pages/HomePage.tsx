"use client";

import Link from "next/link";
import { studioSection, useContent } from "@/components/content";
import {
  Boxed,
  LetterMarquee,
  OrbitRing,
  SectionHeading,
} from "@/components/Motifs";
import PostList from "@/components/PostList";
import Cta from "@/components/Cta";

export default function HomePage() {
  const {
    site,
    stats,
    pillars,
    practiceFiles,
    learningPaths,
    resources,
    offerings,
    archive,
    quotes,
  } = useContent();
  const latestPosts = archive.flatMap((y) => y.posts).slice(0, 5);

  return (
    <>
      {/* Hero */}
      <section
        {...studioSection("site", "Site & links")}
        className="relative overflow-hidden px-5 md:px-6 py-24 md:py-36 text-center"
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <OrbitRing
            letters={["M", "O", "T", "I", "O", "N"]}
            size={560}
            duration="80s"
            className="hidden md:block"
          />
          <OrbitRing
            letters={["H", "U", "M", "A", "N", "S", "O", "C", "I", "A", "L"]}
            size={860}
            duration="120s"
            className="hidden md:block"
          />
        </div>
        <div className="relative">
          <p className="text-sm underline underline-offset-4">{site.name}</p>
          <h1 className="mt-8 font-serif text-4xl md:text-7xl leading-tight max-w-4xl mx-auto">
            But the brain wasn&apos;t built to create <em>in a vacuum</em> for
            years on end.
          </h1>
          <p className="mt-8 max-w-md mx-auto text-sm leading-relaxed">
            <strong>The side companion on your motion design path.</strong>{" "}
            <span className="text-muted">
              A place to connect with other people, to practice, and to embrace
              failure.
            </span>
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <a href={site.subscribe} target="_blank" rel="noreferrer">
              <Boxed className="hover:bg-foreground hover:text-background transition-colors">
                Join the newsletter
              </Boxed>
            </a>
            <Link
              href="/about"
              className="text-sm underline underline-offset-4 hover:text-muted transition-colors"
            >
              What is the club?
            </Link>
          </div>
        </div>
      </section>

      <LetterMarquee text={`${site.name.toUpperCase()} `} />

      {/* What the club is */}
      <section
        {...studioSection("stats", "Stats")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <SectionHeading
          label="The club"
          title={
            <>
              Resources and conversations that go{" "}
              <em>beyond the technical</em> side of motion design.
            </>
          }
        />
        <div className="mt-10 grid gap-10 md:grid-cols-2">
          <p className="text-sm leading-relaxed text-muted max-w-md">
            {site.positioning} Motion design is not just for
            &ldquo;rock stars&rdquo; — it is a profession with diverse paths to
            success, and the club exists to make those paths less lonely:
            fundamentals over tools, practice over tutorials, people over
            algorithms.
          </p>
          <dl className="grid grid-cols-2 gap-px bg-line border border-line">
            {stats.map((s) => (
              <div key={s.label} className="bg-background p-6">
                <dt className="text-xs text-muted">{s.label}</dt>
                <dd className="mt-2 font-serif text-3xl">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Pillars */}
      <section
        {...studioSection("pillars", "Pillars")}
        className="border-t border-line px-5 md:px-6 py-24 md:py-32"
      >
        <SectionHeading
          label="How we look at the work"
          title={
            <>
              Three layers: <em>structure</em>, <em>criticism</em>, and{" "}
              <em>honesty</em>.
            </>
          }
        />
        <div className="mt-12 grid gap-px bg-line border border-line md:grid-cols-3">
          {pillars.map((p) => (
            <article key={p.number} className="bg-background p-8">
              <p className="text-xs text-muted">{p.number}</p>
              <h3 className="mt-4 font-serif text-2xl">{p.name}</h3>
              <p className="mt-4 text-sm text-muted leading-relaxed">
                {p.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Quote band */}
      <section
        {...studioSection("quotes", "Quotes")}
        className="border-t border-line px-5 md:px-6 py-20 text-center"
      >
        <p className="font-serif italic text-3xl md:text-5xl leading-tight max-w-3xl mx-auto">
          &ldquo;{quotes[0]}&rdquo;
        </p>
      </section>

      {/* Newsletter */}
      <section
        {...studioSection("archive", "Newsletter archive")}
        className="border-t border-line px-5 md:px-6 py-24 md:py-32"
      >
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            label="The newsletter"
            title={
              <>
                One honest letter, <em>twice a month</em>.
              </>
            }
          />
          <Link
            href="/newsletter"
            className="text-sm underline underline-offset-4 hover:text-muted transition-colors"
          >
            Browse the full archive →
          </Link>
        </div>
        <div className="mt-12">
          <PostList posts={latestPosts} />
        </div>
      </section>

      {/* Practice File */}
      <section
        {...studioSection("practiceFiles", "Practice Files")}
        className="border-t border-line px-5 md:px-6 py-24 md:py-32"
      >
        <SectionHeading
          label="the Practice File"
          title={
            <>
              Your creative gym: <em>one exercise</em>, one constraint, one
              week.
            </>
          }
        />
        <p className="mt-6 max-w-md text-sm text-muted leading-relaxed">
          Six fundamentals, six files. Short, bounded exercises made to be
          finished — because the work no one sees is the work that shapes your
          skill.
        </p>
        <div className="mt-12 grid gap-px bg-line border border-line sm:grid-cols-2 md:grid-cols-3">
          {practiceFiles.map((f) => (
            <article key={f.number} className="bg-background p-8">
              <p className="text-xs text-muted">{f.number}</p>
              <h3 className="mt-3 font-serif text-2xl">{f.name}</h3>
              <p className="mt-2 text-sm text-muted">{f.note}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Learn + Resources preview */}
      <section className="border-t border-line grid md:grid-cols-2">
        <div
          {...studioSection("learningPaths", "Learning paths")}
          className="px-5 md:px-6 py-24 md:border-r border-line"
        >
          <SectionHeading
            label="Learn"
            title={
              <>
                Paths to <em>start in motion</em>, fundamentals first.
              </>
            }
          />
          <ul className="mt-10 space-y-4 text-sm">
            {learningPaths.slice(0, 4).map((p) => (
              <li key={p.name}>
                <a
                  href={p.href}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-muted transition-colors"
                >
                  {p.name}
                </a>
              </li>
            ))}
          </ul>
          <Link
            href="/learn"
            className="mt-8 inline-block text-sm underline underline-offset-4 hover:text-muted transition-colors"
          >
            All learning paths →
          </Link>
        </div>
        <div
          {...studioSection("resources", "Resources")}
          className="px-5 md:px-6 py-24 border-t md:border-t-0 border-line"
        >
          <SectionHeading
            label="Resources"
            title={
              <>
                Curated, so you can spend the time <em>practicing</em>.
              </>
            }
          />
          <ul className="mt-10 space-y-4 text-sm">
            {resources.map((r) => (
              <li key={r.name}>
                <a
                  href={r.href}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-muted transition-colors"
                >
                  {r.name}
                </a>
              </li>
            ))}
          </ul>
          <Link
            href="/resources"
            className="mt-8 inline-block text-sm underline underline-offset-4 hover:text-muted transition-colors"
          >
            All resources →
          </Link>
        </div>
      </section>

      {/* Offerings */}
      <section
        {...studioSection("offerings", "Offerings")}
        className="border-t border-line px-5 md:px-6 py-24 md:py-32"
      >
        <SectionHeading
          label="Offerings"
          title={
            <>
              Ways to practice <em>with the club</em>.
            </>
          }
        />
        <div className="mt-12 grid gap-px bg-line border border-line sm:grid-cols-2 lg:grid-cols-4">
          {offerings.map((o) => (
            <article key={o.name} className="bg-background p-8 flex flex-col">
              <p className="text-xs text-muted border border-line/40 rounded-full self-start px-2.5 py-0.5">
                {o.status}
              </p>
              <h3 className="mt-4 font-serif text-2xl">{o.name}</h3>
              {o.price && <p className="mt-1 text-sm">{o.price}</p>}
              <p className="mt-4 text-sm text-muted leading-relaxed flex-1">
                {o.blurb}
              </p>
              <a
                href={o.href}
                target="_blank"
                rel="noreferrer"
                className="mt-6 text-sm underline underline-offset-4 hover:text-muted transition-colors"
              >
                {o.cta} →
              </a>
            </article>
          ))}
        </div>
      </section>

      {/* Human + Motion band */}
      <section
        {...studioSection("site", "Site & links")}
        className="relative overflow-hidden border-t border-line px-5 md:px-6 py-32 text-center"
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <OrbitRing
            letters={["H", "U", "M", "A", "N", "M", "O", "T", "I", "O", "N"]}
            size={640}
            duration="100s"
          />
        </div>
        <p className="relative inline-block bg-background px-4 font-serif text-4xl md:text-6xl">
          Human + Motion
        </p>
        <p className="relative mt-6 text-sm text-muted max-w-sm mx-auto leading-relaxed">
          Tools are exhausting. Foundations are permanent. The human criteria
          behind the keyframes is the one thing worth training.
        </p>
      </section>

      <Cta />
    </>
  );
}
