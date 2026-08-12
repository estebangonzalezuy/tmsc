"use client";

// The timeline: the loop, end to end, with the transport at its left and a
// track for every layer. Motion tools all put this at the bottom and for the
// same reason — time is the one axis every other panel is a slice of.
//
// What a track shows here is a wave, not a row of keyframes, because that is
// what this tool's motion actually is: a parameter travelling from where it
// sits to somewhere else and back, a whole number of times per loop. Drawing
// the wave makes that visible and makes the closed loop obvious — the curve
// ends where it started.
//
// Nothing in here re-renders with the clock. The playhead is moved by the
// clock directly and only the readout subscribes, which is what keeps sixty
// frames a second from costing sixty React renders.

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  shaderDef,
  waveAt,
  type LayerSpec,
  type SlideSpec,
  type Wave,
} from "@/lib/postlab";
import { clock } from "./clock";

const useTime = () => useSyncExternalStore(clock.subscribe, clock.get, clock.server);

function Readout({ duration }: { duration: number }) {
  const time = useTime();
  return (
    <span className="text-xs text-muted tabular-nums">
      {time.toFixed(2)}
      <span className="opacity-50"> / {duration.toFixed(2)}s</span>
    </span>
  );
}

const layerName = (l: LayerSpec) =>
  l.type === "forms" ? String(l.pattern ?? "rings") : shaderDef(l.type).label;

/* One travelling parameter, drawn across the loop. The curve is sampled from
   the same `waveAt` the renderer uses, so what you see is the arithmetic the
   frame is made of rather than an illustration of it. */
function Wave({ cycles, wave, phase }: { cycles: number; wave: string; phase: number }) {
  const n = 96;
  const points = Array.from({ length: n + 1 }, (_, i) => {
    const tt = i / n;
    const k = waveAt(wave as Wave, cycles * tt + phase);
    return `${tt},${1 - k}`;
  }).join(" ");
  return (
    <svg
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function Tracks({
  slide,
  duration,
  layerIndex,
  playing,
  onPlay,
  onSelectLayer,
}: {
  slide: SlideSpec;
  duration: number;
  layerIndex: number;
  playing: boolean;
  onPlay: (p: boolean) => void;
  onSelectLayer: (i: number) => void;
}) {
  const laneRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);

  /* The playhead follows the clock without telling React about it. */
  useEffect(() => {
    const el = headRef.current;
    if (!el) return;
    return clock.watch((t) => {
      el.style.left = `${(t / Math.max(2, duration)) * 100}%`;
    });
  }, [duration]);

  const seek = (clientX: number) => {
    const box = laneRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return;
    const frac = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    clock.set(frac * Math.max(2, duration));
  };

  const seconds = Array.from({ length: Math.max(2, Math.round(duration)) + 1 }, (_, i) => i);

  /* Top layer first, the way the stack is listed everywhere else in the tool. */
  const rows = slide.layers.map((layer, i) => ({ layer, i })).reverse();

  /* Marks travel too, and a loop you can't see in the timeline is a loop you
     have to remember. They read as tracks like anything else that moves. */
  const marks = (slide.shapes ?? []).map((shape, i) => ({ shape, i }));

  return (
    <div className="border-t border-line shrink-0 flex text-xs select-none">
      {/* Transport and the names, in one gutter so a track's label sits
          against its own lane. */}
      <div className="w-[168px] shrink-0 border-r border-line">
        <div className="h-8 border-b border-line flex items-center gap-2 px-3">
          <button
            onClick={() => {
              onPlay(false);
              clock.set(0);
            }}
            title="Back to the top of the loop (Home)"
            className="text-muted hover:text-foreground"
          >
            ⏮
          </button>
          <button
            onClick={() => onPlay(!playing)}
            title="Play / pause (space)"
            className="hover:text-muted w-3 text-center"
          >
            {playing ? "❙❙" : "▶"}
          </button>
          <Readout duration={duration} />
        </div>
        <div className="max-h-[152px] overflow-y-auto">
          {rows.map(({ layer, i }) => (
            <div key={i}>
              <button
                onClick={() => onSelectLayer(i)}
                className={`w-full h-6 flex items-center gap-2 px-3 text-left truncate transition-colors ${
                  i === layerIndex
                    ? "bg-foreground text-background"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="truncate">{layerName(layer)}</span>
                {layer.mute && <span className="opacity-60">off</span>}
              </button>
              {Object.keys(layer.motion ?? {}).map((key) => (
                <div
                  key={key}
                  className="h-4 flex items-center pl-9 pr-3 text-[10px] text-muted truncate"
                >
                  {key}
                </div>
              ))}
            </div>
          ))}
          {marks.map(({ shape, i }) => (
            <div key={`m${i}`}>
              <div className="h-6 flex items-center gap-2 px-3 text-muted truncate">
                <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="truncate">
                  {shape.kind}
                  {(shape.repeat ?? 1) > 1 ? ` ×${Math.round(shape.repeat ?? 1)}` : ""}
                </span>
              </div>
              {Object.keys(shape.motion ?? {}).map((key) => (
                <div
                  key={key}
                  className="h-4 flex items-center pl-9 pr-3 text-[10px] text-muted truncate"
                >
                  {key}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* The loop itself. Clicking anywhere in here puts the playhead there. */}
      <div
        ref={laneRef}
        className="relative flex-1 min-w-0 cursor-ew-resize touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          onPlay(false);
          seek(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) seek(e.clientX);
        }}
      >
        {/* Ruler */}
        <div className="h-8 border-b border-line relative">
          {seconds.map((s) => (
            <div
              key={s}
              className="absolute top-0 bottom-0 border-l border-line/30 pl-1 text-[10px] text-muted tabular-nums"
              style={{ left: `${(s / Math.max(2, duration)) * 100}%` }}
            >
              {s < duration ? `${s}s` : ""}
            </div>
          ))}
        </div>
        <div className="max-h-[152px] overflow-hidden">
          {rows.map(({ layer, i }) => (
            <div key={i}>
              <div
                onClick={() => onSelectLayer(i)}
                className={`h-6 border-b border-line/20 ${
                  i === layerIndex ? "bg-foreground/5" : ""
                }`}
              >
                {/* A layer with nothing travelling still occupies the loop —
                    it just holds still, and the flat line says so. */}
                <div
                  className={`h-full flex items-center ${
                    layer.mute ? "opacity-30" : ""
                  }`}
                >
                  <div className="h-px w-full bg-line/40" />
                </div>
              </div>
              {Object.entries(layer.motion ?? {}).map(([key, m]) => (
                <div
                  key={key}
                  className="h-4 relative border-b border-line/20 text-foreground/70"
                >
                  <Wave
                    cycles={Math.max(1, Math.round(m.cycles ?? 1))}
                    wave={m.wave ?? "sin"}
                    phase={m.phase ?? 0}
                  />
                </div>
              ))}
            </div>
          ))}
          {marks.map(({ shape, i }) => (
            <div key={`m${i}`}>
              <div className="h-6 border-b border-line/20 flex items-center">
                <div className="h-px w-full bg-line/40" />
              </div>
              {Object.entries(shape.motion ?? {}).map(([key, m]) => (
                <div
                  key={key}
                  className="h-4 relative border-b border-line/20 text-foreground/70"
                >
                  <Wave
                    cycles={Math.max(1, Math.round(m.cycles ?? 1))}
                    wave={m.wave ?? "sin"}
                    phase={m.phase ?? 0}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div
          ref={headRef}
          className="absolute top-0 bottom-0 w-px bg-foreground pointer-events-none"
          style={{ left: 0 }}
        />
      </div>
    </div>
  );
}
