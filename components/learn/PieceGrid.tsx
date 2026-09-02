"use client";

import Link from "next/link";
import { accentHover } from "@/lib/accent";
import Cover from "./Cover";
import type { PieceCard } from "@/lib/learn";

/* The library as a shelf. Three up, square title cards, real gaps.
   
   The card carries the title, the way a book cover does, so the body underneath
   holds only what the cover can't say: what kind of thing it is, how long it
   takes, and the one line about it.
   
   The heading is still in the markup, marked sr-only. A title painted onto a
   canvas is not text — it cannot be read by a screen reader, found by
   find-on-page, or indexed — so deleting the heading along with its appearance
   would have quietly cost all three. */

const KIND_LABEL: Record<string, string> = {
  article: "Read",
  video: "Watch",
  audio: "Listen",
};

function Tile({ piece, index }: { piece: PieceCard; index?: number }) {
  const coming = piece.state === "placeholder";
  const open = piece.access === "free";

  const inner = (
    <>
      <Cover
        slug={piece.slug}
        title={piece.title}
        className={coming ? "opacity-45" : ""}
      />
      <div className="p-6">
        <h3 className="sr-only">{piece.title}</h3>
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex items-baseline gap-2">
            {typeof index === "number" && (
              <span className="text-xs text-muted accent-hover-sub">
                {String(index + 1).padStart(2, "0")}
              </span>
            )}
            <span className="pill text-xs">
              {coming ? "Coming" : KIND_LABEL[piece.kind]}
            </span>
          </span>
          <span className="text-xs text-muted accent-hover-sub">
            {coming || !open ? `${piece.minutes} min` : "Open"}
          </span>
        </div>
        <p className="mt-4 text-sm text-muted accent-hover-sub leading-relaxed">
          {piece.blurb}
        </p>
      </div>
    </>
  );

  /* A placeholder has no address of its own, so it is not a link. */
  if (coming) return <div className="card overflow-hidden opacity-60">{inner}</div>;

  return (
    <Link
      href={`/learn/${piece.track}/${piece.slug}`}
      className={`group card card-lift overflow-hidden ${accentHover(piece.slug)}`}
    >
      {inner}
    </Link>
  );
}

export default function PieceGrid({
  pieces,
  numbered = false,
}: {
  pieces: PieceCard[];
  /** Show curriculum position. On a track the order is the teaching. */
  numbered?: boolean;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {pieces.map((p, i) => (
        <Tile key={p.slug} piece={p} index={numbered ? i : undefined} />
      ))}
    </div>
  );
}
