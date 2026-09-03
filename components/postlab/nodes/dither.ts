// The club's ordered-dither screens, extracted verbatim from the old
// generative.ts (no behavior change) so every node kind that needs a
// threshold — `field`, `filter`'s pixelate — shares exactly one screen.
//
// Zero dependency on the old PostSpec/layer-stack model: pure math, seeded
// where it needs to be so a scattered pattern is a design decision and never
// crawls between frames.

export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export const BAYER2 = [
  [0, 2],
  [3, 1],
];

/* The Bayer matrices are self-similar: doubling one is four copies of it,
   each nudged by the 2x2. Building 8x8 rather than typing it keeps the two
   in step. */
export const BAYER8 = Array.from({ length: 8 }, (_, y) =>
  Array.from(
    { length: 8 },
    (_, x) => 4 * BAYER4[y % 4][x % 4] + BAYER2[Math.floor(y / 4)][Math.floor(x / 4)],
  ),
);

export const hash01 = (a: number, b: number, c: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return x - Math.floor(x);
};

/* The screen a cell is measured against. Ordered matrices give the classic
   cross-hatch; "lines" is a one-dimensional screen (engraving); "noise" is a
   fixed random screen (grainier, no visible grid). */
export function screenAt(kind: string, cx: number, cy: number): number {
  switch (kind) {
    case "2x2":
      return (BAYER2[cy % 2][cx % 2] + 0.5) / 4;
    case "8x8":
      return (BAYER8[cy % 8][cx % 8] + 0.5) / 64;
    case "lines":
      return ((cy % 4) + 0.5) / 4;
    case "noise":
      return hash01(cx, cy, 7.7);
    default:
      return (BAYER4[cy % 4][cx % 4] + 0.5) / 16;
  }
}
