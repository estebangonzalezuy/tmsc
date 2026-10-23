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
        One honest letter at a time. Exercises, resources, and real
        conversations about the practice. Free, in your inbox.
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
