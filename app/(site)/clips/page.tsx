import type { Metadata } from "next";
import ClipsPage from "@/components/pages/ClipsPage";
import { clipTotals, clipWall } from "@/lib/clips";

export const metadata: Metadata = {
  title: "Clips | the Motion Social Club",
  description: clipTotals.clips
    ? `${clipTotals.clips} fragments of motion cut from ${clipTotals.projects} projects and filed by what they are, how they move and how they land — every one steppable frame by frame.`
    : "Fragments of motion cut from real projects and filed by what they are, how they move and how they land — every one steppable frame by frame.",
};

export default function Page() {
  return <ClipsPage wall={clipWall} />;
}
