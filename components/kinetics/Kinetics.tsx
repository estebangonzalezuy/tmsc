"use client";

// the Kinetics — the studio.
//
// Same chrome as the Posts Studio, because a second instrument that looked
// different would be a second thing to learn rather than another room in the
// same building: a black stage that is the whole window, the identity top
// left, one panel top right, the transport at the bottom.
//
// The panel is *generated*. A scene declares the controls it wants and this
// file draws them, which is why adding a scene is one entry in `SCENES` and no
// work here at all — the same bargain the Tools make with the wall.
//
// Read the panel downwards and it is the order of the decisions: what it is
// (scene) · what it says (words) · how it moves (timing) · what colour it is
// (palette) · what the scene itself wants (its own controls) · and the way out
// in the footer, where a tool's way out belongs.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { clock } from "@/components/postlab/clock";
import { loadFonts, type Fonts } from "@/components/postlab/overlay";
import {
  Block,
  Btn,
  Buttons,
  Dots,
  IconBtn,
  Panel,
  Primary,
  Row,
  STAGE,
  Section,
  Segmented,
  Select,
  Sep,
  Slider,
  Stack,
  Text as TextField,
  Toggle,
  Toolbar,
} from "@/components/postlab/toolcraft";
import {
  colorsOf,
  decodeSpec,
  defaultSpec,
  EASES,
  encodeSpec,
  FORMATS,
  normalize,
  FILTERS,
  defaultFilter,
  filterDef,
  ORIGINS,
  RECIPES,
  applyRecipe,
  PALETTES,
  paletteOf,
  type Ctrl,
  type Dir,
  type FilterSpec,
  type Ease,
  type KineticSpec,
  type Origin,
  type PostFormat,
  type SceneId,
} from "@/lib/kinetics";
import { SCENES, sceneOf } from "./scenes";
import { adoptFonts, forgetMask } from "./type";
import Stage, { useClockRunning, useStageFit } from "./Stage";
import { canRecord, exportPng, recordVideo, type Job } from "./exports";

const useTime = () => useSyncExternalStore(clock.subscribe, clock.get, clock.server);

function Playhead({ duration, onScrub }: { duration: number; onScrub: () => void }) {
  const time = useTime();
  return (
    <>
      <span className="relative h-3 w-32 sm:w-48">
        <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] rounded-sm bg-[color:var(--tc-track)]" />
        <span className="tc-fill" style={{ left: 0, width: `${(time / duration) * 100}%` }} />
        <input
          type="range"
          min={0}
          max={duration}
          step={1 / 60}
          value={time}
          aria-label="Playhead"
          onChange={(e) => {
            onScrub();
            clock.set(Number(e.target.value));
          }}
          className="tc-range absolute inset-0"
        />
      </span>
      <span className="text-[color:var(--tc-ink-3)] tabular-nums w-20 text-right">
        {time.toFixed(2)}/{duration.toFixed(0)}s
      </span>
    </>
  );
}

/* The 3×3 that says where a stagger starts. It is a position, so it is drawn
   as one — nine cells you point at — rather than as a dropdown of nine words
   that all mean somewhere. */
function OriginPad({ value, onChange }: { value: Origin; onChange: (v: Origin) => void }) {
  return (
    <div className="grid grid-cols-3 gap-[3px] w-[76px]">
      {ORIGINS.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          title={o}
          aria-label={`start from ${o}`}
          className={`h-[22px] rounded-[var(--tc-r-sm)] border transition-colors ${
            value === o
              ? "bg-[color:var(--tc-sel)] border-[color:var(--tc-sel)]"
              : "border-[color:var(--tc-edge)] hover:bg-[color:var(--tc-field)]"
          }`}
        />
      ))}
    </div>
  );
}

export default function Kinetics() {
  const [spec, setSpec] = useState<KineticSpec>(() =>
    normalize(defaultSpec(), sceneOf("stagger").controls),
  );
  const [fonts, setFonts] = useState<Fonts | null>(null);
  const [playing, setPlaying] = useState(true);
  const [job, setJob] = useState<Job>(null);
  const [flash, setFlash] = useState("");
  const [quality, setQuality] = useState<"mid" | "high" | "max">("high");
  const stageRef = useRef<HTMLDivElement>(null);

  const scene = useMemo(() => sceneOf(spec.scene), [spec.scene]);
  const stageSize = useStageFit(stageRef, spec.format);
  const { ground, inks } = colorsOf(spec);
  useClockRunning(playing, spec.duration);

  /* The fonts have to be in before anything is measured — a mask built in the
     fallback face is the wrong shape, and it is cached, so it would be the
     wrong shape until something else invalidated it. */
  const readHash = useCallback(() => {
    const encoded = window.location.hash.match(/spec=([^&]+)/)?.[1];
    const decoded = encoded ? decodeSpec(encoded) : null;
    if (!decoded) return;
    setSpec(normalize(decoded, sceneOf(decoded.scene ?? "stagger").controls));
  }, []);

  useEffect(() => {
    loadFonts().then((f) => {
      adoptFonts(f);
      forgetMask();
      setFonts(f);
      readHash();
    });
    /* A link pasted into a tab that is already open has to land, and it
       wouldn't if the hash were only read at mount — the address changes and
       nothing happens, which looks like a broken link rather than a studio
       that wasn't listening. Our own `replaceState` doesn't fire this, so
       there is no loop to worry about. */
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, [readHash]);

  /* The link stays current, so a piece is always one copy away from being
     shareable — and reopenable exactly as it is now. */
  useEffect(() => {
    if (!fonts) return;
    const t = setTimeout(() => {
      window.history.replaceState(null, "", `#spec=${encodeSpec(spec)}`);
    }, 400);
    return () => clearTimeout(t);
  }, [spec, fonts]);

  const say = useCallback((msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2600);
  }, []);

  /* Space plays, the arrows step a frame. Ignored while a field has focus, or
     typing a headline with a space in it would start and stop the loop. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((v) => !v);
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        setPlaying(false);
        const step = (e.shiftKey ? 10 : 1) / 30;
        const d = Math.max(0.001, spec.duration);
        clock.set(((clock.get() + (e.key === "ArrowRight" ? step : -step)) % d + d) % d);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spec.duration]);

  /* The effect chain, and the two things you do to it. A muted effect stays in
     the chain rather than being deleted, so you can take one out and see what
     it was doing — the same contract the Posts Studio's stack makes. */
  const fx: FilterSpec[] = spec.filters ?? [];
  const patchFx = (i: number, patch: Partial<FilterSpec>) =>
    setSpec((s) => ({
      ...s,
      filters: (s.filters ?? []).map((f, j) => (j === i ? { ...f, ...patch } : f)),
    }));
  const moveFx = (i: number, dir: -1 | 1) =>
    setSpec((s) => {
      const list = [...(s.filters ?? [])];
      const j = i + dir;
      if (j < 0 || j >= list.length) return s;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...s, filters: list };
    });

  const set = <K extends keyof KineticSpec>(key: K, value: KineticSpec[K]) =>
    setSpec((s) => normalize({ ...s, [key]: value }, sceneOf(s.scene).controls));

  const setParam = (key: string, value: number | string | boolean) =>
    setSpec((s) => ({ ...s, params: { ...s.params, [key]: value } }));

  const setTiming = (patch: Partial<KineticSpec["timing"]>) =>
    setSpec((s) => ({ ...s, timing: { ...s.timing, ...patch } }));

  /* Changing scene keeps everything the two scenes agree about — the words,
     the colours, the timing — and fills in the rest from the new one's
     defaults. Switching should feel like turning the piece over, not like
     starting again. */
  const setScene = (id: SceneId) =>
    setSpec((s) => normalize({ ...s, scene: id, params: {} }, sceneOf(id).controls));

  const { w: outW, h: outH } = FORMATS[spec.format];
  const scale = quality === "mid" ? 1 : quality === "high" ? 2 : 4;

  async function savePng() {
    setJob({ label: "PNG", frac: 0 });
    try {
      await exportPng(spec, clock.get() / Math.max(0.001, spec.duration), scale);
      say("Saved the frame you were looking at");
    } finally {
      setJob(null);
    }
  }

  async function saveVideo() {
    if (!canRecord()) return say("This browser can't record — save the PNG instead");
    setPlaying(false);
    setJob({ label: "Video", frac: 0 });
    try {
      await recordVideo(spec, Math.min(2, scale), 30, (frac) => setJob({ label: "Video", frac }));
      say("Saved a webm of the whole loop");
    } catch (err) {
      say(err instanceof Error ? err.message : "Couldn't record it");
    } finally {
      setJob(null);
    }
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    say("Link copied — it opens this piece exactly as it is");
  };

  /* A scene's own controls, drawn from what it declared. */
  const control = (c: Ctrl) => {
    const v = spec.params[c.key];
    switch (c.kind) {
      case "num":
        return (
          <Slider
            key={c.key}
            label={c.label}
            value={Number(v ?? c.def)}
            min={c.min}
            max={c.max}
            step={c.step}
            onChange={(n) => setParam(c.key, n)}
            help={c.hint}
          />
        );
      case "bool":
        return (
          <Toggle
            key={c.key}
            label={c.label}
            on={v === true}
            onChange={() => setParam(c.key, !(v === true))}
            help={c.hint}
          />
        );
      case "pick":
        return (
          <Row key={c.key} label={c.label}>
            {c.values.length > 4 ? (
              <Select
                value={String(v ?? c.def)}
                options={c.values}
                onChange={(x) => setParam(c.key, x)}
              />
            ) : (
              <Segmented
                value={String(v ?? c.def)}
                options={c.values}
                onChange={(x) => setParam(c.key, x)}
              />
            )}
          </Row>
        );
      case "words":
        return (
          <Stack key={c.key} label={c.label}>
            <TextField
              value={String(v ?? c.def)}
              onChange={(x) => setParam(c.key, x)}
              mono
            />
          </Stack>
        );
    }
  };

  return (
    <div className={`min-h-dvh md:h-dvh flex flex-col ${STAGE}`}>
      <div className="relative flex-1 min-h-0 flex flex-col md:block">
        <div
          ref={stageRef}
          className="h-[52vh] md:h-full flex items-center justify-center overflow-hidden md:pr-[352px]"
        >
          <div className="relative overflow-hidden shrink-0">
            <Stage spec={spec} width={stageSize.w} height={stageSize.h} />
          </div>
        </div>

        {/* Top left: what this is, and the way out to the other rooms. */}
        <div className="md:absolute md:top-3 md:left-3 z-20 flex items-center gap-1.5 p-2 md:p-0 overflow-x-auto">
          <Link
            href="/tools"
            title="the club's tools"
            className="tc-float rounded-[var(--tc-r)] size-9 shrink-0 inline-grid place-items-center text-[13px] hover:bg-[color:var(--tc-field-hi)] transition-colors"
          >
            ←
          </Link>
          <span className="tc-float rounded-[var(--tc-r)] h-9 px-3 flex items-center gap-2.5 shrink-0">
            <span className="text-[13px] font-medium">the Kinetics</span>
            <span className="text-[11px] text-[color:var(--tc-ink-3)] hidden xl:block max-w-[340px] truncate">
              {scene.about}
            </span>
          </span>
          <Link
            href="/postlab"
            className="tc-float rounded-[var(--tc-r)] h-9 px-3 flex items-center text-[12.5px] shrink-0 hover:bg-[color:var(--tc-field-hi)]"
          >
            the Posts Studio →
          </Link>
          {(flash || job) && (
            <span className="tc-float rounded-[var(--tc-r)] h-9 px-3 flex items-center text-[12.5px] shrink-0 tabular-nums">
              {job ? `${job.label} — ${Math.round(job.frac * 100)}%` : flash}
            </span>
          )}
        </div>

        {/* Top right: everything you set. */}
        <div className="md:absolute md:top-3 md:right-3 md:bottom-3 z-20 flex p-2 md:p-0">
          <Panel
            title="the Kinetics"
            right={
              <span className="text-[10px] text-muted tabular-nums pr-1">
                {FORMATS[spec.format].label}
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
                  <Btn onClick={copyLink} wide>
                    Link
                  </Btn>
                </Buttons>
              </div>
            }
          >
            <Section title="scene" summary={scene.name}>
              <Stack>
                <Select
                  value={spec.scene}
                  options={SCENES.map((s) => ({ value: s.id, label: s.name, title: s.about }))}
                  onChange={(v) => setScene(v as SceneId)}
                />
              </Stack>
              <p className="text-[11px] text-[color:var(--tc-ink-3)] leading-relaxed">
                {scene.about}
              </p>
              {/* Somewhere to start. A recipe never touches the words — it is
                  "put my sentence in this", not a poster about something
                  else. */}
              <Stack label="start from">
                <div className="grid grid-cols-2 gap-1.5">
                  {RECIPES.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSpec((s) => normalize(applyRecipe(s, r), sceneOf(r.scene).controls))}
                      title={r.note}
                      className="tc-field h-[var(--tc-h)] px-2 text-[12.5px] truncate hover:bg-[color:var(--tc-field-hi)] transition-colors"
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </Stack>
            </Section>

            <Section title="words">
              <Stack>
                <TextField
                  value={spec.text}
                  rows={3}
                  placeholder={"one line\nper line"}
                  onChange={(v) => set("text", v)}
                />
              </Stack>
              <Row label="face">
                <Segmented
                  value={spec.font}
                  options={[
                    { value: "sans", label: "sans" },
                    { value: "serif", label: "serif" },
                    { value: "gothic", label: "gothic" },
                  ]}
                  onChange={(v) => set("font", v as KineticSpec["font"])}
                />
              </Row>
              <Slider
                label="weight"
                value={spec.weight}
                min={100}
                max={900}
                step={100}
                onChange={(v) => set("weight", v)}
              />
              <Slider
                label="size"
                value={spec.size}
                min={0}
                max={0.4}
                step={0.005}
                display={spec.size === 0 ? "fit the frame" : undefined}
                onChange={(v) => set("size", v)}
              />
              <Slider
                label="margin"
                value={spec.margin}
                min={0}
                max={260}
                step={4}
                onChange={(v) => set("margin", v)}
              />
              <Toggle label="capitals" on={spec.caps} onChange={() => set("caps", !spec.caps)} />
            </Section>

            <Section
              title="motion"
              summary={`${spec.timing.intro} · ${spec.duration}s`}
            >
              <Row label="format">
                <Segmented
                  value={spec.format}
                  options={(Object.keys(FORMATS) as PostFormat[]).map((k) => ({
                    value: k,
                    label: FORMATS[k].label,
                    title: FORMATS[k].hint,
                  }))}
                  onChange={(v) => set("format", v as PostFormat)}
                />
              </Row>
              <Slider
                label="loop"
                value={spec.duration}
                min={2}
                max={20}
                step={1}
                suffix="s"
                onChange={(v) => set("duration", v)}
              />
              <Row label="starts at">
                <OriginPad value={spec.timing.from} onChange={(v) => setTiming({ from: v })} />
              </Row>
              <Row label="in">
                <Select
                  value={spec.timing.intro}
                  options={EASES}
                  onChange={(v) => setTiming({ intro: v as Ease })}
                />
                <Select
                  value={spec.timing.introDir}
                  options={[
                    { value: "in", label: "in" },
                    { value: "out", label: "out" },
                    { value: "inout", label: "in & out" },
                  ]}
                  onChange={(v) => setTiming({ introDir: v as Dir })}
                />
              </Row>
              <Row label="out">
                <Select
                  value={spec.timing.outro}
                  options={EASES}
                  onChange={(v) => setTiming({ outro: v as Ease })}
                />
                <Select
                  value={spec.timing.outroDir}
                  options={[
                    { value: "in", label: "in" },
                    { value: "out", label: "out" },
                    { value: "inout", label: "in & out" },
                  ]}
                  onChange={(v) => setTiming({ outroDir: v as Dir })}
                />
              </Row>
              <Slider
                label="arriving"
                value={spec.timing.introLen}
                min={0.02}
                max={1}
                step={0.01}
                onChange={(v) => setTiming({ introLen: v })}
              />
              <Slider
                label="holding"
                value={spec.timing.pause}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setTiming({ pause: v })}
              />
              <Slider
                label="leaving"
                value={spec.timing.outroLen}
                min={0.02}
                max={1}
                step={0.01}
                onChange={(v) => setTiming({ outroLen: v })}
              />
              <Slider
                label="stagger"
                value={spec.timing.delay}
                min={0}
                max={0.9}
                step={0.01}
                display={spec.timing.delay === 0 ? "all at once" : undefined}
                onChange={(v) => setTiming({ delay: v })}
                help="How far apart two letters start. The three stages are shares of the loop, so whatever you set here the last frame still meets the first."
              />
            </Section>

            <Section
              title="colour"
              summary={spec.blotter ? "blotter" : paletteOf(spec.palette).name}
            >
              {/* A mode, not an effect: it overrules the palette, because
                  there is no such thing as a two-colour blotter. */}
              <Toggle
                label="blotter ink"
                on={!!spec.blotter}
                onChange={() => set("blotter", !spec.blotter)}
                help="Prints the whole piece as one black ink on white paper, bleeding into itself the way ink does on stock that drinks it."
              />
              {spec.blotter && (
                <Slider
                  label="bleed"
                  value={spec.blot ?? 40}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => set("blot", v)}
                  help="How far the ink spreads. Low keeps the shapes; high lets anything near anything else run together into one mass."
                />
              )}
              {!spec.blotter && (
                <Stack>
                  <Select
                    value={spec.palette}
                    options={PALETTES.map((p) => ({ value: p.id, label: p.name }))}
                    onChange={(v) =>
                      setSpec((s) => ({ ...s, palette: v, ground: undefined, inks: undefined }))
                    }
                  />
                </Stack>
              )}
              {!spec.blotter && (
                <Row label="ground">
                  {/* Deduped: two palettes share a ground, and the same swatch
                      twice is a duplicate key and a control that looks
                      broken. */}
                  <Dots
                    colors={[...new Set(PALETTES.map((p) => p.ground))]}
                    value={ground}
                    onChange={(v) => set("ground", v)}
                  />
                </Row>
              )}
              {!spec.blotter && (
                <div className="flex flex-wrap gap-1.5">
                  {inks.map((ink) => (
                    <span
                      key={ink}
                      title={ink}
                      className="size-[22px] rounded-full border border-[color:var(--tc-edge)]"
                      style={{ background: ink }}
                    />
                  ))}
                </div>
              )}
              <Slider
                label="grain"
                value={spec.grain}
                min={0}
                max={0.35}
                step={0.01}
                display={spec.grain === 0 ? "clean" : undefined}
                onChange={(v) => set("grain", v)}
              />
            </Section>

            <Section title={scene.name} summary={`${scene.controls.length} controls`}>
              {scene.controls.map(control)}
            </Section>

            {/* The Posts Studio's own effects, unforked, running over the
                finished frame. They take no time as an input, so one can sit
                on top of any scene without touching the loop. */}
            <Section
              title="effects"
              summary={fx.length ? `${fx.filter((x) => !x.mute).length} on` : "none"}
            >
              <Stack>
                <Select
                  value=""
                  options={[
                    { value: "", label: "add an effect…" },
                    ...FILTERS.map((d) => ({ value: d.type, label: d.label, title: d.hint })),
                  ]}
                  onChange={(v) => v && setSpec((s) => ({ ...s, filters: [...(s.filters ?? []), defaultFilter(v)] }))}
                />
              </Stack>
              {fx.map((flt, i) => {
                const def = filterDef(flt.type);
                return (
                  <Block
                    key={`${flt.type}-${i}`}
                    title={def?.label ?? flt.type}
                    on={!flt.mute}
                    onToggle={() => patchFx(i, { mute: !flt.mute })}
                    onUp={i > 0 ? () => moveFx(i, -1) : undefined}
                    onDown={i < fx.length - 1 ? () => moveFx(i, 1) : undefined}
                    onRemove={() => setSpec((s) => ({ ...s, filters: fx.filter((_, j) => j !== i) }))}
                  >
                    {def?.choices?.map((c) => (
                      <Row key={c.key} label={c.label}>
                        <Select
                          value={String(flt[c.key] ?? c.def)}
                          options={c.values.map((v) => ({ value: v, label: v }))}
                          onChange={(v) => patchFx(i, { [c.key]: v })}
                        />
                      </Row>
                    ))}
                    {def?.controls.map((c) => (
                      <Slider
                        key={c.key}
                        label={c.label}
                        value={Number(flt[c.key] ?? c.def)}
                        min={c.min}
                        max={c.max}
                        step={c.step}
                        onChange={(v) => patchFx(i, { [c.key]: v })}
                      />
                    ))}
                  </Block>
                );
              })}
              {!fx.length && (
                <p className="text-[11px] text-[color:var(--tc-ink-3)] leading-relaxed">
                  The club&apos;s screen, posterize, levels, grain, mono and
                  invert — the same chain the Posts Studio runs, over whatever
                  the scene drew.
                </p>
              )}
            </Section>

            <Section title="out" summary={`${outW * scale}×${outH * scale}`}>
              <Stack label="resolution">
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
              <p className="text-[11px] text-[color:var(--tc-ink-3)] leading-relaxed">
                Video records at 2× and 30fps, frame by frame at each frame&apos;s
                own moment — so it is the same file every time, and the last
                frame meets the first.
              </p>
            </Section>
          </Panel>
        </div>

        {/* Bottom centre: the transport. */}
        <div className="md:absolute md:bottom-3 md:left-1/2 md:-translate-x-1/2 z-20 p-2 md:p-0 flex justify-center">
          <Toolbar>
            <IconBtn
              onClick={() => {
                setPlaying(false);
                clock.set(0);
              }}
              title="Back to the top of the loop"
              bare
            >
              ⏮
            </IconBtn>
            <IconBtn onClick={() => setPlaying(!playing)} title="Play / pause" bare>
              {playing ? "❙❙" : "▶"}
            </IconBtn>
            <Sep />
            <Playhead duration={spec.duration} onScrub={() => setPlaying(false)} />
          </Toolbar>
        </div>
      </div>
    </div>
  );
}
