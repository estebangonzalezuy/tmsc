/* The club's illustrations, drawn in code.
 *
 * Every drawing on the site is a function of one number: `t`, in seconds.
 * There is no SVG to keep in step with the palette, no icon set, no stock
 * anything — the six drawers below are the club's own motifs (the circled
 * letter, the frame, the sheet of frames, the path of days, the letter, the
 * orbit) taught to move. A room card runs one, a letter's cover freezes one
 * at a seed, a Learn track carries one.
 *
 * The rules they all keep, because a site about motion should be honest
 * about its own:
 *
 * - **Pure and periodic.** A drawer reads `t` and its own arguments and
 *   nothing else — no state between frames, no random(), no Date.now(). The
 *   same `t` always draws the same picture, which is what lets a cover be a
 *   frozen instant of the same code that animates elsewhere.
 * - **One ink.** A drawer is handed the colour to draw with and uses only
 *   that, at whatever alpha it likes. The ground is the card's, never the
 *   drawer's, so the same drawer works on indigo, on cream and on paper.
 * - **Slow.** These sit behind a headline and under type. Nothing here
 *   finishes in less than a second, and most cycles run five or six.
 *
 * They are pure functions rather than components on purpose: the same code
 * has to run in a canvas 132px wide and one 1400px wide, at any instant,
 * with no React in the loop. See components/Illustration.tsx for the canvas
 * and the one animation frame the whole page shares.
 */

export type DrawArgs = {
  c: CanvasRenderingContext2D;
  /** CSS pixels; the context is already scaled for the device ratio. */
  w: number;
  h: number;
  /** Seconds. */
  t: number;
  /** The one colour this drawing may use. */
  ink: string;
  /** The resolved display family, for the drawers that set letters. */
  serif: string;
  /** The resolved body family, for the drawers that set numbers. */
  sans: string;
};

export type Drawer = (a: DrawArgs) => void;

const TAU = Math.PI * 2;

/** Cubic in-out — the curve the club teaches on day four. */
const ease = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

/** FNV-1a, the same hash `lib/accent.ts` picks a hover colour with, so a
    thing keyed on its title keeps its look between visits. */
export function hash01(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/* ---------------------------------------------------------------- letters */

/* The Directory: a grid of circled letters, each cell turning over to the
   next letter on its own offset, so the block is never still and never
   busy. The flip is a scale through zero on the vertical, which is how a
   physical flap reads — and why the letter changes at the halfway point. */
const WORD = "THEDIRECTORYMOTIONSOCIALCLUB";

const letters: Drawer = ({ c, w, h, t, ink, serif }) => {
  const cols = 5;
  const rows = 4;
  const cell = Math.min(w / (cols + 0.6), h / (rows + 0.6));
  const ox = (w - cols * cell) / 2 + cell / 2;
  const oy = (h - rows * cell) / 2 + cell / 2;
  const r = cell * 0.36;
  c.lineWidth = 1.2;
  c.strokeStyle = ink;
  c.fillStyle = ink;
  c.font = `${Math.round(r * 1.05)}px ${serif}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (let i = 0; i < cols * rows; i++) {
    const x = ox + (i % cols) * cell;
    const y = oy + Math.floor(i / cols) * cell;
    /* Every cell turns on the same six-second beat, from a different point
       in it, so they never flip together. */
    const phase = hash01(`letter${i}`) * 6;
    const u = (((t - phase) % 6) + 6) % 6;
    const flip = u < 0.6 ? u / 0.6 : 1;
    const k = Math.floor((t - phase + 6000) / 6) + (flip > 0.5 ? 1 : 0);
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.stroke();
    const squash = Math.abs(Math.cos(Math.PI * flip));
    /* Below a third of its height a letter reads as a sliver rather than a
       letter, which is fine for two frames of a flip and wrong in a still —
       and every cover on this site is a still of one of these. So the flap
       goes empty through the turn instead. */
    if (squash < 0.34) continue;
    c.save();
    c.translate(x, y);
    c.scale(1, squash);
    c.fillText(WORD[(i + k) % WORD.length], 0, 1);
    c.restore();
  }
};

/* ----------------------------------------------------------------- frames */

/* Stills: a stack of 16:9 frames being sorted through — the back one lifts
   over the pile and lands at the front, which is what picking a still out of
   a film actually looks like. */
const frames: Drawer = ({ c, w, h, t, ink }) => {
  const n = 4;
  const fw = w * 0.62;
  const fh = (fw * 9) / 16;
  const at = (i: number): [number, number] => [
    w * 0.1 + i * w * 0.08,
    h * 0.16 + i * h * 0.13,
  ];
  const k = Math.floor(t / 1.3);
  const u = ease(Math.min(1, (t % 1.3) / 0.7));
  c.lineWidth = 1.2;
  c.strokeStyle = ink;
  for (let j = 0; j < n; j++) {
    const a = at(j);
    const b = at((j + 1) % n);
    let x = a[0] + (b[0] - a[0]) * u;
    let y = a[1] + (b[1] - a[1]) * u;
    if (j === n - 1) {
      /* The one going back to the front arcs over the others. */
      const front = at(0);
      x = a[0] + (front[0] - a[0]) * u;
      y = a[1] + (front[1] - a[1]) * u - Math.sin(u * Math.PI) * h * 0.12;
    }
    c.globalAlpha = j === n - 1 ? 0.35 + 0.65 * (1 - u) : 1;
    c.beginPath();
    c.roundRect(x, y, fw, fh, 6);
    c.stroke();
    if ((j + k) % n === 1) {
      c.globalAlpha = 0.18;
      c.fillStyle = ink;
      c.fill();
    }
    c.globalAlpha = 1;
  }
};

/* ------------------------------------------------------------------ sheet */

/* Clips: a filmstrip six wide — the shape a clip is actually committed in
   (see docs/THE-CLIPS.md) — with a playhead stepping cell by cell and a
   short tail fading behind it, because a clip on this site steps rather
   than plays. */
const sheet: Drawer = ({ c, w, h, t, ink }) => {
  const cols = 6;
  const rows = 6;
  const gap = w * 0.02;
  const cw = (w - gap * (cols + 1)) / cols;
  const ch = cw * 0.68;
  const oy = (h - rows * (ch + gap)) / 2;
  const head = Math.floor(t * 10) % (cols * rows);
  c.fillStyle = ink;
  for (let i = 0; i < cols * rows; i++) {
    const x = gap + (i % cols) * (cw + gap);
    const y = oy + Math.floor(i / cols) * (ch + gap);
    const d = (head - i + cols * rows) % (cols * rows);
    c.globalAlpha = d === 0 ? 1 : d < 6 ? 0.55 - d * 0.07 : 0.16;
    c.beginPath();
    c.roundRect(x, y, cw, ch, 2.5);
    c.fill();
  }
  c.globalAlpha = 1;
};

/* ------------------------------------------------------------------- path */

/* Learn: the seven days, rising, with a dot walking them and each day
   filling as it is passed. The club's on-ramp drawn as what it is — an
   order to do things in. */
const path: Drawer = ({ c, w, h, t, ink, sans }) => {
  const n = 7;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    pts.push([
      w * (0.12 + i * 0.126),
      h * (0.84 - i * 0.105) + Math.sin(i * 1.7) * h * 0.03,
    ]);
  }
  const period = 5;
  const p = (t % period) / period;
  const seg = Math.min(n - 2, Math.floor(p * (n - 1)));
  const u = ease(p * (n - 1) - seg);
  c.strokeStyle = ink;
  c.lineWidth = 1.2;
  c.setLineDash([3, 4]);
  c.beginPath();
  pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])));
  c.stroke();
  c.setLineDash([]);
  const r = Math.min(w, h) * 0.055;
  c.font = `500 ${Math.round(r)}px ${sans}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  pts.forEach((q, i) => {
    const done = i <= seg;
    c.beginPath();
    c.arc(q[0], q[1], r, 0, TAU);
    c.fillStyle = ink;
    c.strokeStyle = ink;
    if (done) c.fill();
    else c.stroke();
    /* A filled day's number is knocked out of the fill rather than drawn in
       a second colour: one ink, always. */
    c.globalAlpha = done ? 0.45 : 1;
    c.fillStyle = done ? "rgba(0,0,0,1)" : ink;
    c.fillText(String(i + 1), q[0], q[1] + 0.5);
    c.globalAlpha = 1;
  });
  const a = pts[seg];
  const b = pts[seg + 1];
  c.fillStyle = ink;
  c.beginPath();
  c.arc(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, r * 0.45, 0, TAU);
  c.fill();
};

/* ------------------------------------------------------------------ lines */

/* The Newsletter: a letter being written a line at a time, held so it can be
   read as a page, then cleared and started again. Twice a month, drawn. */
const lines: Drawer = ({ c, w, h, t, ink }) => {
  const ws = [0.8, 0.7, 0.86, 0.6, 0.8, 0.5, 0.75, 0.86, 0.4, 0.66, 0.8, 0.34];
  const n = ws.length;
  const period = 6;
  const p = (t % period) / period;
  const reveal =
    p < 0.7 ? p / 0.7 : p < 0.85 ? 1 : 1 - ease((p - 0.85) / 0.15);
  const lh = h / (n + 3);
  const x0 = w * 0.1;
  const wmax = w * 0.8;
  const total = ws.reduce((a, b) => a + b, 0);
  let acc = 0;
  c.fillStyle = ink;
  for (let i = 0; i < n; i++) {
    const start = acc / total;
    const end = (acc + ws[i]) / total;
    acc += ws[i];
    const f = Math.max(0, Math.min(1, (reveal - start) / (end - start)));
    if (f <= 0) continue;
    c.globalAlpha = 0.75;
    c.beginPath();
    c.roundRect(x0, lh * (i + 1.6), wmax * ws[i] * f, 2, 1);
    c.fill();
  }
  c.globalAlpha = 1;
  /* The club's own mark, breathing, in the corner where a stamp goes. */
  c.strokeStyle = ink;
  c.lineWidth = 1.2;
  c.beginPath();
  c.arc(w * 0.84, lh * 1.7, lh * 0.55 * (0.9 + 0.1 * Math.sin(t * 2)), 0, TAU);
  c.stroke();
};

/* ------------------------------------------------------------------ orbit */

/* the Practice File, and the club's oldest motif: three rings turning at
   different speeds and directions, marks riding each rim. */
const orbit: Drawer = ({ c, w, h, t, ink }) => {
  const cx = w / 2;
  const cy = h * 0.52;
  const R = Math.min(w, h) * 0.42;
  const rings = [0.36, 0.66, 0.96];
  const marks = [3, 4, 5];
  c.strokeStyle = ink;
  c.fillStyle = ink;
  c.lineWidth = 1.2;
  rings.forEach((k, i) => {
    const r = R * k;
    c.globalAlpha = 0.85;
    c.beginPath();
    c.arc(cx, cy, r, 0, TAU);
    c.stroke();
    const speed = (i % 2 ? -1 : 1) * (0.25 - i * 0.06);
    for (let d = 0; d < marks[i]; d++) {
      const a = t * speed * TAU + (d * TAU) / marks[i];
      c.globalAlpha = 1;
      c.beginPath();
      c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, R * 0.055, 0, TAU);
      c.fill();
    }
  });
  c.globalAlpha = 1;
};

/* ------------------------------------------------------------------- grid */

/* the Fundamentals: a column grid re-dividing itself — six columns becoming
   four becoming three, the gutters holding — which is the first figure on the
   first page of that section, and the thing most people have never actually
   watched happen. */
const grid: Drawer = ({ c, w, h, t, ink }) => {
  const counts = [6, 4, 3, 5];
  const period = 3.2;
  const step = Math.floor(t / period) % counts.length;
  const u = ease(Math.min(1, ((t % period) / period) * 2.2));
  /* The column count is a whole number, so it is crossfaded rather than
     interpolated: the old set fades out as the new one fades in. */
  const from = counts[step];
  const to = counts[(step + 1) % counts.length];
  const margin = w * 0.1;
  const gutter = Math.max(4, w * 0.022);
  const top = h * 0.16;
  const bottom = h * 0.84;
  const draw = (n: number, alpha: number) => {
    if (alpha <= 0.01) return;
    const span = w - margin * 2;
    const cw = (span - gutter * (n - 1)) / n;
    c.globalAlpha = alpha;
    c.fillStyle = ink;
    for (let i = 0; i < n; i++) {
      c.beginPath();
      c.roundRect(margin + i * (cw + gutter), top, cw, bottom - top, 2);
      c.fill();
    }
  };
  draw(from, 0.28 * (1 - u));
  draw(to, 0.28 * u);
  /* The margins are the point as much as the columns are. */
  c.globalAlpha = 0.5;
  c.strokeStyle = ink;
  c.lineWidth = 1;
  c.setLineDash([2, 4]);
  [margin, w - margin].forEach((x) => {
    c.beginPath();
    c.moveTo(x, h * 0.08);
    c.lineTo(x, h * 0.92);
    c.stroke();
  });
  c.setLineDash([]);
  c.globalAlpha = 1;
};

/* ------------------------------------------------------------------- hero */

/* The two rings that used to be DOM elements behind the homepage headline
   (OrbitRing, MOTION and HUMANSOCIAL). Drawn now, so they cost one canvas
   instead of seventeen absolutely-positioned spans, and so they can be
   hairline-quiet at any size. */
const hero: Drawer = ({ c, w, h, t, ink, serif }) => {
  const cx = w / 2;
  const cy = h / 2;
  const base = Math.min(w, h);
  const ring = (r: number, word: string, speed: number, size: number) => {
    c.strokeStyle = ink;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(cx, cy, r, 0, TAU);
    c.stroke();
    c.font = `${size * 0.55}px ${serif}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (let i = 0; i < word.length; i++) {
      const a = t * speed * TAU + (i * TAU) / word.length;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      /* The circle keeps its own ground, the way CircleLetter does, or the
         ring's rule would run through every letter. */
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.arc(x, y, size / 2, 0, TAU);
      c.fill();
      c.stroke();
      c.fillStyle = ink;
      c.fillText(word[i], x, y + 1);
    }
  };
  const size = Math.max(22, Math.min(34, base * 0.05));
  ring(base * 0.34, "MOTION", 1 / 80, size);
  ring(base * 0.52, "HUMANSOCIAL", -1 / 120, size);
};

export const DRAWERS = {
  letters,
  frames,
  sheet,
  grid,
  path,
  lines,
  orbit,
  hero,
} satisfies Record<string, Drawer>;

export type IllusKind = keyof typeof DRAWERS;

export const ILLUS_KINDS = Object.keys(DRAWERS) as IllusKind[];
