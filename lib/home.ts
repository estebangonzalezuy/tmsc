import { clipProjects } from "@/lib/clips";
import { directoryTotal, manifestCollections } from "@/lib/directory";
import { counts as learnCounts, tracks } from "@/lib/learn";
import type { RoomCounts } from "@/lib/rooms";
import { projects as stillProjects } from "@/lib/stills";
import { archive } from "@/lib/data";

/* The index's own data.
   Exported rather than inlined into the page because the Studio's preview
   renders the same component and would otherwise show a homepage with no
   counts — a preview of a page that doesn't exist.

   The index is the one page that has to say how big the club is, so the
   numbers under the rooms are read here, at build time, out of the same data
   the pages themselves render. Nothing on the home page is a number somebody
   typed into the Studio and forgot to update. Server-only — import it from a
   route, never from a "use client" file. lib/stills and lib/clips pull in
   every frame and every clip, which is fine here and would be a disaster in
   the client bundle. */

export function roomCounts(): RoomCounts {
  const collections = manifestCollections.length;
  const frames = stillProjects.reduce((n, p) => n + p.frames.length, 0);
  const clips = clipProjects.reduce((n, p) => n + p.clips.length, 0);
  const letters = archive.reduce((n, y) => n + y.posts.length, 0);
  return {
    directory: `${directoryTotal} entries · ${collections} collections`,
    stills: `${frames} frames · ${stillProjects.length} projects`,
    clips: `${clips} clips · ${clipProjects.length} projects`,
    fundamentals: "4 pages · free",
    learn: `${tracks.length} tracks · ${learnCounts.published} written`,
    newsletter: `${letters} letters`,
    practice: "6 exercises",
  };
}
