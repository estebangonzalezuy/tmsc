import { readFileSync } from "node:fs";
import { join } from "node:path";
import manifest from "@/content/fundamentals/manifest.json";
import type { Block } from "@/lib/learn";

/* the Fundamentals. The pages are data, not copy: they are written as
   markdown under content/fundamentals/sources/ and built into JSON by
   scripts/fundamentals/build.mjs. Only the section's framing copy lives in
   content/site.json, because the Studio rewrites that file wholesale on every
   publish.

   Import this module from server components only — it reads each page body
   off disk. A client component wanting the list should import
   content/fundamentals/manifest.json directly, which carries cards and no
   bodies at all. */

export type LessonCard = {
  slug: string;
  letter: string;
  title: string;
  blurb: string;
  minutes: number;
  updated: string;
  /** How many interactive figures the page carries. */
  figures: number;
};

export type Lesson = LessonCard & { blocks: Block[] };

export type FundamentalsCounts = { lessons: number; figures: number; minutes: number };

export const lessons: LessonCard[] = manifest.lessons as LessonCard[];
export const counts: FundamentalsCounts = manifest.counts as FundamentalsCounts;

export const lessonSlugs = () => lessons.map((l) => l.slug);

const cards = new Map(lessons.map((l) => [l.slug, l]));
export const getCard = (slug: string) => cards.get(slug) ?? null;

/** The page before and after, in the order they are taught. */
export function neighbours(slug: string): { prev: LessonCard | null; next: LessonCard | null } {
  const at = lessons.findIndex((l) => l.slug === slug);
  if (at === -1) return { prev: null, next: null };
  return { prev: lessons[at - 1] ?? null, next: lessons[at + 1] ?? null };
}

export function getLesson(slug: string): Lesson | null {
  if (!cards.has(slug)) return null;
  /* One file per page, read at build time rather than imported, and the slug
     is checked against the manifest above, so it is ours and not a path from
     the URL. */
  const file = join(process.cwd(), "content", "fundamentals", "lessons", `${slug}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as Lesson;
}
