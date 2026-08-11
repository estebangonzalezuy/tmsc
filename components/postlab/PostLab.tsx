"use client";

// the Posts Studio — one application, in Toolcraft chrome.
//
// The layout is the one every editor of a moving image settles on, and for the
// reason they all do: a menu bar across the top, the structure on the left, the
// post in the middle with its own view chrome, everything about the selection on
// the right, and the loop along the bottom. Choosing happens on the left,
// changing happens on the right, and the right follows the selection.
//
// What changed when it stopped being five tabs: the things you do all day moved
// into the menus (make a slide, add a layer, export, paste a look), the things
// you set once stayed in the inspector as folded groups, and the two big grids
// of pictures — the recipes and the rolled looks — became a panel over the
// canvas, because a wall of thumbnails never belonged in a 320px column.
//
// The studio makes two kinds of post and they share every control: sheets —
// ruled paper, an oval label, a headline that mixes roman and italic — and the
// club's dithered graphics. A recipe is how you start; nothing else is a mode.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BLENDS,
  FORMATS,
  GROUNDS,
  LOOPS,
  MAX_LAYERS,
  MAX_SHAPES,
  MIX_MODES,
  PALETTE,
  PRESETS,
  FILTERS,
  SHADERS,
  SHAPE_CONTROLS,
  SHAPE_DEFORMERS,
  SHAPE_KINDS,
  SLIDE_PARTS,
  SPEC_VERSION,
  WAVES,
  animatable,
  applyLoop,
  applyStyle,
  defaultShape,
  loopOf,
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
  type ShapeKind,
  type ShapeSpec,
  type SlideSpec,
  type SlideStyle,
  type Wave,
} from "@/lib/postlab";
import { loadFonts, type Fonts } from "./overlay";
import { canRenderDirectly } from "./exporter";
import { photoUrl, readFile, savePhoto } from "./photos";
import Stage, { useClockRunning, useStageFit } from "./Stage";
import { useExports } from "./useExports";
import { clock } from "./clock";
import Poster from "./Poster";
import Tracks from "./Tracks";
import {
  Block,
  Btn,
  Dial,
  Drawer,
  Group,
  HAIR,
  IconBtn,
  Label,
  Menu,
  MenuBar,
  MenuItem,
  MenuRow,
  MenuSep,
  Num,
  Row,
  Segmented,
  Select,
  Sep,
  Swatches,
  Switch,
  Text,
  Toolbar,
} from "./toolcraft";

/* ------------------------------------------------------------- small parts */

const WAVE_HINTS: Record<Wave, string> = {
  sin: "sin — eases both ways",
  tri: "tri — straight there and back",
  saw: "saw — ramps, then snaps",
  square: "square — switches hard",
};

/* The dropdown has to say what each one looks like, not what it is called in
   the renderer. */
const MIX_MODE_HINTS: Record<string, string> = {
  blocks: "blocks — a mosaic of patches",
  bands: "bands — stripes sweeping down",
  radial: "radial — rings out of the centre",
  source: "source — colour follows the shape",
  noise: "noise — pixel by pixel, no grid",
};

const GROUND_NAMES = Object.fromEntries(GROUNDS.map((g) => [g.hex, g.label]));

const FAMILY_NAMES: Record<string, string> = {
  plain: "nothing",
  pixelated: "the club's pixels",
  clean: "clean shaders",
};

const layerName = (l: LayerSpec) =>
  l.type === "forms" ? String(l.pattern ?? "rings") : shaderDef(l.type).label;

/* One parameter: the number, and — on a layer the club renders itself — the
   option of making that number travel over the loop instead of holding still.
   The travelling is the whole reason a background stops looking like a pattern
   and starts looking like a piece of motion. */
function ParamRow({
  control: c,
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
  return (
    <>
      <Dial
        label={c.label}
        value={value}
        min={c.min}
        max={c.max}
        step={c.step}
        onChange={onChange}
      >
        {canMove && (
          <button
            onClick={() => onMotion(motion ? null : applyLoop("drift", c, value))}
            title={motion ? "Hold this one still" : "Plug a loop into this number"}
            className={`w-3 shrink-0 text-[9px] ${
              motion ? "text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {motion ? "◉" : "○"}
          </button>
        )}
      </Dial>
      {motion && (
        <div className={`border-l ${HAIR} pl-2 ml-1 space-y-1`}>
          {/* The loop, by name. Everything under it is the fine print: the loop
              sets the wave and the number of trips, and `to` is how far. */}
          <Row label="loop">
            <Select
              value={loopOf(motion)}
              options={[
                ...LOOPS.map((l) => ({ value: l.id, label: `${l.name} — ${l.about}` })),
                ...(loopOf(motion) === "custom"
                  ? [{ value: "custom", label: "custom" }]
                  : []),
              ]}
              onChange={(id) => {
                const next = applyLoop(id, c, value);
                /* Keep how far it travels; the loop only decides the shape and
                   the number of trips. */
                if (next) onMotion({ ...next, to: motion.to });
              }}
            />
          </Row>
          <Dial
            label="to"
            value={motion.to}
            min={c.min}
            max={c.max}
            step={c.step}
            onChange={(to) => onMotion({ ...motion, to })}
          />
          {loopOf(motion) === "custom" && (
            <Row label="wave">
              <Select
                value={motion.wave ?? "sin"}
                options={WAVES.map((w) => ({ value: w, label: WAVE_HINTS[w] }))}
                onChange={(w) => onMotion({ ...motion, wave: w as Wave })}
              />
              <Select
                flex={false}
                value={String(motion.cycles ?? 1)}
                title="Trips per loop — whole numbers only, which is what keeps the post seamless"
                options={[1, 2, 3, 4, 6, 8].map((n) => ({ value: String(n), label: `×${n}` }))}
                onChange={(n) => onMotion({ ...motion, cycles: Number(n) })}
              />
            </Row>
          )}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ studio */

export default function PostLab() {
  const router = useRouter();
  const [spec, setSpec] = useState<PostSpec>(openingSpec);
  const [active, setActive] = useState(0);
  const [activeLayer, setActiveLayer] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fonts, setFonts] = useState<Fonts | null>(null);
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
  /* View options. None of them reach the post: this is how the studio is
     arranged, not what it makes. */
  const [guides, setGuides] = useState(false);
  const [rail, setRail] = useState(true);
  const [timeline, setTimeline] = useState(true);
  /* What's over the canvas, if anything: the recipes, a sheet of rolled looks,
     or the paste-a-spec box. Panels, not tabs — they're moments, not places. */
  const [drawer, setDrawer] = useState<"recipes" | "generate" | "spec" | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const shaderBoxRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  /* The last hash this component wrote, so its own serialisation is never
     mistaken for someone opening a link. */
  const ownHashRef = useRef<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const stageSize = useStageFit(stageRef, spec.format);

  const { w, h } = FORMATS[spec.format];
  const activeIndex = Math.min(active, spec.slides.length - 1);
  const slide = spec.slides[activeIndex];
  const layerIndex = Math.min(activeLayer, slide.layers.length - 1);
  const layer = slide.layers[layerIndex];
  const def = shaderDef(layer.type);

  /* Load fonts, then any spec passed in the URL: #spec= / ?spec= (encoded), or
     plain ?title=...&body=... params — the instant, zero-AI path that a Notion
     formula can assemble. */
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
      const encoded = encodeSpec(spec);
      ownHashRef.current = encoded;
      window.history.replaceState(null, "", `#spec=${encoded}`);
    }, 400);
    return () => clearTimeout(id);
  }, [spec]);

  /* Following a #spec= link while the tool is already open changes the hash
     without remounting, so the mount-time read above never fires and the writer
     above would then overwrite the incoming link with whatever was already
     loaded. Listen for the navigation instead: opening a post from Notion has
     to work in a reused tab, which is what a phone always does. */
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

  /* The loop runs here; every canvas is a function of it. */
  useClockRunning(playing, spec.duration);

  /* The shortcuts a motion tool is expected to have. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      const D = Math.max(2, spec.duration);
      const step = (by: number) => {
        setPlaying(false);
        clock.set((((clock.get() + by) % D) + D) % D);
      };
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowRight") step(e.shiftKey ? 1 : 1 / 30);
      else if (e.key === "ArrowLeft") step(e.shiftKey ? -1 : -1 / 30);
      else if (e.key === "Home") {
        setPlaying(false);
        clock.set(0);
      } else if (e.key === "ArrowDown")
        setActive((i) => Math.min(spec.slides.length - 1, i + 1));
      else if (e.key === "ArrowUp") setActive((i) => Math.max(0, i - 1));
      else if (e.key.toLowerCase() === "g") setGuides((g) => !g);
      else if (e.key.toLowerCase() === "r") setDrawer("recipes");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spec.duration, spec.slides.length]);

  /* ------------------------------------------------------------- editing */

  const patchSlide = useCallback(
    (patch: Partial<SlideSpec>) => {
      setSpec((s) => ({
        ...s,
        slides: s.slides.map((sl, i) => (i === activeIndex ? { ...sl, ...patch } : sl)),
      }));
    },
    [activeIndex],
  );

  const patchLayerAt = (
    index: number,
    patch: Partial<LayerSpec> | Record<string, number | string>,
  ) =>
    patchSlide({
      layers: slide.layers.map((l, i) => (i === index ? ({ ...l, ...patch } as LayerSpec) : l)),
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

  /* The file never leaves the browser: the layer keeps a `local:` handle and the
     picture sits in this device's storage, like the Studio's token. */
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

  /* The filter chain on the selected layer. Dropped entirely when it empties so
     a link never carries an empty list. */
  const setFilters = (list: FilterSpec[]) =>
    patchLayer({ filters: list.length ? list : undefined } as Partial<LayerSpec>);

  const addFilter = (type: string) =>
    setFilters([...(layer.filters ?? []), defaultFilter(type)]);

  const removeFilter = (i: number) =>
    setFilters((layer.filters ?? []).filter((_, j) => j !== i));

  const patchFilter = (
    i: number,
    patch: Record<string, number | string | boolean | undefined>,
  ) => setFilters((layer.filters ?? []).map((f, j) => (j === i ? { ...f, ...patch } : f)));

  /* Order matters: pixelate before grain is a screened image with grain over it,
     grain before pixelate is grain that got screened. */
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

  /* ------------------------------------------------------------- marks */

  /* Shapes are a list on the slide, edited the way the filter chain is: add,
     reorder, remove, and set the numbers of the one you're looking at. Dropped
     entirely when the last one goes, so a link never carries an empty list. */
  const setShapes = (list: ShapeSpec[]) =>
    patchSlide({ shapes: list.length ? list : undefined });

  const addShape = (kind: ShapeKind) => {
    if ((slide.shapes ?? []).length >= MAX_SHAPES) return;
    setShapes([
      ...(slide.shapes ?? []),
      { ...defaultShape(kind), seed: Math.floor(Math.random() * 9999) + 1 },
    ]);
  };

  const patchShape = (i: number, patch: Partial<ShapeSpec>) =>
    setShapes((slide.shapes ?? []).map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const removeShape = (i: number) =>
    setShapes((slide.shapes ?? []).filter((_, j) => j !== i));

  const moveShape = (i: number, dir: -1 | 1) => {
    const list = [...(slide.shapes ?? [])];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setShapes(list);
  };

  const setShapeMotion = (i: number, key: string, m: Motion | null) => {
    const shape = (slide.shapes ?? [])[i];
    if (!shape) return;
    const motion = { ...(shape.motion ?? {}) };
    if (m) motion[key] = m;
    else delete motion[key];
    patchShape(i, { motion: Object.keys(motion).length ? motion : undefined });
  };

  /* Switching a part off keeps its words; `off` is dropped entirely when nothing
     is hidden, so a link never carries an empty list. */
  const togglePart = (part: string) => {
    const off = new Set(slide.off ?? []);
    if (off.has(part)) off.delete(part);
    else off.add(part);
    patchSlide({ off: off.size ? [...off] : undefined });
  };

  const onlyParts = (keep: string[]) =>
    patchSlide({ off: SLIDE_PARTS.filter((p) => !keep.includes(p)) });

  /* The colours a mix layer is currently allowed to use. No `inks` on the layer
     means all of them, which is the normal case. */
  const mixInks = layer.inks?.length ? layer.inks : [...(slide.palette ?? PALETTE)];

  /* Dropping the last one would leave the layer with nothing to draw with, so
     the last colour standing can't be turned off. Turning them all back on
     clears the field instead of storing a copy of the palette, so the layer goes
     back to following it. */
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
     randomised layer drops into a composition you've already built. Colour is a
     decision, not a roll — the dice never touch it. */
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
      layers: [...slide.layers, { ...defaultLayer("forms"), blend: "multiply", opacity: 0.8 }],
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

  /* A sheet of looks rolled from nothing. Picking one puts it on this slide and
     leaves the words where they are — the whole point is to choose a graphic
     rather than to build one, so nothing is committed until a thumbnail is
     clicked. */
  const roll = (n = 9) => {
    setSheet(Array.from({ length: n }, () => randomSlide()));
    setDrawer("generate");
  };

  const pickCandidate = (style: SlideStyle) => {
    patchSlide(structuredClone(style));
    setActiveLayer(0);
    say("Applied");
  };

  /* New slides carrying this slide's words and a jittered version of its look,
     dropped in right after it so you can flip between them in the strip and keep
     the one that works. */
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
    setSpec((s) => ({ ...s, slides: [...s.slides, { ...s.slides[activeIndex] }] }));
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

  /* Whether the exported clip comes back to its first frame, and whether we get
     to draw it ourselves rather than film it going past. */
  const loop = loopReport(slide);
  const direct = canRenderDirectly(spec, activeIndex);

  const {
    job,
    quality,
    setQuality,
    outW,
    outH,
    savePng,
    saveAllPngs,
    saveVideo,
    saveAllVideos,
    saveGif,
    saveAllGifs,
  } = useExports({
    spec,
    index: activeIndex,
    fonts,
    shaderBoxRef,
    overlayRef,
    setIndex: setActive,
    say: (msg) => say(msg),
  });

  /* ------------------------------------------------------- spec sharing */

  const copyLink = async () => {
    await navigator.clipboard.writeText(
      `${window.location.origin}/postlab#spec=${encodeSpec(spec)}`,
    );
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
      setDrawer(null);
      say("Spec loaded");
    } else {
      say("Couldn't read that spec");
    }
  };

  const loadPreset = (i: number) => {
    setSpec(normalizeSpec(structuredClone(PRESETS[i].spec)));
    setActive(0);
    setActiveLayer(0);
    setDrawer(null);
    say(PRESETS[i].name);
  };

  /* -------------------------------------------------------------- render */

  const stagePad = (slide.margin ?? 96) * (stageSize.w / 1080);
  const parts = SLIDE_PARTS.filter((p) => partOn(slide, p));

  return (
    <div className="min-h-dvh md:h-dvh flex flex-col">
      <MenuBar
        left={
          <>
            <span
              className={`inline-flex items-center justify-center rounded-full border ${HAIR} size-7 text-[10px] shrink-0`}
            >
              P
            </span>
            <span className="font-serif italic text-base pr-2 hidden sm:inline">
              the Posts Studio
            </span>

            <Menu label="Post">
              <MenuItem onClick={() => setDrawer("recipes")} hint="r">
                Recipes…
              </MenuItem>
              <MenuItem onClick={() => roll(9)}>Generate a look…</MenuItem>
              <MenuSep />
              <MenuRow label="format">
                <Segmented
                  value={spec.format}
                  options={(Object.keys(FORMATS) as (keyof typeof FORMATS)[]).map((f) => ({
                    value: f,
                    label: FORMATS[f].label,
                    title: FORMATS[f].hint,
                  }))}
                  onChange={(format) => setSpec((s) => ({ ...s, format }))}
                />
              </MenuRow>
              <MenuRow label="loop, in seconds">
                <input
                  type="range"
                  min={2}
                  max={15}
                  step={1}
                  value={spec.duration}
                  aria-label="duration"
                  onChange={(e) =>
                    setSpec((s) => ({ ...s, duration: Number(e.target.value) }))
                  }
                  className="flex-1 accent-foreground"
                />
                <Num
                  value={spec.duration}
                  min={2}
                  max={15}
                  step={1}
                  onChange={(duration) => setSpec((s) => ({ ...s, duration }))}
                />
              </MenuRow>
              <MenuSep />
              <MenuItem onClick={copyLink}>Copy link to this post</MenuItem>
              <MenuItem onClick={copyJson}>Copy spec JSON</MenuItem>
              <MenuItem onClick={() => setDrawer("spec")}>Paste a spec…</MenuItem>
            </Menu>

            <Menu label="Slide">
              <MenuItem onClick={addSlide} hint={`${spec.slides.length} / 20`}>
                Duplicate this slide
              </MenuItem>
              <MenuItem onClick={removeSlide} disabled={spec.slides.length <= 1}>
                Delete it
              </MenuItem>
              <MenuItem onClick={() => moveSlide(-1)} disabled={activeIndex === 0}>
                Move earlier
              </MenuItem>
              <MenuItem
                onClick={() => moveSlide(1)}
                disabled={activeIndex >= spec.slides.length - 1}
              >
                Move later
              </MenuItem>
              <MenuSep />
              <MenuItem onClick={() => onlyParts(["title"])}>Only the words</MenuItem>
              <MenuItem onClick={() => onlyParts(["tag", "title"])}>Oval + words</MenuItem>
              <MenuItem onClick={() => patchSlide({ off: undefined })}>
                Everything on
              </MenuItem>
              <MenuSep />
              <MenuItem onClick={copyStyle}>Copy this look</MenuItem>
              <MenuItem onClick={() => pasteStyle(false)} disabled={!styleClip}>
                Paste the look here
              </MenuItem>
              <MenuItem
                onClick={() => pasteStyle(true)}
                disabled={!styleClip || spec.slides.length < 2}
              >
                Paste it on all {spec.slides.length}
              </MenuItem>
              <MenuRow label="variations of this slide">
                {[3, 5, 9].map((n) => (
                  <Btn key={n} onClick={() => makeVariations(n)} wide>
                    {n}
                  </Btn>
                ))}
              </MenuRow>
              <MenuRow label="how far they wander">
                <input
                  type="range"
                  min={0.05}
                  max={0.6}
                  step={0.05}
                  value={wiggle}
                  aria-label="wiggle"
                  onChange={(e) => setWiggle(Number(e.target.value))}
                  className="flex-1 accent-foreground"
                />
                <Num value={wiggle} min={0.05} max={0.6} step={0.05} onChange={setWiggle} />
              </MenuRow>
            </Menu>

            <Menu label="Layer">
              <MenuItem onClick={addLayer} disabled={slide.layers.length >= MAX_LAYERS}>
                Add a layer
              </MenuItem>
              <MenuItem onClick={removeLayer} disabled={slide.layers.length <= 1}>
                Delete this one
              </MenuItem>
              <MenuItem onClick={() => moveLayer(1)}>Bring forward</MenuItem>
              <MenuItem onClick={() => moveLayer(-1)}>Send back</MenuItem>
              <MenuSep />
              <MenuItem
                on={!layer.mute}
                onClick={() => patchLayer({ mute: layer.mute ? undefined : true })}
              >
                Visible
              </MenuItem>
              <MenuItem
                on={solo === layerIndex}
                onClick={() => setSolo(solo === layerIndex ? null : layerIndex)}
              >
                On its own
              </MenuItem>
              <MenuSep />
              <MenuItem onClick={randomizeLayer}>Randomise this layer</MenuItem>
              <MenuItem onClick={randomizeSlide} disabled={slide.layers.length < 2}>
                Randomise all {slide.layers.length}
              </MenuItem>
              <MenuSep />
              {FILTERS.filter((f) => !(layer.filters ?? []).some((x) => x.type === f.type)).map(
                (f) => (
                  <MenuItem key={f.type} onClick={() => addFilter(f.type)}>
                    Add filter · {f.label}
                  </MenuItem>
                ),
              )}
            </Menu>

            <Menu label="View">
              <MenuItem on={rail} onClick={() => setRail((v) => !v)}>
                Slides & layers
              </MenuItem>
              <MenuItem on={timeline} onClick={() => setTimeline((v) => !v)}>
                The loop
              </MenuItem>
              <MenuItem on={guides} onClick={() => setGuides((v) => !v)} hint="g">
                Margin guides
              </MenuItem>
              <MenuSep />
              <MenuItem on={solo !== null} onClick={() => setSolo(null)} disabled={solo === null}>
                Stop looking at one layer
              </MenuItem>
            </Menu>

            <Menu label="Export" width={264}>
              <MenuRow label="size">
                <Segmented
                  value={quality}
                  options={[
                    { value: "mid" as const, label: "1080" },
                    { value: "high" as const, label: "2×" },
                    { value: "max" as const, label: "4K" },
                  ]}
                  onChange={setQuality}
                />
              </MenuRow>
              <MenuItem onClick={savePng} hint={`${outW}×${outH}`} disabled={!!job}>
                PNG — this slide
              </MenuItem>
              <MenuItem onClick={saveAllPngs} disabled={!!job || spec.slides.length < 2}>
                PNG — all {spec.slides.length}
              </MenuItem>
              <MenuItem onClick={saveVideo} hint={`${spec.duration}s`} disabled={!!job}>
                Video — this slide
              </MenuItem>
              <MenuItem onClick={saveAllVideos} disabled={!!job || spec.slides.length < 2}>
                Video — all {spec.slides.length}
              </MenuItem>
              <MenuItem onClick={saveGif} hint={`${spec.duration}s`} disabled={!!job}>
                GIF — this slide
              </MenuItem>
              <MenuItem onClick={saveAllGifs} disabled={!!job || spec.slides.length < 2}>
                GIF — all {spec.slides.length}
              </MenuItem>
              <MenuSep />
              <div className="px-2.5 py-2 space-y-1">
                <p className="text-[11px]">
                  {loop.loops ? "◉ This slide loops." : "○ This slide won't loop."}
                </p>
                <p className="text-[10px] text-muted leading-relaxed">
                  {loop.loops
                    ? direct
                      ? "Every frame is drawn at its exact moment, at export size. The last runs into the first with no seam."
                      : "The forms return to where they started, but the WebGL layer is filmed as it plays, so the clip can drift by a frame."
                    : loop.why.join(" ")}
                </p>
              </div>
            </Menu>
          </>
        }
        right={
          <>
            {job ? (
              <span className="text-[11px] tabular-nums">
                {job.label} — {Math.round(job.frac * 100)}%
              </span>
            ) : (
              flash && <span className="text-[11px] text-muted hidden sm:inline">{flash}</span>
            )}
            <span className="text-[11px] text-muted tabular-nums hidden lg:inline">
              {w}×{h}
            </span>
            <Btn onClick={savePng} on disabled={!!job}>
              Export PNG
            </Btn>
            <Menu label="Go" align="right" width={180}>
              <MenuItem onClick={() => setDrawer("recipes")}>Recipes…</MenuItem>
              <MenuSep />
              <MenuItem onClick={() => router.push("/tools")}>the Tools</MenuItem>
              <MenuItem onClick={() => router.push("/desk")}>the Desk</MenuItem>
              <MenuItem onClick={() => router.push("/studio")}>
                the Studio
              </MenuItem>
              <MenuItem onClick={() => router.push("/hub")}>the Hub</MenuItem>
            </Menu>
          </>
        }
      />

      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Left: what the post is made of, as pictures. A filmstrip is the only
            honest list of slides — a row of titles tells you what a slide says,
            not what it looks like. */}
        {rail && (
          <aside
            className={`w-full md:w-[172px] shrink-0 border-b md:border-b-0 md:border-r ${HAIR} md:overflow-y-auto order-2 md:order-1`}
          >
            <div className={`h-9 px-3 flex items-center border-b ${HAIR} sticky top-0 bg-background z-10`}>
              <Label>slides</Label>
              <span className="ml-auto text-[10px] text-muted tabular-nums">
                {activeIndex + 1}/{spec.slides.length}
              </span>
            </div>
            <div className="p-2 flex md:block gap-2 overflow-x-auto md:overflow-visible">
              {spec.slides.map((sl, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  title={plainTitle(sl.title) || sl.kicker || "—"}
                  className={`w-[92px] md:w-full shrink-0 md:mb-2 border transition-colors ${
                    i === activeIndex ? "border-foreground" : `${HAIR} hover:border-foreground/50`
                  }`}
                >
                  <Poster spec={spec} index={i} fonts={fonts} width={150} />
                  <span
                    className={`block px-1.5 py-1 text-[10px] tabular-nums text-left truncate ${
                      i === activeIndex ? "bg-foreground text-background" : "text-muted"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}{" "}
                    {plainTitle(sl.title).slice(0, 18) || sl.kicker || "—"}
                  </span>
                </button>
              ))}
            </div>

            <div className={`h-9 px-3 flex items-center border-y ${HAIR}`}>
              <Label>layers</Label>
              <span className="ml-auto flex items-center gap-1">
                <IconBtn
                  onClick={addLayer}
                  title="Add a layer"
                  disabled={slide.layers.length >= MAX_LAYERS}
                >
                  +
                </IconBtn>
                <IconBtn
                  onClick={removeLayer}
                  title="Delete this layer"
                  disabled={slide.layers.length <= 1}
                >
                  ×
                </IconBtn>
              </span>
            </div>
            <div className="p-2 space-y-px">
              {[...slide.layers].reverse().map((l, ri) => {
                const i = slide.layers.length - 1 - ri; // top layer listed first
                const on = !l.mute && (solo === null || solo === i);
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-1 px-1 h-7 text-[11px] ${
                      i === layerIndex ? "bg-foreground text-background" : ""
                    }`}
                  >
                    <button
                      onClick={() => patchLayerAt(i, { mute: l.mute ? undefined : true })}
                      title={l.mute ? "Switch this layer on" : "Switch this layer off"}
                      className={`w-3 shrink-0 text-[9px] ${on ? "" : "opacity-40"}`}
                    >
                      {l.mute ? "○" : "◉"}
                    </button>
                    <button
                      onClick={() => setSolo(solo === i ? null : i)}
                      title="Show this layer on its own"
                      className={`w-3 shrink-0 text-[9px] ${
                        solo === i ? "" : "opacity-40 hover:opacity-100"
                      }`}
                    >
                      {solo === i ? "◆" : "◇"}
                    </button>
                    <button
                      onClick={() => setActiveLayer(i)}
                      className={`flex-1 text-left truncate ${on ? "" : "line-through opacity-50"}`}
                    >
                      {String(i + 1).padStart(2, "0")} {layerName(l)}
                    </button>
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {/* Middle: the post, and the things that are about looking at it rather
            than about changing it. */}
        <div className="relative md:flex-1 flex flex-col min-w-0 order-1 md:order-2">
          <Toolbar className={`border-b ${HAIR} justify-between`}>
            <span className="flex items-center gap-1.5">
              <IconBtn
                onClick={() => setActive(Math.max(0, activeIndex - 1))}
                title="Previous slide (↑)"
                disabled={activeIndex === 0}
              >
                ←
              </IconBtn>
              <IconBtn
                onClick={() => setActive(Math.min(spec.slides.length - 1, activeIndex + 1))}
                title="Next slide (↓)"
                disabled={activeIndex >= spec.slides.length - 1}
              >
                →
              </IconBtn>
              <span className="tabular-nums text-muted px-1">
                {String(activeIndex + 1).padStart(2, "0")} /{" "}
                {String(spec.slides.length).padStart(2, "0")}
              </span>
              <Sep />
              <Switch label="guides" on={guides} onChange={() => setGuides((g) => !g)} />
              {solo !== null && (
                <>
                  <Sep />
                  <button
                    onClick={() => setSolo(null)}
                    title="Solo is a way of looking, not a setting — it never reaches the export"
                    className="h-7 px-2 border border-foreground bg-foreground text-background text-[10px]"
                  >
                    layer {String(solo + 1).padStart(2, "0")} on its own ×
                  </button>
                </>
              )}
            </span>
            <span className="flex items-center gap-2 text-muted">
              <span className="hidden xl:inline">
                drag to move the layer · scroll to scale · shift-drag to turn
              </span>
              <span className="tabular-nums">{Math.round((stageSize.w / w) * 100)}%</span>
            </span>
          </Toolbar>

          <div
            ref={stageRef}
            className="h-[44vh] md:h-auto md:flex-1 flex items-center justify-center min-h-0"
          >
            <div
              ref={frameRef}
              className={`relative border ${HAIR} overflow-hidden cursor-move touch-none`}
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

          {/* Over the canvas, when something needs the room: the recipes, a
              sheet of rolled looks, a spec to paste. */}
          {drawer === "recipes" && (
            <Drawer
              title="recipes — a whole post, ready to have its words replaced"
              onClose={() => setDrawer(null)}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-start">
                {PRESETS.map((p, i) => (
                  <button
                    key={p.name}
                    onClick={() => loadPreset(i)}
                    title={p.about}
                    className={`border ${HAIR} hover:border-foreground transition-colors text-left`}
                  >
                    <Poster
                      spec={normalizeSpec(structuredClone(p.spec))}
                      index={0}
                      fonts={fonts}
                      width={220}
                    />
                    <span className="block px-2 py-1.5 space-y-0.5">
                      <span className="block text-[11px]">{p.name}</span>
                      <span className="block text-[10px] text-muted leading-snug">
                        {p.about}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </Drawer>
          )}

          {drawer === "generate" && (
            <Drawer
              title="rolled from nothing — click one to put it on this slide"
              onClose={() => setDrawer(null)}
              right={<Btn onClick={() => roll(9)}>Roll again</Btn>}
            >
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {sheet.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      pickCandidate(s);
                      setDrawer(null);
                    }}
                    title="Use this one"
                    className={`block border ${HAIR} hover:border-foreground transition-colors`}
                  >
                    <Poster
                      spec={{
                        v: SPEC_VERSION,
                        format: spec.format,
                        duration: spec.duration,
                        slides: [{ ...defaultSlide(), ...s, text: false } as SlideSpec],
                      }}
                      index={0}
                      fonts={null}
                      width={180}
                      t={spec.duration / 3}
                    />
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted leading-relaxed pt-3 max-w-xl">
                One to three dithered layers, every form, mix, fold, screen and colour
                in play. A roll decides the graphic only — never the veil or the type,
                because whether the words can be read is your call and not the dice&apos;s.
              </p>
            </Drawer>
          )}

          {drawer === "spec" && (
            <Drawer title="paste a spec" onClose={() => setDrawer(null)}>
              <div className="max-w-xl space-y-2">
                <Text
                  value={importText}
                  rows={6}
                  mono
                  placeholder="a spec as JSON, a bare encoded spec, or a whole /postlab link"
                  onChange={setImportText}
                />
                <div className="flex items-center gap-2">
                  <Btn onClick={importSpec} on>
                    Load it
                  </Btn>
                  <a
                    href="/api/postlab/schema"
                    target="_blank"
                    className="text-[11px] underline underline-offset-4"
                  >
                    the spec schema →
                  </a>
                </div>
                <p className="text-[11px] text-muted leading-relaxed">
                  A post is a spec, and a spec is text: anything that can write JSON can
                  hand you a finished post. Point Claude at the schema and give it a
                  note, a newsletter or a Notion page.
                </p>
              </div>
            </Drawer>
          )}
        </div>

        {/* Right: everything about whatever is selected, in groups you can fold
            away once you've set them. */}
        <aside
          className={`w-full md:w-[320px] shrink-0 border-t md:border-t-0 md:border-l ${HAIR} md:overflow-y-auto order-3`}
        >
          <div
            className={`sticky top-0 z-10 bg-background border-b ${HAIR} h-9 px-3 flex items-center gap-2`}
          >
            <Label>slide {String(activeIndex + 1).padStart(2, "0")}</Label>
            <span className="ml-auto text-[10px] text-muted truncate">
              {FORMATS[spec.format].label} · {slide.layers.length} layer
              {slide.layers.length > 1 ? "s" : ""}
            </span>
          </div>

          <Group title="words" summary={plainTitle(slide.title).slice(0, 28)}>
            <Row label="kicker">
              <Text
                value={slide.kicker}
                placeholder="small label, top left"
                onChange={(kicker) => patchSlide({ kicker })}
              />
            </Row>
            <Row label="oval">
              <Text
                value={slide.tag ?? ""}
                placeholder="08/26"
                onChange={(tag) => patchSlide({ tag: tag || undefined })}
              />
            </Row>
            <Text
              value={slide.title}
              rows={3}
              placeholder="the headline — *a run in asterisks* flips to the other voice"
              onChange={(title) => patchSlide({ title })}
            />
            <Text
              value={slide.body}
              rows={2}
              placeholder="a supporting sentence"
              onChange={(body) => patchSlide({ body })}
            />
            <Row label="note">
              <Text
                value={slide.note ?? ""}
                placeholder="top right — a handle, a credit"
                onChange={(note) => patchSlide({ note: note || undefined })}
              />
            </Row>
            <Row label="footer">
              <Text
                value={slide.footer}
                placeholder="bottom left"
                onChange={(footer) => patchSlide({ footer })}
              />
              <input
                value={slide.letter}
                maxLength={1}
                placeholder="M"
                aria-label="Circled letter"
                onChange={(e) => patchSlide({ letter: e.target.value })}
                className={`w-7 h-7 shrink-0 border ${HAIR} bg-transparent text-center text-[11px] focus:outline-none focus:border-foreground`}
              />
            </Row>
            <p className="text-[10px] text-muted leading-relaxed pt-1">
              {slide.note
                ? "The note has the top-right corner, so the circled mark stands down while it's there."
                : "Wrap a run in *asterisks* to flip it to the other voice — italic in a roman headline, roman in an italic one."}
            </p>
          </Group>

          <Group
            title="setting"
            summary={`${slide.titleFont} · ${slide.titleSize} · ${slide.align}`}
          >
            <Row label="typeface">
              <Select
                value={slide.titleFont}
                options={[
                  { value: "serif", label: "serif — Lora, editorial" },
                  { value: "sans", label: "sans — Archivo, poster" },
                  { value: "gothic", label: "gothic — Pirata, blackletter" },
                ]}
                onChange={(titleFont) =>
                  patchSlide({ titleFont: titleFont as SlideSpec["titleFont"] })
                }
              />
            </Row>
            <Row label="size">
              <Segmented
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
              <Segmented
                value={slide.align}
                options={[
                  { value: "left" as const, label: "left" },
                  { value: "center" as const, label: "center" },
                ]}
                onChange={(align) => patchSlide({ align })}
              />
            </Row>
            <Row label="anchor">
              <Segmented
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
            <div className="flex flex-wrap gap-x-1 gap-y-0 pt-1">
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
            {slide.titleSize === "fit" && (
              <p className="text-[10px] text-muted leading-relaxed">
                The headline grows until it fills the frame inside the margin, keeping the
                line breaks you typed.
              </p>
            )}
          </Group>

          <Group
            title="on the slide"
            summary={`${parts.length} of ${SLIDE_PARTS.length}`}
            open={false}
            note="Switching a part off keeps its words, so switching it back on brings them with it."
          >
            <div className="flex flex-wrap gap-x-1 gap-y-0">
              {SLIDE_PARTS.map((part) => (
                <Switch
                  key={part}
                  label={part}
                  on={partOn(slide, part)}
                  onChange={() => togglePart(part)}
                />
              ))}
            </div>
            <Row label="the mark">
              <Select
                value={slide.mark ?? "auto"}
                options={[
                  { value: "auto", label: "auto — page on a carousel, letter alone" },
                  { value: "letter", label: "the letter" },
                  { value: "page", label: "the page number" },
                  { value: "none", label: "nothing" },
                ]}
                onChange={(mark) => patchSlide({ mark: mark as SlideSpec["mark"] })}
              />
            </Row>
          </Group>

          <Group
            title="the counter"
            summary={slide.count ? `${slide.count.from} → ${slide.count.to}` : "off"}
            open={!!slide.count}
            note="A number that counts over the loop. Write # wherever it should appear — “#” with “days to go” under it is a countdown. It is the one thing that makes the type move rather than the background."
          >
            <Switch
              label="counting"
              on={!!slide.count}
              onChange={() =>
                patchSlide({ count: slide.count ? undefined : { from: 12, to: 0, pad: 2 } })
              }
            />
            {slide.count && (
              <>
                <Dial
                  label="from"
                  value={slide.count.from}
                  min={0}
                  max={999}
                  step={1}
                  onChange={(from) => patchSlide({ count: { ...slide.count!, from } })}
                />
                <Dial
                  label="to"
                  value={slide.count.to}
                  min={0}
                  max={999}
                  step={1}
                  onChange={(to) => patchSlide({ count: { ...slide.count!, to } })}
                />
                <Dial
                  label="digits"
                  value={slide.count.pad ?? 0}
                  min={0}
                  max={4}
                  step={1}
                  onChange={(pad) =>
                    patchSlide({ count: { ...slide.count!, pad: pad || undefined } })
                  }
                  suffix={slide.count.pad ? undefined : "as written"}
                />
                <p className="text-[10px] text-muted leading-relaxed">
                  {Math.abs(slide.count.to - slide.count.from) + 1} values over{" "}
                  {spec.duration}s. Padding holds the same room for every one of them, so
                  the headline doesn&apos;t breathe as a digit drops.
                </p>
              </>
            )}
          </Group>

          <Group
            title="the sheet"
            summary={GROUND_NAMES[slide.background ?? ""] ?? slide.theme}
            note="What the post is printed on. A ground is paper, not colour — almost nothing in this register sits on pure white."
          >
            <Row label="theme">
              <Segmented
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
            <Row label="any hex">
              <label
                className={`h-7 px-2 border ${HAIR} text-[11px] cursor-pointer hover:bg-foreground/5 transition-colors inline-flex items-center`}
              >
                Pick a ground
                <input
                  type="color"
                  value={slide.background ?? slideTones(slide).bg}
                  onChange={(e) => patchSlide({ background: e.target.value })}
                  className="sr-only"
                />
              </label>
              <span className="text-[10px] text-muted tabular-nums">
                {slide.background ?? "the theme's own"}
              </span>
            </Row>
            <Dial
              label="veil"
              value={slide.veil}
              min={0}
              max={0.9}
              step={0.05}
              onChange={(veil) => patchSlide({ veil })}
              suffix={slide.veil === 0 ? "none" : undefined}
            />
          </Group>

          <Group
            title="the ruling"
            summary={(slide.grid ?? 0) >= 2 ? `${slide.grid} columns` : "off"}
            note="The hairline grid the club's sheets are drawn on: square cells, cut equally top and bottom."
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
                  title="The sheet's lines cross the words — a technical drawing rather than a caption"
                />
              </>
            )}
          </Group>

          {/* Marks on the sheet: the club's motifs as objects, each with the
              deformers that turn one into a pattern of them. */}
          <Group
            title="marks"
            summary={
              (slide.shapes ?? []).length
                ? (slide.shapes ?? []).map((s) => s.kind).join(" · ")
                : "none"
            }
            open={(slide.shapes ?? []).length > 0}
            note="Circles, ovals, rules, arcs, brackets — placed over the words, or under them. Copies, spread, scatter, twist and taper turn one mark into a pattern without adding a layer."
          >
            {(slide.shapes ?? []).map((shape, i) => {
              const repeat = Math.round(shape.repeat ?? 1);
              return (
                <Block
                  key={i}
                  title={`${shape.kind}${repeat > 1 ? ` ×${repeat}` : ""}${
                    shape.under ? " · under" : ""
                  }`}
                  onUp={i > 0 ? () => moveShape(i, -1) : undefined}
                  onDown={i < (slide.shapes ?? []).length - 1 ? () => moveShape(i, 1) : undefined}
                  onRemove={() => removeShape(i)}
                  open={i === (slide.shapes ?? []).length - 1}
                >
                  <Row label="mark">
                    <Select
                      value={shape.kind}
                      options={SHAPE_KINDS.map((k) => ({ value: k, label: k }))}
                      onChange={(kind) => patchShape(i, { kind: kind as ShapeKind })}
                    />
                  </Row>
                  {SHAPE_CONTROLS.map((c) => (
                    <ParamRow
                      key={c.key}
                      control={c}
                      value={Number((shape as unknown as Record<string, number>)[c.key] ?? c.def)}
                      motion={shape.motion?.[c.key]}
                      canMove
                      onChange={(v) => patchShape(i, { [c.key]: v } as Partial<ShapeSpec>)}
                      onMotion={(m) => setShapeMotion(i, c.key, m)}
                    />
                  ))}
                  <Row label="ink">
                    <Swatches
                      palette={slide.palette ?? PALETTE}
                      value={shape.ink ?? ""}
                      options={[{ value: "", label: "theme" }]}
                      onChange={(v) => patchShape(i, { ink: v || undefined })}
                    />
                  </Row>
                  <Row label="">
                    <Switch
                      label="under the words"
                      on={!!shape.under}
                      onChange={() => patchShape(i, { under: shape.under ? undefined : true })}
                    />
                  </Row>
                  <div className={`border-t ${HAIR} pt-1.5 mt-1 space-y-1`}>
                    <Label>deformers</Label>
                    <Row label="laid out">
                      <Select
                        value={shape.along ?? "x"}
                        options={[
                          { value: "x", label: "in a row" },
                          { value: "y", label: "in a column" },
                          { value: "arc", label: "along an arc" },
                          { value: "ring", label: "around a ring" },
                        ]}
                        onChange={(along) =>
                          patchShape(i, {
                            along: along === "x" ? undefined : (along as ShapeSpec["along"]),
                          })
                        }
                      />
                    </Row>
                    {SHAPE_DEFORMERS.map((c) => (
                      <ParamRow
                        key={c.key}
                        control={c}
                        value={Number(
                          (shape as unknown as Record<string, number>)[c.key] ?? c.def,
                        )}
                        motion={shape.motion?.[c.key]}
                        canMove
                        onChange={(v) =>
                          patchShape(i, {
                            [c.key]: v === c.def ? undefined : v,
                          } as Partial<ShapeSpec>)
                        }
                        onMotion={(m) => setShapeMotion(i, c.key, m)}
                      />
                    ))}
                    {!!shape.jitter && (
                      <Btn
                        onClick={() =>
                          patchShape(i, { seed: Math.floor(Math.random() * 9999) + 1 })
                        }
                        title="The scatter is fixed, so it never crawls — this rolls a different one"
                      >
                        Rescatter
                      </Btn>
                    )}
                  </div>
                </Block>
              );
            })}
            <Row label="add">
              <Select
                value=""
                options={[
                  { value: "", label: `a mark…  (${(slide.shapes ?? []).length}/${MAX_SHAPES})` },
                  ...SHAPE_KINDS.map((k) => ({ value: k, label: k })),
                ]}
                onChange={(k) => k && addShape(k as ShapeKind)}
              />
            </Row>
          </Group>

          <Group
            title="the pixels, on the type"
            summary={slide.titlePixel || slide.metaPixel ? "on" : "off"}
            open={false}
            note="The club's screen, over the type: every glyph thresholded into hard ink-or-nothing blocks at this cell size."
          >
            <Dial
              label="title"
              value={slide.titlePixel}
              min={0}
              max={24}
              step={1}
              onChange={(titlePixel) => patchSlide({ titlePixel })}
              suffix={slide.titlePixel ? undefined : "off"}
            />
            <Dial
              label="everything else"
              value={slide.metaPixel}
              min={0}
              max={24}
              step={1}
              onChange={(metaPixel) => patchSlide({ metaPixel })}
              suffix={slide.metaPixel ? undefined : "off"}
            />
          </Group>

          <Group
            title="the palette"
            summary={slide.palette ? `${slide.palette.length} by hand` : "the club's"}
            open={false}
          >
            <div className="flex items-center gap-1 flex-wrap">
              {(slide.palette ?? PALETTE).map((hex, i) => (
                <span key={i} className="relative shrink-0">
                  <label
                    className={`block size-7 border ${HAIR} cursor-pointer`}
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
                      onClick={() =>
                        patchSlide({
                          palette: (slide.palette ?? [...PALETTE]).filter((_, j) => j !== i),
                        })
                      }
                      title="Remove this colour"
                      className={`absolute -top-1.5 -right-1.5 size-4 leading-none text-[9px] border ${HAIR} bg-background text-muted hover:text-foreground`}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              <IconBtn
                onClick={() => {
                  const cur = slide.palette ?? [...PALETTE];
                  patchSlide({ palette: [...cur, PALETTE[cur.length % PALETTE.length]] });
                }}
                title="Add a colour"
              >
                +
              </IconBtn>
              {slide.palette && (
                <Btn onClick={() => patchSlide({ palette: undefined })}>Reset</Btn>
              )}
            </div>
            <p className="text-[10px] text-muted leading-relaxed">
              {slide.palette
                ? "This post no longer follows the club palette."
                : "The club palette. Change it in one place and every post that hasn't been hand-coloured follows."}
            </p>
          </Group>

          <Group title={`layer ${String(layerIndex + 1).padStart(2, "0")}`} summary={layerName(layer)}>
            {slide.layers.length > 1 && (
              <Row label="which">
                <Select
                  value={String(layerIndex)}
                  options={slide.layers
                    .map((l, i) => ({
                      value: String(i),
                      label: `${String(i + 1).padStart(2, "0")} — ${layerName(l)}`,
                      order: i,
                    }))
                    .reverse()}
                  onChange={(i) => setActiveLayer(Number(i))}
                />
              </Row>
            )}
            <Row label="draws">
              <Select
                value={layer.type}
                options={SHADERS.map((s) => ({
                  value: s.type,
                  label: s.label,
                  group: FAMILY_NAMES[s.family ?? "pixelated"],
                }))}
                onChange={(t) => setShaderType(t as ShaderType)}
              />
            </Row>
            <Row label="blend">
              <Select
                value={layer.blend}
                options={BLENDS.map((b) => ({ value: b, label: b }))}
                onChange={(blend) => patchLayer({ blend: blend as LayerSpec["blend"] })}
              />
            </Row>
            <Dial
              label="opacity"
              value={layer.opacity}
              min={0.05}
              max={1}
              step={0.05}
              onChange={(opacity) => patchLayer({ opacity })}
            />
            <Row label="ink">
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
            </Row>
            {layer.ink === "mix" && (
              <div className={`border-l ${HAIR} pl-2 ml-1 space-y-1.5`}>
                <Row label="which of them">
                  <span className="flex items-center gap-1 flex-wrap">
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
                              : `${HAIR} opacity-25 hover:opacity-60`
                          }`}
                        />
                      );
                    })}
                  </span>
                </Row>
                <Row label="spread">
                  <Select
                    value={layer.mixMode ?? "blocks"}
                    options={MIX_MODES.map((m) => ({ value: m, label: MIX_MODE_HINTS[m] }))}
                    onChange={(mixMode) =>
                      patchLayer({ mixMode } as unknown as Partial<LayerSpec>)
                    }
                  />
                </Row>
                <Dial
                  label="patch"
                  value={layer.mixScale ?? 3}
                  min={1}
                  max={12}
                  step={1}
                  onChange={(mixScale) => patchLayer({ mixScale } as Partial<LayerSpec>)}
                />
                <Dial
                  label="drift"
                  value={layer.mixSpeed ?? 1}
                  min={0}
                  max={3}
                  step={0.1}
                  onChange={(mixSpeed) => patchLayer({ mixSpeed } as Partial<LayerSpec>)}
                  suffix={(layer.mixSpeed ?? 1) === 0 ? "still" : undefined}
                />
                <Row label="">
                  <Btn
                    onClick={() =>
                      patchSlide({ colorSeed: Math.floor(Math.random() * 9999) + 1 })
                    }
                    title="Which colour starts where"
                  >
                    Rearrange the colours
                  </Btn>
                </Row>
              </div>
            )}
            {(def.choices ?? [])
              /* Only show a control that can currently do something: the word
                 picker matters only when a letter is on screen, and the mix mode
                 only once there are two forms to mix. */
              .filter((c) => {
                if (c.key === "word")
                  return layer.pattern === "letter" || layer.pattern2 === "letter";
                if (c.key === "mix") return (layer.pattern2 ?? "none") !== "none";
                return true;
              })
              .map((c) => (
                <Row key={c.key} label={c.label}>
                  <Select
                    value={String(layer[c.key] ?? c.def)}
                    options={c.values.map((v) => ({ value: v, label: v }))}
                    onChange={(v) => patchLayer({ [c.key]: v })}
                  />
                </Row>
              ))}
            {wantsPhoto && (
              <div className={`border-l ${HAIR} pl-2 ml-1 space-y-1.5`}>
                <Row label="picture">
                  <label
                    className={`h-7 px-2 border ${HAIR} text-[11px] cursor-pointer hover:bg-foreground/5 transition-colors inline-flex items-center`}
                  >
                    {layer.src ? "Replace" : "Choose a file"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => pickPhoto(e.target.files?.[0])}
                    />
                  </label>
                  {layer.src && (
                    <Btn onClick={() => patchLayer({ src: undefined } as Partial<LayerSpec>)}>
                      Remove
                    </Btn>
                  )}
                </Row>
                <Row label="fill">
                  <Segmented
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
                </Row>
                <p className="text-[10px] text-muted leading-relaxed">
                  {!layer.src
                    ? "The photo becomes a grayscale source like any other form: sampled at the cell size, thresholded, and inked."
                    : photoUrl(layer.src)
                      ? layer.src.startsWith("local:")
                        ? "This picture lives in this browser only, so a shared link won't carry it."
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
              <p className="text-[10px] text-muted leading-relaxed">
                Nothing to set: this layer draws nothing at all, which is what a sheet
                wants behind its words.
              </p>
            )}
          </Group>

          {/* The effect stack, the way every motion tool draws one: each effect
              a block with its own switch, its own order and its own numbers, so
              you can take one out of the chain and see what it was doing. */}
          <Group
            title="effects"
            summary={
              (layer.filters ?? []).length
                ? (layer.filters ?? [])
                    .map((f) => (f.mute ? `(${f.type})` : String(f.type)))
                    .join(" → ")
                : "none"
            }
            open={(layer.filters ?? []).length > 0}
            note="What happens to this layer after it's drawn, top to bottom. Pixelate is the club's screen — put it on a clean shader and the image comes out in the club's pixels."
          >
            {(layer.filters ?? []).map((f, i) => {
              const fd = filterDef(String(f.type));
              if (!fd) return null;
              return (
                <Block
                  key={i}
                  title={fd.label}
                  on={!f.mute}
                  onToggle={() => patchFilter(i, { mute: f.mute ? undefined : true })}
                  onUp={i > 0 ? () => moveFilter(i, -1) : undefined}
                  onDown={i < (layer.filters ?? []).length - 1 ? () => moveFilter(i, 1) : undefined}
                  onRemove={() => removeFilter(i)}
                >
                  {(fd.choices ?? []).map((c) => (
                    <Row key={c.key} label={c.label}>
                      <Select
                        value={String(f[c.key] ?? c.def)}
                        options={c.values.map((v) => ({ value: v, label: v }))}
                        onChange={(v) => patchFilter(i, { [c.key]: v })}
                      />
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
                  <p className="text-[10px] text-muted leading-relaxed">{fd.hint}</p>
                </Block>
              );
            })}
            <Row label="add">
              <Select
                value=""
                options={[
                  { value: "", label: "an effect…" },
                  ...FILTERS.filter(
                    (f) => !(layer.filters ?? []).some((x) => x.type === f.type),
                  ).map((f) => ({ value: f.type, label: f.label })),
                ]}
                onChange={(t) => t && addFilter(t)}
              />
            </Row>
            <p className="text-[10px] text-muted leading-relaxed">
              Order matters: pixelate then grain is a screened image with grain over
              it; grain then pixelate is grain that got screened.
            </p>
          </Group>

          <Group title="transform" open={false}>
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
            <Btn
              onClick={() => patchLayer({ offsetX: 0, offsetY: 0, rotation: 0, scale: 1 })}
            >
              Reset the transform
            </Btn>
            <p className="text-[10px] text-muted leading-relaxed">
              {canMove
                ? "The ○ beside a number makes it travel over the loop instead of holding still — it appears as a wave in the timeline. Trips are whole numbers, so it always lands back where it started."
                : "Travelling parameters are a dithered-forms thing: the WebGL shader takes its numbers once, not every frame."}
            </p>
          </Group>
        </aside>
      </div>

      {/* The loop, along the bottom, under everything it applies to. */}
      {timeline && (
        <Tracks
          slide={slide}
          duration={spec.duration}
          layerIndex={layerIndex}
          playing={playing}
          onPlay={setPlaying}
          onSelectLayer={setActiveLayer}
        />
      )}
    </div>
  );
}
