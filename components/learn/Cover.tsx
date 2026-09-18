import Illustration from "@/components/Illustration";
import { hash01, type IllusKind } from "@/lib/illus/drawers";

/* The title card.
 *
 * It used to be a generated PostSpec sheet drawn through the old studio's
 * renderer; that renderer retired with the rest of the PostSpec model, and
 * this became a flat neutral square with the title on it. Now the site draws
 * its own pictures (lib/illus/drawers.ts), so a cover is one of those —
 * stopped at an instant the piece's own slug puts it at, on one of the club's
 * colours picked the same way.
 *
 * The title is still real text over the drawing rather than pixels in it, so
 * it costs nothing for a11y or search and a long one just wraps.
 */

const GROUNDS: { block: string; ink: string; type: string }[] = [
  { block: "bg-accent", ink: "rgba(255,255,255,.55)", type: "text-white" },
  { block: "bg-accent-warm", ink: "rgba(255,255,255,.55)", type: "text-white" },
  { block: "bg-accent-soft", ink: "rgba(13,13,13,.45)", type: "text-foreground" },
  { block: "bg-accent-green", ink: "rgba(255,255,255,.55)", type: "text-white" },
  { block: "bg-accent-cream", ink: "rgba(13,13,13,.4)", type: "text-foreground" },
  { block: "bg-inset", ink: "rgba(13,13,13,.4)", type: "text-foreground" },
];

const KINDS: IllusKind[] = [
  "letters",
  "frames",
  "sheet",
  "grid",
  "path",
  "lines",
  "orbit",
];

export default function Cover({
  slug,
  title,
  className = "",
}: {
  slug: string;
  title: string;
  className?: string;
}) {
  const n = Math.floor(hash01(slug) * 42);
  const { block, ink, type } = GROUNDS[n % GROUNDS.length];
  const kind = KINDS[Math.floor(n / 6) % KINDS.length];
  return (
    <div
      className={`relative aspect-square overflow-hidden flex items-end p-5 ${block} ${type} ${className}`}
    >
      <Illustration
        kind={kind}
        ink={ink}
        still={slug}
        className="absolute inset-x-0 top-0 h-[68%] w-full"
      />
      <p className="relative font-serif text-lg leading-snug">{title}</p>
    </div>
  );
}
