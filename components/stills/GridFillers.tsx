// Blank cells that finish the last row of a hairline grid.
//
// A `gap-px bg-line` grid draws its lines by letting the container's
// background show through the gaps, which means it also shows through every
// cell the content doesn't fill — a half-empty last row comes out as a black
// slab. The Directory solves it with one hardcoded filler because its grid is
// a fixed width. A wall of frames is responsive, so how many cells are missing
// depends on the breakpoint: with 19 frames it's 1 short at two columns,
// 2 short at three, 1 short at four.
//
// All three answers are known here, so render the largest number of fillers
// and let CSS pick which are visible at each width.

export default function GridFillers({
  count,
  cols,
}: {
  count: number;
  /** Columns at [base, md, xl]. */
  cols: [number, number, number];
}) {
  const missing = cols.map((n) => (n - (count % n)) % n) as [
    number,
    number,
    number,
  ];
  const most = Math.max(...missing);
  if (most === 0) return null;

  return (
    <>
      {Array.from({ length: most }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className={`bg-background ${i < missing[0] ? "block" : "hidden"} ${
            i < missing[1] ? "md:block" : "md:hidden"
          } ${i < missing[2] ? "xl:block" : "xl:hidden"}`}
        />
      ))}
    </>
  );
}
