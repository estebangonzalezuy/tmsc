"use client";

import OfferBlock from "./OfferBlock";

/* Where a paid piece stops.
   
   There is nothing to unlock here, and the wording should not imply there is:
   the rest of this piece was never built into the site. What the reader is
   looking at is the whole of what was published. */

export default function LockedPanel({ locked }: { locked: number }) {
  return (
    <section className="mt-16 max-w-2xl">
      <div className="inset px-6 py-8 text-center">
        <p className="text-xs underline underline-offset-4">
          The rest of this piece
        </p>
        <p className="mt-4 text-sm text-muted leading-relaxed max-w-md mx-auto">
          {locked > 0
            ? `Another ${locked} sections, including what to do about it. They come with the library.`
            : "The rest comes with the library."}
        </p>
      </div>
      <div className="mt-3">
        <OfferBlock compact />
      </div>
    </section>
  );
}
