// The Editor: a project of text clips, each playing one catalog spec, laid out
// on DialKit's timeline dock. DialKit owns the transport and the clip bars
// (drag to move, resize to stretch the hold); our renderAt draws every frame
// from the project at the playhead, so preview == export.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DialRoot, DialTimeline, useDialTimeline, useDialKitController, type TimelineConfig } from "dialkit";
import { renderAt, projectDuration, clipNatural } from "@core/render.ts";
import type { Clip, Project, Spec } from "@core/types.ts";
import type { CatalogState } from "../catalog.ts";
import { useFrame } from "../useFrame.ts";
import { exportWebm } from "./exportWebm.ts";

const bundledProjects = import.meta.glob<Project>("@projects/*.json", { eager: true, import: "default" });

/** The club's locked pairs. A piece uses one pair, plus black and white. */
export const PAIRS: Record<string, { label: string; bg: string; ink: string }> = {
  acid: { label: "acid / ink", bg: "#E4FC24", ink: "#0C0C0C" },
  lilac: { label: "lilac / brown", bg: "#CC84FC", ink: "#3C240C" },
  magenta: { label: "magenta / green", bg: "#F06CCC", ink: "#0C540C" },
  indigo: { label: "indigo / white", bg: "#3D3DEB", ink: "#FFFFFF" },
  periwinkle: { label: "periwinkle / ink", bg: "#ADB4F5", ink: "#0C0C0C" },
  yellow: { label: "yellow / ink", bg: "#F4C500", ink: "#0C0C0C" },
  orange: { label: "orange / ink", bg: "#EE4B2B", ink: "#0C0C0C" },
  green: { label: "green / white", bg: "#2E7D46", ink: "#FFFFFF" },
  paper: { label: "white / ink", bg: "#FFFFFF", ink: "#0C0C0C" },
};
const FORMATS: Record<string, [number, number]> = { square: [1080, 1080], landscape: [1920, 1080], story: [1080, 1920] };

type ClipTimes = { at: number; duration: number };
type Control = { time: number; playing: boolean; play: () => void; pause: () => void; replay: () => void; seek: (s: number) => void };

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const toPanelText = (t: string) => String(t).replace(/\n/g, " / ");
const fromPanelText = (t: string) => String(t).replace(/\s*\/\s*/g, "\n");
// Dock rows are labelled from their key, so key them by the clip's text. The
// map is fixed when the bridge mounts, so editing text can't orphan a row.
const slug = (t: string) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").slice(0, 3).join(" ");
function keyMapOf(clips: Clip[]) {
  const map: Record<string, string> = {};
  clips.filter((c) => !c.static).forEach((c, i) => (map[c.id] = `${i + 1} ${slug(c.text) || c.id}`));
  return map;
}

function initialProjects(): Record<string, Project> {
  const out: Record<string, Project> = {};
  for (const p of Object.values(bundledProjects)) out[p.name] = p;
  return out;
}

function loadDraft(): Project | null {
  try {
    const raw = localStorage.getItem("anticipator:editor");
    return raw ? (JSON.parse(raw) as Project) : null;
  } catch {
    return null;
  }
}

/**
 * Registers the project as a DialKit timeline and reports back: the playhead
 * every frame, and any clip the user moved or resized in the dock. Keyed by
 * the parent so it remounts whenever *we* change times or the clip set.
 */
function TimelineBridge({ project, timeRef, controlRef, onDockEdit }: {
  project: Project;
  timeRef: React.MutableRefObject<number>;
  controlRef: React.MutableRefObject<Control | null>;
  onDockEdit: (id: string, at: number, dur: number) => void;
}) {
  const keys = useMemo(() => keyMapOf(project.clips), []); // eslint-disable-line react-hooks/exhaustive-deps
  const config = useMemo(() => {
    const c: TimelineConfig = { duration: Math.max(1, projectDuration(project) / 1000) };
    for (const clip of project.clips) {
      if (clip.static) continue;
      const d = clip.duration_ms / 1000;
      c[keys[clip.id]] = { at: clip.at_ms / 1000, duration: d, from: { progress: 0 }, to: { progress: 1 }, transition: { type: "easing", duration: d, ease: [0, 0, 1, 1] } };
    }
    return c;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const tl = useDialTimeline(`Timeline · ${project.name}`, config, { loop: true, autoplay: true });
  timeRef.current = tl.time * 1000;
  controlRef.current = tl;
  const clips = tl as unknown as Record<string, ClipTimes | undefined>;
  useEffect(() => {
    for (const clip of project.clips) {
      const v = keys[clip.id] ? clips[keys[clip.id]] : undefined;
      if (!v) continue;
      const at = Math.round(v.at * 1000), dur = Math.round(v.duration * 1000);
      if (Math.abs(at - clip.at_ms) > 1 || Math.abs(dur - clip.duration_ms) > 1) onDockEdit(clip.id, at, dur);
    }
  });
  return null;
}

/** DialKit panel for the selected clip: text, ink, size, position, stagger, spring overrides. */
function ClipPanel({ clip, spec, pair, onPatch }: { clip: Clip; spec?: Spec; pair: { bg: string; ink: string }; onPatch: (id: string, patch: Partial<Clip>) => void }) {
  const s = spec?.enter?.x_spring || { stiffness: 260, damping: 18, mass: 1 };
  const inks = [pair.ink, pair.bg, "#0C0C0C", "#FFFFFF"].filter((v, i, a) => a.indexOf(v) === i);
  const config = useMemo(() => ({
    text: { type: "text" as const, default: toPanelText(clip.text), placeholder: "use / for a line break" },
    ink: { type: "select" as const, options: inks, default: clip.ink && inks.includes(clip.ink) ? clip.ink : inks[0] },
    size: [clip.fontPx || 120, 30, 300, 1] as [number, number, number, number],
    y: [clip.y ?? 0.5, 0.05, 0.95, 0.01] as [number, number, number, number],
    stagger: [clip.overrides?.stagger_ms ?? spec?.enter?.stagger_ms ?? 40, 0, 240, 1] as [number, number, number, number],
    spring: {
      override: !!clip.overrides?.x_spring,
      stiffness: [clip.overrides?.x_spring?.stiffness ?? s.stiffness, 20, 1000, 1] as [number, number, number, number],
      damping: [clip.overrides?.x_spring?.damping ?? s.damping, 1, 100, 0.5] as [number, number, number, number],
      mass: [clip.overrides?.x_spring?.mass ?? s.mass, 0.2, 6, 0.1] as [number, number, number, number],
    },
  }), [clip.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const ctl = useDialKitController("Clip", config);
  const v = ctl.values;
  useEffect(() => {
    const overrides = { ...(clip.overrides || {}) };
    if (v.stagger !== spec?.enter?.stagger_ms) overrides.stagger_ms = v.stagger;
    else delete overrides.stagger_ms;
    if (v.spring.override) overrides.x_spring = { stiffness: v.spring.stiffness, damping: v.spring.damping, mass: v.spring.mass };
    else delete overrides.x_spring;
    const patch = { text: fromPanelText(v.text), ink: v.ink, fontPx: v.size, y: v.y, overrides };
    const same = patch.text === clip.text && patch.ink === clip.ink && patch.fontPx === clip.fontPx && patch.y === (clip.y ?? 0.5)
      && JSON.stringify(overrides) === JSON.stringify(clip.overrides || {});
    if (!same) onPatch(clip.id, patch);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function Editor({ cat }: { cat: CatalogState }) {
  const [projects, setProjects] = useState(initialProjects);
  const [project, setProject] = useState<Project>(() => loadDraft() || clone(initialProjects()["tmsc-timeline"] || Object.values(initialProjects())[0]));
  const [selectedId, setSelectedId] = useState(() => project.clips.find((c) => !c.static)?.id);
  const [bridgeKey, setBridgeKey] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const controlRef = useRef<Control | null>(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  const specsRef = useRef(cat.specs);
  specsRef.current = cat.specs;
  const measureCtx = useMemo(() => document.createElement("canvas").getContext("2d")!, []);

  // Read-only automation hook (Playwright checks).
  useEffect(() => {
    window.__editor = { time: () => timeRef.current, project: () => projectRef.current, control: () => controlRef.current };
  }, []);
  useEffect(() => {
    fetch("/api/projects").then((r) => (r.ok ? r.json() : null)).then((p) => p && setProjects(p)).catch(() => {});
  }, []);
  useEffect(() => {
    try { localStorage.setItem("anticipator:editor", JSON.stringify(project)); } catch { /* private mode */ }
  }, [project]);

  // Our side changed times or clips: remount the bridge so DialKit re-reads them.
  const commit = useCallback((fn: (p: Project) => void, retime = false) => {
    setProject((p) => { const n = clone(p); fn(n); return n; });
    if (retime) setBridgeKey((k) => k + 1);
  }, []);
  const patchClip = useCallback((id: string, patch: Partial<Clip>) => {
    setProject((p) => {
      const n = clone(p);
      const c = n.clips.find((x) => x.id === id);
      if (c) Object.assign(c, patch);
      return n;
    });
  }, []);
  const onDockEdit = useCallback((id: string, at: number, dur: number) => patchClip(id, { at_ms: at, duration_ms: dur }), [patchClip]);

  // Preview: one canvas, drawn from the project at DialKit's playhead.
  useFrame(() => {
    const c = canvasRef.current;
    if (!c) return;
    const p = projectRef.current;
    if (c.width !== p.width || c.height !== p.height) { c.width = p.width; c.height = p.height; }
    renderAt(c.getContext("2d")!, p, specsRef.current, timeRef.current);
  });

  const selected = project.clips.find((c) => c.id === selectedId);
  const pairKey = Object.entries(PAIRS).find(([, v]) => v.bg.toLowerCase() === String(project.background).toLowerCase())?.[0] || "paper";
  const pair = PAIRS[pairKey];
  const formatKey = Object.entries(FORMATS).find(([, [w, h]]) => w === project.width && h === project.height)?.[0] || "square";
  const specIds = cat.catalog.visible_ids.filter((id) => cat.specs[id]);
  const naturalOf = (clip: Clip) => clipNatural(measureCtx, clip, cat.specs, project.width);
  const editClip = (fn: (c: Clip) => void, retime = false) => commit((p) => { const c = p.clips.find((x) => x.id === selectedId); if (c) fn(c); }, retime);

  const addClip = () => {
    const id = `c${Date.now().toString(36)}`;
    const clip: Clip = { id, specId: specIds[0], text: "new clip", ink: pair.ink, at_ms: projectDuration(project), duration_ms: 2000, fontPx: 140, y: 0.5 };
    const nat = naturalOf(clip);
    if (nat) clip.duration_ms = Math.round(nat.total);
    commit((p) => { p.clips.push(clip); }, true);
    setSelectedId(id);
  };
  const removeClip = (id: string) => {
    commit((p) => { p.clips = p.clips.filter((c) => c.id !== id); }, true);
    if (selectedId === id) setSelectedId(project.clips.find((c) => c.id !== id && !c.static)?.id);
  };
  const fitLength = () => editClip((c) => {
    const nat = clipNatural(measureCtx, c, cat.specs, project.width);
    if (nat) c.duration_ms = Math.round(nat.total);
  }, true);
  const setPair = (k: string) => commit((p) => {
    const old = PAIRS[pairKey];
    p.background = PAIRS[k].bg;
    for (const c of p.clips) if (c.ink === old.ink) c.ink = PAIRS[k].ink;
  });
  const setFormat = (k: string) => commit((p) => { [p.width, p.height] = FORMATS[k]; });
  const openProject = (name: string) => {
    const p = clone(projects[name]);
    setProject(p);
    setSelectedId(p.clips.find((c) => !c.static)?.id);
    setBridgeKey((k) => k + 1);
  };
  const saveProject = async () => {
    const r = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project }) }).catch(() => null);
    if (r?.ok) {
      const { name } = (await r.json()) as { name: string };
      setProjects((ps) => ({ ...ps, [name]: clone(project) }));
      setStatus(`Saved projects/${name}.json. Export it with: npm run export -- ${name}`);
    } else {
      download(`${project.name}.json`, JSON.stringify(project, null, 2));
      setStatus("No dev server here, so the project JSON was downloaded.");
    }
  };
  const onExport = async () => {
    setExporting(0);
    try {
      const blob = await exportWebm(project, cat.specs, { onProgress: (f) => setExporting(f) });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${project.name}.webm`;
      a.click();
      setStatus(`Exported ${project.name}.webm (${(blob.size / 1e6).toFixed(1)} MB).`);
    } catch (e) {
      setStatus((e as Error).message);
    }
    setExporting(null);
  };

  const animated = project.clips.filter((c) => !c.static);
  const total = projectDuration(project);
  const nat = selected ? naturalOf(selected) : null;

  return (
    <div className="editor">
      <TimelineBridge key={`${project.name}-${bridgeKey}`} project={project} timeRef={timeRef} controlRef={controlRef} onDockEdit={onDockEdit} />
      {selected && !selected.static && (
        <ClipPanel key={`${selected.id}-${selected.specId}-${bridgeKey}`} clip={selected} spec={selected.specId ? cat.specs[selected.specId] : undefined} pair={pair} onPatch={patchClip} />
      )}
      <main className="viewer">
        <canvas ref={canvasRef} width={project.width} height={project.height} style={{ aspectRatio: `${project.width} / ${project.height}` }} aria-label="Preview" />
        <div className="transport">
          <button className="btn" onClick={() => (controlRef.current?.playing ? controlRef.current.pause() : controlRef.current?.play())}>Play / pause</button>
          <button className="btn" onClick={() => controlRef.current?.replay()}>Replay</button>
          <span className="label">{(total / 1000).toFixed(2)}s · {project.width}×{project.height} · {project.fps || 30}fps</span>
          <span className="transport-hint">Drag clips in the timeline below to move them; resize to stretch the hold (springs keep their physics).</span>
        </div>
      </main>

      <aside className="inspector" aria-label="Project">
        <span className="label">Project</span>
        <div className="row2">
          <select className="field" value={project.name} onChange={(e) => openProject(e.target.value)} aria-label="Open project">
            {!projects[project.name] && <option value={project.name}>{project.name} (unsaved)</option>}
            {Object.keys(projects).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <input className="field" type="text" value={project.name} onChange={(e) => commit((p) => { p.name = e.target.value; })} aria-label="Project name" />
        </div>
        <div className="row2">
          <select className="field" value={pairKey} onChange={(e) => setPair(e.target.value)} aria-label="Colour pair">
            {Object.entries(PAIRS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="field" value={formatKey} onChange={(e) => setFormat(e.target.value)} aria-label="Format">
            {Object.entries(FORMATS).map(([k, [w, h]]) => <option key={k} value={k}>{k} {w}×{h}</option>)}
          </select>
        </div>
        <div className="controls-row">
          <button className="btn" onClick={saveProject}>Save project</button>
          <button className="btn btn-primary" onClick={onExport} disabled={exporting != null}>
            {exporting != null ? `Exporting ${Math.round(exporting * 100)}%` : "Export WebM"}
          </button>
        </div>
        {status && <div className="notice" role="status">{status}</div>}

        <hr className="rule" />
        <div className="controls-row between">
          <span className="label">Clips · {animated.length}</span>
          <button className="btn" onClick={addClip}>Add clip</button>
        </div>
        <div className="cliplist">
          {animated.map((c) => (
            <button key={c.id} className="clipcard" aria-current={c.id === selectedId} onClick={() => setSelectedId(c.id)}>
              <span className="dot" style={{ background: c.ink }} />
              <span>
                <b>{c.text.split("\n").join(" / ")}</b>
                <br />
                <small className="muted">{c.specId} · {c.mode || "spring"}</small>
              </span>
              <small className="num">{(c.at_ms / 1000).toFixed(1)}s</small>
            </button>
          ))}
        </div>

        {selected && !selected.static && (
          <>
            <hr className="rule" />
            <span className="label">Selected clip</span>
            <select className="field" value={selected.specId} onChange={(e) => editClip((c) => { c.specId = e.target.value; })} aria-label="Spec">
              {specIds.map((id) => <option key={id} value={id}>{cat.specs[id].display_name}</option>)}
            </select>
            <div className="row2">
              <select className="field" value={selected.mode || "spring"} onChange={(e) => editClip((c) => { c.mode = e.target.value as Clip["mode"]; })} aria-label="Runtime">
                <option value="spring">spring + anticipation</option>
                <option value="bezier">bezier (ignores x_*)</option>
              </select>
              <button className="btn" onClick={fitLength}>Fit length</button>
            </div>
            <div className="row2">
              <label className="label">start s
                <input className="field" type="number" step="0.1" value={(selected.at_ms / 1000).toFixed(2)} onChange={(e) => editClip((c) => { c.at_ms = Math.max(0, Math.round(Number(e.target.value) * 1000)); }, true)} />
              </label>
              <label className="label">length s
                <input className="field" type="number" step="0.1" value={(selected.duration_ms / 1000).toFixed(2)} onChange={(e) => editClip((c) => { c.duration_ms = Math.max(200, Math.round(Number(e.target.value) * 1000)); }, true)} />
              </label>
            </div>
            <p className="hint-text">
              Text, ink, size, position, stagger and spring overrides are in the DialKit <b>Clip</b> panel below.
              {nat ? ` Natural length ${(nat.total / 1000).toFixed(2)}s (enter ${(nat.enterTotal / 1000).toFixed(2)}s, hold ${(nat.hold / 1000).toFixed(2)}s, exit ${(nat.exitTotal / 1000).toFixed(2)}s).` : ""}
            </p>
            <DialRoot mode="inline" theme="light" />
            <button className="btn" onClick={() => removeClip(selected.id)}>Remove clip</button>
          </>
        )}
      </aside>
      <DialTimeline defaultOpen theme="light" />
    </div>
  );
}

function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
