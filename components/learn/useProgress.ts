"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/* Where a reader has got to on the path.
   
   There is no backend and there are no accounts, so this is localStorage and
   nothing else. The thing to get right is that the server renders nothing
   ticked and the browser renders what it remembers, and those two have to
   disagree without React calling it a hydration mismatch. That is precisely
   what useSyncExternalStore is for: it draws the server snapshot first, then
   swaps in the client one on its own terms. Reading storage during render, or
   setting state from an effect, both get this wrong in their own way.

   The snapshot is the raw string rather than a parsed Set, because the snapshot
   has to be referentially stable between reads and a fresh Set never is.

   Storage access itself throws in a private window rather than returning null,
   so every touch is wrapped. A reader who blocks storage gets a path that works
   and forgets, which is the right failure. */

const KEY = "tmsc:learn:done";
const EMPTY = "[]";

const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  /* Another tab ticking a day should show up here too. */
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}

function getSnapshot() {
  try {
    return window.localStorage.getItem(KEY) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

const getServerSnapshot = () => EMPTY;

function write(next: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage is off; nothing to do but carry on. */
  }
  for (const fn of listeners) fn();
}

export function useProgress() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const done = useMemo(() => {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
    } catch {
      return new Set<string>();
    }
  }, [raw]);

  /* False on the server and through hydration, true once this is really the
     browser — so a count of what's done never renders before it is known. */
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const toggle = useCallback(
    (slug: string) => {
      const next = new Set(done);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      write([...next]);
    },
    [done],
  );

  return { done, toggle, ready };
}
