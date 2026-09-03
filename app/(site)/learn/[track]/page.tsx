import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LearnTrackPage from "@/components/pages/LearnTrackPage";
import { getCard, getTrack, trackIds } from "@/lib/learn";

export function generateStaticParams() {
  return trackIds().map((track) => ({ track }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ track: string }>;
}): Promise<Metadata> {
  const track = getTrack((await params).track);
  if (!track) return {};
  return {
    title: `${track.name} | Learn | the Motion Social Club`,
    description: track.blurb,
  };
}

export default async function Page({ params }: { params: Promise<{ track: string }> }) {
  const track = getTrack((await params).track);
  if (!track) notFound();
  const pieces = track.pieces.map((slug) => getCard(slug)!).filter(Boolean);
  return <LearnTrackPage track={track} pieces={pieces} />;
}
