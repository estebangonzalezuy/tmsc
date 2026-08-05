import type { Metadata } from "next";
import RunsPanel from "@/components/runs/RunsPanel";

export const metadata: Metadata = {
  title: "the Desk — the Motion Social Club",
  robots: { index: false, follow: false },
};

export default function DeskPage() {
  return <RunsPanel />;
}
