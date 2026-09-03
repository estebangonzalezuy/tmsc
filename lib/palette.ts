// The club's colour, kept apart from the graph model.
//
// `PALETTE` is the site's own accent set — the seven hexes `AGENTS.md`'s
// design rules point at, unchanged from the old `lib/postlab.ts` so nothing
// downstream (Motifs, the accent hovers) has to move. `GROUNDS` is the paper
// a post sits on, also unchanged.
//
// `FIELD_PRESET_RAMPS` is new: a small set of named, *ordered* colour ramps
// for the `field` node's ink ramp (deepest first, palest last). The club
// palette is included as one built-in preset among others — not the only
// source — because the field node's whole point is a free ramp per post.

export const PALETTE = [
  "#adb4f5", // periwinkle
  "#2e7d46", // green
  "#000000", // black
  "#ffffff", // white
  "#ee4b2b", // orange red
  "#3d3deb", // indigo
  "#fffdf0", // cream
] as const;

export const GROUNDS: { hex: string; label: string }[] = [
  { hex: "#ffffff", label: "white" },
  { hex: "#f4f3ef", label: "paper" },
  { hex: "#e6e5e1", label: "ash" },
  { hex: "#fffdf0", label: "cream" },
  { hex: "#1a1a1a", label: "slate" },
  { hex: "#0d0d0d", label: "black" },
];

export type Ramp = { id: string; label: string; inks: string[] };

/** Named starting points for a `field` node's `inks` ramp — deepest first,
    palest last, so a field renders ink at the centre and air at the edge the
    moment one of these is picked. */
export const FIELD_PRESET_RAMPS: Ramp[] = [
  { id: "club", label: "the club", inks: ["#000000", "#3d3deb", "#2e7d46", "#adb4f5", "#ffffff"] },
  { id: "mono", label: "ink on paper", inks: ["#000000", "#4a4a4a", "#8a8a8a", "#c9c9c9", "#f4f3ef"] },
  { id: "ember", label: "ember", inks: ["#1a0e08", "#7a1f0e", "#ee4b2b", "#f5a35a", "#fffdf0"] },
  { id: "harbour", label: "harbour", inks: ["#0d1b2a", "#1b3a5c", "#3d3deb", "#adb4f5", "#f4f3ef"] },
  { id: "thicket", label: "thicket", inks: ["#0d1f14", "#1e4d2b", "#2e7d46", "#8fc79a", "#f4f3ef"] },
  { id: "signal", label: "signal", inks: ["#000000", "#3d3deb", "#ee4b2b", "#adb4f5", "#fffdf0"] },
];

export const rampOf = (id: string): Ramp | undefined => FIELD_PRESET_RAMPS.find((r) => r.id === id);

/** Named ground+ink pairs for the `kinetic` node — ported unchanged from the
    retired `lib/kinetics.ts`'s `PALETTES`. Unlike `FIELD_PRESET_RAMPS` a
    kinetic preset carries its own ground too, because every one of the
    references it came from picked ground and inks together (pink type on
    black is one decision, not two). */
export type KineticPalette = { id: string; label: string; ground: string; inks: string[] };

export const KINETIC_PRESET_PALETTES: KineticPalette[] = [
  {
    id: "meaning",
    label: "meaning",
    ground: "#111111",
    inks: ["#ffffff", "#ff2d95", "#00e05a", "#2b34ff", "#ff5c00", "#ffe500", "#a855f7"],
  },
  {
    id: "shine",
    label: "shine",
    ground: "#0b0b0b",
    inks: ["#00e05a", "#ffffff", "#00c2ff", "#ff3b30", "#ffd400"],
  },
  {
    id: "smlxl",
    label: "smlxl",
    ground: "#111111",
    inks: ["#ff7ac8", "#4ec3e0", "#2f8f6b", "#ff7a5c"],
  },
  {
    id: "love",
    label: "love",
    ground: "#f7efd8",
    inks: ["#ef4a3a", "#f58220", "#ec6ca4", "#2f8fbf", "#f2b705", "#c86dd7"],
  },
  {
    id: "torino",
    label: "torino",
    ground: "#f2f0eb",
    inks: ["#111111", "#2b34ff", "#00b34a", "#ff2d2d", "#6b21d9"],
  },
  {
    id: "press",
    label: "press",
    ground: "#ffffff",
    inks: ["#111111", "#ff2d2d", "#2b34ff", "#00b34a", "#ffb800"],
  },
];

export const kineticPaletteOf = (id: string): KineticPalette =>
  KINETIC_PRESET_PALETTES.find((p) => p.id === id) ?? KINETIC_PRESET_PALETTES[0];

const luminance = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

/** Deterministic pick from a palette-like list — same seed, same answer, so
    preview and export always agree. */
export function paletteAt(seed: number, n: number, palette: readonly string[] = PALETTE): string {
  const list = palette.length ? palette : PALETTE;
  const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
  const f = x - Math.floor(x);
  return list[Math.floor(f * list.length) % list.length];
}

/** A seeded subset/permutation of `source`, re-sorted deepest→palest by
    luminance so a reroll changes which colours win and how they're
    arranged, without ever breaking the ramp's own centre-to-edge order —
    that direction is the invariant, not the specific hexes. */
export function rerollInks(seed: number, source: readonly string[], count = 5): string[] {
  const n = Math.max(2, Math.min(count, source.length || count));
  const pool = [...source];
  const picked: string[] = [];
  let s = seed;
  while (picked.length < n && pool.length) {
    s = s * 1.61803398875 + 7.13;
    const x = Math.sin(s * 91.7) * 43758.5453;
    const i = Math.floor((x - Math.floor(x)) * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked.sort((a, b) => luminance(b) - luminance(a));
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Keep only real hexes, lower-cased, capped — for a ramp read back out of a
    graph node that might carry anything. */
export function cleanInks(raw: unknown, fallback: readonly string[] = FIELD_PRESET_RAMPS[0].inks): string[] {
  if (!Array.isArray(raw)) return [...fallback];
  const list = raw.filter((c): c is string => typeof c === "string" && HEX.test(c)).map((c) => c.toLowerCase());
  return list.length ? list.slice(0, 12) : [...fallback];
}
