"use client";

// Mounts a canvas and runs the generative animator for a slide. The canvas
// is drawn at full export resolution and scaled by CSS, so the exporter can
// grab frames from it exactly like it does with the WebGL shader canvas.

import { useEffect, useRef } from "react";
import type { ShaderSpec, Theme } from "@/lib/postlab";
import { drawGenerative } from "./generative";

export default function GenerativeLayer({
  shader,
  theme,
  playing,
  width,
  height,
  duration,
}: {
  shader: ShaderSpec;
  theme: Theme;
  playing: boolean;
  width: number;
  height: number;
  duration: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0); // survives pauses and param tweaks

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    if (!playing) {
      drawGenerative(ctx, shader, theme, timeRef.current, duration, width, height);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      timeRef.current += (now - last) / 1000;
      last = now;
      drawGenerative(ctx, shader, theme, timeRef.current, duration, width, height);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [shader, theme, playing, width, height, duration]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
