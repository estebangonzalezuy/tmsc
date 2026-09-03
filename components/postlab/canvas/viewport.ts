// The node canvas's pan/zoom, outside React — same shape as clock.ts. It
// changes at gesture rate (a drag, a wheel tick) and is read imperatively by
// NodeCanvas's world div (`translate3d(x,y,0) scale(s)` written straight to
// the DOM node's style inside a watch callback), never through React state.
// Only the graph itself (nodes, edges, params) is ordinary React state.

export type Viewport = { x: number; y: number; scale: number };

const listeners = new Set<(v: Viewport) => void>();
let state: Viewport = { x: 0, y: 0, scale: 1 };

export const viewport = {
  get: () => state,
  set(next: Viewport) {
    state = next;
    listeners.forEach((l) => l(next));
  },
  watch(l: (v: Viewport) => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export const clampScale = (s: number) => Math.min(2.5, Math.max(0.2, s));

export function panBy(dx: number, dy: number) {
  const v = viewport.get();
  viewport.set({ ...v, x: v.x + dx, y: v.y + dy });
}

/** Zoom by `factor`, keeping the point under (clientX, clientY) fixed on
    screen — the standard "zoom at the cursor" feel. */
export function zoomAt(clientX: number, clientY: number, factor: number) {
  const v = viewport.get();
  const next = clampScale(v.scale * factor);
  if (next === v.scale) return;
  const k = next / v.scale;
  viewport.set({
    x: clientX - (clientX - v.x) * k,
    y: clientY - (clientY - v.y) * k,
    scale: next,
  });
}
