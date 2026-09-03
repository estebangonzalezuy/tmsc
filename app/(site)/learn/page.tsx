import type { Metadata } from "next";
import LearnPage from "@/components/pages/LearnPage";
import { counts, path } from "@/lib/learn";

export const metadata: Metadata = {
  title: "Learn | the Motion Social Club",
  description: `The club's own library: ${path.length} days that get you moving, then ${counts.tracks} tracks of articles, video and audio. Fundamentals first, tools second.`,
};

export default function Page() {
  return <LearnPage />;
}
