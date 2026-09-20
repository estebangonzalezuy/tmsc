import type { Metadata } from "next";
import PostStudio from "@/components/postlab/PostStudio";

export const metadata: Metadata = {
  title: "the Posts Studio — the Motion Social Club",
  description:
    "Make the club's posts: a row of totems on a sheet, a palette, a line of type, animated and exported as a still, a video or a GIF.",
  robots: { index: false, follow: false },
};

export default function PostLabPage() {
  return <PostStudio />;
}
