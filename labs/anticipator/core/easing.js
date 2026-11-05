// CSS easing, evaluated in JS. Just enough of the CSS Easing spec to play an
// animate-text-compatible spec exactly as a browser would: keywords,
// cubic-bezier() (y may leave [0,1]) and linear() with evenly spaced stops.

export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (s) => ((ax * s + bx) * s + cx) * s;
  const sy = (s) => ((ay * s + by) * s + cy) * s;
  const dx = (s) => (3 * ax * s + 2 * bx) * s + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let s = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(s) - x;
      if (Math.abs(err) < 1e-7) return sy(s);
      const d = dx(s);
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
    }
    let lo = 0, hi = 1;
    s = x;
    for (let i = 0; i < 40; i++) {
      const v = sx(s);
      if (Math.abs(v - x) < 1e-7) break;
      if (v < x) lo = s; else hi = s;
      s = (lo + hi) / 2;
    }
    return sy(s);
  };
}

const KEYWORDS = {
  linear: (x) => x,
  ease: cubicBezier(0.25, 0.1, 0.25, 1),
  "ease-in": cubicBezier(0.42, 0, 1, 1),
  "ease-out": cubicBezier(0, 0, 0.58, 1),
  "ease-in-out": cubicBezier(0.42, 0, 0.58, 1),
};

const cache = new Map();

/** Parse a CSS easing string into (x∈[0,1]) → y. Unknown strings fall back to `ease`. */
export function parseEasing(str) {
  const key = String(str || "ease").trim();
  if (cache.has(key)) return cache.get(key);
  let fn = KEYWORDS[key];
  const cb = /^cubic-bezier\(\s*([^)]+)\)$/.exec(key);
  if (!fn && cb) {
    const n = cb[1].split(",").map(Number);
    if (n.length === 4 && n.every(Number.isFinite)) fn = cubicBezier(...n);
  }
  const lin = /^linear\(\s*([^)]+)\)$/.exec(key);
  if (!fn && lin) {
    const stops = lin[1].split(",").map((s) => parseFloat(s));
    if (stops.length >= 2 && stops.every(Number.isFinite)) {
      fn = (x) => {
        if (x <= 0) return stops[0];
        if (x >= 1) return stops[stops.length - 1];
        const f = x * (stops.length - 1);
        const i = Math.floor(f);
        return stops[i] + (stops[i + 1] - stops[i]) * (f - i);
      };
    }
  }
  fn = fn || KEYWORDS.ease;
  cache.set(key, fn);
  return fn;
}

export function isValidEasing(str) {
  const s = String(str || "").trim();
  if (KEYWORDS[s]) return true;
  const cb = /^cubic-bezier\(\s*([^)]+)\)$/.exec(s);
  if (cb) {
    const n = cb[1].split(",").map(Number);
    return n.length === 4 && n.every(Number.isFinite) && n[0] >= 0 && n[0] <= 1 && n[2] >= 0 && n[2] <= 1;
  }
  return /^linear\(/.test(s);
}

export const easeInOutSine = (x) => -(Math.cos(Math.PI * x) - 1) / 2;
export const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
