import Link from "next/link";
import Cta from "@/components/Cta";
import { KIND_LABEL, type Update } from "@/lib/learn";

/* What's been added, newest first. A view of each piece's own `updated` field
   rather than a second list to keep in step — so a piece can never appear here
   and not in the library, or change its date in one place only. */

const MONTH = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
};

const DAY = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
};

export default function LearnUpdatesPage({ updates }: { updates: Update[] }) {
  const months: { month: string; items: Update[] }[] = [];
  for (const u of updates) {
    const month = MONTH(u.updated);
    const last = months[months.length - 1];
    if (last && last.month === month) last.items.push(u);
    else months.push({ month, items: [u] });
  }

  return (
    <>
      <section className="px-5 md:px-6 py-24 md:py-32">
        <p className="text-sm">
          <Link href="/learn" className="underline underline-offset-4">
            Learn
          </Link>
          <span className="text-muted"> / Updates</span>
        </p>
        <h1 className="mt-8 font-serif text-4xl md:text-6xl leading-tight max-w-3xl">
          What&apos;s been <em>added</em>.
        </h1>
        <p className="mt-8 max-w-md text-sm text-muted leading-relaxed">
          The library grows. Everything written so far, newest first — and
          everything added after you buy it is yours too.
        </p>
      </section>

      <section className="px-5 md:px-6 pb-24">
        {updates.length === 0 ? (
          <p className="text-sm text-muted">Nothing published yet.</p>
        ) : (
          months.map((group) => (
            <div key={group.month} className="mb-12">
              <p className="text-sm underline underline-offset-4">{group.month}</p>
              <ul className="mt-6 card row-divide px-6">
                {group.items.map((u) => (
                  <li key={u.slug}>
                    <Link
                      href={`/learn/${u.track}/${u.slug}`}
                      className="group grid grid-cols-[4.5rem_1fr_auto] items-baseline gap-4 py-5"
                    >
                      <span className="text-xs text-muted">{DAY(u.updated)}</span>
                      <span>
                        <span className="font-serif text-xl group-hover:underline underline-offset-4">
                          {u.title}
                        </span>
                        <span className="mt-2 block text-sm text-muted leading-relaxed">
                          {u.blurb}
                        </span>
                      </span>
                      <span className="text-xs text-muted whitespace-nowrap">
                        {KIND_LABEL[u.kind]}
                        {u.access === "free" && " · Open"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <Cta />
    </>
  );
}
