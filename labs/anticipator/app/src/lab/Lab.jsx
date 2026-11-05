// The Lab: tune a spec's physics with dials, watch it side by side with the
// bezier reference, save it into the catalog as a named preset.

import { useEffect, useMemo, useRef, useState } from "react";
import { renderClip, naturalClipMs } from "@core/render.js";
import { zetaOf, settleMs, overshoot, springCharacter } from "@core/spring.js";
import { fitBezier, applyFallback } from "@core/fit.js";
import { canonicalSpec } from "@core/canonical.js";
import { validateSpec, INTENTS } from "@core/validate.js";
import { saveSpecToCatalog } from "../catalog.js";
import { useFrame, fitCanvas } from "../useFrame.js";
import CurvePlot from "./CurvePlot.jsx";

/** The familiar "bezier spring": one overshoot baked into a cubic (easeOutBack). */
export const BACK_OUT = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const HOLD_MS = 700;
const GAP_MS = 450;

const clone = (o) => JSON.parse(JSON.stringify(o));
const kebab = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function withDefaults(spec) {
  const s = clone(spec);
  s.enter.x_spring = { stiffness: 260, damping: 24, mass: 1, rest_delta: 0.001, ...(s.enter.x_spring || {}) };
  s.enter.x_anticipation = { amount: 0, duration_ms: 0, ...(s.enter.x_anticipation || {}) };
  s.enter.x_opacity_duration_ms ??= 160;
  return s;
}

/** The reference a plain animate-text runtime would play. */
function referenceSpec(draft, refMode, refDuration, fitted) {
  const s = clone(draft);
  if (refMode === "backout") {
    s.enter.easing = BACK_OUT;
    s.enter.duration_ms = refDuration;
  } else {
    s.enter.easing = fitted.easing;
    s.enter.duration_ms = fitted.duration_ms;
  }
  return s;
}

function Dial({ label, value, min, max, step, onChange, format = (v) => v, hint }) {
  return (
    <div className="dial">
      <label>{label}</label>
      <output>{format(value)}</output>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

function Screen({ title, sub, footer, spec, mode, text, clock }) {
  const canvasRef = useRef(null);
  useFrame(() => {
    const c = canvasRef.current;
    if (!c) return;
    const w = c.clientWidth, h = c.clientHeight;
    const ctx = fitCanvas(c, w, h);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    const fontPx = Math.round(w * 0.085);
    renderClip(ctx, clock.current.t, w / 2, h / 2, { spec, text, ink: "#0C0C0C", fontPx, maxWidth: w * 0.86, mode, holdMs: HOLD_MS });
  });
  return (
    <div className="screen">
      <header><b>{title}</b><span className="label">{sub}</span></header>
      <canvas ref={canvasRef} />
      <footer>{footer}</footer>
    </div>
  );
}

export default function Lab({ cat }) {
  const ids = cat.catalog.visible_ids.filter((id) => cat.specs[id]);
  const [selectedId, setSelectedId] = useState(ids[0]);
  const base = cat.specs[selectedId] || cat.specs[ids[0]];
  const [draft, setDraft] = useState(() => withDefaults(base));
  const [text, setText] = useState("Motion with a wind-up");
  const [refMode, setRefMode] = useState("backout");
  const [refDuration, setRefDuration] = useState(600);
  const [playing, setPlaying] = useState(true);
  const [name, setName] = useState("");
  const [intent, setIntent] = useState(base.x_intent || "calm");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState(null);

  // Loading a spec resets the dials to it.
  useEffect(() => {
    if (!base) return;
    setDraft(withDefaults(base));
    setIntent(base.x_intent || "calm");
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const e = draft.enter;
  const spring = e.x_spring;
  const set = (fn) => setDraft((d) => { const n = clone(d); fn(n.enter); return n; });

  const zeta = zetaOf(spring);
  const amount = e.x_anticipation.amount;
  const settle = settleMs(spring, -(1 + amount), 0, spring.rest_delta);
  const over = overshoot(spring, -(1 + amount));

  // Fitting takes ~100ms; do it after the dial stops moving.
  const physicsKey = JSON.stringify([e.x_spring, e.x_anticipation, e.x_opacity_duration_ms]);
  const [fitted, setFitted] = useState(() => fitBezier(e));
  useEffect(() => {
    const id = setTimeout(() => setFitted(fitBezier(draft.enter)), 160);
    return () => clearTimeout(id);
  }, [physicsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const ref = useMemo(() => referenceSpec(draft, refMode, refDuration, fitted), [draft, refMode, refDuration, fitted]);

  // One clock for both screens and the plot, so they are always in step.
  const measureCtx = useMemo(() => document.createElement("canvas").getContext("2d"), []);
  const loopMs = useMemo(() => {
    const opts = { text, fontPx: 80, maxWidth: 800 };
    const a = naturalClipMs(measureCtx, { ...opts, spec: draft, mode: "spring" });
    const b = naturalClipMs(measureCtx, { ...opts, spec: ref, mode: "bezier" });
    return Math.max(a.enterTotal + a.exitTotal, b.enterTotal + b.exitTotal) + HOLD_MS + GAP_MS;
  }, [draft, ref, text, measureCtx]);
  const clock = useRef({ t: 0, start: performance.now(), pausedAt: 0 });
  const playingRef = useRef(playing);
  playingRef.current = playing;
  useFrame((now) => {
    const c = clock.current;
    if (!playingRef.current) return;
    c.t = (now - c.start) % loopMs;
  });
  const togglePlay = () => {
    const c = clock.current;
    if (playing) c.pausedAt = c.t;
    else c.start = performance.now() - c.pausedAt;
    setPlaying(!playing);
  };
  const replay = () => { clock.current.start = performance.now(); clock.current.t = 0; setPlaying(true); };

  // ------------------------------------------------------------ save
  const buildPreset = () => {
    const display = name.trim() || `${base.display_name}, ${intent}`;
    const id = kebab(display);
    const s = canonicalSpec({
      ...clone(draft),
      id,
      display_name: display,
      x_intent: intent,
      x_intent_notes: notes.trim() || `ζ ≈ ${zeta.toFixed(2)} (${springCharacter(spring)}), tuned in the Lab.`,
      x_variant_of: base.x_variant_of || base.id,
      description: draft.description,
    });
    if (s.enter.x_anticipation && s.enter.x_anticipation.amount === 0) delete s.enter.x_anticipation;
    applyFallback(s.enter);
    s.signature_easing = s.enter.easing;
    return s;
  };

  const onSave = async (overwrite = false) => {
    const s = buildPreset();
    const errors = validateSpec(s, { fileId: s.id });
    if (errors.length) return setStatus({ err: true, msg: errors.join(" · ") });
    if (!cat.live) {
      download(`${s.id}.json`, JSON.stringify(s, null, 2) + "\n");
      return setStatus({ msg: `No dev server, so downloaded ${s.id}.json. Drop it in catalog/text-animations/specs/ and add it to catalog.json.` });
    }
    const r = await saveSpecToCatalog(s, overwrite);
    if (r.status === 409) {
      if (confirm(`"${s.id}" already exists. Overwrite it?`)) return onSave(true);
      return;
    }
    if (!r.ok) return setStatus({ err: true, msg: r.errors ? r.errors.join(" · ") : r.error });
    await cat.refresh();
    setStatus({ msg: `Saved catalog/text-animations/specs/${s.id}.json. Run npm run generate:skill to ship it.` });
    setSelectedId(s.id);
  };

  const onCopy = async () => {
    const s = buildPreset();
    await navigator.clipboard.writeText(JSON.stringify(s, null, 2));
    setStatus({ msg: `Copied ${s.id} as JSON.` });
  };

  const groups = cat.catalog.groups || { all: ids };
  const grouped = new Set(Object.values(groups).flat());
  const loose = ids.filter((id) => !grouped.has(id));

  return (
    <div className="lab">
      <nav className="rail" aria-label="Specs">
        {Object.entries(groups).concat(loose.length ? [["other", loose]] : []).map(([g, list]) => (
          <div key={g}>
            <h3 className="label">{g}</h3>
            {list.filter((id) => cat.specs[id]).map((id) => (
              <button key={id} className="rail-item" aria-current={id === selectedId} onClick={() => { setSelectedId(id); setStatus(null); }}>
                {cat.specs[id].display_name}
                <small>{cat.specs[id].target} · {cat.specs[id].x_intent || "n/a"}</small>
              </button>
            ))}
          </div>
        ))}
        <h3 className="label">source</h3>
        <p style={{ margin: "0 20px", fontSize: 12, color: "var(--muted)" }}>
          {cat.live ? "Live from catalog/ (dev server). Saves write files." : "Bundled catalog. Saves download JSON."}
        </p>
      </nav>

      <main className="stage">
        <div className="controls-row">
          <input className="field" type="text" value={text} onChange={(ev) => setText(ev.target.value)} aria-label="Sample text" />
          <button className="btn" onClick={togglePlay}>{playing ? "Pause" : "Play"}</button>
          <button className="btn" onClick={replay}>Replay</button>
        </div>
        <div className="pair">
          <Screen
            title="Bezier reference"
            sub={refMode === "backout" ? "back-out cubic" : "fitted fallback"}
            spec={ref}
            mode="bezier"
            text={text}
            clock={clock}
            footer={`${ref.enter.easing} · ${ref.enter.duration_ms}ms · what a runtime that ignores x_* plays`}
          />
          <Screen
            title="Spring + anticipation"
            sub={springCharacter(spring)}
            spec={draft}
            mode="spring"
            text={text}
            clock={clock}
            footer={`k ${spring.stiffness} · c ${spring.damping} · m ${spring.mass} · wind-up ${Math.round(amount * 100)}% / ${e.x_anticipation.duration_ms}ms · settles ${settle}ms`}
          />
        </div>
        <div className="controls-row">
          <span className="label">Reference</span>
          <div className="chips">
            <button className="chip" aria-pressed={refMode === "backout"} onClick={() => setRefMode("backout")}>Bezier spring {BACK_OUT.replace("cubic-bezier", "")}</button>
            <button className="chip" aria-pressed={refMode === "fallback"} onClick={() => setRefMode("fallback")}>This spec&rsquo;s fitted fallback</button>
          </div>
          {refMode === "backout" && (
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              duration
              <input type="range" min={200} max={1400} step={10} value={refDuration} onChange={(ev) => setRefDuration(Number(ev.target.value))} />
              {refDuration}ms
            </label>
          )}
        </div>
        <CurvePlot spring={draft.enter} reference={ref.enter} clock={clock} />
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", maxWidth: 720 }}>
          Same spec, two readings. Left is how any animate-text runtime plays it: one cubic-bezier over a fixed duration.
          Right is the <code>x_spring</code> + <code>x_anticipation</code> reading: a closed-form damped oscillator released
          from a wind-up, with opacity on its own clock. Fitted fallback error for these dials: rms {fitted.rms_error}, max {fitted.max_error} (travel units).
        </p>
      </main>

      <aside className="dials" aria-label="Dials">
        <div className="zeta">
          <span className="big">{zeta.toFixed(2)}</span>
          <span className="label">damping ratio <span style={{ textTransform: "none" }}>ζ</span></span>
          <span className="sub">{springCharacter(spring)} · overshoot {(over * 100).toFixed(1)}%</span>
          <span className="sub">settles in {settle}ms</span>
        </div>
        <Dial label="Stiffness" value={spring.stiffness} min={20} max={1000} step={1} onChange={(v) => set((p) => (p.x_spring.stiffness = v))} />
        <Dial label="Damping" value={spring.damping} min={1} max={100} step={0.5} onChange={(v) => set((p) => (p.x_spring.damping = v))} />
        <Dial label="Mass" value={spring.mass} min={0.2} max={6} step={0.1} onChange={(v) => set((p) => (p.x_spring.mass = v))} format={(v) => v.toFixed(1)} />
        <Dial label="Anticipation" value={Math.round(amount * 100)} min={0} max={40} step={1} format={(v) => `${v}%`} onChange={(v) => set((p) => (p.x_anticipation.amount = v / 100))} hint="wind-up away from the target, as a share of travel" />
        <Dial label="Anticipation time" value={e.x_anticipation.duration_ms} min={0} max={400} step={5} format={(v) => `${v}ms`} onChange={(v) => set((p) => (p.x_anticipation.duration_ms = v))} />
        <Dial label="Stagger" value={e.stagger_ms} min={0} max={200} step={1} format={(v) => `${v}ms`} onChange={(v) => set((p) => (p.stagger_ms = v))} />
        <Dial label="Opacity" value={e.x_opacity_duration_ms} min={20} max={800} step={10} format={(v) => `${v}ms`} onChange={(v) => set((p) => (p.x_opacity_duration_ms = v))} hint="opacity never springs; short keeps the wind-up visible" />
        <div className="dial">
          <label>Rest delta</label>
          <output>{spring.rest_delta}</output>
          <select className="field" style={{ gridColumn: "1 / -1" }} value={spring.rest_delta} onChange={(ev) => set((p) => (p.x_spring.rest_delta = Number(ev.target.value)))}>
            {[0.01, 0.005, 0.001, 0.0005, 0.0001].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <span className="hint">when the phase counts as settled (fraction of travel)</span>
        </div>

        <hr className="rule" />
        <span className="label">Save as preset</span>
        <input className="field" type="text" placeholder={`${base.display_name}, ${intent}`} value={name} onChange={(ev) => setName(ev.target.value)} aria-label="Preset name" />
        <div className="chips" role="group" aria-label="Intent">
          {INTENTS.map((i) => (
            <button key={i} className="chip" aria-pressed={intent === i} onClick={() => setIntent(i)}>{i}</button>
          ))}
        </div>
        <textarea className="field" placeholder="What this intent means here (optional)" value={notes} onChange={(ev) => setNotes(ev.target.value)} />
        <div className="controls-row">
          <button className="btn btn-primary" onClick={() => onSave(false)}>Save to catalog</button>
          <button className="btn" onClick={onCopy}>Copy JSON</button>
        </div>
        {status && <div className={`notice${status.err ? " err" : ""}`} role="status">{status.msg}</div>}
      </aside>
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
