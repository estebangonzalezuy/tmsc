import type { Metadata } from "next";
import PreviewClient from "./PreviewClient";
import { wall } from "@/lib/stills";
import { clipWall } from "@/lib/clips";
import { homeWalls, roomCounts } from "@/lib/home";

export const metadata: Metadata = {
  title: "Preview — the Studio",
  robots: { index: false, follow: false },
};

export default function PreviewPage() {
  /* The index's counts and walls come from the same place the real page
     gets them, so the preview is the page rather than a version of it with
     the data missing. */
  return (
    <PreviewClient
      stillsWall={wall}
      clipsWall={clipWall}
      homeCounts={roomCounts()}
      homeWalls={homeWalls()}
    />
  );
}
