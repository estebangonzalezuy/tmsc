import type { IllusKind } from "@/lib/illus/drawers";
import type { RoomColour } from "@/components/Motifs";

/* The rooms: the seven things the club actually holds, as the homepage lists
 * them.
 *
 * Which rooms exist, what they are called and what each one says are three
 * different kinds of fact, so they live in three places:
 *
 * - **Here**: where a room goes, what colour it is, which drawing runs in it,
 *   and which content section switches it off. Design and wiring, not copy.
 * - **content/site.json → rooms**: the name and the one line under it, edited
 *   in the Studio like everything else the owner writes.
 * - **The data**: the count on a room's pill is read off the walls and the
 *   manifests at build time, never typed. A room that says "744 entries" when
 *   the Directory holds 683 is worse than a room that says nothing.
 *
 * A room's colour and drawing are fixed rather than hashed: a room is a
 * place, and the Directory should always be the indigo one with the letters
 * turning over in it. This module is data only, so a server component can
 * read it.
 */

export type RoomSpec = {
  id: string;
  href: string;
  colour: RoomColour;
  kind: IllusKind;
  /** The content section that powers it; hiding that hides the room. */
  section: string;
  /** The Studio's navigation toggle, which hides the room with the link. */
  navId: string;
};

export const ROOM_SPECS: RoomSpec[] = [
  {
    id: "directory",
    href: "/directory",
    colour: "indigo",
    kind: "letters",
    section: "directory",
    navId: "directory",
  },
  {
    id: "stills",
    href: "/stills",
    colour: "warm",
    kind: "frames",
    section: "stills",
    navId: "stills",
  },
  {
    id: "clips",
    href: "/clips",
    colour: "peri",
    kind: "sheet",
    section: "clips",
    navId: "clips",
  },
  {
    id: "fundamentals",
    href: "/fundamentals",
    colour: "paper",
    kind: "grid",
    section: "fundamentals",
    navId: "fundamentals",
  },
  {
    id: "learn",
    href: "/learn",
    colour: "green",
    kind: "path",
    section: "learn",
    navId: "learn",
  },
  {
    id: "newsletter",
    href: "/newsletter",
    colour: "cream",
    kind: "lines",
    section: "archive",
    navId: "newsletter",
  },
  {
    id: "practice",
    href: "/practice",
    colour: "ink",
    kind: "orbit",
    section: "practiceExercises",
    navId: "practice",
  },
];

/** What a room's pill says, keyed by room id. Built in the page's server
 *  wrapper from the walls and the manifests. */
export type RoomCounts = Record<string, string>;
