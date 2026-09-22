"use client";

import type { Post } from "@/lib/data";
import { useContent } from "@/components/content";
import { accentHoverText, Cover } from "@/components/Motifs";

/* The archive, as rows. A letter is a date, a title and what kind of letter
   it is — and, where there is room for it, a cover: one of the club's own
   drawings, stopped at an instant its own headline puts it at. Nothing is
   uploaded and nothing is stored; see Cover in Motifs. */

export default function PostList({
  posts,
  covers = false,
}: {
  posts: Post[];
  covers?: boolean;
}) {
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
            {covers && (
              <Cover
                title={p.title}
                className="hidden h-[74px] w-[112px] shrink-0 sm:block"
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
