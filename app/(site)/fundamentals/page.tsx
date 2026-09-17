import type { Metadata } from "next";
import FundamentalsPage from "@/components/pages/FundamentalsPage";
import { counts, lessons } from "@/lib/fundamentals";

export const metadata: Metadata = {
  title: "Fundamentals | the Motion Social Club",
  description: `${lessons.map((l) => l.title).join(", ")}: one page each, with ${counts.figures} interactive figures. The base, before the tools.`,
};

export default function Page() {
  return <FundamentalsPage />;
}
