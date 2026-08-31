import Link from "next/link";
import type { Block, Span } from "@/lib/learn";
import { learnAsset } from "@/lib/learn";
import SpecBlock from "./SpecBlock";
import VideoBlock from "./VideoBlock";
import AudioBlock from "./AudioBlock";

/* A piece's body, drawn from the blocks the build script wrote. This is a
   server component on purpose: a plain article is text, and text does not need
   to ship a runtime. Only the three blocks that genuinely need the browser —
   a running spec, a video, an audio player — are client islands below. */

function Spans({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((s, i) => {
        if (s.t === "em") return <em key={i}>{s.v}</em>;
        if (s.t === "strong") return <strong key={i} className="font-medium">{s.v}</strong>;
        if (s.t === "code")
          return (
            <code key={i} className="pill text-[0.85em]">
              {s.v}
            </code>
          );
        if (s.t === "a") {
          const external = /^https?:/.test(s.href);
          return external ? (
            <a
              key={i}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              {s.v}
            </a>
          ) : (
            <Link key={i} href={s.href} className="underline underline-offset-4">
              {s.v}
            </Link>
          );
        }
        return <span key={i}>{s.v}</span>;
      })}
    </>
  );
}

export default function Prose({ blocks }: { blocks: Block[] }) {
  return (
    <div className="max-w-2xl">
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h":
            return b.level === 2 ? (
              <h2 key={i} className="mt-16 font-serif text-2xl md:text-3xl leading-snug">
                <Spans spans={b.text} />
              </h2>
            ) : (
              <h3 key={i} className="mt-12 font-serif text-xl leading-snug">
                <Spans spans={b.text} />
              </h3>
            );

          case "p":
            return (
              <p key={i} className="mt-6 leading-relaxed">
                <Spans spans={b.text} />
              </p>
            );

          case "ul":
            return (
              <ul key={i} className="mt-6 space-y-3">
                {b.items.map((item, j) => (
                  <li key={j} className="grid grid-cols-[1.25rem_1fr] gap-2 leading-relaxed">
                    <span className="text-muted" aria-hidden>
                      —
                    </span>
                    <span>
                      <Spans spans={item} />
                    </span>
                  </li>
                ))}
              </ul>
            );

          case "ol":
            return (
              <ol key={i} className="mt-6 space-y-3">
                {b.items.map((item, j) => (
                  <li key={j} className="grid grid-cols-[1.75rem_1fr] gap-2 leading-relaxed">
                    <span className="text-xs text-muted pt-1">
                      {String(j + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <Spans spans={item} />
                    </span>
                  </li>
                ))}
              </ol>
            );

          case "quote":
            return (
              <blockquote key={i} className="mt-12 font-serif italic text-2xl leading-snug">
                <Spans spans={b.text} />
              </blockquote>
            );

          case "hr":
            return <hr key={i} className="mt-12 border-line" />;

          case "img":
            return (
              <figure key={i} className="mt-12">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={learnAsset(b.src)}
                  alt={b.alt}
                  className="w-full rounded-[var(--radius)]"
                />
                {b.caption && (
                  <figcaption className="mt-3 text-xs text-muted">{b.caption}</figcaption>
                )}
              </figure>
            );

          /* An aside. It gets its own ground inside the column rather than a
             rule down its side, because nothing here is drawn. */
          case "note":
            return (
              <aside key={i} className="mt-10 inset px-6 py-5 text-sm leading-relaxed text-muted">
                <Spans spans={b.text} />
              </aside>
            );

          /* The thing to go and do. The whole library exists to get somebody to
             one of these, so it is the loudest block on the page. */
          case "do":
            return (
              <section key={i} className="mt-12 card px-6 py-6">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-xs underline underline-offset-4">Go and do this</p>
                  {b.minutes && <p className="text-xs text-muted">{b.minutes} min</p>}
                </div>
                <p className="mt-4 leading-relaxed">
                  <Spans spans={b.text} />
                </p>
              </section>
            );

          case "video":
            return <VideoBlock key={i} provider={b.provider} id={b.id} caption={b.caption} />;

          case "audio":
            return <AudioBlock key={i} src={learnAsset(b.src)} seconds={b.seconds} />;

          case "spec":
            return <SpecBlock key={i} studio={b.studio} spec={b.spec} caption={b.caption} />;

          default:
            return null;
        }
      })}
    </div>
  );
}
