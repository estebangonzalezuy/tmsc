import raw from "@/content/stills/projects.json";
import { buildWall } from "@/lib/stills-shared";
import type { Project, StillsData, WallData } from "@/lib/stills-shared";

// the Stills — the club's curated wall of style frames pulled out of real
// motion work. Same split as the Directory: the frames are data, the framing
// is copy. Entries live in content/stills/projects.json, written by
// scripts/stills/extract.mjs and curated at /curate; the page's intro copy
// lives in content/site.json and is edited in the Studio like everything else.
//
// Import this module from server components only — it pulls in every frame of
// every project. The public wall needs all of them at once to filter without a
// round trip, so its route derives the lean index below at build time and
// hands it to the client component as a prop. The types and the pure helpers
// live in lib/stills-shared.ts, which is safe anywhere.

export * from "@/lib/stills-shared";

const data = raw as unknown as StillsData;

export const assetBase = data.assetBase;

/** Every project, drafts included. The Curator wants these; pages don't. */
export const allProjects: Project[] = data.projects;

/** What the public site shows: curated projects, newest first, and only the
 *  ones that actually have frames. */
export const projects: Project[] = data.projects
  .filter((p) => p.status === "published" && p.frames.length > 0)
  .sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));

export function projectById(id: string): Project | undefined {
  return projects.find((p) => p.id === id);
}

/** The wall index, derived at build time and passed to the client wall. */
export const wall: WallData = buildWall(data);

export const stillsTotals = {
  projects: projects.length,
  frames: projects.reduce((n, p) => n + p.frames.length, 0),
  hand: projects.reduce(
    (n, p) => n + p.frames.filter((f) => f.origin === "hand").length,
    0,
  ),
};
