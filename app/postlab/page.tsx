import type { Metadata } from "next";
import PostGraphStudio from "@/components/postlab/PostGraphStudio";

export const metadata: Metadata = {
  title: "the Posts Studio — the Motion Social Club",
  description:
    "Make the club's posts, carousels, and reels as a node graph: fields, photos, type and shapes, wired together.",
  robots: { index: false, follow: false },
};

export default function PostLabPage() {
  return <PostGraphStudio />;
}
