// The Desk's fast path: turn a thought straight into a postable sheet, with
// no network and no token.
//
// This is the one path AGENTS.md calls out by name as where the Desk's box
// lands, so it gets its own small builder rather than disappearing with the
// creators that were unified away. It writes the line onto a poster whose
// row is seeded from the words themselves — the same thought always draws
// the same post — and hands back the link the studio already knows how to
// reopen.

import { defaultPoster, encodePoster, hash01, PALETTE_KINDS, type Poster } from "@/lib/poster";

export function buildNotePoster(line: string): Poster {
  const words = line.trim();
  const seed = words.slice(0, 40) || "note";
  return {
    ...defaultPoster(),
    seed,
    /* Seeded from the words, so two different thoughts do not arrive in the
       same colours and the same thought is recognisable later. */
    palette: PALETTE_KINDS[Math.floor(hash01(seed + "pal") * PALETTE_KINDS.length)],
    columns: 3 + Math.floor(hash01(seed + "cols") * 3),
    kicker: "the Motion Social Club",
    title: words,
    textPlace: "bottom",
  };
}

export function noteLink(line: string): string {
  return `/postlab#poster=${encodePoster(buildNotePoster(line))}`;
}
