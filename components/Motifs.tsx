"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

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
      className={`inline-flex items-center justify-center rounded-full border border-line bg-background text-foreground text-sm ${size} ${className}`}
    >
      {children}
    </span>
  );
}

/* Which palette colour a thing lights up in. Stable, not shuffled: the same
   card is always the same colour, so a grid doesn't rearrange itself between
   visits, while neighbours still differ because the key differs. Pale and
   saturated fills carry their own type colour (see globals.css), so every
   pairing stays legible. */
const ACCENT_HOVERS = [
  "accent-green-hover",
  "accent-indigo-hover",
  "accent-warm-hover",
  "accent-soft-hover",
] as const;

/* Type-only links drop the pale fill: legible under white type is not the
   same as legible as type. */
const ACCENT_HOVER_TEXTS = [
  "accent-green-hover",
  "accent-indigo-hover",
  "accent-warm-hover",
] as const;

function hash(key: string | number): number {
  const s = String(key);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return h;
}

export function accentHover(key: string | number): string {
  return `accent-hover ${ACCENT_HOVERS[hash(key) % ACCENT_HOVERS.length]}`;
}

export function accentHoverText(key: string | number): string {
  return `accent-hover-text ${
    ACCENT_HOVER_TEXTS[hash(key) % ACCENT_HOVER_TEXTS.length]
  }`;
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
    <div className="overflow-hidden border-y border-line py-4">
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
      className={`absolute rounded-full border border-foreground/25 ${className}`}
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
    <span className={`inline-block border border-line px-4 py-2 ${className}`}>
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
