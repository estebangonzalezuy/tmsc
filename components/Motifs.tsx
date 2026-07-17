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
    <span
      className={`inline-flex items-center justify-center rounded-full border border-line bg-background text-sm ${size} ${className}`}
    >
      {children}
    </span>
  );
}

/* Scrolling band of circled letters. */
export function LetterMarquee({ text }: { text: string }) {
  const letters = text.replace(/\s+/g, " ").split("");
  const run = (
    <span className="flex shrink-0 items-center gap-2 pr-2">
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
  return (
    <div className="overflow-hidden border-y border-line py-4">
      <div className="flex w-max animate-marquee">
        {run}
        {run}
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
