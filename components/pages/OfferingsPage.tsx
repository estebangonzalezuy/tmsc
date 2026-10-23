"use client";

import { hiddenSet, studioSection, useContent } from "@/components/content";
import { Boxed, PageHeader } from "@/components/Motifs";
import Cta from "@/components/Cta";

export default function OfferingsPage() {
  const content = useContent();
  const { site, offerings } = content;
  const hidden = hiddenSet(content);

  return (
    <>
      <PageHeader
        label="Offerings"
        title={
          <>
            Ways to practice <em>with the club</em>, honestly labeled.
          </>
        }
        intro="Some things are live, some are resting, some are still being designed. The club would rather tell you which is which."
      />

      {!hidden.has("offerings") && (
      <section
        {...studioSection("offerings", "Offerings")}
        className="px-5 md:px-6"
      >
        {offerings.map((o) => (
          <article
            key={o.name}
            className="grid gap-6 border-t border-line py-8 md:grid-cols-[8rem_1fr_auto] md:items-start"
          >
            <p
              className={`pill self-start justify-self-start ${o.status === "Live" ? "pill-free" : ""}`}
            >
              {o.status}
            </p>
            <div>
              <h2 className="font-serif text-3xl">
                {o.name}
                {o.price && (
                  <span className="ml-3 text-base align-middle">
                    {o.price}
                  </span>
                )}
              </h2>
              <p className="mt-4 max-w-xl text-sm text-muted leading-relaxed">
                {o.blurb}
              </p>
            </div>
            <a
              href={o.href}
              target="_blank"
              rel="noreferrer"
              className="self-center"
            >
              <Boxed className="text-sm accent-hover transition-colors">
                {o.cta}
              </Boxed>
            </a>
          </article>
        ))}
      </section>
      )}

      <section className="bg-accent-soft px-5 py-16 text-black md:px-6 md:py-24">
        <p className="max-w-[16em] font-serif text-[clamp(1.8rem,4vw,3.2rem)] leading-[0.95] tracking-[-0.034em]">
          Nothing here is urgent. The newsletter is where everything begins.
        </p>
        <a
          href={site.subscribe}
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-block text-sm underline underline-offset-4 accent-hover-text transition-colors"
        >
          Start there →
        </a>
      </section>

      <Cta />
    </>
  );
}
