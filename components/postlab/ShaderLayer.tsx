"use client";

// The Post Lab's single shader: Paper Shaders' Dithering, in the slide
// theme's two tones or — when colour is on — with its ink taken from the
// club palette. Everything else renders through the canvas-2D
// dithered-forms engine (GenerativeLayer), which can colour every pixel.
// The spec still carries no hex: only a switch and a seed.

import { Dithering } from "@paper-design/shaders-react";
import type { DitheringShape, DitheringType } from "@paper-design/shaders";
import {
  paletteInk,
  shaderDef,
  tones,
  type ShaderSpec,
  type Theme,
} from "@/lib/postlab";
import GenerativeLayer from "./GenerativeLayer";

const num = (v: unknown, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : def;

const SHAPES = ["simplex", "warp", "dots", "wave", "ripple", "swirl", "sphere"];
const DTYPES = ["random", "2x2", "4x4", "8x8"];

export default function ShaderLayer({
  shader,
  theme,
  playing,
  width,
  height,
  duration,
  color,
}: {
  shader: ShaderSpec;
  theme: Theme;
  playing: boolean;
  width: number;
  height: number;
  duration: number;
  color?: {
    ink?: string;
    seed: number;
    palette?: string[];
    inks?: string[];
    mixMode?: string;
    mixScale?: number;
    mixSpeed?: number;
  };
}) {
  if (shaderDef(shader.type).kind === "generative") {
    return (
      <GenerativeLayer
        shader={shader}
        theme={theme}
        playing={playing}
        width={width}
        height={height}
        duration={duration}
        ink={color?.ink}
        colorSeed={color?.seed}
        colorPalette={color?.palette?.join(",") ?? ""}
        inks={color?.inks?.join(",") ?? ""}
        mixMode={color?.mixMode ?? ""}
        mixScale={color?.mixScale ?? 0}
        mixSpeed={color?.mixSpeed ?? -1}
      />
    );
  }

  const { ink } = tones(theme);
  const s = shader;

  /* "plain" contributes nothing of its own — the slide's background is
     painted behind the whole stack. */
  if (s.type !== "dithering") return null;

  const shape = SHAPES.includes(String(s.shape)) ? String(s.shape) : "sphere";
  const dtype = DTYPES.includes(String(s.dtype)) ? String(s.dtype) : "4x4";
  return (
    <Dithering
      style={{ position: "absolute", inset: 0 }}
      width="100%"
      height="100%"
      // Lets the exporter read frames back out of the WebGL canvas.
      webGlContextAttributes={{ preserveDrawingBuffer: true }}
      minPixelRatio={2}
      /* Transparent, so a layer only ever adds its own pixels and stacked
         layers combine without a blend mode. */
      colorBack="rgba(0,0,0,0)"
      /* The WebGL dithering only has two tones, so colour here means one
         palette pick for the whole layer rather than per-pixel. */
      /* Two tones only, so "mix" can't be honoured here — it resolves to a
         single colour that stands clear of the background, drawn from the
         layer's own set when it has one. */
      colorFront={
        color?.ink === "mix"
          ? paletteInk(
              color.seed,
              theme,
              color.inks?.length ? color.inks : color.palette,
            )
          : color?.ink || ink
      }
      shape={shape as DitheringShape}
      type={dtype as DitheringType}
      size={num(s.size, 3)}
      speed={playing ? num(s.speed, 0.5) : 0}
      // Layer transform (drag / wheel / pinch / shift-drag on the canvas).
      scale={num(s.scale, 0.9)}
      rotation={num(s.rotation, 0)}
      offsetX={num(s.offsetX, 0)}
      offsetY={num(s.offsetY, 0)}
    />
  );
}
