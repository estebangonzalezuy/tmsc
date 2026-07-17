"use client";

import { studioSection, useContent } from "@/components/content";
import { Boxed } from "@/components/Motifs";

export default function Cta() {
  const { site } = useContent();
  return (
    <section
      {...studioSection("site", "Site & links")}
      className="border-t border-line px-5 md:px-6 py-24 md:py-32 text-center"
    >
      <p className="text-sm underline underline-offset-4">{site.name}</p>
      <h2 className="mt-6 font-serif text-4xl md:text-6xl leading-tight max-w-3xl mx-auto">
        A place to <em>question ourselves</em>
      </h2>
      <p className="mt-6 max-w-md mx-auto text-sm text-muted leading-relaxed">
        One honest letter at a time. Exercises, resources, and real
        conversations about the practice — free, in your inbox.
      </p>
      <div className="mt-10">
        <a href={site.subscribe} target="_blank" rel="noreferrer">
          <Boxed className="text-lg hover:bg-foreground hover:text-background transition-colors">
            Join the newsletter
          </Boxed>
        </a>
      </div>
    </section>
  );
}
