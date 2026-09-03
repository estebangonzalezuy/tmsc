// Live node positions, outside React — same shape as clock.ts/viewport.ts.
// A drag writes here on every pointermove (both the node's own translate3d
// and every wire touching it read from here), and only commits `{x,y}` back
// into the graph's React state on pointerup. Keeps a whole-graph drag at
// gesture rate without re-rendering the canvas on every pointer move.

export type Pos = { x: number; y: number };

const state = new Map<string, Pos>();
const listeners = new Set<() => void>();

export const positions = {
  get(id: string, fallback: Pos): Pos {
    return state.get(id) ?? fallback;
  },
  set(id: string, pos: Pos) {
    state.set(id, pos);
    listeners.forEach((l) => l());
  },
  /** Seed any node the store doesn't know about yet from the graph's own
      committed x/y, and drop anything no longer in the graph — called
      whenever the node list itself changes (add, remove, load a link). */
  sync(nodes: { id: string; x: number; y: number }[]) {
    const ids = new Set(nodes.map((n) => n.id));
    for (const id of [...state.keys()]) if (!ids.has(id)) state.delete(id);
    for (const n of nodes) if (!state.has(n.id)) state.set(n.id, { x: n.x, y: n.y });
  },
  watch(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
