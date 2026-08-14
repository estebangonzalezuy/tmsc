"use client";

import Link from "next/link";
import { hiddenSet, studioSection, useContent } from "@/components/content";
import { accentHover } from "@/components/Motifs";

// A link-in-bio page, built to the shape of one: a narrow centred column,
// the mark, the handle, a row of round social buttons, then nothing but
// full-width buttons you can hit with a thumb. No copy — every line on this
// page is somewhere to go.
//
// The shape is borrowed; the language is the club's own. A button here is a
// `.card` floating on the warm ground with `.card-lift` under a pointer,
// which is what the rest of the site is made of now, and colour still only
// ever answers a pointer.

type Entry = { group: string; name: string; href: string };

// Groups in the order they were listed, not alphabetically: the order of the
// rows in the Studio is the order of the page.
function groupEntries(entries: Entry[]): { name: string; entries: Entry[] }[] {
  const groups: { name: string; entries: Entry[] }[] = [];
  for (const entry of entries) {
    const name = entry.group || "Links";
    let group = groups.find((g) => g.name === name);
    if (!group) {
      group = { name, entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}

function Button({ entry }: { entry: Entry }) {
  const className = `block w-full card card-lift px-6 py-4 text-sm ${accentHover(
    entry.name,
  )}`;
  return entry.href.startsWith("/") ? (
    <Link href={entry.href} className={className}>
      {entry.name}
    </Link>
  ) : (
    <a href={entry.href} target="_blank" rel="noreferrer" className={className}>
      {entry.name}
    </a>
  );
}

// The club has no icon set and doesn't want one, so a social button carries
// its own two letters inside the circle the site already uses everywhere.
// Written out rather than reaching for CircleLetter: that one pins its type
// to near-black so a mark survives a card hovering around it, and this one
// is the thing being hovered.
function Social({
  mark,
  label,
  href,
}: {
  mark: string;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className={`inline-flex size-11 items-center justify-center rounded-full bg-surface text-xs shadow-[0_1px_3px_rgba(13,13,13,0.10)] card-lift ${accentHover(
        label,
      )}`}
    >
      {mark}
    </a>
  );
}

export default function LinksPage() {
  const content = useContent();
  const { site, linkIndex } = content;
  const hidden = hiddenSet(content);
  const groups = hidden.has("linkIndex")
    ? []
    : groupEntries(linkIndex as Entry[]);

  return (
    <div className="mx-auto w-full max-w-[520px] px-5 py-16 text-center">
      <span className="inline-flex size-24 items-center justify-center rounded-full bg-surface font-serif italic text-xl shadow-[0_1px_3px_rgba(13,13,13,0.10)]">
        tMSC
      </span>
      <p className="mt-6 text-base">{site.name}</p>
      <p className="mt-1 text-sm text-muted">themotionsocial.club</p>

      <div className="mt-6 flex items-center justify-center gap-3">
        <Social mark="SS" label="Substack" href={site.substack} />
        <Social mark="IG" label="Instagram" href={site.instagram} />
        <Social mark="in" label="LinkedIn" href={site.linkedin} />
        <Social mark="@" label="Email" href={`mailto:${site.email}`} />
      </div>

      <div {...studioSection("linkIndex", "the Links")} className="mt-12">
        {groups.map((group) => (
          <section key={group.name} className="mt-10 first:mt-0">
            <p className="text-[11px] uppercase tracking-widest text-muted">
              {group.name}
            </p>
            <div className="mt-4 grid gap-3">
              {group.entries.map((entry) => (
                <Button key={entry.name + entry.href} entry={entry} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
