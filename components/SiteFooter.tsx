"use client";

import Link from "next/link";
import { hiddenSet, studioSection, useContent } from "@/components/content";
import { accentHoverText, CircleLetter, Label } from "@/components/Motifs";

const allColumns = [
  {
    title: "Club",
    links: [
      { label: "About", href: "/about", section: "", navId: "about" },
      { label: "Newsletter", href: "/newsletter", section: "archive", navId: "newsletter" },
      { label: "Offerings", href: "/offerings", section: "offerings", navId: "offerings" },
    ],
  },
  {
    title: "Practice",
    links: [
      { label: "Learn", href: "/learn", section: "learn", navId: "learn" },
      { label: "Fundamentals", href: "/fundamentals", section: "fundamentals", navId: "fundamentals" },
      { label: "Practice", href: "/practice", section: "practiceExercises", navId: "practice" },
      { label: "the Directory", href: "/directory", section: "directory", navId: "directory" },
      { label: "Stills", href: "/stills", section: "stills", navId: "stills" },
      { label: "Clips", href: "/clips", section: "clips", navId: "clips" },
    ],
  },
];

const typefaces = [
  { name: "Archivo", href: "https://fonts.google.com/specimen/Archivo" },
  { name: "Lora", href: "https://fonts.google.com/specimen/Lora" },
];

export default function SiteFooter() {
  const content = useContent();
  const { site } = content;
  const hidden = hiddenSet(content);
  const columns = allColumns
    .map((c) => ({
      ...c,
      links: c.links.filter(
        (l) =>
          (!l.section || !hidden.has(l.section)) &&
          (!l.navId || !hidden.has("nav:" + l.navId)),
      ),
    }))
    .filter((c) => c.links.length > 0);
  return (
    /* Four columns under a hairline, then the legal line. The card is gone
       with every other floating surface; the rule across the top is what
       separates the footer from the page now. */
    <footer
      {...studioSection("site", "Site & links")}
      className="border-t border-line px-5 md:px-6 pt-14"
    >
      <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2.5 font-medium">
            <CircleLetter size="size-[26px] text-sm">M</CircleLetter>
            {site.name}
          </p>
          <p className="mt-4 max-w-xs text-sm text-muted leading-relaxed">
            {site.description}
          </p>
        </div>
        {columns.map((c) => (
          <div key={c.title} className="text-sm">
            <Label>{c.title}</Label>
            <ul className="mt-3.5 space-y-2 text-muted">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="accent-hover-text transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="text-sm">
          <Label>Elsewhere</Label>
          <ul className="mt-3.5 space-y-2 text-muted">
            <li>
              <a
                href={site.substack}
                target="_blank"
                rel="noreferrer"
                className="accent-hover-text transition-colors"
              >
                Substack
              </a>
            </li>
            <li>
              <a
                href={site.instagram}
                target="_blank"
                rel="noreferrer"
                className="accent-hover-text transition-colors"
              >
                Instagram
              </a>
            </li>
            <li>
              <a
                href={site.linkedin}
                target="_blank"
                rel="noreferrer"
                className="accent-hover-text transition-colors"
              >
                LinkedIn
              </a>
            </li>
            <li>
              <a
                href={`mailto:${site.email}`}
                className="accent-hover-text transition-colors"
              >
                {site.email}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="mt-12 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-7 text-xs text-faint">
        <span>
          {site.name} © {new Date().getFullYear()}
        </span>
        {/* The two faces the site is set in. Pirata One is Posts Studio
            material, not the site's, so it stays out of this. */}
        <span className="flex flex-wrap items-center gap-x-1.5">
          Set in
          {typefaces.map((f, i) => (
            <span key={f.name} className="flex items-center gap-x-1.5">
              <a
                href={f.href}
                target="_blank"
                rel="noreferrer"
                className={`underline underline-offset-4 ${accentHoverText(f.name)}`}
              >
                {f.name}
              </a>
              {i < typefaces.length - 1 && <span aria-hidden>&amp;</span>}
            </span>
          ))}
        </span>
        <span>Made by Esteban González, Montevideo</span>
      </div>
    </footer>
  );
}
