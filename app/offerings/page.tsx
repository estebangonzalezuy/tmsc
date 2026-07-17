import type { Metadata } from "next";
import { site, offerings } from "@/lib/data";
import { Boxed } from "@/components/Motifs";
import Cta from "@/components/Cta";

export const metadata: Metadata = {
  title: `Offerings — ${site.name}`,
};

export default function Offerings() {
  return (
    <>
      <section className="px-5 md:px-6 py-24 md:py-32">
        <p className="text-sm underline underline-offset-4">Offerings</p>
        <h1 className="mt-8 font-serif text-4xl md:text-6xl leading-tight max-w-4xl">
          Ways to practice <em>with the club</em>, honestly labeled.
        </h1>
        <p className="mt-8 max-w-md text-sm text-muted leading-relaxed">
          Some things are live, some are resting, some are still being
          designed. The club would rather tell you which is which.
        </p>
      </section>

      <section className="border-t border-line">
        {offerings.map((o) => (
          <article
            key={o.name}
            className="grid gap-6 border-b border-line px-5 md:px-6 py-14 md:grid-cols-[8rem_1fr_auto] md:items-start"
          >
            <p className="text-xs text-muted border border-line/40 rounded-full self-start justify-self-start px-2.5 py-0.5">
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
              <Boxed className="text-sm hover:bg-foreground hover:text-background transition-colors">
                {o.cta}
              </Boxed>
            </a>
          </article>
        ))}
      </section>

      <section className="border-t-0 px-5 md:px-6 py-24 text-center">
        <p className="font-serif italic text-2xl md:text-4xl leading-tight max-w-2xl mx-auto">
          Nothing here is urgent. The newsletter is where everything begins.
        </p>
        <a
          href={site.subscribe}
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-block text-sm underline underline-offset-4 hover:text-muted transition-colors"
        >
          Start there →
        </a>
      </section>

      <Cta />
    </>
  );
}
