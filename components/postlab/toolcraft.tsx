"use client";

// Toolcraft — the club's tool chrome.
//
// Modelled on toolcraft.sh, which gets one thing exactly right: a tool is a
// *canvas* with chrome floating over it, not a page divided into columns. The
// stage is the whole window and it is dark; everything you touch is a panel on
// top of it. Nothing is docked, so the post is never squeezed into what's left
// after the furniture.
//
// The anatomy, and it is the same everywhere:
//
//   Panel      a floating card — title, a reset, a fold, a scrolling body and a
//              footer that holds the one button you press at the end
//   Section    an uppercase label with its own reset and fold
//   Slider     label on the left, value on the right, the track full width
//              underneath — never a slider squeezed between two labels
//   Toggle     a pill switch for one yes/no
//   Segmented  two to four choices side by side; past that, Select
//   Dots       colour as circles you point at
//   XYPad      two numbers that are really one place
//   Dropzone   a file, dragged or clicked
//   Toolbar    the floating bar under the stage: undo, zoom, the transport
//
// It is still the club's design system, not a copy of someone else's: white
// chrome, near-black ink, 1px hairlines, no shadows, no gradients, no rounded
// corners, and **a hover is a wash, never a colour** — colour on this site only
// ever answers a pointer. The reference is dark chrome on a light canvas; ours
// is the club's white chrome on the club's own black.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export const HAIR = "border-line";
/** The stage: the club's ink, used as a surface. Everything floats on this. */
export const STAGE = "bg-foreground";

/* ------------------------------------------------------------------ atoms */

export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] uppercase tracking-widest text-muted">{children}</span>
  );
}

/** The little ? that carries the sentence a label hasn't got room for. */
export function Help({ children }: { children: string }) {
  return (
    <span
      title={children}
      className={`inline-grid place-items-center size-3.5 shrink-0 border ${HAIR} text-[8px] text-muted cursor-help align-middle`}
    >
      ?
    </span>
  );
}

export function Btn({
  onClick,
  children,
  on = false,
  disabled = false,
  title,
  wide = false,
}: {
  onClick: () => void;
  children: ReactNode;
  on?: boolean;
  disabled?: boolean;
  title?: string;
  wide?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`h-8 px-2.5 border ${HAIR} text-[11px] whitespace-nowrap transition-colors disabled:opacity-40 disabled:pointer-events-none ${
        wide ? "flex-1" : ""
      } ${on ? "bg-foreground text-background" : "hover:bg-foreground/5"}`}
    >
      {children}
    </button>
  );
}

/** The one button at the bottom of a panel. */
export function Primary({
  onClick,
  children,
  disabled = false,
  title,
}: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-full h-9 bg-foreground text-background text-[11px] transition-opacity hover:opacity-80 disabled:opacity-40 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}

export function IconBtn({
  onClick,
  children,
  title,
  on = false,
  disabled = false,
  bare = false,
}: {
  onClick: () => void;
  children: ReactNode;
  title: string;
  on?: boolean;
  disabled?: boolean;
  /** No border — for the small marks in a header. */
  bare?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${bare ? "size-5" : `size-8 border ${HAIR}`} shrink-0 grid place-items-center text-[11px] transition-colors disabled:opacity-30 disabled:pointer-events-none ${
        on ? "bg-foreground text-background" : "hover:bg-foreground/5 text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/** A row of buttons that share a line. */
export function Buttons({ children }: { children: ReactNode }) {
  return <div className="flex items-stretch gap-1.5">{children}</div>;
}

/* ----------------------------------------------------------------- panels */

/**
 * A floating card over the stage. The body scrolls; the footer doesn't, so the
 * button you press at the end is always where you left it.
 */
export function Panel({
  title,
  children,
  footer,
  onReset,
  right,
  className = "",
  width = 316,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onReset?: () => void;
  /** Anything that belongs beside the title. */
  right?: ReactNode;
  className?: string;
  width?: number;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section
      /* Full width on a phone, its own width once there's room to float. */
      className={`bg-background border ${HAIR} flex flex-col min-h-0 w-full ${className}`}
      style={{ maxWidth: width }}
    >
      <header
        className={`h-10 shrink-0 flex items-center gap-1.5 pl-3 pr-1.5 ${
          open ? `border-b ${HAIR}` : ""
        }`}
      >
        <span className="text-[11px] flex-1 truncate">{title}</span>
        {right}
        {onReset && (
          <IconBtn onClick={onReset} title="Put this back as it was" bare>
            ↺
          </IconBtn>
        )}
        <IconBtn onClick={() => setOpen((o) => !o)} title={open ? "Fold" : "Unfold"} bare>
          {open ? "⌃" : "⌄"}
        </IconBtn>
      </header>
      {open && (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
          {footer && <div className={`shrink-0 border-t ${HAIR} p-2`}>{footer}</div>}
        </>
      )}
    </section>
  );
}

/**
 * A named group inside a panel: an uppercase label, its own reset, its own
 * fold, and a summary while it's folded so a closed group still says something.
 */
export function Section({
  title,
  children,
  open: initial = true,
  summary,
  onReset,
  note,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
  summary?: string;
  onReset?: () => void;
  note?: string;
}) {
  /* `open` is a hint, not a value: a group that holds nothing starts folded and
     opens itself the moment it holds something. Your own fold then wins. */
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? initial;
  return (
    <div className={`border-b ${HAIR} last:border-b-0`}>
      <div className="h-9 flex items-center gap-1 pl-3 pr-1.5">
        <button
          onClick={() => setOverride(!open)}
          className="flex-1 flex items-center gap-2 text-left h-full min-w-0"
        >
          <Label>{title}</Label>
          {!open && summary && (
            <span className="ml-auto text-[10px] text-muted truncate">{summary}</span>
          )}
        </button>
        {onReset && open && (
          <IconBtn onClick={onReset} title="Put this group back as it was" bare>
            ↺
          </IconBtn>
        )}
        <IconBtn onClick={() => setOverride(!open)} title={open ? "Fold" : "Unfold"} bare>
          {open ? "⌃" : "⌄"}
        </IconBtn>
      </div>
      {open && (
        <div className="px-3 pb-3 space-y-2.5">
          {note && <p className="text-[10px] text-muted leading-relaxed">{note}</p>}
          {children}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- numbers */

/**
 * The number beside a label: drag it sideways or type it. Borderless until you
 * touch it, because in a column of twenty controls a box around every value is
 * twenty boxes.
 */
export function Num({
  value,
  min,
  max,
  step,
  onChange,
  suffix = "",
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const drag = useRef<{ x: number; from: number; moved: boolean } | null>(null);
  const snap = (v: number) => {
    const stepped = Math.round(v / step) * step;
    return Math.min(max, Math.max(min, Math.round(stepped * 1e4) / 1e4));
  };
  const shown = step < 1 ? value.toFixed(2) : String(Math.round(value));
  return (
    <span className="flex items-baseline gap-0.5 shrink-0">
      <input
        value={draft ?? shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => {
          const n = Number(e.target.value);
          setDraft(null);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
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
          onChange(snap(d.from + dx * ((max - min) / 240) * (e.shiftKey ? 0.25 : 1)));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        inputMode="decimal"
        size={Math.max(2, shown.length)}
        className="bg-transparent text-[11px] text-right tabular-nums cursor-ew-resize touch-none focus:outline-none focus:cursor-text w-[5ch]"
      />
      {suffix && <span className="text-[11px] text-muted">{suffix}</span>}
    </span>
  );
}

/**
 * The control this whole kit is built around: what it's called on the left, what
 * it says on the right, and the track across the full width underneath. A
 * slider squeezed between a label and a box is a slider you can't aim.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix = "",
  display,
  help,
  right,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  /** Unit shown after the number — px, %, ×. */
  suffix?: string;
  /** Instead of the number, when the number isn't the point ("off", "still"). */
  display?: string;
  help?: string;
  /** Anything at the end of the label line — the loop dot. */
  right?: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className="truncate">{label}</span>
        {help && <Help>{help}</Help>}
        <span className="ml-auto flex items-center gap-1.5">
          {display ? (
            <span className="text-[11px] text-muted">{display}</span>
          ) : (
            <Num
              value={value}
              min={min}
              max={max}
              step={step}
              onChange={onChange}
              suffix={suffix}
            />
          )}
          {right}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-foreground"
      />
    </div>
  );
}

/** A label and a control on one line, for the things that aren't numbers. */
export function Row({
  label,
  children,
  help,
}: {
  label?: string;
  children: ReactNode;
  help?: string;
}) {
  return (
    <label className="flex items-center gap-2 min-h-8">
      {label !== undefined && (
        <span className="w-[72px] shrink-0 text-[11px] truncate flex items-center gap-1">
          {label}
          {help && <Help>{help}</Help>}
        </span>
      )}
      <span className="flex-1 min-w-0 flex items-center gap-1.5">{children}</span>
    </label>
  );
}

/** Two controls side by side, each with its name above it — typeface and its
    weight, a size and a case. Half the rows for the same number of decisions. */
export function Cols({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

/** Two handles on one track: a number that is really a range. */
export function Range({
  label,
  from,
  to,
  min,
  max,
  step,
  onChange,
  suffix = "",
  cross = false,
  right,
}: {
  label: string;
  from: number;
  to: number;
  min: number;
  max: number;
  step: number;
  onChange: (from: number, to: number) => void;
  suffix?: string;
  /** Let the handles pass each other, because the pair is a journey and not a
      span: a number that travels downwards has its destination below where it
      rests, and clamping the handles apart would make that unsayable. */
  cross?: boolean;
  /** Anything that belongs after the two numbers. */
  right?: ReactNode;
}) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const show = (v: number) => (step < 1 ? v.toFixed(2) : String(Math.round(v)));
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className="truncate">{label}</span>
        <span className="ml-auto text-muted tabular-nums">
          {show(from)}
          {suffix} {cross ? "→" : "–"} {show(to)}
          {suffix}
        </span>
        {right}
      </div>
      <div className="relative h-4">
        <span className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-line/40" />
        <span
          className="absolute top-1/2 -translate-y-1/2 h-px bg-foreground"
          style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
        />
        {/* Two ranges stacked: the one you grab is whichever handle is nearer,
            which is what makes a two-handle track feel like one control. */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={from}
          aria-label={`${label} from`}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(cross ? v : Math.min(v, to), to);
          }}
          className="absolute inset-0 w-full appearance-none bg-transparent accent-foreground"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={to}
          aria-label={`${label} to`}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(from, cross ? v : Math.max(v, from));
          }}
          className="absolute inset-0 w-full appearance-none bg-transparent accent-foreground"
        />
      </div>
    </div>
  );
}

/** A control that wants the whole width, with its name above it. */
export function Stack({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      {label && <p className="text-[11px]">{label}</p>}
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- choices */

/** A pill switch: one yes/no, said out loud. */
export function Toggle({
  label,
  on,
  onChange,
  help,
}: {
  label?: string;
  on: boolean;
  onChange: () => void;
  help?: string;
}) {
  return (
    <label className="flex items-center gap-2 min-h-8 cursor-pointer">
      <button
        onClick={onChange}
        role="switch"
        aria-checked={on}
        aria-label={label ?? "toggle"}
        className={`w-8 h-[18px] shrink-0 border ${HAIR} relative transition-colors ${
          on ? "bg-foreground" : "bg-transparent"
        }`}
      >
        <span
          className={`absolute top-[2px] size-3 transition-all ${
            on ? "left-[16px] bg-background" : "left-[2px] bg-foreground/40"
          }`}
        />
      </button>
      {label && <span className="text-[11px]">{label}</span>}
      {help && <Help>{help}</Help>}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <span className={`flex-1 flex border ${HAIR} divide-x divide-line`}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          title={o.title}
          className={`flex-1 h-8 text-[11px] transition-colors ${
            value === o.value ? "bg-foreground text-background" : "hover:bg-foreground/5"
          }`}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

export type Option = { value: string; label: string; group?: string };

/** Native on purpose: it inherits the keyboard, the type-ahead and the way a
    phone shows a picker. Only the chrome is ours. */
export function Select({
  value,
  options,
  onChange,
  title,
  flex = true,
}: {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  title?: string;
  flex?: boolean;
}) {
  const groups = [...new Set(options.map((o) => o.group).filter(Boolean))] as string[];
  return (
    <span className={`relative ${flex ? "flex-1" : ""} min-w-0`}>
      <select
        value={value}
        title={title}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full h-8 appearance-none border ${HAIR} bg-transparent pl-2 pr-6 text-[11px] truncate hover:bg-foreground/5 focus:outline-none focus:border-foreground`}
      >
        {groups.length === 0
          ? options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          : groups.map((g) => (
              <optgroup key={g} label={g}>
                {options
                  .filter((o) => o.group === g)
                  .map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
              </optgroup>
            ))}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[8px] opacity-50">
        ⌄
      </span>
    </span>
  );
}

export function Text({
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
  const cls = `w-full border ${HAIR} bg-transparent px-2 text-[11px] leading-relaxed focus:outline-none focus:border-foreground ${
    mono ? "font-mono" : ""
  }`;
  return rows > 1 ? (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${cls} py-1.5 resize-none`}
    />
  ) : (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${cls} h-8`}
    />
  );
}

/* ----------------------------------------------------------------- colour */

/** A swatch, its hex, and the picker behind both. */
export function ColorRow({
  label = "Colour",
  value,
  onChange,
  onClear,
  onRemove,
}: {
  label?: string;
  value: string;
  onChange: (hex: string) => void;
  /** Back to the theme's own, when there is such a thing. */
  onClear?: () => void;
  /** Take this colour out of the list it belongs to. */
  onRemove?: () => void;
}) {
  return (
    <Stack label={label}>
      <div className={`flex items-center gap-0 border ${HAIR} h-8`}>
        {/* Its own right-hand rule, so a white swatch still reads as a swatch
            and not as a gap in the row. */}
        <label
          className={`size-8 shrink-0 cursor-pointer border-r ${HAIR}`}
          style={{ background: value }}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
          />
        </label>
        <input
          value={value}
          onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && onChange(e.target.value)}
          className="flex-1 min-w-0 h-full bg-transparent px-2 text-[11px] tabular-nums focus:outline-none"
        />
        {onClear && (
          <button
            onClick={onClear}
            title="Back to the theme's own"
            className={`h-full px-2 text-[10px] text-muted hover:text-foreground border-l ${HAIR}`}
          >
            auto
          </button>
        )}
        {onRemove && (
          <button
            onClick={onRemove}
            title="Take this colour out"
            className={`h-full px-2 text-[10px] text-muted hover:text-foreground border-l ${HAIR}`}
          >
            ×
          </button>
        )}
      </div>
    </Stack>
  );
}

/** Colour as circles you point at. */
export function Dots({
  colors,
  value,
  onChange,
  options = [],
  labels,
}: {
  colors: readonly string[];
  value: string;
  onChange: (v: string) => void;
  /** Named choices before the circles — "theme", "mix". */
  options?: { value: string; label: string }[];
  labels?: Record<string, string>;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`h-6 px-2 border text-[10px] transition-colors ${
            value === o.value
              ? "border-foreground bg-foreground text-background"
              : `${HAIR} text-muted hover:text-foreground`
          }`}
        >
          {o.label}
        </button>
      ))}
      {colors.map((hex) => (
        <button
          key={hex}
          onClick={() => onChange(hex)}
          title={labels?.[hex] ? `${labels[hex]} — ${hex}` : hex}
          style={{ background: hex }}
          className={`size-6 rounded-full border transition-transform ${
            value === hex ? "border-foreground scale-115" : `${HAIR} hover:scale-110`
          }`}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- placement */

/** Two numbers that are really one place. Drag the dot. */
export function XYPad({
  label = "Position",
  x,
  y,
  onChange,
  min = -1,
  max = 1,
}: {
  label?: string;
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
  min?: number;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (clientX: number, clientY: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const fx = (clientX - box.left) / box.width;
    const fy = (clientY - box.top) / box.height;
    onChange(
      Math.round((min + fx * (max - min)) * 100) / 100,
      Math.round((min + fy * (max - min)) * 100) / 100,
    );
  };
  const px = ((x - min) / (max - min)) * 100;
  const py = ((y - min) / (max - min)) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center text-[11px]">
        <span>{label}</span>
        <span className="ml-auto text-muted tabular-nums">
          {x.toFixed(2)}, {y.toFixed(2)}
        </span>
      </div>
      <div
        ref={ref}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          set(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => e.buttons === 1 && set(e.clientX, e.clientY)}
        className={`relative border ${HAIR} h-24 cursor-crosshair touch-none`}
      >
        <span className="absolute left-0 right-0 top-1/2 border-t border-line/30" />
        <span className="absolute top-0 bottom-0 left-1/2 border-l border-line/30" />
        <span
          className="absolute size-2 bg-foreground -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${px}%`, top: `${py}%` }}
        />
      </div>
    </div>
  );
}

/** A file, dragged or clicked. */
export function Dropzone({
  onFile,
  hint = "Click to choose a file, or drop it on the canvas",
  accept = "image/*",
}: {
  onFile: (file: File) => void;
  hint?: string;
  accept?: string;
}) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`block border border-dashed ${
        over ? "border-foreground bg-foreground/5" : HAIR
      } px-3 py-6 text-center text-[10px] text-muted leading-relaxed cursor-pointer hover:bg-foreground/5 transition-colors`}
    >
      {hint}
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </label>
  );
}

/* ------------------------------------------------------------------ stack */

/**
 * One thing in a stack — an effect, a mark. Switch, name, order, remove, and its
 * numbers inside. Every effect panel in every motion tool is this shape, because
 * a stack of five effects has to be readable as five things.
 */
export function Block({
  title,
  on = true,
  onToggle,
  onUp,
  onDown,
  onRemove,
  children,
  open: initial = true,
}: {
  title: string;
  on?: boolean;
  onToggle?: () => void;
  onUp?: () => void;
  onDown?: () => void;
  onRemove?: () => void;
  children: ReactNode;
  open?: boolean;
}) {
  const [open, setOpen] = useState(initial);
  return (
    <div className={`border ${HAIR}`}>
      <div className={`h-8 flex items-center gap-1 pl-1.5 pr-0.5 ${open ? `border-b ${HAIR}` : ""}`}>
        {onToggle && (
          <button
            onClick={onToggle}
            title={on ? "Switch this off" : "Switch this on"}
            className={`w-3.5 shrink-0 text-[9px] ${on ? "" : "opacity-40"}`}
          >
            {on ? "◉" : "○"}
          </button>
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex-1 flex items-center gap-1 text-[11px] text-left truncate ${
            on ? "" : "line-through opacity-50"
          }`}
        >
          <span className="text-[8px] opacity-60">{open ? "⌃" : "⌄"}</span>
          {title}
        </button>
        {onUp && (
          <IconBtn onClick={onUp} title="Earlier in the stack" bare>
            ↑
          </IconBtn>
        )}
        {onDown && (
          <IconBtn onClick={onDown} title="Later in the stack" bare>
            ↓
          </IconBtn>
        )}
        {onRemove && (
          <IconBtn onClick={onRemove} title="Remove" bare>
            ×
          </IconBtn>
        )}
      </div>
      {open && <div className="p-2 space-y-2">{children}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- toolbar */

/** The floating bar under the stage. */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div
      className={`bg-background border ${HAIR} h-10 px-1.5 flex items-center gap-1 text-[11px]`}
    >
      {children}
    </div>
  );
}

export function Sep() {
  return <span className="w-px h-4 bg-line/30 mx-1 shrink-0" />;
}

/* --------------------------------------------------------------- dropdown */

const MenuCtx = createContext<() => void>(() => {});

/** Close on Escape, or on a click that isn't inside. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

/** A menu on a floating bar: the things you do, as opposed to the things you set. */
export function Menu({
  label,
  children,
  align = "left",
  up = false,
  width = 244,
  title,
}: {
  label: string;
  children: ReactNode;
  align?: "left" | "right";
  /** Opens upward — for a menu on the bottom bar. */
  up?: boolean;
  width?: number;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={title}
        /* Its own ground: a menu floats over the black stage, and a transparent
           button there is a near-black border on near-black. */
        className={`h-8 px-2.5 text-[11px] border ${HAIR} transition-colors ${
          open ? "bg-foreground text-background" : "bg-background hover:bg-foreground/5"
        }`}
      >
        {label} <span className="opacity-50 text-[8px]">⌄</span>
      </button>
      {open && (
        <div
          className={`absolute z-50 ${up ? "bottom-[calc(100%+5px)]" : "top-[calc(100%+5px)]"} ${
            align === "right" ? "right-0" : "left-0"
          } bg-background border ${HAIR} max-h-[70vh] overflow-y-auto`}
          style={{ width }}
        >
          <MenuCtx.Provider value={() => setOpen(false)}>{children}</MenuCtx.Provider>
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  onClick,
  children,
  hint,
  disabled = false,
  on,
}: {
  onClick: () => void;
  children: ReactNode;
  hint?: string;
  disabled?: boolean;
  on?: boolean;
}) {
  const close = useContext(MenuCtx);
  return (
    <button
      onClick={() => {
        if (disabled) return;
        onClick();
        close();
      }}
      disabled={disabled}
      className="w-full flex items-center gap-2 px-2.5 py-2 text-[11px] text-left hover:bg-foreground/5 disabled:opacity-40 disabled:pointer-events-none"
    >
      {on !== undefined && (
        <span className="w-2.5 text-[9px] shrink-0">{on ? "◉" : "○"}</span>
      )}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="text-muted text-[10px] shrink-0">{hint}</span>}
    </button>
  );
}

export function MenuRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-2.5 py-2 space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

export function MenuSep() {
  return <div className={`border-t ${HAIR}`} />;
}

/* ----------------------------------------------------------------- drawer */

/** A panel over the stage for the things that need room: the recipes, a sheet of
    rolled looks. Moments, not places. */
export function Drawer({
  title,
  onClose,
  children,
  right,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  right?: ReactNode;
}) {
  const ref = useDismiss(true, onClose);
  return (
    <div className="absolute inset-0 z-40 bg-foreground/60 flex items-stretch justify-center p-4 md:p-10">
      <div
        ref={ref}
        className={`w-full max-w-5xl bg-background border ${HAIR} flex flex-col min-h-0`}
      >
        <div className={`border-b ${HAIR} h-10 px-3 flex items-center gap-3 shrink-0`}>
          <Label>{title}</Label>
          <span className="ml-auto flex items-center gap-1.5">{right}</span>
          <IconBtn onClick={onClose} title="Close (esc)" bare>
            ×
          </IconBtn>
        </div>
        <div className="overflow-y-auto p-3">{children}</div>
      </div>
    </div>
  );
}
