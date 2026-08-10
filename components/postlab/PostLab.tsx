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
  MIX_MODES,
  PALETTE,
  PRESETS,
  SHADERS,
  SPEC_VERSION,
  WAVES,
  animatable,
  applyStyle,
  decodeSpec,
  defaultLayer,
  defaultSlide,
  defaultSpec,
  loopReport,
  randomShader,
  randomSlide,
  encodeSpec,
  normalizeSpec,
  shaderDef,
  slideTones,
  specFromQuery,
  styleOf,
  usesPhoto,
  varyStyle,
  type LayerSpec,
  type Motion,
  type PostFormat,
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
  paintSlide,
  recordGif,
  recordVideo,
} from "./exporter";
import { loadSlidePhotos, photoUrl, readFile, savePhoto } from "./photos";

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

/* A colour choice made by pointing at it. `value` is a hex, or one of the
   named options ("" for the theme's own, "mix" for the whole palette). */
function Swatches({
  palette,
  value,
  options,
  onChange,
}: {
  palette: readonly string[];
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`h-7 px-2 border text-xs transition-colors ${
            value === o.value
              ? "border-foreground bg-foreground text-background"
              : "border-line text-muted hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
      {palette.map((hex) => (
        <button
          key={hex}
          onClick={() => onChange(hex)}
          title={hex}
          style={{ background: hex }}
          className={`size-7 border transition-transform ${
            value === hex
              ? "border-foreground scale-110"
              : "border-line hover:scale-110"
          }`}
        />
      ))}
    </div>
  );
}

/* One generated candidate, drawn for real: the same renderer, the same
   spec, just small. Rendered at half size and shown smaller still, so the
   dither cells land where they will in the finished post rather than
   turning to mush at thumbnail scale. */
function Candidate({
  style,
  format,
  duration,
  onPick,
}: {
  style: SlideStyle;
  format: PostFormat;
  duration: number;
  onPick: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const w = Math.round(FORMATS[format].w / 2);
  const h = Math.round(FORMATS[format].h / 2);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const slide = { ...defaultSlide(), ...style, text: false } as SlideSpec;
    const spec: PostSpec = { v: SPEC_VERSION, format, duration, slides: [slide] };
    /* One frame, a third of the way in — far enough that a travelling
       parameter has gone somewhere. */
    paintSlide(ctx, spec, 0, w, h, duration / 3);
  }, [style, format, duration, w, h]);

  return (
    <button
      onClick={onPick}
      title="Use this one"
      className="block w-full border border-line hover:border-foreground transition-colors"
    >
      <canvas ref={ref} width={w} height={h} className="block w-full h-auto" />
    </button>
  );
}

/* One parameter: the number, and — on a layer the club renders itself — the
   option of making that number travel over the loop instead of holding
   still. The travelling is the whole reason a background stops looking like
   a pattern and starts looking like a piece of motion. */
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
  const fmt = (n: number) => n.toFixed(c.step < 1 ? 2 : 0);
  const slider = (v: number, set: (n: number) => void) => (
    <input
      type="range"
      min={c.min}
      max={c.max}
      step={c.step}
      value={v}
      onChange={(e) => set(Number(e.target.value))}
      className="flex-1 accent-foreground"
    />
  );
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted shrink-0 w-20">{c.label}</span>
        {slider(value, onChange)}
        <span className="w-10 text-right text-xs text-muted">{fmt(value)}</span>
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
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted shrink-0 w-20">to</span>
            {slider(motion.to, (to) => onMotion({ ...motion, to }))}
            <span className="w-10 text-right text-xs text-muted">
              {fmt(motion.to)}
            </span>
            <span className="w-4" />
          </div>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted shrink-0 w-20">wave</span>
            <select
              value={motion.wave ?? "sin"}
              onChange={(e) =>
                onMotion({ ...motion, wave: e.target.value as Wave })
              }
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
              onChange={(e) =>
                onMotion({ ...motion, cycles: Number(e.target.value) })
              }
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

const WAVE_HINTS: Record<Wave, string> = {
  sin: "sin — eases both ways",
  tri: "tri — straight there and back",
  saw: "saw — ramps, then snaps",
  square: "square — switches hard",
};

/* The select needs to say what each one looks like, not what it is called
   in the renderer. */
const MIX_MODE_HINTS: Record<string, string> = {
  blocks: "blocks — a mosaic of patches",
  bands: "bands — stripes sweeping down",
  radial: "radial — rings out of the centre",
  source: "source — colour follows the shape",
  noise: "noise — pixel by pixel, no grid",
};

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
  /* A look held aside to put on other slides. Not part of the spec: it's a
     clipboard, and it dies with the tab like one. */
  const [styleClip, setStyleClip] = useState<SlideStyle | null>(null);
  const [wiggle, setWiggle] = useState(0.25);
  /* A sheet of rolled looks to choose from. Also outside the spec: they're
     candidates, and only the one you pick becomes the post. */
  const [sheet, setSheet] = useState<SlideStyle[]>([]);
  /* An export setting, not a design one, so it stays out of the spec and
     out of shared links. */
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

  /* Give a parameter a wave, or take it away. An empty motion map is
     removed entirely so it never reaches a link. */
  const setMotion = (key: string, m: Motion | null) => {
    const motion = { ...(layer.motion ?? {}) };
    if (m) motion[key] = m;
    else delete motion[key];
    patchLayer({
      motion: Object.keys(motion).length ? motion : undefined,
    } as Partial<LayerSpec>);
  };

  /* The colours a mix layer is currently allowed to use. No `inks` on the
     layer means all of them, which is the normal case. */
  const mixInks = layer.inks?.length ? layer.inks : [...(slide.palette ?? PALETTE)];

  /* Dropping the last one would leave the layer with nothing to draw with,
     so the last colour standing can't be turned off. Turning them all back
     on clears the field instead of storing a copy of the palette, so the
     layer goes back to following it. */
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

  /* Reroll a layer's form: a new family, new shape and new parameters, but
     the same place in the stack, the same mixing and the same colour, so a
     randomised layer drops into a composition you've already built. Colour
     is a decision, not a roll — the dice never touch it. */
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

  /* ------------------------------------------------------------- styles */

  /* A style is this slide with the words taken out. Copying one and pasting
     it across a carousel is what makes six slides read as one piece; asking
     for variations is the same rules with room to move, which is how you
     get a family of posts instead of the same post twice. */
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

  /* A sheet of looks rolled from nothing. Picking one puts it on this
     slide and leaves the words where they are — the whole point is to
     choose a graphic rather than to build one, so nothing is committed
     until a thumbnail is clicked. */
  const roll = (n = 9) => setSheet(Array.from({ length: n }, () => randomSlide()));

  const pickCandidate = (style: SlideStyle) => {
    patchSlide(structuredClone(style));
    setActiveLayer(0);
    say("Applied");
  };

  /* New slides carrying this slide's words and a jittered version of its
     look, dropped in right after it so you can flip between them in the
     strip and keep the one that works. */
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
    eachSlide("GIF", (i, rep) =>
      recordGif(spec, i, layerCanvases(), fonts!, rep, scale),
    );

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
          <Link href="/desk" className="underline underline-offset-4">
            the Desk
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
                  background: slideTones(slide).bg,
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
            <Row label="weight">
              <input
                type="range"
                min={100}
                max={900}
                step={100}
                value={slide.titleWeight ?? defaultWeight}
                onChange={(e) =>
                  patchSlide({ titleWeight: Number(e.target.value) })
                }
                className="flex-1 accent-foreground"
              />
              <span className="w-10 text-right text-xs text-muted">
                {slide.titleWeight ?? defaultWeight}
              </span>
            </Row>
            <Row label="margin">
              <input
                type="range"
                min={24}
                max={240}
                step={4}
                value={slide.margin ?? 96}
                onChange={(e) => patchSlide({ margin: Number(e.target.value) })}
                className="flex-1 accent-foreground"
              />
              <span className="w-10 text-right text-xs text-muted">
                {slide.margin ?? 96}
              </span>
            </Row>
            {slide.titleSize === "fit" && (
              <p className="text-xs text-muted leading-relaxed">
                The headline grows until it fills the frame inside the margin.
                Short copy comes out enormous, long copy comes out smaller, and
                neither overflows. Line breaks are still yours to place.
              </p>
            )}
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
            <Row label="title px">
              <input
                type="range"
                min={0}
                max={24}
                step={1}
                value={slide.titlePixel}
                onChange={(e) => patchSlide({ titlePixel: Number(e.target.value) })}
                className="flex-1 accent-foreground"
              />
              <span className="w-8 text-right text-xs text-muted">
                {slide.titlePixel || "off"}
              </span>
            </Row>
            <Row label="meta px">
              <input
                type="range"
                min={0}
                max={24}
                step={1}
                value={slide.metaPixel}
                onChange={(e) => patchSlide({ metaPixel: Number(e.target.value) })}
                className="flex-1 accent-foreground"
              />
              <span className="w-8 text-right text-xs text-muted">
                {slide.metaPixel || "off"}
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

          <Section title="colour">
            <p className="text-xs text-muted">background</p>
            <Swatches
              palette={slide.palette ?? PALETTE}
              value={slide.background ?? ""}
              options={[{ value: "", label: "theme" }]}
              onChange={(v) =>
                patchSlide({ background: v === "" ? undefined : v })
              }
            />

            <p className="text-xs text-muted pt-2">the palette</p>
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
                  patchSlide({ palette: [...cur, PALETTE[cur.length % PALETTE.length]] });
                }}
                title="Add a colour"
                className="size-7 border border-line text-muted hover:text-foreground shrink-0"
              >
                +
              </button>
              {slide.palette && (
                <Button onClick={() => patchSlide({ palette: undefined })}>
                  Reset
                </Button>
              )}
            </div>
            <p className="text-xs text-muted leading-relaxed pt-1">
              {slide.palette
                ? `${slide.palette.length} custom colours — this post no longer follows the club palette.`
                : "The club palette. Change it in one place and every post that hasn't been hand-coloured follows."}{" "}
              Each layer picks its ink from here, below.
            </p>
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
            <div className="flex gap-2">
              <Button onClick={randomizeLayer} primary>
                Randomise this layer
              </Button>
              {slide.layers.length > 1 && (
                <Button onClick={randomizeSlide}>All {slide.layers.length}</Button>
              )}
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
            <div className="space-y-2">
              <p className="text-xs text-muted">ink</p>
              <Swatches
                palette={slide.palette ?? PALETTE}
                value={typeof layer.ink === "string" ? layer.ink : ""}
                options={[
                  { value: "", label: "theme" },
                  ...(layer.type === "forms"
                    ? [{ value: "mix", label: "mix" }]
                    : []),
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
                      <Button
                        onClick={() =>
                          patchLayer({ inks: undefined } as Partial<LayerSpec>)
                        }
                      >
                        All
                      </Button>
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
                  <Row label="patch">
                    <input
                      type="range"
                      min={1}
                      max={12}
                      step={1}
                      value={layer.mixScale ?? 3}
                      onChange={(e) =>
                        patchLayer({
                          mixScale: Number(e.target.value),
                        } as Partial<LayerSpec>)
                      }
                      className="flex-1 accent-foreground"
                    />
                    <span className="w-10 text-right text-xs text-muted">
                      {layer.mixScale ?? 3}
                    </span>
                  </Row>
                  <Row label="drift">
                    <input
                      type="range"
                      min={0}
                      max={3}
                      step={0.1}
                      value={layer.mixSpeed ?? 1}
                      onChange={(e) =>
                        patchLayer({
                          mixSpeed: Number(e.target.value),
                        } as Partial<LayerSpec>)
                      }
                      className="flex-1 accent-foreground"
                    />
                    <span className="w-10 text-right text-xs text-muted">
                      {(layer.mixSpeed ?? 1) === 0
                        ? "still"
                        : (layer.mixSpeed ?? 1).toFixed(1)}
                    </span>
                  </Row>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() =>
                        patchSlide({ colorSeed: Math.floor(Math.random() * 9999) + 1 })
                      }
                    >
                      Rearrange
                    </Button>
                    <span className="text-xs text-muted">
                      which colour starts where
                    </span>
                  </div>
                </div>
              )}
            </div>
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
                    <Button
                      onClick={() =>
                        patchLayer({ src: undefined } as Partial<LayerSpec>)
                      }
                    >
                      Remove
                    </Button>
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
            <p className="text-[10px] uppercase tracking-wide text-muted pt-1">
              transform
            </p>
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
            {canMove ? (
              <p className="text-xs text-muted leading-relaxed">
                The ○ next to a slider makes that number travel over the loop
                instead of holding still. Trips are whole numbers, so a
                travelling parameter always lands back where it started.
              </p>
            ) : (
              <p className="text-xs text-muted leading-relaxed">
                Travelling parameters are a dithered-forms thing: the WebGL
                shader takes its numbers once, not every frame.
              </p>
            )}
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

          <Section title="generate">
            <p className="text-xs text-muted leading-relaxed">
              Whole looks rolled from nothing: one to three layers, every
              form, mix, fold, screen and colour in play. Click one to put it
              on this slide; the words stay where they are.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => roll(9)} primary>
                {sheet.length ? "Roll again" : "Generate 9"}
              </Button>
              {sheet.length > 0 && (
                <Button onClick={() => setSheet([])}>Clear</Button>
              )}
            </div>
            {sheet.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {sheet.map((s, i) => (
                  <Candidate
                    key={i}
                    style={s}
                    format={spec.format}
                    duration={spec.duration}
                    onPick={() => pickCandidate(s)}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="style">
            <p className="text-xs text-muted leading-relaxed">
              A look without the words: theme, colour, type settings and the
              whole layer stack. Copy it once and every slide can wear it.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={copyStyle} primary>
                Copy this look
              </Button>
              <Button onClick={() => pasteStyle(false)} disabled={!styleClip}>
                Paste here
              </Button>
              {spec.slides.length > 1 && (
                <Button onClick={() => pasteStyle(true)} disabled={!styleClip}>
                  Paste on all {spec.slides.length}
                </Button>
              )}
            </div>
            <Row label="wiggle">
              <input
                type="range"
                min={0.05}
                max={0.6}
                step={0.05}
                value={wiggle}
                onChange={(e) => setWiggle(Number(e.target.value))}
                className="flex-1 accent-foreground"
              />
              <span className="w-10 text-right text-xs text-muted">
                {Math.round(wiggle * 100)}%
              </span>
            </Row>
            <div className="flex flex-wrap gap-2">
              {[3, 5, 9].map((n) => (
                <Button key={n} onClick={() => makeVariations(n)}>
                  {n} variations
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Variations keep every decision: the forms, how they mix, what
              inks them. Only the numbers move, by up to the wiggle. Same
              rules, different piece. They land next to this slide, so delete
              the ones that miss.
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
