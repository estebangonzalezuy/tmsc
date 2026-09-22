"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Illustration from "@/components/Illustration";
import type { IllusKind } from "@/lib/illus/drawers";
import { hash01 } from "@/lib/illus/drawers";

/* The two hover helpers live in lib/accent.ts rather than here, because this
   module is "use client" and a server component cannot call a function out of
   one — only render a component from it. They are re-exported so every
   existing import of them from Motifs keeps working, and so this stays the
   one place to look for the design system. */
export { accentHover, accentHoverText } from "@/lib/accent";

/* Circled letter — the recurring mark from the club's poster graphics. A
   drawn circle again rather than a little floating disc: the site stopped
   lifting things off the page, so the mark is a hairline and its ground is
   whatever it sits on. */
export function CircleLetter({
  children,
  size = "size-9",
  className = "",
}: {
  children: ReactNode;
  size?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border border-line-2 font-serif ${size} ${className}`}
    >
      {children}
    </span>
  );
}

/* The small caps line over a section, on a date, under a count. The site has
   two typefaces and this is not a third: it is Archivo, small, spaced and
   uppercased, which is the whole of the site's "label" register. */
export function Label({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={`label ${className}`}>{children}</p>;
}

/* Scrolling band of circled letters.

   The track scrolls left by exactly one run and then snaps back, which is
   invisible only while the copies behind that run still cover the screen.
   Two copies don't: the shift leaves the far side of a wide viewport bare
   before the loop restarts, so the band visibly ends. Hence one copy per
   run-width of viewport, plus the one being scrolled away.

   The count is measured rather than fixed because a run's width depends on
   the text and the breakpoint. SSR renders enough for a laptop and the
   measurement only ever adds copies, so the common case never re-renders
   (a changed count restarts the animation, which would show as a jump) and
   an ultrawide display grows once on hydration. */
const SSR_COPIES = 4;

/* The band is the one place the palette is used for nothing but pleasure —
   the club's colours going past, at the bottom of every page. Fill and type
   are paired the way .accent-*-hover pairs them. */
const MARQUEE_FILLS = [
  "bg-accent text-white border-transparent",
  "",
  "bg-accent-warm text-white border-transparent",
  "",
  "bg-accent-green text-white border-transparent",
  "",
  "bg-accent-soft text-foreground border-transparent",
  "",
];

export function LetterMarquee({ text }: { text: string }) {
  const letters = text.replace(/\s+/g, " ").split("");
  const runRef = useRef<HTMLSpanElement>(null);
  const [copies, setCopies] = useState(SSR_COPIES);

  useEffect(() => {
    const fit = () => {
      const runWidth = runRef.current?.offsetWidth;
      if (!runWidth) return;
      const needed = Math.ceil(window.innerWidth / runWidth) + 1;
      setCopies((current) => Math.max(current, needed));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const run = (key: number) => (
    <span
      key={key}
      ref={key === 0 ? runRef : undefined}
      className="flex shrink-0 items-center gap-2 pr-2"
      aria-hidden={key > 0}
    >
      {letters.map((ch, i) =>
        ch === " " ? (
          <span key={i} className="w-4" />
        ) : (
          <CircleLetter
            key={i}
            size="size-9 md:size-10"
            className={MARQUEE_FILLS[i % MARQUEE_FILLS.length]}
          >
            {ch}
          </CircleLetter>
        ),
      )}
    </span>
  );

  /* One run as a share of the whole track, so the loop lands on the next
     copy exactly however many there are. */
  const style = { "--marquee-shift": `-${100 / copies}%` } as CSSProperties;

  return (
    <div className="overflow-hidden border-t border-line py-5">
      <div className="flex w-max animate-marquee" style={style}>
        {Array.from({ length: copies }, (_, i) => run(i))}
      </div>
    </div>
  );
}

/* The club's poster box, still a pill, now a real button: ink by default,
   indigo when it is the one thing to press on the page. */
export function Boxed({
  children,
  className = "",
  primary = false,
}: {
  children: ReactNode;
  className?: string;
  primary?: boolean;
}) {
  return (
    <span className={`btn btn-lg ${primary ? "btn-primary" : ""} ${className}`}>
      {children}
    </span>
  );
}

/* Small caps label + big serif title opening each section. */
export function SectionHeading({
  label,
  title,
  className = "",
}: {
  label: string;
  title: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <h2 className="mt-3.5 font-serif text-3xl md:text-[2.5rem] leading-[1.08] tracking-tight max-w-3xl">
        {title}
      </h2>
    </div>
  );
}

/* The top of an interior page: the same three lines everywhere — what this
   is and how much of it there is, the headline, the paragraph — so /directory,
   /clips and /learn open the same way. */
export function PageHeader({
  label,
  title,
  intro,
  children,
}: {
  label: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  /** Filters, search, a row of pills: whatever this page is steered with. */
  children?: ReactNode;
}) {
  return (
    <header className="px-5 md:px-6 pt-20 md:pt-24 pb-10">
      <Label>{label}</Label>
      <h1 className="mt-5 font-serif text-[2.5rem] md:text-[4rem] leading-[1.02] tracking-tight max-w-[56rem]">
        {title}
      </h1>
      {intro && (
        <p className="mt-6 max-w-xl text-base md:text-[1.05rem] leading-relaxed text-muted">
          {intro}
        </p>
      )}
      {children && <div className="mt-9">{children}</div>}
    </header>
  );
}

/* A room: one of the six things the club actually holds, as a card you can
   walk into.
 *
 * This is where the site's colour lives. A room is filled with one of the
 * club's own accents at rest — not on hover — and carries a drawing made of
 * the same motif its page is about, running. The pairing is fixed per room
 * rather than hashed, because a room is a place: the Directory is always the
 * indigo one with the letters turning in it. */
export type RoomColour =
  | "indigo"
  | "warm"
  | "peri"
  | "green"
  | "cream"
  | "paper"
  | "ink";

/* `block-colour`/`block-pale` are what make a room's insides legible: they
   redefine --muted and --line for everything drawn on that colour, so a label
   or a pill inside a room needs no special casing of its own. */
const ROOM_STYLE: Record<RoomColour, { block: string; ink: string }> = {
  indigo: { block: "block-colour bg-accent", ink: "rgba(255,255,255,.55)" },
  warm: { block: "block-colour bg-accent-warm", ink: "rgba(255,255,255,.55)" },
  peri: { block: "block-pale bg-accent-soft", ink: "rgba(13,13,13,.45)" },
  green: { block: "block-colour bg-accent-green", ink: "rgba(255,255,255,.55)" },
  cream: { block: "block-pale bg-accent-cream", ink: "rgba(13,13,13,.4)" },
  paper: { block: "block-pale bg-inset", ink: "rgba(13,13,13,.4)" },
  /* A literal, not bg-foreground: .block-colour redefines --foreground to
     white for its children, so the token would resolve to a white card. */
  ink: { block: "block-colour bg-[#0d0d0d]", ink: "rgba(255,255,255,.45)" },
};

export function Room({
  href,
  number,
  name,
  line,
  count,
  colour,
  kind,
}: {
  href: string;
  number: string;
  name: string;
  line: string;
  count?: string;
  colour: RoomColour;
  kind: IllusKind;
}) {
  const { block, ink } = ROOM_STYLE[colour];
  return (
    <Link
      href={href}
      /* A hairline even on the filled ones: cream on white is otherwise a
         card with no edges, and the ring has to hold all six together. */
      className={`group relative flex min-h-[19rem] flex-col overflow-hidden rounded-[var(--radius)] border border-black/10 p-5 ${block}`}
    >
      <Illustration
        kind={kind}
        ink={ink}
        seed={number}
        className="absolute inset-x-0 top-0 h-[62%] w-full"
      />
      <div className="relative mt-auto flex items-end justify-between gap-3">
        <div>
          <span className="label label-on-colour">{number}</span>
          <h3 className="mt-2 font-serif text-[1.85rem] leading-none tracking-tight group-hover:underline underline-offset-[6px] decoration-1">
            {name}
          </h3>
          <p className="mt-2 max-w-[17rem] text-[13.5px] leading-snug text-muted">
            {line}
          </p>
        </div>
        {count && (
          <span className="pill pill-on-colour shrink-0">
            {count}
          </span>
        )}
      </div>
    </Link>
  );
}

/* A letter's cover: the same six drawers, stopped at an instant its own
   title puts it at, on a ground picked the same way. Nothing is stored and
   nothing is uploaded — a cover is a function of the headline, so the
   archive illustrates itself and a new letter arrives with a picture. */
const COVERS: { block: string; ink: string }[] = [
  { block: "bg-accent", ink: "rgba(255,255,255,.6)" },
  { block: "bg-accent-warm", ink: "rgba(255,255,255,.6)" },
  { block: "bg-accent-soft", ink: "rgba(13,13,13,.5)" },
  { block: "bg-accent-green", ink: "rgba(255,255,255,.6)" },
  { block: "bg-accent-cream", ink: "rgba(13,13,13,.45)" },
  { block: "bg-inset", ink: "rgba(13,13,13,.45)" },
];

const COVER_KINDS: IllusKind[] = [
  "letters",
  "frames",
  "sheet",
  "grid",
  "path",
  "lines",
  "orbit",
];

export function Cover({ title, className = "" }: { title: string; className?: string }) {
  const n = Math.floor(hash01(title) * 42);
  const { block, ink } = COVERS[n % COVERS.length];
  const kind = COVER_KINDS[Math.floor(n / 6) % COVER_KINDS.length];
  return (
    <span className={`block overflow-hidden rounded-[var(--radius-sm)] ${block} ${className}`}>
      <Illustration kind={kind} ink={ink} still={title} className="h-full w-full" />
    </span>
  );
}

/* Roman and italic inside one line is how the club's display type reads, and
   every headline in `components/pages/` writes that mix as <em> by hand. A
   headline the owner edits in the Studio can't: it arrives as a plain string,
   and letting HTML through a content field opens a door nobody wants open. So
   `*a run like this*` flips to italic — the same markup a slide's title takes
   in the Posts Studio, rather than a second convention for the same idea. */
export function Emphasize({ text }: { text: string }) {
  return (
    <>
      {/* A capture group in the pattern puts the wrapped runs on the odd
          indices, so the split is the parse. */}
      {text.split(/\*([^*]+)\*/g).map((part, i) =>
        i % 2 ? <em key={i}>{part}</em> : part,
      )}
    </>
  );
}
