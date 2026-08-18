"use client";

import { hiddenSet, studioSection, useContent } from "@/components/content";
import { Boxed, SectionHeading } from "@/components/Motifs";
import manifest from "@/content/directory/manifest.json";

// The Directory's side of the pitch is counted, not written: a sponsor is
// being told how big the shelf is, and a number typed into the copy would be
// wrong the next time build.mjs runs.
const indexed = [
  { value: String(manifest.total), label: "entries indexed" },
  { value: String(manifest.collections.length), label: "collections" },
  ...["studios", "courses", "tools"].map((id) => {
    const c = manifest.collections.find((x) => x.id === id);
    return { value: String(c?.count ?? 0), label: (c?.name ?? id).toLowerCase() };
  }),
];

export default function SponsorsPage() {
  const content = useContent();
  const { site } = content;
  const hidden = hiddenSet(content);
  const sponsorship = content.sponsorship;
  const reach = content.sponsorReach;
  const placements = content.sponsorPlacements;
  const rules = content.sponsorRules;

  const mailto = `mailto:${site.email}?subject=${encodeURIComponent(
    "Sponsoring the Motion Social Club",
  )}`;

  return (
    <>
      <section
        {...studioSection("sponsorship", "Sponsorship")}
        className="px-5 md:px-6 py-24 md:py-32"
      >
        <p className="text-sm underline underline-offset-4">
          {sponsorship.label}
        </p>
        <h1 className="mt-8 font-serif text-4xl md:text-6xl leading-tight max-w-4xl">
          The club has an audience. Here is <em>what it costs</em> to reach it.
        </h1>
        <p className="mt-8 max-w-md text-sm text-muted leading-relaxed">
          {sponsorship.intro}
        </p>
        <div className="mt-10">
          <a href={mailto}>
            <Boxed className="accent-hover transition-colors">
              Email about a slot
            </Boxed>
          </a>
        </div>
      </section>

      {!hidden.has("sponsorReach") && reach.length > 0 && (
        <section
          {...studioSection("sponsorReach", "Reach")}
          className="px-5 md:px-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {reach.map((r) => (
            <div key={r.label} className="card p-6">
              <p className="font-serif text-4xl">{r.value}</p>
              <p className="mt-3 text-sm">{r.label}</p>
              <p className="mt-1 text-xs text-muted leading-relaxed">{r.note}</p>
            </div>
          ))}
        </section>
      )}

      {!hidden.has("directory") && (
        <section
          className="px-5 md:px-6 py-24 md:py-32"
        >
          <SectionHeading
            label="the Directory"
            title={
              <>
                And a shelf people arrive at <em>ready to buy</em>.
              </>
            }
          />
          <p className="mt-8 max-w-md text-sm text-muted leading-relaxed">
            Somebody filtering the Directory by price and level is further down
            the road than somebody reading an essay. It is the newest thing the
            club has built and the only surface here with buying intent on it.
          </p>
          <dl className="mt-12 grid grid-cols-2 md:grid-cols-5 gap-3">
            {indexed.map((s) => (
              <div key={s.label} className="card p-6">
                <dt className="text-xs text-muted">{s.label}</dt>
                <dd className="mt-2 font-serif text-3xl">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {!hidden.has("sponsorPlacements") && placements.length > 0 && (
        <section
          {...studioSection("sponsorPlacements", "Sponsor placements")}
          className="px-5 md:px-6 py-24 md:py-32"
        >
          <SectionHeading
            label="Placements"
            title={
              <>
                Five slots, <em>priced in public</em>.
              </>
            }
          />
          <div className="mt-12 grid gap-3">
            {placements.map((p) => (
              <article
                key={p.name}
                className="card grid gap-6 px-8 py-10 md:grid-cols-[8rem_1fr_10rem] md:items-start"
              >
                <p className="text-xs text-muted pill self-start justify-self-start">
                  {p.status}
                </p>
                <div>
                  <h2 className="font-serif text-3xl">{p.name}</h2>
                  <p className="mt-2 text-sm text-muted">
                    {p.reach}
                  </p>
                  <p className="mt-4 max-w-xl text-sm text-muted leading-relaxed">
                    {p.blurb}
                  </p>
                </div>
                <p className="font-serif text-2xl md:text-right">{p.price}</p>
              </article>
            ))}
          </div>
          <p className="mt-8 max-w-md text-sm text-muted leading-relaxed">
            Ranges, not a price list: a single letter and a year-long run of
            them are not the same conversation. Tell me what you make and I&apos;ll
            tell you which slot is honest for it.
          </p>
        </section>
      )}

      {!hidden.has("sponsorRules") && rules.length > 0 && (
        <section
          {...studioSection("sponsorRules", "House rules")}
          className="px-5 md:px-6 py-24 md:py-32"
        >
          <SectionHeading
            label="House rules"
            title={
              <>
                What the club <em>won&apos;t</em> do.
              </>
            }
          />
          <ul className="mt-12 card row-divide px-6">
            {rules.map((r, i) => (
              <li key={i} className="flex items-start gap-6 py-6">
                <span className="text-xs text-muted w-8 shrink-0 pt-1">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="max-w-2xl leading-relaxed">{r}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-md text-sm text-muted leading-relaxed">
            {sponsorship.note}
          </p>
        </section>
      )}

      <section
        {...studioSection("site", "Site & links")}
        className="px-5 md:px-6 py-24 md:py-32 text-center"
      >
        <p className="text-sm underline underline-offset-4">{site.name}</p>
        <h2 className="mt-6 font-serif text-4xl md:text-6xl leading-tight max-w-3xl mx-auto">
          One email is the <em>whole process</em>
        </h2>
        <p className="mt-6 max-w-md mx-auto text-sm text-muted leading-relaxed">
          No deck, no media kit, no call to book a call. Say what you make and
          which slot you want, and you&apos;ll get a yes, a no, or a better idea.
        </p>
        <div className="mt-10">
          <a href={mailto}>
            <Boxed className="text-lg accent-hover transition-colors">
              {site.email}
            </Boxed>
          </a>
        </div>
      </section>
    </>
  );
}
