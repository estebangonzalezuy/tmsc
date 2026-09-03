import Link from "next/link";
import { CircleLetter } from "@/components/Motifs";
import Cta from "@/components/Cta";
import PieceGrid from "@/components/learn/PieceGrid";
import OfferBlock from "@/components/learn/OfferBlock";
import type { PieceCard, Track } from "@/lib/learn";

export default function LearnTrackPage({
  track,
  pieces,
}: {
  track: Track;
  pieces: PieceCard[];
}) {
  const open = pieces.filter(
    (p) => p.state === "published" && p.access === "free",
  ).length;

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
          <h1 className="font-serif text-4xl md:text-6xl leading-tight">
            {track.name}
          </h1>
        </div>
        <p className="mt-8 max-w-md text-sm text-muted leading-relaxed">
          {track.blurb}
        </p>
        <p className="mt-6 text-xs text-muted">
          {track.count} pieces, {track.published} written so far
          {open > 0 && `, ${open} open to read`}. In order.
        </p>
      </section>

      {/* The order is the teaching, so the tiles are numbered. */}
      <section className="px-5 md:px-6 pb-16">
        <PieceGrid pieces={pieces} numbered />
      </section>

      <section className="px-5 md:px-6 pb-24">
        <OfferBlock compact />
      </section>

      <Cta />
    </>
  );
}
