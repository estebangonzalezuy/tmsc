import type { Metadata } from "next";
import PostLab from "@/components/postlab/PostLab";

export const metadata: Metadata = {
  title: "the Post Lab — the Motion Social Club",
  description:
    "Generate the club's animated posts, carousels, and reels with shader backgrounds.",
  robots: { index: false, follow: false },
};

export default function PostLabPage() {
  return <PostLab />;
}
