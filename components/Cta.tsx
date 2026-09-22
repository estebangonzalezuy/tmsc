"use client";

import { studioSection, useContent } from "@/components/content";
import { Label } from "@/components/Motifs";

export default function Cta({ title }: { title?: React.ReactNode }) {
  const { site } = useContent();
  return (
    <section
      {...studioSection("site", "Site & links")}
      className="px-5 md:px-6 py-24 md:py-32 text-center"
    >
      <Label>{site.name}</Label>
      <h2 className="mt-4 font-serif text-4xl md:text-[3.25rem] leading-[1.06] tracking-tight max-w-3xl mx-auto">
        {title ?? (
          <>
            A place to <em>question ourselves</em>
          </>
        )}
      </h2>
      <p className="mt-6 max-w-md mx-auto text-sm text-muted leading-relaxed">
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
