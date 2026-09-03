/* Which palette colour a thing lights up in.

   These are plain functions rather than components, and pages that render on
   the server need them, so they sit outside components/Motifs.tsx — which is
   "use client", and a client module's functions cannot be called from the
   server. Motifs re-exports both, so the design system still has one front
   door and nothing that already imports them had to change.

   The palette itself is the .accent-*-hover classes in app/globals.css. */

/* Which palette colour a thing lights up in. Stable, not shuffled: the same
   card is always the same colour, so a grid doesn't rearrange itself between
   visits, while neighbours still differ because the key differs. Pale and
   saturated fills carry their own type colour (see globals.css), so every
   pairing stays legible. */
const ACCENT_HOVERS = [
  "accent-green-hover",
  "accent-indigo-hover",
  "accent-warm-hover",
  "accent-soft-hover",
] as const;

/* Type-only links drop the pale fill: legible under white type is not the
   same as legible as type. */
const ACCENT_HOVER_TEXTS = [
  "accent-green-hover",
  "accent-indigo-hover",
  "accent-warm-hover",
] as const;

function hash(key: string | number): number {
  const s = String(key);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return h;
}

export function accentHover(key: string | number): string {
  return `accent-hover ${ACCENT_HOVERS[hash(key) % ACCENT_HOVERS.length]}`;
}

export function accentHoverText(key: string | number): string {
  return `accent-hover-text ${
    ACCENT_HOVER_TEXTS[hash(key) % ACCENT_HOVER_TEXTS.length]
  }`;
}
