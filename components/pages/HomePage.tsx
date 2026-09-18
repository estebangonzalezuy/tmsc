"use client";

import Link from "next/link";
import ClipCanvas, { type ClipShape } from "@/components/clips/ClipCanvas";
import { useNearViewport } from "@/components/clips/useNearViewport";
import { hiddenSet, studioSection, useContent } from "@/components/content";
import Cta from "@/components/Cta";
import Illustration from "@/components/Illustration";
import {
  Emphasize,
  Label,
  LetterMarquee,
  Room,
  SectionHeading,
} from "@/components/Motifs";
import OfferBlock from "@/components/learn/OfferBlock";
import PostList from "@/components/PostList";
import { ROOM_SPECS, type RoomCounts } from "@/lib/rooms";

/* `*...*` is italic — see Emphasize. The line has to tell somebody who has
   never heard of the club what is here, so it names the three things the
   site actually holds rather than setting a mood. */
const FALLBACK_HEADLINE =
  "Resources, exercises and letters for designers learning *motion design*.";

/* One tile on the walls strip. A still is a picture; a clip is the Clips
   wall's own canvas, stepping its sheet — the same component, not a second
   one, so a clip on the index behaves exactly like a clip on its wall. */
export type WallPick =
  | {
      kind: "still";
      key: string;
      src: string;
      srcSet: string;
      title: string;
      credit: string;
      code: string;
      href: string;
    }
  | {
      kind: "clip";
      key: string;
      sheet: string;
      poster: string;
      shape: ClipShape;
      title: string;
      credit: string;
      code: string;
      href: string;
    };

export default function HomePage({
  counts = {},
  walls = [],
}: {
  counts?: RoomCounts;
  walls?: WallPick[];
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

  const wallsCopy = (content as { walls?: { label: string; headline: string; note: string } }).walls;
  const showWalls =
    walls.length > 0 && !(hidden.has("stills") && hidden.has("clips"));

  return (
    <>
      {/* Hero. The two rings that used to be seventeen positioned spans are
          one canvas now (see lib/illus/drawers.ts), which is why they can be
          this quiet and still turn. */}
      <section
        {...studioSection("site", "Site & links")}
        className="relative overflow-hidden px-5 md:px-6 pt-24 md:pt-32 pb-14 md:pb-20 text-center"
      >
        <Illustration
          kind="hero"
          ink="#d9d7d1"
          className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
        />
        <div className="relative">
          <Label className="mx-auto">
            {site.name} · a club for designers learning motion
          </Label>
          <h1 className="mt-7 font-serif text-[2.6rem] md:text-[4.9rem] leading-[1.02] tracking-tight max-w-[62rem] mx-auto">
            <Emphasize text={site.headline || FALLBACK_HEADLINE} />
          </h1>
          <p className="mt-7 max-w-lg mx-auto text-base md:text-[1.05rem] leading-relaxed text-muted">
            <strong className="font-medium text-foreground">
              The side companion on your motion design path.
            </strong>{" "}
            A place to connect with other people, to practice, and to embrace
            failure.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <a
              href={site.subscribe}
              target="_blank"
              rel="noreferrer"
              className="btn btn-lg btn-primary"
            >
              Join the newsletter
            </a>
            <Link href="/about" className="textlink">
              What is the club? →
            </Link>
          </div>
        </div>
      </section>

      {/* The rooms. This is the index: six or seven cards that are the only
          colour on the page at rest, each running the motif of the thing it
          opens. */}
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
          <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* The walls. Real frames and real clips, not a picture of them: the
          stills are the files the Stills wall serves and the clips step their
          own sheets. */}
      {showWalls && (
        <section
          {...studioSection("walls", "The walls")}
          className="px-5 md:px-6 py-20 md:py-28"
        >
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading
              label={wallsCopy?.label ?? "The walls"}
              title={
                <Emphasize
                  text={
                    wallsCopy?.headline ??
                    "What good looks like, and *how it moves*."
                  }
                />
              }
            />
            <div className="flex gap-5">
              <Link href="/stills" className="textlink">
                All the stills →
              </Link>
              <Link href="/clips" className="textlink">
                All the clips →
              </Link>
            </div>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3.5 md:grid-cols-4">
            {walls.map((item) => (
              <WallTile key={item.key} item={item} />
            ))}
          </div>
          {wallsCopy?.note && (
            <p className="mt-8 max-w-xl text-sm leading-relaxed text-muted">
              {wallsCopy.note}
            </p>
          )}
        </section>
      )}

      {/* Newsletter */}
      {!hidden.has("archive") && (
        <section
          {...studioSection("archive", "Newsletter archive")}
          className="px-5 md:px-6 pb-20 md:pb-28"
        >
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading
              label="The newsletter"
              title={
                <>
                  One honest letter, <em>twice a month</em>.
                </>
              }
            />
            <Link href="/newsletter" className="textlink">
              Browse the full archive →
            </Link>
          </div>
          <div className="mt-10">
            <PostList posts={latestPosts} covers />
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
          className="block-pale block-peri px-5 md:px-6 py-24 md:py-28 text-center"
        >
          <p className="font-serif italic text-3xl md:text-[2.75rem] leading-[1.15] tracking-tight max-w-3xl mx-auto">
            {quotes[0]}
          </p>
        </section>
      )}

      <Cta />
      <LetterMarquee text={`${site.name.toUpperCase()} · `} />
    </>
  );
}

function WallTile({ item }: { item: WallPick }) {
  const [ref, near] = useNearViewport<HTMLAnchorElement>();
  return (
    <Link ref={ref} href={item.href} className="group block">
      {item.kind === "still" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.src}
          srcSet={item.srcSet}
          sizes="(min-width: 768px) 22vw, 45vw"
          alt={`Still from ${item.title}`}
          loading="lazy"
          className="aspect-video w-full rounded-[var(--radius-sm)] bg-inset object-cover"
        />
      ) : (
        <ClipCanvas
          clip={item.shape}
          sheet={item.sheet}
          poster={item.poster}
          alt={`Clip from ${item.title}`}
          active={near}
          className="aspect-video w-full rounded-[var(--radius-sm)] bg-inset object-cover"
        />
      )}
      <div className="mt-2.5 flex items-baseline justify-between gap-3 text-xs text-muted">
        <span className="truncate">
          <span className="font-medium text-foreground group-hover:underline underline-offset-2">
            {item.title}
          </span>{" "}
          · {item.credit}
        </span>
        <span className="shrink-0 tabular-nums">{item.code}</span>
      </div>
    </Link>
  );
}
