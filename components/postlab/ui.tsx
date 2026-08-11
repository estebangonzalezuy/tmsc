"use client";

// The studio's controls. Nothing here knows what a post is — they are the
// hairline, monochrome, tabular-numeral parts every panel is assembled from,
// kept in one file so the studio itself reads as layout rather than as widgets.

import { useRef, useState, type ReactNode } from "react";

/* A named group of controls that can be folded away. Open unless said
   otherwise: nothing should be hidden from someone who hasn't learned the
   tool yet, but everything should be foldable by someone who has. */
export function Panel({
  title,
  children,
  closed = false,
  hint,
}: {
  title: string;
  children: ReactNode;
  closed?: boolean;
  /** One line under the title, for a group whose name isn't enough. */
  hint?: string;
}) {
  const [open, setOpen] = useState(!closed);
  return (
    <section className="border-b border-line">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] uppercase tracking-widest text-muted hover:text-foreground transition-colors"
      >
        <span>{title}</span>
        <span className="text-xs">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2.5">
          {hint && (
            <p className="text-xs text-muted leading-relaxed -mt-1">{hint}</p>
          )}
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * A number you can drag or type. Dragging sideways is how every motion tool
 * lets you find a value without a slider eating a row of the panel; typing is
 * how you say one exactly. The whole range crosses in about 240px, and holding
 * shift makes that a quarter as fast for the last decimal.
 */
export function Num({
  value,
  min,
  max,
  step,
  onChange,
  width = "w-14",
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  width?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const drag = useRef<{ x: number; from: number; moved: boolean } | null>(null);
  const commit = (raw: string) => {
    const n = Number(raw);
    setDraft(null);
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
  };
  const snap = (v: number) => {
    const stepped = Math.round(v / step) * step;
    return Math.min(max, Math.max(min, Math.round(stepped * 1e4) / 1e4));
  };
  return (
    <input
      value={draft ?? (step < 1 ? value.toFixed(2) : String(Math.round(value)))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setDraft(null);
        if (e.key === "ArrowUp") onChange(snap(value + step));
        if (e.key === "ArrowDown") onChange(snap(value - step));
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        drag.current = { x: e.clientX, from: value, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        if (!d.moved) {
          if (Math.abs(dx) < 3) return;
          d.moved = true;
          (e.target as HTMLInputElement).blur();
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        const span = (max - min) / 240;
        onChange(snap(d.from + dx * span * (e.shiftKey ? 0.25 : 1)));
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      inputMode="decimal"
      className={`${width} shrink-0 border border-line bg-transparent px-1.5 py-1 text-xs text-right tabular-nums cursor-ew-resize touch-none focus:outline-none focus:border-foreground focus:cursor-text`}
    />
  );
}

/* Label, slider, and a box you can drag or type into. The pair is the point:
   drag to find it, type to say it. */
export function Dial({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  /** Shown instead of the box when the number isn't worth typing. */
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted shrink-0 w-16 truncate">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-foreground"
      />
      {suffix ? (
        <span className="w-14 text-right text-xs text-muted">{suffix}</span>
      ) : (
        <Num value={value} min={min} max={max} step={step} onChange={onChange} />
      )}
    </div>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted shrink-0 w-20">{label}</span>
      <span className="flex-1 min-w-0 flex">{children}</span>
    </label>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-1 border border-line divide-x divide-line">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          title={o.title}
          className={`flex-1 px-2 py-1.5 text-xs transition-colors ${
            value === o.value ? "bg-foreground text-background" : "hover:text-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({
  value,
  onChange,
  rows = 1,
  placeholder,
  mono = false,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
}) {
  const cls = `w-full border border-line bg-transparent px-2.5 py-2 text-sm focus:outline-none focus:border-foreground ${
    mono ? "font-mono text-xs" : ""
  }`;
  if (rows > 1)
    return (
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${cls} resize-none`}
      />
    );
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cls}
    />
  );
}

export function Btn({
  onClick,
  children,
  primary = false,
  disabled = false,
  title,
}: {
  onClick: () => void;
  children: ReactNode;
  primary?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
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

/* A switch that says what it is switching. Used wherever the tool has a
   handful of independent yes/no decisions — the filled ring is on. */
export function Switch({
  label,
  on,
  onChange,
  title,
}: {
  label: string;
  on: boolean;
  onChange: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onChange}
      title={title}
      className={`text-xs underline-offset-4 ${
        on ? "underline" : "text-muted hover:text-foreground"
      }`}
    >
      {on ? "◉" : "○"} {label}
    </button>
  );
}

/* A colour choice made by pointing at it. `value` is a hex, or one of the
   named options ("" for the theme's own, "mix" for the whole palette). */
export function Swatches({
  palette,
  value,
  options = [],
  onChange,
  labels,
}: {
  palette: readonly string[];
  value: string;
  options?: { value: string; label: string }[];
  onChange: (v: string) => void;
  /** Names under the swatches, for the grounds — a sheet is worth naming. */
  labels?: Record<string, string>;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`h-7 px-2 border text-xs transition-colors ${
            value === o.value
              ? "border-foreground bg-foreground text-background"
              : "border-line text-muted hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
      {palette.map((hex) => (
        <button
          key={hex}
          onClick={() => onChange(hex)}
          title={labels?.[hex] ? `${labels[hex]} — ${hex}` : hex}
          style={{ background: hex }}
          className={`size-7 border transition-transform ${
            value === hex ? "border-foreground scale-110" : "border-line hover:scale-110"
          }`}
        />
      ))}
    </div>
  );
}
