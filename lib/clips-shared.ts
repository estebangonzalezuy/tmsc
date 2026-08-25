// the Clips — the shapes and the pure helpers, with no data imported.
//
// Safe to pull into a client component: it carries no JSON, so the wall can
// import the facet vocabulary without dragging every clip of every project
// into the browser bundle. The data lives next door in lib/clips.ts, which
// holds clips.json and is for server components only.
//
// **What a clip is.** The Stills answers "what does good look like?" as
// composition, palette and type. It cannot answer "how do you animate this?",
// because a frame has no easing in it — and easing is the whole content of a
// logo reveal or a UI micro-interaction. So the Clips keeps the same road (drop
// a film you have, cut pieces out of it in the browser, commit only the pieces)
// and changes the unit: a fragment of seconds instead of a moment.
//
// **A clip is committed as a filmstrip, not a video.** One WebP with the clip's
// frames tiled in a grid, and the wall draws one cell of it into a canvas on a
// shared ticker. That buys three things a .webm would not: dozens animate at
// once with no decoders and no autoplay policy, it loops by construction, and
// it frame-steps — which is how a stagger is actually read, and the one thing
// an embed of the source can never give you. It costs fidelity and it costs
// bytes (WebP has no inter-frame prediction, so every frame is intra-coded);
// both are the deliberate price. Full-resolution playback is the source's job,
// and momentUrl is how a clip hands you back to it.

import {
  hashSeed,
  hasSource,
  momentUrl,
  seededShuffle,
  slugify,
  timecode,
  type SourceRef,
} from "@/lib/stills-shared";

/* These are the club's wall helpers, and the Stills is simply where they were
   written first. Re-exported rather than copied: a second implementation of
   `timecode` or of the seeded shuffle is how two walls start disagreeing. */
export { hashSeed, hasSource, momentUrl, seededShuffle, slugify, timecode };
export type { SourceRef };

/** Where the club's data file for the Clips lives, named once. */
export const CLIPS_FILE = "content/clips/clips.json";

/* ---------- the filmstrip ---------- */

/** Columns in a sheet. Six, so a sheet is never worse than 6×6 and never
 *  approaches a canvas size limit at the tile sizes below. */
export const SHEET_COLS = 6;
/** The most frames a clip keeps. Past this it is a video, not a reference. */
export const MAX_FRAMES = 36;
/** The fewest, or the strip stops reading as motion at all. */
export const MIN_FRAMES = 12;
/** Long edge of one tile in the sheet. */
export const TILE_EDGE = 400;
/** How long a clip is allowed to be. Under the floor there is nothing to see;
 *  past the ceiling you are quoting the film rather than citing it. */
export const MIN_SECONDS = 0.4;
export const MAX_SECONDS = 6;

/* ---------- the second asset ---------- */

/**
 * The sheet has a ceiling, and it is not a matter of taste.
 *
 * A filmstrip holds `frames` pictures side by side, so its canvas grows with
 * the square of the tile: 36 frames at a 400px tile is 3.3 megapixels, at 800px
 * it is 13, and at 1920px it would be 75 — past what iOS will allocate for a
 * canvas at all. So a sheet can never carry a clip at the size you want to
 * *look* at one, however many bytes you are willing to spend.
 *
 * A codec has the thing a sheet structurally cannot: inter-frame prediction.
 * Consecutive frames of a film are nearly identical and a video stores only the
 * difference, where WebP has to intra-code all thirty-six.
 *
 * So a clip gets both, each where its strengths are. The **sheet** is what the
 * wall loads: dozens animate at once with no decoders, no autoplay policy and
 * no codec branch. The **video** is fetched only when somebody opens a clip,
 * and is what they actually watch.
 */
export const VIDEO_EDGE = 1280;
/** Enough for a reference at VIDEO_EDGE without shipping a master. */
export const VIDEO_BITRATE = 2_000_000;

/**
 * How finely to sample a clip of this length.
 *
 * A UI snap is *all* easing and needs the frames; a six-second establishing
 * shot is not, and spending the same budget on it buys blur. So the rate falls
 * as the clip gets longer and the total is capped either way — which is also
 * what keeps a sheet inside SHEET_COLS × SHEET_COLS.
 */
export function frameCount(seconds: number): number {
  const fps = seconds <= 1.5 ? 30 : seconds <= 3 ? 18 : 12;
  return Math.max(MIN_FRAMES, Math.min(MAX_FRAMES, Math.round(seconds * fps)));
}

/** The clip id for a range. Milliseconds, zero padded, so ids sort in timeline
 *  order as strings and re-cutting the same range can never duplicate one. */
export function clipId(inT: number, outT: number): string {
  const ms = (t: number) => String(Math.round(t * 1000)).padStart(8, "0");
  return `c${ms(inT)}-${ms(outT)}`;
}

/* ---------- the facets ---------- */

/**
 * The vocabulary, closed on purpose.
 *
 * A free tag list drifts — "ui", "UI" and "interface" become three tags and the
 * library stops being answerable. These are three axes because a motion
 * reference is asked three different questions: what am I looking at, what is
 * the mechanism, and how does it land. Adding a term is a deliberate edit here,
 * the way adding a Directory collection is.
 *
 * Values OR *within* an axis and AND *across* them, which is the query somebody
 * actually has: "ui or transition, and staggered". The Stills ANDs one flat tag
 * list, and doing that here would make two subjects return nothing.
 */
export const FACETS = [
  {
    key: "subject",
    label: "What it is",
    values: [
      "logo",
      "product",
      "ui",
      "type",
      "packaging",
      "endcard",
      "transition",
      "texture",
      "data",
      "camera",
      "environment",
    ],
  },
  {
    key: "technique",
    label: "How it moves",
    values: [
      "stagger",
      "mask",
      "morph",
      "spring",
      "particle",
      "distort",
      "offset",
      "trim-path",
      "cutout",
      "blur",
      "3d",
      "loop",
    ],
  },
  {
    key: "feel",
    label: "How it lands",
    values: [
      "snap",
      "overshoot",
      "ease-out",
      "linear",
      "elastic",
      "drift",
    ],
  },
] as const;

export type FacetKey = (typeof FACETS)[number]["key"];

/**
 * Who is doing the presenting, by stage.
 *
 * The fourth rail, and the one nothing else in this field has. A designer
 * asking "how does a Series A present itself" is asking a question about
 * *budget and ambition*, not about aesthetics — and the answer is genuinely
 * different at seed than at IPO. Filing it makes the library answerable by a
 * business decision rather than only by taste.
 *
 * It belongs to the **project**, not the clip: every clip cut from one launch
 * film shares the company that made it. Putting it on the clip would duplicate
 * the fact twelve times and ask the Cutter to stamp it twelve times.
 *
 * Optional on purpose. A studio's own reel is not a company presenting itself,
 * and Apple has no "series" — `studio` and `public` are the honest escapes, and
 * a project with no stage at all simply stays out of the rail.
 */
export const STAGES = [
  "bootstrapped",
  "seed",
  "series-a",
  "series-b",
  "series-c",
  "public",
  "studio",
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL = "Who is presenting";

/** "series-a" is how it is filed; "Series A" is how it is read. The stored
 *  value stays the slug, because it travels in the URL. */
export function stageName(value: string): string {
  return value.startsWith("series-")
    ? `Series ${value.slice(7).toUpperCase()}`
    : value.charAt(0).toUpperCase() + value.slice(1);
}

/** Only a stage the vocabulary knows, so a hand-edited file can never put an
 *  unknown chip on the rail. */
export function cleanStage(value: string | undefined): Stage | undefined {
  const held = value?.trim().toLowerCase();
  return STAGES.find((s) => s === held);
}

export const FACET_KEYS = FACETS.map((f) => f.key) as FacetKey[];

/** Only values the vocabulary knows, deduped, in the vocabulary's own order —
 *  so a hand-edited file or an old record can never put an unknown chip on the
 *  wall, and two clips with the same facets always list them the same way. */
export function cleanFacet(key: FacetKey, values: string[] | undefined): string[] {
  const known = FACETS.find((f) => f.key === key)!.values as readonly string[];
  const held = new Set((values ?? []).map((v) => v.trim().toLowerCase()));
  return known.filter((v) => held.has(v));
}

/* ---------- the record ---------- */

export type Clip = {
  /** Derived from the range, so the same seconds are always the same clip. */
  id: string;
  /** Seconds into the source video. */
  in: number;
  out: number;
  /** Filename inside the project's asset directory: the sheet, then one frame
   *  of it on its own for the wall's first paint and for anything with no
   *  canvas at all. */
  file: string;
  poster: string;
  /** The full-size version, fetched only when a clip is opened. Absent on
   *  clips cut before there was one, and on any browser whose MediaRecorder
   *  refused — the lightbox falls back to the sheet, which is why this could
   *  be added without a migration. */
  video?: string;
  /** How many seconds of the recording are actually the clip.
   *
   *  Not the same as the file's own duration, and that difference was a bug:
   *  MediaRecorder timestamps by the wall clock, and the last frame needs a
   *  moment of its own or the muxer drops it — so a file always runs a little
   *  past its content. Indexing frames against `duration` therefore landed
   *  late, and the video showed a moment two frames ahead of the sheet's.
   *  Measured at the cut and written down, because it is the one number a
   *  player cannot work out for itself. */
  videoSeconds?: number;
  cols: number;
  rows: number;
  frames: number;
  /** One cell of the sheet, which is also the clip's own size — the sheet is
   *  cut at the size the wall shows it, so there is one number rather than two
   *  that have to agree. */
  w: number;
  h: number;
  subject: string[];
  technique: string[];
  feel?: string[];
  /** The overflow, for what the vocabulary hasn't caught yet. */
  tags?: string[];
  /** What to notice. The field that makes this a library rather than a mood
   *  board: "three-frame stagger, only the last item overshoots". */
  note?: string;
  /** "auto" for a shot the scan proposed, "hand" for a range set with I and O.
   *  Kept so the wall can say how much of it is judgement. */
  origin?: "auto" | "hand";
};

export type ClipProject = {
  id: string;
  title: string;
  credit: string;
  year: string;
  note?: string;
  /** Drafts are cut but not curated — they stay off the public wall. */
  status: "draft" | "published";
  addedAt: string;
  source: SourceRef;
  /** Source video length in seconds. */
  duration: number;
  /** Where the work itself lives, as distinct from `source`, which is the video
   *  a clip can be checked against: one is the credit, the other the evidence. */
  link?: string;
  /** The brand being presented, when it isn't the studio's own reel. Distinct
   *  from `credit`, which is who made the film: Linear is the brand, the studio
   *  that cut it is the credit, and a library about presentation needs both. */
  brand?: string;
  /** See STAGES. Absent means this isn't a company presenting itself. */
  stage?: Stage;
  /** Clip id used as the project's cover. Falls back to the first. */
  cover?: string;
  clips: Clip[];
};

export type ClipsData = {
  version: number;
  /** Prefix every asset path gets. Everything the site renders goes through
   *  sheetSrc, so moving the sheets off the repo later is this one string —
   *  which matters more here than it does for the Stills, because a sheet is
   *  the heaviest thing the club commits. */
  assetBase: string;
  projects: ClipProject[];
};

/* ---------- the wall index ---------- */

/** A clip on the wall, flattened and shortened: `p` indexes into
 *  ClipWall.projects so a project's title isn't repeated a dozen times. */
export type WallClip = {
  p: number;
  id: string;
  in: number;
  out: number;
  file: string;
  poster: string;
  video?: string;
  videoSeconds?: number;
  cols: number;
  rows: number;
  frames: number;
  w: number;
  h: number;
  subject: string[];
  technique: string[];
  feel?: string[];
  tags?: string[];
  note?: string;
  origin?: "auto" | "hand";
};

export type WallClipProject = {
  id: string;
  title: string;
  credit: string;
  year: string;
  source: SourceRef;
  link?: string;
  brand?: string;
  stage?: Stage;
  clipCount: number;
};

export type FacetCount = { value: string; count: number };

export type ClipWall = {
  version: number;
  assetBase: string;
  projectCount: number;
  clipCount: number;
  /** Counts per axis, in the vocabulary's order, values with none left out. */
  facets: { key: FacetKey; label: string; values: FacetCount[] }[];
  /** The same shape for the stage rail, counted in clips rather than projects —
   *  the wall filters clips, so the number under a chip has to say how many
   *  clips it will leave. */
  stages: FacetCount[];
  tags: FacetCount[];
  projects: WallClipProject[];
  clips: WallClip[];
};

/* ---------- pure helpers ---------- */

/** Path to one of a clip's files. Everything that draws or plays a clip goes
 *  through here, so moving the assets off the repo is a change to `assetBase`
 *  alone — which matters most for the video, the heaviest of the three.
 *
 *  Returns "" for a video that was never written, so a caller can ask for one
 *  and fall back rather than having to check the field first. */
export function sheetSrc(
  assetBase: string,
  projectId: string,
  clip: { file: string; poster: string; video?: string },
  which: "sheet" | "poster" | "video" = "sheet",
): string {
  const name =
    which === "poster" ? clip.poster : which === "video" ? clip.video : clip.file;
  return name ? `${assetBase}/${projectId}/${name}` : "";
}

/** How long a clip runs. Its own duration, which is also its loop. */
export const clipSeconds = (clip: { in: number; out: number }): number =>
  Math.max(0.001, clip.out - clip.in);

/**
 * Which frame of a sheet is showing at `ms` on the wall clock.
 *
 * A clip loops in its own duration, so a grid of them breathes at different
 * rates off one shared ticker rather than marching in step. Whole frames
 * modulo the count, so the last runs into the first with no seam — the same
 * contract every travelling number in the club's studios keeps.
 */
export function frameAt(ms: number, seconds: number, frames: number): number {
  const p = (ms / 1000 / seconds) % 1;
  return Math.floor(((p % 1) + 1) % 1 * frames) % frames;
}

/** Where one frame sits in the sheet, in the sheet's own pixels. */
export function cellAt(
  clip: { cols: number; w: number; h: number },
  index: number,
): { x: number; y: number } {
  return {
    x: (index % clip.cols) * clip.w,
    y: Math.floor(index / clip.cols) * clip.h,
  };
}

/** m:ss.t — a clip is short enough that the tenth is the interesting digit,
 *  which is exactly the difference `timecode` throws away. */
export function clipcode(t: number): string {
  const total = Math.max(0, t);
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
}

export function coverClip(project: ClipProject): Clip | undefined {
  return project.clips.find((c) => c.id === project.cover) ?? project.clips[0];
}

/* ---------- deriving the wall ---------- */

/** clips.json flattened into what the wall renders: every clip, the project
 *  named once instead of a dozen times, and the per-axis counts.
 *
 *  Derived rather than stored, for the reason the Stills gives: a generated
 *  wall.json would have to be written by the Cutter in the browser and again
 *  at build time, and the two copies would drift the first time either
 *  changed. This runs at build time and the page carries the result. */
export function buildClipWall(data: ClipsData): ClipWall {
  const published = data.projects
    .filter((p) => p.status === "published" && p.clips.length > 0)
    .sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));

  const projects: WallClipProject[] = published.map((p) => ({
    id: p.id,
    title: p.title,
    credit: p.credit,
    year: p.year,
    source: p.source,
    ...(p.link ? { link: p.link } : {}),
    ...(p.brand ? { brand: p.brand } : {}),
    ...(cleanStage(p.stage) ? { stage: cleanStage(p.stage) } : {}),
    clipCount: p.clips.length,
  }));

  const clips: WallClip[] = [];
  const counts = new Map<string, Map<string, number>>(
    FACET_KEYS.map((k) => [k, new Map<string, number>()]),
  );
  const tagCounts = new Map<string, number>();
  /* Counted in clips, not projects: the wall filters clips, so the number under
     a chip has to say how many clips pressing it will leave. */
  const stageCounts = new Map<string, number>();

  published.forEach((project, p) => {
    for (const clip of project.clips) {
      clips.push({
        p,
        id: clip.id,
        in: clip.in,
        out: clip.out,
        file: clip.file,
        poster: clip.poster,
        ...(clip.video ? { video: clip.video } : {}),
        ...(clip.videoSeconds ? { videoSeconds: clip.videoSeconds } : {}),
        cols: clip.cols,
        rows: clip.rows,
        frames: clip.frames,
        w: clip.w,
        h: clip.h,
        subject: clip.subject,
        technique: clip.technique,
        ...(clip.feel?.length ? { feel: clip.feel } : {}),
        ...(clip.tags?.length ? { tags: clip.tags } : {}),
        ...(clip.note ? { note: clip.note } : {}),
        ...(clip.origin ? { origin: clip.origin } : {}),
      });
      for (const key of FACET_KEYS) {
        const bucket = counts.get(key)!;
        for (const value of (clip[key] ?? []) as string[]) {
          bucket.set(value, (bucket.get(value) ?? 0) + 1);
        }
      }
      for (const tag of clip.tags ?? []) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
      const stage = cleanStage(project.stage);
      if (stage) stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
    }
  });

  return {
    version: data.version,
    assetBase: data.assetBase,
    projectCount: projects.length,
    clipCount: clips.length,
    /* In the vocabulary's order, not by count: the rail is a vocabulary you
       learn the shape of, and one that reorders itself as clips land is one
       you have to re-read every visit. */
    facets: FACETS.map((facet) => ({
      key: facet.key,
      label: facet.label,
      values: facet.values
        .map((value) => ({ value, count: counts.get(facet.key)!.get(value) ?? 0 }))
        .filter((v) => v.count > 0),
    })),
    /* In the vocabulary's order — seed before series A before public — because
       the rail is a progression and sorting it by volume would scramble it. */
    stages: STAGES.map((value) => ({ value, count: stageCounts.get(value) ?? 0 }))
      .filter((s) => s.count > 0),
    tags: [...tagCounts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    projects,
    clips,
  };
}

/** An empty wall, so a component that renders before its data arrives — the
 *  Studio preview, mostly — has something of the right shape. */
export const emptyClipWall: ClipWall = {
  version: 1,
  assetBase: "/clips",
  projectCount: 0,
  clipCount: 0,
  facets: [],
  stages: [],
  tags: [],
  projects: [],
  clips: [],
};

/* ---------- choosing which shots to propose ---------- */

/**
 * The gaps between the cuts, read as shots.
 *
 * findCuts scores every step by how much the picture changed; the Stills reads
 * its peaks as moments worth a frame. A clip wants the *span* between two
 * peaks, which is the same measurement asked a different question — so this
 * takes the same input and hands back ranges.
 *
 * **A cut is a spike, not a high number.** The first version of this called
 * every sample over a fixed threshold a cut, and that quietly threw away
 * exactly the shots this library exists for: a breathing gradient, a whip pan,
 * a big camera move — anything where the whole frame changes continuously —
 * scores high on *every* sample, gets shredded into sub-minimum fragments, and
 * vanishes from the suggestions. A hard cut is one sample far above its
 * neighbours; a moving shot is a plateau. So the bar is raised by the film's
 * own typical change, and a sample has to beat what is on either side of it.
 *
 * A shot is trimmed at both ends: the first moments of one are usually still
 * the transition out of the last, and the final moments are the transition into
 * the next. A shot longer than the ceiling is cut to its opening seconds, where
 * the movement in it almost always is.
 */
export function chooseShots(
  cuts: { t: number; score: number }[],
  duration: number,
  count: number,
  /* The floor, on the same 0-1 scale ffmpeg's scene score uses. A film busier
     than this raises its own bar; a still one can't lower it. */
  threshold = 0.08,
): { in: number; out: number }[] {
  const marks = [0, ...cutTimes(cuts, threshold), duration];
  const shots: { in: number; out: number; span: number }[] = [];

  for (let i = 0; i < marks.length - 1; i++) {
    /* A breath past the cut, and a breath short of the next one. */
    const from = marks[i] + 0.35;
    const to = Math.max(from, marks[i + 1] - 0.15);
    if (to - from < MIN_SECONDS) continue;
    const end = Math.min(to, from + MAX_SECONDS);
    shots.push({ in: from, out: end, span: to - from });
  }

  /* The longest shots first — a long shot is a shot with something happening in
     it far more often than a two-frame flash is — then back into timeline
     order, so the panel reads as the film does. */
  return shots
    .sort((a, b) => b.span - a.span)
    .slice(0, count)
    .sort((a, b) => a.in - b.in)
    .map(({ in: i, out }) => ({
      in: Number(i.toFixed(3)),
      out: Number(out.toFixed(3)),
    }));
}

/** Which moments are shot boundaries: a local peak, well above what this film
 *  changes by from one step to the next. */
function cutTimes(
  cuts: { t: number; score: number }[],
  threshold: number,
): number[] {
  if (cuts.length < 3) return cuts.filter((c) => c.score >= threshold).map((c) => c.t);

  /* The median, not the mean: on a film that is mostly hard cuts the cuts
     themselves would drag a mean up and hide each other. */
  const sorted = [...cuts].map((c) => c.score).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const bar = Math.max(threshold, median * 2.2);

  const peaks: { t: number; score: number }[] = [];
  for (let i = 0; i < cuts.length; i++) {
    const { t, score } = cuts[i];
    if (score < bar) continue;
    // Strictly above what came before and at least as big as what follows, so a
    // plateau contributes its edge once rather than every sample along it.
    const before = cuts[i - 1]?.score ?? 0;
    const after = cuts[i + 1]?.score ?? 0;
    if (score > before && score >= after) peaks.push({ t, score });
  }

  /* Two peaks closer together than a clip can be are one boundary seen twice —
     a cross-dissolve, mostly. Keep the stronger. */
  const kept: { t: number; score: number }[] = [];
  for (const peak of peaks) {
    const last = kept[kept.length - 1];
    if (last && peak.t - last.t < MIN_SECONDS + 0.5) {
      if (peak.score > last.score) kept[kept.length - 1] = peak;
      continue;
    }
    kept.push(peak);
  }
  return kept.map((c) => c.t);
}
