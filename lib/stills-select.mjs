// Choosing which moments are worth cutting.
//
// Plain JavaScript with no imports, because it has two callers that cannot
// share anything else: scripts/stills/extract.mjs runs in Node with ffmpeg,
// and components/stills/LocalExtractor.tsx runs in the browser over a canvas.
// They find their candidates in completely different ways — ffmpeg's scene
// score against frame differencing in JS — but what they do with the
// candidates has to be identical, or the same film would be curated
// differently depending on how it got here.
//
// Node can't import TypeScript and the browser can't import ffmpeg, so this
// is the shape that fits both: one file, no dependencies.

/* Two candidates closer together than this are the same idea twice. */
export const MIN_GAP = 2.0;

/** The frame id for a timestamp. Milliseconds, zero padded, so ids sort in
 *  timeline order as strings and the same moment always lands on the same id
 *  no matter which extractor found it. */
export function frameId(t) {
  return `t${String(Math.round(t * 1000)).padStart(8, "0")}`;
}

export function slugify(text) {
  return (
    String(text)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}

/** A spread, not a top-N. Slice the timeline into `count` buckets and take the
 *  strongest cut in each: you get the film's range instead of ten frames from
 *  its busiest ten seconds. Buckets with no cut fall back to their own
 *  midpoint, so a slow film still yields a full sheet.
 *
 *  `cuts` is [{ t, score }]. Returns timestamps in order. */
export function chooseTimes(cuts, duration, count) {
  const start = Math.min(0.5, duration * 0.02);
  const end = Math.max(start, duration - 0.3);
  const span = end - start;
  if (span <= 0) return [];

  const picked = [];
  for (let i = 0; i < count; i++) {
    const from = start + (span * i) / count;
    const to = start + (span * (i + 1)) / count;
    const inBucket = cuts.filter((c) => c.t >= from && c.t < to);
    if (inBucket.length) {
      inBucket.sort((a, b) => b.score - a.score);
      // A cut is the first frame of a new shot; a breath later is usually the
      // composed one, not the one caught mid-transition.
      picked.push(Math.min(inBucket[0].t + 0.35, end));
    } else {
      picked.push((from + to) / 2);
    }
  }

  const spaced = [];
  for (const t of picked.sort((a, b) => a - b)) {
    if (!spaced.length || t - spaced[spaced.length - 1] >= MIN_GAP) spaced.push(t);
  }
  return spaced;
}

/** Mean and spread of a tiny grey copy of one frame, whoever measured it.
 *  Catches the three things nobody wants on a wall: black, blown out, and a
 *  flat colour card. */
export function isWorthKeeping(stats) {
  if (!stats) return false;
  if (stats.mean < 10 || stats.mean > 248) return false; // black, or blown out
  return stats.deviation >= 3; // a flat card is not a style frame
}

/** Mean and standard deviation of an array of 0-255 samples. */
export function greyStats(values) {
  if (!values.length) return null;
  let sum = 0;
  for (const v of values) sum += v;
  const mean = sum / values.length;
  let variance = 0;
  for (const v of values) variance += (v - mean) ** 2;
  return { mean, deviation: Math.sqrt(variance / values.length) };
}
