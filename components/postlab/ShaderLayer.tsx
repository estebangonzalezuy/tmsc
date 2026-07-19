"use client";

// The Post Lab's single shader: Paper Shaders' Dithering, always in the
// slide theme's two tones. Everything else renders through the canvas-2D
// dithered-forms engine (GenerativeLayer). Colors never come from the spec.

import { Dithering } from "@paper-design/shaders-react";
import type { DitheringShape, DitheringType } from "@paper-design/shaders";
import { shaderDef, tones, type ShaderSpec, type Theme } from "@/lib/postlab";
import GenerativeLayer from "./GenerativeLayer";

const num = (v: number | string | undefined, def: number) =>
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
}: {
  shader: ShaderSpec;
  theme: Theme;
  playing: boolean;
  width: number;
  height: number;
  duration: number;
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
      />
    );
  }

  const { ink, bg } = tones(theme);
  const s = shader;

  if (s.type !== "dithering") {
    return <div style={{ position: "absolute", inset: 0, background: bg }} />;
  }

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
      colorBack={bg}
      colorFront={ink}
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
