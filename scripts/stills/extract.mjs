#!/usr/bin/env node
// the Stills — the extractor.
//
// Takes a video URL, produces style frames. Two passes, because picking
// frames out of somebody else's video is two different jobs:
//
//   1. Suggest.  No --times given. Downloads the video, runs scene detection
//      over a downscaled copy, throws away the black and the flat, and keeps
//      a spread of candidates across the timeline. Also builds the scrub
//      sheets: one 160px tile per second, tiled ten by ten, which is how the
//      Curator lets you scrub a video the browser is never allowed to touch.
//
//   2. Extract.  --times 12.4,88.1 — pulls exactly those moments at full
//      size and merges them into the project. This is the second half of the
//      loop: you scrub, you mark, you run this, the frames appear.
//
// Both passes write into public/stills/<project-id>/ and merge the result
// into content/stills/projects.json. Frames are keyed by timestamp, so running
// either pass twice can never duplicate one. What the public wall shows is
// derived from that file at build time — nothing else to regenerate.
//
//   node scripts/stills/extract.mjs --url https://youtu.be/xxxx
//   node scripts/stills/extract.mjs --url https://youtu.be/xxxx --times 12.4,88.1
//
// Needs yt-dlp and ffmpeg on PATH. Neither is a repo dependency and neither
// ever runs on Vercel — this is a GitHub Actions job
// (.github/workflows/stills.yml), started from the Curator.

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROJECTS = path.join(root, "content/stills/projects.json");
const ASSETS = path.join(root, "public/stills");

/* How many suggestions a first pass aims for. Enough to see the film's range,
   few enough to judge in one screenful. */
const DEFAULT_COUNT = 18;
/* Two candidates closer together than this are the same idea twice. */
const MIN_GAP = 2.0;
/* Long edge of a published still. 1600 is generous on a wall and still small
   enough that a project costs a couple of megabytes. */
const FULL_WIDTH = 1600;
const THUMB_WIDTH = 400;
/* The scrubber's tiles. 160px wide, 100 to a sheet — a five minute video is
   three sheets of about 150KB. */
const SCRUB_WIDTH = 160;
const SCRUB_COLS = 10;
const SCRUB_ROWS = 10;

/* ---------- shelling out ---------- */

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) =>
      reject(
        new Error(
          err.code === "ENOENT"
            ? `${cmd} is not installed — the extractor needs yt-dlp and ffmpeg on PATH.`
            : err.message,
        ),
      ),
    );
    child.on("close", (code) => {
      if (code === 0 || opts.tolerant) resolve({ stdout, stderr, code });
      else reject(new Error(`${cmd} exited ${code}\n${stderr.slice(-2000)}`));
    });
  });
}

/** Raw bytes on stdout — used to read a frame's pixels straight out of ffmpeg. */
function runBinary(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "ignore"] });
    const chunks = [];
    child.stdout.on("data", (d) => chunks.push(d));
    child.on("error", reject);
    child.on("close", () => resolve(Buffer.concat(chunks)));
  });
}

/* ---------- the source video ---------- */

export function slugify(text) {
  return (
    text
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}

export function platformOf(extractor, url) {
  const key = `${extractor} ${url}`.toLowerCase();
  if (key.includes("youtube") || key.includes("youtu.be")) return "youtube";
  if (key.includes("vimeo")) return "vimeo";
  return "other";
}

/** yt-dlp's own metadata, before anything is downloaded. Cheap, and it names
 *  the project: the uploader becomes the credit, the title becomes the title. */
async function probeSource(url, cookies) {
  const { stdout } = await run("yt-dlp", [
    "--no-warnings",
    "--no-playlist",
    ...(cookies ? ["--cookies", cookies] : []),
    "-J",
    url,
  ]);
  const info = JSON.parse(stdout);
  return {
    id: info.id ?? "",
    title: info.title ?? "",
    author: info.uploader ?? info.channel ?? "",
    duration: Number(info.duration) || 0,
    extractor: info.extractor_key ?? info.extractor ?? "",
    year: String(info.upload_date ?? "").slice(0, 4),
  };
}

async function download(url, dir, cookies) {
  // Video only, no audio: nothing here listens. It halves the download and
  // skips yt-dlp's merge step entirely.
  await run("yt-dlp", [
    "--no-warnings",
    "--no-playlist",
    ...(cookies ? ["--cookies", cookies] : []),
    "-f",
    "bv*[height<=?1080]/b[height<=?1080]/bv*/b",
    "-o",
    path.join(dir, "source.%(ext)s"),
    url,
  ]);
  const found = (await readdir(dir)).find((f) => f.startsWith("source."));
  if (!found) throw new Error("yt-dlp finished but produced no file.");
  return path.join(dir, found);
}

async function probeVideo(file) {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    file,
  ]);
  const info = JSON.parse(stdout);
  const stream = info.streams?.[0] ?? {};
  return {
    width: Number(stream.width) || 1920,
    height: Number(stream.height) || 1080,
    duration: Number(info.format?.duration) || 0,
  };
}

/** WebP is a third smaller than JPEG at the same quality, which matters when
 *  the images live in the repo — but not every ffmpeg build has libwebp, and
 *  a missing encoder should cost quality, not the run. */
async function pickFormat() {
  const { stdout, code } = await run("ffmpeg", ["-hide_banner", "-encoders"], {
    tolerant: true,
  });
  return code === 0 && stdout.includes("libwebp")
    ? { ext: "webp", args: ["-c:v", "libwebp", "-quality", "82"] }
    : { ext: "jpg", args: ["-q:v", "3"] };
}

/* ---------- choosing the moments ---------- */

/** metadata=print emits a frame line and then its score on the next line:
 *    frame:12  pts:41000  pts_time:41.0
 *    lavfi.scene_score=0.412
 *  Pair them as they come rather than zipping two lists, so a truncated tail
 *  costs one candidate instead of shifting every score by one. */
export function parseSceneCuts(output) {
  const cuts = [];
  for (const line of output.split("\n")) {
    const time = line.match(/pts_time:([0-9.]+)/);
    if (time) {
      const t = Number(time[1]);
      if (Number.isFinite(t)) cuts.push({ t, score: 1 });
      continue;
    }
    const score = line.match(/lavfi\.scene_score=([0-9.]+)/);
    if (score && cuts.length) {
      const value = Number(score[1]);
      if (Number.isFinite(value)) cuts[cuts.length - 1].score = value;
    }
  }
  return cuts;
}

/** Scene cuts, as ffmpeg sees them. Runs on a 320px copy: the scores are the
 *  same shape and the pass is several times faster than decoding full size. */
async function sceneCuts(file, threshold) {
  const { stdout, stderr } = await run("ffmpeg", [
    "-hide_banner",
    "-i",
    file,
    "-vf",
    `scale=320:-2,select='gt(scene,${threshold})',metadata=print:file=-`,
    "-an",
    "-sn",
    "-f",
    "null",
    "-",
  ]);
  return parseSceneCuts(`${stdout}\n${stderr}`);
}

/** A spread, not a top-N. Slice the timeline into `count` buckets and take
 *  the strongest cut in each: you get the film's range instead of ten frames
 *  from its busiest ten seconds. Buckets with no cut fall back to their own
 *  midpoint, so a slow film still yields a full sheet. */
export function chooseTimes(cuts, duration, count) {
  const start = Math.min(0.5, duration * 0.02);
  const end = Math.max(start, duration - 0.3);
  const span = end - start;
  if (span <= 0) return [];

  const picked = [];
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

  const spaced = [];
  for (const t of picked.sort((a, b) => a - b)) {
    if (!spaced.length || t - spaced[spaced.length - 1] >= MIN_GAP) spaced.push(t);
  }
  return spaced;
}

/** Mean and spread of an 8x8 grey thumbnail of one frame. Cheap enough to run
 *  on every candidate, and it catches the three things nobody wants on a
 *  wall: black, blown out, and a flat colour card. */
async function frameStats(file, t) {
  const buf = await runBinary("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    String(t),
    "-i",
    file,
    "-frames:v",
    "1",
    "-vf",
    "scale=8:8",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "gray",
    "-",
  ]);
  if (!buf.length) return null;
  const values = [...buf];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean, deviation: Math.sqrt(variance) };
}

export function isWorthKeeping(stats) {
  if (!stats) return false;
  if (stats.mean < 10 || stats.mean > 248) return false; // black, or blown out
  return stats.deviation >= 3; // a flat card is not a style frame
}

/* ---------- writing the images ---------- */

async function grabFrame(video, t, dir, format) {
  const id = frameId(t);
  const full = `${id}.${format.ext}`;
  const thumb = `${id}.thumb.${format.ext}`;
  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(t),
    "-i",
    video,
    "-frames:v",
    "1",
    "-vf",
    `scale='min(${FULL_WIDTH},iw)':-2:flags=lanczos`,
    ...format.args,
    path.join(dir, full),
    "-frames:v",
    "1",
    "-vf",
    `scale='min(${THUMB_WIDTH},iw)':-2:flags=lanczos`,
    ...format.args,
    path.join(dir, thumb),
  ]);
  return { id, full, thumb };
}

/** Mirrors frameId in lib/stills-shared.ts — the site and the extractor have
 *  to agree on what a moment is called. */
export function frameId(t) {
  return `t${String(Math.round(t * 1000)).padStart(8, "0")}`;
}

async function buildScrub(video, dir, duration, width, height) {
  const tileW = SCRUB_WIDTH;
  const tileH = Math.round((SCRUB_WIDTH * height) / width / 2) * 2;
  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    video,
    "-vf",
    `fps=1,scale=${tileW}:${tileH},tile=${SCRUB_COLS}x${SCRUB_ROWS}`,
    "-q:v",
    "6",
    "-fps_mode",
    "passthrough",
    path.join(dir, "scrub-%03d.jpg"),
  ]);
  const files = (await readdir(dir)).filter((f) => f.startsWith("scrub-")).sort();
  return {
    files,
    cols: SCRUB_COLS,
    rows: SCRUB_ROWS,
    tileW,
    tileH,
    fps: 1,
    count: Math.ceil(duration),
  };
}

/* ---------- the project file ---------- */

async function readProjects() {
  if (!existsSync(PROJECTS)) {
    return { version: 1, assetBase: "/stills", projects: [] };
  }
  return JSON.parse(await readFile(PROJECTS, "utf8"));
}

async function writeProjects(data) {
  await writeFile(PROJECTS, JSON.stringify(data, null, 2) + "\n");
}

/* ---------- arguments ---------- */

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) args[key.slice(2)] = true;
    else {
      args[key.slice(2)] = next;
      i++;
    }
  }
  return args;
}

/* ---------- the run ---------- */

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url;
  if (!url || url === true) {
    console.error(
      "usage: node scripts/stills/extract.mjs --url <video url> [--id slug] [--times 12.4,88.1] [--count 18] [--threshold 0.28]",
    );
    process.exit(1);
  }

  const count = Number(args.count) || DEFAULT_COUNT;
  const threshold = Number(args.threshold) || 0.28;
  const times =
    typeof args.times === "string"
      ? args.times
          .split(",")
          .map((t) => Number(t.trim()))
          .filter((t) => Number.isFinite(t) && t >= 0)
      : null;

  // YouTube turns away datacentre addresses often enough that a run from
  // Actions needs a signed-in cookie jar to be reliable. Optional: without it
  // most videos still come down, and the ones that don't fail loudly.
  let cookies = null;
  const work = await mkdtemp(path.join(tmpdir(), "stills-"));
  try {
    if (process.env.YTDLP_COOKIES) {
      cookies = path.join(work, "cookies.txt");
      await writeFile(
        cookies,
        Buffer.from(process.env.YTDLP_COOKIES, "base64").toString("utf8"),
      );
    }

    console.log(`Reading ${url}`);
    const info = await probeSource(url, cookies);
    const id =
      typeof args.id === "string" && args.id
        ? slugify(args.id)
        : slugify(info.title || `${info.extractor}-${info.id}`);

    const data = await readProjects();
    let project = data.projects.find((p) => p.id === id);
    const isNew = !project;

    console.log(`Downloading "${info.title}" (${info.duration}s) as ${id}`);
    const video = await download(url, work, cookies);
    const probed = await probeVideo(video);
    const duration = probed.duration || info.duration;

    const dir = path.join(ASSETS, id);
    await mkdir(dir, { recursive: true });
    const format = await pickFormat();

    // Which moments this pass is for.
    let wanted;
    let origin;
    if (times) {
      wanted = times.filter((t) => t < duration);
      origin = "hand";
      console.log(`Extracting ${wanted.length} marked frames`);
    } else {
      const cuts = await sceneCuts(video, threshold);
      wanted = chooseTimes(cuts, duration, count);
      origin = "auto";
      console.log(
        `${cuts.length} scene cuts, ${wanted.length} candidates across ${Math.round(duration)}s`,
      );
    }

    // Never re-cut a moment the project already holds.
    const existing = new Set((project?.frames ?? []).map((f) => f.id));
    wanted = wanted.filter((t) => !existing.has(frameId(t)));

    const frames = [];
    let rejected = 0;
    for (const t of wanted) {
      // A moment picked by hand is wanted whatever its histogram says — a cut
      // to black can be exactly the frame you meant.
      if (origin === "auto" && !isWorthKeeping(await frameStats(video, t))) {
        rejected++;
        continue;
      }
      const grabbed = await grabFrame(video, t, dir, format);
      frames.push({
        id: grabbed.id,
        t: Number(t.toFixed(3)),
        file: grabbed.full,
        thumb: grabbed.thumb,
        w: Math.min(FULL_WIDTH, probed.width),
        h: Math.round(
          (Math.min(FULL_WIDTH, probed.width) * probed.height) / probed.width,
        ),
        origin,
      });
      process.stdout.write(".");
    }
    if (frames.length) process.stdout.write("\n");
    if (rejected) console.log(`${rejected} rejected as black or flat`);

    if (isNew) {
      project = {
        id,
        title: info.title || id,
        credit: info.author || "",
        year: info.year || String(new Date().getFullYear()),
        note: "",
        tags: [],
        status: "draft",
        addedAt: new Date().toISOString().slice(0, 10),
        source: {
          url,
          platform: platformOf(info.extractor, url),
          videoId: info.id,
          title: info.title,
          author: info.author,
        },
        duration: Number(duration.toFixed(2)),
        width: probed.width,
        height: probed.height,
        frames: [],
      };
      data.projects.push(project);
    }

    // The scrub sheets are the whole video at one frame a second, so they only
    // ever need building once.
    if (!project.scrub) {
      console.log("Building the scrub sheets");
      project.scrub = await buildScrub(
        video,
        dir,
        duration,
        probed.width,
        probed.height,
      );
    }

    project.frames = [...project.frames, ...frames].sort((a, b) => a.t - b.t);
    if (!project.cover && project.frames.length) {
      project.cover = project.frames[Math.floor(project.frames.length / 3)].id;
    }

    await writeProjects(data);
    console.log(
      `${id}: +${frames.length} frames, ${project.frames.length} total, status ${project.status}`,
    );
    console.log("Curate it at /curate");
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

// Only run when invoked directly, so the pure helpers above can be imported
// and checked without the script trying to extract anything.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`\n${err.message}`);
    process.exit(1);
  });
}
