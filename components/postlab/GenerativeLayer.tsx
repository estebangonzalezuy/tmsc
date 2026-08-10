"use client";

// Mounts a canvas and runs the generative animator for a slide. The canvas
// is drawn at full export resolution and scaled by CSS, so the exporter can
// grab frames from it exactly like it does with the WebGL shader canvas.

import { useEffect, useRef } from "react";
import type { ShaderSpec, Theme } from "@/lib/postlab";
import { drawGenerative } from "./generative";
import { loadPhoto } from "./photos";

export default function GenerativeLayer({
  shader,
  theme,
  playing,
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
  playing: boolean;
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
  const timeRef = useRef(0); // survives pauses and param tweaks

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
    let raf = 0;
    let stopped = false;

    const start = () => {
      if (stopped) return;
      if (!playing) {
        drawGenerative(
          ctx, shader, theme, timeRef.current, duration, width, height, color,
        );
        return;
      }
      let last = performance.now();
      const loop = (now: number) => {
        timeRef.current += (now - last) / 1000;
        last = now;
        drawGenerative(
          ctx, shader, theme, timeRef.current, duration, width, height, color,
        );
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    };

    /* A photo layer has nothing to draw until its picture is decoded. The
       animated path would pick it up on a later frame anyway; a paused one
       would sit empty forever, so both wait for it. Anything else resolves
       immediately. */
    void loadPhoto(shader.src as string | undefined).then(start);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [
    shader,
    theme,
    playing,
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
