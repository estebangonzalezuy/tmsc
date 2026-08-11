import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TOOLS, toolDef } from "@/lib/tools";
import ToolViewer from "@/components/tools/ToolViewer";

/* One page per tool, built at build time — a tool is a place, not a query. */
export function generateStaticParams() {
  return TOOLS.map((t) => ({ tool: t.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string }>;
}): Promise<Metadata> {
  const tool = toolDef((await params).tool);
  return {
    title: `${tool?.name ?? "the Tools"} — the Motion Social Club`,
    description: tool?.about,
    robots: { index: false, follow: false },
  };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool } = await params;
  if (!toolDef(tool)) notFound();
  return <ToolViewer id={tool} />;
}
