"use client";

// The post itself, on screen: the layer stack, and the type over it.
//
// It lives on its own because two things show a post now — the studio, where
// every control is in reach, and a tool, where four are. Both have to render
// the same way for the same spec, and both export by reading the very canvases
// this draws. One renderer, two front doors.

import { useEffect, useLayoutEffect, useState } from "react";
import { FORMATS, slideTones, type PostSpec } from "@/lib/postlab";
import ShaderLayer from "./ShaderLayer";
import { drawOverlay, type Fonts } from "./overlay";
import { clock } from "./clock";

export default function Stage({
  spec,
  index,
  fonts,
  shaderBoxRef,
  overlayRef,
  solo = null,
}: {
  spec: PostSpec;
  index: number;
  fonts: Fonts | null;
  shaderBoxRef: React.RefObject<HTMLDivElement | null>;
  overlayRef: React.RefObject<HTMLCanvasElement | null>;
  solo?: number | null;
}) {
  const slide = spec.slides[index];
  const { w, h } = FORMATS[spec.format];

  /* The type is redrawn when the post changes, and — only when something in it
     actually moves — as the playhead does. Three things move: the orbit ring, a
     counting slide's number, and a shape with a loop plugged into it. This
     redraws every glyph at full resolution, so it deliberately doesn't follow
     the clock unless it has to, and it follows it at 30fps rather than 60. */
  const moves =
    slide.ring || !!slide.count || (slide.shapes ?? []).some((s) => !!s.motion);
  useEffect(() => {
    const ctx = overlayRef.current?.getContext("2d");
    if (!ctx || !fonts) return;
    drawOverlay(ctx, spec, index, fonts, clock.get());
    if (!moves) return;
    let last = -1;
    return clock.watch((t) => {
      if (t - last < 1 / 30 && t > last) return;
      last = t;
      drawOverlay(ctx, spec, index, fonts, t);
    });
  }, [spec, index, fonts, moves, overlayRef]);

  return (
    <>
      <div
        ref={shaderBoxRef}
        className="absolute inset-0"
        style={{ background: slideTones(slide).bg, isolation: "isolate" }}
      >
        {slide.layers.map((l, i) => (
          <div
            key={`${i}-${l.type}-${slide.theme}-${spec.format}-${index}`}
            data-layer
            className="absolute inset-0"
            style={{
              opacity: l.opacity,
              mixBlendMode: l.blend === "normal" ? undefined : l.blend,
            }}
          >
            {/* The wrapper stays even when the layer is off, so the exporter's
                index-to-canvas mapping doesn't shift. */}
            {!l.mute && (solo === null || solo === i) && (
              <ShaderLayer
                shader={l}
                theme={slide.theme}
                width={w}
                height={h}
                duration={spec.duration}
                color={{
                  ink: l.ink,
                  seed: slide.colorSeed,
                  palette: slide.palette,
                  inks: l.inks,
                  mixMode: l.mixMode,
                  mixScale: l.mixScale,
                  mixSpeed: l.mixSpeed,
                }}
              />
            )}
          </div>
        ))}
      </div>
      <canvas
        ref={overlayRef}
        width={w}
        height={h}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
    </>
  );
}

/** Fit a post of this format into whatever room the element has, keeping its
    proportions. Returns CSS pixels for the frame. */
export function useStageFit(
  ref: React.RefObject<HTMLElement | null>,
  format: PostSpec["format"],
  pad = 56,
) {
  const { w, h } = FORMATS[format];
  const [size, setSize] = useState({ w: 320, h: 400 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const s = Math.min((el.clientWidth - pad) / w, (el.clientHeight - pad) / h);
      if (s > 0) setSize({ w: Math.floor(w * s), h: Math.floor(h * s) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, w, h, pad]);
  return size;
}

/** The loop, running. Every canvas is a function of this clock, so a paused
    frame is exactly the frame that exports. */
export function useClockRunning(playing: boolean, duration: number) {
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      clock.set((clock.get() + dt) % Math.max(2, duration));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration]);
}
