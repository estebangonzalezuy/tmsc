// The wall's playhead: one number, in milliseconds, that every animating tile
// is a function of.
//
// It lives outside React for the reason components/postlab/clock.ts spells out:
// a number that changes sixty times a second, held in state, re-renders
// everything that reads it — measured at about a third of the frame rate in the
// Posts Studio. Here it would be worse, because a wall is forty subscribers
// rather than two. So the tiles subscribe and draw themselves, and React never
// hears about a frame.
//
// It is its own free-running rAF rather than the studio's clock because a wall
// has no transport: nothing scrubs it, nothing sets it, it only runs or it
// doesn't. It stops when the last tile unsubscribes, so a wall scrolled past or
// a tab in the background costs nothing.

type Listener = (ms: number) => void;

const listeners = new Set<Listener>();
let frame = 0;
let now = 0;
/** Wall time minus the time spent paused, so pausing and resuming doesn't jump
 *  every clip forward by however long you were away. */
let origin = 0;
let paused = false;
let pausedAt = 0;

function tick() {
  now = performance.now() - origin;
  listeners.forEach((l) => l(now));
  frame = requestAnimationFrame(tick);
}

function start() {
  if (frame || paused) return;
  origin = performance.now() - now;
  frame = requestAnimationFrame(tick);
}

function stop() {
  if (!frame) return;
  cancelAnimationFrame(frame);
  frame = 0;
}

export const ticker = {
  get: () => now,
  server: () => 0,
  /** For the canvases, which want the time without a re-render. */
  watch(l: Listener) {
    listeners.add(l);
    start();
    return () => {
      listeners.delete(l);
      if (!listeners.size) stop();
    };
  },
  /** For the wall's own play/pause, and for prefers-reduced-motion. */
  setPaused(next: boolean) {
    if (next === paused) return;
    paused = next;
    if (next) {
      pausedAt = now;
      stop();
      // One last call, so every tile settles on the frame it was showing rather
      // than on whatever it happened to paint last.
      listeners.forEach((l) => l(pausedAt));
    } else {
      start();
    }
  },
  isPaused: () => paused,
};
