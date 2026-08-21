"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Whether an element is close enough to the viewport to be worth animating.
//
// The wall is the reason this exists rather than "animate everything": every
// animating tile is a decoded sheet held in memory and a draw a frame, and a
// library page can be several hundred clips long. A generous root margin means
// a tile is already moving by the time it is scrolled to, so the wall never
// reads as if it woke up when you looked at it.

export function useNearViewport<T extends HTMLElement>(
  margin = "400px",
): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  /* A browser with no observer is not a reason to show a wall of still
     pictures, so it starts near and stays there. Read here rather than set from
     the effect: this is what the value *is* on that browser, not something that
     changes once React has rendered. */
  const [near, setNear] = useState(
    () => typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { rootMargin: margin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [margin]);

  return [ref, near];
}

/* The viewer's own answer to whether anything should move. An external store
   rather than an effect, because that is what it is: something that lives
   outside React and can change while the page is open. */
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribeMotion(notify: () => void) {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(QUERY).matches,
    // Prerendering can't know, and guessing "reduce" would ship a still wall
    // to everybody for one paint.
    () => false,
  );
}
