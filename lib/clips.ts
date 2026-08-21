import raw from "@/content/clips/clips.json";
import { buildClipWall } from "@/lib/clips-shared";
import type { ClipProject, ClipWall, ClipsData } from "@/lib/clips-shared";

// the Clips — the club's library of motion fragments, cut out of real work and
// filed by what they are, how they move and how they land. Same split as the
// Stills and the Directory: the clips are data, the framing is copy. Entries
// live in content/clips/clips.json, written by the Cutter at /cut; the page's
// intro copy lives in content/site.json and is edited in the Studio.
//
// Import this module from server components only — it pulls in every clip of
// every project. The public wall needs all of them at once to filter without a
// round trip, so its route derives the lean index below at build time and hands
// it to the client component as a prop. The types and the pure helpers live in
// lib/clips-shared.ts, which is safe anywhere.

export * from "@/lib/clips-shared";

const data = raw as unknown as ClipsData;

export const assetBase = data.assetBase;

/** Every project, drafts included. The Cutter wants these; pages don't. */
export const allClipProjects: ClipProject[] = data.projects;

/** What the public site shows: curated projects, newest first, and only the
 *  ones that actually have clips. */
export const clipProjects: ClipProject[] = data.projects
  .filter((p) => p.status === "published" && p.clips.length > 0)
  .sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));

export function clipProjectById(id: string): ClipProject | undefined {
  return clipProjects.find((p) => p.id === id);
}

/** The wall index, derived at build time and passed to the client wall. */
export const clipWall: ClipWall = buildClipWall(data);

export const clipTotals = {
  projects: clipProjects.length,
  clips: clipProjects.reduce((n, p) => n + p.clips.length, 0),
  hand: clipProjects.reduce(
    (n, p) => n + p.clips.filter((c) => c.origin === "hand").length,
    0,
  ),
};
