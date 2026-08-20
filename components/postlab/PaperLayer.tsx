"use client";

// The clean half: Paper Shaders' other families, drawn as a layer.
//
// Two things happen here that don't happen in the pixelated half.
//
// Colour is worked out in one place. Each of these shaders takes a different
// set of colour props — colorTint, colorInner, colorGap, colors[] — and the
// club's answer is always the same: the slide's two tones, or the layer's
// inks when colour was asked for. `paint` says which props each family
// accepts so nothing unknown is handed to a DOM node.
//
// And a filtered layer is drawn twice: once by the shader into its own
// canvas, then copied into a 2D canvas the filters run over. The filtered
// canvas comes first in the DOM because that is the one the exporter picks
// up, and the shader's own is left mounted but hidden — it is still the
// thing generating the image.

import { useEffect, useRef } from "react";
import { ColorPanels, DotOrbit, Spiral, Swirl, Voronoi } from "@paper-design/shaders-react";
import {
  PALETTE,
  paletteInk,
  resolveFilter,
  shaderDef,
  tones,
  type FilterSpec,
  type LayerSpec,
  type Theme,
} from "@/lib/postlab";
import { clock } from "./clock";
import { applyFilters } from "./filters";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* Five of the seventeen. The other twelve walk through noise rather than
   turning on a period, so they cannot be shipped as a loop and are not
   offered — `LEGACY_TYPES` maps their names onto the club's own renderer so
   the links that carry one still open. See the note above `CLEAN`. */
const COMPONENTS: Record<string, any> = {
  cells: Voronoi,
  twist: Swirl,
  coil: Spiral,
  orbit: DotOrbit,
  panels: ColorPanels,
};

/** Which colour props each family actually reads. */
const PAINT: Record<string, string[]> = {
  cells: ["colors", "colorGap", "colorGlow"],
  twist: ["colorBack", "colors"],
  coil: ["colorBack", "colorFront"],
  orbit: ["colorBack", "colors"],
  panels: ["colorBack", "colors"],
};

const CLEAR = "rgba(0,0,0,0)";

/* The club's colour discipline, applied to whatever props this family has:
   the back is always transparent so layers stack on their own, and the front
   is the theme's ink unless the layer asked for colour. */
function paintProps(
  type: string,
  theme: Theme,
  ink?: string,
  inks?: string[],
  palette?: string[],
  seed = 1,
) {
  const base = tones(theme).ink;
  const list = inks?.length ? inks : palette?.length ? palette : [...PALETTE];
  const front =
    ink === "mix" ? paletteInk(seed, theme, list) : ink && ink !== "mix" ? ink : base;
  /* A shader that takes a list interpolates between the entries, so one
     colour fills the frame solid and shows nothing. Monochrome hands it the
     ink fading to nothing, which keeps the pattern and keeps the layer
     stacking without a blend mode. */
  const many = ink === "mix" ? list : [front, CLEAR];

  const out: Record<string, string | string[]> = {};
  for (const key of PAINT[type] ?? []) {
    if (key === "colorBack" || key === "colorGap") out[key] = CLEAR;
    else if (key === "colors") out[key] = many;
    else out[key] = front;
  }
  return out;
}

export default function PaperLayer({
  layer,
  theme,
  width,
  height,
  ink,
  inks,
  palette,
  seed,
  duration = 6,
}: {
  layer: LayerSpec;
  theme: Theme;
  width: number;
  height: number;
  /** The loop, in seconds — an effect's travelling numbers divide it. */
  duration?: number;
  ink?: string;
  inks?: string[];
  palette?: string[];
  seed?: number;
}) {
  const Component = COMPONENTS[layer.type];
  const mountRef = useRef<HTMLDivElement>(null);
  const outRef = useRef<HTMLCanvasElement>(null);
  const filters = layer.filters;

  /* Whole laps of the shader's own period over the post, which is the whole
     reason these five are the ones that stayed: `speed` here is not a tempo
     the owner picks, it is arithmetic — at the last frame the shader is
     showing its first one. Same promise as a travelling number, same reason
     it holds (a whole number of turns), and the same thing goes wrong if you
     let it be anything else. */
  const period = shaderDef(layer.type).period ?? 0;
  const laps = Math.max(1, Math.round(typeof layer.laps === "number" ? layer.laps : 1));
  const speed = period ? (laps * period) / Math.max(2, duration) : 0;

  /* Driven off the tool's clock rather than animating itself, so scrubbing
     moves it with everything else — and pushed imperatively, so the tool
     doesn't re-render sixty times a second to animate a background. */
  useEffect(() => {
    const put = (t: number) => {
      /* `data-paper-shader`, singular. It was plural here, which matches
         nothing — so every clean layer sat on frame zero and the whole family
         looked like a set of stills. Both spellings are accepted so a version
         bump in the library can't quietly stop the clock again. */
      const el = mountRef.current?.querySelector(
        "[data-paper-shader], [data-paper-shaders]",
      ) as
        | (HTMLElement & { paperShaderMount?: { setFrame(ms: number): void } })
        | null;
      el?.paperShaderMount?.setFrame(t * 1000 * speed);
    };
    put(clock.get());
    return clock.watch(put);
  }, [speed]);

  /* The filter pass. Copies whatever the shader has on screen into a 2D
     canvas and runs the chain over it. */
  useEffect(() => {
    if (!filters?.length) return;
    const out = outRef.current;
    const ctx = out?.getContext("2d", { willReadFrequently: true });
    if (!out || !ctx) return;
    const inkColour = ink && ink !== "mix" ? ink : tones(theme).ink;
    /* Resolved every frame, so an effect's own travelling numbers move here
       exactly as they do on the club's own renderer. */
    const run = (t = clock.get()) => {
      const src = mountRef.current?.querySelector("canvas");
      if (!src || !src.width) return;
      const tt = (t / Math.max(2, duration)) % 1;
      ctx.clearRect(0, 0, out.width, out.height);
      ctx.drawImage(src, 0, 0, out.width, out.height);
      applyFilters(
        ctx,
        out.width,
        out.height,
        filters.map((f) => resolveFilter(f, tt)),
        theme,
        inkColour,
      );
    };
    run();
    return clock.watch(run);
  }, [filters, theme, ink, width, height, duration]);

  if (!Component) return null;

  const controls = shaderDef(layer.type).controls;
  const params: Record<string, number | string> = {};
  for (const c of controls) {
    /* `laps` is not a shader prop — it is how the clock above is geared. */
    if (c.key === "laps") continue;
    const v = layer[c.key];
    params[c.key] = typeof v === "number" ? v : c.def;
  }
  for (const c of shaderDef(layer.type).choices ?? []) {
    const v = layer[c.key];
    params[c.key] = typeof v === "string" ? v : c.def;
  }

  return (
    <>
      {/* First in the DOM, so this is the canvas the exporter reads. */}
      {filters?.length ? (
        <canvas
          ref={outRef}
          width={width}
          height={height}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
      ) : null}
      <div
        ref={mountRef}
        style={{
          position: "absolute",
          inset: 0,
          visibility: filters?.length ? "hidden" : "visible",
        }}
      >
        <Component
          style={{ position: "absolute", inset: 0 }}
          width="100%"
          height="100%"
          webGlContextAttributes={{ preserveDrawingBuffer: true }}
          minPixelRatio={2}
          speed={0}
          frame={0}
          {...paintProps(layer.type, theme, ink, inks, palette, seed)}
          {...params}
        />
      </div>
    </>
  );
}

export const isCleanType = (type: string) => Boolean(COMPONENTS[type]);
export type { FilterSpec };
