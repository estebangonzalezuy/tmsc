"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

/* The two hover helpers live in lib/accent.ts rather than here, because this
   module is "use client" and a server component cannot call a function out of
   one — only render a component from it. They are re-exported so every
   existing import of them from Motifs keeps working, and so this stays the
   one place to look for the design system. */
export { accentHover, accentHoverText } from "@/lib/accent";

/* Circled letter — the recurring mark from the club's poster graphics. */
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
    /* text-foreground rather than inherit: the circle keeps its own white
       ground, so a letter that followed a hovering card's colour would turn
       white on white and vanish. */
    <span
      className={`inline-flex items-center justify-center rounded-full bg-surface text-foreground text-sm shadow-[0_1px_3px_rgba(13,13,13,0.10)] ${size} ${className}`}
    >
      {children}
    </span>
  );
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
          <CircleLetter key={i} size="size-10 md:size-12">
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
    /* The band keeps its full bleed but loses the rules above and below;
       the circles now read against the ground on their own. */
    <div className="overflow-hidden py-6">
      <div className="flex w-max animate-marquee" style={style}>
        {Array.from({ length: copies }, (_, i) => run(i))}
      </div>
    </div>
  );
}

/* A ring of orbiting circled letters, letters kept upright. */
export function OrbitRing({
  letters,
  size,
  duration = "60s",
  className = "",
}: {
  letters: string[];
  size: number;
  duration?: string;
  className?: string;
}) {
  const orbitStyle = { "--orbit-duration": duration } as CSSProperties;
  return (
    <div
      className={`absolute rounded-full border border-foreground/15 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div className="absolute inset-0 animate-orbit" style={orbitStyle}>
        {letters.map((ch, i) => {
          const angle = (i / letters.length) * 360;
          return (
            <span
              key={i}
              className="absolute top-1/2 left-1/2 -ml-4 -mt-4"
              style={{
                transform: `rotate(${angle}deg) translateY(${-size / 2}px)`,
              }}
            >
              <span
                className="block animate-orbit-reverse"
                style={{ ...orbitStyle, transform: `rotate(${-angle}deg)` }}
              >
                <CircleLetter size="size-8">{ch}</CircleLetter>
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* Outlined box around a headline, as in the club's poster typography. */
export function Boxed({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    /* Was an outlined box; now a small floating surface, so the motif
       survives the redesign as a pill rather than a drawn rectangle. */
    <span
      className={`inline-block card rounded-full px-6 py-3 ${className}`}
    >
      {children}
    </span>
  );
}

/* Small underlined label + big serif title opening each section. */
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
      <p className="text-sm underline underline-offset-4">{label}</p>
      <h2 className="mt-4 font-serif text-3xl md:text-5xl leading-tight max-w-3xl">
        {title}
      </h2>
    </div>
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
