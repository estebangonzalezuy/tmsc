import type { Metadata } from "next";
import ToolWall from "@/components/tools/ToolWall";

export const metadata: Metadata = {
  title: "the Tools — the Motion Social Club",
  description:
    "The club's small tools: a countdown, a quote card, a round-up, a number. One thing each.",
  robots: { index: false, follow: false },
};

export default function ToolsPage() {
  return <ToolWall />;
}
