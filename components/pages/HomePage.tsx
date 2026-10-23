"use client";

import Link from "next/link";
import { hiddenSet, studioSection, useContent } from "@/components/content";
import Cta from "@/components/Cta";
import {
  Label,
  LetterMarquee,
  Room,
  SectionHeading,
} from "@/components/Motifs";
import OfferBlock from "@/components/learn/OfferBlock";
import PostList from "@/components/PostList";
import { ROOM_SPECS, type RoomCounts } from "@/lib/rooms";

/* `*...*` is the yellow block. The highlighted run starts on its own line
   so a long phrase does not leave a stub at the end of the sentence above,
   and each wrapped line of that run is its own rectangle. */
const FALLBACK_HEADLINE =
  "Tools change every week. *Criteria, craft and practice* don't.";

function HeroHeadline({ text }: { text: string }) {
  return text.split(/\*([^*]+)\*/g).map((part, i) =>
    i % 2 ? (
      <span key={i}>
        <br />
        <em>{part}</em>
      </span>
    ) : (
      part
    ),
  );
}

export default function HomePage({
  counts = {},
}: {
  counts?: RoomCounts;
}) {
  const content = useContent();
  const { site, archive, quotes, stats } = content;
  const hidden = hiddenSet(content);
  const latestPosts = archive.flatMap((y) => y.posts).slice(0, 5);

  /* A room follows the same two switches its nav link does: the content
     section behind it, and the Studio's own navigation toggle. A page the
     owner has taken out of the menu is a page that isn't ready, and the index
     is a louder front door than the menu. */
  const rooms = (content as { rooms?: { id: string; name: string; line: string }[] }).rooms ?? [];
  const visibleRooms = ROOM_SPECS.flatMap((spec) => {
    const copy = rooms.find((r) => r.id === spec.id);
    if (!copy) return [];
    if (hidden.has(spec.section) || hidden.has(`nav:${spec.navId}`)) return [];
    return [{ spec, copy }];
  });

  return (
    <>
      {/* Hero. The two rings that used to be seventeen positioned spans are
          one canvas now (see lib/illus/drawers.ts), which is why they can be
          this quiet and still turn. */}
      <section
        {...studioSection("site", "Site & links")}
        className="block-colour bg-accent px-5 md:px-6 pt-14 md:pt-20 pb-16 md:pb-24"
      >
        <Label>{site.name}</Label>
        <h1 className="hero-title mt-5 max-w-[18em] font-serif text-[clamp(2.7rem,7.4vw,6.4rem)] leading-[0.9] tracking-[-0.04em]">
          <HeroHeadline text={site.headline || FALLBACK_HEADLINE} />
        </h1>
        <p className="mt-8 max-w-md text-base leading-relaxed md:text-lg">
          {site.description}
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-5">
          <a
            href={site.subscribe}
            target="_blank"
            rel="noreferrer"
            className="btn btn-lg btn-on-colour"
          >
            Join the newsletter
          </a>
          <Link href="/about" className="textlink">
            What is the club? →
          </Link>
        </div>
      </section>

      {/* The letters first. The club publishes these; the rooms are ways in. */}
      {!hidden.has("archive") && (
        <section
          {...studioSection("archive", "Newsletter archive")}
          className="px-5 md:px-6 py-16 md:py-24"
        >
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading
              label="The newsletter"
              title={
                <>
                  The latest <em>letters</em>.
                </>
              }
            />
            <Link href="/newsletter" className="textlink">
              Browse the full archive →
            </Link>
          </div>
          <div className="mt-10">
            <PostList posts={latestPosts} />
          </div>
        </section>
      )}

      {/* The rooms. This is the index: the ways into the club. */}
      {visibleRooms.length > 0 && (
        <section
          {...studioSection("rooms", "Rooms")}
          className="px-5 md:px-6 pb-8"
        >
          {/* The count is read off the rooms rather than written down, so
              hiding one in the Studio doesn't leave the label lying. */}
          <Label>
            {visibleRooms.length} rooms, one club
          </Label>
          <div className="mt-6 grid gap-px border border-foreground bg-foreground sm:grid-cols-2">
            {visibleRooms.map(({ spec, copy }, i) => (
              <Room
                key={spec.id}
                href={spec.href}
                number={String(i + 1).padStart(2, "0")}
                name={copy.name}
                line={copy.line}
                count={counts[spec.id]}
                colour={spec.colour}
                kind={spec.kind}
              />
            ))}
          </div>
        </section>
      )}

      {/* The library. The same block the Learn page carries, so the offer is
          written once and the index shows it rather than describing it. */}
      {!hidden.has("learn") && !hidden.has("nav:learn") && (
        <section
          {...studioSection("learn", "Learn")}
          className="px-5 md:px-6 pb-20 md:pb-28"
        >
          <OfferBlock compact />
        </section>
      )}

      {/* What the club is, in four numbers. */}
      {!hidden.has("stats") && (
        <section
          {...studioSection("stats", "Stats")}
          className="px-5 md:px-6 pb-20 md:pb-28"
        >
          <dl className="grid grid-cols-2 border-y border-line md:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`py-7 ${i % 2 === 1 ? "border-l border-line pl-7" : ""} md:border-l md:pl-7 md:first:border-l-0 md:first:pl-0 ${
                  i > 1 ? "border-t border-line md:border-t-0" : ""
                }`}
              >
                <dd className="font-serif text-[2.5rem] leading-none tracking-tight">
                  {s.value}
                </dd>
                <dt className="label mt-2.5">{s.label}</dt>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Quote band — the one full-bleed block of colour on the page. */}
      {!hidden.has("quotes") && quotes.length > 0 && (
        <section
          {...studioSection("quotes", "Quotes")}
          className="bg-accent-warm px-5 py-16 text-black md:px-6 md:py-24"
        >
          <p className="max-w-[16em] font-serif text-[clamp(2rem,5vw,4.25rem)] leading-[0.92] tracking-[-0.034em]">
            {quotes[0]}
          </p>
        </section>
      )}

      <Cta />
      <LetterMarquee text={`${site.name.toUpperCase()} · `} />
    </>
  );
}
