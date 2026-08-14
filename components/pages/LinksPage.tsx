"use client";

import Link from "next/link";
import { hiddenSet, studioSection, useContent } from "@/components/content";
import { CircleLetter, accentHover } from "@/components/Motifs";

type Entry = { group: string; name: string; blurb: string; href: string };

// One row's right-hand label: where the link actually goes. A host for
// anything off-site, the path for a page of this site — the point of an index
// is knowing where you're being sent before you press it.
function destination(href: string): string {
  if (href.startsWith("mailto:")) return href.slice(7);
  if (href.startsWith("/")) return href;
  try {
    return new URL(href).host.replace(/^www\./, "");
  } catch {
    return href;
  }
}

// Groups in the order the owner listed them, not alphabetically: the order of
// the rows in the Studio is the order of the page.
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

function Row({ entry }: { entry: Entry }) {
  const internal = entry.href.startsWith("/");
  const inner = (
    <>
      <span className="min-w-0">
        <span className="text-sm group-hover:underline underline-offset-4">
          {entry.name}
        </span>
        {entry.blurb && (
          <span className="mt-1 block max-w-md text-xs text-muted accent-hover-sub leading-relaxed">
            {entry.blurb}
          </span>
        )}
      </span>
      <span className="shrink-0 text-xs text-muted accent-hover-sub">
        {destination(entry.href)} →
      </span>
    </>
  );
  // Narrow screens put the destination under the blurb rather than beside it:
  // side by side, a long host squeezes the name into three words a line.
  const className = `group flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 card card-lift px-6 py-5 ${accentHover(
    entry.name,
  )}`;

  return (
    <li>
      {internal ? (
        <Link href={entry.href} className={className}>
          {inner}
        </Link>
      ) : (
        <a
          href={entry.href}
          target="_blank"
          rel="noreferrer"
          className={className}
        >
          {inner}
        </a>
      )}
    </li>
  );
}

function Group({
  number,
  name,
  entries,
}: {
  number: number;
  name: string;
  entries: Entry[];
}) {
  return (
    <div className="px-5 md:px-6 py-12 md:py-16">
      <div className="flex items-center gap-4">
        <CircleLetter>{String(number).padStart(2, "0")}</CircleLetter>
        <h2 className="text-sm underline underline-offset-4">{name}</h2>
      </div>
      <ul className="mt-8 grid gap-3">
        {entries.map((entry) => (
          <Row key={entry.name + entry.href} entry={entry} />
        ))}
      </ul>
    </div>
  );
}

export default function LinksPage() {
  const content = useContent();
  const { site, links, linkIndex } = content;
  const hidden = hiddenSet(content);

  // The profiles are read off `site` rather than listed again, so this page
  // can never disagree with the footer about where the club lives.
  const elsewhere: Entry[] = [
    {
      group: "Elsewhere",
      name: "The newsletter",
      blurb: "Human & Motion, on Substack. Free, every letter.",
      href: site.substack,
    },
    {
      group: "Elsewhere",
      name: "Join the club",
      blurb: "Subscribe and get the next one in your inbox.",
      href: site.subscribe,
    },
    {
      group: "Elsewhere",
      name: "Instagram",
      blurb: "The club's posts, frames, and daily motion.",
      href: site.instagram,
    },
    {
      group: "Elsewhere",
      name: "LinkedIn",
      blurb: "Where the longer conversations happen.",
      href: site.linkedin,
    },
    {
      group: "Elsewhere",
      name: "Email",
      blurb: "Write to the club directly.",
      href: `mailto:${site.email}`,
    },
  ];

  const groups = hidden.has("linkIndex") ? [] : groupEntries(linkIndex);

  return (
    <>
      <section
        {...studioSection("links", "the Links")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <p className="text-sm underline underline-offset-4">{links.label}</p>
        <h1 className="mt-8 font-serif text-4xl md:text-6xl leading-tight max-w-4xl">
          Everything the club hands out, <em>on one page</em>.
        </h1>
        <p className="mt-8 max-w-md text-sm text-muted leading-relaxed">
          {links.intro}
        </p>
      </section>

      <div {...studioSection("site", "Site & links")}>
        <Group number={1} name="Elsewhere" entries={elsewhere} />
      </div>

      {groups.length > 0 && (
        <div {...studioSection("linkIndex", "The links")}>
          {groups.map((group, i) => (
            <Group
              key={group.name}
              number={i + 2}
              name={group.name}
              entries={group.entries}
            />
          ))}
        </div>
      )}

      {links.note && (
        <section
          {...studioSection("links", "the Links")}
          className="px-5 md:px-6 py-12"
        >
          <p className="max-w-md text-xs text-muted leading-relaxed">
            {links.note}
          </p>
        </section>
      )}
    </>
  );
}
