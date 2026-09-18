import { clipProjects, assetBase as clipBase, sheetSrc, clipcode } from "@/lib/clips";
import { directoryTotal, manifestCollections } from "@/lib/directory";
import { counts as learnCounts, tracks } from "@/lib/learn";
import type { WallPick } from "@/components/pages/HomePage";
import type { RoomCounts } from "@/lib/rooms";
import { projects as stillProjects, assetBase as stillBase, frameSrc, frameSrcSet, timecode } from "@/lib/stills";
import { archive } from "@/lib/data";

/* The index's own data.
   Exported rather than inlined into the page because the Studio's preview
   renders the same component and would otherwise show a homepage with no
   counts and no walls — a preview of a page that doesn't exist.

   The index is the one page that has to say how big the club is, so the
   numbers under the rooms and the frames on the walls are read here, at build
   time, out of the same data the pages themselves render. Nothing on the home
   page is a number somebody typed into the Studio and forgot to update.

   This module is also why the walls can be real: lib/stills and lib/clips
   pull in every frame and every clip, which is fine in a server component and
   would be a disaster in the client bundle, so the four and four that actually
   appear are picked here and handed over as props. Server-only, for that
   reason — import it from a route, never from a "use client" file. */

const HOW_MANY = 4;

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

/* The index only shows work it can name. A wall's whole promise is that every
   frame is credited and links back to the second it came from, so a project
   with nobody's name on it is fine on the wall, where it is one of many and
   says so, and wrong on the front page. */
const credited = <T extends { credit: string }>(items: T[]) =>
  items.filter((p) => p.credit.trim().length > 0);

/* One frame per project rather than four out of the newest one: the wall is
   showing what the club has looked at, not what it added last. The middle
   frame because the first of a film is usually its title card. */
export function stills(): WallPick[] {
  return credited(stillProjects).slice(0, HOW_MANY).map((project) => {
    const frame = project.frames[Math.floor(project.frames.length / 2)];
    return {
      kind: "still",
      key: `${project.id}-${frame.id}`,
      src: frameSrc(stillBase, project.id, frame, "thumb"),
      srcSet: frameSrcSet(stillBase, project.id, frame),
      title: project.title.trim(),
      credit: project.credit,
      code: timecode(frame.t),
      href: `/stills/${project.id}`,
    };
  });
}

export function clips(): WallPick[] {
  return credited(clipProjects).slice(0, HOW_MANY).map((project) => {
    const clip = project.clips[Math.floor(project.clips.length / 2)];
    return {
      kind: "clip",
      key: `${project.id}-${clip.id}`,
      sheet: sheetSrc(clipBase, project.id, clip),
      poster: sheetSrc(clipBase, project.id, clip, "poster"),
      shape: {
        cols: clip.cols,
        rows: clip.rows,
        frames: clip.frames,
        w: clip.w,
        h: clip.h,
        in: clip.in,
        out: clip.out,
      },
      title: project.title.trim(),
      credit: project.credit,
      code: clipcode(clip.in),
      href: `/clips/${project.id}`,
    };
  });
}

/** The strip on the index: the stills first, then the clips. */
export function homeWalls(): WallPick[] {
  return [...stills(), ...clips()];
}
