"use client";

import Link from "next/link";
import { useState } from "react";
import { hiddenSet, studioSection, useContent } from "@/components/content";
import { CircleLetter } from "@/components/Motifs";

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
      className="sticky top-0 z-20 border-b border-line bg-background/85 backdrop-blur"
    >
      {/* Desktop nav */}
      <nav className="hidden h-[3.75rem] items-center justify-between gap-6 px-5 text-[13.5px] md:flex md:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 font-medium">
          <CircleLetter size="size-[26px] text-sm">M</CircleLetter>
          {site.name}
        </Link>
        <div className="flex items-center gap-6 text-muted">
          {menuLinks.slice(1).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="accent-hover-text transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>
        <a
          href={site.subscribe}
          target="_blank"
          rel="noreferrer"
          className="btn shrink-0 accent-hover"
        >
          Join the club
        </a>
      </nav>

      {/* Mobile nav */}
      <nav className="flex h-[3.5rem] items-center justify-between px-5 text-sm md:hidden">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2.5 font-medium"
        >
          <CircleLetter size="size-[26px] text-sm">M</CircleLetter>
          {site.short}
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="pill"
        >
          Menu
        </button>
      </nav>

      {open && (
        <div className="fixed inset-0 z-30 bg-foreground text-background flex flex-col md:hidden">
          <div className="flex items-center justify-between px-5 py-4 text-sm">
            <span>{site.name}</span>
            <button onClick={() => setOpen(false)} aria-label="Close menu">
              Close
            </button>
          </div>
          <div className="flex-1 flex flex-col justify-center gap-2 px-5">
            {menuLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="font-serif italic text-5xl leading-tight"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center justify-between px-5 py-4 text-xs text-background/60">
            <span>
              {site.name} © {new Date().getFullYear()}
            </span>
            <a href={site.subscribe} target="_blank" rel="noreferrer">
              Join the club
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
