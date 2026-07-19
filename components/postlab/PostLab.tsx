"use client";

// the Post Lab — a small Toolcraft-style design tool for making the club's
// animated posts, carousels, and reels: a live preview on the left, a
// control panel on the right, shader backgrounds from Paper Shaders, and
// spec-in-URL sharing so Claude can generate posts from a prompt.

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BLENDS,
  FORMATS,
  MAX_LAYERS,
  PRESETS,
  SHADERS,
  decodeSpec,
  defaultLayer,
  defaultSpec,
  encodeSpec,
  normalizeSpec,
  shaderDef,
  specFromQuery,
  tones,
  type LayerSpec,
  type PostSpec,
  type ShaderType,
  type SlideSpec,
} from "@/lib/postlab";
import ShaderLayer from "./ShaderLayer";
import { drawOverlay, loadFonts, type Fonts } from "./overlay";
import { exportPng, recordGif, recordVideo } from "./exporter";

/* ------------------------------------------------------------- panel bits */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-5">
      <p className="text-xs underline underline-offset-4 mb-4">{title}</p>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted shrink-0 w-20">{label}</span>
      {children}
    </label>
  );
}

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-1 border border-line divide-x divide-line">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 px-2 py-1.5 text-xs transition-colors ${
            value === o.value
              ? "bg-foreground text-background"
              : "hover:text-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  rows = 1,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  if (rows > 1)
    return (
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-line bg-transparent px-2.5 py-2 text-sm resize-none focus:outline-none focus:border-foreground"
      />
    );
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-line bg-transparent px-2.5 py-2 text-sm focus:outline-none focus:border-foreground"
    />
  );
}

function Button({
  onClick,
  children,
  primary = false,
  disabled = false,
}: {
  onClick: () => void;
  children: ReactNode;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`border border-line px-3 py-1.5 text-xs transition-colors disabled:opacity-40 ${
        primary
          ? "bg-foreground text-background hover:bg-foreground/80"
          : "hover:bg-foreground hover:text-background"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ tool */

export default function PostLab() {
  const [spec, setSpec] = useState<PostSpec>(defaultSpec);
  const [active, setActive] = useState(0);
  const [activeLayer, setActiveLayer] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fonts, setFonts] = useState<Fonts | null>(null);
  const [job, setJob] = useState<{ label: string; frac: number } | null>(null);
  const [flash, setFlash] = useState("");
  const [importText, setImportText] = useState("");

  const stageRef = useRef<HTMLDivElement>(null);
  const shaderBoxRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 400, h: 500 });

  const { w, h } = FORMATS[spec.format];
  const activeIndex = Math.min(active, spec.slides.length - 1);
  const slide = spec.slides[activeIndex];
  const layerIndex = Math.min(activeLayer, slide.layers.length - 1);
  const layer = slide.layers[layerIndex];
  const def = shaderDef(layer.type);

  /* Load fonts, then any spec passed in the URL: #spec= / ?spec= (encoded),
     or plain ?title=...&body=... params — the instant, zero-AI path that a
     Notion formula can assemble. */
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const fromHash = window.location.hash.match(/spec=([^&]+)/)?.[1];
    const decoded =
      decodeSpec(fromHash ?? search.get("spec") ?? "") ?? specFromQuery(search);
    loadFonts().then((f) => {
      setFonts(f);
      if (decoded) setSpec(decoded);
    });
  }, []);

  /* Keep the URL shareable as the spec changes. */
  useEffect(() => {
    const id = setTimeout(() => {
      window.history.replaceState(null, "", `#spec=${encodeSpec(spec)}`);
    }, 400);
    return () => clearTimeout(id);
  }, [spec]);

  /* Fit the slide into the available stage area. */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => {
      const pad = 48;
      const maxW = el.clientWidth - pad;
      const maxH = el.clientHeight - pad;
      const s = Math.min(maxW / w, maxH / h);
      setStageSize({ w: Math.floor(w * s), h: Math.floor(h * s) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h]);

  /* Draw the text overlay; loop only while the orbit ring is animating. */
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !fonts) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (slide.ring && playing) {
      let raf = 0;
      const start = performance.now();
      let last = 0;
      const loop = (now: number) => {
        // ~30fps is plenty for the slow ring spin and keeps the full-res
        // overlay redraw cheap.
        if (now - last > 33) {
          last = now;
          drawOverlay(ctx, spec, activeIndex, fonts, (now - start) / 1000);
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }
    drawOverlay(ctx, spec, activeIndex, fonts, 0);
  }, [spec, activeIndex, fonts, slide.ring, playing]);

  /* ------------------------------------------------------------- editing */

  const patchSlide = useCallback(
    (patch: Partial<SlideSpec>) => {
      setSpec((s) => ({
        ...s,
        slides: s.slides.map((sl, i) =>
          i === activeIndex ? { ...sl, ...patch } : sl,
        ),
      }));
    },
    [activeIndex],
  );

  const patchLayer = (patch: Partial<LayerSpec> | Record<string, number | string>) =>
    patchSlide({
      layers: slide.layers.map((l, i) =>
        i === layerIndex ? ({ ...l, ...patch } as LayerSpec) : l,
      ),
    });

  // Changing the type keeps the layer's mixing and placement.
  const setShaderType = (type: ShaderType) =>
    patchSlide({
      layers: slide.layers.map((l, i) =>
        i === layerIndex
          ? {
              ...defaultLayer(type),
              opacity: l.opacity,
              blend: l.blend,
              offsetX: l.offsetX,
              offsetY: l.offsetY,
              rotation: l.rotation,
            }
          : l,
      ),
    });

  const addLayer = () => {
    if (slide.layers.length >= MAX_LAYERS) return;
    patchSlide({
      layers: [
        ...slide.layers,
        { ...defaultLayer("dithering"), blend: "multiply", opacity: 0.8 },
      ],
    });
    setActiveLayer(slide.layers.length);
  };

  const removeLayer = () => {
    if (slide.layers.length <= 1) return;
    patchSlide({ layers: slide.layers.filter((_, i) => i !== layerIndex) });
    setActiveLayer(Math.max(0, layerIndex - 1));
  };

  const moveLayer = (dir: -1 | 1) => {
    const j = layerIndex + dir;
    if (j < 0 || j >= slide.layers.length) return;
    const layers = [...slide.layers];
    [layers[layerIndex], layers[j]] = [layers[j], layers[layerIndex]];
    patchSlide({ layers });
    setActiveLayer(j);
  };

  const addSlide = () => {
    setSpec((s) => ({
      ...s,
      slides: [...s.slides, { ...s.slides[activeIndex] }],
    }));
    setActive(spec.slides.length);
  };

  const removeSlide = () => {
    if (spec.slides.length <= 1) return;
    setSpec((s) => ({
      ...s,
      slides: s.slides.filter((_, i) => i !== activeIndex),
    }));
    setActive(Math.max(0, activeIndex - 1));
  };

  const moveSlide = (dir: -1 | 1) => {
    const j = activeIndex + dir;
    if (j < 0 || j >= spec.slides.length) return;
    setSpec((s) => {
      const slides = [...s.slides];
      [slides[activeIndex], slides[j]] = [slides[j], slides[activeIndex]];
      return { ...s, slides };
    });
    setActive(j);
  };

  const say = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  };

  /* --------------------------------------- direct canvas manipulation */

  const dragRef = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
    rot: number;
    shift: boolean;
  } | null>(null);
  /* Touch: two fingers pinch-scale the selected layer. */
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);

  const onStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: layer.scale };
      dragRef.current = null;
    } else if (pointersRef.current.size === 1) {
      dragRef.current = {
        x: e.clientX,
        y: e.clientY,
        ox: layer.offsetX,
        oy: layer.offsetY,
        rot: layer.rotation,
        shift: e.shiftKey,
      };
    }
  };

  const onStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchRef.current && pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > 0 && pinchRef.current.dist > 0) {
        const next = pinchRef.current.scale * (dist / pinchRef.current.dist);
        patchLayer({ scale: Math.max(0.1, Math.min(4, next)) });
      }
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / stageSize.w;
    const dy = (e.clientY - d.y) / stageSize.h;
    if (d.shift) {
      patchLayer({ rotation: (((d.rot + dx * 360) % 360) + 360) % 360 });
    } else {
      patchLayer({
        offsetX: Math.max(-1, Math.min(1, d.ox + dx)),
        offsetY: Math.max(-1, Math.min(1, d.oy + dy)),
      });
    }
  };

  const onStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) dragRef.current = null;
  };

  /* Wheel = scale the selected layer (non-passive so we can preventDefault). */
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setSpec((s) => {
        const sl = s.slides[activeIndex];
        if (!sl) return s;
        const li = Math.min(layerIndex, sl.layers.length - 1);
        return {
          ...s,
          slides: s.slides.map((sd, i) =>
            i === activeIndex
              ? {
                  ...sd,
                  layers: sd.layers.map((l, j) =>
                    j === li
                      ? {
                          ...l,
                          scale: Math.max(
                            0.1,
                            Math.min(4, l.scale * Math.exp(-e.deltaY * 0.001)),
                          ),
                        }
                      : l,
                  ),
                }
              : sd,
          ),
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [activeIndex, layerIndex]);

  /* ------------------------------------------------------------ exports */

  const layerCanvases = () => {
    const wrappers = shaderBoxRef.current?.querySelectorAll("[data-layer]");
    return Array.from(wrappers ?? []).map((el) => el.querySelector("canvas"));
  };

  const savePng = () => {
    if (!overlayRef.current) return;
    exportPng(spec, activeIndex, layerCanvases(), overlayRef.current);
  };

  /* Batch runner: walks the slides, letting each remount and render before
     the per-slide export (PNG capture, video or GIF recording). */
  const eachSlide = async (
    label: string,
    fn: (i: number, report: (f: number) => void) => Promise<void> | void,
    only?: number,
  ) => {
    if (!fonts || job) return;
    const idx = only !== undefined ? [only] : spec.slides.map((_, i) => i);
    try {
      for (const i of idx) {
        const tag = idx.length > 1 ? `${label} ${i + 1}/${idx.length}` : label;
        setJob({ label: tag, frac: 0 });
        setActive(i);
        await new Promise((r) => setTimeout(r, 600));
        await fn(i, (f) => setJob({ label: tag, frac: f }));
      }
      say("Saved");
    } catch {
      say(`${label} export failed in this browser`);
    } finally {
      setJob(null);
    }
  };

  const pngSlide = (i: number) => {
    const overlay = overlayRef.current;
    if (!overlay || !fonts) return;
    const ctx = overlay.getContext("2d");
    if (ctx) drawOverlay(ctx, spec, i, fonts, 0);
    exportPng(spec, i, layerCanvases(), overlay);
  };

  const saveAllPngs = () => eachSlide("PNG", pngSlide);
  const saveVideo = () =>
    eachSlide(
      "Video",
      (i, rep) => recordVideo(spec, i, layerCanvases(), fonts!, rep),
      activeIndex,
    );
  const saveAllVideos = () =>
    eachSlide("Video", (i, rep) =>
      recordVideo(spec, i, layerCanvases(), fonts!, rep),
    );
  const saveGif = () =>
    eachSlide(
      "GIF",
      (i, rep) => recordGif(spec, i, layerCanvases(), fonts!, rep),
      activeIndex,
    );
  const saveAllGifs = () =>
    eachSlide("GIF", (i, rep) => recordGif(spec, i, layerCanvases(), fonts!, rep));

  /* ------------------------------------------------------- spec sharing */

  const shareUrl = () =>
    `${window.location.origin}/postlab#spec=${encodeSpec(spec)}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl());
    say("Link copied");
  };

  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
    say("Spec JSON copied");
  };

  const importSpec = () => {
    const text = importText.trim();
    if (!text) return;
    let next: PostSpec | null = null;
    const encoded = text.match(/spec=([A-Za-z0-9_-]+)/)?.[1];
    if (encoded) next = decodeSpec(encoded);
    if (!next) {
      try {
        next = normalizeSpec(JSON.parse(text));
      } catch {
        next = decodeSpec(text);
      }
    }
    if (next) {
      setSpec(next);
      setActive(0);
      setImportText("");
      say("Spec loaded");
    } else {
      say("Couldn't read that spec");
    }
  };

  /* -------------------------------------------------------------- render */

  return (
    <div className="min-h-dvh md:h-dvh flex flex-col">
      <header className="border-b border-line px-5 py-3 flex items-center justify-between text-sm shrink-0">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center rounded-full border border-line size-8 text-xs">
            P
          </span>
          <span className="font-serif italic text-lg">the Post Lab</span>
        </div>
        <div className="flex items-center gap-5 text-xs">
          {flash && <span className="text-muted">{flash}</span>}
          <Link href="/" className="underline underline-offset-4">
            the site
          </Link>
          <Link href="/studio" className="underline underline-offset-4">
            the Studio
          </Link>
        </div>
      </header>

      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Stage */}
        <div className="md:flex-1 flex flex-col min-w-0">
          <div
            ref={stageRef}
            className="h-[58vh] md:h-auto md:flex-1 flex items-center justify-center min-h-0"
          >
            <div
              ref={frameRef}
              className="relative border border-line overflow-hidden cursor-move touch-none"
              style={{ width: stageSize.w, height: stageSize.h }}
              onPointerDown={onStagePointerDown}
              onPointerMove={onStagePointerMove}
              onPointerUp={onStagePointerUp}
              onPointerCancel={onStagePointerUp}
            >
              <div
                ref={shaderBoxRef}
                className="absolute inset-0"
                style={{
                  background: tones(slide.theme).bg,
                  isolation: "isolate",
                }}
              >
                {slide.layers.map((l, i) => (
                  <div
                    key={`${i}-${l.type}-${slide.theme}-${spec.format}-${activeIndex}`}
                    data-layer
                    className="absolute inset-0"
                    style={{
                      opacity: l.opacity,
                      mixBlendMode: l.blend === "normal" ? undefined : l.blend,
                    }}
                  >
                    <ShaderLayer
                      shader={l}
                      theme={slide.theme}
                      playing={playing}
                      width={w}
                      height={h}
                      duration={spec.duration}
                    />
                  </div>
                ))}
              </div>
              <canvas
                ref={overlayRef}
                width={w}
                height={h}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
            </div>
          </div>

          {/* Slide strip */}
          <div className="border-t border-line px-5 py-3 flex items-center gap-2 shrink-0">
            {spec.slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`inline-flex items-center justify-center rounded-full border border-line size-9 text-xs transition-colors ${
                  i === activeIndex
                    ? "bg-foreground text-background"
                    : "hover:bg-foreground hover:text-background"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </button>
            ))}
            <button
              onClick={addSlide}
              aria-label="Add slide"
              className="inline-flex items-center justify-center rounded-full border border-line size-9 text-sm hover:bg-foreground hover:text-background transition-colors"
            >
              +
            </button>
            <div className="flex-1" />
            <span className="text-xs text-muted">
              {w} × {h}
            </span>
            <Button onClick={() => setPlaying((p) => !p)}>
              {playing ? "Pause" : "Play"}
            </Button>
          </div>
        </div>

        {/* Control panel */}
        <aside className="w-full md:w-[340px] shrink-0 border-t md:border-t-0 md:border-l border-line md:overflow-y-auto text-sm">
          <Section title="format">
            <Seg
              value={spec.format}
              options={(
                Object.keys(FORMATS) as (keyof typeof FORMATS)[]
              ).map((f) => ({
                value: f,
                label: FORMATS[f].label,
              }))}
              onChange={(format) => setSpec((s) => ({ ...s, format }))}
            />
            <p className="text-xs text-muted">
              {FORMATS[spec.format].hint} · {w}×{h}
            </p>
            <Row label="theme">
              <Seg
                value={slide.theme}
                options={[
                  { value: "light" as const, label: "light" },
                  { value: "dark" as const, label: "dark" },
                ]}
                onChange={(theme) => patchSlide({ theme })}
              />
            </Row>
            <Row label="duration">
              <input
                type="range"
                min={2}
                max={15}
                step={1}
                value={spec.duration}
                onChange={(e) =>
                  setSpec((s) => ({ ...s, duration: Number(e.target.value) }))
                }
                className="flex-1 accent-foreground"
              />
              <span className="w-8 text-right text-xs">{spec.duration}s</span>
            </Row>
          </Section>

          <Section title={`slide ${String(activeIndex + 1).padStart(2, "0")}`}>
            <TextInput
              value={slide.kicker}
              onChange={(kicker) => patchSlide({ kicker })}
            />
            <TextInput
              value={slide.title}
              rows={3}
              onChange={(title) => patchSlide({ title })}
            />
            <TextInput
              value={slide.body}
              rows={2}
              onChange={(body) => patchSlide({ body })}
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <TextInput
                  value={slide.footer}
                  onChange={(footer) => patchSlide({ footer })}
                />
              </div>
              <input
                value={slide.letter}
                maxLength={1}
                placeholder="M"
                aria-label="Circled letter"
                onChange={(e) => patchSlide({ letter: e.target.value })}
                className="w-11 border border-line bg-transparent text-center text-sm focus:outline-none focus:border-foreground"
              />
            </div>
            <Row label="type">
              <Seg
                value={slide.titleFont}
                options={[
                  { value: "serif" as const, label: "serif" },
                  { value: "sans" as const, label: "sans" },
                ]}
                onChange={(titleFont) => patchSlide({ titleFont })}
              />
            </Row>
            <Row label="size">
              <Seg
                value={slide.titleSize}
                options={[
                  { value: "s" as const, label: "S" },
                  { value: "m" as const, label: "M" },
                  { value: "l" as const, label: "L" },
                ]}
                onChange={(titleSize) => patchSlide({ titleSize })}
              />
            </Row>
            <Row label="align">
              <Seg
                value={slide.align}
                options={[
                  { value: "left" as const, label: "left" },
                  { value: "center" as const, label: "center" },
                ]}
                onChange={(align) => patchSlide({ align })}
              />
            </Row>
            <div className="flex gap-4 text-xs pt-1">
              {(
                [
                  ["text", slide.text, () => patchSlide({ text: !slide.text })],
                  ["italic", slide.italic, () => patchSlide({ italic: !slide.italic })],
                  ["boxed", slide.boxed, () => patchSlide({ boxed: !slide.boxed })],
                  ["plate", slide.plate, () => patchSlide({ plate: !slide.plate })],
                  ["ring", slide.ring, () => patchSlide({ ring: !slide.ring })],
                ] as const
              ).map(([label, on, toggle]) => (
                <button
                  key={label}
                  onClick={toggle}
                  className={`underline-offset-4 ${on ? "underline" : "text-muted hover:text-foreground"}`}
                >
                  {on ? "◉" : "○"} {label}
                </button>
              ))}
            </div>
            <Row label="veil">
              <input
                type="range"
                min={0}
                max={0.9}
                step={0.05}
                value={slide.veil}
                onChange={(e) => patchSlide({ veil: Number(e.target.value) })}
                className="flex-1 accent-foreground"
              />
              <span className="w-8 text-right text-xs text-muted">
                {slide.veil.toFixed(2)}
              </span>
            </Row>
            <div className="flex gap-2 pt-1">
              <Button onClick={addSlide}>Duplicate</Button>
              <Button onClick={() => moveSlide(-1)}>←</Button>
              <Button onClick={() => moveSlide(1)}>→</Button>
              <Button onClick={removeSlide} disabled={spec.slides.length <= 1}>
                Delete
              </Button>
            </div>
          </Section>

          <Section title="layers">
            <div className="border border-line divide-y divide-line">
              {[...slide.layers].reverse().map((l, ri) => {
                const i = slide.layers.length - 1 - ri; // top layer listed first
                return (
                  <button
                    key={i}
                    onClick={() => setActiveLayer(i)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 text-xs text-left transition-colors ${
                      i === layerIndex
                        ? "bg-foreground text-background"
                        : "hover:text-muted"
                    }`}
                  >
                    <span className="flex-1">
                      {String(i + 1).padStart(2, "0")} — {shaderDef(l.type).label}
                    </span>
                    <span className="opacity-60">
                      {l.blend !== "normal" ? l.blend : ""}
                      {l.opacity < 1 ? ` ${Math.round(l.opacity * 100)}%` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={addLayer}
                disabled={slide.layers.length >= MAX_LAYERS}
              >
                Add layer
              </Button>
              <Button onClick={() => moveLayer(1)}>↑</Button>
              <Button onClick={() => moveLayer(-1)}>↓</Button>
              <Button onClick={removeLayer} disabled={slide.layers.length <= 1}>
                Delete
              </Button>
            </div>
            <Row label="blend">
              <select
                value={layer.blend}
                onChange={(e) =>
                  patchLayer({ blend: e.target.value as LayerSpec["blend"] })
                }
                className="flex-1 border border-line bg-transparent px-2 py-1.5 text-xs focus:outline-none"
              >
                {BLENDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="opacity">
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={layer.opacity}
                onChange={(e) =>
                  patchLayer({ opacity: Number(e.target.value) })
                }
                className="flex-1 accent-foreground"
              />
              <span className="w-10 text-right text-xs text-muted">
                {Math.round(layer.opacity * 100)}%
              </span>
            </Row>
            <div className="flex border border-line divide-x divide-line">
              {SHADERS.map((s) => (
                <button
                  key={s.type}
                  onClick={() => setShaderType(s.type)}
                  className={`flex-1 px-2 py-1.5 text-xs transition-colors ${
                    layer.type === s.type
                      ? "bg-foreground text-background"
                      : "bg-background hover:text-muted"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {(def.choices ?? []).map((c) => (
              <Row key={c.key} label={c.label}>
                <select
                  value={String(layer[c.key] ?? c.def)}
                  onChange={(e) => patchLayer({ [c.key]: e.target.value })}
                  className="flex-1 border border-line bg-transparent px-2 py-1.5 text-xs focus:outline-none"
                >
                  {c.values.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Row>
            ))}
            {def.controls.map((c) => (
              <Row key={c.key} label={c.label}>
                <input
                  type="range"
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  value={Number(layer[c.key] ?? c.def)}
                  onChange={(e) =>
                    patchLayer({ [c.key]: Number(e.target.value) })
                  }
                  className="flex-1 accent-foreground"
                />
                <span className="w-10 text-right text-xs text-muted">
                  {Number(layer[c.key] ?? c.def).toFixed(c.step < 1 ? 2 : 0)}
                </span>
              </Row>
            ))}
            <p className="text-[10px] uppercase tracking-wide text-muted pt-1">
              transform
            </p>
            {(
              [
                ["x", "offsetX", -1, 1, 0.01],
                ["y", "offsetY", -1, 1, 0.01],
                ["scale", "scale", 0.1, 4, 0.05],
                ["rotation", "rotation", 0, 360, 1],
              ] as const
            ).map(([label, key, min, max, step]) => (
              <Row key={key} label={label}>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={layer[key]}
                  onChange={(e) => patchLayer({ [key]: Number(e.target.value) })}
                  className="flex-1 accent-foreground"
                />
                <span className="w-10 text-right text-xs text-muted">
                  {Number(layer[key]).toFixed(step < 1 ? 2 : 0)}
                </span>
              </Row>
            ))}
            <div className="flex items-center justify-between">
              <Button
                onClick={() =>
                  patchLayer({ offsetX: 0, offsetY: 0, rotation: 0, scale: 1 })
                }
              >
                Reset transform
              </Button>
            </div>
            <p className="text-xs text-muted">
              Drag the canvas to move the selected layer, scroll to scale,
              shift-drag to rotate.
            </p>
          </Section>

          <Section title="presets">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.name}
                  onClick={() => {
                    setSpec(normalizeSpec(structuredClone(p.spec)));
                    setActive(0);
                  }}
                >
                  {p.name}
                </Button>
              ))}
            </div>
          </Section>

          <Section title="export">
            <div className="flex flex-wrap gap-2">
              <Button onClick={savePng} primary disabled={!!job}>
                PNG — this slide
              </Button>
              {spec.slides.length > 1 && (
                <Button onClick={saveAllPngs} disabled={!!job}>
                  PNG × {spec.slides.length}
                </Button>
              )}
              <Button onClick={saveVideo} disabled={!!job}>
                Video — {spec.duration}s
              </Button>
              {spec.slides.length > 1 && (
                <Button onClick={saveAllVideos} disabled={!!job}>
                  Video × {spec.slides.length}
                </Button>
              )}
              <Button onClick={saveGif} disabled={!!job}>
                GIF — {spec.duration}s
              </Button>
              {spec.slides.length > 1 && (
                <Button onClick={saveAllGifs} disabled={!!job}>
                  GIF × {spec.slides.length}
                </Button>
              )}
            </div>
            {job && (
              <p className="text-xs">
                {job.label} — {Math.round(job.frac * 100)}%
              </p>
            )}
            <p className="text-xs text-muted">
              Stills export at {w}×{h}. Video records the animated slide (MP4
              where the browser supports it, WebM otherwise); GIFs record at
              half size and loop forever.
            </p>
          </Section>

          <Section title="claude">
            <div className="flex flex-wrap gap-2">
              <Button onClick={copyLink}>Copy link</Button>
              <Button onClick={copyJson}>Copy spec JSON</Button>
            </div>
            <TextInput
              value={importText}
              rows={3}
              onChange={setImportText}
            />
            <div className="flex items-center justify-between">
              <Button onClick={importSpec}>Load spec</Button>
              <a
                href="/api/postlab/schema"
                target="_blank"
                className="text-xs underline underline-offset-4"
              >
                spec schema →
              </a>
            </div>
            <p className="text-xs text-muted">
              Paste a spec (JSON or link) from Claude above, or point Claude at
              the spec schema and ask it to turn any text — a note, a Notion
              doc — into a Post Lab link.
            </p>
          </Section>
        </aside>
      </div>
    </div>
  );
}
