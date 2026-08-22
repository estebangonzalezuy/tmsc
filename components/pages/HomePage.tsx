"use client";

import Link from "next/link";
import { hiddenSet, studioSection, useContent } from "@/components/content";
import {
  Boxed,
  LetterMarquee,
  OrbitRing,
  SectionHeading,
  Emphasize,
  accentHoverText,
} from "@/components/Motifs";
import PostList from "@/components/PostList";
import Cta from "@/components/Cta";

/* `*...*` is italic — see Emphasize. The line has to tell somebody who has
   never heard of the club what is here, so it names the three things the
   site actually holds rather than setting a mood. */
const FALLBACK_HEADLINE =
  "Resources, exercises and letters for designers learning *motion design*.";

export default function HomePage() {
  const content = useContent();
  const {
    site,
    stats,
    practiceFiles,
    learningPaths,
    offerings,
    archive,
    quotes,
  } = content;
  const hidden = hiddenSet(content);
  const latestPosts = archive.flatMap((y) => y.posts).slice(0, 5);
  const showLearn = !hidden.has("learningPaths");

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
            <Emphasize text={site.headline || FALLBACK_HEADLINE} />
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
              <Boxed className="accent-hover transition-colors">
                Join the newsletter
              </Boxed>
            </a>
            <Link
              href="/about"
              className="text-sm underline underline-offset-4 accent-hover-text transition-colors"
            >
              What is the club?
            </Link>
          </div>
        </div>
      </section>

      <LetterMarquee text={`${site.name.toUpperCase()} `} />

      {/* What the club is */}
      {!hidden.has("stats") && (
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
            &ldquo;rock stars&rdquo;. It is a profession with diverse paths to
            success, and the club exists to make those paths less lonely:
            fundamentals over tools, practice over tutorials, people over
            algorithms.
          </p>
          <dl className="grid grid-cols-2 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="card p-6">
                <dt className="text-xs text-muted">{s.label}</dt>
                <dd className="mt-2 font-serif text-3xl">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      )}

      {/* Quote band */}
      {!hidden.has("quotes") && quotes.length > 0 && (
      <section
        {...studioSection("quotes", "Quotes")}
        className="px-5 md:px-6 py-20 text-center"
      >
        <p className="font-serif italic text-3xl md:text-5xl leading-tight max-w-3xl mx-auto">
          {quotes[0]}
        </p>
      </section>
      )}

      {/* Newsletter */}
      {!hidden.has("archive") && (
      <section
        {...studioSection("archive", "Newsletter archive")}
        className="px-5 md:px-6 py-24 md:py-32"
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
            className="text-sm underline underline-offset-4 accent-hover-text transition-colors"
          >
            Browse the full archive →
          </Link>
        </div>
        <div className="mt-12">
          <PostList posts={latestPosts} />
        </div>
      </section>
      )}

      {/* Practice File */}
      {!hidden.has("practiceFiles") && (
      <section
        {...studioSection("practiceFiles", "Practice Files")}
        className="px-5 md:px-6 py-24 md:py-32"
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
          finished, because the work no one sees is the work that shapes your
          skill.
        </p>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {practiceFiles.map((f) => (
            <article key={f.number} className="card p-8">
              <p className="text-xs text-muted">{f.number}</p>
              <h3 className="mt-3 font-serif text-2xl">{f.name}</h3>
              <p className="mt-2 text-sm text-muted">{f.note}</p>
            </article>
          ))}
        </div>
      </section>
      )}

      {/* Learn preview. Resources used to sit beside it; the Directory
          covers that ground now, so Learn has the row to itself. */}
      {showLearn && (
      <section className="px-5 md:px-6 py-12">
        <div
          {...studioSection("learningPaths", "Learning paths")}
          className="card px-8 py-12"
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
                  className={`underline underline-offset-4 ${accentHoverText(p.name)} transition-colors`}
                >
                  {p.name}
                </a>
              </li>
            ))}
          </ul>
          <Link
            href="/learn"
            className="mt-8 inline-block text-sm underline underline-offset-4 accent-hover-text transition-colors"
          >
            All learning paths →
          </Link>
        </div>
      </section>
      )}

      {/* Offerings */}
      {!hidden.has("offerings") && (
      <section
        {...studioSection("offerings", "Offerings")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <SectionHeading
          label="Offerings"
          title={
            <>
              Ways to practice <em>with the club</em>.
            </>
          }
        />
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {offerings.map((o) => (
            <article key={o.name} className="card p-8 flex flex-col">
              <p className="text-xs text-muted pill self-start">
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
                className="mt-6 text-sm underline underline-offset-4 accent-hover-text transition-colors"
              >
                {o.cta} →
              </a>
            </article>
          ))}
        </div>
      </section>
      )}

      <Cta />
    </>
  );
}
