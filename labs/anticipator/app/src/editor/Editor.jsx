// The Editor: a project of text clips, each playing one catalog spec, laid
// out on DialKit's timeline dock. DialKit owns the transport and the clip
// bars (drag to move, resize to stretch the hold); our renderProject draws
// every frame from the project at the playhead, so preview == export.

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { DialRoot, DialTimeline, useDialTimeline, useDialKitController } from "dialkit";
import { renderProject, projectDuration, clipNatural } from "@core/render.js";
import { useFrame } from "../useFrame.js";
import { exportWebm } from "./exportWebm.js";

const bundledProjects = import.meta.glob("@projects/*.json", { eager: true, import: "default" });

/** The club's locked pairs. A piece uses one pair, plus black and white. */
export const PAIRS = {
  acid: { label: "acid / ink", bg: "#E4FC24", ink: "#0C0C0C" },
  lilac: { label: "lilac / brown", bg: "#CC84FC", ink: "#3C240C" },
  magenta: { label: "magenta / green", bg: "#F06CCC", ink: "#0C540C" },
  indigo: { label: "indigo / white", bg: "#3D3DEB", ink: "#FFFFFF" },
  periwinkle: { label: "periwinkle / ink", bg: "#ADB4F5", ink: "#0C0C0C" },
  yellow: { label: "yellow / ink", bg: "#F4C500", ink: "#0C0C0C" },
  paper: { label: "white / ink", bg: "#FFFFFF", ink: "#0C0C0C" },
};
const FORMATS = { square: [1080, 1080], landscape: [1920, 1080], story: [1080, 1920] };

const clone = (o) => JSON.parse(JSON.stringify(o));
// Dock rows are labelled from their key, so name the key after the text.
// The map is fixed when the bridge mounts, so editing text can't orphan a row.
const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").slice(0, 3).join(" ");
function keyMapOf(clips) {
  const map = {};
  clips.filter((c) => !c.static).forEach((c, i) => (map[c.id] = `${i + 1} ${slug(c.text) || c.id}`));
  return map;
}
const toPanelText = (t) => String(t).replace(/\n/g, " / ");
const fromPanelText = (t) => String(t).replace(/\s*\/\s*/g, "\n");

function initialProjects() {
  const out = {};
  for (const p of Object.values(bundledProjects)) out[p.name] = p;
  return out;
}

function loadDraft() {
  try {
    const raw = localStorage.getItem("anticipator:editor");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Registers the project as a DialKit timeline and reports back. Rendered
 * with a key that changes whenever the clip set or a time changes from our
 * side, so DialKit always starts from the project's values.
 */
function TimelineBridge({ project, timeRef, controlRef, onDockEdit }) {
  const keys = useMemo(() => keyMapOf(project.clips), []); // eslint-disable-line react-hooks/exhaustive-deps
  const config = useMemo(() => {
    const c = { duration: Math.max(1, projectDuration(project) / 1000) };
    for (const clip of project.clips) {
      if (clip.static) continue;
      const d = clip.duration_ms / 1000;
      c[keys[clip.id]] = {
        at: clip.at_ms / 1000,
        duration: d,
        from: { progress: 0 },
        to: { progress: 1 },
        transition: { type: "easing", duration: d, ease: [0, 0, 1, 1] },
      };
    }
    return c;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const tl = useDialTimeline(`Timeline · ${project.name}`, config, { loop: true, autoplay: true });
  timeRef.current = tl.time * 1000;
  controlRef.current = tl;
  useEffect(() => {
    for (const clip of project.clips) {
      const v = keys[clip.id] && tl[keys[clip.id]];
      if (!v) continue;
      const at = Math.round(v.at * 1000), dur = Math.round(v.duration * 1000);
      if (Math.abs(at - clip.at_ms) > 1 || Math.abs(dur - clip.duration_ms) > 1) onDockEdit(clip.id, at, dur);
    }
  });
  return null;
}

/** DialKit panel for the selected clip: text, ink, size, position, stagger, spring overrides. */
function ClipPanel({ clip, spec, pair, onPatch }) {
  const s = spec?.enter?.x_spring || { stiffness: 260, damping: 24, mass: 1 };
  const config = useMemo(() => ({
    text: { type: "text", default: toPanelText(clip.text), placeholder: "use / for a line break" },
    ink: { type: "select", options: [pair.ink, pair.bg, "#0C0C0C", "#FFFFFF"].filter((v, i, a) => a.indexOf(v) === i), default: clip.ink },
    size: [clip.fontPx || 120, 30, 300, 1],
    y: [clip.y ?? 0.5, 0.05, 0.95, 0.01],
    stagger: [clip.overrides?.stagger_ms ?? spec?.enter?.stagger_ms ?? 40, 0, 240, 1],
    spring: {
      override: !!clip.overrides?.x_spring,
      stiffness: [clip.overrides?.x_spring?.stiffness ?? s.stiffness, 20, 1000, 1],
      damping: [clip.overrides?.x_spring?.damping ?? s.damping, 1, 100, 0.5],
      mass: [clip.overrides?.x_spring?.mass ?? s.mass, 0.2, 6, 0.1],
    },
  }), [clip.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const ctl = useDialKitController("Clip", config);
  const v = ctl.values;
  useEffect(() => {
    const overrides = { ...(clip.overrides || {}) };
    if (v.stagger !== (spec?.enter?.stagger_ms ?? null)) overrides.stagger_ms = v.stagger;
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

export default function Editor({ cat }) {
  const [projects, setProjects] = useState(initialProjects);
  const [project, setProject] = useState(() => loadDraft() || clone(initialProjects()["tmsc-timeline"] || Object.values(initialProjects())[0]));
  const [selectedId, setSelectedId] = useState(() => project.clips.find((c) => !c.static)?.id);
  const [bridgeKey, setBridgeKey] = useState(0);
  const [status, setStatus] = useState(null);
  const [exporting, setExporting] = useState(null);
  const canvasRef = useRef(null);
  const timeRef = useRef(0);
  const controlRef = useRef(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  // Test/automation hook: read-only view of the editor state.
  useEffect(() => {
    window.__editor = { time: () => timeRef.current, project: () => projectRef.current, control: () => controlRef.current };
  }, []);
  const specsRef = useRef(cat.specs);
  specsRef.current = cat.specs;
  const measureCtx = useMemo(() => document.createElement("canvas").getContext("2d"), []);

  useEffect(() => {
    fetch("/api/projects").then((r) => (r.ok ? r.json() : null)).then((p) => p && setProjects(p)).catch(() => {});
  }, []);
  useEffect(() => {
    try { localStorage.setItem("anticipator:editor", JSON.stringify(project)); } catch { /* private mode */ }
  }, [project]);

  // Our side changed times or clips: remount the bridge so DialKit re-reads them.
  const commit = useCallback((fn, retime = false) => {
    setProject((p) => { const n = clone(p); fn(n); return n; });
    if (retime) setBridgeKey((k) => k + 1);
  }, []);
  const onDockEdit = useCallback((id, at, dur) => {
    setProject((p) => {
      const n = clone(p);
      const c = n.clips.find((x) => x.id === id);
      if (c) { c.at_ms = at; c.duration_ms = dur; }
      return n;
    });
  }, []);
  const onPatch = useCallback((id, patch) => {
    setProject((p) => {
      const n = clone(p);
      const c = n.clips.find((x) => x.id === id);
      if (c) Object.assign(c, patch);
      return n;
    });
  }, []);

  // Preview: one canvas, drawn from the project at DialKit's playhead.
  useFrame(() => {
    const c = canvasRef.current;
    if (!c) return;
    const p = projectRef.current;
    if (c.width !== p.width || c.height !== p.height) { c.width = p.width; c.height = p.height; }
    renderProject(c.getContext("2d"), p, specsRef.current, timeRef.current);
  });

  const selected = project.clips.find((c) => c.id === selectedId);
  const pairKey = Object.entries(PAIRS).find(([, v]) => v.bg.toLowerCase() === String(project.background).toLowerCase())?.[0] || "paper";
  const pair = PAIRS[pairKey];
  const formatKey = Object.entries(FORMATS).find(([, [w, h]]) => w === project.width && h === project.height)?.[0] || "square";
  const specIds = cat.catalog.visible_ids.filter((id) => cat.specs[id]);

  const naturalOf = (clip) => clipNatural(measureCtx, clip, cat.specs, project.width);

  const addClip = () => {
    const end = projectDuration(project);
    const id = `c${Date.now().toString(36)}`;
    const clip = { id, specId: specIds[0], text: "new clip", ink: pair.ink, at_ms: end, duration_ms: 2000, fontPx: 140, y: 0.5 };
    const nat = naturalOf(clip);
    if (nat) clip.duration_ms = Math.round(nat.total);
    commit((p) => p.clips.push(clip), true);
    setSelectedId(id);
  };
  const removeClip = (id) => {
    commit((p) => (p.clips = p.clips.filter((c) => c.id !== id)), true);
    if (selectedId === id) setSelectedId(project.clips.find((c) => c.id !== id && !c.static)?.id);
  };
  const fitLength = (id) => commit((p) => {
    const c = p.clips.find((x) => x.id === id);
    const nat = clipNatural(measureCtx, c, cat.specs, p.width);
    if (nat) c.duration_ms = Math.round(nat.total);
  }, true);
  const setPair = (k) => commit((p) => {
    const old = PAIRS[pairKey];
    p.background = PAIRS[k].bg;
    for (const c of p.clips) if (c.ink === old.ink) c.ink = PAIRS[k].ink;
  });
  const setFormat = (k) => commit((p) => { [p.width, p.height] = FORMATS[k]; });
  const openProject = (name) => {
    const p = clone(projects[name]);
    setProject(p);
    setSelectedId(p.clips.find((c) => !c.static)?.id);
    setBridgeKey((k) => k + 1);
  };
  const saveProject = async () => {
    const r = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project }) }).catch(() => null);
    if (r?.ok) {
      const { name } = await r.json();
      setProjects((ps) => ({ ...ps, [name]: clone(project) }));
      setStatus(`Saved projects/${name}.json. Export it with: npm run export -- ${name}`);
    } else {
      download(`${project.name}.json`, JSON.stringify(project, null, 2));
      setStatus("No dev server, so downloaded the project JSON.");
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
      setStatus(e.message);
    }
    setExporting(null);
  };

  const animated = project.clips.filter((c) => !c.static);
  const total = projectDuration(project);

  return (
    <div className="editor">
      <TimelineBridge key={`${project.name}-${bridgeKey}`} project={project} timeRef={timeRef} controlRef={controlRef} onDockEdit={onDockEdit} />
      {selected && !selected.static && (
        <ClipPanel key={`${selected.id}-${selected.specId}-${bridgeKey}`} clip={selected} spec={cat.specs[selected.specId]} pair={pair} onPatch={onPatch} />
      )}
      <main className="viewer">
        <canvas ref={canvasRef} width={project.width} height={project.height} style={{ aspectRatio: `${project.width} / ${project.height}` }} aria-label="Preview" />
        <div className="transport">
          <button className="btn" onClick={() => controlRef.current?.playing ? controlRef.current.pause() : controlRef.current?.play()}>Play / pause</button>
          <button className="btn" onClick={() => controlRef.current?.replay()}>Replay</button>
          <span className="label">{(total / 1000).toFixed(2)}s · {project.width}×{project.height} · {project.fps}fps</span>
          <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--muted)" }}>
            Drag clips in the timeline dock below to move them; resize to stretch the hold (springs keep their physics).
          </span>
        </div>
      </main>

      <aside className="inspector" aria-label="Project">
        <span className="label">Project</span>
        <div className="row2">
          <select className="field" value={project.name} onChange={(e) => openProject(e.target.value)} aria-label="Open project">
            {!projects[project.name] && <option value={project.name}>{project.name} (unsaved)</option>}
            {Object.keys(projects).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <input className="field" type="text" value={project.name} onChange={(e) => commit((p) => (p.name = e.target.value))} aria-label="Project name" />
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
        <div className="controls-row" style={{ justifyContent: "space-between" }}>
          <span className="label">Clips · {animated.length}</span>
          <button className="btn" onClick={addClip}>Add clip</button>
        </div>
        <div className="cliplist">
          {animated.map((c) => (
            <button key={c.id} className="clipcard" aria-current={c.id === selectedId} onClick={() => setSelectedId(c.id)}>
              <span className="dot" style={{ background: c.ink, border: "1px solid var(--line-2)" }} />
              <span>
                <b>{c.text.split("\n").join(" / ")}</b>
                <br />
                <small style={{ color: "var(--muted)" }}>{c.specId} · {c.mode || "spring"}</small>
              </span>
              <small style={{ fontVariantNumeric: "tabular-nums" }}>{(c.at_ms / 1000).toFixed(1)}s</small>
            </button>
          ))}
        </div>

        {selected && !selected.static && (
          <>
            <hr className="rule" />
            <span className="label">Selected clip</span>
            <select className="field" value={selected.specId} onChange={(e) => commit((p) => (p.clips.find((c) => c.id === selected.id).specId = e.target.value))} aria-label="Spec">
              {specIds.map((id) => <option key={id} value={id}>{cat.specs[id].display_name}</option>)}
            </select>
            <div className="row2">
              <select className="field" value={selected.mode || "spring"} onChange={(e) => commit((p) => (p.clips.find((c) => c.id === selected.id).mode = e.target.value))} aria-label="Runtime">
                <option value="spring">spring + anticipation</option>
                <option value="bezier">bezier (ignores x_*)</option>
              </select>
              <button className="btn" onClick={() => fitLength(selected.id)}>Fit length</button>
            </div>
            <div className="row2">
              <label className="label">start s
                <input className="field" type="number" step="0.1" value={(selected.at_ms / 1000).toFixed(2)} onChange={(e) => commit((p) => (p.clips.find((c) => c.id === selected.id).at_ms = Math.max(0, Math.round(Number(e.target.value) * 1000))), true)} />
              </label>
              <label className="label">length s
                <input className="field" type="number" step="0.1" value={(selected.duration_ms / 1000).toFixed(2)} onChange={(e) => commit((p) => (p.clips.find((c) => c.id === selected.id).duration_ms = Math.max(200, Math.round(Number(e.target.value) * 1000))), true)} />
              </label>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
              Text, ink, size, position, stagger and spring overrides are in the DialKit <b>Clip</b> panel below.
              {(() => { const n = naturalOf(selected); return n ? ` Natural length ${(n.total / 1000).toFixed(2)}s (enter ${(n.enterTotal / 1000).toFixed(2)}s, exit ${(n.exitTotal / 1000).toFixed(2)}s).` : ""; })()}
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

function download(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
