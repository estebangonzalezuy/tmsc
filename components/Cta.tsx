"use client";

import { studioSection, useContent } from "@/components/content";
import { Label } from "@/components/Motifs";

export default function Cta({ title }: { title?: React.ReactNode }) {
  const { site } = useContent();
  return (
    <section
      {...studioSection("site", "Site & links")}
      className="px-5 md:px-6 py-20 md:py-28"
    >
      <Label>{site.name}</Label>
      <h2 className="mt-4 max-w-[12em] font-serif text-[clamp(2.2rem,5vw,3.6rem)] leading-[0.92] tracking-[-0.034em]">
        {title ?? (
          <>
            A place to <em>question ourselves</em>
          </>
        )}
      </h2>
      <p className="mt-6 max-w-md text-base leading-relaxed text-foreground">
        The letter is free. The exercises are here. The references are here.
        Read one, or do one.
      </p>
      <div className="mt-9">
        <a
          href={site.subscribe}
          target="_blank"
          rel="noreferrer"
          className="btn btn-lg btn-primary"
        >
          Join the newsletter
        </a>
      </div>
    </section>
  );
}
