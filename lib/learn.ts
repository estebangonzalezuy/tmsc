import { readFileSync } from "node:fs";
import { join } from "node:path";
import manifest from "@/content/learn/manifest.json";

/* the Learn library. The pieces are data, not copy: they are written as
   markdown under content/learn/sources/ and built into JSON by
   scripts/learn/build.mjs. Only the page's framing copy lives in
   content/site.json, because the Studio rewrites that file wholesale on every
   publish and would take a library down with it.

   Import this module from server components only. It reaches every piece body
   through require(); a client component wanting the shelf should import
   content/learn/manifest.json directly, which carries cards and counts and no
   bodies at all. */

export type PieceKind = "article" | "video" | "audio";

/** "placeholder" is a promise, not a piece. The hub counts them apart and
    never lets one look finished. */
export type PieceState = "published" | "placeholder";

/** The library is pay-once, so "paid" is the norm and "free" is the deliberate
    sample. A paid piece's body past its :::more marker is never built into the
    site at all — see scripts/learn/build.mjs. */
export type PieceAccess = "free" | "paid";

export type Span =
  | { t: "text" | "em" | "strong" | "code"; v: string }
  | { t: "a"; v: string; href: string };

export type Block =
  | { t: "h"; level: number; text: Span[] }
  | { t: "p"; text: Span[] }
  | { t: "ul" | "ol"; items: Span[][] }
  | { t: "quote"; text: Span[] }
  | { t: "hr" }
  | { t: "img"; src: string; alt: string; caption?: string }
  | { t: "note"; text: Span[] }
  | { t: "do"; text: Span[]; minutes?: number }
  | { t: "video"; provider: "youtube" | "vimeo"; id: string; caption?: string }
  | { t: "audio"; src: string; seconds?: number }
  | { t: "spec"; studio: "postlab" | "tiles"; spec: string; caption?: string };

export type PieceCard = {
  slug: string;
  title: string;
  blurb: string;
  kind: PieceKind;
  state: PieceState;
  access: PieceAccess;
  track: string;
  minutes: number;
  updated: string;
};

export type Piece = PieceCard & {
  blocks: Block[];
  /** How many blocks were withheld. Zero for a free piece. */
  locked: number;
};

export type Update = Pick<
  PieceCard,
  "slug" | "title" | "blurb" | "kind" | "access" | "track" | "updated"
>;

export type Track = {
  id: string;
  name: string;
  letter: string;
  blurb: string;
  /** In curriculum order, which is not the order of the files on disk. */
  pieces: string[];
  count: number;
  published: number;
};

/** A day of the on-ramp. It points at a piece that already lives in a track,
    so reordering the path never mints or breaks a URL. */
export type Day = {
  day: number;
  piece: string;
  title: string;
  track: string;
  todo: string;
  minutes: number;
};

export type Counts = {
  total: number;
  published: number;
  placeholder: number;
  tracks: number;
  days: number;
  minutes: number;
  articles: number;
  videos: number;
  audio: number;
  free: number;
  paid: number;
};

export const tracks: Track[] = manifest.tracks as Track[];
export const path: Day[] = manifest.path as Day[];
export const pieceCards: PieceCard[] = manifest.pieces as PieceCard[];
export const counts: Counts = manifest.counts as Counts;
export const updates: Update[] = manifest.updates as Update[];

export const trackIds = () => tracks.map((t) => t.id);
export const getTrack = (id: string) => tracks.find((t) => t.id === id) ?? null;

const cards = new Map(pieceCards.map((p) => [p.slug, p]));
export const getCard = (slug: string) => cards.get(slug) ?? null;

/** The pieces anyone can read, in curriculum order. The library's sample. */
export const openPieces = (): PieceCard[] =>
  tracks
    .flatMap((t) => t.pieces)
    .map((slug) => cards.get(slug))
    .filter(
      (p): p is PieceCard =>
        !!p && p.state === "published" && p.access === "free",
    );

/** Every (track, piece) pair worth prerendering. Placeholders are left out:
    a piece that is still a promise has no address of its own, so generating a
    page for it would only be generating a 404. */
export const piecePaths = () =>
  pieceCards
    .filter((p) => p.state === "published")
    .map((p) => ({ track: p.track, piece: p.slug }));

export function getPiece(track: string, slug: string): Piece | null {
  const card = cards.get(slug);
  if (!card || card.track !== track) return null;
  /* One file per piece, read at build time rather than imported: a library of a
     hundred articles must not put all hundred bodies into one module for every
     page to carry. The slug is checked against the manifest above, so it is
     ours and not a path from the URL. */
  const file = join(process.cwd(), "content", "learn", "pieces", `${slug}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as Piece;
}

/* Images and audio sit in the repo under public/learn/, the way the Stills and
   the Clips do. Everything the site renders goes through here, so moving the
   media onto a CDN later is this one string. */
export const assetBase = "/learn";
export const learnAsset = (src: string) =>
  src.startsWith("http") || src.startsWith(assetBase) ? src : `${assetBase}${src.startsWith("/") ? "" : "/"}${src}`;

export const KIND_LABEL: Record<PieceKind, string> = {
  article: "Read",
  video: "Watch",
  audio: "Listen",
};
