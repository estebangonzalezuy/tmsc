"use client";

// The right dock: every param of the selected node, generic controls driven
// straight off its NodeDef (a ShaderControl -> Slider, a ShaderChoice ->
// Segmented/Select, a TextField -> Text) plus a few node kinds' own bespoke
// sections that don't fit that shape — field's ramp editor, shape's mark
// list, photo's dropzone, and the ink/ground pickers `type`/`filter` carry.
// Edits all funnel through one updateParams(patch) into the graph's React
// state; nothing here needs debouncing beyond React's own batching.

import { useState, type ReactNode } from "react";
import { inputPorts, nodeDef, type GraphNode, type ParamValue } from "@/lib/postgraph";
import { FIELD_PRESET_RAMPS, KINETIC_PRESET_PALETTES, PALETTE, cleanInks, kineticPaletteOf, rerollInks } from "@/lib/palette";
import {
  Panel,
  Section,
  Slider,
  Segmented,
  Select,
  Text,
  Toggle,
  ColorRow,
  Block,
  Btn,
  XYPad,
  Dropzone,
  Thumb,
} from "../toolcraft";
import { parseMarks, stringifyMarks, defaultMark, MARK_KINDS, ALONG, type Mark } from "../nodes/shape";
import { visibleFor as kineticVisible } from "../nodes/kinetic";
import { photoUrl, savePhoto, readFile } from "../photos";
import { saveClip } from "../clips";

export default function Inspector({
  node,
  onChange,
  footer,
}: {
  node: GraphNode | null;
  onChange: (id: string, patch: Record<string, ParamValue>) => void;
  footer?: ReactNode;
}) {
  if (!node) {
    return (
      <Panel title="Inspector" dock="right" footer={footer}>
        <div className="p-4 text-[12.5px] text-[color:var(--tc-ink-3)]">Pick a node to edit it.</div>
      </Panel>
    );
  }

  const def = nodeDef(node.kind);
  const set = (patch: Record<string, ParamValue>) => onChange(node.id, patch);
  /* `kinetic` alone has enough controls (~50, across 7 scenes) that showing
     every one flat and unfiltered would be unusable — every other node kind
     shows its whole def as before. */
  const scene = String(node.params.scene ?? "stagger");
  const visible = (key: string) => node.kind !== "kinetic" || kineticVisible(scene, key);

  return (
    <Panel title={def.label} dock="right" footer={footer}>
      <Section title="Controls">
        <div className="space-y-3">
          {def.controls.filter((c) => visible(c.key)).map((c) => (
            <Slider
              key={c.key}
              label={c.label}
              value={Number(node.params[c.key] ?? c.def)}
              min={c.min}
              max={c.max}
              step={c.step}
              onChange={(v) => set({ [c.key]: v })}
            />
          ))}
          {(def.choices ?? []).filter((c) => visible(c.key)).map((c) =>
            c.values.length <= 4 ? (
              <Row key={c.key} label={c.label}>
                <Segmented
                  value={String(node.params[c.key] ?? c.def)}
                  options={c.values.map((v) => ({ value: v, label: v }))}
                  onChange={(v) => set({ [c.key]: v })}
                />
              </Row>
            ) : (
              <Row key={c.key} label={c.label}>
                <Select
                  value={String(node.params[c.key] ?? c.def)}
                  options={c.values.map((v) => ({ value: v, label: v }))}
                  onChange={(v) => set({ [c.key]: v })}
                />
              </Row>
            ),
          )}
          {node.kind === "type" && (
            <Row key="italic" label="italic">
              <Toggle on={!!node.params.italic} onChange={() => set({ italic: !node.params.italic })} />
            </Row>
          )}
          {(def.bools ?? []).filter((c) => visible(c.key)).map((c) => (
            <Row key={c.key} label={c.label}>
              <Toggle on={!!node.params[c.key]} onChange={() => set({ [c.key]: !node.params[c.key] })} help={c.hint} />
            </Row>
          ))}
        </div>
      </Section>

      {(def.texts ?? []).filter((t) => visible(t.key)).length > 0 && (
        <Section title="Words">
          <div className="space-y-3">
            {(def.texts ?? []).filter((t) => visible(t.key)).map((t) => (
              <div key={t.key} className="space-y-1">
                <span className="text-[11px] text-[color:var(--tc-ink-3)]">{t.label}</span>
                <Text
                  value={String(node.params[t.key] ?? "")}
                  rows={t.rows ?? 1}
                  onChange={(v) => set({ [t.key]: v })}
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      {(node.kind === "type" || node.kind === "filter") && (
        <Section title="Colour">
          <div className="space-y-3">
            <ColorRow label="Ink" value={String(node.params.ink ?? "#000000")} onChange={(hex) => set({ ink: hex })} />
            <ColorRow label="Ground" value={String(node.params.ground ?? "#ffffff")} onChange={(hex) => set({ ground: hex })} />
          </div>
        </Section>
      )}

      {node.kind === "shape" && (
        <Section title="Colour">
          <ColorRow label="Ink" value={String(node.params.ink ?? "#000000")} onChange={(hex) => set({ ink: hex })} />
        </Section>
      )}

      {node.kind === "field" && <FieldRamp node={node} set={set} />}
      {node.kind === "kinetic" && <KineticColour node={node} set={set} />}
      {node.kind === "shape" && <ShapeMarks node={node} set={set} />}
      {node.kind === "photo" && <PhotoSource node={node} set={set} />}
      {node.kind === "showreel" && (
        <Section title="Frames">
          <p className="text-[11.5px] leading-relaxed text-[color:var(--tc-ink-3)]">
            {inputPorts(node).filter((p) => p !== "in-1").length + 1} slots. Wire a frame&rsquo;s output into an
            empty in-N port to add it to the carousel, in order.
          </p>
        </Section>
      )}
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[12.5px] text-[color:var(--tc-ink-2)] w-24 shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------- field ramp */

function FieldRamp({ node, set }: { node: GraphNode; set: (p: Record<string, ParamValue>) => void }) {
  const inks = cleanInks(node.params.inks);
  const [seed, setSeed] = useState(1);
  return (
    <Section title="Ramp" summary={`${inks.length} colours`}>
      <div className="space-y-3">
        <Row label="preset">
          <Select
            value=""
            options={FIELD_PRESET_RAMPS.map((r) => ({ value: r.id, label: r.label }))}
            onChange={(id) => {
              const r = FIELD_PRESET_RAMPS.find((x) => x.id === id);
              if (r) set({ inks: [...r.inks] });
            }}
          />
        </Row>
        <div className="space-y-1.5">
          {inks.map((hex, i) => (
            <ColorRow
              key={i}
              label={i === 0 ? "centre" : i === inks.length - 1 ? "edge" : ""}
              value={hex}
              onChange={(v) => {
                const next = [...inks];
                next[i] = v;
                set({ inks: next });
              }}
              onRemove={inks.length > 2 ? () => set({ inks: inks.filter((_, j) => j !== i) }) : undefined}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Btn onClick={() => inks.length < 8 && set({ inks: [...inks, "#000000"] })}>+ colour</Btn>
          <Btn
            onClick={() => {
              const s = seed + 1;
              setSeed(s);
              set({ inks: rerollInks(s, PALETTE, Math.max(2, inks.length)) });
            }}
          >
            new colours
          </Btn>
        </div>
      </div>
    </Section>
  );
}

/* ----------------------------------------------------------- kinetic colour */

/* Same shape as FieldRamp, plus a ground swatch — a kinetic preset carries
   both because every reference it came from picked ground and inks
   together (pink type on black is one decision, not two). Picking a preset
   sets both `inks` and `ground`; either can then be hand-edited without
   losing the other. */
function KineticColour({ node, set }: { node: GraphNode; set: (p: Record<string, ParamValue>) => void }) {
  const preset = kineticPaletteOf(String(node.params.paletteId ?? "meaning"));
  const inks = cleanInks(node.params.inks, preset.inks);
  const [seed, setSeed] = useState(1);
  return (
    <Section title="Colour" summary={`${inks.length} inks`}>
      <div className="space-y-3">
        <Row label="preset">
          <Select
            value={String(node.params.paletteId ?? "meaning")}
            options={KINETIC_PRESET_PALETTES.map((p) => ({ value: p.id, label: p.label }))}
            onChange={(id) => {
              const p = kineticPaletteOf(id);
              set({ paletteId: id, inks: [...p.inks], ground: p.ground });
            }}
          />
        </Row>
        <ColorRow label="Ground" value={String(node.params.ground ?? preset.ground)} onChange={(hex) => set({ ground: hex })} />
        <div className="space-y-1.5">
          {inks.map((hex, i) => (
            <ColorRow
              key={i}
              label={i === 0 ? "ink 1" : undefined}
              value={hex}
              onChange={(v) => {
                const next = [...inks];
                next[i] = v;
                set({ inks: next });
              }}
              onRemove={inks.length > 1 ? () => set({ inks: inks.filter((_, j) => j !== i) }) : undefined}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Btn onClick={() => inks.length < 8 && set({ inks: [...inks, "#ffffff"] })}>+ ink</Btn>
          <Btn
            onClick={() => {
              const s = seed + 1;
              setSeed(s);
              set({ inks: rerollInks(s, preset.inks.length >= 2 ? preset.inks : PALETTE, Math.max(2, inks.length)) });
            }}
          >
            new colours
          </Btn>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------- shape marks */

function ShapeMarks({ node, set }: { node: GraphNode; set: (p: Record<string, ParamValue>) => void }) {
  const marks = parseMarks(String(node.params.marksJson ?? "[]"));
  const write = (next: Mark[]) => set({ marksJson: stringifyMarks(next) });
  const patchMark = (i: number, patch: Partial<Mark>) => {
    const next = marks.map((m, j) => (j === i ? { ...m, ...patch } : m));
    write(next);
  };
  return (
    <Section title="Marks" summary={`${marks.length}`}>
      <div className="space-y-2.5">
        {marks.map((m, i) => (
          <Block
            key={i}
            title={m.kind}
            onRemove={marks.length > 1 ? () => write(marks.filter((_, j) => j !== i)) : undefined}
            onUp={i > 0 ? () => write(swap(marks, i, i - 1)) : undefined}
            onDown={i < marks.length - 1 ? () => write(swap(marks, i, i + 1)) : undefined}
          >
            <Row label="kind">
              <Select value={m.kind} options={MARK_KINDS.map((k) => ({ value: k, label: k }))} onChange={(v) => patchMark(i, { kind: v })} />
            </Row>
            <XYPad label="position" x={m.x} y={m.y} onChange={(x, y) => patchMark(i, { x, y })} />
            <Slider label="size" value={m.size} min={0.02} max={1} step={0.01} onChange={(v) => patchMark(i, { size: v })} />
            <Slider label="weight" value={m.weight} min={0} max={20} step={0.5} onChange={(v) => patchMark(i, { weight: v })} />
            <Slider label="rotation" value={m.rotation} min={0} max={360} step={1} onChange={(v) => patchMark(i, { rotation: v })} />
            <Slider label="opacity" value={m.opacity} min={0} max={1} step={0.01} onChange={(v) => patchMark(i, { opacity: v })} />
            <Slider label="repeat" value={m.repeat} min={1} max={24} step={1} onChange={(v) => patchMark(i, { repeat: v })} />
            <Row label="along">
              <Segmented value={m.along} options={ALONG.map((a) => ({ value: a, label: a }))} onChange={(v) => patchMark(i, { along: v })} />
            </Row>
            <Slider label="spread" value={m.spread} min={0} max={1} step={0.01} onChange={(v) => patchMark(i, { spread: v })} />
            <Slider label="jitter" value={m.jitter} min={0} max={1} step={0.01} onChange={(v) => patchMark(i, { jitter: v })} />
            <Slider label="twist" value={m.twist} min={-45} max={45} step={1} onChange={(v) => patchMark(i, { twist: v })} />
            <Slider label="taper" value={m.taper} min={0} max={1} step={0.01} onChange={(v) => patchMark(i, { taper: v })} />
          </Block>
        ))}
        <Btn wide onClick={() => write([...marks, defaultMark()])}>
          + mark
        </Btn>
      </div>
    </Section>
  );
}

function swap<T>(list: T[], i: number, j: number): T[] {
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/* -------------------------------------------------------------- photo src */

function PhotoSource({ node, set }: { node: GraphNode; set: (p: Record<string, ParamValue>) => void }) {
  const src = String(node.params.src ?? "");
  const url = photoUrl(src);
  const pickFile = async (file: File) => {
    const gif = /gif|webp/i.test(file.type) || /\.(gif|webp)$/i.test(file.name);
    const video = file.type.startsWith("video/") || gif;
    if (video) {
      const clipSrc = await saveClip(file).catch(() => "");
      if (clipSrc) set({ src: clipSrc });
    } else {
      const dataUrl = await readFile(file);
      set({ src: savePhoto(dataUrl) });
    }
  };
  return (
    <Section title="Source">
      {src ? (
        <Thumb src={url ?? undefined} onRemove={() => set({ src: "" })} caption={src.startsWith("clip:") ? "A film or GIF, kept in this browser." : undefined} />
      ) : (
        <Dropzone accept="image/*,video/*" onFile={(f) => void pickFile(f)} hint="Drop a picture, film or GIF" />
      )}
    </Section>
  );
}
