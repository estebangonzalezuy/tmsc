import type { Metadata } from "next";
import Tiles from "@/components/tiles/Tiles";

export const metadata: Metadata = {
  title: "the Tiles — the Motion Social Club",
  description:
    "Framed squares of hand-cut folk ornament: a frame, a panel, some guides and a stack of arms.",
  robots: { index: false, follow: false },
};

export default function TilesPage() {
  return <Tiles />;
}
