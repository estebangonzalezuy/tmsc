import type { Metadata } from "next";
import PostLab from "@/components/postlab/PostLab";

export const metadata: Metadata = {
  title: "the Posts Studio — the Motion Social Club",
  description:
    "Make the club's posts, carousels, and reels: ruled sheets, editorial type, and dithered graphics.",
  robots: { index: false, follow: false },
};

export default function PostLabPage() {
  return <PostLab />;
}
