"use client";

import Link from "next/link";
import { hiddenSet, studioSection, useContent } from "@/components/content";

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
      { label: "Learn", href: "/learn", section: "learningPaths", navId: "learn" },
      { label: "Resources", href: "/resources", section: "resources", navId: "resources" },
    ],
  },
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
      className="border-t border-line"
    >
      <div className="px-5 md:px-6 py-12 grid gap-10 md:grid-cols-3">
        <div>
          <p className="underline underline-offset-4">{site.name}</p>
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
                      className="hover:text-muted transition-colors"
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
                className="hover:text-muted transition-colors"
              >
                Substack
              </a>
            </li>
            <li>
              <a
                href={site.instagram}
                target="_blank"
                rel="noreferrer"
                className="hover:text-muted transition-colors"
              >
                Instagram
              </a>
            </li>
            <li>
              <a
                href={site.linkedin}
                target="_blank"
                rel="noreferrer"
                className="hover:text-muted transition-colors"
              >
                LinkedIn
              </a>
            </li>
            <li>
              <a
                href={`mailto:${site.email}`}
                className="hover:text-muted transition-colors"
              >
                {site.email}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line px-5 md:px-6 py-4 flex items-center justify-between text-xs text-muted">
        <span>
          {site.name} © {new Date().getFullYear()}
        </span>
        <span>Made by Esteban González, Montevideo</span>
      </div>
    </footer>
  );
}
