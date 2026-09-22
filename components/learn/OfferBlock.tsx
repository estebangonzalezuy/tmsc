"use client";

import { useContent } from "@/components/content";
import { Label } from "@/components/Motifs";

/* The offer.

   The library is pay-once: you buy it and you keep it, including what gets
   added later. But the price is not decided yet, and a made-up number on a page
   is worse than no number — so this block has two states and the content
   decides which. Fill in `offerPrice` in the Studio and it becomes an offer;
   leave it empty and it asks people to wait, honestly, with the same shape and
   the same weight, so nothing has to be redesigned the day a price exists.

   It is also the one block of colour on the pages that carry it: indigo, the
   club's own, which is how the site says "this is the thing to press" without
   a second typeface or a bigger heading. `.block-colour` redefines the tokens
   its children read, so the muted paragraph and the hairlines inside it are
   white tints rather than every child being special-cased. */

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
    <div
      className={`block-colour block-indigo px-6 md:px-12 ${
        compact ? "py-10 md:py-12" : "py-12 md:py-16"
      }`}
    >
      <div className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:gap-14">
        <div>
          <Label>{learn.offerTitle || "The library"}</Label>
          <h2 className="mt-3.5 font-serif text-3xl md:text-[2.5rem] leading-[1.08] tracking-tight">
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
          <p className="mt-5 max-w-md text-[15px] text-muted leading-relaxed">
            {learn.offerNote ||
              (priced
                ? "One payment, and the library is yours — everything in it today, and everything added to it after."
                : "The club is still writing it. Put your name on the newsletter and you'll hear the day it opens, before anyone else does.")}
          </p>
        </div>

        <div>
          {includes.length > 0 && (
            <ul className="row-divide border-t border-line text-[15px]">
              {includes.map((line) => (
                <li key={line} className="flex gap-4 py-3.5 leading-snug">
                  <span aria-hidden className="text-muted">
                    —
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-5">
            {priced ? (
              <>
                <a
                  href={learn.offerHref}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-lg btn-on-colour"
                >
                  {learn.offerCta || "Get the library"}
                </a>
                <p className="font-serif text-2xl">{price}</p>
              </>
            ) : (
              <a
                href={site.subscribe}
                target="_blank"
                rel="noreferrer"
                className="btn btn-lg btn-on-colour"
              >
                {learn.offerCta || "Tell me when it opens"}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
