import content from "@/content/site.json";

// All site copy lives in content/site.json so the Studio (/studio) can edit
// and republish it without touching code. This module just re-exports it with
// the types the components consume.

export type Stat = { value: string; label: string };
export type Pillar = { number: string; name: string; text: string };
export type Thread = { name: string; text: string };
export type PracticeFile = { number: string; name: string; note: string };
export type LearningPath = {
  name: string;
  blurb: string;
  href: string;
  tag: string;
};
export type Resource = { name: string; blurb: string; href: string };
export type Offering = {
  name: string;
  status: string;
  price: string;
  blurb: string;
  href: string;
  cta: string;
};
export type Post = { date: string; title: string; type: string };
export type ArchiveYear = { year: string; posts: Post[] };

export const site = content.site;
export const stats: Stat[] = content.stats;
export const pillars: Pillar[] = content.pillars;
export const threads: Thread[] = content.threads;
export const practiceFiles: PracticeFile[] = content.practiceFiles;
export const learningPaths: LearningPath[] = content.learningPaths;
export const resources: Resource[] = content.resources;
export const worksheets: string[] = content.worksheets;
export const offerings: Offering[] = content.offerings;
export const archive: ArchiveYear[] = content.archive;
export const quotes: string[] = content.quotes;
