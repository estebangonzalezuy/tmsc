// the Scheduler — the shapes and the pure helpers, with no data imported.
//
// Safe to pull into a client component: it carries no JSON. The data lives in
// two files under content/posts/, and the split between them is the whole
// design:
//
//   posts.json  — what you *mean* to post. Written only by the browser
//                 (the Scheduler at /schedule, through the GitHub API).
//   log.json    — what *happened*. Written only by the runner
//                 (scripts/post-scheduler on GitHub Actions): where each post
//                 landed on each network, and the numbers it pulled back.
//
// Two writers, two files, so a commit from the page and a commit from the
// runner never touch the same line and git never has to merge them. A post's
// status is derived from both at read time rather than stored in either,
// which is what stops the two from disagreeing.

/** Where the club's data files for the Scheduler live, named once. */
export const POSTS_FILE = "content/posts/posts.json";
export const LOG_FILE = "content/posts/log.json";
/** Where a post's media is committed, under public/. */
export const MEDIA_DIR = "public/posts";

export type Network = "linkedin" | "x" | "instagram" | "substack";

export const NETWORKS: Network[] = ["linkedin", "x", "instagram", "substack"];

export type MediaKind = "image" | "gif" | "video";

export type NetworkRule = {
  label: string;
  /** Two letters for the circled mark. */
  mark: string;
  /** Hard ceiling on the text, in the network's own counting. */
  maxChars: number;
  /** How the network counts — X weights CJK and emoji at two. */
  count: (text: string) => number;
  /** Which kinds of media it takes at all. */
  media: MediaKind[];
  /** How many in one post. */
  maxMedia: number;
  /** Can it carry text alone? Instagram cannot. */
  textOnly: boolean;
  /** Ceilings per file, in bytes, so the page refuses what the API would. */
  maxBytes: Record<MediaKind, number>;
  /** One line about what the API can and cannot do, shown on the page. */
  note: string;
};

const MB = 1024 * 1024;

/* X's own rule: code points in a few low ranges count one, everything else
   (CJK, emoji) counts two, and every URL counts as 23 whatever its length. */
function xWeighted(text: string): number {
  let n = 0;
  const withoutUrls = text.replace(/https?:\/\/\S+/g, () => {
    n += 23;
    return "";
  });
  for (const ch of withoutUrls) {
    const cp = ch.codePointAt(0) ?? 0;
    const light =
      cp <= 4351 ||
      (cp >= 8192 && cp <= 8205) ||
      (cp >= 8208 && cp <= 8223) ||
      (cp >= 8242 && cp <= 8247);
    n += light ? 1 : 2;
  }
  return n;
}

const plain = (text: string) => Array.from(text).length;

export const RULES: Record<Network, NetworkRule> = {
  linkedin: {
    label: "LinkedIn",
    mark: "in",
    maxChars: 3000,
    count: plain,
    media: ["image", "gif", "video"],
    maxMedia: 20,
    textOnly: true,
    maxBytes: { image: 36 * MB, gif: 36 * MB, video: 200 * MB },
    note: "Posts as you. One video, or up to twenty images. Reactions and comments come back; impressions only in LinkedIn's own export.",
  },
  x: {
    label: "X",
    mark: "X",
    maxChars: 280,
    count: xWeighted,
    media: ["image", "gif", "video"],
    maxMedia: 4,
    textOnly: true,
    maxBytes: { image: 5 * MB, gif: 15 * MB, video: 512 * MB },
    note: "Up to four images, or one GIF, or one video under 140 seconds. Metrics need a paid API tier.",
  },
  instagram: {
    label: "Instagram",
    mark: "ig",
    maxChars: 2200,
    count: plain,
    media: ["image", "video"],
    maxMedia: 10,
    textOnly: false,
    maxBytes: { image: 8 * MB, gif: 0, video: 1024 * MB },
    note: "Needs a Business or Creator account and at least one image or video — no text-only posts, no GIFs. A single video posts as a Reel.",
  },
  substack: {
    label: "Substack Notes",
    mark: "S",
    maxChars: 4000,
    count: plain,
    media: ["image", "gif"],
    maxMedia: 4,
    textOnly: true,
    maxBytes: { image: 8 * MB, gif: 8 * MB, video: 0 },
    note: "Substack has no public API: this uses the same calls the site itself makes, signed with your session cookie. It works today and may break tomorrow.",
  },
};

/* ---------- what the page writes ---------- */

export type MediaItem = {
  /** Repo path under public/, e.g. posts/2026-09-20-ab12cd/1.jpg */
  file: string;
  kind: MediaKind;
  mime: string;
  bytes: number;
  width: number;
  height: number;
  /** Seconds, for a video or GIF. */
  seconds?: number;
  /** Instagram takes JPEG only: a PNG or WebP gets a JPEG sibling for it. */
  jpeg?: string;
  alt?: string;
};

export type Metrics = {
  /** When these were read. */
  at: string;
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
};

export type ScheduledPost = {
  id: string;
  /** The words, for every network that has no variant of its own. */
  text: string;
  /** A network's own version — X usually needs a shorter one. */
  variants?: Partial<Record<Network, string>>;
  media: MediaItem[];
  networks: Network[];
  /** ISO instant. Missing means a draft. */
  scheduledAt?: string;
  /** Numbers typed in by hand from a network's own analytics, for the ones
   *  whose API gives nothing back — LinkedIn impressions, anything on
   *  Substack. They live here rather than in the log because the page writes
   *  them, and the page only ever writes this file. */
  metrics?: Partial<Record<Network, Metrics>>;
  createdAt: string;
  updatedAt: string;
};

export type PostsData = {
  version: 1;
  /** Where the media is served from, so moving it later is one string. */
  assetBase: string;
  posts: ScheduledPost[];
};

/* ---------- what the runner writes ---------- */

export type Outcome = {
  state: "published" | "failed" | "skipped";
  /** The network's own id for it: a URN, a tweet id, a media id, a note id. */
  id?: string;
  url?: string;
  at: string;
  /** Why not, in the network's words. */
  error?: string;
};

export type LogEntry = {
  results: Partial<Record<Network, Outcome>>;
  metrics?: Partial<Record<Network, Metrics>>;
};

export type Health = {
  /** The last time the runner spoke to this network, and how it went. */
  at: string;
  ok: boolean;
  note?: string;
};

export type LogData = {
  version: 1;
  /** The last publish run, so the page can say when the runner last looked. */
  lastRun?: string;
  health?: Partial<Record<Network, Health>>;
  entries: Record<string, LogEntry>;
};

export const EMPTY_POSTS: PostsData = { version: 1, assetBase: "/posts", posts: [] };
export const EMPTY_LOG: LogData = { version: 1, entries: {} };

/* ---------- derived ---------- */

export type Status = "draft" | "scheduled" | "posting" | "published" | "partial" | "failed";

/** A post's status is read off both files, never stored. */
export function statusOf(post: ScheduledPost, log: LogData, now = Date.now()): Status {
  if (!post.scheduledAt) return "draft";
  const entry = log.entries[post.id];
  const results = entry?.results ?? {};
  const outcomes = post.networks.map((n) => results[n]);
  const done = outcomes.filter(Boolean);
  if (done.length === 0) {
    return new Date(post.scheduledAt).getTime() <= now ? "posting" : "scheduled";
  }
  const published = done.filter((o) => o?.state === "published").length;
  if (published === post.networks.length) return "published";
  if (done.length < post.networks.length) return "partial";
  return published > 0 ? "partial" : "failed";
}

export const STATUS_LABEL: Record<Status, string> = {
  draft: "draft",
  scheduled: "scheduled",
  posting: "due",
  published: "posted",
  partial: "partly posted",
  failed: "failed",
};

/** The words a network will actually get. */
export function textFor(post: Pick<ScheduledPost, "text" | "variants">, network: Network): string {
  return post.variants?.[network] ?? post.text;
}

/** Everything wrong with a post for one network, in plain words. Empty
 *  means it will go. The runner checks the same things again, but the page
 *  saying it first is the difference between a fix and a failure. */
export function problemsFor(post: ScheduledPost, network: Network): string[] {
  const rule = RULES[network];
  const out: string[] = [];
  const text = textFor(post, network);
  const n = rule.count(text);
  if (n > rule.maxChars) out.push(`${n} of ${rule.maxChars} characters`);
  const usable = post.media.filter((m) => rule.media.includes(m.kind));
  if (!text.trim() && usable.length === 0) out.push("nothing to post");
  if (!rule.textOnly && usable.length === 0) out.push("needs an image or a video");
  const dropped = post.media.length - usable.length;
  if (dropped > 0) {
    out.push(
      `${dropped} ${dropped === 1 ? "file" : "files"} of a kind ${rule.label} does not take`,
    );
  }
  if (usable.length > rule.maxMedia) out.push(`${usable.length} files, takes ${rule.maxMedia}`);
  const videos = usable.filter((m) => m.kind === "video");
  if (videos.length > 1 && network !== "instagram") out.push("more than one video");
  if (videos.length && usable.length > videos.length && network !== "instagram") {
    out.push("a video and images together");
  }
  for (const m of usable) {
    if (m.bytes > rule.maxBytes[m.kind]) {
      out.push(`${m.file.split("/").pop()} is over ${Math.round(rule.maxBytes[m.kind] / MB)} MB`);
    }
  }
  if (network === "x") {
    for (const m of videos) {
      if ((m.seconds ?? 0) > 140) out.push("video over 140 seconds");
    }
  }
  return out;
}

/* ---------- ids and dates ---------- */

/** A post's id doubles as its media folder: the day it was made plus a
 *  short random tail, so the folder sorts by date on disk. */
export function newPostId(now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  const tail = Math.random().toString(36).slice(2, 8);
  return `${day}-${tail}`;
}

/** Monday 00:00 local of the week holding `d`. */
export function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - day);
  return out;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** For a datetime-local input: the local wall clock, no zone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export const METRIC_KEYS = [
  "impressions",
  "reach",
  "likes",
  "comments",
  "shares",
  "saves",
  "clicks",
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

/** What the page shows for one post on one network: what the runner pulled,
 *  with anything typed in by hand laid over it. A hand-typed number wins
 *  because it came from the network's own analytics page, which knows more
 *  than its API will say. */
export function metricsFor(
  post: ScheduledPost,
  log: LogData,
  network: Network,
): Metrics | undefined {
  const pulled = log.entries[post.id]?.metrics?.[network];
  const manual = post.metrics?.[network];
  if (!pulled && !manual) return undefined;
  const out: Metrics = { ...(pulled ?? { at: "" }) };
  if (manual) {
    for (const key of METRIC_KEYS) {
      if (typeof manual[key] === "number") out[key] = manual[key];
    }
    if (manual.at > out.at) out.at = manual.at;
  }
  return out;
}

/** Sum every network's numbers for one post, for the overview. */
export function sumMetrics(metrics: Partial<Record<Network, Metrics>> | undefined): Metrics {
  const total: Metrics = { at: "" };
  if (!metrics) return total;
  for (const m of Object.values(metrics)) {
    if (!m) continue;
    for (const key of METRIC_KEYS) {
      if (typeof m[key] === "number") total[key] = (total[key] ?? 0) + m[key];
    }
    if (m.at > total.at) total.at = m.at;
  }
  return total;
}

/** Where a committed file is served from — `posts/<id>/1.jpg` under public/
 *  becomes `<assetBase>/<id>/1.jpg`. Everything that shows a post's media
 *  goes through here, so moving the files off the repo later is the one
 *  `assetBase` string. */
export function mediaSrc(assetBase: string, file: string): string {
  return `${assetBase}/${file.replace(/^posts\//, "")}`;
}
