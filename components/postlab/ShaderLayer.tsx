"use client";

// Maps a ShaderSpec to a Paper Shaders component (the library behind
// shaders.paper.design). Colors are never taken from the spec — they derive
// from the slide theme, keeping every background strictly grayscale.

import {
  Dithering,
  MeshGradient,
  Metaballs,
  PerlinNoise,
  SmokeRing,
  Spiral,
  Voronoi,
  Warp,
  Waves,
} from "@paper-design/shaders-react";
import type { DitheringShape, WarpPattern } from "@paper-design/shaders";
import { tones, type ShaderSpec, type Theme } from "@/lib/postlab";

const num = (v: number | string | undefined, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : def;

export default function ShaderLayer({
  shader,
  theme,
  playing,
}: {
  shader: ShaderSpec;
  theme: Theme;
  playing: boolean;
}) {
  const { ink, bg, grays } = tones(theme);
  const s = shader;
  const speed = playing ? num(s.speed, 0.5) : 0;
  const common = {
    style: { position: "absolute", inset: 0 } as const,
    width: "100%",
    height: "100%",
    // Lets the exporter read frames back out of the WebGL canvas.
    webGlContextAttributes: { preserveDrawingBuffer: true },
    minPixelRatio: 2,
  };

  switch (s.type) {
    case "dithering":
      return (
        <Dithering
          {...common}
          colorBack={bg}
          colorFront={ink}
          shape={(s.shape as DitheringShape) ?? "sphere"}
          type="4x4"
          size={num(s.size, 3)}
          scale={num(s.scale, 0.9)}
          speed={speed}
        />
      );
    case "waves":
      return (
        <Waves
          {...common}
          colorBack={bg}
          colorFront={ink}
          shape={num(s.shape, 1)}
          amplitude={num(s.amplitude, 0.5)}
          frequency={num(s.frequency, 0.5)}
          spacing={num(s.spacing, 0.75)}
          rotation={num(s.rotation, 0)}
          softness={0}
          scale={num(s.scale, 1)}
        />
      );
    case "mesh":
      return (
        <MeshGradient
          {...common}
          colors={grays}
          distortion={num(s.distortion, 0.8)}
          swirl={num(s.swirl, 0.6)}
          grainOverlay={num(s.grainOverlay, 0)}
          speed={speed}
        />
      );
    case "perlin":
      return (
        <PerlinNoise
          {...common}
          colorBack={bg}
          colorFront={ink}
          proportion={num(s.proportion, 0.5)}
          softness={num(s.softness, 0.1)}
          scale={num(s.scale, 0.8)}
          speed={speed}
        />
      );
    case "voronoi":
      return (
        <Voronoi
          {...common}
          colors={[bg, grays[1], grays[2]]}
          colorGap={ink}
          colorGlow={grays[3]}
          gap={num(s.gap, 0.03)}
          glow={num(s.glow, 0)}
          scale={num(s.scale, 0.8)}
          speed={speed}
        />
      );
    case "metaballs":
      return (
        <Metaballs
          {...common}
          colorBack={bg}
          colors={[ink, grays[3], grays[2]]}
          count={num(s.count, 8)}
          size={num(s.size, 0.8)}
          scale={num(s.scale, 1)}
          speed={speed}
        />
      );
    case "warp":
      return (
        <Warp
          {...common}
          colors={[bg, grays[2], ink]}
          shape={(s.shape as WarpPattern) ?? "stripes"}
          distortion={num(s.distortion, 0.25)}
          swirl={num(s.swirl, 0.8)}
          softness={num(s.softness, 0)}
          scale={num(s.scale, 1)}
          speed={speed}
        />
      );
    case "spiral":
      return (
        <Spiral
          {...common}
          colorBack={bg}
          colorFront={ink}
          density={num(s.density, 0.4)}
          strokeWidth={num(s.strokeWidth, 0.5)}
          distortion={num(s.distortion, 0)}
          scale={num(s.scale, 1)}
          speed={speed}
        />
      );
    case "smoke":
      return (
        <SmokeRing
          {...common}
          colorBack={bg}
          colors={[ink, grays[3]]}
          thickness={num(s.thickness, 0.7)}
          radius={num(s.radius, 0.5)}
          scale={num(s.scale, 1)}
          speed={speed}
        />
      );
    default:
      return <div style={{ position: "absolute", inset: 0, background: bg }} />;
  }
}
