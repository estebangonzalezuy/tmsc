"use client";

// One tool, open: its questions on the right, what it makes in the middle, and
// the way out at the top.
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
  Dial,
  Group,
  HAIR,
  Row,
  Segmented,
  Swatches,
  Switch,
  Text as TextField,
} from "@/components/postlab/toolcraft";

const GROUND_NAMES = Object.fromEntries(GROUNDS.map((g) => [g.hex, g.label]));

const useTime = () => useSyncExternalStore(clock.subscribe, clock.get, clock.server);

/* The whole transport a tool needs: is it running, and where is it. Anything
   more belongs in the studio, which has a timeline. */
function Transport({
  duration,
  playing,
  onPlay,
}: {
  duration: number;
  playing: boolean;
  onPlay: (p: boolean) => void;
}) {
  const time = useTime();
  return (
    <div className={`border-t ${HAIR} px-4 py-2 flex items-center gap-3 text-[11px] shrink-0`}>
      <button onClick={() => onPlay(!playing)} className="w-4 text-center hover:text-muted">
        {playing ? "❙❙" : "▶"}
      </button>
      <input
        type="range"
        min={0}
        max={duration}
        step={1 / 60}
        value={time}
        aria-label="Playhead"
        onChange={(e) => {
          onPlay(false);
          clock.set(Number(e.target.value));
        }}
        className="flex-1 accent-foreground"
      />
      <span className="text-muted tabular-nums w-24 text-right">
        {time.toFixed(2)} / {duration.toFixed(2)}s
      </span>
    </div>
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
            className={`w-full h-7 border ${HAIR} bg-transparent px-2 text-[11px] focus:outline-none focus:border-foreground`}
          />
        );
      case "number":
        return (
          <Dial
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
          <Swatches
            palette={GROUNDS.map((g) => g.hex)}
            labels={GROUND_NAMES}
            value={String(params[f.key] ?? "")}
            onChange={(v) => set(f.key, v)}
          />
        );
      case "ink":
        return (
          <Swatches
            palette={PALETTE}
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
          <Switch
            label={f.label}
            on={params[f.key] === true}
            onChange={() => set(f.key, !(params[f.key] === true))}
            title={f.hint}
          />
        );
    }
  };

  return (
    <div className="min-h-dvh md:h-dvh flex flex-col">
      <header className="border-b border-line px-4 py-2.5 flex items-center justify-between gap-4 text-sm shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/tools"
            title="every tool"
            className="inline-flex items-center justify-center rounded-full border border-line size-8 text-xs hover:bg-foreground hover:text-background transition-colors"
          >
            ←
          </Link>
          <span className="font-serif italic text-lg truncate">{tool.name}</span>
          <span className="text-xs text-muted hidden lg:inline truncate">{tool.about}</span>
        </div>
        <div className="flex items-center gap-4 text-xs shrink-0">
          {flash && <span className="text-muted hidden sm:inline">{flash}</span>}
          {job && (
            <span className="tabular-nums">
              {job.label} — {Math.round(job.frac * 100)}%
            </span>
          )}
          <Btn onClick={savePng} on disabled={!!job}>
            Export PNG
          </Btn>
          <Link href={studioLink()} className="underline underline-offset-4">
            open in the studio
          </Link>
        </div>
      </header>

      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        <div className="md:flex-1 flex flex-col min-w-0">
          <div
            ref={stageRef}
            className="h-[52vh] md:h-auto md:flex-1 flex items-center justify-center min-h-0"
          >
            <div
              className="relative border border-line overflow-hidden"
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

          {/* A tool that makes more than one slide says so by showing them. */}
          {spec.slides.length > 1 && (
            <div className="border-t border-line px-4 py-3 flex gap-2 overflow-x-auto shrink-0">
              {spec.slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`w-[68px] shrink-0 border transition-colors ${
                    i === active ? "border-foreground" : "border-line hover:border-foreground/50"
                  }`}
                >
                  <Poster spec={spec} index={i} fonts={fonts} width={120} />
                </button>
              ))}
            </div>
          )}

          <Transport duration={spec.duration} playing={playing} onPlay={setPlaying} />
        </div>

        <aside className="w-full md:w-[360px] shrink-0 border-t md:border-t-0 md:border-l border-line md:overflow-y-auto">
          <Group title="the tool">
            {tool.fields.map((f) =>
              f.kind === "switch" || f.kind === "number" ? (
                <div key={f.key}>{control(f)}</div>
              ) : f.kind === "text" || f.kind === "lines" ? (
                <div key={f.key} className="space-y-1.5">
                  <p className="text-xs text-muted">{f.label}</p>
                  {control(f)}
                </div>
              ) : (
                <Row key={f.key} label={f.label}>
                  {control(f)}
                </Row>
              ),
            )}
          </Group>

          <Group title="out">
            <Segmented
              value={quality}
              options={[
                { value: "mid" as const, label: "mid" },
                { value: "high" as const, label: "high" },
                { value: "max" as const, label: "4K" },
              ]}
              onChange={setQuality}
            />
            <p className="text-xs text-muted tabular-nums">
              {outW}×{outH}
            </p>
            <div className="flex flex-wrap gap-2">
              <Btn onClick={savePng} on disabled={!!job}>
                PNG
              </Btn>
              {spec.slides.length > 1 && (
                <Btn onClick={saveAllPngs} disabled={!!job}>
                  PNG × {spec.slides.length}
                </Btn>
              )}
              <Btn onClick={saveVideo} disabled={!!job}>
                Video — {spec.duration}s
              </Btn>
              <Btn onClick={saveGif} disabled={!!job}>
                GIF
              </Btn>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Btn onClick={copyLink}>Copy this tool&apos;s link</Btn>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Everything you changed is in the address bar, so this link opens the
              tool exactly as it is now. The studio link at the top hands over the
              finished post instead — same post, every control.
            </p>
          </Group>
        </aside>
      </div>
    </div>
  );
}
