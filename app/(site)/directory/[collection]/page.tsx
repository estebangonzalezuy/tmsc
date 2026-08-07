import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import DirectoryCollectionPage from "@/components/pages/DirectoryCollectionPage";
import { collectionIds, getCollection } from "@/lib/directory";

type Props = { params: Promise<{ collection: string }> };

export function generateStaticParams() {
  return collectionIds().map((collection) => ({ collection }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const collection = getCollection((await params).collection);
  if (!collection) return {};
  return {
    title: `${collection.name} — the Directory — the Motion Social Club`,
    description: collection.blurb,
  };
}

export default async function Page({ params }: Props) {
  const collection = getCollection((await params).collection);
  if (!collection) notFound();

  // DirectoryCollectionPage keeps its filters in the query string, so it needs a
  // Suspense boundary to stay statically rendered.
  return (
    <Suspense>
      <DirectoryCollectionPage collection={collection} />
    </Suspense>
  );
}
