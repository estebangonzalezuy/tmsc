import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ClipsProjectPage from "@/components/pages/ClipsProjectPage";
import { assetBase, clipProjectById, clipProjects } from "@/lib/clips";

type Props = { params: Promise<{ project: string }> };

export function generateStaticParams() {
  return clipProjects.map((p) => ({ project: p.id }));
}

// Only curated projects have pages. A slug that isn't one is a 404 rather than
// a request Vercel renders on demand.
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = clipProjectById((await params).project);
  if (!project) return {};
  const credit = [project.credit, project.year].filter(Boolean).join(", ");
  return {
    title: `${project.title} | Clips | the Motion Social Club`,
    description:
      project.note ||
      `${project.clips.length} fragments of motion cut from ${project.title}${credit ? ` (${credit})` : ""}.`,
  };
}

export default async function Page({ params }: Props) {
  const project = clipProjectById((await params).project);
  if (!project) notFound();

  return <ClipsProjectPage project={project} assetBase={assetBase} />;
}
