import { site, type Post } from "@/lib/data";

export default function PostList({ posts }: { posts: Post[] }) {
  return (
    <ul className="divide-y divide-line/30 border-y border-line/30">
      {posts.map((p) => (
        <li key={`${p.date}-${p.title}`}>
          <a
            href={site.substack}
            target="_blank"
            rel="noreferrer"
            className="group grid grid-cols-[4.5rem_1fr_auto] items-baseline gap-4 py-4"
          >
            <span className="text-xs text-muted">{p.date}</span>
            <span className="group-hover:underline underline-offset-4">
              {p.title}
            </span>
            <span className="text-xs text-muted border border-line/40 rounded-full px-2.5 py-0.5">
              {p.type}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
