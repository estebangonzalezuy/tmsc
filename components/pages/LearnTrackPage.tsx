import Link from "next/link";
import { CircleLetter } from "@/components/Motifs";
import { accentHover } from "@/lib/accent";
import Cta from "@/components/Cta";
import { KIND_LABEL, type PieceCard, type Track } from "@/lib/learn";

export default function LearnTrackPage({
  track,
  pieces,
}: {
  track: Track;
  pieces: PieceCard[];
}) {
  return (
    <>
      <section className="px-5 md:px-6 py-24 md:py-32">
        <p className="text-sm">
          <Link href="/learn" className="underline underline-offset-4">
            Learn
          </Link>
          <span className="text-muted"> / {track.name}</span>
        </p>
        <div className="mt-8 flex items-center gap-4">
          <CircleLetter>{track.letter}</CircleLetter>
          <h1 className="font-serif text-4xl md:text-6xl leading-tight">{track.name}</h1>
        </div>
        <p className="mt-8 max-w-md text-sm text-muted leading-relaxed">{track.blurb}</p>
        <p className="mt-6 text-xs text-muted">
          {track.count} pieces, {track.published} written so far. In order.
        </p>
      </section>

      <section className="px-5 md:px-6 pb-24">
        <ul className="card row-divide px-6">
          {pieces.map((p, i) => {
            const body = (
              <>
                <span className="text-xs text-muted accent-hover-sub">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="font-serif text-xl group-hover:underline underline-offset-4">
                    {p.title}
                  </span>
                  <span className="mt-2 block text-sm text-muted accent-hover-sub leading-relaxed">
                    {p.blurb}
                  </span>
                </span>
                <span className="text-xs text-muted accent-hover-sub whitespace-nowrap">
                  {p.state === "placeholder"
                    ? "Coming"
                    : `${KIND_LABEL[p.kind]} · ${p.minutes} min`}
                </span>
              </>
            );
            /* A placeholder is a promise, not a page. It renders as a row you
               can't click, rather than a link into an empty article. */
            return (
              <li key={p.slug}>
                {p.state === "placeholder" ? (
                  <div className="grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-4 py-6 opacity-60">
                    {body}
                  </div>
                ) : (
                  <Link
                    href={`/learn/${track.id}/${p.slug}`}
                    className={`group grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-4 py-6 transition-colors ${accentHover(p.slug)}`}
                  >
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <Cta />
    </>
  );
}
