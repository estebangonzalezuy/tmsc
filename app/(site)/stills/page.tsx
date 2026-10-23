import type { Metadata } from "next";
import StillsPage from "@/components/pages/StillsPage";
import { stillsTotals, wall } from "@/lib/stills";

export const metadata: Metadata = {
  title: "Stills | the Motion Social Club",
  description: stillsTotals.frames
    ? `${stillsTotals.frames} frames from ${stillsTotals.projects} projects. Composition, type, and light, each linked back to the second it came from.`
    : "Frames from real projects. Composition, type, and light, each linked back to the second it came from.",
};

export default function Page() {
  return <StillsPage wall={wall} />;
}
