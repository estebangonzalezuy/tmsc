"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { DirectoryCollection, DirectoryEntry } from "@/lib/directory";
import { CircleLetter, accentHover } from "@/components/Motifs";
import Cta from "@/components/Cta";

// How many values of a facet to show before folding the rest away. Cities run
// to 150+, so the rail would otherwise bury the list.
const VISIBLE_FACET_VALUES = 14;

function matches(entry: DirectoryEntry, query: string) {
  if (!query) return true;
  const haystack = [
    entry.name,
    entry.note ?? "",
    entry.meta ?? "",
    ...Object.values(entry.facets).flat(),
  ]
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

export default function DirectoryCollectionPage({
  collection,
}: {
  collection: DirectoryCollection;
}) {
  const router = useRouter();
  const params = useSearchParams();

  // Filters live in the URL so a filtered view is a shareable link — the same
  // contract the Post Lab has with its #spec=.
  const query = params.get("q") ?? "";
  const active = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const facet of collection.facets) {
      const values = params.getAll(facet.key);
      if (values.length) map[facet.key] = values;
    }
    return map;
  }, [params, collection.facets]);

  const activeCount = Object.values(active).reduce((n, v) => n + v.length, 0);

  const setParams = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [params, router],
  );

  const toggle = useCallback(
    (key: string, value: string) => {
      setParams((next) => {
        const current = next.getAll(key);
        next.delete(key);
        for (const v of current) {
          if (v !== value) next.append(key, v);
        }
        if (!current.includes(value)) next.append(key, value);
      });
    },
    [setParams],
  );

  const setQuery = useCallback(
    (value: string) => {
      setParams((next) => {
        if (value) next.set("q", value);
        else next.delete("q");
      });
    },
    [setParams],
  );

  const results = useMemo(
    () =>
      collection.entries.filter((entry) => {
        if (!matches(entry, query)) return false;
        // Values within one facet are OR'd (New York or London); separate
        // facets are AND'd (in London AND mostly 3D).
        return Object.entries(active).every(([key, values]) =>
          values.some((v) => entry.facets[key]?.includes(v)),
        );
      }),
    [collection.entries, query, active],
  );

  return (
    <>
      <section className="px-5 md:px-6 pt-16 pb-12 md:pt-20">
        <p className="text-sm">
          <Link href="/directory" className="underline underline-offset-4">
            the Directory
          </Link>
          <span className="text-muted"> / {collection.name}</span>
        </p>
        <div className="mt-8 flex items-start gap-5">
          <CircleLetter size="size-11 shrink-0">{collection.letter}</CircleLetter>
          <div>
            <h1 className="font-serif text-4xl md:text-6xl leading-tight">
              {collection.name}
            </h1>
            <p className="mt-6 max-w-xl text-sm text-muted leading-relaxed">
              {collection.blurb}
            </p>
            <p className="mt-4 text-xs text-muted">
              {collection.count} entries ·{" "}
              {collection.source === "notion"
                ? "exported from the club's own database"
                : "seeded from experience, links not yet checked"}
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 md:px-6 py-6">
        <label className="block">
          <span className="sr-only">Search {collection.name}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${collection.count} entries…`}
            className="w-full card rounded-full px-5 py-3 text-sm placeholder:text-muted focus:outline-none"
          />
        </label>
      </section>

      {collection.facets.length > 0 && (
        <section className="px-5 md:px-6 pb-6">
          <div className="card px-6 py-6 space-y-5">
            {collection.facets.map((facet) => (
              <FacetRow
                key={facet.key}
                facet={facet}
                active={active[facet.key] ?? []}
                onToggle={toggle}
              />
            ))}
          </div>
        </section>
      )}

      <section className="px-5 md:px-6 py-4 flex items-baseline justify-between gap-4 text-sm">
        <p>
          <span className="font-serif text-xl">{results.length}</span>{" "}
          <span className="text-muted">
            {results.length === 1 ? "entry" : "entries"}
            {results.length !== collection.count && ` of ${collection.count}`}
          </span>
        </p>
        {(activeCount > 0 || query) && (
          <button
            onClick={() => router.replace("?", { scroll: false })}
            className="underline underline-offset-4 accent-hover-text transition-colors"
          >
            Clear {activeCount > 0 ? `${activeCount} filter${activeCount > 1 ? "s" : ""}` : "search"}
          </button>
        )}
      </section>

      <section className="px-5 md:px-6 pb-8">
        {results.length === 0 ? (
          <p className="card px-6 py-16 text-sm text-muted">
            Nothing matches that. Try fewer filters.
          </p>
        ) : (
          <ul className="card row-divide px-6">
            {results.map((entry) => (
              <Row key={entry.id} entry={entry} action={collection.action} />
            ))}
          </ul>
        )}
      </section>

      <Cta />
    </>
  );
}

function FacetRow({
  facet,
  active,
  onToggle,
}: {
  facet: DirectoryCollection["facets"][number];
  active: string[];
  onToggle: (key: string, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const overflows = facet.values.length > VISIBLE_FACET_VALUES;
  // Selected values always stay visible, even when they sit in the folded tail.
  const shown =
    expanded || !overflows
      ? facet.values
      : facet.values
          .slice(0, VISIBLE_FACET_VALUES)
          .concat(
            facet.values
              .slice(VISIBLE_FACET_VALUES)
              .filter((v) => active.includes(v.value)),
          );

  return (
    <div className="grid md:grid-cols-[7rem_1fr] gap-2 md:gap-4 items-baseline">
      <p className="text-xs text-muted">{facet.label}</p>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((v) => {
          const on = active.includes(v.value);
          return (
            <button
              key={v.value}
              onClick={() => onToggle(facet.key, v.value)}
              aria-pressed={on}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                on
                  ? "bg-foreground text-background"
                  : `card ${accentHover(v.value)}`
              }`}
            >
              {v.value}{" "}
              <span className={on ? "text-background/60" : "text-muted"}>
                {v.count}
              </span>
            </button>
          );
        })}
        {overflows && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="px-2 py-1 text-xs underline underline-offset-4 accent-hover-text transition-colors"
          >
            {expanded
              ? "Show fewer"
              : `Show all ${facet.values.length}`}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ entry, action }: { entry: DirectoryEntry; action: string }) {
  // Deduped because some facets legitimately overlap: a studio in Hong Kong
  // or Singapore carries the same value as both its city and its country.
  const tags = [...new Set(Object.values(entry.facets).flat())];

  // Books, the glossary and the timeline carry no link. Those rows are things
  // to read, not things to click, so they take none of the hover treatment,
  // which also keeps the muted text from inverting to white on white.
  const linked = Boolean(entry.href);
  const dimmed = linked ? "text-muted accent-hover-sub" : "text-muted";

  const body = (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <h2
          className={`font-serif text-xl md:text-2xl ${
            linked ? "group-hover:underline underline-offset-4" : ""
          }`}
        >
          {entry.name}
        </h2>
        {entry.meta && (
          <span className={`shrink-0 text-xs text-right ${dimmed}`}>
            {entry.meta}
          </span>
        )}
      </div>
      {entry.note && (
        <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${dimmed}`}>
          {entry.note}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {tags.map((tag) => (
          <span key={tag} className={`text-xs ${dimmed}`}>
            {tag}
          </span>
        ))}
        {linked && action && (
          <span className="text-xs underline underline-offset-4 ml-auto">
            {action} →
          </span>
        )}
      </div>
    </>
  );

  return (
    <li>
      {linked ? (
        <a
          href={entry.href}
          target="_blank"
          rel="noreferrer"
          className="group block px-5 md:px-6 py-6 accent-hover transition-colors"
        >
          {body}
        </a>
      ) : (
        <div className="block px-5 md:px-6 py-6">{body}</div>
      )}
    </li>
  );
}
