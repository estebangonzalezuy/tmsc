import type { Metadata } from "next";
import StillsPage from "@/components/pages/StillsPage";
import { stillsTotals, wall } from "@/lib/stills";

export const metadata: Metadata = {
  title: "Stills | the Motion Social Club",
  description: stillsTotals.frames
    ? `${stillsTotals.frames} style frames curated from ${stillsTotals.projects} motion design projects: compositions, palettes, type and light, each linked back to the second it came from.`
    : "Style frames curated from motion design projects: compositions, palettes, type and light, each linked back to the second it came from.",
};

export default function Page() {
  return <StillsPage wall={wall} />;
}
