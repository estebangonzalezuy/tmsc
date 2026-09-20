"use client";

// the Posts Studio.
//
// One creator, one vocabulary. You pick a format, a palette and how many
// columns; you say whether the silhouettes and the fills are one kind or a
// mix; you type a line; you roll the seed until the row looks right. That is
// the whole tool, and every one of those is a selector rather than a canvas
// you have to arrange by hand — the composition is the club's, the choices
// are yours.
//
// What it replaced (the node graph, and the eight PostSpec tools before it)
// asked you to build a pipeline before you could see anything. This shows a
// finished poster on the first paint and lets you disagree with it.

import { useMemo, useRef, useState } from "react";
import {
  FILL_KINDS,
  FORMATS,
  PALETTES,
  PALETTE_KINDS,
  SILHOUETTE_KINDS,
  decodePoster,
  defaultPoster,
  drawPoster,
  encodePoster,
  makeTotems,
  type FillKind,
  type FormatKind,
  type PaletteKind,
  type Poster,
  type SilhouetteKind,
} from "@/lib/poster";
import PosterCanvas, { LOOP } from "./PosterCanvas";
import { useClockRunning, useStageFit } from "./Stage";
import { useFaces } from "./useFonts";
import { exportPng, recordGif, recordVideo, type Sheet } from "./exporter";
import {
  Btn,
  Buttons,
  Num,
  Panel,
  Row,
  Section,
  Segmented,
  Select,
  STAGE,
  Text,
  TopBar,
} from "./toolcraft";

const QUALITIES = [
  { value: "mid", label: "1080" },
  { value: "high", label: "2160" },
  { value: "max", label: "4K" },
] as const;
type Quality = (typeof QUALITIES)[number]["value"];

/* A word for each shape, so the rail reads as a vocabulary rather than a list
   of function names. */
const SILHOUETTE_LABEL: Record<SilhouetteKind, string> = {
  stadium: "Stadium",
  capsule: "Capsule",
  block: "Block",
  octagon: "Octagon",
  beads: "Beads",
  ziggurat: "Ziggurat",
  hourglass: "Hourglass",
  scallop: "Scallop",
};

const FILL_LABEL: Record<FillKind, string> = {
  solid: "Flat",
  stripes: "Stripes",
  waves: "Waves",
  blobs: "Blobs",
  chain: "Chain",
  clover: "Clover",
  camo: "Camo",
  dots: "Dots",
};

/** A fresh seed. Short and pronounceable, so it is readable in a link. */
const roll = () => Math.random().toString(36).slice(2, 8);

function fromHash(): Poster | null {
  if (typeof window === "undefined") return null;
  const m = window.location.hash.match(/poster=([^&]+)/);
  return m ? decodePoster(m[1]) : null;
}

export default function PostStudio() {
  const [poster, setPoster] = useState<Poster>(() => fromHash() ?? defaultPoster());
  const [quality, setQuality] = useState<Quality>("high");
  const [job, setJob] = useState<{ label: string; frac: number } | null>(null);
  const [said, say] = useState("");

  const faces = useFaces();
  const stageRef = useRef<HTMLDivElement>(null);
  const fit = useStageFit(stageRef, poster.format);

  /* One runner for the page, here. Every canvas reads the same clock. */
  useClockRunning(true, LOOP);

  const set = <K extends keyof Poster>(key: K, value: Poster[K]) =>
    setPoster((p) => ({ ...p, [key]: value }));

  /* Every colour this poster can put on screen, so a GIF of it encodes as
     itself rather than being quantised to the nearest grey. */
  const colours = useMemo(() => {
    const seen = new Set<string>([poster.ground]);
    for (const totem of makeTotems(poster)) {
      for (const seg of totem.segments) for (const ink of seg.inks) seen.add(ink);
    }
    return [...seen];
  }, [poster]);

  const scale = quality === "mid" ? 1 : quality === "high" ? 2 : 3840 / 1080;

  const sheet: Sheet = {
    w: FORMATS[poster.format].w,
    h: FORMATS[poster.format].h,
    duration: LOOP,
    colours,
    paint: (ctx, w, h, p) => drawPoster(ctx, poster, p, w, h, faces ?? undefined),
  };

  const run = async (label: string, fn: (report: (f: number) => void) => Promise<void>) => {
    if (job) return;
    setJob({ label, frac: 0 });
    try {
      await fn((frac) => setJob({ label, frac }));
      say("Saved");
    } catch {
      say(`${label} export failed in this browser`);
    } finally {
      setJob(null);
    }
  };

  const share = () => {
    const url = `${window.location.origin}/postlab#poster=${encodePoster(poster)}`;
    window.history.replaceState(null, "", `#poster=${encodePoster(poster)}`);
    navigator.clipboard?.writeText(url).then(
      () => say("Link copied"),
      () => say(url),
    );
  };

  return (
    <div className={`${STAGE} flex min-h-screen flex-col`}>
      <TopBar title="the Posts Studio" mark="✦">
        <Buttons>
          <Btn onClick={share} title="A link that reopens exactly this poster">
            Share
          </Btn>
          <Btn onClick={() => set("seed", roll())} title="A new row, same settings">
            Roll
          </Btn>
        </Buttons>
      </TopBar>

      <div className="flex flex-1 flex-col md:flex-row">
        {/* The rail: what a poster is made of, in the order you decide it. */}
        <Panel title="The poster" width={320} dock="left">
          <Section title="Sheet">
            <Row label="Format">
              <Segmented<FormatKind>
                value={poster.format}
                onChange={(v) => set("format", v)}
                options={(Object.keys(FORMATS) as FormatKind[]).map((f) => ({
                  value: f,
                  label: f,
                  title: FORMATS[f].label,
                }))}
              />
            </Row>
            <Row label="Columns">
              <Num value={poster.columns} min={2} max={7} step={1} onChange={(v) => set("columns", v)} />
            </Row>
            <Row label="Motion" help="Whole cycles per six-second loop. Zero holds it still.">
              <Num value={poster.motion} min={0} max={4} step={1} onChange={(v) => set("motion", v)} />
            </Row>
          </Section>

          <Section title="Colour">
            <Row label="Palette">
              <Select
                value={poster.palette}
                onChange={(v) => set("palette", v as PaletteKind)}
                options={PALETTE_KINDS.map((k) => ({ value: k, label: PALETTES[k].label }))}
              />
            </Row>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[...PALETTES[poster.palette].grounds, ...PALETTES[poster.palette].marks].map((hex, i) => (
                <span
                  key={hex + i}
                  title={hex}
                  className="h-5 w-5 rounded-[5px] border border-[color:var(--tc-edge)]"
                  style={{ background: hex }}
                />
              ))}
            </div>
          </Section>

          <Section title="Shapes">
            <Row label="Silhouette">
              <Select
                value={poster.silhouette}
                onChange={(v) => set("silhouette", v as SilhouetteKind | "mix")}
                options={[
                  { value: "mix", label: "Mixed" },
                  ...SILHOUETTE_KINDS.map((k) => ({ value: k, label: SILHOUETTE_LABEL[k] })),
                ]}
              />
            </Row>
            <Row label="Pattern">
              <Select
                value={poster.fill}
                onChange={(v) => set("fill", v as FillKind | "mix")}
                options={[
                  { value: "mix", label: "Mixed" },
                  ...FILL_KINDS.map((k) => ({ value: k, label: FILL_LABEL[k] })),
                ]}
              />
            </Row>
          </Section>

          <Section title="Words" note="Type sits on the paper, never on a shape.">
            <Row label="Kicker">
              <Text value={poster.kicker} onChange={(v) => set("kicker", v)} placeholder="the Motion Social Club" />
            </Row>
            <Row label="Line">
              <Text value={poster.title} onChange={(v) => set("title", v)} rows={3} placeholder="One honest line." />
            </Row>
            <Row label="Place">
              <Segmented<Poster["textPlace"]>
                value={poster.textPlace}
                onChange={(v) => set("textPlace", v)}
                options={[
                  { value: "bottom", label: "Bottom" },
                  { value: "top", label: "Top" },
                  { value: "none", label: "None" },
                ]}
              />
            </Row>
          </Section>
        </Panel>

        {/* The poster itself, running. */}
        <div ref={stageRef} className="flex flex-1 items-center justify-center p-6">
          <div style={{ width: fit.w }}>
            <PosterCanvas poster={poster} width={fit.w} faces={faces} live fps={24} className="rounded-[2px]" />
          </div>
        </div>

        <Panel title="Save" width={260} dock="right">
          <Section title="Size">
            <Segmented<Quality>
              value={quality}
              onChange={setQuality}
              options={QUALITIES.map((q) => ({ value: q.value, label: q.label }))}
            />
          </Section>
          <Section title="Out">
            <Buttons>
              <Btn wide disabled={!!job} onClick={() => run("PNG", () => exportPng(sheet, "tmsc-post", scale))}>
                PNG
              </Btn>
              <Btn wide disabled={!!job} onClick={() => run("Video", (r) => recordVideo(sheet, r, "tmsc-reel", scale))}>
                Video
              </Btn>
              <Btn wide disabled={!!job} onClick={() => run("GIF", (r) => recordGif(sheet, r, "tmsc-post", scale))}>
                GIF
              </Btn>
            </Buttons>
            {job && (
              <p className="pt-2 text-[12px] text-[color:var(--tc-ink-3)]">
                {job.label} {Math.round(job.frac * 100)}%
              </p>
            )}
            {!job && said && <p className="pt-2 text-[12px] text-[color:var(--tc-ink-3)]">{said}</p>}
          </Section>
          <Section title="Seed" note="The same seed always draws the same row.">
            <Row label="Now">
              <Text value={poster.seed} onChange={(v) => set("seed", v)} mono />
            </Row>
            <Buttons>
              <Btn wide onClick={() => set("seed", roll())}>
                Roll again
              </Btn>
            </Buttons>
          </Section>
        </Panel>
      </div>
    </div>
  );
}
