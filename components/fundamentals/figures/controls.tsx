"use client";

import type { ReactNode } from "react";
import { accentHover } from "@/lib/accent";

/* The controls a figure is driven with. Monochrome at rest, like everything
   else on the site; a chip lights up in its own palette colour only under
   the pointer, the way the Practice page's chips already do. These are the
   site's controls, not the studios' Toolcraft ones, on purpose: a figure sits
   inside an article, and instrument furniture would read as a tool. */

const CHIP = "rounded-full px-3 py-1 text-xs transition-colors";

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5rem_1fr] items-center gap-3 text-xs">
      <span className="text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => String(v),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="grid grid-cols-[5rem_1fr_3.5rem] items-center gap-3 text-xs">
      <span className="text-muted">{label}</span>
      <input
        type="range"
        className="fig-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      <span className="text-right tabular-nums">{format(value)}</span>
    </label>
  );
}

export function Chips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <Row label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`${CHIP} ${
            o.value === value ? "bg-foreground text-background" : accentHover(o.value)
          }`}
        >
          {o.label}
        </button>
      ))}
    </Row>
  );
}

/** A two-state chip pair. `labels` is [on, off]. */
export function Switch({
  label,
  on,
  onChange,
  labels = ["On", "Off"],
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
  labels?: [string, string];
}) {
  return (
    <Chips
      label={label}
      value={on ? "on" : "off"}
      options={[
        { value: "on", label: labels[0] },
        { value: "off", label: labels[1] },
      ]}
      onChange={(v) => onChange(v === "on")}
    />
  );
}

export function Replay({ onClick, children = "Replay" }: { onClick: () => void; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${CHIP} bg-foreground text-background accent-hover`}
    >
      {children}
    </button>
  );
}
