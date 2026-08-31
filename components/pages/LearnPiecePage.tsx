import Link from "next/link";
import Prose from "@/components/learn/Prose";
import Cta from "@/components/Cta";
import { KIND_LABEL, type Day, type Piece, type PieceCard, type Track } from "@/lib/learn";

export default function LearnPiecePage({
  piece,
  track,
  day,
  next,
}: {
  piece: Piece;
  track: Track;
  /** Set when this piece is a day of the on-ramp, so the reader knows where
      they are and what to go and do. */
  day: Day | null;
  next: PieceCard | null;
}) {
  return (
    <>
      <article className="px-5 md:px-6 py-24 md:py-32">
        <p className="text-sm">
          <Link href="/learn" className="underline underline-offset-4">
            Learn
          </Link>
          <span className="text-muted"> / </span>
          <Link href={`/learn/${track.id}`} className="underline underline-offset-4">
            {track.name}
          </Link>
        </p>

        <h1 className="mt-8 font-serif text-4xl md:text-6xl leading-tight max-w-3xl">
          {piece.title}
        </h1>

        <p className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="pill">{KIND_LABEL[piece.kind]}</span>
          <span className="pill">{piece.minutes} min</span>
          {day && <span className="pill">Day {day.day} of the path</span>}
        </p>

        <p className="mt-8 max-w-2xl text-sm text-muted leading-relaxed">{piece.blurb}</p>

        <div className="mt-16">
          <Prose blocks={piece.blocks} />
        </div>

        {next && (
          <div className="mt-24 max-w-2xl">
            <p className="text-xs text-muted">Next in {track.name}</p>
            <Link
              href={`/learn/${track.id}/${next.slug}`}
              className="mt-3 block font-serif text-2xl underline-offset-4 hover:underline"
            >
              {next.title} →
            </Link>
          </div>
        )}
      </article>

      <Cta />
    </>
  );
}
