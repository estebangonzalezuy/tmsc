import Link from "next/link";
import Prose from "@/components/learn/Prose";
import Cover from "@/components/learn/Cover";
import LockedPanel from "@/components/learn/LockedPanel";
import ClockRunner from "@/components/learn/ClockRunner";
import Cta from "@/components/Cta";
import { type Day, type Piece, type PieceCard, type Track } from "@/lib/learn";

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
  const paid = piece.access === "paid";

  return (
    <>
      {/* One clock for the page: the cover here, and any live example inside the
          article, all draw off it. */}
      <ClockRunner />

      {/* A reading column, centred. A piece is the one page on the site that
          is only text, so it gets the one measure that is only about reading:
          everything, the article and its furniture alike, sits in the same
          40-odd characters of line. */}
      <article className="mx-auto max-w-[44rem] px-5 md:px-6 pt-20 pb-16 md:pt-24">
        <p className="label">
          <Link href="/learn" className="accent-hover-text">
            Learn
          </Link>
          <span> / </span>
          <Link href={`/learn/${track.id}`} className="accent-hover-text">
            {track.name}
          </Link>
          {day && <span> / Day {day.day}</span>}
          <span> / {piece.minutes} min</span>
          <span> / {paid ? "In the library" : "Open to read"}</span>
        </p>

        <h1 className="mt-5 font-serif text-[2.5rem] md:text-[3.4rem] leading-[1.05] tracking-tight">
          {piece.title}
        </h1>

        <p className="mt-6 text-[1.05rem] leading-relaxed text-muted">
          {piece.blurb}
        </p>

        <Cover
          slug={piece.slug}
          title={piece.title}
          className="mt-10 !aspect-[16/7] rounded-[var(--radius)]"
        />

        <div className="mt-12">
          <Prose blocks={piece.blocks} />
        </div>

        {paid && <LockedPanel locked={piece.locked} />}

        {next && (
          <Link
            href={`/learn/${track.id}/${next.slug}`}
            className="card card-lift mt-20 flex items-center justify-between gap-6 px-7 py-6"
          >
            <span>
              <span className="label">Next in {track.name}</span>
              <span className="mt-1.5 block font-serif text-2xl leading-tight tracking-tight">
                {next.title}
              </span>
            </span>
            <span className="btn btn-ghost shrink-0">Continue →</span>
          </Link>
        )}
      </article>

      <Cta />
    </>
  );
}
