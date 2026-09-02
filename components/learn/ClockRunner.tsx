"use client";

import { useClockRunning } from "@/components/postlab/Stage";

/* Starts the shared playhead for a page that has canvases on it but no grid to
   start it. One per page: every canvas subscribes to the one clock, so a second
   runner would just be a second rAF loop driving the same number. */

export default function ClockRunner({ duration = 6 }: { duration?: number }) {
  useClockRunning(true, duration);
  return null;
}
