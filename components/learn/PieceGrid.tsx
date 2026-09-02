"use client";

import Link from "next/link";
import { accentHover } from "@/lib/accent";
import Cover from "./Cover";
import type { PieceCard } from "@/lib/learn";

/* The library as a wall. Three up, square covers, real gaps — a grid of things
   to look at rather than a list of titles.

   The playhead is not started here. Every page carrying canvases renders one
   <ClockRunner />, because every canvas on the page subscribes to the same
   shared clock — a second starter would advance it twice a frame rather than
   animate a second thing. */

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
      {/* A placeholder gets a cover too. It is a real part of the library that
          is not written yet, and a hole in the grid would say something else. */}
      <Cover
        slug={piece.slug}
        title={piece.title}
        className={coming ? "opacity-40 saturate-0" : ""}
      />
      <div className="p-6">
        <div className="flex items-baseline justify-between gap-3">
          <span className="pill text-xs">
            {coming ? "Coming" : KIND_LABEL[piece.kind]}
          </span>
          <span className="text-xs text-muted accent-hover-sub">
            {coming ? `${piece.minutes} min` : open ? "Open" : `${piece.minutes} min`}
          </span>
        </div>
        <h3 className="mt-4 font-serif text-xl leading-snug group-hover:underline underline-offset-4">
          {typeof index === "number" && (
            <span className="text-muted accent-hover-sub text-sm mr-2">
              {String(index + 1).padStart(2, "0")}
            </span>
          )}
          {piece.title}
        </h3>
        <p className="mt-3 text-sm text-muted accent-hover-sub leading-relaxed">
          {piece.blurb}
        </p>
      </div>
    </>
  );

  /* A placeholder has no address of its own, so it is not a link. Same promise
     the track list has always made, kept in a different shape. */
  if (coming) {
    return (
      <div className="card overflow-hidden opacity-60">{inner}</div>
    );
  }

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
