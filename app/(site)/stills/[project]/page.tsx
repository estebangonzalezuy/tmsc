import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StillsProjectPage from "@/components/pages/StillsProjectPage";
import { assetBase, projectById, projects } from "@/lib/stills";

type Props = { params: Promise<{ project: string }> };

export function generateStaticParams() {
  return projects.map((p) => ({ project: p.id }));
}

// Only curated projects have pages. A slug that isn't one is a 404 rather
// than a request Vercel renders on demand.
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = projectById((await params).project);
  if (!project) return {};
  const credit = [project.credit, project.year].filter(Boolean).join(", ");
  return {
    title: `${project.title} | the Stills | the Motion Social Club`,
    description:
      project.note ||
      `${project.frames.length} style frames curated from ${project.title}${credit ? ` (${credit})` : ""}.`,
  };
}

export default async function Page({ params }: Props) {
  const project = projectById((await params).project);
  if (!project) notFound();

  return <StillsProjectPage project={project} assetBase={assetBase} />;
}
