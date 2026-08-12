"use client";

// One tool, open — and open the same way the studio is: the stage is the whole
// window and it is black, the tool's questions float in a panel on the right,
// the transport floats under the post, and the way out is at the foot of the
// panel. A tool is a smaller door into the same building, so it cannot be a
// different-looking room.
//
// The way out matters as much as the tool. Everything here builds a PostSpec,
// so "open in the studio" hands over the finished post rather than starting
// again — a tool is a shortcut through the studio, never a walled garden. And
// because the params live in the URL, a tool with its fields filled in is a
// link: send it and it arrives set up.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { GROUNDS, PALETTE, encodeSpec, FORMATS, type PostFormat } from "@/lib/postlab";
import {
  decodeParams,
  encodeParams,
  startingParams,
  toolDef,
  type Field,
  type Params,
} from "@/lib/tools";
import Poster from "@/components/postlab/Poster";
import Stage, { useClockRunning, useStageFit } from "@/components/postlab/Stage";
import { clock } from "@/components/postlab/clock";
import { loadFonts, type Fonts } from "@/components/postlab/overlay";
import { useExports } from "@/components/postlab/useExports";
import {
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
  Sep,
  Slider,
  Stack,
  Text as TextField,
  Toggle,
  Toolbar,
} from "@/components/postlab/toolcraft";

const GROUND_NAMES = Object.fromEntries(GROUNDS.map((g) => [g.hex, g.label]));

const useTime = () => useSyncExternalStore(clock.subscribe, clock.get, clock.server);

/* The playhead readout, and the only thing in here that re-renders with the
   clock — the canvases subscribe to it themselves. */
function Playhead({ duration, onScrub }: { duration: number; onScrub: () => void }) {
  const time = useTime();
  return (
    <>
      {/* The same track shape as every slider in the chrome: a hairline with the
          travelled part filled behind the input, which paints nothing itself. */}
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
            /* Taking hold of the playhead is taking hold of the post. */
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

export default function ToolViewer({ id }: { id: string }) {
  const tool = toolDef(id)!;
  const [now, setNow] = useState(() => new Date());
  const [params, setParams] = useState<Params>(() => startingParams(tool, new Date()));
  const [fonts, setFonts] = useState<Fonts | null>(null);
  const [playing, setPlaying] = useState(true);
  const [index, setIndex] = useState(0);
  const [flash, setFlash] = useState("");

  const stageRef = useRef<HTMLDivElement>(null);
  const shaderBoxRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const ownHashRef = useRef<string | null>(null);

  /* Params in, a whole post out. This is the only thing a tool does. */
  const spec = useMemo(() => tool.build(params, now), [tool, params, now]);
  const active = Math.min(index, spec.slides.length - 1);
  const stageSize = useStageFit(stageRef, spec.format);

  useClockRunning(playing, spec.duration);

  /* The link is read once the fonts are in, which is also the first moment the
     post can be drawn — and it keeps the read out of the effect body, where a
     synchronous setState would cascade a render. */
  useEffect(() => {
    const encoded = window.location.hash.match(/p=([^&]+)/)?.[1];
    const decoded = encoded ? decodeParams(tool, encoded) : null;
    loadFonts().then((f) => {
      setFonts(f);
      if (decoded) setParams(decoded);
    });
  }, [tool]);

  /* A countdown has to stay true while the tab is open, so today is re-read
     every minute rather than at load. Nothing else notices. */
  useEffect(() => {
    if (!tool.fields.some((f) => f.kind === "date")) return;
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [tool]);

  /* Keep the link current as the fields change. */
  useEffect(() => {
    const timer = setTimeout(() => {
      const encoded = encodeParams(tool, params);
      ownHashRef.current = encoded;
      window.history.replaceState(null, "", `#p=${encoded}`);
    }, 400);
    return () => clearTimeout(timer);
  }, [tool, params]);

  const say = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  };

  const set = (key: string, value: string | number | boolean) =>
    setParams((p) => ({ ...p, [key]: value }));

  const {
    job,
    quality,
    setQuality,
    outW,
    outH,
    savePng,
    saveAllPngs,
    saveVideo,
    saveGif,
  } = useExports({
    spec,
    index: active,
    fonts,
    shaderBoxRef,
    overlayRef,
    setIndex,
    say,
  });

  const studioLink = () => `/postlab#spec=${encodeSpec(spec)}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    say("Link copied — it opens this tool, filled in");
  };

  const control = (f: Field) => {
    switch (f.kind) {
      case "text":
        return (
          <TextField
            value={String(params[f.key] ?? "")}
            rows={f.rows}
            placeholder={f.placeholder}
            onChange={(v) => set(f.key, v)}
          />
        );
      case "lines":
        return (
          <TextField
            value={String(params[f.key] ?? "")}
            rows={6}
            placeholder={f.placeholder}
            onChange={(v) => set(f.key, v)}
          />
        );
      case "date":
        return (
          <input
            type="date"
            value={String(params[f.key] ?? "")}
            onChange={(e) => set(f.key, e.target.value)}
            className="tc-field w-full h-[var(--tc-h)] px-3 text-[13px] focus:outline-none"
          />
        );
      case "number":
        return (
          <Slider
            label={f.label}
            value={Number(params[f.key] ?? f.min)}
            min={f.min}
            max={f.max}
            step={f.step}
            onChange={(v) => set(f.key, v)}
          />
        );
      case "choice":
        return (
          <Segmented
            value={String(params[f.key] ?? f.values[0].value)}
            options={f.values}
            onChange={(v) => set(f.key, v)}
          />
        );
      case "ground":
        return (
          <Dots
            colors={GROUNDS.map((g) => g.hex)}
            labels={GROUND_NAMES}
            value={String(params[f.key] ?? "")}
            onChange={(v) => set(f.key, v)}
          />
        );
      case "ink":
        return (
          <Dots
            colors={PALETTE}
            value={String(params[f.key] ?? "")}
            onChange={(v) => set(f.key, v)}
          />
        );
      case "format":
        return (
          <Segmented
            value={String(params[f.key] ?? "portrait") as PostFormat}
            options={(Object.keys(FORMATS) as PostFormat[]).map((k) => ({
              value: k,
              label: FORMATS[k].label,
              title: FORMATS[k].hint,
            }))}
            onChange={(v) => set(f.key, v)}
          />
        );
      case "switch":
        return (
          <Toggle
            label={f.label}
            on={params[f.key] === true}
            onChange={() => set(f.key, !(params[f.key] === true))}
            help={f.hint}
          />
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
          <div
            className="relative overflow-hidden shrink-0"
            style={{ width: stageSize.w, height: stageSize.h }}
          >
            <Stage
              spec={spec}
              index={active}
              fonts={fonts}
              shaderBoxRef={shaderBoxRef}
              overlayRef={overlayRef}
            />
          </div>
        </div>

        {/* Top left: which tool this is, and the way back to the wall. */}
        <div className="md:absolute md:top-3 md:left-3 z-20 flex items-center gap-1.5 p-2 md:p-0 overflow-x-auto">
          <Link
            href="/tools"
            title="every tool"
            className="tc-float rounded-[var(--tc-r)] size-9 shrink-0 inline-grid place-items-center text-[13px] hover:bg-[color:var(--tc-field-hi)] transition-colors"
          >
            ←
          </Link>
          <span
            className="tc-float rounded-[var(--tc-r)] h-9 px-3 flex items-center gap-2.5 shrink-0"
          >
            <span className="text-[13px] font-medium">{tool.name}</span>
            <span className="text-[11px] text-[color:var(--tc-ink-3)] hidden xl:block max-w-[320px] truncate">
              {tool.about}
            </span>
          </span>
          <Link
            href={studioLink()}
            className="tc-float rounded-[var(--tc-r)] h-9 px-3 flex items-center text-[12.5px] shrink-0 hover:bg-[color:var(--tc-field-hi)]"
          >
            open in the studio →
          </Link>
          {(flash || job) && (
            <span className="tc-float rounded-[var(--tc-r)] h-9 px-3 flex items-center text-[12.5px] shrink-0 tabular-nums">
              {job ? `${job.label} — ${Math.round(job.frac * 100)}%` : flash}
            </span>
          )}
        </div>

        {/* Top right: the tool's questions, and its way out at the foot. */}
        <div className="md:absolute md:top-3 md:right-3 md:bottom-3 z-20 flex p-2 md:p-0">
          <Panel
            title={tool.name}
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
            <Section title="the tool">
              {tool.fields.map((f) =>
                f.kind === "switch" || f.kind === "number" ? (
                  <div key={f.key}>{control(f)}</div>
                ) : f.kind === "text" || f.kind === "lines" ? (
                  <Stack key={f.key} label={f.label}>
                    {control(f)}
                  </Stack>
                ) : (
                  <Row key={f.key} label={f.label}>
                    {control(f)}
                  </Row>
                ),
              )}
            </Section>

            <Section title="out" summary={`${outW}×${outH}`}>
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
              {spec.slides.length > 1 && (
                <Btn onClick={saveAllPngs} disabled={!!job} wide>
                  PNG — all {spec.slides.length}
                </Btn>
              )}
              <p className="text-[11px] text-[color:var(--tc-ink-3)] leading-relaxed">
                Everything you changed is in the address bar, so the Link button
                hands over this tool exactly as it is now. The studio link at the
                top hands over the finished post instead — same post, every
                control.
              </p>
            </Section>
          </Panel>
        </div>

        {/* Bottom left: the slides, when a tool makes more than one. */}
        {spec.slides.length > 1 && (
          <div className="md:absolute md:left-3 md:bottom-3 z-20 p-2 md:p-0 max-w-full">
            <div
              className="tc-float rounded-[var(--tc-r-lg)] p-2 flex items-end gap-2 overflow-x-auto"
            >
              {spec.slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`shrink-0 border transition-colors ${
                    i === active
                      ? "border-[color:var(--tc-sel)]"
                      : "border-[color:var(--tc-edge)] hover:border-[color:var(--tc-edge-on)]"
                  }`}
                >
                  <Poster spec={spec} index={i} fonts={fonts} width={64} live />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bottom centre: the whole transport a tool needs. Anything more
            belongs in the studio, which has a timeline. */}
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
