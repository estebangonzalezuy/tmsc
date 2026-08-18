"use client";

import Link from "next/link";
import { hiddenSet, studioSection, useContent } from "@/components/content";
import { accentHoverText } from "@/components/Motifs";

const allColumns = [
  {
    title: "Club",
    links: [
      { label: "About", href: "/about", section: "", navId: "about" },
      { label: "Newsletter", href: "/newsletter", section: "archive", navId: "newsletter" },
      { label: "Offerings", href: "/offerings", section: "offerings", navId: "offerings" },
      { label: "Sponsorship", href: "/sponsors", section: "sponsorship", navId: "sponsors" },
    ],
  },
  {
    title: "Practice",
    links: [
      { label: "Learn", href: "/learn", section: "learningPaths", navId: "learn" },
      { label: "Practice", href: "/practice", section: "practiceExercises", navId: "practice" },
      { label: "the Directory", href: "/directory", section: "directory", navId: "directory" },
      { label: "the Stills", href: "/stills", section: "stills", navId: "stills" },
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
    <footer
      {...studioSection("site", "Site & links")}
      className="px-4 md:px-6 pb-4"
    >
      <div className="card px-6 md:px-10 py-12 grid gap-10 md:grid-cols-3">
        <div>
          <p>{site.name}</p>
          <p className="mt-4 max-w-xs text-sm text-muted leading-relaxed">
            {site.description}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6 text-sm">
          {columns.map((c) => (
            <div key={c.title}>
              <p className="text-muted">{c.title}</p>
              <ul className="mt-3 space-y-2">
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
        </div>
        <div className="text-sm md:justify-self-end">
          <p className="text-muted">Elsewhere</p>
          <ul className="mt-3 space-y-2">
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
      <div className="px-6 md:px-10 py-6 flex flex-wrap gap-x-6 gap-y-2 items-center justify-between text-xs text-muted">
        <span>
          {site.name} © {new Date().getFullYear()}
        </span>
        {/* The two faces the site is set in. Pirata One is Post Lab material,
            not the site's, so it stays out of this. */}
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
