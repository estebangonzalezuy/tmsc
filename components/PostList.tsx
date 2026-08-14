"use client";

import type { Post } from "@/lib/data";
import { useContent } from "@/components/content";
import { accentHoverText } from "@/components/Motifs";

export default function PostList({ posts }: { posts: Post[] }) {
  const { site } = useContent();
  return (
    <ul className="card row-divide px-6">
      {posts.map((p) => (
        <li key={`${p.date}-${p.title}`}>
          <a
            href={p.href || site.substack}
            target="_blank"
            rel="noreferrer"
            className={`group grid grid-cols-[4.5rem_1fr_auto] items-baseline gap-4 py-4 ${accentHoverText(
              p.title,
            )}`}
          >
            <span className="text-xs text-muted">{p.date}</span>
            <span className="group-hover:underline underline-offset-4">
              {p.title}
            </span>
            <span className="text-xs text-muted pill">
              {p.type}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
