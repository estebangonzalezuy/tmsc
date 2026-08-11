"use client";

// Draws one generative layer at whatever second of the loop the tool asks
// for. The canvas is at full export resolution and scaled by CSS, so the
// exporter can grab frames from it exactly like the WebGL shader canvas.
//
// It holds no clock of its own: the tool owns the time, which is what makes
// the preview scrubbable and every layer agree on the same frame.

import { useEffect, useRef } from "react";
import type { ShaderSpec, Theme } from "@/lib/postlab";
import { drawGenerative } from "./generative";
import { loadPhoto } from "./photos";
import { clock } from "./clock";

export default function GenerativeLayer({
  shader,
  theme,
  width,
  height,
  duration,
  ink = "",
  colorSeed = 1,
  colorPalette = "",
  inks = "",
  mixMode = "",
  mixScale = 0,
  mixSpeed = -1,
}: {
  shader: ShaderSpec;
  theme: Theme;
  width: number;
  height: number;
  duration: number;
  /* Primitives rather than an object: this feeds an animation effect, and a
     fresh object each render would restart the loop every frame. */
  ink?: string;
  colorSeed?: number;
  /** Comma-joined hexes rather than an array, so the animation effect can
      depend on it without restarting whenever the parent re-renders. */
  colorPalette?: string;
  /** Same again for the layer's own subset of the palette. */
  inks?: string;
  mixMode?: string;
  /** 0 and -1 stand in for "not set", so the renderer keeps its defaults. */
  mixScale?: number;
  mixSpeed?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const color = {
      ink: ink || undefined,
      seed: colorSeed,
      palette: colorPalette ? colorPalette.split(",") : undefined,
      inks: inks ? inks.split(",") : undefined,
      mixMode: mixMode || undefined,
      mixScale: mixScale || undefined,
      mixSpeed: mixSpeed < 0 ? undefined : mixSpeed,
    };
    let stopped = false;
    let unwatch = () => {};
    const draw = (t: number) => {
      if (!stopped)
        drawGenerative(ctx, shader, theme, t, duration, width, height, color);
    };
    /* Subscribed rather than re-rendered: the playhead moves sixty times a
       second and this canvas is the only thing that has to notice. A photo
       layer waits for its picture to decode first; anything else resolves
       immediately. */
    void loadPhoto(shader.src as string | undefined).then(() => {
      if (stopped) return;
      draw(clock.get());
      unwatch = clock.watch(draw);
    });
    return () => {
      stopped = true;
      unwatch();
    };
  }, [
    shader,
    theme,
    width,
    height,
    duration,
    ink,
    colorSeed,
    colorPalette,
    inks,
    mixMode,
    mixScale,
    mixSpeed,
  ]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
