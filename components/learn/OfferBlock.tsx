"use client";

import { useContent } from "@/components/content";
import { Boxed } from "@/components/Motifs";

/* The offer.

   The library is pay-once: you buy it and you keep it, including what gets
   added later. But the price is not decided yet, and a made-up number on a page
   is worse than no number — so this block has two states and the content
   decides which. Fill in `offerPrice` in the Studio and it becomes an offer;
   leave it empty and it asks people to wait, honestly, with the same shape and
   the same weight, so nothing has to be redesigned the day a price exists. */

type Learn = {
  offerTitle?: string;
  offerPrice?: string;
  offerNote?: string;
  offerHref?: string;
  offerIncludes?: string;
  offerCta?: string;
};

export default function OfferBlock({ compact = false }: { compact?: boolean }) {
  const content = useContent();
  const learn = (content as { learn?: Learn }).learn ?? {};
  const { site } = content;

  const price = (learn.offerPrice ?? "").trim();
  const priced = price.length > 0 && (learn.offerHref ?? "").trim().length > 0;

  /* One line per item, because the Studio's object fields are text, textarea
     and select — there is no nested list, and a line-per-item textarea is the
     honest fit rather than a reason to grow the schema. */
  const includes = (learn.offerIncludes ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className={`card px-6 md:px-10 ${compact ? "py-10" : "py-14"}`}>
      <div className="max-w-3xl">
        <p className="text-sm underline underline-offset-4">
          {learn.offerTitle || "The library"}
        </p>

        <h2 className="mt-6 font-serif text-3xl md:text-5xl leading-tight">
          {priced ? (
            <>
              Pay once. <em>Keep it for good.</em>
            </>
          ) : (
            <>
              Not for sale <em>yet</em>.
            </>
          )}
        </h2>

        <p className="mt-6 max-w-md text-sm text-muted leading-relaxed">
          {learn.offerNote ||
            (priced
              ? "One payment, and the library is yours — everything in it today, and everything added to it after."
              : "The club is still writing it. Put your name on the newsletter and you'll hear the day it opens, before anyone else does.")}
        </p>

        {includes.length > 0 && (
          <ul className="mt-10 grid gap-2 sm:grid-cols-2 max-w-2xl">
            {includes.map((line) => (
              <li
                key={line}
                className="inset px-4 py-3 text-sm leading-relaxed"
              >
                {line}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-6">
          {priced ? (
            <>
              <a href={learn.offerHref} target="_blank" rel="noreferrer">
                <Boxed className="text-lg accent-hover transition-colors">
                  {learn.offerCta || "Get the library"}
                </Boxed>
              </a>
              <p className="font-serif text-2xl">{price}</p>
            </>
          ) : (
            <a href={site.subscribe} target="_blank" rel="noreferrer">
              <Boxed className="text-lg accent-hover transition-colors">
                {learn.offerCta || "Tell me when it opens"}
              </Boxed>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
