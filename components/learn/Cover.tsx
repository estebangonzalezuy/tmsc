// The title card. It used to be a generated PostSpec sheet — ruled paper, an
// editorial headline — drawn through the old studio's renderer. That renderer
// (lib/learnCover.ts) is retired with the rest of the PostSpec model
// (AGENTS.md, Workstream 4); this is the plain fallback the task calls for
// rather than a port onto the new node-graph model, since a static server
// component needs no live renderer at all for a card that never animated in
// the first place.
//
// A seeded neutral ground (the same "stable per slug" rule accentHover
// follows) keeps the grid from reading as one flat colour, and the title is
// real text — a heading, not pixels — so it costs nothing for a11y or search.

const GROUNDS = ["#ffffff", "#f4f3ef", "#e6e5e1", "#fffdf0"];

function seedOf(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  }
  return h;
}

export default function Cover({
  slug,
  title,
  className = "",
}: {
  slug: string;
  title: string;
  className?: string;
}) {
  const ground = GROUNDS[seedOf(slug) % GROUNDS.length];
  return (
    <div
      className={`aspect-square overflow-hidden flex items-end p-5 ${className}`}
      style={{ background: ground }}
    >
      <p className="font-serif text-lg leading-snug">{title}</p>
    </div>
  );
}
