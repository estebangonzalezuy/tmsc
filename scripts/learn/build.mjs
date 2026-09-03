// the Learn library: markdown sources in, JSON the site imports out.
//
// The club writes pieces as plain markdown under content/learn/sources/. This
// reads them, checks them, and writes content/learn/pieces/<slug>.json (one
// file each, so a piece page imports only its own body) plus a counts-and-cards
// manifest for the hub. Same bargain as scripts/directory/build.mjs: the source
// is the thing a human edits, the JSON is generated and never hand-touched.
//
// It has no dependencies on purpose. The deployed app runs on five packages
// and a markdown library would be a sixth for a job this small.
//
//   node scripts/learn/build.mjs

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

/* Every directive the writer may use, and how many positional arguments it
   takes. An unknown one stops the build rather than vanishing from the page:
   silently dropping a block is how a published piece quietly loses a
   paragraph, and this is also the signal to come and extend the vocabulary
   instead of inventing syntax at the page level. */
const DIRECTIVES = new Set(["note", "do", "video", "audio", "spec"]);

class SourceError extends Error {
  constructor(file, line, message) {
    super(`${file}:${line}  ${message}`);
    this.name = "SourceError";
  }
}

/* ---------- inline spans ---------- */

// Code first so backticks protect what is inside them, then links, then the
// two weights of emphasis. Anything unmatched stays plain text.
const INLINE =
  /(`[^`]+`)|(\[[^\]\n]+\]\([^)\s]+\))|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)/g;

function spans(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push({ t: "text", v: text.slice(last, m.index) });
    const [raw] = m;
    if (raw.startsWith("`")) out.push({ t: "code", v: raw.slice(1, -1) });
    else if (raw.startsWith("[")) {
      const cut = raw.indexOf("](");
      out.push({ t: "a", v: raw.slice(1, cut), href: raw.slice(cut + 2, -1) });
    } else if (raw.startsWith("**")) out.push({ t: "strong", v: raw.slice(2, -2) });
    else out.push({ t: "em", v: raw.slice(1, -1) });
    last = m.index + raw.length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out.length ? out : [{ t: "text", v: text }];
}

/* ---------- directive arguments ---------- */

// `youtube hb2bbf` and `caption="three ways"` in one line. Quoted values may
// hold spaces; bare ones may not.
function parseArgs(rest) {
  const positional = [];
  const named = {};
  const re = /([a-z]+)=(?:"([^"]*)"|(\S+))|(\S+)/g;
  for (const m of rest.matchAll(re)) {
    if (m[1]) named[m[1]] = m[2] ?? m[3];
    else positional.push(m[4]);
  }
  return { positional, named };
}

/* ---------- frontmatter ---------- */

function frontmatter(file, lines) {
  if (lines[0] !== "---") {
    throw new SourceError(file, 1, "a piece must open with a --- frontmatter fence");
  }
  const end = lines.indexOf("---", 1);
  if (end === -1) throw new SourceError(file, 1, "the frontmatter fence is never closed");

  const meta = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cut = line.indexOf(":");
    if (cut === -1) throw new SourceError(file, i + 1, `expected "key: value", got "${line}"`);
    meta[line.slice(0, cut).trim()] = line.slice(cut + 1).trim();
  }

  for (const key of REQUIRED) {
    if (!meta[key]) throw new SourceError(file, 1, `frontmatter is missing "${key}"`);
  }
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
  return { meta: { ...meta, minutes }, bodyStart: end + 1 };
}

/* ---------- body ---------- */

function parseBody(file, lines, start) {
  const blocks = [];
  let i = start;

  const isBreak = (s) =>
    !s.trim() ||
    s.startsWith(":::") ||
    s.startsWith("#") ||
    s.startsWith("> ") ||
    s.startsWith("- ") ||
    /^\d+\.\s/.test(s) ||
    s.trim() === "---";

  while (i < lines.length) {
    const line = lines[i];
    const n = i + 1; // 1-indexed, for messages

    if (!line.trim()) { i++; continue; }

    /* Where the free preview of a paid piece ends. A marker, not a block: it
       has no body and no closing fence, so it is caught before the fenced
       directives below. Everything after it is dropped on the way out — see
       readPieces. */
    if (line.trim() === ":::more") {
      blocks.push({ t: "more" });
      i++;
      continue;
    }

    /* a fenced directive */
    if (line.startsWith(":::")) {
      const head = line.slice(3).trim();
      const sp = head.indexOf(" ");
      const name = sp === -1 ? head : head.slice(0, sp);
      const { positional, named } = parseArgs(sp === -1 ? "" : head.slice(sp + 1));

      if (!DIRECTIVES.has(name)) {
        throw new SourceError(
          file, n,
          `unknown block ":::${name}". Known blocks: ${[...DIRECTIVES].join(", ")}. ` +
          `Add it to DIRECTIVES in scripts/learn/build.mjs and to Prose.tsx if it should exist.`,
        );
      }

      const close = lines.indexOf(":::", i + 1);
      if (close === -1) throw new SourceError(file, n, `":::${name}" is never closed`);
      const inner = lines.slice(i + 1, close).filter((l) => l.trim());
      i = close + 1;

      if (name === "note" || name === "do") {
        if (!inner.length) throw new SourceError(file, n, `":::${name}" is empty`);
        const block = { t: name, text: spans(inner.join(" ")) };
        if (named.minutes) block.minutes = Number(named.minutes);
        blocks.push(block);
      } else if (name === "video") {
        const [provider, id] = positional;
        if (provider !== "youtube" && provider !== "vimeo") {
          throw new SourceError(file, n, `:::video needs "youtube" or "vimeo", got "${provider ?? ""}"`);
        }
        if (!id) throw new SourceError(file, n, ":::video needs a video id");
        const block = { t: "video", provider, id };
        const caption = named.caption ?? inner.join(" ");
        if (caption) block.caption = caption;
        blocks.push(block);
      } else if (name === "audio") {
        const [src] = positional;
        if (!src) throw new SourceError(file, n, ":::audio needs a file path");
        const block = { t: "audio", src };
        if (named.seconds) block.seconds = Number(named.seconds);
        blocks.push(block);
      } else if (name === "spec") {
        const [studio] = positional;
        // "tiles" retired with the Tiles studio itself (AGENTS.md, "What
        // became of the Kinetics and the Tiles") — a Posts Studio graph is
        // the only kind of running example left.
        if (studio !== "postlab") {
          throw new SourceError(file, n, `:::spec needs "postlab", got "${studio ?? ""}"`);
        }
        const spec = inner.join("");
        if (!spec) throw new SourceError(file, n, ":::spec needs an encoded spec in its body");
        const block = { t: "spec", studio, spec };
        if (named.caption) block.caption = named.caption;
        blocks.push(block);
      }
      continue;
    }

    /* a heading */
    if (line.startsWith("#")) {
      const hashes = line.match(/^#+/)[0].length;
      if (hashes === 1) {
        throw new SourceError(file, n, `a piece's title comes from frontmatter, so "#" is not used in the body. Start at "##".`);
      }
      if (hashes > 3) throw new SourceError(file, n, "headings go no deeper than ###");
      blocks.push({ t: "h", level: hashes, text: spans(line.slice(hashes).trim()) });
      i++;
      continue;
    }

    /* a rule */
    if (line.trim() === "---") { blocks.push({ t: "hr" }); i++; continue; }

    /* a standalone image */
    const img = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (img) {
      blocks.push({ t: "img", src: img[2], alt: img[1] });
      i++;
      continue;
    }

    /* a quote */
    if (line.startsWith("> ")) {
      const got = [];
      while (i < lines.length && lines[i].startsWith("> ")) got.push(lines[i++].slice(2));
      blocks.push({ t: "quote", text: spans(got.join(" ")) });
      continue;
    }

    /* a list. An item runs on until a blank line or the next item, so a long
       one can be wrapped in the source the way every other paragraph is —
       without that, a wrapped item ends the list and the next number starts a
       fresh one, which is a numbered list of ones. */
    const bullet = line.startsWith("- ");
    const numbered = /^\d+\.\s/.test(line);
    if (bullet || numbered) {
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        const starts = bullet ? l.startsWith("- ") : /^\d+\.\s/.test(l);
        if (!starts) break;
        let text = bullet ? l.slice(2) : l.replace(/^\d+\.\s/, "");
        i++;
        while (i < lines.length && !isBreak(lines[i])) text += " " + lines[i++].trim();
        items.push(spans(text));
      }
      blocks.push({ t: bullet ? "ul" : "ol", items });
      continue;
    }

    /* a paragraph, running until a blank line or the start of anything else */
    const got = [line];
    i++;
    while (i < lines.length && !isBreak(lines[i])) got.push(lines[i++]);
    blocks.push({ t: "p", text: spans(got.join(" ")) });
  }

  return blocks;
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
      const { meta, bodyStart } = frontmatter(rel, lines);
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
