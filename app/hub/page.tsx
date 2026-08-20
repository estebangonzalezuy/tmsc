import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/data";

// the Hub — one page that knows where everything is. No state, no token,
// no API calls: a page you can open on a bad connection and still find the
// thing you were looking for. The Desk runs the machine; this just points.

export const metadata: Metadata = {
  title: "the Hub — the Motion Social Club",
  robots: { index: false, follow: false },
};

const NOTION_HUB = "https://app.notion.com/p/f642c850e5cb4837b34ac2f5aa2827ae";

type Row = { href: string; name: string; what: string; external?: boolean };

const groups: { title: string; note: string; rows: Row[] }[] = [
  {
    title: "Make",
    note: "where the work happens",
    rows: [
      { href: "/desk", name: "the Desk", what: "start a run, see what's going" },
      { href: "/tools", name: "the Tools", what: "a post from four questions" },
      { href: "/postlab", name: "the Posts Studio", what: "every control, when a tool isn't enough" },
      { href: "/kinetics", name: "the Kinetics", what: "when the words are the picture, and all of it moves" },
      { href: "/tiles", name: "the Tiles", what: "framed squares of hand-cut ornament, turning" },
      { href: "/studio", name: "the Studio", what: "the site's own words" },
      { href: "/curate", name: "the Curator", what: "a video in, style frames out" },
    ],
  },
  {
    title: "Content",
    note: "in Notion",
    rows: [
      {
        href: "https://app.notion.com/p/a1760675de4644978f03e1d158aa2817",
        name: "the Journal",
        what: "where a thought goes in",
        external: true,
      },
      {
        href: "https://app.notion.com/p/646f0309b2d34014904569d0ed95ad93",
        name: "the Pipeline",
        what: "every post, start to finish",
        external: true,
      },
      {
        href: "https://app.notion.com/p/d368165d8fd54e548aea7eaecf27d9e7",
        name: "the library",
        what: "everything published",
        external: true,
      },
      {
        href: "https://app.notion.com/p/d33ba4bc712b422f8bfecfb653a3507c",
        name: "the Objectives",
        what: "what this month is for",
        external: true,
      },
      { href: NOTION_HUB, name: "the Notion hub", what: "everything else", external: true },
    ],
  },
  {
    title: "Out there",
    note: "what people see",
    rows: [
      { href: "/", name: "the site", what: "themotionsocialclub" },
      // Off the nav on purpose — reachable by link until the wall has enough
      // on it to earn a place in the menu. Flip it back on in the Studio's
      // Navigation panel.
      { href: "/stills", name: "Stills", what: "the wall, link-only for now" },
      { href: site.substack, name: "the newsletter", what: "Human & Motion", external: true },
      { href: site.linkedin, name: "LinkedIn", what: "the main channel", external: true },
      { href: site.instagram, name: "Instagram", what: "where the posts go", external: true },
      { href: `mailto:${site.email}`, name: "email", what: site.email, external: true },
    ],
  },
  {
    title: "Machinery",
    note: "only when something breaks",
    rows: [
      {
        href: "https://github.com/estebangonzalezuy/tmsc/actions",
        name: "the runs",
        what: "logs, and why one failed",
        external: true,
      },
      {
        href: "https://github.com/estebangonzalezuy/tmsc/blob/main/docs/CONTENT-SYSTEM.md",
        name: "how it all works",
        what: "the whole system, written down",
        external: true,
      },
    ],
  },
];

export default function HubPage() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line px-5 py-3 flex items-center gap-3">
        <span className="inline-flex items-center justify-center rounded-full border border-line size-8 text-xs">
          M
        </span>
        <span className="font-serif italic text-lg">the Hub</span>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <div className="grid gap-10 md:grid-cols-2">
          {groups.map((g) => (
            <section key={g.title}>
              <h2 className="flex items-baseline justify-between gap-3">
                <span className="text-xs uppercase tracking-widest underline underline-offset-4">
                  {g.title}
                </span>
                <span className="text-xs text-muted">{g.note}</span>
              </h2>
              <ul className="mt-4 grid gap-px bg-line border border-line text-sm">
                {g.rows.map((r) => {
                  const inner = (
                    <>
                      <span>{r.name}</span>
                      <span className="text-xs opacity-60 text-right">{r.what}</span>
                    </>
                  );
                  const cls =
                    "bg-background flex items-baseline justify-between gap-4 px-5 py-3 hover:bg-foreground hover:text-background transition-colors";
                  return (
                    <li key={r.name}>
                      {r.external ? (
                        <a href={r.href} target="_blank" rel="noreferrer" className={cls}>
                          {inner}
                        </a>
                      ) : (
                        <Link href={r.href} className={cls}>
                          {inner}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-12 text-xs text-muted leading-relaxed max-w-md">
          A thought becomes a post like this: write it in the Journal, mark it
          “Make post”, press the button on the Desk, open the Post Lab to
          export the visual. Everything else is somewhere above.
        </p>
      </main>
    </div>
  );
}
