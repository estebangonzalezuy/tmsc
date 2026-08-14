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

/** Legacy. The Curator used to scrub a video it could not play by walking
 *  sprite sheets of one tile per second, because the frames it wanted lived on
 *  a runner. Now the film is in the browser and the player does that job
 *  exactly, so nothing writes these any more — the field stays only so
 *  projects that already carry it still parse. `scripts/stills/prune.mjs`
 *  removes the files once nothing references them. */
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
  /** Filename inside the project's asset directory. Full size. */
  file: string;
  /** The wall-sized copy, ~400px. Falls back to `file`. */
  thumb?: string;
  /** ~900px, written since the browser extractor landed. Absent on older
   *  projects, which is why frameSrcSet builds its list from what exists. */
  mid?: string;
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
  /** Where the work itself lives — the studio's page for the film, a Behance
   *  or Vimeo project, wherever it is written up. Distinct from `source`,
   *  which is the video a frame can be checked against: one is the credit,
   *  the other is the evidence. */
  link?: string;
  /** Frame id used as the project's cover. Falls back to the first frame. */
  cover?: string;
  /** @deprecated see ScrubStrip. */
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
  mid?: string;
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
  link?: string;
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

/** Every size of a frame that exists, as a srcSet.
 *
 *  The thumb is 400px and the project grid renders cells past 500 CSS pixels,
 *  doubled again on a retina screen — asking for the thumb there is asking for
 *  a soft picture. Handing the browser the list and a `sizes` hint lets it
 *  pick, which is also the only way older projects (thumb and full, no mid)
 *  and newer ones (all three) can be served by the same markup. */
export function frameSrcSet(
  assetBase: string,
  projectId: string,
  frame: Frame | WallFrame,
): string {
  const at = (file: string, width: number) =>
    `${assetBase}/${projectId}/${file} ${width}w`;
  const rungs: string[] = [];
  if (frame.thumb) rungs.push(at(frame.thumb, Math.min(400, frame.w)));
  if (frame.mid) rungs.push(at(frame.mid, Math.min(900, frame.w)));
  rungs.push(at(frame.file, frame.w));
  return rungs.join(", ");
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

/** Whether this project can point back at anything. A project cut from a local
 *  file has no address until somebody types one in, and a link to nowhere is
 *  worse than no link. */
export function hasSource(source: StillsSource): boolean {
  return Boolean(source.url?.trim());
}

/** A link that opens the source video at the frame's moment, so a still can
 *  always be checked against the thing it came from. Empty when there is no
 *  source — callers hide the link rather than render a dead one. */
export function momentUrl(source: StillsSource, t: number): string {
  if (!hasSource(source)) return "";
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
    ...(p.link ? { link: p.link } : {}),
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
        ...(frame.mid ? { mid: frame.mid } : {}),
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

/** An even spread of `n` items, ends included. A project card showing four
 *  frames should show the film's range, not four seconds of it — consecutive
 *  frames from one shot say nothing a single frame doesn't. */
export function pickSpread<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    out.push(items[Math.round((i * (items.length - 1)) / (n - 1))]);
  }
  return out;
}

/* mulberry32 — small, fast, and the same everywhere. The shuffle has to be a
   function of a seed rather than Math.random: these pages are prerendered, so
   an order the server can't reproduce is a hydration mismatch, and an order
   that changes on every render is a wall that reshuffles under your cursor. */
function random(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: T[], seed: number): T[] {
  const next = random(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** djb2, so a seed can travel in the URL as anything typeable. */
export function hashSeed(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = (((h << 5) + h + text.charCodeAt(i)) >>> 0);
  }
  return h;
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

/* ---------- choosing which moments to keep ---------- */
//
// These lived in their own plain-JS module while the Actions extractor needed
// them too: Node cannot import TypeScript, so the only shape that fit both was
// a file with no imports. There is one extractor now, in the browser, so they
// come home.

/* Two candidates closer together than this are the same idea twice. */
export const MIN_GAP = 2.0;

export function slugify(text: string): string {
  return (
    String(text)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}

/** A spread, not a top-N. Slice the timeline into `count` buckets and take the
 *  strongest cut in each: you get the film's range instead of ten frames from
 *  its busiest ten seconds. Buckets with no cut fall back to their own
 *  midpoint, so a slow film still yields a full sheet.
 *
 *  `cuts` is [{ t, score }]. Returns timestamps in order. */
export function chooseTimes(
  cuts: { t: number; score: number }[],
  duration: number,
  count: number,
): number[] {
  const start = Math.min(0.5, duration * 0.02);
  const end = Math.max(start, duration - 0.3);
  const span = end - start;
  if (span <= 0) return [];

  const picked: number[] = [];
  for (let i = 0; i < count; i++) {
    const from = start + (span * i) / count;
    const to = start + (span * (i + 1)) / count;
    const inBucket = cuts.filter((c) => c.t >= from && c.t < to);
    if (inBucket.length) {
      inBucket.sort((a, b) => b.score - a.score);
      // A cut is the first frame of a new shot; a breath later is usually the
      // composed one, not the one caught mid-transition.
      picked.push(Math.min(inBucket[0].t + 0.35, end));
    } else {
      picked.push((from + to) / 2);
    }
  }

  const spaced: number[] = [];
  for (const t of picked.sort((a, b) => a - b)) {
    if (!spaced.length || t - spaced[spaced.length - 1] >= MIN_GAP) spaced.push(t);
  }
  return spaced;
}

/** Mean and spread of a tiny grey copy of one frame, whoever measured it.
 *  Catches the three things nobody wants on a wall: black, blown out, and a
 *  flat colour card. */
export function isWorthKeeping(
  stats: { mean: number; deviation: number } | null,
): boolean {
  if (!stats) return false;
  if (stats.mean < 10 || stats.mean > 248) return false; // black, or blown out
  return stats.deviation >= 3; // a flat card is not a style frame
}

/** Mean and standard deviation of an array of 0-255 samples. */
export function greyStats(
  values: number[],
): { mean: number; deviation: number } | null {
  if (!values.length) return null;
  let sum = 0;
  for (const v of values) sum += v;
  const mean = sum / values.length;
  let variance = 0;
  for (const v of values) variance += (v - mean) ** 2;
  return { mean, deviation: Math.sqrt(variance / values.length) };
}
