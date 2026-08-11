"use client";

// the Posts Studio — where the club's posts are made: a filmstrip of slides
// and the layer stack on the left, the post itself in the middle, everything
// about whatever is selected on the right, and the loop along the bottom.
//
// That shape is not a preference. Every editor built around a moving image
// settles on it — structure left, canvas centre, inspector right, time along
// the bottom — because each panel answers a different question and you always
// know which one you're asking. Choosing happens on the left, changing happens
// on the right, and the right follows the selection.
//
// The studio makes two kinds of post and they share every control: sheets —
// ruled paper, an oval label, a headline that mixes roman and italic — and the
// club's dithered graphics. A recipe is how you start; nothing else is a mode.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BLENDS,
  FORMATS,
  GROUNDS,
  MAX_LAYERS,
  MIX_MODES,
  PALETTE,
  PRESETS,
  FILTERS,
  SHADERS,
  SLIDE_PARTS,
  SPEC_VERSION,
  WAVES,
  animatable,
  applyStyle,
  decodeSpec,
  defaultFilter,
  defaultLayer,
  defaultSlide,
  encodeSpec,
  filterDef,
  loopReport,
  normalizeSpec,
  openingSpec,
  partOn,
  plainTitle,
  randomShader,
  randomSlide,
  shaderDef,
  slideTones,
  specFromQuery,
  styleOf,
  usesPhoto,
  varyStyle,
  type FilterSpec,
  type LayerSpec,
  type Motion,
  type PostSpec,
  type ShaderControl,
  type ShaderType,
  type SlideSpec,
  type SlideStyle,
  type Wave,
} from "@/lib/postlab";
import ShaderLayer from "./ShaderLayer";
import { drawOverlay, loadFonts, type Fonts } from "./overlay";
import {
  canRenderDirectly,
  exportPng,
  recordGif,
  recordVideo,
} from "./exporter";
import { loadSlidePhotos, photoUrl, readFile, savePhoto } from "./photos";
import { clock } from "./clock";
import Poster from "./Poster";
import Tracks from "./Tracks";
import { Btn, Dial, Field, Num, Panel, Row, Seg, Swatches, Switch } from "./ui";

/* ------------------------------------------------------------- small parts */

const WAVE_HINTS: Record<Wave, string> = {
  sin: "sin — eases both ways",
  tri: "tri — straight there and back",
  saw: "saw — ramps, then snaps",
  square: "square — switches hard",
};

/* The select needs to say what each one looks like, not what it is called in
   the renderer. */
const MIX_MODE_HINTS: Record<string, string> = {
  blocks: "blocks — a mosaic of patches",
  bands: "bands — stripes sweeping down",
  radial: "radial — rings out of the centre",
  source: "source — colour follows the shape",
  noise: "noise — pixel by pixel, no grid",
};

const GROUND_NAMES = Object.fromEntries(GROUNDS.map((g) => [g.hex, g.label]));

/* One parameter: the number, and — on a layer the club renders itself — the
   option of making that number travel over the loop instead of holding still.
   The travelling is the whole reason a background stops looking like a pattern
   and starts looking like a piece of motion. */
function ParamRow({
  control,
  value,
  motion,
  canMove,
  onChange,
  onMotion,
}: {
  control: ShaderControl;
  value: number;
  motion?: Motion;
  canMove: boolean;
  onChange: (v: number) => void;
  onMotion: (m: Motion | null) => void;
}) {
  const c = control;
  const slider = (v: number, set: (n: number) => void) => (
    <input
      type="range"
      min={c.min}
      max={c.max}
      step={c.step}
      value={v}
      aria-label={c.label}
      onChange={(e) => set(Number(e.target.value))}
      className="flex-1 accent-foreground"
    />
  );
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted shrink-0 w-16 truncate">{c.label}</span>
        {slider(value, onChange)}
        <Num
          value={value}
          min={c.min}
          max={c.max}
          step={c.step}
          onChange={onChange}
        />
        {canMove && (
          <button
            onClick={() =>
              onMotion(
                motion
                  ? null
                  : {
                      /* Somewhere worth travelling to: the far end of the
                         range from wherever the slider is now. */
                      to:
                        value < (c.min + c.max) / 2
                          ? c.min + (c.max - c.min) * 0.8
                          : c.min + (c.max - c.min) * 0.2,
                      wave: "sin",
                      cycles: 1,
                      phase: 0,
                    },
              )
            }
            title={motion ? "Hold this one still" : "Make this one travel"}
            className={`shrink-0 w-4 text-center ${
              motion ? "text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {motion ? "◉" : "○"}
          </button>
        )}
      </div>
      {motion && (
        <div className="space-y-1.5 border-l border-line pl-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted shrink-0 w-16">to</span>
            {slider(motion.to, (to) => onMotion({ ...motion, to }))}
            <Num
              value={motion.to}
              min={c.min}
              max={c.max}
              step={c.step}
              onChange={(to) => onMotion({ ...motion, to })}
            />
            <span className="w-4" />
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted shrink-0 w-16">wave</span>
            <select
              value={motion.wave ?? "sin"}
              onChange={(e) => onMotion({ ...motion, wave: e.target.value as Wave })}
              className="flex-1 border border-line bg-transparent px-2 py-1 text-xs focus:outline-none"
            >
              {WAVES.map((wv) => (
                <option key={wv} value={wv}>
                  {WAVE_HINTS[wv]}
                </option>
              ))}
            </select>
            <select
              value={motion.cycles ?? 1}
              onChange={(e) => onMotion({ ...motion, cycles: Number(e.target.value) })}
              title="Trips per loop — whole numbers only, which is what keeps the post seamless"
              className="w-14 border border-line bg-transparent px-1 py-1 text-xs focus:outline-none"
            >
              {[1, 2, 3, 4, 6, 8].map((n) => (
                <option key={n} value={n}>
                  ×{n}
                </option>
              ))}
            </select>
            <span className="w-4" />
          </div>
        </div>
      )}
    </div>
  );
}

/* The layer stack and the type over it: the only things that redraw with the
   clock, so the only things that re-render with it. */
function Stage({
  spec,
  index,
  fonts,
  shaderBoxRef,
  overlayRef,
  solo,
}: {
  spec: PostSpec;
  index: number;
  fonts: Fonts | null;
  shaderBoxRef: React.RefObject<HTMLDivElement | null>;
  overlayRef: React.RefObject<HTMLCanvasElement | null>;
  solo: number | null;
}) {
  const slide = spec.slides[index];
  const { w, h } = FORMATS[spec.format];

  /* The type is redrawn when the post changes, and — only if the orbit ring
     is turning — as the playhead moves. This redraws every glyph at full
     resolution, so it is deliberately the one thing that doesn't follow the
     clock unless it has to, and it follows it at 30fps rather than 60. */
  useEffect(() => {
    const ctx = overlayRef.current?.getContext("2d");
    if (!ctx || !fonts) return;
    drawOverlay(ctx, spec, index, fonts, 0);
    if (!slide.ring) return;
    let last = -1;
    return clock.watch((t) => {
      if (t - last < 1 / 30 && t > last) return;
      last = t;
      drawOverlay(ctx, spec, index, fonts, t);
    });
  }, [spec, index, fonts, slide.ring, overlayRef]);

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
            {/* The wrapper stays even when the layer is off, so the
                exporter's index-to-canvas mapping doesn't shift. */}
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

/* The inspector follows the selection, the way this kind of editor always
   does. Five rooms rather than one corridor: the words, the sheet they're set
   on, the selected layer, the ways of making a post from something other than
   a blank, and getting it out. */
const TABS = [
  ["make", "make"],
  ["words", "words"],
  ["look", "look"],
  ["layer", "layer"],
  ["out", "out"],
] as const;
type Tab = (typeof TABS)[number][0];

/* ------------------------------------------------------------------ studio */

export default function PostLab() {
  const [spec, setSpec] = useState<PostSpec>(openingSpec);
  const [active, setActive] = useState(0);
  const [activeLayer, setActiveLayer] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [tab, setTab] = useState<Tab>("make");
  const [fonts, setFonts] = useState<Fonts | null>(null);
  const [job, setJob] = useState<{ label: string; frac: number } | null>(null);
  const [flash, setFlash] = useState("");
  const [importText, setImportText] = useState("");
  /* A look held aside to put on other slides. Not part of the spec: it's a
     clipboard, and it dies with the tab like one. */
  const [styleClip, setStyleClip] = useState<SlideStyle | null>(null);
  const [wiggle, setWiggle] = useState(0.25);
  /* A sheet of rolled looks to choose from. Also outside the spec: they're
     candidates, and only the one you pick becomes the post. */
  const [sheet, setSheet] = useState<SlideStyle[]>([]);
  /* Looking at one layer on its own. A way of working, not a setting — it
     never reaches the spec or the export. */
  const [solo, setSolo] = useState<number | null>(null);
  /* The margin drawn over the stage. A view option like every other one in a
     motion tool's view bar: it never reaches the post. */
  const [guides, setGuides] = useState(false);
  /* An export setting, not a design one, so it stays out of the spec and out
     of shared links. */
  const [quality, setQuality] = useState<"mid" | "high" | "max">("high");

  const stageRef = useRef<HTMLDivElement>(null);
  const shaderBoxRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  /* The last hash this component wrote, so its own serialisation is never
     mistaken for someone opening a link. */
  const ownHashRef = useRef<string | null>(null);
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
      if (decoded) {
        setSpec(decoded);
        setTab("words");
      }
    });
  }, []);

  /* Keep the URL shareable as the spec changes. */
  useEffect(() => {
    const id = setTimeout(() => {
      const encoded = encodeSpec(spec);
      ownHashRef.current = encoded;
      window.history.replaceState(null, "", `#spec=${encoded}`);
    }, 400);
    return () => clearTimeout(id);
  }, [spec]);

  /* Following a #spec= link while the tool is already open changes the hash
     without remounting, so the mount-time read above never fires and the
     writer above would then overwrite the incoming link with whatever was
     already loaded. Listen for the navigation instead: opening a post from
     Notion has to work in a reused tab, which is what a phone always does. */
  useEffect(() => {
    const onHashChange = () => {
      const encoded = window.location.hash.match(/spec=([^&]+)/)?.[1];
      if (!encoded || encoded === ownHashRef.current) return;
      const decoded = decodeSpec(encoded);
      if (!decoded) return;
      ownHashRef.current = encoded;
      setSpec(decoded);
      setActive(0);
      setActiveLayer(0);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  /* Fit the slide into the available stage area. */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => {
      const pad = 56;
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

  /* The clock. While playing it advances in real time and wraps at the post
     duration; scrubbing sets it directly. Everything downstream is a function
     of it, so a paused frame is exactly the frame that exports. */
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      clock.set((clock.get() + dt) % Math.max(2, spec.duration));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, spec.duration]);

  /* The shortcuts a motion tool is expected to have. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      const D = Math.max(2, spec.duration);
      const step = (by: number) => {
        setPlaying(false);
        clock.set(((clock.get() + by) % D + D) % D);
      };
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowRight") step(e.shiftKey ? 1 : 1 / 30);
      else if (e.key === "ArrowLeft") step(e.shiftKey ? -1 : -1 / 30);
      else if (e.key === "Home") {
        setPlaying(false);
        clock.set(0);
      } else if (e.key === "ArrowDown") setActive((i) => Math.min(spec.slides.length - 1, i + 1));
      else if (e.key === "ArrowUp") setActive((i) => Math.max(0, i - 1));
      else if (e.key.toLowerCase() === "g") setGuides((g) => !g);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spec.duration, spec.slides.length]);

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

  const patchLayerAt = (
    index: number,
    patch: Partial<LayerSpec> | Record<string, number | string>,
  ) =>
    patchSlide({
      layers: slide.layers.map((l, i) =>
        i === index ? ({ ...l, ...patch } as LayerSpec) : l,
      ),
    });

  const patchLayer = (patch: Partial<LayerSpec> | Record<string, number | string>) =>
    patchLayerAt(layerIndex, patch);

  /* Only the club's own renderer reads a parameter every frame; the WebGL
     shader takes its uniforms once. */
  const canMove = shaderDef(layer.type).kind === "generative";
  const wantsPhoto = usesPhoto(layer);

  /* What each family is drawn at when nothing has been asked for. */
  const defaultWeight =
    slide.titleFont === "serif" ? 500 : slide.titleFont === "gothic" ? 400 : 600;

  /* The file never leaves the browser: the layer keeps a `local:` handle and
     the picture sits in this device's storage, like the Studio's token. */
  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const src = savePhoto(await readFile(file));
      patchLayer({ src } as Partial<LayerSpec>);
      say("Photo on this device");
    } catch {
      say("Couldn't read that file");
    }
  };

  /* The filter chain on the selected layer. Dropped entirely when it empties
     so a link never carries an empty list. */
  const setFilters = (list: FilterSpec[]) =>
    patchLayer({ filters: list.length ? list : undefined } as Partial<LayerSpec>);

  const addFilter = (type: string) =>
    setFilters([...(layer.filters ?? []), defaultFilter(type)]);

  const removeFilter = (i: number) =>
    setFilters((layer.filters ?? []).filter((_, j) => j !== i));

  const patchFilter = (i: number, patch: Record<string, number | string>) =>
    setFilters((layer.filters ?? []).map((f, j) => (j === i ? { ...f, ...patch } : f)));

  /* Order matters: pixelate before grain is a screened image with grain over
     it, grain before pixelate is grain that got screened. */
  const moveFilter = (i: number, dir: -1 | 1) => {
    const list = [...(layer.filters ?? [])];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setFilters(list);
  };

  /* Give a parameter a wave, or take it away. An empty motion map is removed
     entirely so it never reaches a link. */
  const setMotion = (key: string, m: Motion | null) => {
    const motion = { ...(layer.motion ?? {}) };
    if (m) motion[key] = m;
    else delete motion[key];
    patchLayer({
      motion: Object.keys(motion).length ? motion : undefined,
    } as Partial<LayerSpec>);
  };

  /* Switching a part off keeps its words; `off` is dropped entirely when
     nothing is hidden, so a link never carries an empty list. */
  const togglePart = (part: string) => {
    const off = new Set(slide.off ?? []);
    if (off.has(part)) off.delete(part);
    else off.add(part);
    patchSlide({ off: off.size ? [...off] : undefined });
  };

  const onlyParts = (keep: string[]) =>
    patchSlide({ off: SLIDE_PARTS.filter((p) => !keep.includes(p)) });

  /* The colours a mix layer is currently allowed to use. No `inks` on the
     layer means all of them, which is the normal case. */
  const mixInks = layer.inks?.length ? layer.inks : [...(slide.palette ?? PALETTE)];

  /* Dropping the last one would leave the layer with nothing to draw with, so
     the last colour standing can't be turned off. Turning them all back on
     clears the field instead of storing a copy of the palette, so the layer
     goes back to following it. */
  const toggleMixInk = (hex: string) => {
    const on = mixInks.includes(hex);
    if (on && mixInks.length <= 1) return;
    const next = on ? mixInks.filter((c) => c !== hex) : [...mixInks, hex];
    const whole = (slide.palette ?? PALETTE).every((c) => next.includes(c));
    patchLayer({ inks: whole ? undefined : next } as Partial<LayerSpec>);
  };

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

  /* Reroll a layer's form: a new family, new shape and new parameters, but the
     same place in the stack, the same mixing and the same colour, so a
     randomised layer drops into a composition you've already built. Colour is
     a decision, not a roll — the dice never touch it. */
  const reroll = (l: LayerSpec): LayerSpec =>
    ({
      ...defaultLayer("dithering"),
      opacity: l.opacity,
      blend: l.blend,
      offsetX: l.offsetX,
      offsetY: l.offsetY,
      rotation: l.rotation,
      ...randomShader(),
      ...(l.ink ? { ink: l.ink } : {}),
      ...(l.inks ? { inks: l.inks } : {}),
      ...(l.mixMode ? { mixMode: l.mixMode } : {}),
      ...(l.mixScale !== undefined ? { mixScale: l.mixScale } : {}),
      ...(l.mixSpeed !== undefined ? { mixSpeed: l.mixSpeed } : {}),
    }) as LayerSpec;

  const randomizeLayer = () =>
    patchSlide({
      layers: slide.layers.map((l, i) => (i === layerIndex ? reroll(l) : l)),
      colorSeed: Math.floor(Math.random() * 9999) + 1,
    });

  /* The whole stack at once, for when nothing in front of you is working. */
  const randomizeSlide = () =>
    patchSlide({
      layers: slide.layers.map(reroll),
      colorSeed: Math.floor(Math.random() * 9999) + 1,
    });

  const addLayer = () => {
    if (slide.layers.length >= MAX_LAYERS) return;
    patchSlide({
      layers: [
        ...slide.layers,
        { ...defaultLayer("forms"), blend: "multiply", opacity: 0.8 },
      ],
    });
    setActiveLayer(slide.layers.length);
    setTab("layer");
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

  /* ------------------------------------------------------------- styles */

  /* A style is this slide with the words taken out. Copying one and pasting it
     across a carousel is what makes six slides read as one piece; asking for
     variations is the same rules with room to move, which is how you get a
     family of posts instead of the same post twice. */
  const copyStyle = () => {
    setStyleClip(styleOf(slide));
    say("Look copied");
  };

  const pasteStyle = (everywhere: boolean) => {
    if (!styleClip) return;
    setSpec((s) => ({
      ...s,
      slides: s.slides.map((sl, i) =>
        everywhere || i === activeIndex ? applyStyle(sl, styleClip) : sl,
      ),
    }));
    say(everywhere ? "Pasted on every slide" : "Pasted");
  };

  /* --------------------------------------------------------- generating */

  /* A sheet of looks rolled from nothing. Picking one puts it on this slide
     and leaves the words where they are — the whole point is to choose a
     graphic rather than to build one, so nothing is committed until a
     thumbnail is clicked. */
  const roll = (n = 9) => setSheet(Array.from({ length: n }, () => randomSlide()));

  const pickCandidate = (style: SlideStyle) => {
    patchSlide(structuredClone(style));
    setActiveLayer(0);
    say("Applied");
  };

  /* New slides carrying this slide's words and a jittered version of its look,
     dropped in right after it so you can flip between them in the strip and
     keep the one that works. */
  const makeVariations = (n: number) => {
    const style = styleOf(slide);
    setSpec((s) => {
      const born = Array.from({ length: n }, () => ({
        ...structuredClone(slide),
        ...varyStyle(style, wiggle),
      })) as SlideSpec[];
      const slides = [...s.slides];
      slides.splice(activeIndex + 1, 0, ...born);
      return { ...s, slides: slides.slice(0, 20) };
    });
    setActive(activeIndex + 1);
    say(`${n} variations`);
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
    setSpec((s) => ({ ...s, slides: s.slides.filter((_, i) => i !== activeIndex) }));
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

  /* Whether the exported clip comes back to its first frame, and whether we
     get to draw it ourselves rather than film it going past. */
  const loop = loopReport(slide);
  const direct = canRenderDirectly(spec, activeIndex);

  /* 1080 is the Instagram baseline; "max" targets 4K on the long-ish edge. */
  const scale = quality === "mid" ? 1 : quality === "high" ? 2 : 3840 / 1080;
  const outW = Math.round(FORMATS[spec.format].w * scale);
  const outH = Math.round(FORMATS[spec.format].h * scale);

  const layerCanvases = () => {
    const wrappers = shaderBoxRef.current?.querySelectorAll("[data-layer]");
    return Array.from(wrappers ?? []).map((el) => el.querySelector("canvas"));
  };

  const savePng = async () => {
    if (!overlayRef.current) return;
    await loadSlidePhotos(slide.layers);
    exportPng(spec, activeIndex, layerCanvases(), overlayRef.current, fonts, scale);
  };

  /* Batch runner: walks the slides, letting each remount and render before the
     per-slide export (PNG capture, video or GIF recording). */
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
        /* Nothing gets exported holding a picture that hasn't decoded. */
        await loadSlidePhotos(spec.slides[i]?.layers ?? []);
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
    exportPng(spec, i, layerCanvases(), overlay, fonts, scale);
  };

  const saveAllPngs = () => eachSlide("PNG", pngSlide);
  const saveVideo = () =>
    eachSlide(
      "Video",
      (i, rep) => recordVideo(spec, i, layerCanvases(), fonts!, rep, scale),
      activeIndex,
    );
  const saveAllVideos = () =>
    eachSlide("Video", (i, rep) =>
      recordVideo(spec, i, layerCanvases(), fonts!, rep, scale),
    );
  const saveGif = () =>
    eachSlide(
      "GIF",
      (i, rep) => recordGif(spec, i, layerCanvases(), fonts!, rep, scale),
      activeIndex,
    );
  const saveAllGifs = () =>
    eachSlide("GIF", (i, rep) => recordGif(spec, i, layerCanvases(), fonts!, rep, scale));

  /* ------------------------------------------------------- spec sharing */

  const shareUrl = () => `${window.location.origin}/postlab#spec=${encodeSpec(spec)}`;

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

  const stagePad = (slide.margin ?? 96) * (stageSize.w / 1080);

  return (
    <div className="min-h-dvh md:h-dvh flex flex-col">
      {/* The command bar: what this is, what shape it is, and the one button
          you press when it's done. */}
      <header className="border-b border-line px-4 py-2.5 flex items-center justify-between gap-4 text-sm shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center justify-center rounded-full border border-line size-8 text-xs shrink-0">
            P
          </span>
          <span className="font-serif italic text-lg shrink-0">the Posts Studio</span>
          <div className="hidden sm:flex items-center gap-2 pl-3">
            <div className="w-[184px]">
              <Seg
                value={spec.format}
                options={(Object.keys(FORMATS) as (keyof typeof FORMATS)[]).map((f) => ({
                  value: f,
                  label: FORMATS[f].label,
                  title: FORMATS[f].hint,
                }))}
                onChange={(format) => setSpec((s) => ({ ...s, format }))}
              />
            </div>
            <span className="text-xs text-muted tabular-nums hidden lg:inline">
              {w}×{h}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs shrink-0">
          {flash && <span className="text-muted">{flash}</span>}
          {job && (
            <span className="tabular-nums">
              {job.label} — {Math.round(job.frac * 100)}%
            </span>
          )}
          <Btn onClick={savePng} primary disabled={!!job}>
            Export PNG
          </Btn>
          <Link href="/desk" className="underline underline-offset-4 hidden sm:inline">
            the Desk
          </Link>
          <Link href="/studio" className="underline underline-offset-4 hidden sm:inline">
            the Studio
          </Link>
        </div>
      </header>

      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Left: what the post is made of, as pictures. A filmstrip is the
            only honest list of slides — a row of titles tells you what a
            slide says, not what it looks like. */}
        <aside className="w-full md:w-[188px] shrink-0 border-b md:border-b-0 md:border-r border-line md:overflow-y-auto order-2 md:order-1">
          <Panel title={`slides — ${spec.slides.length}`}>
            <div className="flex md:block gap-2 md:gap-0 overflow-x-auto md:overflow-visible">
              {spec.slides.map((sl, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  title={plainTitle(sl.title) || sl.kicker || "—"}
                  className={`w-[96px] md:w-full shrink-0 md:mb-2 border text-left transition-colors ${
                    i === activeIndex
                      ? "border-foreground"
                      : "border-line hover:border-foreground/50"
                  }`}
                >
                  <Poster spec={spec} index={i} fonts={fonts} width={150} />
                  <span
                    className={`block px-1.5 py-1 text-[10px] tabular-nums truncate ${
                      i === activeIndex
                        ? "bg-foreground text-background"
                        : "text-muted"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}{" "}
                    {plainTitle(sl.title).slice(0, 22) || sl.kicker || "—"}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Btn onClick={addSlide} title="Duplicate this slide">
                +
              </Btn>
              <Btn onClick={() => moveSlide(-1)}>↑</Btn>
              <Btn onClick={() => moveSlide(1)}>↓</Btn>
              <Btn onClick={removeSlide} disabled={spec.slides.length <= 1}>
                ×
              </Btn>
            </div>
          </Panel>

          <Panel title="layers">
            <div className="border border-line divide-y divide-line">
              {[...slide.layers].reverse().map((l, ri) => {
                const i = slide.layers.length - 1 - ri; // top layer listed first
                const on = !l.mute && (solo === null || solo === i);
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-1.5 px-2 py-2 text-xs ${
                      i === layerIndex ? "bg-foreground text-background" : ""
                    }`}
                  >
                    {/* Off without being deleted, so a stack can be taken
                        apart and put back together. */}
                    <button
                      onClick={() => patchLayerAt(i, { mute: l.mute ? undefined : true })}
                      title={l.mute ? "Switch this layer on" : "Switch this layer off"}
                      className={`w-3.5 shrink-0 ${on ? "" : "opacity-40"}`}
                    >
                      {l.mute ? "○" : "◉"}
                    </button>
                    <button
                      onClick={() => setSolo(solo === i ? null : i)}
                      title="Show this layer on its own"
                      className={`w-3.5 shrink-0 ${
                        solo === i ? "" : "opacity-40 hover:opacity-100"
                      }`}
                    >
                      {solo === i ? "◆" : "◇"}
                    </button>
                    <button
                      onClick={() => {
                        setActiveLayer(i);
                        setTab("layer");
                      }}
                      className={`flex-1 text-left truncate ${
                        i === layerIndex ? "" : "hover:text-muted"
                      } ${on ? "" : "line-through opacity-50"}`}
                    >
                      {String(i + 1).padStart(2, "0")}{" "}
                      {l.type === "forms"
                        ? String(l.pattern ?? "rings")
                        : shaderDef(l.type).label}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Btn onClick={addLayer} disabled={slide.layers.length >= MAX_LAYERS}>
                +
              </Btn>
              <Btn onClick={() => moveLayer(1)}>↑</Btn>
              <Btn onClick={() => moveLayer(-1)}>↓</Btn>
              <Btn onClick={removeLayer} disabled={slide.layers.length <= 1}>
                ×
              </Btn>
            </div>
            {solo !== null && (
              <p className="text-xs text-muted leading-relaxed">
                Layer {String(solo + 1).padStart(2, "0")} on its own. Solo is a way
                of looking, not a setting: it isn&apos;t saved and it doesn&apos;t
                reach the export.
              </p>
            )}
          </Panel>
        </aside>

        {/* Middle: the post, and the handful of things that are about looking
            at it rather than about changing it. */}
        <div className="md:flex-1 flex flex-col min-w-0 order-1 md:order-2">
          <div className="border-b border-line px-4 py-2 flex items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-3">
              <span className="tabular-nums text-muted">
                {String(activeIndex + 1).padStart(2, "0")} /{" "}
                {String(spec.slides.length).padStart(2, "0")}
              </span>
              <button
                onClick={() => setActive(Math.max(0, activeIndex - 1))}
                className="text-muted hover:text-foreground"
                title="Previous slide (↑)"
              >
                ←
              </button>
              <button
                onClick={() =>
                  setActive(Math.min(spec.slides.length - 1, activeIndex + 1))
                }
                className="text-muted hover:text-foreground"
                title="Next slide (↓)"
              >
                →
              </button>
            </div>
            <div className="flex items-center gap-4">
              <Switch
                label="guides"
                on={guides}
                onChange={() => setGuides((g) => !g)}
                title="Draw the slide's margin over the stage (g). A view option — it never reaches the post."
              />
              <span className="text-muted hidden lg:inline">
                drag to move the layer · scroll to scale · shift-drag to turn
              </span>
              <span className="text-muted tabular-nums">
                {Math.round((stageSize.w / w) * 100)}%
              </span>
            </div>
          </div>

          <div
            ref={stageRef}
            className="h-[46vh] md:h-auto md:flex-1 flex items-center justify-center min-h-0"
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
              <Stage
                spec={spec}
                index={activeIndex}
                fonts={fonts}
                shaderBoxRef={shaderBoxRef}
                overlayRef={overlayRef}
                solo={solo}
              />
              {guides && (
                <div
                  className="absolute pointer-events-none border border-dashed"
                  style={{
                    inset: stagePad,
                    borderColor: slideTones(slide).ink,
                    opacity: 0.35,
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right: everything about whatever is selected. */}
        <aside className="w-full md:w-[340px] shrink-0 border-t md:border-t-0 md:border-l border-line md:overflow-y-auto text-sm order-3">
          <div className="sticky top-0 z-10 bg-background border-b border-line flex divide-x divide-line">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 px-1 py-2.5 text-xs transition-colors ${
                  tab === id ? "bg-foreground text-background" : "hover:text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ------------------------------------------------------- make */}
          {tab === "make" && (
            <>
              <Panel
                title="recipes"
                hint="A whole post, ready to have its words replaced. This is the front door: choose the kind of post you're making, not a shader."
              >
                {/* items-start so a square recipe keeps its own height instead
                    of being stretched to match the portrait next to it. */}
                <div className="grid grid-cols-2 gap-2 items-start">
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => {
                        setSpec(normalizeSpec(structuredClone(p.spec)));
                        setActive(0);
                        setActiveLayer(0);
                        setTab("words");
                        say(p.name);
                      }}
                      title={p.about}
                      className="border border-line hover:border-foreground transition-colors text-left"
                    >
                      <Poster
                        spec={normalizeSpec(structuredClone(p.spec))}
                        index={0}
                        fonts={fonts}
                        width={150}
                      />
                      <span className="block px-1.5 py-1 text-[10px] truncate text-muted">
                        {p.name}
                      </span>
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel
                title="generate"
                hint="Whole graphics rolled from nothing: one to three dithered layers, every form, mix, fold, screen and colour in play. Click one to put it on this slide; the words stay where they are."
              >
                <div className="flex flex-wrap gap-2">
                  <Btn onClick={() => roll(9)} primary>
                    {sheet.length ? "Roll again" : "Generate 9"}
                  </Btn>
                  {sheet.length > 0 && <Btn onClick={() => setSheet([])}>Clear</Btn>}
                </div>
                {sheet.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {sheet.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => pickCandidate(s)}
                        title="Use this one"
                        className="block w-full border border-line hover:border-foreground transition-colors"
                      >
                        <Poster
                          spec={{
                            v: SPEC_VERSION,
                            format: spec.format,
                            duration: spec.duration,
                            slides: [
                              { ...defaultSlide(), ...s, text: false } as SlideSpec,
                            ],
                          }}
                          index={0}
                          fonts={null}
                          width={96}
                          t={spec.duration / 3}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                title="the look, copied"
                hint="A look without the words: the sheet, its ruling, the colours, the type settings and the whole layer stack. Copy it once and every slide can wear it."
              >
                <div className="flex flex-wrap gap-2">
                  <Btn onClick={copyStyle} primary>
                    Copy this look
                  </Btn>
                  <Btn onClick={() => pasteStyle(false)} disabled={!styleClip}>
                    Paste here
                  </Btn>
                  {spec.slides.length > 1 && (
                    <Btn onClick={() => pasteStyle(true)} disabled={!styleClip}>
                      Paste on all {spec.slides.length}
                    </Btn>
                  )}
                </div>
                <Dial
                  label="wiggle"
                  value={wiggle}
                  min={0.05}
                  max={0.6}
                  step={0.05}
                  onChange={setWiggle}
                />
                <div className="flex flex-wrap gap-2">
                  {[3, 5, 9].map((n) => (
                    <Btn key={n} onClick={() => makeVariations(n)}>
                      {n} variations
                    </Btn>
                  ))}
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Variations keep every decision: the forms, how they mix, what
                  inks them. Only the numbers move, by up to the wiggle. They land
                  next to this slide, so delete the ones that miss.
                </p>
              </Panel>
            </>
          )}

          {/* ------------------------------------------------------ words */}
          {tab === "words" && (
            <>
              <Panel
                title="the words"
                hint="Wrap a run in *asterisks* to flip it to the other voice — italic in a roman headline, roman in an italic one. That mixing is the club's editorial move."
              >
                <Row label="kicker">
                  <Field
                    value={slide.kicker}
                    placeholder="small label, top left"
                    onChange={(kicker) => patchSlide({ kicker })}
                  />
                </Row>
                <Row label="oval">
                  <Field
                    value={slide.tag ?? ""}
                    placeholder="08/26"
                    onChange={(tag) => patchSlide({ tag: tag || undefined })}
                  />
                </Row>
                <Field
                  value={slide.title}
                  rows={3}
                  placeholder="the headline"
                  onChange={(title) => patchSlide({ title })}
                />
                <Field
                  value={slide.body}
                  rows={2}
                  placeholder="a supporting sentence"
                  onChange={(body) => patchSlide({ body })}
                />
                <Row label="note">
                  <Field
                    value={slide.note ?? ""}
                    placeholder="top right — a handle, a credit"
                    onChange={(note) => patchSlide({ note: note || undefined })}
                  />
                </Row>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Field
                      value={slide.footer}
                      placeholder="bottom left"
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
                {slide.note && (
                  <p className="text-xs text-muted leading-relaxed">
                    The note has the top-right corner, so the circled mark stands
                    down while it&apos;s there.
                  </p>
                )}
              </Panel>

              <Panel title="setting">
                <Row label="type">
                  <Seg
                    value={slide.titleFont}
                    options={[
                      { value: "serif" as const, label: "serif" },
                      { value: "sans" as const, label: "sans" },
                      { value: "gothic" as const, label: "gothic" },
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
                      { value: "fit" as const, label: "fit" },
                    ]}
                    onChange={(titleSize) => patchSlide({ titleSize })}
                  />
                </Row>
                <Dial
                  label="weight"
                  value={slide.titleWeight ?? defaultWeight}
                  min={100}
                  max={900}
                  step={100}
                  onChange={(titleWeight) => patchSlide({ titleWeight })}
                />
                <Dial
                  label="margin"
                  value={slide.margin ?? 96}
                  min={24}
                  max={240}
                  step={4}
                  onChange={(margin) => patchSlide({ margin })}
                />
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
                <Row label="anchor">
                  <Seg
                    value={slide.anchor ?? "middle"}
                    options={[
                      { value: "top" as const, label: "top" },
                      { value: "middle" as const, label: "middle" },
                      { value: "bottom" as const, label: "bottom" },
                    ]}
                    onChange={(anchor) =>
                      patchSlide({ anchor: anchor === "middle" ? undefined : anchor })
                    }
                  />
                </Row>
                {slide.titleSize === "fit" && (
                  <p className="text-xs text-muted leading-relaxed">
                    The headline grows until it fills the frame inside the margin.
                    Short copy comes out enormous, long copy comes out smaller, and
                    neither overflows. Line breaks are still yours to place.
                  </p>
                )}
                <div className="flex gap-4 flex-wrap pt-1">
                  <Switch
                    label="italic"
                    on={slide.italic}
                    onChange={() => patchSlide({ italic: !slide.italic })}
                  />
                  <Switch
                    label="boxed"
                    on={slide.boxed}
                    onChange={() => patchSlide({ boxed: !slide.boxed })}
                  />
                  <Switch
                    label="plate"
                    on={slide.plate}
                    onChange={() => patchSlide({ plate: !slide.plate })}
                  />
                  <Switch
                    label="ring"
                    on={slide.ring}
                    onChange={() => patchSlide({ ring: !slide.ring })}
                  />
                  <Switch
                    label="all type"
                    on={slide.text}
                    onChange={() => patchSlide({ text: !slide.text })}
                    title="Off leaves the sheet and its background alone — a slide with no words at all"
                  />
                </div>
              </Panel>

              <Panel
                title="on the slide"
                hint="Switching a part off keeps its words, so switching it back on brings them with it."
              >
                <div className="flex gap-3 flex-wrap">
                  {SLIDE_PARTS.map((part) => (
                    <Switch
                      key={part}
                      label={part}
                      on={partOn(slide, part)}
                      onChange={() => togglePart(part)}
                    />
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap pt-1">
                  <Btn onClick={() => onlyParts(["title"])}>Only the words</Btn>
                  <Btn onClick={() => onlyParts(["tag", "title"])}>Oval + words</Btn>
                  <Btn onClick={() => patchSlide({ off: undefined })}>All of it</Btn>
                </div>
                <Row label="mark">
                  <Seg
                    value={slide.mark ?? "auto"}
                    options={[
                      { value: "auto" as const, label: "auto" },
                      { value: "letter" as const, label: "letter" },
                      { value: "page" as const, label: "page" },
                      { value: "none" as const, label: "none" },
                    ]}
                    onChange={(mark) => patchSlide({ mark })}
                  />
                </Row>
                <p className="text-xs text-muted leading-relaxed">
                  {(slide.mark ?? "auto") === "auto"
                    ? spec.slides.length > 1
                      ? "Auto: the top-right circle is the page you're on, because there's more than one slide. The footer drops the counter so it isn't said twice."
                      : "Auto: one slide, so the top-right circle is the letter. Add slides and it becomes the page mark."
                    : "Set by hand."}
                </p>
              </Panel>
            </>
          )}

          {/* ------------------------------------------------------- look */}
          {tab === "look" && (
            <>
              <Panel
                title="the sheet"
                hint="What the post is printed on. A ground is paper, not colour — almost nothing in this register sits on pure white."
              >
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
                <Swatches
                  palette={GROUNDS.map((g) => g.hex)}
                  labels={GROUND_NAMES}
                  value={slide.background ?? ""}
                  options={[{ value: "", label: "theme" }]}
                  onChange={(v) => patchSlide({ background: v === "" ? undefined : v })}
                />
                <div className="flex items-center gap-2">
                  <label className="border border-line px-2 py-1 text-xs cursor-pointer hover:bg-foreground hover:text-background transition-colors">
                    Pick a ground
                    <input
                      type="color"
                      value={slide.background ?? slideTones(slide).bg}
                      onChange={(e) => patchSlide({ background: e.target.value })}
                      className="sr-only"
                    />
                  </label>
                  <span className="text-xs text-muted tabular-nums">
                    {slide.background ?? "the theme's own"}
                  </span>
                </div>
                <Dial
                  label="veil"
                  value={slide.veil}
                  min={0}
                  max={0.9}
                  step={0.05}
                  onChange={(veil) => patchSlide({ veil })}
                  suffix={slide.veil === 0 ? "none" : undefined}
                />
              </Panel>

              <Panel
                title="the ruling"
                hint="The hairline grid the reference posts are drawn on: square cells, cut equally top and bottom. Put it over the type and the sheet reads as a technical drawing."
              >
                <Dial
                  label="columns"
                  value={slide.grid ?? 0}
                  min={0}
                  max={16}
                  step={1}
                  onChange={(grid) => patchSlide({ grid: grid < 2 ? undefined : grid })}
                  suffix={(slide.grid ?? 0) < 2 ? "off" : undefined}
                />
                {(slide.grid ?? 0) >= 2 && (
                  <>
                    <Dial
                      label="presence"
                      value={slide.gridAlpha ?? 0.16}
                      min={0.04}
                      max={0.6}
                      step={0.02}
                      onChange={(gridAlpha) => patchSlide({ gridAlpha })}
                    />
                    <Switch
                      label="over the type"
                      on={!!slide.gridTop}
                      onChange={() => patchSlide({ gridTop: slide.gridTop ? undefined : true })}
                    />
                  </>
                )}
              </Panel>

              <Panel title="the pixels" closed>
                <Dial
                  label="title px"
                  value={slide.titlePixel}
                  min={0}
                  max={24}
                  step={1}
                  onChange={(titlePixel) => patchSlide({ titlePixel })}
                  suffix={slide.titlePixel ? undefined : "off"}
                />
                <Dial
                  label="meta px"
                  value={slide.metaPixel}
                  min={0}
                  max={24}
                  step={1}
                  onChange={(metaPixel) => patchSlide({ metaPixel })}
                  suffix={slide.metaPixel ? undefined : "off"}
                />
                <p className="text-xs text-muted leading-relaxed">
                  The club&apos;s screen, over the type: every glyph thresholded into
                  hard ink-or-nothing blocks at this cell size.
                </p>
              </Panel>

              <Panel title="the palette" closed>
                <div className="flex items-center gap-2 flex-wrap">
                  {(slide.palette ?? PALETTE).map((hex, i) => (
                    <span key={i} className="relative shrink-0">
                      <label
                        className="block size-7 border border-line cursor-pointer"
                        style={{ background: hex }}
                        title={`${hex} — click to change`}
                      >
                        <input
                          type="color"
                          value={hex}
                          onChange={(e) => {
                            const next = [...(slide.palette ?? PALETTE)];
                            next[i] = e.target.value;
                            patchSlide({ palette: next });
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </label>
                      {(slide.palette ?? PALETTE).length > 2 && (
                        <button
                          onClick={() => {
                            const next = (slide.palette ?? [...PALETTE]).filter(
                              (_, j) => j !== i,
                            );
                            patchSlide({ palette: next });
                          }}
                          title="Remove this colour"
                          className="absolute -top-2 -right-2 size-4 leading-none text-[10px] border border-line bg-background text-muted hover:text-foreground"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                  <button
                    onClick={() => {
                      const cur = slide.palette ?? [...PALETTE];
                      patchSlide({
                        palette: [...cur, PALETTE[cur.length % PALETTE.length]],
                      });
                    }}
                    title="Add a colour"
                    className="size-7 border border-line text-muted hover:text-foreground shrink-0"
                  >
                    +
                  </button>
                  {slide.palette && (
                    <Btn onClick={() => patchSlide({ palette: undefined })}>Reset</Btn>
                  )}
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {slide.palette
                    ? `${slide.palette.length} custom colours — this post no longer follows the club palette.`
                    : "The club palette. Change it in one place and every post that hasn't been hand-coloured follows."}{" "}
                  Each layer picks its ink from here.
                </p>
              </Panel>

              <Panel title="duration" closed>
                <Dial
                  label="seconds"
                  value={spec.duration}
                  min={2}
                  max={15}
                  step={1}
                  onChange={(duration) => setSpec((s) => ({ ...s, duration }))}
                />
                <p className="text-xs text-muted leading-relaxed">
                  How long the loop is. Everything that travels divides this, which
                  is what makes the last frame run into the first.
                </p>
              </Panel>
            </>
          )}

          {/* ------------------------------------------------------ layer */}
          {tab === "layer" && (
            <>
              <Panel title={`layer ${String(layerIndex + 1).padStart(2, "0")}`}>
                <div className="flex gap-2">
                  <Btn onClick={randomizeLayer} primary>
                    Randomise this layer
                  </Btn>
                  {slide.layers.length > 1 && (
                    <Btn onClick={randomizeSlide}>All {slide.layers.length}</Btn>
                  )}
                </div>
                {/* Two families and a blank. Pixelated is the club's own screen;
                    clean draws an image and can be put through that screen with
                    the pixelate filter below. */}
                {(["plain", "pixelated", "clean"] as const).map((fam) => {
                  const list = SHADERS.filter((s) => (s.family ?? "pixelated") === fam);
                  if (!list.length) return null;
                  return (
                    <div key={fam} className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted">
                        {fam === "plain" ? "nothing" : fam}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {list.map((s) => (
                          <button
                            key={s.type}
                            onClick={() => setShaderType(s.type)}
                            className={`border border-line px-2 py-1 text-xs transition-colors ${
                              layer.type === s.type
                                ? "bg-foreground text-background"
                                : "bg-background hover:text-muted"
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
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
                <Dial
                  label="opacity"
                  value={layer.opacity}
                  min={0.05}
                  max={1}
                  step={0.05}
                  onChange={(opacity) => patchLayer({ opacity })}
                />
              </Panel>

              <Panel title="ink">
                <Swatches
                  palette={slide.palette ?? PALETTE}
                  value={typeof layer.ink === "string" ? layer.ink : ""}
                  options={[
                    { value: "", label: "theme" },
                    ...(layer.type === "forms" ? [{ value: "mix", label: "mix" }] : []),
                  ]}
                  onChange={(v) =>
                    patchLayer({ ink: v === "" ? undefined : v } as Partial<LayerSpec>)
                  }
                />
                {layer.ink === "mix" && (
                  <div className="space-y-3 border-l border-line pl-3">
                    <p className="text-xs text-muted">
                      which of them — {mixInks.length} of{" "}
                      {(slide.palette ?? PALETTE).length}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(slide.palette ?? PALETTE).map((hex) => {
                        const on = mixInks.includes(hex);
                        return (
                          <button
                            key={hex}
                            onClick={() => toggleMixInk(hex)}
                            title={`${hex} — ${on ? "click to drop" : "click to use"}`}
                            style={{ background: hex }}
                            className={`size-7 border transition-all ${
                              on
                                ? "border-foreground scale-110"
                                : "border-line opacity-25 hover:opacity-60"
                            }`}
                          />
                        );
                      })}
                      {layer.inks && (
                        <Btn
                          onClick={() => patchLayer({ inks: undefined } as Partial<LayerSpec>)}
                        >
                          All
                        </Btn>
                      )}
                    </div>
                    <Row label="spread">
                      <select
                        value={layer.mixMode ?? "blocks"}
                        onChange={(e) =>
                          patchLayer({
                            mixMode: e.target.value as LayerSpec["mixMode"],
                          } as Partial<LayerSpec>)
                        }
                        className="flex-1 border border-line bg-transparent px-2 py-1.5 text-xs focus:outline-none"
                      >
                        {MIX_MODES.map((m) => (
                          <option key={m} value={m}>
                            {MIX_MODE_HINTS[m]}
                          </option>
                        ))}
                      </select>
                    </Row>
                    <Dial
                      label="patch"
                      value={layer.mixScale ?? 3}
                      min={1}
                      max={12}
                      step={1}
                      onChange={(mixScale) =>
                        patchLayer({ mixScale } as Partial<LayerSpec>)
                      }
                    />
                    <Dial
                      label="drift"
                      value={layer.mixSpeed ?? 1}
                      min={0}
                      max={3}
                      step={0.1}
                      onChange={(mixSpeed) =>
                        patchLayer({ mixSpeed } as Partial<LayerSpec>)
                      }
                      suffix={(layer.mixSpeed ?? 1) === 0 ? "still" : undefined}
                    />
                    <div className="flex items-center gap-2">
                      <Btn
                        onClick={() =>
                          patchSlide({ colorSeed: Math.floor(Math.random() * 9999) + 1 })
                        }
                      >
                        Rearrange
                      </Btn>
                      <span className="text-xs text-muted">which colour starts where</span>
                    </div>
                  </div>
                )}
              </Panel>

              <Panel title="form">
                {(def.choices ?? [])
                  /* Only show a control that can currently do something: the
                     word picker matters only when a letter is on screen, and the
                     mix mode only once there are two forms to mix. */
                  .filter((c) => {
                    if (c.key === "word")
                      return layer.pattern === "letter" || layer.pattern2 === "letter";
                    if (c.key === "mix") return (layer.pattern2 ?? "none") !== "none";
                    return true;
                  })
                  .map((c) => (
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
                {wantsPhoto && (
                  <div className="space-y-2 border-l border-line pl-3">
                    <p className="text-xs text-muted">picture</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="border border-line px-3 py-1.5 text-xs cursor-pointer hover:bg-foreground hover:text-background transition-colors">
                        {layer.src ? "Replace" : "Choose a file"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => pickPhoto(e.target.files?.[0])}
                        />
                      </label>
                      {layer.src && (
                        <Btn
                          onClick={() => patchLayer({ src: undefined } as Partial<LayerSpec>)}
                        >
                          Remove
                        </Btn>
                      )}
                      <Seg
                        value={layer.fit === "contain" ? "contain" : "cover"}
                        options={[
                          { value: "cover" as const, label: "cover" },
                          { value: "contain" as const, label: "contain" },
                        ]}
                        onChange={(fit) =>
                          patchLayer({
                            fit: fit === "contain" ? "contain" : undefined,
                          } as Partial<LayerSpec>)
                        }
                      />
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      {!layer.src
                        ? "The photo becomes a grayscale source like any other form: sampled at the cell size, thresholded, and inked. Mix it, fold it, colour it."
                        : photoUrl(layer.src)
                          ? layer.src.startsWith("local:")
                            ? "This picture lives in this browser only, so a shared link won't carry it. Put the file in public/ and use its path to share one."
                            : "A path on this site, so this one travels in the link."
                          : "That picture isn't on this device. Choose the file again, or open the link where it was made."}
                    </p>
                  </div>
                )}
                {def.controls
                  /* Exposure is the photo's gamma and means nothing without one. */
                  .filter((c) => c.key !== "exposure" || wantsPhoto)
                  .map((c) => (
                    <ParamRow
                      key={c.key}
                      control={c}
                      value={Number(layer[c.key] ?? c.def)}
                      motion={layer.motion?.[c.key]}
                      canMove={canMove}
                      onChange={(v) => patchLayer({ [c.key]: v })}
                      onMotion={(m) => setMotion(c.key, m)}
                    />
                  ))}
                {def.controls.length === 0 && (
                  <p className="text-xs text-muted leading-relaxed">
                    Nothing to set: this layer draws nothing at all, which is what a
                    sheet wants behind its words.
                  </p>
                )}
              </Panel>

              <Panel
                title="filters"
                hint="What happens to this layer after it's drawn, in order. `pixelate` is the club's screen — put it on a clean shader and the image comes out in the club's pixels."
                closed
              >
                {(layer.filters ?? []).map((f, i) => {
                  const fd = filterDef(String(f.type));
                  if (!fd) return null;
                  return (
                    <div key={i} className="border-l border-line pl-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span>{fd.label}</span>
                        <span className="flex gap-2">
                          <button
                            onClick={() => moveFilter(i, -1)}
                            title="Earlier in the chain"
                            className="text-muted hover:text-foreground"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => removeFilter(i)}
                            title="Remove"
                            className="text-muted hover:text-foreground"
                          >
                            ×
                          </button>
                        </span>
                      </div>
                      {(fd.choices ?? []).map((c) => (
                        <Row key={c.key} label={c.label}>
                          <select
                            value={String(f[c.key] ?? c.def)}
                            onChange={(e) => patchFilter(i, { [c.key]: e.target.value })}
                            className="flex-1 border border-line bg-transparent px-2 py-1 text-xs focus:outline-none"
                          >
                            {c.values.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </Row>
                      ))}
                      {fd.controls.map((c) => (
                        <Dial
                          key={c.key}
                          label={c.label}
                          value={Number(f[c.key] ?? c.def)}
                          min={c.min}
                          max={c.max}
                          step={c.step}
                          onChange={(v) => patchFilter(i, { [c.key]: v })}
                        />
                      ))}
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-1">
                  {FILTERS.filter(
                    (f) => !(layer.filters ?? []).some((x) => x.type === f.type),
                  ).map((f) => (
                    <button
                      key={f.type}
                      onClick={() => addFilter(f.type)}
                      title={f.hint}
                      className="border border-line px-2 py-1 text-xs text-muted hover:text-foreground transition-colors"
                    >
                      + {f.label}
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel title="transform">
                {animatable(layer.type)
                  .filter((c) => !def.controls.some((d) => d.key === c.key))
                  .map((c) => (
                    <ParamRow
                      key={c.key}
                      control={c}
                      value={Number(layer[c.key] ?? c.def)}
                      motion={layer.motion?.[c.key]}
                      canMove={canMove}
                      onChange={(v) => patchLayer({ [c.key]: v })}
                      onMotion={(m) => setMotion(c.key, m)}
                    />
                  ))}
                <div className="flex items-center justify-between">
                  <Btn
                    onClick={() =>
                      patchLayer({ offsetX: 0, offsetY: 0, rotation: 0, scale: 1 })
                    }
                  >
                    Reset transform
                  </Btn>
                </div>
                {canMove ? (
                  <p className="text-xs text-muted leading-relaxed">
                    The ○ next to a number makes it travel over the loop instead of
                    holding still — it appears as a wave in the timeline below.
                    Trips are whole numbers, so a travelling parameter always lands
                    back where it started.
                  </p>
                ) : (
                  <p className="text-xs text-muted leading-relaxed">
                    Travelling parameters are a dithered-forms thing: the WebGL
                    shader takes its numbers once, not every frame.
                  </p>
                )}
              </Panel>
            </>
          )}

          {/* -------------------------------------------------------- out */}
          {tab === "out" && (
            <>
              <Panel title="export">
                <Seg
                  value={quality}
                  options={[
                    { value: "mid", label: "mid" },
                    { value: "high", label: "high" },
                    { value: "max", label: "4K" },
                  ]}
                  onChange={setQuality}
                />
                <p className="text-xs text-muted">
                  {outW}×{outH}
                  {quality === "max" &&
                    " — GIF caps at 2×; video this size is slow and some browsers refuse it"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Btn onClick={savePng} primary disabled={!!job}>
                    PNG — this slide
                  </Btn>
                  {spec.slides.length > 1 && (
                    <Btn onClick={saveAllPngs} disabled={!!job}>
                      PNG × {spec.slides.length}
                    </Btn>
                  )}
                  <Btn onClick={saveVideo} disabled={!!job}>
                    Video — {spec.duration}s
                  </Btn>
                  {spec.slides.length > 1 && (
                    <Btn onClick={saveAllVideos} disabled={!!job}>
                      Video × {spec.slides.length}
                    </Btn>
                  )}
                  <Btn onClick={saveGif} disabled={!!job}>
                    GIF — {spec.duration}s
                  </Btn>
                  {spec.slides.length > 1 && (
                    <Btn onClick={saveAllGifs} disabled={!!job}>
                      GIF × {spec.slides.length}
                    </Btn>
                  )}
                </div>
                {job && (
                  <p className="text-xs">
                    {job.label} — {Math.round(job.frac * 100)}%
                  </p>
                )}
                <div className="border-t border-line pt-3 space-y-1.5">
                  <p className="text-xs">
                    {loop.loops ? "◉ This slide loops." : "○ This slide won't loop."}
                  </p>
                  {loop.loops ? (
                    <p className="text-xs text-muted leading-relaxed">
                      {direct
                        ? `Every frame is drawn at ${outW}×${outH} at its exact moment, from the top of the loop to just before it comes round again. The last frame runs into the first with no seam.`
                        : "The forms come back to where they started, but the WebGL layer is recorded as it plays, so the clip can drift by a frame."}
                    </p>
                  ) : (
                    loop.why.map((line) => (
                      <p key={line} className="text-xs text-muted leading-relaxed">
                        {line}
                      </p>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted">
                  Stills export at {w}×{h} times the quality above. Video records the
                  animated slide (MP4 where the browser supports it, WebM otherwise);
                  GIFs record at half size and loop forever.
                </p>
              </Panel>

              <Panel
                title="claude"
                hint="A post is a spec, and a spec is text: anything that can write JSON can hand you a finished post."
              >
                <div className="flex flex-wrap gap-2">
                  <Btn onClick={copyLink}>Copy link</Btn>
                  <Btn onClick={copyJson}>Copy spec JSON</Btn>
                </div>
                <Field
                  value={importText}
                  rows={3}
                  mono
                  placeholder="paste a spec, or a /postlab link"
                  onChange={setImportText}
                />
                <div className="flex items-center justify-between">
                  <Btn onClick={importSpec}>Load spec</Btn>
                  <a
                    href="/api/postlab/schema"
                    target="_blank"
                    className="text-xs underline underline-offset-4"
                  >
                    spec schema →
                  </a>
                </div>
              </Panel>
            </>
          )}
        </aside>
      </div>

      {/* The loop, along the bottom, under everything it applies to. */}
      <Tracks
        slide={slide}
        duration={spec.duration}
        layerIndex={layerIndex}
        playing={playing}
        onPlay={setPlaying}
        onSelectLayer={(i) => {
          setActiveLayer(i);
          setTab("layer");
        }}
      />
    </div>
  );
}
