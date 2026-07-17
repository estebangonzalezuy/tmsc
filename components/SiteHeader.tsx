"use client";

import Link from "next/link";
import { useState } from "react";
import { site } from "@/lib/data";

const menuLinks = [
  { label: "Index", href: "/" },
  { label: "About", href: "/about" },
  { label: "Newsletter", href: "/newsletter" },
  { label: "Resources", href: "/resources" },
  { label: "Learn", href: "/learn" },
  { label: "Offerings", href: "/offerings" },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative z-20 border-b border-line">
      {/* Desktop nav */}
      <nav className="hidden md:flex items-center justify-between px-6 py-4 text-sm">
        <Link href="/" className="underline underline-offset-4">
          {site.name}
        </Link>
        <div className="flex items-center gap-6">
          {menuLinks.slice(1).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hover:text-muted transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>
        <a
          href={site.subscribe}
          target="_blank"
          rel="noreferrer"
          className="border border-line rounded-full px-4 py-1.5 hover:bg-foreground hover:text-background transition-colors"
        >
          Join the club
        </a>
      </nav>

      {/* Mobile nav */}
      <nav className="md:hidden flex items-center justify-between px-5 py-4 text-sm">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="underline underline-offset-4"
        >
          {site.short}
        </Link>
        <button onClick={() => setOpen(true)} aria-label="Open menu">
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
