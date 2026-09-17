// the Learn library: markdown sources in, JSON the site imports out.
//
// The club writes pieces as plain markdown under content/learn/sources/. This
// reads them, checks them, and writes content/learn/pieces/<slug>.json (one
// file each, so a piece page imports only its own body) plus a counts-and-cards
// manifest for the hub. Same bargain as scripts/directory/build.mjs: the source
// is the thing a human edits, the JSON is generated and never hand-touched.
//
// The markdown itself — the block vocabulary and its parser — lives next door
// in markdown.mjs, shared with the Fundamentals build. What is here is what is
// about the library: the tracks, the path, the frontmatter contract, the
// paywall cut, and the manifest.
//
//   node scripts/learn/build.mjs

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SourceError, frontmatter, parseBody } from "./markdown.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCES = join(root, "content", "learn", "sources");
const OUT = join(root, "content", "learn");

/* The tracks, in the order they appear on the hub. A track is a topic and an
   ordered shelf; the order of its pieces is the order of `pieces` below, not
   the order of the files on disk, because a curriculum is a decision. */
const TRACKS = [
  {
    id: "foundations",
    name: "Foundations",
    letter: "F",
    blurb:
      "The decisions that happen before the software does. What motion is for, and how to think in it.",
    pieces: ["what-motion-design-is", "sketch-how-it-moves", "one-element-one-move"],
  },
  {
    id: "craft",
    name: "Craft",
    letter: "C",
    blurb:
      "Easing, timing, hierarchy, type. The fundamentals that make a move feel deliberate instead of default.",
    pieces: ["easing-past-easy-ease", "timing-and-spacing", "type-that-moves"],
  },
  {
    id: "working",
    name: "Working",
    letter: "W",
    blurb:
      "Finishing things, showing them, and talking about them. The part nobody makes tutorials about.",
    pieces: ["finish-something-small", "how-to-show-your-work"],
  },
];

/* The on-ramp. Everyone walks this before picking a track. Each day points at
   a piece that already lives in a track, so reordering the curriculum later
   never mints or breaks a URL. `todo` is the thing you go and do after. */
const PATH = [
  { day: 1, piece: "what-motion-design-is", todo: "Write down the three words you want your work to feel like.", minutes: 20 },
  { day: 2, piece: "sketch-how-it-moves", todo: "Draw three frames of something you already designed.", minutes: 30 },
  { day: 3, piece: "one-element-one-move", todo: "Animate one element. Two properties, maximum.", minutes: 30 },
  { day: 4, piece: "easing-past-easy-ease", todo: "Take yesterday's move and rebuild its curve by hand.", minutes: 30 },
  { day: 5, piece: "timing-and-spacing", todo: "Make the same move read fast, then heavy. Change nothing but time.", minutes: 30 },
  { day: 6, piece: "type-that-moves", todo: "Animate one line of text. Resist animating every letter.", minutes: 40 },
  { day: 7, piece: "finish-something-small", todo: "Take one of this week's tests to finished. Export it.", minutes: 60 },
];

const KINDS = new Set(["article", "video", "audio"]);
const STATES = new Set(["published", "placeholder"]);
/* What the reader gets without paying. The library is a pay-once library, so
   "paid" is the norm and "free" is the deliberate sample. */
const ACCESS = new Set(["free", "paid"]);
const REQUIRED = ["title", "blurb", "kind", "state", "minutes", "updated", "access"];

/* ---------- frontmatter ---------- */

/* What the values may be, on top of the keys markdown.mjs already insists on. */
function readFrontmatter(file, lines) {
  const { meta, bodyStart } = frontmatter(file, lines, REQUIRED);
  if (!KINDS.has(meta.kind)) {
    throw new SourceError(file, 1, `kind "${meta.kind}" is not one of ${[...KINDS].join(", ")}`);
  }
  if (!STATES.has(meta.state)) {
    throw new SourceError(file, 1, `state "${meta.state}" is not one of ${[...STATES].join(", ")}`);
  }
  if (!ACCESS.has(meta.access)) {
    throw new SourceError(file, 1, `access "${meta.access}" is not one of ${[...ACCESS].join(", ")}`);
  }
  const minutes = Number(meta.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new SourceError(file, 1, `minutes must be a positive number, got "${meta.minutes}"`);
  }
  return { meta: { ...meta, minutes }, bodyStart };
}

/* ---------- run ---------- */

function readPieces() {
  const pieces = new Map();
  const seen = new Map();

  for (const track of TRACKS) {
    let files;
    try {
      files = readdirSync(join(SOURCES, track.id)).filter((f) => f.endsWith(".md"));
    } catch {
      throw new Error(`the track "${track.id}" has no folder at content/learn/sources/${track.id}/`);
    }

    for (const filename of files) {
      const slug = filename.replace(/\.md$/, "");
      const rel = `content/learn/sources/${track.id}/${filename}`;

      if (seen.has(slug)) {
        throw new Error(
          `two pieces share the slug "${slug}" (${seen.get(slug)} and ${rel}). ` +
          `A slug is a piece's name everywhere, so it has to be unique across tracks.`,
        );
      }
      seen.set(slug, rel);

      const lines = readFileSync(join(SOURCES, track.id, filename), "utf8").split(/\r?\n/);
      const { meta, bodyStart } = readFrontmatter(rel, lines);
      const blocks = parseBody(rel, lines, bodyStart);

      if (meta.state === "published" && !blocks.length) {
        throw new SourceError(rel, 1, `this is marked "published" but has no body. Mark it "placeholder" until it does.`);
      }

      /* The paywall, such as it is. A paid piece is cut at its :::more marker
         and only the blocks above it are written out, so the rest never reaches
         content/learn/pieces/, the bundle, or a browser. There is no lock to
         pick because there is nothing there to unlock.

         Be honest about the shape of that: this keeps paid writing off the
         published site, and the markdown source still sits in this repo. It is
         a preview mechanism, not access control. Real gating arrives with
         whatever platform takes the payment. */
      const cut = blocks.findIndex((b) => b.t === "more");

      if (meta.access === "paid" && meta.state === "published" && cut === -1) {
        throw new SourceError(
          rel, 1,
          `this is a paid piece with no ":::more" marker, so there is no way to ` +
          `tell what may be published. Put ":::more" where the free preview should end.`,
        );
      }
      if (cut !== -1 && meta.access === "free") {
        throw new SourceError(rel, 1, `":::more" has no meaning in a free piece — all of it is published.`);
      }

      const kept = cut === -1 ? blocks : blocks.slice(0, cut);
      const locked = cut === -1 ? 0 : blocks.length - cut - 1;

      if (meta.access === "paid" && meta.state === "published" && !kept.length) {
        throw new SourceError(rel, 1, `the ":::more" marker is at the top, so this piece previews nothing.`);
      }

      pieces.set(slug, {
        slug,
        title: meta.title,
        blurb: meta.blurb,
        kind: meta.kind,
        state: meta.state,
        access: meta.access,
        track: track.id,
        minutes: meta.minutes,
        updated: meta.updated,
        locked,
        blocks: kept,
      });
    }
  }
  return pieces;
}

function main() {
  const pieces = readPieces();

  // Every slug named by a track or by the path has to exist, or the hub links
  // into a 404.
  for (const track of TRACKS) {
    for (const slug of track.pieces) {
      if (!pieces.has(slug)) {
        throw new Error(`track "${track.id}" lists "${slug}", which has no file at content/learn/sources/${track.id}/${slug}.md`);
      }
      if (pieces.get(slug).track !== track.id) {
        throw new Error(`track "${track.id}" lists "${slug}", but that piece lives in "${pieces.get(slug).track}"`);
      }
    }
    const listed = new Set(track.pieces);
    for (const p of pieces.values()) {
      if (p.track === track.id && !listed.has(p.slug)) {
        throw new Error(`"${p.slug}" sits in content/learn/sources/${track.id}/ but is not listed in that track's pieces[], so nothing links to it`);
      }
    }
  }
  for (const day of PATH) {
    if (!pieces.has(day.piece)) {
      throw new Error(`day ${day.day} of the path points at "${day.piece}", which does not exist`);
    }
  }

  rmSync(join(OUT, "pieces"), { recursive: true, force: true });
  mkdirSync(join(OUT, "pieces"), { recursive: true });

  const card = (p) => ({
    slug: p.slug, title: p.title, blurb: p.blurb,
    kind: p.kind, state: p.state, access: p.access,
    track: p.track, minutes: p.minutes, updated: p.updated,
  });

  for (const p of pieces.values()) {
    writeFileSync(join(OUT, "pieces", `${p.slug}.json`), JSON.stringify(p, null, 2) + "\n");
  }

  const all = [...pieces.values()];
  const published = all.filter((p) => p.state === "published");

  const manifest = {
    tracks: TRACKS.map((t) => ({
      ...t,
      count: t.pieces.length,
      published: t.pieces.filter((s) => pieces.get(s).state === "published").length,
    })),
    path: PATH.map((d) => ({ ...d, title: pieces.get(d.piece).title, track: pieces.get(d.piece).track })),
    pieces: all.map(card),
    /* What is in the library, counted from the library. Every number the hub
       shows comes from here, so a "what's inside" panel can never drift from
       what was actually built. */
    counts: {
      total: all.length,
      published: published.length,
      placeholder: all.length - published.length,
      tracks: TRACKS.length,
      days: PATH.length,
      minutes: published.reduce((n, p) => n + p.minutes, 0),
      articles: all.filter((p) => p.kind === "article").length,
      videos: all.filter((p) => p.kind === "video").length,
      audio: all.filter((p) => p.kind === "audio").length,
      free: published.filter((p) => p.access === "free").length,
      paid: all.filter((p) => p.access === "paid").length,
    },
    /* The updates log: newest first, and only things that exist. It is a view of
       each piece's own `updated`, not a second source to keep in step. */
    updates: published
      .map((p) => ({
        slug: p.slug, title: p.title, blurb: p.blurb,
        kind: p.kind, access: p.access, track: p.track, updated: p.updated,
      }))
      .sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0)),
  };
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  const open = published.filter((p) => p.access === "free").length;
  console.log(
    `the Learn library: ${all.length} pieces across ${TRACKS.length} tracks ` +
    `(${published.length} written, ${all.length - published.length} still placeholders), ` +
    `${PATH.length} days on the path, ${open} open to read.`,
  );
}

try {
  main();
} catch (err) {
  console.error(`\n${err.name === "SourceError" ? "" : "the Learn build failed: "}${err.message}\n`);
  process.exit(1);
}
