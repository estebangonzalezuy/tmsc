// the Fundamentals: markdown sources in, JSON the site imports out.
//
// One page per fundamental, written as plain markdown under
// content/fundamentals/sources/ in the same small vocabulary the Learn
// library uses (scripts/learn/markdown.mjs), plus `:::figure` — the
// interactive example that is the whole reason this section exists. This
// reads them, checks them, and writes content/fundamentals/lessons/<slug>.json
// (one file each) plus a bodiless manifest for the hub. Same bargain as the
// other builds: the source is the thing a human edits, the JSON is generated
// and never hand-touched.
//
//   node scripts/fundamentals/build.mjs

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SourceError, frontmatter, parseBody } from "../learn/markdown.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCES = join(root, "content", "fundamentals", "sources");
const OUT = join(root, "content", "fundamentals");
const FIGURES = join(root, "components", "fundamentals", "figures");

/* The fundamentals, in the order they are taught. Four, on purpose: this is
   the shortest honest answer to "where do I begin", and a fifth would have to
   earn its place against these. */
const LESSONS = [
  { slug: "grids", letter: "G" },
  { slug: "typography", letter: "T" },
  { slug: "composition", letter: "C" },
  { slug: "motion-basics", letter: "M" },
];

const REQUIRED = ["title", "blurb", "minutes", "updated"];

/* The figures that exist, by the rule that a figure's id is its file name.
   Checked here, with a line number, before next build ever runs — the second
   net is FigureBlock throwing on an id the registry does not know. */
const KIT = new Set(["Figure.tsx", "controls.tsx", "useLoop.ts", "index.ts"]);
const known = new Set(
  readdirSync(FIGURES)
    .filter((f) => f.endsWith(".tsx") && !KIT.has(f))
    .map((f) => f.replace(/\.tsx$/, "")),
);

function readLessons() {
  const listed = new Map(LESSONS.map((l) => [l.slug, l]));
  const files = readdirSync(SOURCES).filter((f) => f.endsWith(".md"));

  for (const filename of files) {
    const slug = filename.replace(/\.md$/, "");
    if (!listed.has(slug)) {
      throw new Error(
        `"${slug}" sits in content/fundamentals/sources/ but is not listed in LESSONS ` +
        `in scripts/fundamentals/build.mjs, so nothing links to it`,
      );
    }
  }

  const lessons = [];
  for (const { slug, letter } of LESSONS) {
    const rel = `content/fundamentals/sources/${slug}.md`;
    let text;
    try {
      text = readFileSync(join(SOURCES, `${slug}.md`), "utf8");
    } catch {
      throw new Error(`LESSONS lists "${slug}", which has no file at ${rel}`);
    }
    const lines = text.split(/\r?\n/);
    const { meta, bodyStart } = frontmatter(rel, lines, REQUIRED);
    const minutes = Number(meta.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new SourceError(rel, 1, `minutes must be a positive number, got "${meta.minutes}"`);
    }

    const blocks = parseBody(rel, lines, bodyStart);
    if (!blocks.length) throw new SourceError(rel, 1, "this fundamental has no body");
    if (blocks.some((b) => b.t === "more")) {
      throw new SourceError(rel, 1, `":::more" has no meaning here — every fundamental is free, all of it is published.`);
    }

    /* Find the line for the message the honest way: the block has no line
       number, the source does. */
    for (const b of blocks) {
      if (b.t === "figure" && !known.has(b.id)) {
        const at = lines.findIndex((l) => l.startsWith(":::figure") && l.split(/\s+/)[1] === b.id) + 1;
        throw new SourceError(
          rel, at,
          `:::figure "${b.id}" has no file at components/fundamentals/figures/${b.id}.tsx. ` +
          `Known figures: ${[...known].sort().join(", ")}.`,
        );
      }
    }

    lessons.push({
      slug,
      letter,
      title: meta.title,
      blurb: meta.blurb,
      minutes,
      updated: meta.updated,
      figures: blocks.filter((b) => b.t === "figure").length,
      blocks,
    });
  }
  return lessons;
}

function main() {
  const lessons = readLessons();

  rmSync(join(OUT, "lessons"), { recursive: true, force: true });
  mkdirSync(join(OUT, "lessons"), { recursive: true });

  for (const l of lessons) {
    writeFileSync(join(OUT, "lessons", `${l.slug}.json`), JSON.stringify(l, null, 2) + "\n");
  }

  const manifest = {
    lessons: lessons.map(({ blocks, ...card }) => { void blocks; return card; }),
    counts: {
      lessons: lessons.length,
      figures: lessons.reduce((n, l) => n + l.figures, 0),
      minutes: lessons.reduce((n, l) => n + l.minutes, 0),
    },
  };
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  console.log(
    `the Fundamentals: ${manifest.counts.lessons} pages, ${manifest.counts.figures} figures, ` +
    `${manifest.counts.minutes} minutes.`,
  );
}

try {
  main();
} catch (e) {
  console.error(e instanceof SourceError ? e.message : e);
  process.exit(1);
}
