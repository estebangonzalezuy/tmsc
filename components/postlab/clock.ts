// The Post Lab's playhead: one number, in seconds through the loop, that
// every layer and the type overlay are a function of.
//
// It lives outside React on purpose. It changes sixty times a second, and
// holding it in state re-rendered the whole tool on every frame — measured
// at about a third of the frame rate on a two-layer post. As a store, the
// canvases subscribe and draw themselves and nothing re-renders at all;
// only the readout under the stage asks React for the number.

const listeners = new Set<(t: number) => void>();
let now = 0;

export const clock = {
  get: () => now,
  server: () => 0,
  set(next: number) {
    now = next;
    listeners.forEach((l) => l(next));
  },
  /** For useSyncExternalStore, which hands back a no-argument callback. */
  subscribe(l: () => void) {
    return clock.watch(l);
  },
  /** For the canvases, which want the time without a re-render. */
  watch(l: (t: number) => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
