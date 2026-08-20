"use client";

// the Tiles — the studio.
//
// Same chrome as the other two, because a third instrument that looked
// different would be a third thing to learn rather than another room in the
// same building: a black stage that is the whole window, the identity top
// left, one panel top right, the transport at the bottom.
//
// Read the panel downwards and it is the order a tile is made in: the canvas
// it sits on · the band round the edge · the panel that band frames · the
// lines it was set out with · the arms that are the ornament · what sits in
// the middle · what colour all of it is · how hard the hand shakes · and the
// way out in the footer, where a tool's way out belongs.
//
// The arms are a stack of `Block`s, which is what anything with an order is
// drawn as here — a switch, a name, reorder, remove, and its numbers inside.
// A muted arm stays in the stack rather than being deleted, so you can take
// one out and see what it was doing.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { clock } from "@/components/postlab/clock";
import {
  Block,
  Btn,
  Buttons,
  ColorRow,
  Cols,
  Dots,
  Drawer,
  IconBtn,
  Panel,
  Primary,
  Range,
  Row,
  STAGE,
  Section,
  Segmented,
  Select,
  Sep,
  Slider,
  Stack,
  Toggle,
  Toolbar,
} from "@/components/postlab/toolcraft";
import {
  FILTERS,
  FORMATS,
  PALETTES,
  RECIPES,
  SHAPES,
  applyRecipe,
  colorsOf,
  decodeSpec,
  defaultArm,
  defaultFilter,
  defaultSpec,
  encodeSpec,
  filterDef,
  normalize,
  paletteOf,
  randomTile,
  type Arm,
  type CentreKind,
  type FilterSpec,
  type PostFormat,
  type ShapeId,
  type TileSpec,
} from "@/lib/tiles";
import Stage, { Thumb, useClockRunning, useStageFit } from "./Stage";
import { canRecord, exportFrames, exportPng, recordVideo, type Job } from "./exports";

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

const shapeDef = (id: ShapeId) => SHAPES.find((s) => s.value === id) ?? SHAPES[0];

export default function Tiles() {
  const [spec, setSpec] = useState<TileSpec>(() => normalize(defaultSpec()));
  const ready = useRef(false);
  const [playing, setPlaying] = useState(true);
  const [job, setJob] = useState<Job>(null);
  const [flash, setFlash] = useState("");
  const [shelf, setShelf] = useState<"none" | "recipes" | "rolls">("none");
  const [rolls, setRolls] = useState<TileSpec[]>([]);
  const [quality, setQuality] = useState<"mid" | "high" | "max">("high");
  const stageRef = useRef<HTMLDivElement>(null);

  const stageSize = useStageFit(stageRef, spec.format);
  const colors = colorsOf(spec);
  useClockRunning(playing, spec.duration);

  const readHash = useCallback(() => {
    const encoded = window.location.hash.match(/spec=([^&]+)/)?.[1];
    const decoded = encoded ? decodeSpec(encoded) : null;
    if (decoded) setSpec(normalize(decoded));
  }, []);

  useEffect(() => {
    /* The address is an external system, and this is a subscription to it. A
       link pasted into a tab that is already open has to land, and it wouldn't
       if the hash were only read at mount; our own `replaceState` doesn't fire
       the event, so there is no loop to worry about.

       The first read is dispatched rather than run inline. Decoding a spec
       during mount would be a second render before the first had painted —
       the stage would draw the default tile and immediately throw it away. */
    window.addEventListener("hashchange", readHash);
    const first = requestAnimationFrame(() => {
      readHash();
      ready.current = true;
    });
    return () => {
      cancelAnimationFrame(first);
      window.removeEventListener("hashchange", readHash);
    };
  }, [readHash]);

  /* The link stays current, so a tile is always one copy away from being
     shareable — and reopenable exactly as it is now. */
  useEffect(() => {
    if (!ready.current) return;
    const t = setTimeout(() => {
      window.history.replaceState(null, "", `#spec=${encodeSpec(spec)}`);
    }, 400);
    return () => clearTimeout(t);
  }, [spec]);

  const say = useCallback((msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2600);
  }, []);

  /* Space plays, the arrows step a frame, R rolls. Ignored while a field has
     focus, or typing a hex would start and stop the loop. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((v) => !v);
      } else if (e.key === "r" || e.key === "R") {
        setSpec((s) => randomTile(Math.floor(Math.random() * 1e9), s));
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        setPlaying(false);
        const step = (e.shiftKey ? 10 : 1) / 30;
        const d = Math.max(0.001, spec.duration);
        clock.set(((((clock.get() + (e.key === "ArrowRight" ? step : -step)) % d) + d) % d));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spec.duration]);

  const set = <K extends keyof TileSpec>(key: K, value: TileSpec[K]) =>
    setSpec((s) => normalize({ ...s, [key]: value }));
  const setFrame = (patch: Partial<TileSpec["frame"]>) =>
    setSpec((s) => normalize({ ...s, frame: { ...s.frame, ...patch } }));
  const setGuides = (patch: Partial<TileSpec["guides"]>) =>
    setSpec((s) => normalize({ ...s, guides: { ...s.guides, ...patch } }));
  const setCentre = (patch: Partial<TileSpec["centre"]>) =>
    setSpec((s) => normalize({ ...s, centre: { ...s.centre, ...patch } }));

  const patchArm = (i: number, patch: Partial<Arm>) =>
    setSpec((s) => normalize({ ...s, arms: s.arms.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const moveArm = (i: number, dir: -1 | 1) =>
    setSpec((s) => {
      const list = [...s.arms];
      const j = i + dir;
      if (j < 0 || j >= list.length) return s;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...s, arms: list };
    });
  const addArm = (shape: ShapeId) =>
    setSpec((s) =>
      normalize({
        ...s,
        arms: [
          ...s.arms,
          /* An arm arrives already moving. This is a studio for motion and a
             still mark is the exception, which is the same bargain the Posts
             Studio makes with a shape. */
          defaultArm({
            shape,
            count: s.arms[0]?.count ?? 12,
            ink: s.arms.length % Math.max(1, colors.inks.length),
            width: shape === "wedge" ? 0.4 : shape === "chain" || shape === "dot" ? 0.05 : 0.09,
            outer: shape === "dot" ? 0.9 : 1.2,
            inner: shape === "dot" ? 0.9 : 0.05,
            pulse: shape === "chain" ? 0 : 0.05,
            march: shape === "chain" ? 1 : 0,
          }),
        ],
      }),
    );

  /* The effect chain, and the two things you do to it. A muted effect stays in
     the chain rather than being deleted, so you can take one out and see what
     it was doing. */
  const fx: FilterSpec[] = spec.filters ?? [];
  const patchFx = (i: number, patch: Partial<FilterSpec>) =>
    setSpec((s) => ({ ...s, filters: (s.filters ?? []).map((f, j) => (j === i ? { ...f, ...patch } : f)) }));
  const moveFx = (i: number, dir: -1 | 1) =>
    setSpec((s) => {
      const list = [...(s.filters ?? [])];
      const j = i + dir;
      if (j < 0 || j >= list.length) return s;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...s, filters: list };
    });

  const { w: outW, h: outH } = FORMATS[spec.format];
  const scale = quality === "mid" ? 1 : quality === "high" ? 2 : 4;

  const roll = () => setSpec((s) => randomTile(Math.floor(Math.random() * 1e9), s));
  const openRolls = () => {
    setRolls(Array.from({ length: 12 }, (_, i) => randomTile(Math.floor(Math.random() * 1e9) + i, spec)));
    setShelf("rolls");
  };

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

  async function saveFrames() {
    setPlaying(false);
    setJob({ label: "Frames", frac: 0 });
    try {
      await exportFrames(spec, Math.min(2, scale), 24, (frac) => setJob({ label: "Frames", frac }));
      say("Saved 24 frames — one turn of the loop");
    } finally {
      setJob(null);
    }
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    say("Link copied — it opens this tile exactly as it is");
  };

  const inkDots = (value: number, onChange: (i: number) => void) => (
    <Dots
      colors={colors.inks}
      value={colors.inks[value % colors.inks.length] ?? colors.inks[0]}
      onChange={(hex) => onChange(Math.max(0, colors.inks.indexOf(hex)))}
    />
  );

  const armSummary = (a: Arm) =>
    `${a.count}× ${shapeDef(a.shape).label}${a.mirror ? ", mirrored" : ""}`;

  const moving = useMemo(
    () => spec.spin !== 0 || spec.boil > 0 || spec.arms.some((a) => !a.mute && (a.spin || a.pulse || a.sway || a.march)),
    [spec],
  );

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

        {/* Top left: what this is, what you do, and the way to the other rooms. */}
        <div className="md:absolute md:top-3 md:left-3 z-20 flex items-center gap-1.5 p-2 md:p-0 overflow-x-auto">
          <Link
            href="/tools"
            title="the club's tools"
            className="tc-float rounded-[var(--tc-r)] size-9 shrink-0 inline-grid place-items-center text-[13px] hover:bg-[color:var(--tc-field-hi)] transition-colors"
          >
            ←
          </Link>
          <span className="tc-float rounded-[var(--tc-r)] h-9 px-3 flex items-center gap-2.5 shrink-0">
            <span className="text-[13px] font-medium">the Tiles</span>
            <span className="text-[11px] text-[color:var(--tc-ink-3)] hidden xl:block">
              {spec.arms.length} arm{spec.arms.length === 1 ? "" : "s"} · {paletteOf(spec.palette).name}
            </span>
          </span>
          <span className="tc-float rounded-[var(--tc-r)] h-9 px-1 flex items-center gap-0.5 shrink-0">
            <button
              onClick={roll}
              title="A tile from nothing (R)"
              className="h-7 px-2.5 rounded-[var(--tc-r-sm)] text-[12.5px] hover:bg-[color:var(--tc-field)]"
            >
              ⟳ roll
            </button>
            <button
              onClick={() => setShelf("recipes")}
              title="The thirteen it was drawn from"
              className="h-7 px-2.5 rounded-[var(--tc-r-sm)] text-[12.5px] hover:bg-[color:var(--tc-field)]"
            >
              shelf
            </button>
            <button
              onClick={openRolls}
              title="Twelve rolled at once"
              className="h-7 px-2.5 rounded-[var(--tc-r-sm)] text-[12.5px] hover:bg-[color:var(--tc-field)]"
            >
              sheet
            </button>
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

        {/* Big grids of pictures go over the stage: moments, not places. */}
        {shelf === "recipes" && (
          <Drawer title="the shelf" onClose={() => setShelf("none")}>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {RECIPES.map((r) => {
                const preview = applyRecipe(spec, r);
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSpec(applyRecipe(spec, r));
                      setShelf("none");
                    }}
                    title={r.note}
                    className="text-left space-y-1.5 group"
                  >
                    <span className="block overflow-hidden rounded-[var(--tc-r)] border border-[color:var(--tc-edge)] group-hover:border-[color:var(--tc-edge-on)]">
                      <Thumb spec={preview} size={168} />
                    </span>
                    <span className="block text-[12.5px]">{r.name}</span>
                    <span className="block text-[11px] text-[color:var(--tc-ink-3)] leading-snug">
                      {r.note}
                    </span>
                  </button>
                );
              })}
            </div>
          </Drawer>
        )}

        {shelf === "rolls" && (
          <Drawer
            title="a sheet of them"
            onClose={() => setShelf("none")}
            right={
              <Btn onClick={openRolls}>⟳ again</Btn>
            }
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {rolls.map((r, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSpec(r);
                    setShelf("none");
                  }}
                  className="overflow-hidden rounded-[var(--tc-r)] border border-[color:var(--tc-edge)] hover:border-[color:var(--tc-edge-on)]"
                >
                  <Thumb spec={r} size={168} />
                </button>
              ))}
            </div>
          </Drawer>
        )}

        {/* Top right: everything you set. */}
        <div className="md:absolute md:top-3 md:right-3 md:bottom-3 z-20 flex p-2 md:p-0">
          <Panel
            title="the Tiles"
            right={
              <span className="text-[10px] text-muted tabular-nums pr-1">
                {FORMATS[spec.format].label}
              </span>
            }
            onReset={() => setSpec(normalize(defaultSpec()))}
            footer={
              <div className="space-y-1.5">
                <Primary onClick={savePng} disabled={!!job}>
                  ⤓ Export PNG
                </Primary>
                <Buttons>
                  <Btn onClick={saveVideo} disabled={!!job} wide>
                    Video
                  </Btn>
                  <Btn onClick={saveFrames} disabled={!!job} wide title="24 PNGs, one turn of the loop">
                    Frames
                  </Btn>
                  <Btn onClick={copyLink} wide>
                    Link
                  </Btn>
                </Buttons>
              </div>
            }
          >
            <Section title="canvas" summary={`${FORMATS[spec.format].label} · ${spec.duration}s`}>
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
              <Slider
                label="turn"
                value={spec.spin}
                min={-4}
                max={4}
                step={1}
                display={spec.spin === 0 ? "held" : undefined}
                onChange={(v) => set("spin", v)}
                help="Whole turns the whole composition makes over the loop. Whole, because a fraction would not come back to where it started."
              />
            </Section>

            <Section title="frame" summary={`${Math.round(spec.frame.band * 100)}% · ${spec.frame.ticks} ticks`}>
              <Slider
                label="band"
                value={spec.frame.band}
                min={0}
                max={0.4}
                step={0.005}
                display={spec.frame.band === 0 ? "none" : undefined}
                onChange={(v) => setFrame({ band: v })}
              />
              <Slider
                label="outer strip"
                value={spec.frame.outer}
                min={0}
                max={1}
                step={0.02}
                display={spec.frame.outer === 0 ? "one band" : undefined}
                onChange={(v) => setFrame({ outer: v })}
                help="Gives the outermost part of the band a second colour."
              />
              <Slider
                label="ticks"
                value={spec.frame.ticks}
                min={0}
                max={40}
                step={1}
                display={spec.frame.ticks === 0 ? "plain" : undefined}
                onChange={(v) => setFrame({ ticks: v })}
                help="Per short side. They are placed by distance round the whole edge, so they carry through the corners at the same pitch."
              />
              <Slider label="length" value={spec.frame.tickLen} min={0} max={1.4} step={0.02} onChange={(v) => setFrame({ tickLen: v })} />
              <Slider label="weight" value={spec.frame.tickWide} min={0.05} max={1} step={0.02} onChange={(v) => setFrame({ tickWide: v })} />
              <Slider
                label="sits at"
                value={spec.frame.tickAt}
                min={0}
                max={1}
                step={0.02}
                display={spec.frame.tickAt === 0 ? "the very edge" : undefined}
                onChange={(v) => setFrame({ tickAt: v })}
              />
              <Toggle label="round ends" on={spec.frame.round} onChange={() => setFrame({ round: !spec.frame.round })} />
            </Section>

            <Section title="panel" summary={spec.round < 0.02 ? "square" : `${Math.round(spec.round * 100)}% round`}>
              <Slider
                label="corners"
                value={spec.round}
                min={0}
                max={1}
                step={0.01}
                display={spec.round === 0 ? "square" : spec.round === 1 ? "round" : undefined}
                onChange={(v) => set("round", v)}
              />
              <Slider
                label="the hand"
                value={spec.wobble}
                min={0}
                max={1}
                step={0.02}
                display={spec.wobble === 0 ? "drawn straight" : undefined}
                onChange={(v) => set("wobble", v)}
                help="How far every outline in the tile is pushed about before it is filled. At 0 nothing is hand-drawn, which is the one setting no reference uses."
              />
              <Slider
                label="boil"
                value={spec.boil}
                min={0}
                max={12}
                step={1}
                display={spec.boil === 0 ? "held" : `${spec.boil}× a loop`}
                onChange={(v) => set("boil", v)}
                help="How many times the hand redraws the tile over the loop. Whole redrawings, landing back on the first — which is why a still tile still moves."
              />
            </Section>

            <Section
              title="guides"
              summary={
                spec.guides.spokes + spec.guides.rings + spec.guides.arcs === 0
                  ? "none"
                  : `${spec.guides.spokes}/${spec.guides.rings}/${spec.guides.arcs}`
              }
              note="The lines a tile was set out with, left in. Spokes out from the middle, rings around it, and arcs that curl on their way out."
            >
              <Cols>
                <Slider label="spokes" value={spec.guides.spokes} min={0} max={36} step={1} onChange={(v) => setGuides({ spokes: v })} />
                <Slider label="rings" value={spec.guides.rings} min={0} max={12} step={1} onChange={(v) => setGuides({ rings: v })} />
              </Cols>
              <Cols>
                <Slider label="arcs" value={spec.guides.arcs} min={0} max={20} step={1} onChange={(v) => setGuides({ arcs: v })} />
                <Slider label="curl" value={spec.guides.spiral} min={-360} max={360} step={5} suffix="°" onChange={(v) => setGuides({ spiral: v })} />
              </Cols>
              <Row label="ink">{inkDots(spec.guides.ink, (i) => setGuides({ ink: i }))}</Row>
              <Cols>
                <Slider label="strength" value={spec.guides.alpha} min={0} max={1} step={0.05} onChange={(v) => setGuides({ alpha: v })} />
                <Slider label="weight" value={spec.guides.weight} min={0.5} max={24} step={0.5} onChange={(v) => setGuides({ weight: v })} />
              </Cols>
              <Cols>
                <Slider label="dash" value={spec.guides.dash} min={1} max={80} step={1} onChange={(v) => setGuides({ dash: v })} />
                <Slider label="gap" value={spec.guides.gap} min={0} max={80} step={1} onChange={(v) => setGuides({ gap: v })} />
              </Cols>
              <Range
                label="reach"
                from={spec.guides.from}
                to={spec.guides.to}
                min={0}
                max={2}
                step={0.02}
                onChange={(from, to) => setGuides({ from, to })}
              />
              <Toggle label="over the ornament" on={spec.guides.top} onChange={() => setGuides({ top: !spec.guides.top })} />
            </Section>

            <Section title="arms" summary={`${spec.arms.filter((a) => !a.mute).length} on`}>
              <Stack>
                <Select
                  value=""
                  options={[
                    { value: "", label: "add an arm…" },
                    ...SHAPES.map((s) => ({ value: s.value, label: s.label, title: s.hint })),
                  ]}
                  onChange={(v) => v && addArm(v as ShapeId)}
                />
              </Stack>
              {spec.arms.map((arm, i) => (
                <Block
                  key={i}
                  title={armSummary(arm)}
                  on={!arm.mute}
                  open={i === 0}
                  onToggle={() => patchArm(i, { mute: arm.mute ? undefined : true })}
                  onUp={i > 0 ? () => moveArm(i, -1) : undefined}
                  onDown={i < spec.arms.length - 1 ? () => moveArm(i, 1) : undefined}
                  onRemove={
                    spec.arms.length > 1
                      ? () => setSpec((s) => normalize({ ...s, arms: s.arms.filter((_, j) => j !== i) }))
                      : undefined
                  }
                >
                  <Stack>
                    <Select
                      value={arm.shape}
                      options={SHAPES.map((s) => ({ value: s.value, label: s.label, title: s.hint }))}
                      onChange={(v) => patchArm(i, { shape: v as ShapeId })}
                    />
                  </Stack>
                  <p className="text-[11px] text-[color:var(--tc-ink-3)] leading-relaxed">
                    {shapeDef(arm.shape).hint}
                  </p>
                  <Row label="ink">{inkDots(arm.ink, (k) => patchArm(i, { ink: k }))}</Row>
                  <Cols>
                    <Slider label="how many" value={arm.count} min={1} max={36} step={1} onChange={(v) => patchArm(i, { count: v })} />
                    <Slider label="turned" value={arm.turn} min={0} max={360} step={1} suffix="°" onChange={(v) => patchArm(i, { turn: v })} />
                  </Cols>
                  <Range
                    label="reach"
                    from={arm.inner}
                    to={arm.outer}
                    min={0}
                    max={2}
                    step={0.02}
                    onChange={(from, to) => patchArm(i, { inner: from, outer: to })}
                  />
                  <Cols>
                    <Slider
                      label="width"
                      value={arm.width}
                      min={0.002}
                      max={arm.shape === "wedge" ? 1.2 : 0.5}
                      step={0.002}
                      onChange={(v) => patchArm(i, { width: v })}
                    />
                    <Slider label="taper" value={arm.taper} min={-1} max={1} step={0.02} onChange={(v) => patchArm(i, { taper: v })} />
                  </Cols>
                  <Slider
                    label="twist"
                    value={arm.twist}
                    min={-360}
                    max={360}
                    step={5}
                    suffix="°"
                    display={arm.twist === 0 ? "straight out" : undefined}
                    onChange={(v) => patchArm(i, { twist: v })}
                  />
                  <Cols>
                    <Slider label="wave" value={arm.wave} min={0} max={1} step={0.02} onChange={(v) => patchArm(i, { wave: v })} />
                    <Slider label="waves" value={arm.waves} min={0} max={8} step={0.5} onChange={(v) => patchArm(i, { waves: v })} />
                  </Cols>
                  {(arm.shape === "chain" || arm.shape === "dot") && (
                    <Cols>
                      {arm.shape === "chain" ? (
                        <Slider label="beads" value={arm.beads} min={1} max={30} step={1} onChange={(v) => patchArm(i, { beads: v })} />
                      ) : (
                        <span />
                      )}
                      <Slider
                        label="stretch"
                        value={arm.stretch}
                        min={0}
                        max={6}
                        step={0.1}
                        display={arm.stretch === 0 ? "round" : undefined}
                        onChange={(v) => patchArm(i, { stretch: v })}
                      />
                    </Cols>
                  )}
                  <Toggle
                    label="mirror, don't turn"
                    on={arm.mirror}
                    onChange={() => patchArm(i, { mirror: !arm.mirror })}
                    help="Every other copy reflected, which turns the rotation into a mirror symmetry."
                  />
                  <Cols>
                    <Slider
                      label="spin"
                      value={arm.spin}
                      min={-4}
                      max={4}
                      step={1}
                      display={arm.spin === 0 ? "held" : undefined}
                      onChange={(v) => patchArm(i, { spin: v })}
                    />
                    <Slider
                      label="breathe"
                      value={arm.pulse}
                      min={-0.6}
                      max={0.6}
                      step={0.01}
                      display={arm.pulse === 0 ? "held" : undefined}
                      onChange={(v) => patchArm(i, { pulse: v })}
                    />
                  </Cols>
                  <Cols>
                    <Slider
                      label="sway"
                      value={arm.sway}
                      min={-180}
                      max={180}
                      step={2}
                      suffix="°"
                      display={arm.sway === 0 ? "held" : undefined}
                      onChange={(v) => patchArm(i, { sway: v })}
                    />
                    {arm.shape === "chain" ? (
                      <Slider
                        label="march"
                        value={arm.march}
                        min={-6}
                        max={6}
                        step={1}
                        display={arm.march === 0 ? "held" : undefined}
                        onChange={(v) => patchArm(i, { march: v })}
                      />
                    ) : (
                      <span />
                    )}
                  </Cols>
                </Block>
              ))}
            </Section>

            <Section title="centre" summary={spec.centre.kind}>
              <Row label="what">
                <Segmented
                  value={spec.centre.kind}
                  options={[
                    { value: "none" as const, label: "none" },
                    { value: "dot" as const, label: "dot" },
                    { value: "ring" as const, label: "ring" },
                    { value: "star" as const, label: "star" },
                  ]}
                  onChange={(v) => setCentre({ kind: v as CentreKind })}
                />
              </Row>
              {spec.centre.kind !== "none" && (
                <>
                  <Slider label="size" value={spec.centre.size} min={0.005} max={0.6} step={0.005} onChange={(v) => setCentre({ size: v })} />
                  <Row label="ink">{inkDots(spec.centre.ink, (i) => setCentre({ ink: i }))}</Row>
                  {spec.centre.kind === "star" && (
                    <Slider label="points" value={spec.centre.points} min={3} max={24} step={1} onChange={(v) => setCentre({ points: v })} />
                  )}
                </>
              )}
            </Section>

            <Section title="colour" summary={paletteOf(spec.palette).name}>
              <Stack>
                <Select
                  value={spec.palette}
                  options={PALETTES.map((p) => ({ value: p.id, label: p.name }))}
                  onChange={(v) =>
                    setSpec((s) =>
                      normalize({
                        ...s,
                        palette: v,
                        frameInk: undefined,
                        frameOuterInk: undefined,
                        edgeInk: undefined,
                        ground: undefined,
                        inks: undefined,
                      }),
                    )
                  }
                />
              </Stack>
              <ColorRow
                label="band"
                value={colors.frame}
                onChange={(hex) => set("frameInk", hex)}
                onClear={spec.frameInk ? () => set("frameInk", undefined) : undefined}
              />
              <ColorRow
                label="ticks"
                value={colors.edge}
                onChange={(hex) => set("edgeInk", hex)}
                onClear={spec.edgeInk ? () => set("edgeInk", undefined) : undefined}
              />
              <ColorRow
                label="panel"
                value={colors.ground}
                onChange={(hex) => set("ground", hex)}
                onClear={spec.ground ? () => set("ground", undefined) : undefined}
              />
              <Stack label="inks">
                {colors.inks.map((hex, i) => (
                  <ColorRow
                    key={i}
                    label=""
                    value={hex}
                    onChange={(next) =>
                      set("inks", colors.inks.map((c, j) => (j === i ? next : c)))
                    }
                    onRemove={
                      colors.inks.length > 1
                        ? () => set("inks", colors.inks.filter((_, j) => j !== i))
                        : undefined
                    }
                  />
                ))}
                <Btn onClick={() => set("inks", [...colors.inks, colors.inks[0]])} wide>
                  + an ink
                </Btn>
              </Stack>
            </Section>

            {/* The Posts Studio's own effects, unforked, over the finished
                tile. They take no time as an input, so one can sit on top of
                any of this without touching the loop. */}
            <Section title="effects" summary={fx.length ? `${fx.filter((x) => !x.mute).length} on` : "none"}>
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
                {moving
                  ? "Video records at 2× and 30fps, frame by frame at each frame's own moment — so it is the same file every time, and the last frame meets the first."
                  : "Nothing in this tile moves. Give an arm a spin, a breath or a march, or turn the boil up, and the video will have something to record."}
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
