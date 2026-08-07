#!/usr/bin/env node
// Builds content/directory/*.json (the Directory's data) from the TSV sources in
// scripts/directory/sources/. The TSVs are the editable form: one line per entry,
// no punctuation to get wrong: and the JSON is what the site imports.
//
//   node scripts/directory/build.mjs
//
// Every source file declares its own columns:
//
//   #source: notion | seed     where the rows came from
//   #cols: name<TAB>href<TAB>...
//
// `name`, `href`, `note` and `meta` are the entry's own fields. Every other
// column is a facet: semicolon-separated values that become filters. The
// collection's facet order follows the column order, so reordering columns
// reorders the filter rail.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(root, "scripts", "directory", "sources");
const OUT = join(root, "content", "directory");

// Shelves group the collections on the hub. Order here is order on the page.
const SHELVES = [
  { id: "learn", name: "Learning, centralised", note: "The scattered stuff, in one place and filterable." },
  { id: "look", name: "Reference and inspiration", note: "Indexed, not judged. Where to look, not what to think." },
  { id: "make", name: "Tools and technique", note: "What to install, what to open, what it costs." },
  { id: "work", name: "Community and opportunity", note: "Other people, and how the work becomes a living." },
  { id: "know", name: "Context and language", note: "The words and the history nobody hands you." },
];

// One entry per collection. `facets` is filled in from the source columns.
const COLLECTIONS = [
  {
    id: "channels",
    shelf: "learn",
    name: "YouTube Channels",
    letter: "A",
    blurb: "The channels worth subscribing to, tagged by software and by what you actually get: tutorials, rigs, breakdowns, scripts.",
    action: "Watch",
  },
  {
    id: "courses",
    shelf: "learn",
    name: "Courses",
    letter: "B",
    blurb: "Paid and subscription courses, filterable by level, skill, school and price: so you can tell a €20 class from a €1,000 bootcamp before you click.",
    action: "Open",
  },
  {
    id: "schools",
    shelf: "learn",
    name: "Schools & Teachers",
    letter: "C",
    blurb: "Where the courses come from, sorted by what they cost and how they teach.",
    action: "Visit",
  },
  {
    id: "books",
    shelf: "learn",
    name: "Books",
    letter: "D",
    blurb: "Animation principles, design theory and the few books about storytelling that change how you time a cut.",
    action: "",
  },
  {
    id: "studios",
    shelf: "look",
    name: "Studios",
    letter: "E",
    blurb: "Nearly four hundred studios with their sites and cities: for reference, for job hunting, and for seeing who works near you.",
    action: "Visit",
  },
  {
    id: "reference",
    shelf: "look",
    name: "Galleries & Archives",
    letter: "F",
    blurb: "The places that already collect the work. Start here instead of scrolling a feed.",
    action: "Open",
  },
  {
    id: "awards",
    shelf: "look",
    name: "Awards & Festivals",
    letter: "G",
    blurb: "Where to submit and where to go, split by what it costs to enter.",
    action: "Open",
  },
  {
    id: "tools",
    shelf: "make",
    name: "Tools & Plugins",
    letter: "H",
    blurb: "Software, plugins, sound, assets and the small utilities: grouped by the job they do rather than by vendor.",
    action: "Open",
  },
  {
    id: "freebies",
    shelf: "make",
    name: "Free Files",
    letter: "I",
    blurb: "Rigs, scripts, project files and presets that working motion designers give away.",
    action: "Download",
  },
  {
    id: "community",
    shelf: "work",
    name: "Communities & Podcasts",
    letter: "J",
    blurb: "Forums, podcasts and newsletters: including the ones about rates and contracts rather than keyframes.",
    action: "Open",
  },
  {
    id: "glossary",
    shelf: "know",
    name: "Glossary",
    letter: "K",
    blurb: "The vocabulary, in plain sentences. Principles, craft, process and the technical terms that show up in delivery specs.",
    action: "",
  },
  {
    id: "timeline",
    shelf: "know",
    name: "Timeline",
    letter: "L",
    blurb: "How motion design got here, from Fantasmagorie to real-time: because the field did not start with After Effects.",
    action: "",
  },
];

const ENTRY_FIELDS = new Set(["name", "href", "note", "meta"]);

const slug = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "x";

const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function parseSource(id) {
  const text = readFileSync(join(SRC, `${id}.tsv`), "utf8");
  let cols = null;
  let source = "seed";
  const rows = [];

  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (!line.trim()) continue;
    if (line.startsWith("#cols:")) {
      cols = line.slice(6).split("\t").map((c) => c.trim()).filter(Boolean);
      continue;
    }
    if (line.startsWith("#source:")) {
      source = line.slice(8).trim();
      continue;
    }
    if (line.startsWith("#")) continue;
    if (!cols) throw new Error(`${id}.tsv: rows before the #cols: header`);

    const cells = line.split("\t");
    const row = {};
    cols.forEach((c, i) => {
      row[c] = (cells[i] ?? "").trim();
    });
    if (!row.name) continue;
    rows.push(row);
  }

  if (!cols) throw new Error(`${id}.tsv: no #cols: header`);
  return { cols, source, rows };
}

// Studio locations arrive as "New York NY" / "Sao Paolo Brazil" / "Hong Kong".
// Split them into a city and a country so the directory can be browsed both ways.
const US_STATES = new Set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "));
const CA_PROVINCES = new Set("ON BC QC NS AB MB SK PE NB NT YT NU".split(" "));
const COUNTRY_SUFFIXES = [
  "Northern Ireland", "South Africa", "New Zealand", "South Korea",
  "Argentina", "Australia", "Armenia", "Austria", "Brazil", "Bulgaria", "Chile",
  "China", "Colombia", "Denmark", "Egypt", "France", "Germany", "Greece",
  "India", "Ireland", "Israel", "Italy", "Japan", "Latvia", "Netherlands",
  "Norway", "Panama", "Peru", "Poland", "Portugal", "Russia", "Spain",
  "Sweden", "Switzerland", "Taiwan", "Turkey", "Ukraine",
];
// Two-letter suffixes that are countries rather than states/provinces.
const CODE_COUNTRIES = { UK: "United Kingdom", JP: "Japan", NZ: "New Zealand", MX: "Mexico", UAE: "United Arab Emirates", NL: "Netherlands" };
// Whole strings the rules would get wrong.
const LOCATION_OVERRIDES = {
  "Tel Aviv IL": ["Tel Aviv", "Israel"],
  "Salt Lake City Utah": ["Salt Lake City", "United States"],
  "Hong Kong": ["Hong Kong", "Hong Kong"],
  "Singapore": ["Singapore", "Singapore"],
  "Mexico City": ["Mexico City", "Mexico"],
  "Taipei": ["Taipei", "Taiwan"],
  "Argentina": ["", "Argentina"],
  "Fortitude Valley Queensland": ["Fortitude Valley", "Australia"],
  "Research Triangle NC": ["Research Triangle", "United States"],
};

function splitLocation(loc) {
  if (!loc || loc === "Unknown") return null;
  if (LOCATION_OVERRIDES[loc]) return LOCATION_OVERRIDES[loc];

  for (const country of COUNTRY_SUFFIXES) {
    if (loc.endsWith(" " + country)) {
      return [loc.slice(0, -country.length - 1), country];
    }
  }
  const last = loc.split(" ").pop();
  const city = loc.slice(0, -last.length - 1);
  if (CODE_COUNTRIES[last]) return [city, CODE_COUNTRIES[last]];
  if (US_STATES.has(last)) return [city, "United States"];
  if (CA_PROVINCES.has(last)) return [city, "Canada"];
  return [loc, "Unknown"];
}

// Course prices arrive as free text ("US$2-30", "US$14-32 (Monthly subscription)").
// Bucket them so the filter is useful; the raw string still shows on the row.
function priceBand(price) {
  if (!price) return [];
  if (/subscription/i.test(price)) return ["Subscription"];
  const numbers = (price.match(/\d+/g) || []).map(Number);
  if (!numbers.length) return [];
  const top = Math.max(...numbers);
  if (top === 0) return ["Free"];
  if (top < 50) return ["Under $50"];
  if (top < 200) return ["$50–$200"];
  if (top < 600) return ["$200–$600"];
  return ["$600+"];
}

function normalizeHref(href) {
  if (!href) return "";
  if (/^https?:\/\//i.test(href)) return href;
  return "https://" + href;
}

const collator = new Intl.Collator("en", { sensitivity: "base" });

function buildCollection(def) {
  const { cols, source, rows } = parseSource(def.id);
  const facetKeys = cols.filter((c) => !ENTRY_FIELDS.has(c));

  const entries = [];
  const seen = new Map();

  for (const row of rows) {
    const facets = {};
    for (const key of facetKeys) {
      const values = (row[key] || "")
        .split(";")
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length) facets[key] = values;
    }

    // Per-collection derivations that would be tedious to keep by hand.
    if (def.id === "studios" && facets.city) {
      const cities = [];
      const countries = [];
      for (const loc of facets.city) {
        const split = splitLocation(loc);
        if (!split) continue;
        if (split[0] && !cities.includes(split[0])) cities.push(split[0]);
        if (split[1] !== "Unknown" && !countries.includes(split[1])) countries.push(split[1]);
      }
      if (cities.length) facets.city = cities;
      else delete facets.city;
      if (countries.length) facets.country = countries;
    }
    if (def.id === "courses") {
      const band = priceBand(row.price);
      if (band.length) facets.price = band;
      else delete facets.price;
    }

    let id = slug(row.name);
    if (seen.has(id)) {
      // Two rows, same name (a studio listed twice in Notion). Merge their
      // facets rather than shipping a duplicate row.
      const existing = entries[seen.get(id)];
      for (const [key, values] of Object.entries(facets)) {
        existing.facets[key] = [...new Set([...(existing.facets[key] || []), ...values])];
      }
      continue;
    }

    seen.set(id, entries.length);
    const entry = { id, name: row.name, facets };
    const href = normalizeHref(row.href);
    if (href) entry.href = href;
    if (row.note) entry.note = row.note;
    if (row.meta) entry.meta = row.meta;
    if (def.id === "courses" && row.price) entry.meta = [row.meta, row.price].filter(Boolean).join(" · ");
    entries.push(entry);
  }

  // The timeline reads chronologically; everything else reads alphabetically.
  if (def.id !== "timeline") entries.sort((a, b) => collator.compare(a.name, b.name));

  // Facet order follows column order; values are ordered by how common they are,
  // so the filter rail leads with the ones that actually cut the list down.
  const orderedKeys = [...facetKeys, ...(def.id === "studios" ? ["country"] : [])].filter(
    (key) => entries.some((e) => e.facets[key]?.length),
  );
  const facets = orderedKeys.map((key) => {
    const counts = new Map();
    for (const entry of entries) {
      for (const value of entry.facets[key] || []) {
        counts.set(value, (counts.get(value) || 0) + 1);
      }
    }
    const values = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0]))
      .map(([value, count]) => ({ value, count }));
    return { key, label: titleCase(key), values };
  });

  return { ...def, source, count: entries.length, facets, entries };
}

mkdirSync(OUT, { recursive: true });

const manifest = { shelves: SHELVES, collections: [] };
let total = 0;

for (const def of COLLECTIONS) {
  const collection = buildCollection(def);
  writeFileSync(join(OUT, `${def.id}.json`), JSON.stringify(collection, null, 2) + "\n");
  total += collection.count;
  manifest.collections.push({
    id: collection.id,
    shelf: collection.shelf,
    name: collection.name,
    letter: collection.letter,
    blurb: collection.blurb,
    source: collection.source,
    count: collection.count,
    // The two or three facets worth naming on the hub card.
    facets: collection.facets.slice(0, 3).map((f) => f.label),
  });
  console.log(`${collection.id.padEnd(12)} ${String(collection.count).padStart(4)} entries  (${collection.source})`);
}

manifest.total = total;
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`${"total".padEnd(12)} ${String(total).padStart(4)} entries across ${COLLECTIONS.length} collections`);
