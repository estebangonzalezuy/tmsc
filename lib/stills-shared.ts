// the Stills — the shapes and the pure helpers, with no data imported.
//
// This module is safe to pull into a client component: it carries no JSON,
// so importing `timecode` on the wall doesn't drag every project's frame list
// into the browser bundle. The data lives next door in lib/stills.ts, which
// holds projects.json and is for server components only.

/** Where a project came from. `platform` decides how a timestamp deep link
 *  is built — see momentUrl. */
export type StillsSource = {
  url: string;
  platform: "youtube" | "vimeo" | "other";
  /** The platform's own id, when the extractor could name one. */
  videoId?: string;
  /** Title and uploader as the platform reported them, kept so the Curator
   *  can offer them as defaults without another network call. */
  title?: string;
  author?: string;
};

/** The sprite sheets that let the Curator scrub a video it cannot play:
 *  one low-res tile per second, packed `cols` x `rows` to a sheet. */
export type ScrubStrip = {
  files: string[];
  cols: number;
  rows: number;
  tileW: number;
  tileH: number;
  /** Tiles per second. 1 in practice — the sheets are a scrubber, not video. */
  fps: number;
  /** Total tiles across every sheet. */
  count: number;
};

export type Frame = {
  /** Derived from the timestamp, so the same moment is always the same
   *  frame and re-running the extractor can never duplicate one. */
  id: string;
  /** Seconds into the source video. */
  t: number;
  /** Filename inside the project's asset directory. */
  file: string;
  /** The wall-sized copy. Falls back to `file`. */
  thumb?: string;
  w: number;
  h: number;
  tags?: string[];
  note?: string;
  /** "auto" for a scene-detection suggestion, "hand" for one picked in the
   *  Curator's scrubber. Kept so the wall can say how much of it is judgement. */
  origin?: "auto" | "hand";
};

export type Project = {
  id: string;
  title: string;
  credit: string;
  year: string;
  note?: string;
  tags: string[];
  /** Drafts are extracted but not curated — they stay off the public wall. */
  status: "draft" | "published";
  addedAt: string;
  source: StillsSource;
  /** Source video length in seconds. */
  duration: number;
  width: number;
  height: number;
  /** Frame id used as the project's cover. Falls back to the first frame. */
  cover?: string;
  scrub?: ScrubStrip;
  frames: Frame[];
};

export type StillsData = {
  version: number;
  /** Prefix every asset path gets. Everything the site renders goes through
   *  frameSrc, so moving the images off the repo later is this one string. */
  assetBase: string;
  projects: Project[];
};

/* ---------- the wall index ---------- */

/** A frame on the wall, flattened and shortened: `p` indexes into
 *  WallData.projects so a project's title isn't repeated a dozen times. */
export type WallFrame = {
  p: number;
  id: string;
  t: number;
  file: string;
  thumb?: string;
  w: number;
  h: number;
  tags?: string[];
  origin?: "auto" | "hand";
};

export type WallProject = {
  id: string;
  title: string;
  credit: string;
  year: string;
  source: StillsSource;
  frameCount: number;
};

export type WallData = {
  version: number;
  assetBase: string;
  projectCount: number;
  frameCount: number;
  tags: { value: string; count: number }[];
  projects: WallProject[];
  frames: WallFrame[];
};

/* ---------- pure helpers ---------- */

/** Path to a frame image. Everything that renders a still goes through here,
 *  so moving the assets off the repo is a change to `assetBase` alone. */
export function frameSrc(
  assetBase: string,
  projectId: string,
  frame: { file: string; thumb?: string },
  size: "full" | "thumb" = "full",
): string {
  const file = size === "thumb" ? (frame.thumb ?? frame.file) : frame.file;
  return `${assetBase}/${projectId}/${file}`;
}

export function scrubSrc(
  assetBase: string,
  projectId: string,
  file: string,
): string {
  return `${assetBase}/${projectId}/${file}`;
}

/** m:ss, the way a timeline reads it. */
export function timecode(t: number): string {
  const total = Math.max(0, Math.floor(t));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** The frame id for a timestamp. Milliseconds, zero padded, so ids sort in
 *  timeline order as strings and the same moment always lands on the same id. */
export function frameId(t: number): string {
  return `t${String(Math.round(t * 1000)).padStart(8, "0")}`;
}

/** A link that opens the source video at the frame's moment, so a still can
 *  always be checked against the thing it came from. */
export function momentUrl(source: StillsSource, t: number): string {
  const secs = Math.max(0, Math.floor(t));
  if (source.platform === "youtube" && source.videoId) {
    return `https://youtu.be/${source.videoId}?t=${secs}`;
  }
  if (source.platform === "vimeo") {
    const base = source.url.split("#")[0];
    return `${base}#t=${secs}s`;
  }
  // Unknown players mostly ignore a fragment they don't understand, which is
  // the right failure: the link still opens the video.
  const [base, hash] = source.url.split("#");
  return hash ? source.url : `${base}#t=${secs}s`;
}

export function coverFrame(project: Project): Frame | undefined {
  return project.frames.find((f) => f.id === project.cover) ?? project.frames[0];
}

/* ---------- deriving the wall ---------- */

/** projects.json flattened into what the wall actually renders: every frame,
 *  the project named once instead of a dozen times, and the tag counts.
 *
 *  Derived rather than stored. A generated wall.json would have to be written
 *  by the extractor in Node and again by the Curator in the browser, and the
 *  two copies would drift the first time either changed. This runs at build
 *  time and the page carries the result, so there is one implementation. */
export function buildWall(data: StillsData): WallData {
  const published = data.projects
    .filter((p) => p.status === "published" && p.frames.length > 0)
    .sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));

  const projects: WallProject[] = published.map((p) => ({
    id: p.id,
    title: p.title,
    credit: p.credit,
    year: p.year,
    source: p.source,
    frameCount: p.frames.length,
  }));

  const frames: WallFrame[] = [];
  const counts = new Map<string, number>();

  published.forEach((project, p) => {
    for (const frame of project.frames) {
      // A frame carries its project's tags as well as its own: filtering the
      // wall by "3d" should find every frame of a 3d project, not only the
      // ones somebody tagged one by one.
      const tags = [
        ...new Set([...(project.tags ?? []), ...(frame.tags ?? [])]),
      ].sort();
      for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      frames.push({
        p,
        id: frame.id,
        t: frame.t,
        file: frame.file,
        ...(frame.thumb ? { thumb: frame.thumb } : {}),
        w: frame.w,
        h: frame.h,
        ...(tags.length ? { tags } : {}),
        ...(frame.origin ? { origin: frame.origin } : {}),
      });
    }
  });

  const tags = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

  return {
    version: data.version ?? 1,
    assetBase: data.assetBase ?? "/stills",
    projectCount: projects.length,
    frameCount: frames.length,
    tags,
    projects,
    frames,
  };
}

/** An empty wall, so a component that renders before its data arrives — the
 *  Studio preview, mostly — has something of the right shape. */
export const emptyWall: WallData = {
  version: 1,
  assetBase: "/stills",
  projectCount: 0,
  frameCount: 0,
  tags: [],
  projects: [],
  frames: [],
};
