"use client";

import type { Post } from "@/lib/data";
import { useContent } from "@/components/content";
import { accentHoverText, Cover } from "@/components/Motifs";

/* The archive, as rows. A letter is a date, a title and what kind of letter
   it is, with its Substack cover on the left — the same image the post
   uses, gif included. A letter with no public cover keeps a flat swatch
   so the titles still line up. */

export default function PostList({ posts }: { posts: Post[] }) {
  const { site } = useContent();
  return (
    <ul className="row-divide border-t border-line">
      {posts.map((p) => (
        <li key={`${p.date}-${p.title}`}>
          <a
            href={p.href || site.substack}
            target="_blank"
            rel="noreferrer"
            className={`group flex items-center gap-4 py-4 md:gap-6 ${accentHoverText(
              p.title,
            )}`}
          >
            {p.image ? (
              // The cover is a remote gif or still. next/image would want a
              // remote pattern and would freeze a gif; a plain img plays it.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.image}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-video w-[5.75rem] shrink-0 bg-inset object-cover sm:w-40"
              />
            ) : (
              <Cover
                title={p.title}
                className="aspect-video w-[5.75rem] shrink-0 sm:w-40"
              />
            )}
            <span className="label w-[6.5rem] shrink-0 hidden md:block">
              {p.date}
            </span>
            <span className="flex-1 font-serif text-xl md:text-2xl leading-snug tracking-tight group-hover:underline underline-offset-4 decoration-1">
              {p.title}
              <span className="label mt-1 block md:hidden">{p.date}</span>
            </span>
            <span className="pill shrink-0">{p.type}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
