import { assetBase, clipWall, sheetSrc } from "@/lib/clips";
import type { DemoTake } from "@/components/pages/GroundPage";

// the Ground — the club's practice app. Only its landing page exists so far;
// docs/THE-GROUND.md is the argument and the order of work.
//
// The band across the hero is the product, so it is real motion rather than a
// mockup: the club's own clips, animating on the shared ticker exactly as they
// do on /clips. Resolved here rather than in the route because both the public
// page and the Studio preview draw the same band, and because lib/clips pulls
// in every clip of every project — import this from server components only.

/** The handful of takes the hero band draws.
 *
 *  Deliberately not the whole library: a landing page that fetched 26 sprite
 *  sheets would weigh more than the page it is advertising. Every other clip is
 *  taken so consecutive tiles come from different moments rather than sitting
 *  next to their own neighbours. */
export function groundTakes(): DemoTake[] {
  const wall = clipWall;
  return wall.clips
    .filter((_, i) => i % 2 === 0)
    .slice(0, 12)
    .map((clip) => {
      const project = wall.projects[clip.p];
      return {
        id: `${project.id}-${clip.id}`,
        credit: project.credit || project.title,
        sheet: sheetSrc(assetBase, project.id, clip),
        poster: sheetSrc(assetBase, project.id, clip, "poster"),
        shape: {
          cols: clip.cols,
          rows: clip.rows,
          frames: clip.frames,
          w: clip.w,
          h: clip.h,
          in: clip.in,
          out: clip.out,
        },
      };
    });
}
