import type { Metadata } from "next";
import PreviewClient from "./PreviewClient";
import { wall } from "@/lib/stills";
import { clipWall } from "@/lib/clips";
import { groundTakes } from "@/lib/ground";

export const metadata: Metadata = {
  title: "Preview — the Studio",
  robots: { index: false, follow: false },
};

export default function PreviewPage() {
  return (
    <PreviewClient
      stillsWall={wall}
      clipsWall={clipWall}
      groundTakes={groundTakes()}
    />
  );
}
