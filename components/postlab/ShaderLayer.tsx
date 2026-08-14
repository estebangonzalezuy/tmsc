"use client";

// The Post Lab's single shader: Paper Shaders' Dithering, in the slide
// theme's two tones or — when colour is on — with its ink taken from the
// club palette. Everything else renders through the canvas-2D
// dithered-forms engine (GenerativeLayer), which can colour every pixel.
// The spec still carries no hex: only a switch and a seed.

import { useEffect, useRef } from "react";
import { Dithering } from "@paper-design/shaders-react";
import type {
  DitheringShape,
  DitheringType,
  PaperShaderElement,
} from "@paper-design/shaders";
import {
  paletteInk,
  shaderDef,
  tones,
  type LayerSpec,
  type PostFormat,
  type ShaderSpec,
  type Theme,
} from "@/lib/postlab";
import GenerativeLayer from "./GenerativeLayer";
import PaperLayer, { isCleanType } from "./PaperLayer";
import { clock } from "./clock";

const num = (v: unknown, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : def;

const SHAPES = ["simplex", "warp", "dots", "wave", "ripple", "swirl", "sphere"];
const DTYPES = ["random", "2x2", "4x4", "8x8"];

export default function ShaderLayer({
  shader,
  theme,
  width,
  height,
  duration,
  color,
  format = "portrait",
  words = "",
}: {
  shader: ShaderSpec;
  theme: Theme;
  width: number;
  height: number;
  duration: number;
  /** Only the kinetic layer reads these — its subject is the slide's own
      headline, and it measures its type against the format. */
  format?: PostFormat;
  words?: string;
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
        format={format}
        words={words}
      />
    );
  }

  /* The clean families: Paper's other shaders, which draw an image rather
     than a screen of pixels. A filter can put them through the club's
     screen afterwards. */
  if (isCleanType(shader.type)) {
    return (
      <PaperLayer
        layer={shader as LayerSpec}
        theme={theme}
        width={width}
        height={height}
        ink={color?.ink}
        inks={color?.inks}
        palette={color?.palette}
        seed={color?.seed}
        duration={duration}
      />
    );
  }

  /* "plain" contributes nothing of its own — the slide's background is
     painted behind the whole stack. */
  if (shader.type !== "dithering") return null;
  return <DitheringLayer shader={shader} theme={theme} color={color} />;
}

/* Its own component because it holds a ref and an effect, and the branch
   above returns before either could be declared. */
function DitheringLayer({
  shader: s,
  theme,
  color,
}: {
  shader: ShaderSpec;
  theme: Theme;
  color?: {
    ink?: string;
    seed: number;
    palette?: string[];
    inks?: string[];
  };
}) {
  const mountRef = useRef<PaperShaderElement>(null);
  const speed = num(s.speed, 0.5);

  /* The shader is told which frame to be on as the playhead moves. Pushed
     straight at the mount rather than through a prop, so the tool doesn't
     re-render sixty times a second to animate a background. */
  useEffect(() => {
    const put = (t: number) => {
      mountRef.current?.paperShaderMount?.setFrame(t * 1000 * speed);
    };
    put(clock.get());
    return clock.watch(put);
  }, [speed]);

  const { ink } = tones(theme);
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
      ref={mountRef}
      shape={shape as DitheringShape}
      type={dtype as DitheringType}
      size={num(s.size, 3)}
      /* Driven rather than self-animating: the effect above pushes the frame
         straight at the shader as the playhead moves, so scrubbing the
         timeline moves it with everything else — and pushing it imperatively
         means the tool doesn't re-render to do it. */
      speed={0}
      frame={0}
      // Layer transform (drag / wheel / pinch / shift-drag on the canvas).
      scale={num(s.scale, 0.9)}
      rotation={num(s.rotation, 0)}
      offsetX={num(s.offsetX, 0)}
      offsetY={num(s.offsetY, 0)}
    />
  );
}
