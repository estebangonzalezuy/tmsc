"use client";

import Link from "next/link";
import { useState } from "react";
import { hiddenSet, studioSection, useContent } from "@/components/content";

// A link disappears when the section powering its page is hidden, or when
// the link itself is hidden from the Navigation panel in the Studio.
const allMenuLinks = [
  { label: "Index", href: "/", section: "", navId: "" },
  { label: "About", href: "/about", section: "", navId: "about" },
  { label: "Newsletter", href: "/newsletter", section: "archive", navId: "newsletter" },
  { label: "the Directory", href: "/directory", section: "directory", navId: "directory" },
  { label: "Stills", href: "/stills", section: "stills", navId: "stills" },
  { label: "Clips", href: "/clips", section: "clips", navId: "clips" },
  { label: "Learn", href: "/learn", section: "learn", navId: "learn" },
  { label: "Fundamentals", href: "/fundamentals", section: "fundamentals", navId: "fundamentals" },
  { label: "Practice", href: "/practice", section: "practiceExercises", navId: "practice" },
  { label: "Offerings", href: "/offerings", section: "offerings", navId: "offerings" },
];

export default function SiteHeader() {
  const content = useContent();
  const { site } = content;
  const hidden = hiddenSet(content);
  const menuLinks = allMenuLinks.filter(
    (l) =>
      (!l.section || !hidden.has(l.section)) &&
      (!l.navId || !hidden.has("nav:" + l.navId)),
  );
  const [open, setOpen] = useState(false);

  return (
    /* A bar, not a capsule. The site stopped floating things off the page, so
       the header is a hairline across the top and the wordmark, the links and
       the one button sit on the page itself. It still sticks: the index is
       long and the way back has to stay reachable. */
    <header
      {...studioSection("nav", "Navigation")}
      className="sticky top-0 z-20 border-b-2 border-foreground bg-background"
    >
      {/* Desktop nav */}
      <nav className="hidden h-16 items-center justify-between gap-6 px-5 text-sm md:flex md:px-6">
        <Link href="/" className="shrink-0 font-semibold tracking-[-0.03em]">
          <span className="xl:hidden">{site.short}</span>
          <span className="hidden xl:inline">{site.name}</span>
        </Link>
        <div className="flex items-center gap-5">
          {menuLinks.slice(1).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="underline-offset-4 hover:underline"
            >
              {l.label}
            </Link>
          ))}
        </div>
        <a
          href={site.subscribe}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary shrink-0"
        >
          Join the club
        </a>
      </nav>

      {/* Mobile nav */}
      <nav className="flex h-14 items-center justify-between px-5 text-sm md:hidden">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="font-semibold tracking-[-0.03em]"
        >
          {site.short}
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="btn"
        >
          Menu
        </button>
      </nav>

      {open && (
        <div className="fixed inset-0 z-30 flex flex-col bg-accent text-white md:hidden">
          <div className="flex items-center justify-between px-5 py-4 text-sm">
            <span className="font-semibold tracking-[-0.03em]">{site.name}</span>
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="btn btn-on-colour">
              Close
            </button>
          </div>
          <div className="flex flex-1 flex-col justify-center gap-1 px-5">
            {menuLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="font-semibold text-[clamp(2.4rem,11vw,3.4rem)] leading-[0.92] tracking-[-0.034em]"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center justify-between px-5 py-5 text-sm">
            <span>
              {site.name} © {new Date().getFullYear()}
            </span>
            <a href={site.subscribe} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              Join the club
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
