"use client";

import { CircleLetter } from "@/components/Motifs";
import { RULES, type MediaItem, type Network } from "@/lib/posts-shared";

// A mock of the post as one network will show it. Monochrome like everything
// else on the site: the point is the line breaks, the cut-off and how four
// images sit, not the network's colours.

export type PreviewMedia = MediaItem & { src: string };

export default function Preview({
  network,
  name,
  handle,
  text,
  media,
}: {
  network: Network;
  name: string;
  handle: string;
  text: string;
  media: PreviewMedia[];
}) {
  const rule = RULES[network];
  const usable = media.filter((m) => rule.media.includes(m.kind)).slice(0, rule.maxMedia);
  const shown = network === "x" ? clipX(text) : text;

  return (
    <div className="card p-5 space-y-3 text-sm">
      <div className="flex items-center gap-3">
        <CircleLetter size="size-10">{rule.mark}</CircleLetter>
        <div className="leading-tight">
          <p>{name}</p>
          <p className="text-xs text-muted">
            {network === "linkedin" ? "Just now" : handle}
          </p>
        </div>
      </div>

      {network === "instagram" ? (
        <>
          <Media items={usable} network={network} />
          {usable.length === 0 && (
            <p className="text-xs text-muted">Instagram needs an image or a video.</p>
          )}
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            <span className="font-medium">{handle.replace(/^@/, "")}</span>{" "}
            {shown || <span className="text-muted">Your words…</span>}
          </p>
        </>
      ) : (
        <>
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            {shown || <span className="text-muted">Your words…</span>}
          </p>
          <Media items={usable} network={network} />
        </>
      )}

      <p className="text-xs text-muted pt-1">
        {network === "linkedin" && "Like · Comment · Repost · Send"}
        {network === "x" && "Reply · Repost · Like · Views"}
        {network === "instagram" && "♡  ◯  ↗"}
        {network === "substack" && "♡ · Reply · Restack"}
      </p>
    </div>
  );
}

/** X shows about 280 characters; anything past that is what would be cut. */
function clipX(text: string): string {
  return text;
}

function Media({ items, network }: { items: PreviewMedia[]; network: Network }) {
  if (items.length === 0) return null;
  const grid =
    items.length === 1
      ? "grid-cols-1"
      : items.length === 2 || network === "instagram"
        ? "grid-cols-2"
        : "grid-cols-2";
  return (
    <div className={`grid ${grid} gap-1 overflow-hidden rounded-[var(--radius-sm)]`}>
      {items.map((m, i) => (
        <div
          key={m.file}
          className={`inset overflow-hidden ${
            items.length === 3 && i === 0 ? "row-span-2" : ""
          } ${items.length === 1 ? "" : "aspect-square"}`}
        >
          {m.kind === "video" ? (
            <video src={m.src} muted playsInline className="size-full object-cover" />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element -- a blob URL
               from the composer, or a repo path; neither goes through the
               image optimizer. */
            <img src={m.src} alt={m.alt ?? ""} className="size-full object-cover" />
          )}
        </div>
      ))}
    </div>
  );
}
