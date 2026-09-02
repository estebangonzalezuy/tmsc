"use client";

// the Posts Studio.
//
// The page is the club's own light ground; the post sits on it, docked between
// two flat columns rather than floating under a stack of glass.
//
//   top bar       the mark, the title, Import / Share / Export
//   left, docked  the layers stack, then recipes to pick a whole look from
//   right, docked one panel: what you *set*, one column, read downwards
//   bottom left   the filmstrip, when there is more than one slide
//   bottom centre the toolbar: undo, zoom, the transport, the loop
//
// Everything is drawn from Toolcraft (`toolcraft.tsx`), so a control learned in
// one place is the same control everywhere — a number is a dark filled pill,
// the field itself the slider.
//
// The right panel's order is Toolcraft's own — canvas, source, type, marks,
// effect, colour, and export at the foot — not this tool's history. It had
// tabs once, and a tab is a second place to look for something that was only
// ever in one place; a group that folds shut with its summary showing does
// the same job without hiding half the post behind a switch.
//
// Two rules the studio keeps for itself. Every graphic arrives **moving** — a
// mark, a layer, an effect — because this is a studio for motion and a still
// thing is the exception. And every number that travels does so on whole trips,
// so nothing here can hand back a post that doesn't loop.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  SHAPE_LOOPS,
  SLIDE_PARTS,
  SPEC_VERSION,
  WAVES,
  animatable,
  applyLoop,
  applyStyle,
  decodeSpec,
  defaultFilter,
  defaultLayer,
  defaultShape,
  defaultSlide,
  encodeSpec,
  filterDef,
  loopOf,
  loopReport,
  normalizeSpec,
  openingSpec,
  partOn,
  plainTitle,
  randomShader,
  randomSlide,
  shaderDef,
  shapeLoopDef,
  shapeLoopOf,
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
import { clip as clipOf, isClip, paintFrame, saveClip, type Clip } from "./clips";
import Stage, { useClockRunning, useStageFit } from "./Stage";
import { useExports } from "./useExports";
import { clock } from "./clock";
import Poster from "./Poster";
import Tracks from "./Tracks";
import {
  Block,
  Btn,
  Buttons,
  ColorRow,
  Cols,
  Dots,
  Drawer,
  Dropzone,
  HAIR,
  IconBtn,
  Label,
  ListRow,
  Menu,
  MenuItem,
  MenuRow,
  MenuSep,
  Panel,
  Primary,
  Rail,
  RailItem,
  Range,
  Row,
  STAGE,
  Section,
  Segmented,
  Select,
  Sep,
  Slider,
  Stack,
  Text,
  Thumb,
  Toggle,
  Toolbar,
  TopBar,
  XYPad,
} from "./toolcraft";

/* ------------------------------------------------------------- small parts */

const WAVE_HINTS: Record<Wave, string> = {
  sin: "sin — eases both ways",
  tri: "tri — straight there and back",
  saw: "saw — ramps, then snaps",
  square: "square — switches hard",
};

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
  kinetic: "the Kinetics",
  tile: "the Tiles",
  clean: "clean shaders",
};

/* Outside the component: a seed is rolled when a mark is made, not while the
   studio renders. */
const rollSeed = () => Math.floor(Math.random() * 9999) + 1;
/* Also outside: the clock is read when an edit happens, not while rendering. */
const stamp = () => Date.now();

/** What the layer is holding, for the block's own title. */
const mediaName = (l: LayerSpec) => {
  if (!l.src) return "none";
  if (isClip(l.src)) {
    const c = clipOf(l.src);
    return c ? `${c.kind} · ${c.frames.length}f` : "reading…";
  }
  return l.src.startsWith("local:") ? "a picture" : l.src;
};

/** What it costs, said where the file was picked rather than in a doc. */
const mediaNote = (l: LayerSpec, film: Clip | null) => {
  if (film)
    return `${film.frames.length} frames at ${film.w}×${film.h}, in this browser only — a shared link won't carry the film. It becomes a grayscale source like any other form: sampled at the cell size, thresholded, and inked.`;
  if (!l.src) return undefined;
  if (!photoUrl(l.src)) return "That picture isn't on this device. Choose the file again.";
  return l.src.startsWith("local:")
    ? "This picture lives in this browser only, so a shared link won't carry it."
    : "A path on this site, so this one travels in the link.";
};

/** One frame of a clip, following the playhead — a thumbnail that moves. */
function ClipFrame({ clip, cycles }: { clip: Clip; cycles: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let last = -1;
    /* Subscribing rather than re-rendering: the clock is deliberately outside
       React, and a thumbnail is not a reason to bring it back in. */
    return clock.subscribe(() => {
      const canvas = ref.current;
      if (!canvas) return;
      const now = Math.floor(clock.get() * 8);
      if (now === last) return;
      last = now;
      paintFrame(canvas, clip, clock.get() / 6, cycles);
    });
  }, [clip, cycles]);
  return <canvas ref={ref} className="w-full block max-h-[160px] object-cover" />;
}

/* A heading inside the one menu. The menu carries what used to be six menus,
   so it needs the names those menus had. */
const MenuLabel = ({ children }: { children: string }) => (
  <div className="px-3 pt-2 pb-1">
    <Label>{children}</Label>
  </div>
);

const layerName = (l: LayerSpec) =>
  l.type === "forms" ? String(l.pattern ?? "rings") : shaderDef(l.type).label;

/**
 * A number, and the loop plugged into it. The dot says whether it travels; the
 * loop is named, and the fine print appears only when there's something to say
 * that the name doesn't.
 *
 * A number that travels is drawn as one two-handle track rather than two
 * sliders — where it rests and where it goes are the same journey, and reading
 * them off one track is how you see the size of the trip at a glance.
 */
function LoopRow({
  control: c,
  value,
  motion,
  canMove,
  onChange,
  onMotion,
  detail = true,
  suffix,
}: {
  control: ShaderControl;
  value: number;
  motion?: Motion;
  canMove: boolean;
  onChange: (v: number) => void;
  onMotion: (m: Motion | null) => void;
  detail?: boolean;
  suffix?: string;
}) {
  const dot = canMove ? (
    <button
      onClick={() => onMotion(motion ? null : applyLoop("drift", c, value))}
      title={motion ? "Hold this one still" : "Plug a loop into this number"}
      className={`w-3 shrink-0 text-[9px] ${
        motion
                ? "text-[color:var(--tc-ink)]"
                : "text-[color:var(--tc-ink-3)] hover:text-[color:var(--tc-ink)]"
      }`}
    >
      {motion ? "◉" : "○"}
    </button>
  ) : undefined;

  return (
    <>
      {motion ? (
        <Range
          label={c.label}
          from={value}
          to={motion.to}
          min={c.min}
          max={c.max}
          step={c.step}
          suffix={suffix}
          cross
          right={dot}
          onChange={(v, to) => {
            if (v !== value) onChange(v);
            if (to !== motion.to) onMotion({ ...motion, to });
          }}
        />
      ) : (
        <Slider
          label={c.label}
          value={value}
          min={c.min}
          max={c.max}
          step={c.step}
          suffix={suffix}
          onChange={onChange}
          right={dot}
        />
      )}
      {motion && detail && (
        <div className={`border-l ${HAIR} pl-2 ml-1 space-y-2`}>
          <Row label="loop">
            <Select
              value={loopOf(motion)}
              options={[
                ...LOOPS.map((l) => ({ value: l.id, label: `${l.name} — ${l.about}` })),
                ...(loopOf(motion) === "custom" ? [{ value: "custom", label: "custom" }] : []),
              ]}
              onChange={(id) => {
                const next = applyLoop(id, c, value);
                if (next) onMotion({ ...next, to: motion.to });
              }}
            />
          </Row>
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
  const [spec, setSpecRaw] = useState<PostSpec>(openingSpec);
  /* Undo is the one thing a studio can't ask you to live without. Two stacks of
     whole specs — they're small, and a whole-spec history can't half-apply. */
  const [past, setPast] = useState<PostSpec[]>([]);
  const [future, setFuture] = useState<PostSpec[]>([]);
  const lastPush = useRef(0);

  const [active, setActive] = useState(0);
  const [activeLayer, setActiveLayer] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fonts, setFonts] = useState<Fonts | null>(null);
  const [flash, setFlash] = useState("");
  const [importText, setImportText] = useState("");
  const [styleClip, setStyleClip] = useState<SlideStyle | null>(null);
  const [wiggle, setWiggle] = useState(0.25);
  const [sheet, setSheet] = useState<SlideStyle[]>([]);
  const [solo, setSolo] = useState<number | null>(null);
  /* View options. None of them reach the post. */
  const [guides, setGuides] = useState(false);
  const [strip, setStrip] = useState(true);
  const [tracks, setTracks] = useState(false);
  const [zoom, setZoom] = useState(1);
  /* A file is picked once; asking for another opens the door again. */
  const [pickMore, setPickMore] = useState(0);
  /* What's over the stage, when something needs the room. */
  const [drawer, setDrawer] = useState<"generate" | "spec" | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const shaderBoxRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const ownHashRef = useRef<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const fit = useStageFit(stageRef, spec.format, 96);

  const { w } = FORMATS[spec.format];
  const stageSize = { w: Math.round(fit.w * zoom), h: Math.round(fit.h * zoom) };
  const activeIndex = Math.min(active, spec.slides.length - 1);
  const slide = spec.slides[activeIndex];
  const layerIndex = Math.min(activeLayer, slide.layers.length - 1);
  const layer = slide.layers[layerIndex];
  const def = shaderDef(layer.type);
  const shapes = slide.shapes ?? [];

  /* Every change to the post goes through here, so every change is undoable.
     Pushes within half a second of each other coalesce — dragging a slider is
     one edit, not fifty. */
  const setSpec = (next: PostSpec | ((s: PostSpec) => PostSpec)) => {
    const value = typeof next === "function" ? next(spec) : next;
    if (value === spec) return;
    const now = stamp();
    if (now - lastPush.current > 500) setPast((p) => [...p.slice(-40), spec]);
    lastPush.current = now;
    setFuture([]);
    setSpecRaw(value);
  };

  const undo = () => {
    const prev = past.at(-1);
    if (!prev) return;
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [spec, ...f].slice(0, 40));
    setSpecRaw(prev);
    lastPush.current = 0;
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture((f) => f.slice(1));
    setPast((p) => [...p.slice(-40), spec]);
    setSpecRaw(next);
    lastPush.current = 0;
  };

  /* Load fonts, then any spec passed in the URL. */
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const fromHash = window.location.hash.match(/spec=([^&]+)/)?.[1];
    const decoded =
      decodeSpec(fromHash ?? search.get("spec") ?? "") ?? specFromQuery(search);
    loadFonts().then((f) => {
      setFonts(f);
      if (decoded) setSpecRaw(decoded);
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
     without remounting, so listen for the navigation: opening a post from
     Notion has to work in a reused tab, which is what a phone always does. */
  useEffect(() => {
    const onHashChange = () => {
      const encoded = window.location.hash.match(/spec=([^&]+)/)?.[1];
      if (!encoded || encoded === ownHashRef.current) return;
      const decoded = decodeSpec(encoded);
      if (!decoded) return;
      ownHashRef.current = encoded;
      setSpecRaw(decoded);
      setActive(0);
      setActiveLayer(0);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  /* The loop runs here; every canvas is a function of it. */
  useClockRunning(playing, spec.duration);

  /* ------------------------------------------------------------- editing */

  const patchSlide = (patch: Partial<SlideSpec>) =>
    setSpec({
      ...spec,
      slides: spec.slides.map((sl, i) => (i === activeIndex ? { ...sl, ...patch } : sl)),
    });

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
  const film = clipOf(layer.src);
  const defaultWeight =
    slide.titleFont === "serif" ? 500 : slide.titleFont === "gothic" ? 400 : 600;

  const say = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  };

  /**
   * A picture, a film or a GIF, all through one door. The file never leaves the
   * browser: the layer keeps a `local:` or `clip:` handle and the media sits in
   * this device's storage, like the Studio's token.
   *
   * Picking one also puts the layer on the `photo` pattern rather than asking
   * for that separately — a file *is* the choice of what to draw, and making
   * someone find a dropdown afterwards is a step that says nothing.
   */
  const pickMedia = async (file: File | undefined) => {
    if (!file) return;
    const film = /^video\//.test(file.type) || /gif|webp/i.test(file.type);
    try {
      let src: string;
      if (film) {
        say("Reading it…");
        src = await saveClip(file, (stage, done, total) =>
          setFlash(`${stage} — ${Math.round((done / total) * 100)}%`),
        );
      } else {
        src = savePhoto(await readFile(file));
      }
      /* On the layer, and drawing: a layer that draws nothing has nowhere to
         put a picture, so switching it to forms is part of taking the file. */
      const onForms =
        layer.type === "forms"
          ? { src, pattern: "photo" }
          : { ...defaultLayer("forms"), pattern: "photo", src, opacity: layer.opacity };
      patchLayer(onForms as Partial<LayerSpec>);
      say(film ? "On this device, frame by frame" : "Photo on this device");
    } catch (e) {
      say(e instanceof Error ? e.message : "Couldn't read that file");
    }
  };

  /* ---------------------------------------------------------- the chain */

  const setFilters = (list: FilterSpec[]) =>
    patchLayer({ filters: list.length ? list : undefined } as Partial<LayerSpec>);

  /* An effect arrives with one of its numbers already travelling: nothing in
     this studio is added still. */
  const addFilter = (type: string) => {
    const f = defaultFilter(type);
    const first = filterDef(type)?.controls[0];
    if (first) {
      const from = Number(f[first.key] ?? first.def);
      const m = applyLoop("breathe", first, from);
      if (m) f.motion = { [first.key]: m };
    }
    setFilters([...(layer.filters ?? []), f]);
  };

  const removeFilter = (i: number) =>
    setFilters((layer.filters ?? []).filter((_, j) => j !== i));

  /* `FilterSpec` is an index signature of numbers and strings plus two named
     fields, so a patch carrying the motion map needs the wider type here. */
  const patchFilter = (i: number, patch: Record<string, unknown>) =>
    setFilters(
      (layer.filters ?? []).map((f, j) => (j === i ? ({ ...f, ...patch } as FilterSpec) : f)),
    );

  const setFilterMotion = (i: number, key: string, m: Motion | null) => {
    const f = (layer.filters ?? [])[i];
    if (!f) return;
    const motion = { ...(f.motion ?? {}) };
    if (m) motion[key] = m;
    else delete motion[key];
    patchFilter(i, { motion: Object.keys(motion).length ? motion : undefined });
  };

  /* Order matters: pixelate before grain is a screened image with grain over it,
     grain before pixelate is grain that got screened. */
  const moveFilter = (i: number, dir: -1 | 1) => {
    const list = [...(layer.filters ?? [])];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setFilters(list);
  };

  const setMotion = (key: string, m: Motion | null) => {
    const motion = { ...(layer.motion ?? {}) };
    if (m) motion[key] = m;
    else delete motion[key];
    patchLayer({
      motion: Object.keys(motion).length ? motion : undefined,
    } as Partial<LayerSpec>);
  };

  /* ------------------------------------------------------------- marks */

  const setShapes = (list: ShapeSpec[]) =>
    patchSlide({ shapes: list.length ? list : undefined });

  const addShape = (kind: ShapeKind) => {
    if (shapes.length >= MAX_SHAPES) return;
    const base = defaultShape(kind);
    /* A frame breathes and a mark sways: rocking a bracket off its own axis is
       the one default that would need undoing every time. */
    const frame = ["bracket", "square", "circle", "oval"].includes(kind);
    setShapes([
      ...shapes,
      {
        ...base,
        seed: rollSeed(),
        motion: shapeLoopDef(frame ? "breathe" : "sway")!.motion(base),
      },
    ]);
  };

  const patchShape = (i: number, patch: Partial<ShapeSpec>) =>
    setShapes(shapes.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const removeShape = (i: number) => setShapes(shapes.filter((_, j) => j !== i));

  const moveShape = (i: number, dir: -1 | 1) => {
    const list = [...shapes];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setShapes(list);
  };

  const setShapeMotion = (i: number, key: string, m: Motion | null) => {
    const shape = shapes[i];
    if (!shape) return;
    const motion = { ...(shape.motion ?? {}) };
    if (m) motion[key] = m;
    else delete motion[key];
    patchShape(i, { motion: Object.keys(motion).length ? motion : undefined });
  };

  /* ------------------------------------------------------------- parts */

  const togglePart = (part: string) => {
    const off = new Set(slide.off ?? []);
    if (off.has(part)) off.delete(part);
    else off.add(part);
    patchSlide({ off: off.size ? [...off] : undefined });
  };

  const onlyParts = (keep: string[]) =>
    patchSlide({ off: SLIDE_PARTS.filter((p) => !keep.includes(p)) });

  /* ------------------------------------------------------------ layers */

  const mixInks = layer.inks?.length ? layer.inks : [...(slide.palette ?? PALETTE)];

  const toggleMixInk = (hex: string) => {
    const on = mixInks.includes(hex);
    if (on && mixInks.length <= 1) return;
    const next = on ? mixInks.filter((c) => c !== hex) : [...mixInks, hex];
    const whole = (slide.palette ?? PALETTE).every((c) => next.includes(c));
    patchLayer({ inks: whole ? undefined : next } as Partial<LayerSpec>);
  };

  /* Changing what a layer draws keeps it moving: the new thing arrives with a
     loop plugged into its first number, the same bargain a new layer, a new
     mark and a new effect make. */
  const setShaderType = (type: ShaderType) =>
    patchSlide({
      layers: slide.layers.map((l, i) => {
        if (i !== layerIndex) return l;
        const born = {
          ...defaultLayer(type),
          opacity: l.opacity,
          blend: l.blend,
          offsetX: l.offsetX,
          offsetY: l.offsetY,
          rotation: l.rotation,
          ...(l.ink ? { ink: l.ink } : {}),
        } as LayerSpec;
        const drawn = shaderDef(type);
        const c =
          drawn.kind === "generative"
            ? drawn.controls.find((k) => k.key !== "speed")
            : undefined;
        if (c) {
          const m = applyLoop("drift", c, Number(born[c.key] ?? c.def));
          if (m) born.motion = { [c.key]: m };
        }
        return born;
      }),
    });

  /* A rolled look arrives moving and looping, like everything else here: the
     roll is confined to the club's own renderer, which is the half of the tool
     that comes back to its first frame, and one of its numbers is put on a
     loop straight away. */
  const reroll = (l: LayerSpec): LayerSpec => {
    const out = {
      ...defaultLayer("forms"),
      opacity: l.opacity,
      blend: l.blend,
      offsetX: l.offsetX,
      offsetY: l.offsetY,
      rotation: l.rotation,
      ...randomShader("forms"),
      ...(l.ink ? { ink: l.ink } : {}),
      ...(l.inks ? { inks: l.inks } : {}),
      ...(l.mixMode ? { mixMode: l.mixMode } : {}),
      ...(l.mixScale !== undefined ? { mixScale: l.mixScale } : {}),
      ...(l.mixSpeed !== undefined ? { mixSpeed: l.mixSpeed } : {}),
    } as LayerSpec;
    const c = shaderDef("forms").controls.find((k) => k.key === "warp");
    if (c) {
      const m = applyLoop("drift", c, Number(out[c.key] ?? c.def));
      if (m) out.motion = { [c.key]: m };
    }
    return out;
  };

  const randomizeLayer = () =>
    patchSlide({
      layers: slide.layers.map((l, i) => (i === layerIndex ? reroll(l) : l)),
      colorSeed: rollSeed(),
    });

  const randomizeSlide = () =>
    patchSlide({ layers: slide.layers.map(reroll), colorSeed: rollSeed() });

  /* A layer arrives moving too — one of its own numbers on a loop, which is the
     difference between a background that reads as a pattern and one that reads
     as a piece of motion. */
  const addLayer = () => {
    if (slide.layers.length >= MAX_LAYERS) return;
    const born = { ...defaultLayer("forms"), blend: "multiply", opacity: 0.8 } as LayerSpec;
    const warp = shaderDef("forms").controls.find((c) => c.key === "warp");
    if (warp) {
      const m = applyLoop("drift", warp, Number(born.warp ?? warp.def));
      if (m) born.motion = { warp: m };
    }
    patchSlide({ layers: [...slide.layers, born] });
    setActiveLayer(slide.layers.length);
  };

  /* By index, because the layers panel acts on the row you pressed rather than
     on the one being edited — the two are usually the same and occasionally
     aren't, and a stack where the buttons act on something else is a stack you
     can't trust. */
  const removeLayerAt = (index: number) => {
    if (slide.layers.length <= 1) return;
    patchSlide({ layers: slide.layers.filter((_, i) => i !== index) });
    setActiveLayer(Math.max(0, Math.min(index, slide.layers.length - 2)));
  };

  const moveLayerAt = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= slide.layers.length) return;
    const layers = [...slide.layers];
    [layers[index], layers[j]] = [layers[j], layers[index]];
    patchSlide({ layers });
    setActiveLayer(j);
  };

  const removeLayer = () => removeLayerAt(layerIndex);
  const moveLayer = (dir: -1 | 1) => moveLayerAt(layerIndex, dir);

  /* ------------------------------------------------------------- styles */

  const copyStyle = () => {
    setStyleClip(styleOf(slide));
    say("Look copied");
  };

  const pasteStyle = (everywhere: boolean) => {
    if (!styleClip) return;
    setSpec({
      ...spec,
      slides: spec.slides.map((sl, i) =>
        everywhere || i === activeIndex ? applyStyle(sl, styleClip) : sl,
      ),
    });
    say(everywhere ? "Pasted on every slide" : "Pasted");
  };

  const roll = (n = 12) => {
    setSheet(Array.from({ length: n }, () => randomSlide()));
    setDrawer("generate");
  };

  const pickCandidate = (style: SlideStyle) => {
    patchSlide(structuredClone(style));
    setActiveLayer(0);
    say("Applied");
  };

  const makeVariations = (n: number) => {
    const style = styleOf(slide);
    const born = Array.from({ length: n }, () => ({
      ...structuredClone(slide),
      ...varyStyle(style, wiggle),
    })) as SlideSpec[];
    const slides = [...spec.slides];
    slides.splice(activeIndex + 1, 0, ...born);
    setSpec({ ...spec, slides: slides.slice(0, 20) });
    setActive(activeIndex + 1);
    say(`${n} variations`);
  };

  const addSlide = () => {
    setSpec({ ...spec, slides: [...spec.slides, { ...spec.slides[activeIndex] }] });
    setActive(spec.slides.length);
  };

  const removeSlide = () => {
    if (spec.slides.length <= 1) return;
    setSpec({ ...spec, slides: spec.slides.filter((_, i) => i !== activeIndex) });
    setActive(Math.max(0, activeIndex - 1));
  };

  const moveSlide = (dir: -1 | 1) => {
    const j = activeIndex + dir;
    if (j < 0 || j >= spec.slides.length) return;
    const slides = [...spec.slides];
    [slides[activeIndex], slides[j]] = [slides[j], slides[activeIndex]];
    setSpec({ ...spec, slides });
    setActive(j);
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

  /* ------------------------------------------------------------ exports */

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
    say,
  });

  /* The shortcuts a studio is expected to have. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
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
      else if (e.key.toLowerCase() === "r") roll(12);
      else if (e.key === "0") setZoom(1);
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(4, z * 1.15));
      else if (e.key === "-") setZoom((z) => Math.max(0.25, z / 1.15));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, past, future]);

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
  const percent = Math.round((stageSize.w / w) * 100);

  return (
    <div className={`min-h-dvh md:h-dvh flex flex-col ${STAGE}`}>
      <TopBar title="the Posts Studio" mark="✦">
        <Btn onClick={() => setDrawer("spec")}>Import</Btn>
        <Btn onClick={copyLink} title="Copy a link to this post">
          Share
        </Btn>
        <Btn onClick={savePng} disabled={!!job} dark title="Export this slide as a PNG">
          ⤓ Export
        </Btn>
      </TopBar>
      {/* Below the bar: a docked column either side, the post in between. */}
      <div className="relative flex-1 min-h-0 flex flex-col md:block">
        <div
          ref={stageRef}
          className="h-[52vh] md:h-full flex items-center justify-center overflow-hidden md:pl-[288px] md:pr-[320px]"
        >
          <div
            ref={frameRef}
            className="relative overflow-hidden cursor-move touch-none shrink-0"
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

        {/* Right: one panel, docked, one column. */}
        <div className="md:absolute md:top-0 md:right-0 md:bottom-0 z-20 flex p-2 md:p-0">
          <Panel
            dock="right"
            title="the Posts Studio"
            /* Everything you *do*, in one menu off the panel's header. This
               chrome has no menu bar: the reference doesn't have one, and six
               menus floating over the canvas are six things standing where the
               work is. */
            menu={
              <Menu label="⋯" align="right" width={248}>
                <MenuLabel>the post</MenuLabel>
                  <MenuItem onClick={() => roll(12)} hint="r">
                    Generate a look…
                  </MenuItem>
                  <MenuSep />
                  <MenuRow label="format">
                    <Segmented
                      value={spec.format}
                      options={(Object.keys(FORMATS) as (keyof typeof FORMATS)[]).map((f) => ({
                        value: f,
                        label: FORMATS[f].label,
                        title: FORMATS[f].hint,
                      }))}
                      onChange={(format) => setSpec({ ...spec, format })}
                    />
                  </MenuRow>
                  <div className="px-2.5 pb-2">
                    <Slider
                      label="loop"
                      value={spec.duration}
                      min={2}
                      max={15}
                      step={1}
                      suffix="s"
                      onChange={(duration) => setSpec({ ...spec, duration })}
                    />
                  </div>
                  <MenuSep />
                  <MenuItem onClick={copyLink}>Copy link to this post</MenuItem>
                  <MenuItem onClick={copyJson}>Copy spec JSON</MenuItem>
                  <MenuItem onClick={() => setDrawer("spec")}>Paste a spec…</MenuItem>
                <MenuSep />
                <MenuLabel>this slide</MenuLabel>
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
                  <MenuItem onClick={() => patchSlide({ off: undefined })}>Everything on</MenuItem>
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
                  <div className="px-2.5 pb-2">
                    <Slider
                      label="how far they wander"
                      value={wiggle}
                      min={0.05}
                      max={0.6}
                      step={0.05}
                      onChange={setWiggle}
                    />
                  </div>
                <MenuSep />
                <MenuLabel>this layer</MenuLabel>
                  <MenuItem onClick={addLayer} disabled={slide.layers.length >= MAX_LAYERS}>
                    Add a layer, moving
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
                        Add effect · {f.label}
                      </MenuItem>
                    ),
                  )}
                <MenuSep />
                <MenuLabel>the view</MenuLabel>
                  <MenuItem on={strip} onClick={() => setStrip((v) => !v)}>
                    The filmstrip
                  </MenuItem>
                  <MenuItem on={tracks} onClick={() => setTracks((v) => !v)}>
                    The loop, in tracks
                  </MenuItem>
                  <MenuItem on={guides} onClick={() => setGuides((v) => !v)} hint="g">
                    Margin guides
                  </MenuItem>
                  <MenuSep />
                  <MenuItem onClick={() => setZoom(1)} hint="0">
                    Zoom to fit
                  </MenuItem>
                  <MenuItem
                    on={solo !== null}
                    onClick={() => setSolo(null)}
                    disabled={solo === null}
                  >
                    Stop looking at one layer
                  </MenuItem>
                <MenuSep />
                <MenuLabel>out</MenuLabel>
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
                    <p className="text-[11px] text-[color:var(--tc-ink-3)] leading-relaxed">
                      {loop.loops
                        ? direct
                          ? "Every frame is drawn at its exact moment, at export size. The last runs into the first with no seam."
                          : "The forms return to where they started, but the WebGL layer is filmed as it plays, so the clip can drift by a frame."
                        : loop.why.join(" ")}
                    </p>
                  </div>
                <MenuSep />
                <MenuLabel>go</MenuLabel>
                  <MenuItem onClick={() => router.push("/tools")}>the Tools</MenuItem>
                  <MenuItem onClick={() => router.push("/desk")}>the Desk</MenuItem>
                  <MenuItem onClick={() => router.push("/studio")}>the Studio</MenuItem>
                  <MenuItem onClick={() => router.push("/hub")}>the Hub</MenuItem>
              </Menu>
            }
            onReset={() => patchSlide(defaultSlide({ title: slide.title }))}
            right={
              <span className="text-[11px] text-[color:var(--tc-ink-3)] tabular-nums pr-1">
                {String(activeIndex + 1).padStart(2, "0")}/
                {String(spec.slides.length).padStart(2, "0")} · {FORMATS[spec.format].label}
              </span>
            }
            footer={
              <div className="space-y-1.5">
                <Primary onClick={savePng} disabled={!!job}>
                  ⤓ Export PNG
                </Primary>
                <Buttons>
                  <Btn onClick={saveVideo} disabled={!!job} wide>
                    Video
                  </Btn>
                  <Btn onClick={saveGif} disabled={!!job} wide>
                    GIF
                  </Btn>
                  <Btn onClick={copyLink} wide>
                    Link
                  </Btn>
                </Buttons>
              </div>
            }
          >
            {/* Toolcraft's own sequence, top to bottom, and the tool's too:
                what the post is, what it's printed on, the words, the marks on
                them, the graphic behind them, and colour last. Export sits at
                the foot of the panel, where a tool's way out belongs. There are
                no tabs — one column, read downwards. */}
            <Section
              title="canvas"
              summary={`${FORMATS[spec.format].label} · ${spec.duration}s`}
            >
              <Stack label="aspect ratio">
                <Select
                  value={spec.format}
                  options={(Object.keys(FORMATS) as (keyof typeof FORMATS)[]).map((f) => ({
                    value: f,
                    label: `${FORMATS[f].label} — ${FORMATS[f].hint}`,
                  }))}
                  onChange={(format) =>
                    setSpec({ ...spec, format: format as PostSpec["format"] })
                  }
                />
              </Stack>
              <Cols>
                <Stack label="canvas width">
                  <span
                    className="tc-field h-[var(--tc-h)] px-3 flex items-center text-[12.5px] tabular-nums text-[color:var(--tc-ink-2)]"
                  >
                    {FORMATS[spec.format].w}
                  </span>
                </Stack>
                <Stack label="canvas height">
                  <span
                    className="tc-field h-[var(--tc-h)] px-3 flex items-center text-[12.5px] tabular-nums text-[color:var(--tc-ink-2)]"
                  >
                    {FORMATS[spec.format].h}
                  </span>
                </Stack>
              </Cols>
              <Stack label="resolution scale">
                <Segmented
                  value={quality}
                  options={[
                    { value: "mid" as const, label: "1×" },
                    { value: "high" as const, label: "2×" },
                    { value: "max" as const, label: "4K" },
                  ]}
                  onChange={setQuality}
                />
              </Stack>
              <p className="text-[11px] text-[color:var(--tc-ink-3)] tabular-nums">
                exports at {outW}×{outH}
              </p>
              <Slider
                label="the loop"
                value={spec.duration}
                min={2}
                max={15}
                step={1}
                suffix="s"
                onChange={(duration) => setSpec({ ...spec, duration })}
                help="How long the post runs before it comes back to its first frame"
              />
              <Buttons>
                <Btn onClick={() => setDrawer("generate")} wide title="Twelve looks from nothing">
                  Generate…
                </Btn>
                <Btn onClick={addSlide} wide title="Another slide, from this one">
                  + slide
                </Btn>
              </Buttons>
            </Section>

            <Section
              title="source"
              summary={GROUND_NAMES[slide.background ?? ""] ?? slide.theme}
              note="What the post is printed on. A ground is paper, not colour — almost nothing in this register sits on pure white."
            >
              <Stack label="theme">
                <Segmented
                  value={slide.theme}
                  options={[
                    { value: "light" as const, label: "light" },
                    { value: "dark" as const, label: "dark" },
                  ]}
                  onChange={(theme) => patchSlide({ theme })}
                />
              </Stack>
              <Stack label="ground">
                <Dots
                  colors={GROUNDS.map((g) => g.hex)}
                  labels={GROUND_NAMES}
                  value={slide.background ?? ""}
                  options={[{ value: "", label: "theme" }]}
                  onChange={(v) => patchSlide({ background: v === "" ? undefined : v })}
                />
              </Stack>
              <ColorRow
                label="or any hex"
                value={slide.background ?? slideTones(slide).bg}
                onChange={(background) => patchSlide({ background })}
                onClear={
                  slide.background ? () => patchSlide({ background: undefined }) : undefined
                }
              />
              <Slider
                label="veil"
                value={slide.veil}
                min={0}
                max={0.9}
                step={0.05}
                display={slide.veil === 0 ? "none" : undefined}
                onChange={(veil) => patchSlide({ veil })}
                help="A wash of the ground over the graphic, so the words can be read"
              />
              {/* The file, in the group the reference keeps it in: a picture,
                  a film or a GIF is what the post is *of*, so it sits with the
                  paper rather than inside the effect that screens it. */}
              <Block
                title={`media — ${mediaName(layer)}`}
                open={!!layer.src}
              >
                {layer.src ? (
                  <Thumb
                    src={film ? undefined : (photoUrl(layer.src) ?? undefined)}
                    onRemove={() =>
                      patchLayer({ src: undefined, clipCycles: undefined } as Partial<LayerSpec>)
                    }
                    caption={mediaNote(layer, film)}
                  >
                    {film && <ClipFrame clip={film} cycles={layer.clipCycles ?? 1} />}
                  </Thumb>
                ) : (
                  <Dropzone
                    onFile={(f) => pickMedia(f)}
                    hint="Click to upload a picture, a film or a GIF"
                    accept="image/*,video/*"
                  />
                )}
                {layer.src && (
                  <>
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
                    {film && (
                      <Slider
                        label="times through"
                        value={layer.clipCycles ?? 1}
                        min={1}
                        max={6}
                        step={1}
                        suffix="×"
                        onChange={(clipCycles) =>
                          patchLayer({
                            clipCycles: clipCycles === 1 ? undefined : clipCycles,
                          } as Partial<LayerSpec>)
                        }
                        help="Whole trips through the film over one loop — whole numbers only, which is what stops it opening a seam"
                      />
                    )}
                    <Buttons>
                      <Btn onClick={() => setPickMore((n) => n + 1)} wide>
                        Choose another
                      </Btn>
                    </Buttons>
                    {pickMore > 0 && (
                      <Dropzone
                        onFile={(f) => {
                          setPickMore(0);
                          pickMedia(f);
                        }}
                        hint="Click to upload a picture, a film or a GIF"
                        accept="image/*,video/*"
                      />
                    )}
                  </>
                )}
              </Block>
              <Block title="the ruling" open={(slide.grid ?? 0) >= 2}>
                <p className="text-[11px] text-[color:var(--tc-ink-3)] leading-relaxed">
                  The hairline grid the club&apos;s sheets are drawn on: square
                  cells, cut equally top and bottom.
                </p>
                <Slider
                  label="columns"
                  value={slide.grid ?? 0}
                  min={0}
                  max={16}
                  step={1}
                  display={(slide.grid ?? 0) < 2 ? "off" : undefined}
                  onChange={(grid) => patchSlide({ grid: grid < 2 ? undefined : grid })}
                />
                {(slide.grid ?? 0) >= 2 && (
                  <>
                    <Slider
                      label="presence"
                      value={slide.gridAlpha ?? 0.16}
                      min={0.04}
                      max={0.6}
                      step={0.02}
                      onChange={(gridAlpha) => patchSlide({ gridAlpha })}
                    />
                    <Toggle
                      label="over the type"
                      on={!!slide.gridTop}
                      onChange={() =>
                        patchSlide({ gridTop: slide.gridTop ? undefined : true })
                      }
                      help="The sheet's lines cross the words — a technical drawing rather than a caption"
                    />
                  </>
                )}
              </Block>
            </Section>

            <Section title="type" summary={plainTitle(slide.title).slice(0, 24)}>
              <Cols>
                <Stack label="kicker">
                  <Text
                    value={slide.kicker}
                    placeholder="top left"
                    onChange={(kicker) => patchSlide({ kicker })}
                  />
                </Stack>
                <Stack label="oval">
                  <Text
                    value={slide.tag ?? ""}
                    placeholder="08/26"
                    onChange={(tag) => patchSlide({ tag: tag || undefined })}
                  />
                </Stack>
              </Cols>
              <Stack label="headline">
                <Text
                  value={slide.title}
                  rows={3}
                  placeholder="*a run in asterisks* flips to the other voice"
                  onChange={(title) => patchSlide({ title })}
                />
              </Stack>
              <Stack label="under it">
                <Text
                  value={slide.body}
                  rows={2}
                  placeholder="a supporting sentence"
                  onChange={(body) => patchSlide({ body })}
                />
              </Stack>
              <Cols>
                <Stack label="note">
                  <Text
                    value={slide.note ?? ""}
                    placeholder="top right"
                    onChange={(note) => patchSlide({ note: note || undefined })}
                  />
                </Stack>
                <Stack label="footer">
                  <Text
                    value={slide.footer}
                    placeholder="bottom left"
                    onChange={(footer) => patchSlide({ footer })}
                  />
                </Stack>
              </Cols>
              <p className="text-[11px] text-[color:var(--tc-ink-3)] leading-relaxed">
                {slide.note
                  ? "The note has the top-right corner, so the circled mark stands down while it's there."
                  : "Wrap a run in *asterisks* to flip it to the other voice — italic in a roman headline, roman in an italic one."}
              </p>
              <Block
                title={`setting — ${slide.titleFont} · ${slide.titleSize} · ${slide.align}`}
                open={false}
              >
                <Cols>
                  <Stack label="typeface">
                    <Select
                      value={slide.titleFont}
                      options={[
                        { value: "serif", label: "serif — Lora" },
                        { value: "sans", label: "sans — Archivo" },
                        { value: "gothic", label: "gothic — Pirata" },
                      ]}
                      onChange={(titleFont) =>
                        patchSlide({ titleFont: titleFont as SlideSpec["titleFont"] })
                      }
                    />
                  </Stack>
                  <Stack label="the letter">
                    <Text
                      value={slide.letter}
                      placeholder="M"
                      onChange={(letter) => patchSlide({ letter: letter.slice(0, 1) })}
                    />
                  </Stack>
                </Cols>
                <Stack label="size">
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
                </Stack>
                <Slider
                  label="weight"
                  value={slide.titleWeight ?? defaultWeight}
                  min={100}
                  max={900}
                  step={100}
                  onChange={(titleWeight) => patchSlide({ titleWeight })}
                />
                <Slider
                  label="margin"
                  value={slide.margin ?? 96}
                  min={24}
                  max={240}
                  step={4}
                  onChange={(margin) => patchSlide({ margin })}
                  help="The frame's breathing room, in design units at 1080 wide"
                />
                <Stack label="align">
                  <Segmented
                    value={slide.align}
                    options={[
                      { value: "left" as const, label: "left" },
                      { value: "center" as const, label: "center" },
                    ]}
                    onChange={(align) => patchSlide({ align })}
                  />
                </Stack>
                <Stack label="anchor">
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
                </Stack>
                <Cols>
                  <Toggle
                    label="italic"
                    on={slide.italic}
                    onChange={() => patchSlide({ italic: !slide.italic })}
                  />
                  <Toggle
                    label="boxed"
                    on={slide.boxed}
                    onChange={() => patchSlide({ boxed: !slide.boxed })}
                  />
                  <Toggle
                    label="plate"
                    on={slide.plate}
                    onChange={() => patchSlide({ plate: !slide.plate })}
                  />
                  <Toggle
                    label="orbit ring"
                    on={slide.ring}
                    onChange={() => patchSlide({ ring: !slide.ring })}
                  />
                  <Toggle
                    label="all type"
                    on={slide.text}
                    onChange={() => patchSlide({ text: !slide.text })}
                    help="Off leaves the sheet and its marks alone — a slide with no words at all"
                  />
                </Cols>
              </Block>
              <Block
                title={`on the slide — ${parts.length} of ${SLIDE_PARTS.length}`}
                open={false}
              >
                <p className="text-[11px] text-[color:var(--tc-ink-3)] leading-relaxed">
                  Switching a part off keeps its words, so switching it back on
                  brings them with it.
                </p>
                <Cols>
                  {SLIDE_PARTS.map((part) => (
                    <Toggle
                      key={part}
                      label={part}
                      on={partOn(slide, part)}
                      onChange={() => togglePart(part)}
                    />
                  ))}
                </Cols>
                <Row label="the mark">
                  <Select
                    value={slide.mark ?? "auto"}
                    options={[
                      { value: "auto", label: "auto — page on a carousel" },
                      { value: "letter", label: "the letter" },
                      { value: "page", label: "the page number" },
                      { value: "none", label: "nothing" },
                    ]}
                    onChange={(mark) => patchSlide({ mark: mark as SlideSpec["mark"] })}
                  />
                </Row>
              </Block>
              <Block
                title={`the counter — ${
                  slide.count ? `${slide.count.from} → ${slide.count.to}` : "off"
                }`}
                open={!!slide.count}
              >
                <p className="text-[11px] text-[color:var(--tc-ink-3)] leading-relaxed">
                  A number that counts over the loop. Write # wherever it should
                  appear — “#” with “days to go” under it is a countdown.
                </p>
                <Toggle
                  label="counting"
                  on={!!slide.count}
                  onChange={() =>
                    patchSlide({ count: slide.count ? undefined : { from: 12, to: 0, pad: 2 } })
                  }
                />
                {slide.count && (
                  <>
                    <Slider
                      label="from"
                      value={slide.count.from}
                      min={0}
                      max={999}
                      step={1}
                      onChange={(from) => patchSlide({ count: { ...slide.count!, from } })}
                    />
                    <Slider
                      label="to"
                      value={slide.count.to}
                      min={0}
                      max={999}
                      step={1}
                      onChange={(to) => patchSlide({ count: { ...slide.count!, to } })}
                    />
                    <Slider
                      label="digits"
                      value={slide.count.pad ?? 0}
                      min={0}
                      max={4}
                      step={1}
                      display={slide.count.pad ? undefined : "as written"}
                      onChange={(pad) =>
                        patchSlide({ count: { ...slide.count!, pad: pad || undefined } })
                      }
                      help="Padding holds the same room for every value, so the headline doesn't breathe as a digit drops"
                    />
                    <p className="text-[11px] text-[color:var(--tc-ink-3)] leading-relaxed">
                      {Math.abs(slide.count.to - slide.count.from) + 1} values over{" "}
                      {spec.duration}s.
                    </p>
                  </>
                )}
              </Block>
              <Block
                title={`the club's screen — ${
                  slide.titlePixel || slide.metaPixel ? "on" : "off"
                }`}
                open={false}
              >
                <p className="text-[11px] text-[color:var(--tc-ink-3)] leading-relaxed">
                  Every glyph thresholded into hard ink-or-nothing blocks at
                  this cell size.
                </p>
                <Slider
                  label="headline"
                  value={slide.titlePixel}
                  min={0}
                  max={24}
                  step={1}
                  suffix="px"
                  display={slide.titlePixel ? undefined : "off"}
                  onChange={(titlePixel) => patchSlide({ titlePixel })}
                />
                <Slider
                  label="everything else"
                  value={slide.metaPixel}
                  min={0}
                  max={24}
                  step={1}
                  suffix="px"
                  display={slide.metaPixel ? undefined : "off"}
                  onChange={(metaPixel) => patchSlide({ metaPixel })}
                />
              </Block>
            </Section>

            <Section
              title="marks"
              summary={shapes.length ? shapes.map((s) => s.kind).join(" · ") : "none"}
              open={shapes.length > 0}
              note="The club's motifs as objects, over the words or under them. Each one arrives with a loop already plugged in."
            >
              {shapes.map((shape, i) => {
                const repeat = Math.round(shape.repeat ?? 1);
                const named = shapeLoopOf(shape);
                const deformed =
                  repeat > 1 ||
                  SHAPE_DEFORMERS.some(
                    (c) =>
                      (shape as unknown as Record<string, number | undefined>)[c.key] !==
                      undefined,
                  );
                return (
                  <Block
                    key={i}
                    title={`${shape.kind}${repeat > 1 ? ` ×${repeat}` : ""}${
                      shape.under ? " · under" : ""
                    }`}
                    onUp={i > 0 ? () => moveShape(i, -1) : undefined}
                    onDown={i < shapes.length - 1 ? () => moveShape(i, 1) : undefined}
                    onRemove={() => removeShape(i)}
                    open={i === shapes.length - 1}
                  >
                    <Cols>
                      <Stack label="mark">
                        <Select
                          value={shape.kind}
                          options={SHAPE_KINDS.map((k) => ({ value: k, label: k }))}
                          onChange={(kind) => patchShape(i, { kind: kind as ShapeKind })}
                        />
                      </Stack>
                      <Stack label="loop">
                        <Select
                          value={named}
                          options={[
                            { value: "", label: "still" },
                            ...SHAPE_LOOPS.map((l) => ({ value: l.id, label: l.name })),
                            ...(named === "custom"
                              ? [{ value: "custom", label: "custom" }]
                              : []),
                          ]}
                          onChange={(id) => {
                            if (!id) return patchShape(i, { motion: undefined });
                            const l = shapeLoopDef(id);
                            if (l) patchShape(i, { motion: l.motion(shape) });
                          }}
                        />
                      </Stack>
                    </Cols>
                    <XYPad
                      x={shape.x}
                      y={shape.y}
                      onChange={(x, y) => patchShape(i, { x, y })}
                    />
                    {SHAPE_CONTROLS.filter((c) => c.key !== "x" && c.key !== "y").map((c) => (
                      <LoopRow
                        key={c.key}
                        control={c}
                        value={Number(
                          (shape as unknown as Record<string, number>)[c.key] ?? c.def,
                        )}
                        motion={shape.motion?.[c.key]}
                        canMove
                        detail={named === "" || named === "custom"}
                        onChange={(v) => patchShape(i, { [c.key]: v } as Partial<ShapeSpec>)}
                        onMotion={(m) => setShapeMotion(i, c.key, m)}
                      />
                    ))}
                    <Stack label="ink">
                      <Dots
                        colors={slide.palette ?? PALETTE}
                        value={shape.ink ?? ""}
                        options={[{ value: "", label: "theme" }]}
                        onChange={(v) => patchShape(i, { ink: v || undefined })}
                      />
                    </Stack>
                    <Toggle
                      label="under the words"
                      on={!!shape.under}
                      onChange={() =>
                        patchShape(i, { under: shape.under ? undefined : true })
                      }
                    />
                    <Block title="deformers" open={deformed}>
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
                              along:
                                along === "x" ? undefined : (along as ShapeSpec["along"]),
                            })
                          }
                        />
                      </Row>
                      {SHAPE_DEFORMERS.map((c) => (
                        <LoopRow
                          key={c.key}
                          control={c}
                          value={Number(
                            (shape as unknown as Record<string, number>)[c.key] ?? c.def,
                          )}
                          motion={shape.motion?.[c.key]}
                          canMove
                          detail={named === "" || named === "custom"}
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
                          onClick={() => patchShape(i, { seed: rollSeed() })}
                          title="The scatter is fixed, so it never crawls — this rolls a different one"
                        >
                          Rescatter
                        </Btn>
                      )}
                    </Block>
                  </Block>
                );
              })}
              <Stack label={`add a mark — ${shapes.length}/${MAX_SHAPES}`}>
                <div className="flex flex-wrap gap-1">
                  {SHAPE_KINDS.map((k) => (
                    <Btn
                      key={k}
                      onClick={() => addShape(k)}
                      disabled={shapes.length >= MAX_SHAPES}
                      title={`Add a ${k} — it arrives moving`}
                    >
                      + {k}
                    </Btn>
                  ))}
                </div>
              </Stack>
            </Section>

            <Section
              title="effect"
              summary={`${layerName(layer)}${
                (layer.filters ?? []).length ? ` → ${(layer.filters ?? []).length}` : ""
              }`}
            >
              {/* Which layer this group is editing. Picking one, hiding one,
                  soloing one and reordering them all live in the layers panel
                  now — the stack is a place, not a dropdown. */}
              {slide.layers.length > 1 && (
                <p className="text-[11px] text-[color:var(--tc-ink-3)] leading-relaxed">
                  Editing layer {String(layerIndex + 1).padStart(2, "0")} of{" "}
                  {slide.layers.length}. Pick another in the layers panel.
                </p>
              )}
              <Stack label="draws">
                <Select
                  value={layer.type}
                  options={SHADERS.map((s) => ({
                    value: s.type,
                    label: s.label,
                    group: FAMILY_NAMES[s.family ?? "pixelated"],
                  }))}
                  onChange={(t) => setShaderType(t as ShaderType)}
                />
              </Stack>
              <Cols>
                <Stack label="blend">
                  <Select
                    value={layer.blend}
                    options={BLENDS.map((b) => ({ value: b, label: b }))}
                    onChange={(blend) => patchLayer({ blend: blend as LayerSpec["blend"] })}
                  />
                </Stack>
                <Stack label="…">
                  <Buttons>
                    <Btn onClick={randomizeLayer} wide title="A new form, same place">
                      Roll
                    </Btn>
                    <Btn
                      onClick={addLayer}
                      disabled={slide.layers.length >= MAX_LAYERS}
                      title="Add a layer, already moving"
                    >
                      +
                    </Btn>
                  </Buttons>
                </Stack>
              </Cols>
              <Slider
                label="opacity"
                value={layer.opacity}
                min={0.05}
                max={1}
                step={0.05}
                onChange={(opacity) => patchLayer({ opacity })}
              />
              {(def.choices ?? [])
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
              {def.controls
                .filter((c) => c.key !== "exposure" || wantsPhoto)
                .map((c) => (
                  <LoopRow
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
                <p className="text-[11px] text-[color:var(--tc-ink-3)] leading-relaxed">
                  Nothing to set: this layer draws nothing at all, which is what a sheet
                  wants behind its words.
                </p>
              )}
              <Block
                title={`filters — ${
                  (layer.filters ?? []).length
                    ? (layer.filters ?? [])
                        .map((f) => (f.mute ? `(${f.type})` : String(f.type)))
                        .join(" → ")
                    : "none"
                }`}
                open={(layer.filters ?? []).length > 0}
              >
                <p className="text-[11px] text-[color:var(--tc-ink-3)] leading-relaxed">
                  What happens to this layer after it&apos;s drawn, top to bottom.
                  Each one arrives with a number already travelling.
                </p>
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
                      onDown={
                        i < (layer.filters ?? []).length - 1
                          ? () => moveFilter(i, 1)
                          : undefined
                      }
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
                        <LoopRow
                          key={c.key}
                          control={c}
                          value={Number(f[c.key] ?? c.def)}
                          motion={f.motion?.[c.key]}
                          canMove
                          onChange={(v) => patchFilter(i, { [c.key]: v })}
                          onMotion={(m) => setFilterMotion(i, c.key, m)}
                        />
                      ))}
                      <p className="text-[11px] text-[color:var(--tc-ink-3)] leading-relaxed">{fd.hint}</p>
                    </Block>
                  );
                })}
                <Stack label="add an effect">
                  <div className="flex flex-wrap gap-1">
                    {FILTERS.filter(
                      (f) => !(layer.filters ?? []).some((x) => x.type === f.type),
                    ).map((f) => (
                      <Btn key={f.type} onClick={() => addFilter(f.type)} title={f.hint}>
                        + {f.label}
                      </Btn>
                    ))}
                  </div>
                </Stack>
              </Block>
              <Block title="where it sits" open={false}>
                <XYPad
                  label="Offset"
                  x={layer.offsetX}
                  y={layer.offsetY}
                  onChange={(offsetX, offsetY) => patchLayer({ offsetX, offsetY })}
                />
                {animatable(layer.type)
                  .filter(
                    (c) =>
                      !def.controls.some((d) => d.key === c.key) &&
                      c.key !== "offsetX" &&
                      c.key !== "offsetY",
                  )
                  .map((c) => (
                    <LoopRow
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
                <p className="text-[11px] text-[color:var(--tc-ink-3)] leading-relaxed">
                  {canMove
                    ? "Drag the post to move this layer, scroll to scale, shift-drag to turn. The ○ beside a number plugs a loop into it."
                    : "Travelling numbers are a dithered-forms thing: the WebGL shader takes its numbers once, not every frame."}
                </p>
              </Block>
            </Section>

            <Section
              title="colour"
              summary={
                layer.ink === "mix"
                  ? `mix of ${mixInks.length}`
                  : typeof layer.ink === "string"
                    ? String(layer.ink)
                    : slide.palette
                      ? `${slide.palette.length} by hand`
                      : "the theme"
              }
            >
              <Stack label="ink">
                <Dots
                  colors={slide.palette ?? PALETTE}
                  value={typeof layer.ink === "string" ? layer.ink : ""}
                  options={[
                    { value: "", label: "theme" },
                    ...(layer.type === "forms" ? [{ value: "mix", label: "mix" }] : []),
                  ]}
                  onChange={(v) =>
                    patchLayer({ ink: v === "" ? undefined : v } as Partial<LayerSpec>)
                  }
                />
              </Stack>
              {layer.ink === "mix" && (
                <div className={`border-l ${HAIR} pl-2 ml-1 space-y-2`}>
                  <Stack label={`which of them — ${mixInks.length}`}>
                    <div className="flex items-center gap-1 flex-wrap">
                      {(slide.palette ?? PALETTE).map((hex) => {
                        const on = mixInks.includes(hex);
                        return (
                          <button
                            key={hex}
                            onClick={() => toggleMixInk(hex)}
                            title={`${hex} — ${on ? "click to drop" : "click to use"}`}
                            style={{ background: hex }}
                            className={`size-6 rounded-full border transition-all ${
                              on
                                ? "border-[color:var(--tc-sel)] scale-110"
                                : `${HAIR} opacity-25 hover:opacity-60`
                            }`}
                          />
                        );
                      })}
                    </div>
                  </Stack>
                  <Row label="spread">
                    <Select
                      value={layer.mixMode ?? "blocks"}
                      options={MIX_MODES.map((m) => ({ value: m, label: MIX_MODE_HINTS[m] }))}
                      onChange={(mixMode) =>
                        patchLayer({ mixMode } as unknown as Partial<LayerSpec>)
                      }
                    />
                  </Row>
                  <Slider
                    label="patch"
                    value={layer.mixScale ?? 3}
                    min={1}
                    max={12}
                    step={1}
                    onChange={(mixScale) => patchLayer({ mixScale } as Partial<LayerSpec>)}
                  />
                  <Slider
                    label="drift"
                    value={layer.mixSpeed ?? 1}
                    min={0}
                    max={3}
                    step={0.1}
                    display={(layer.mixSpeed ?? 1) === 0 ? "still" : undefined}
                    onChange={(mixSpeed) => patchLayer({ mixSpeed } as Partial<LayerSpec>)}
                  />
                  <Btn onClick={() => patchSlide({ colorSeed: rollSeed() })}>
                    Rearrange the colours
                  </Btn>
                </div>
              )}
              <Block
                title={`the palette — ${
                  slide.palette ? `${slide.palette.length} by hand` : "the club's"
                }`}
                open={false}
              >
                {/* The colours as a two-column list of rows rather than a row of
                    dots: a palette you edit wants its hexes visible, and this is
                    the kit's own colour row doing it. */}
                <Cols>
                  {(slide.palette ?? PALETTE).map((hex, i) => (
                    <ColorRow
                      key={i}
                      label={String(i + 1).padStart(2, "0")}
                      value={hex}
                      onChange={(next) => {
                        const list = [...(slide.palette ?? PALETTE)];
                        list[i] = next;
                        patchSlide({ palette: list });
                      }}
                      onRemove={
                        (slide.palette ?? PALETTE).length > 2
                          ? () =>
                              patchSlide({
                                palette: (slide.palette ?? [...PALETTE]).filter(
                                  (_, j) => j !== i,
                                ),
                              })
                          : undefined
                      }
                    />
                  ))}
                </Cols>
                <Buttons>
                  <Btn
                    onClick={() => {
                      const cur = slide.palette ?? [...PALETTE];
                      patchSlide({ palette: [...cur, PALETTE[cur.length % PALETTE.length]] });
                    }}
                    wide
                  >
                    + a colour
                  </Btn>
                  {slide.palette && (
                    <Btn onClick={() => patchSlide({ palette: undefined })} wide>
                      Back to the club&apos;s
                    </Btn>
                  )}
                </Buttons>
                <p className="text-[11px] text-[color:var(--tc-ink-3)] leading-relaxed">
                  {slide.palette
                    ? "This post no longer follows the club palette."
                    : "The club palette. Change it in one place and every post that hasn't been hand-coloured follows."}
                </p>
              </Block>
            </Section>
          </Panel>
        </div>

        {/* Left: one panel, docked — the layers stack, then recipes to pick
            a whole look from. Layers was a dropdown inside the effect group
            once, which is the one place a stack can't live: you cannot see
            the order of a thing you have to open a menu to read. */}
        <div className="md:absolute md:top-0 md:left-0 md:bottom-0 z-20 flex p-2 md:p-0">
          <Panel
            dock="left"
            title="looks"
            width={288}
            right={
              <button
                onClick={() => roll(12)}
                title="Twelve looks from nothing — every family that closes its loop"
                className="text-[11px] text-[color:var(--tc-ink-3)] hover:text-[color:var(--tc-ink)] transition-colors pr-1"
              >
                ⚄ roll
              </button>
            }
          >
            <Section title="layers" summary={`${slide.layers.length}/${MAX_LAYERS}`}>
              <div className="space-y-1">
                {/* Front of the post at the top, the way a stack is drawn
                    everywhere: the last layer is the one over the others. */}
                {slide.layers
                  .map((l, i) => ({ l, i }))
                  .reverse()
                  .map(({ l, i }) => (
                    <ListRow
                      key={i}
                      name={`${String(i + 1).padStart(2, "0")} · ${layerName(l)}`}
                      meta={`${l.blend}${l.opacity < 1 ? ` · ${Math.round(l.opacity * 100)}%` : ""}${
                        l.motion ? ` · ${Object.keys(l.motion).join(", ")} ↻` : " · still"
                      }`}
                      selected={i === layerIndex}
                      on={!l.mute}
                      onSelect={() => setActiveLayer(i)}
                      onToggle={() =>
                        patchLayerAt(i, { mute: l.mute ? undefined : true } as Partial<LayerSpec>)
                      }
                      right={
                        <>
                          <IconBtn
                            onClick={() => setSolo(solo === i ? null : i)}
                            title="Show this layer on its own"
                            on={solo === i}
                            bare
                            small
                          >
                            ◆
                          </IconBtn>
                          <IconBtn
                            onClick={() => moveLayerAt(i, 1)}
                            title="Bring forward"
                            disabled={i >= slide.layers.length - 1}
                            bare
                            small
                          >
                            ↑
                          </IconBtn>
                          <IconBtn
                            onClick={() => moveLayerAt(i, -1)}
                            title="Send back"
                            disabled={i <= 0}
                            bare
                            small
                          >
                            ↓
                          </IconBtn>
                          <IconBtn
                            onClick={() => removeLayerAt(i)}
                            title="Delete this layer"
                            disabled={slide.layers.length <= 1}
                            bare
                            small
                          >
                            ×
                          </IconBtn>
                        </>
                      }
                    >
                      {/* What the layer actually draws, on its own — the
                          fastest way to know which one you're looking at. */}
                      <span className="size-8 shrink-0 overflow-hidden rounded-[var(--tc-r-sm)] border border-[color:var(--tc-edge)]">
                        <Poster
                          spec={{
                            ...spec,
                            slides: [{ ...slide, layers: [l], text: false, veil: 0 }],
                          }}
                          index={0}
                          fonts={null}
                          width={32}
                          live
                        />
                      </span>
                    </ListRow>
                  ))}
              </div>
              <Buttons>
                <Btn
                  onClick={addLayer}
                  disabled={slide.layers.length >= MAX_LAYERS}
                  title="A new layer, already moving"
                  wide
                >
                  + layer
                </Btn>
                <Btn
                  onClick={randomizeSlide}
                  title="Re-roll this post's own layers, keeping its words"
                  wide
                >
                  Re-roll
                </Btn>
              </Buttons>
            </Section>
            <Section
              title="recipes"
              summary={`${PRESETS.length}`}
              note="A whole post, ready to have its words replaced."
            >
              <Rail cols={2}>
                {PRESETS.map((p, i) => (
                  <RailItem key={p.name} label={p.name} title={p.about} onClick={() => loadPreset(i)}>
                    <Poster
                      spec={normalizeSpec(structuredClone(p.spec))}
                      index={0}
                      fonts={fonts}
                      width={120}
                      live
                    />
                  </RailItem>
                ))}
              </Rail>
            </Section>
          </Panel>
        </div>

        {/* Bottom left: the slides, as pictures. */}
        {strip && spec.slides.length > 0 && (
          <div className="md:absolute md:left-[300px] md:bottom-3 z-20 p-2 md:p-0 max-w-full">
            <div
              className="tc-float rounded-[var(--tc-r-lg)] p-2 flex items-end gap-2 overflow-x-auto"
            >
              {spec.slides.map((sl, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  title={plainTitle(sl.title) || sl.kicker || "—"}
                  className={`shrink-0 border transition-colors ${
                    i === activeIndex
                      ? "border-[color:var(--tc-sel)]"
                      : "border-[color:var(--tc-edge)] hover:border-[color:var(--tc-edge-on)]"
                  }`}
                >
                  <Poster spec={spec} index={i} fonts={fonts} width={64} live />
                </button>
              ))}
              <IconBtn onClick={addSlide} title="Duplicate this slide">
                +
              </IconBtn>
            </div>
          </div>
        )}

        {/* Bottom, centred over the canvas span between the two docks. */}
        <div className="md:absolute md:bottom-3 md:left-[288px] md:right-[320px] z-20 p-2 md:p-0 flex flex-col items-center gap-2">
          {(flash || job) && (
            <span className="tc-float rounded-[var(--tc-r)] h-8 px-3 flex items-center text-[12.5px] tabular-nums whitespace-nowrap">
              {job ? `${job.label} — ${Math.round(job.frac * 100)}%` : flash}
            </span>
          )}
          <Toolbar>
            <IconBtn onClick={undo} title="Undo (⌘Z)" disabled={!past.length} bare>
              ↺
            </IconBtn>
            <IconBtn onClick={redo} title="Redo (⇧⌘Z)" disabled={!future.length} bare>
              ↻
            </IconBtn>
            <Sep />
            <IconBtn
              onClick={() => setZoom((z) => Math.max(0.25, z / 1.15))}
              title="Zoom out (−)"
              bare
            >
              −
            </IconBtn>
            <button
              onClick={() => setZoom(1)}
              title="Zoom to fit (0)"
              className="px-1 tabular-nums text-[12.5px] text-[color:var(--tc-ink-2)] hover:text-[color:var(--tc-ink)] min-w-[48px]"
            >
              {percent}%
            </button>
            <IconBtn
              onClick={() => setZoom((z) => Math.min(4, z * 1.15))}
              title="Zoom in (+)"
              bare
            >
              +
            </IconBtn>
            <Sep />
            <IconBtn
              onClick={() => {
                setPlaying(false);
                clock.set(0);
              }}
              title="Back to the top of the loop (Home)"
              bare
            >
              ⏮
            </IconBtn>
            <IconBtn onClick={() => setPlaying(!playing)} title="Play / pause (space)" bare>
              {playing ? "❙❙" : "▶"}
            </IconBtn>
            <Sep />
            <IconBtn onClick={() => setGuides((g) => !g)} title="Margin guides (g)" on={guides} bare>
              ⊹
            </IconBtn>
            <IconBtn
              onClick={() => setTracks((t) => !t)}
              title="The loop, in tracks"
              on={tracks}
              bare
            >
              ⏱
            </IconBtn>
          </Toolbar>
        </div>

        {/* The loop, when you ask for it. */}
        {tracks && (
          <div className="md:absolute md:bottom-[68px] md:left-[288px] md:right-[320px] z-20 p-2 md:p-0">
            <div className="tc-float rounded-[var(--tc-r-lg)] overflow-hidden">
              <Tracks
                slide={slide}
                duration={spec.duration}
                layerIndex={layerIndex}
                playing={playing}
                onPlay={setPlaying}
                onSelectLayer={setActiveLayer}
              />
            </div>
          </div>
        )}

        {/* Over the stage, when something needs the room. Recipes live in
            the left dock now, always in view, not summoned here. */}
        {drawer === "generate" && (
          <Drawer
            title="rolled from nothing — click one to put it on this slide"
            onClose={() => setDrawer(null)}
            right={<Btn onClick={() => roll(12)}>Roll again</Btn>}
          >
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {sheet.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    pickCandidate(s);
                    setDrawer(null);
                  }}
                  title="Use this one"
                  className={"block rounded-[var(--tc-r)] border border-[color:var(--tc-edge)] hover:border-[color:var(--tc-edge-on)] transition-colors overflow-hidden"}
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
                    width={170}
                    live
                  />
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted leading-relaxed pt-3 max-w-xl">
              Two families, and they are the two that close their loop: one to three
              dithered layers with every form, mix, fold, screen and colour in play and at
              least one number travelling, or a single scene from the Kinetics set on this
              slide&apos;s own headline. The WebGL dithering and the clean shaders are left
              out on purpose — they animate, but they don&apos;t come back to where they
              started, and a rolled look with a seam in it is worse than a shorter list.
              A roll decides the graphic and leaves the veil and the type where you left
              them; the one exception is a Kinetics roll, which switches the headline off
              because it is already drawing it.
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
              <Buttons>
                <Btn onClick={importSpec} on>
                  Load it
                </Btn>
                <a
                  href="/api/postlab/schema"
                  target="_blank"
                  className="tc-field h-[var(--tc-h)] px-3 text-[12.5px] inline-flex items-center"
                >
                  the spec schema →
                </a>
              </Buttons>
              <p className="text-[11px] text-[color:var(--tc-ink-3)] leading-relaxed">
                A post is a spec, and a spec is text: anything that can write JSON can hand you
                a finished post.
              </p>
            </div>
          </Drawer>
        )}
      </div>
    </div>
  );
}
