"use client";

// the Post Lab — a small Toolcraft-style design tool for making the club's
// animated posts, carousels, and reels: a live preview on the left, a
// control panel on the right, shader backgrounds from Paper Shaders, and
// spec-in-URL sharing so Claude can generate posts from a prompt.

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  FORMATS,
  PRESETS,
  SHADERS,
  decodeSpec,
  defaultShader,
  defaultSpec,
  encodeSpec,
  normalizeSpec,
  shaderDef,
  type PostSpec,
  type ShaderType,
  type SlideSpec,
} from "@/lib/postlab";
import ShaderLayer from "./ShaderLayer";
import { drawOverlay, loadFonts, type Fonts } from "./overlay";
import { exportPng, recordVideo } from "./exporter";

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
  const [playing, setPlaying] = useState(true);
  const [fonts, setFonts] = useState<Fonts | null>(null);
  const [recording, setRecording] = useState(0); // 0 = idle, else fraction
  const [flash, setFlash] = useState("");
  const [importText, setImportText] = useState("");

  const stageRef = useRef<HTMLDivElement>(null);
  const shaderBoxRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 400, h: 500 });

  const { w, h } = FORMATS[spec.format];
  const slide = spec.slides[Math.min(active, spec.slides.length - 1)];
  const activeIndex = Math.min(active, spec.slides.length - 1);
  const def = shaderDef(slide.shader.type);

  /* Load fonts, then any spec passed in the URL (#spec=... or ?spec=...). */
  useEffect(() => {
    const fromHash = window.location.hash.match(/spec=([^&]+)/)?.[1];
    const fromQuery = new URLSearchParams(window.location.search).get("spec");
    const decoded = decodeSpec(fromHash ?? fromQuery ?? "");
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

  const patchShader = (patch: Record<string, number | string>) =>
    patchSlide({ shader: { ...slide.shader, ...patch } });

  const setShaderType = (type: ShaderType) =>
    patchSlide({ shader: defaultShader(type) });

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

  /* ------------------------------------------------------------ exports */

  const shaderCanvas = () =>
    shaderBoxRef.current?.querySelector("canvas") ?? null;

  const savePng = () => {
    if (!overlayRef.current) return;
    exportPng(spec, activeIndex, shaderCanvas(), overlayRef.current);
  };

  const saveAllPngs = async () => {
    if (!fonts) return;
    for (let i = 0; i < spec.slides.length; i++) {
      setActive(i);
      // give the shader a moment to remount and render the new slide
      await new Promise((r) => setTimeout(r, 500));
      const overlay = overlayRef.current;
      if (!overlay) continue;
      const ctx = overlay.getContext("2d");
      if (ctx) drawOverlay(ctx, spec, i, fonts, 0);
      exportPng(spec, i, shaderCanvas(), overlay);
    }
  };

  const saveVideo = async () => {
    if (!fonts || recording) return;
    setRecording(0.001);
    try {
      await recordVideo(spec, activeIndex, shaderCanvas(), fonts, setRecording);
      say("Video saved");
    } catch {
      say("Recording failed in this browser");
    } finally {
      setRecording(0);
    }
  };

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

  const shaderKey = useMemo(
    () => `${activeIndex}-${slide.shader.type}-${slide.theme}-${spec.format}`,
    [activeIndex, slide.shader.type, slide.theme, spec.format],
  );

  return (
    <div className="h-dvh flex flex-col">
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

      <div className="flex flex-1 min-h-0">
        {/* Stage */}
        <div className="flex-1 flex flex-col min-w-0">
          <div
            ref={stageRef}
            className="flex-1 flex items-center justify-center min-h-0"
          >
            <div
              ref={frameRef}
              className="relative border border-line overflow-hidden"
              style={{ width: stageSize.w, height: stageSize.h }}
            >
              <div ref={shaderBoxRef} className="absolute inset-0">
                <ShaderLayer
                  key={shaderKey}
                  shader={slide.shader}
                  theme={slide.theme}
                  playing={playing}
                />
              </div>
              <canvas
                ref={overlayRef}
                width={w}
                height={h}
                className="absolute inset-0 w-full h-full"
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
        <aside className="w-[340px] shrink-0 border-l border-line overflow-y-auto text-sm">
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

          <Section title="shader">
            <div className="grid grid-cols-2 gap-px bg-line border border-line">
              {SHADERS.map((s) => (
                <button
                  key={s.type}
                  onClick={() => setShaderType(s.type)}
                  className={`px-2 py-1.5 text-xs text-left transition-colors ${
                    slide.shader.type === s.type
                      ? "bg-foreground text-background"
                      : "bg-background hover:text-muted"
                  }`}
                >
                  {s.label}
                  {!s.animated && s.type !== "none" && (
                    <span className="opacity-50"> · still</span>
                  )}
                </button>
              ))}
            </div>
            {(def.choices ?? []).map((c) => (
              <Row key={c.key} label={c.label}>
                <select
                  value={String(slide.shader[c.key] ?? c.def)}
                  onChange={(e) => patchShader({ [c.key]: e.target.value })}
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
                  value={Number(slide.shader[c.key] ?? c.def)}
                  onChange={(e) =>
                    patchShader({ [c.key]: Number(e.target.value) })
                  }
                  className="flex-1 accent-foreground"
                />
                <span className="w-10 text-right text-xs text-muted">
                  {Number(slide.shader[c.key] ?? c.def).toFixed(
                    c.step < 1 ? 2 : 0,
                  )}
                </span>
              </Row>
            ))}
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
              <Button onClick={savePng} primary>
                PNG — this slide
              </Button>
              {spec.slides.length > 1 && (
                <Button onClick={saveAllPngs}>PNG — all slides</Button>
              )}
              <Button onClick={saveVideo} disabled={!!recording}>
                {recording
                  ? `Recording ${Math.round(recording * 100)}%`
                  : `Video — ${spec.duration}s`}
              </Button>
            </div>
            <p className="text-xs text-muted">
              Stills export at {w}×{h}. Video records the animated slide (MP4
              where the browser supports it, WebM otherwise).
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
