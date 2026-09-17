import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FundamentalPage from "@/components/pages/FundamentalPage";
import { getCard, getLesson, lessonSlugs, neighbours } from "@/lib/fundamentals";
import { fundamentals } from "@/lib/data";

export function generateStaticParams() {
  return lessonSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const card = getCard((await params).slug);
  if (!card) return {};
  return {
    title: `${card.title} | Fundamentals | the Motion Social Club`,
    description: card.blurb,
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson) notFound();
  const { prev, next } = neighbours(slug);
  return (
    <FundamentalPage
      lesson={lesson}
      label={fundamentals?.label ?? "Fundamentals"}
      prev={prev}
      next={next}
    />
  );
}
