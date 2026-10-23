"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
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
      className={`inline-flex items-center justify-center bg-accent font-semibold leading-none text-white ${size} ${className}`}
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

/* A typographic ticker: the name, large, on blue. No circled letters —
   the band is type and a flat field, the same way a room is. */
export function LetterMarquee({ text }: { text: string }) {
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
      className="shrink-0 pr-8 text-[clamp(1.35rem,3.2vw,2.4rem)] font-semibold leading-none tracking-[-0.04em]"
      aria-hidden={key > 0}
    >
      {text}
    </span>
  );

  /* One run as a share of the whole track, so the loop lands on the next
     copy exactly however many there are. */
  const style = { "--marquee-shift": `-${100 / copies}%` } as CSSProperties;

  return (
    <div className="overflow-hidden border-y border-foreground bg-accent text-white">
      <div className="flex w-max animate-marquee py-3" style={style}>
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
      <h2 className="mt-3 font-serif text-[clamp(2rem,4.2vw,3.4rem)] leading-[0.95] tracking-[-0.034em]">
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
    <header className="px-5 md:px-6 pt-12 md:pt-16 pb-10">
      <Label>{label}</Label>
      <h1 className="mt-4 font-serif text-[clamp(2.6rem,7vw,5.75rem)] leading-[0.92] tracking-[-0.034em]">
        {title}
      </h1>
      {intro && (
        <p className="mt-6 max-w-xl text-base leading-relaxed text-foreground md:text-lg">
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
/* Blue takes white type, red and yellow take black, white is the page
   itself with a rule around it. The drawing that used to sit in the top of
   a room is gone: a room is its name. `kind` stays on the spec so the
   wiring in lib/rooms.ts does not have to move. */
const ROOM_STYLE: Record<RoomColour, string> = {
  indigo: "block-colour bg-accent",
  warm: "block-colour bg-accent-warm",
  peri: "block-pale bg-accent-soft",
  green: "block-colour bg-accent",
  cream: "block-pale bg-accent-cream",
  paper: "bg-background text-foreground",
  ink: "bg-background text-foreground",
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
  const block = ROOM_STYLE[colour];
  return (
    <Link
      href={href}
      data-motif={kind}
      className={`group flex min-h-[16rem] flex-col justify-end p-5 md:min-h-[22rem] md:p-7 ${block}`}
    >
      <span className="label label-on-colour">{number}</span>
      <h3 className="mt-3 font-serif text-[clamp(2rem,4vw,3.15rem)] leading-[0.9] tracking-[-0.034em] group-hover:underline underline-offset-[5px] decoration-1">
        {name}
      </h3>
      <p className="mt-3 max-w-[24rem] text-sm leading-snug">{line}</p>
      {count && <p className="mt-5 text-xs">{count}</p>}
    </Link>
  );
}

/* A letter's cover: the same six drawers, stopped at an instant its own
   title puts it at, on a ground picked the same way. Nothing is stored and
   nothing is uploaded — a cover is a function of the headline, so the
   archive illustrates itself and a new letter arrives with a picture. */
/* A letter's swatch: a flat field, picked from the title, sitting beside
   the words. The drawing is gone; the colour is the picture. */
const COVERS = ["bg-accent", "bg-accent-warm", "bg-accent-soft"] as const;

export function Cover({ title, className = "" }: { title: string; className?: string }) {
  const block = COVERS[Math.floor(hash01(title) * 42) % COVERS.length];
  return <span className={`block ${block} ${className}`} />;
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
