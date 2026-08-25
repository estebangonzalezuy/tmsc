import type { Metadata } from "next";
import ClipsPage from "@/components/pages/ClipsPage";
import { clipTotals, clipWall } from "@/lib/clips";

export const metadata: Metadata = {
  title: "Clips | the Motion Social Club",
  description: clipTotals.clips
    ? `${clipTotals.clips} fragments of brand and product presentation, cut from ${clipTotals.projects} films and filed by what they are, how they move, how they land and who was presenting — every one steppable frame by frame.`
    : "Fragments of brand and product presentation, filed by what they are, how they move, how they land and who was presenting — every one steppable frame by frame.",
};

export default function Page() {
  return <ClipsPage wall={clipWall} />;
}
