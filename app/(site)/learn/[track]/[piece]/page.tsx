import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LearnPiecePage from "@/components/pages/LearnPiecePage";
import { getCard, getPiece, getTrack, path, piecePaths } from "@/lib/learn";

export function generateStaticParams() {
  return piecePaths();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ track: string; piece: string }>;
}): Promise<Metadata> {
  const { track, piece } = await params;
  const card = getCard(piece);
  if (!card || card.track !== track) return {};
  return {
    title: `${card.title} | Learn | the Motion Social Club`,
    description: card.blurb,
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ track: string; piece: string }>;
}) {
  const { track: trackId, piece: slug } = await params;
  const piece = getPiece(trackId, slug);
  const track = getTrack(trackId);
  /* A placeholder is a promise, not a page: it is listed on its track and has
     no address of its own until it is written. */
  if (!piece || !track || piece.state === "placeholder") notFound();

  const at = track.pieces.indexOf(slug);
  const next = at >= 0 ? getCard(track.pieces[at + 1] ?? "") : null;
  const day = path.find((d) => d.piece === slug) ?? null;

  return <LearnPiecePage piece={piece} track={track} day={day} next={next} />;
}
