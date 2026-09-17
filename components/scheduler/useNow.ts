"use client";

import { useSyncExternalStore } from "react";

// The clock as an external store, to the minute. A component that needs
// "now" — is this post due yet, has that time passed — reads it here rather
// than calling Date.now() in render, which the compiler rightly refuses, and
// gets re-rendered when the minute turns so a "due" pill appears without a
// refresh. The server has no idea what time the reader's browser thinks it is
// and says 0; hydration corrects it on the first client render.

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(l: () => void) {
  listeners.add(l);
  if (!timer) timer = setInterval(() => listeners.forEach((f) => f()), 60_000);
  return () => {
    listeners.delete(l);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const snapshot = () => Math.floor(Date.now() / 60_000) * 60_000;
const server = () => 0;

export function useNow(): number {
  return useSyncExternalStore(subscribe, snapshot, server);
}
