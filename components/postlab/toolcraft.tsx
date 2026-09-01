"use client";

// Toolcraft — the studio's chrome.
//
// A reproduction of toolcraft.sh, not an interpretation of it: the same
// metrics, the same control shapes, the same order. A tool is a *canvas* with
// chrome floating over it, never a page divided into columns — the canvas is
// the whole window and it continues underneath the panel, so the work is never
// squeezed into what is left after the furniture.
//
// The anatomy, and it is the same on every tool page:
//
//   Panel      a floating card of dark glass — title, a menu, a reset, a fold,
//              a scrolling body, and a footer holding the one button you press
//              at the end
//   Section    an uppercase heading with its own reset and fold
//   Slider     label left, value right, the track full width underneath —
//              never a slider squeezed between two labels
//   Range      the same track with two handles, for a number that travels
//   Toggle     a pill switch; on is the one place a colour appears
//   Segmented  two to four choices side by side; past that, Select
//   Dots       colour as circles you point at
//   XYPad      two numbers that are really one place
//   Dropzone   a file, dragged or clicked; Thumb is what was picked
//   Toolbar    the pill under the canvas: undo, zoom, the transport
//
// Every colour, radius and height is a token in `app/globals.css` under
// `.toolcraft`. Nothing here hardcodes one, so dressing the studio in the
// club's own black and white later is that block and nothing else. The rules
// suspended in here — rounded corners, a shadow, a translucent surface, a blue
// switch — stay suspended in here: the posts and the public site keep every one
// of them. See docs/THE-STUDIO-CHROME.md.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/** Kept for callers that draw their own hairline beside ours. */
export const HAIR = "border-[color:var(--tc-edge)]";
/** The stage the chrome floats on. The canvas is drawn over this, not in it. */
export const STAGE = "toolcraft bg-[#0b0c0e]";

/* The same breakpoint the layout itself switches on (`md:`) — a panel stops
   floating and docks into the page below this width. */
const COMPACT_QUERY = "(max-width: 767px)";

function subscribeCompact(onChange: () => void) {
  const mq = window.matchMedia(COMPACT_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const getCompactSnapshot = () => window.matchMedia(COMPACT_QUERY).matches;
const getCompactServerSnapshot = () => false;

/**
 * True on a phone-width viewport. `Section` and `Block` read this to start
 * folded there, so a tool that would otherwise arrive as one long unrolled
 * page instead arrives as a short stack of named rows — tap one to work in
 * it, its summary or title says what it already holds while it's shut. On a
 * wider viewport nothing changes: groups still open the way each call site
 * asked them to.
 */
export function useCompact() {
  return useSyncExternalStore(subscribeCompact, getCompactSnapshot, getCompactServerSnapshot);
}

const INK = "text-[color:var(--tc-ink)]";
const INK2 = "text-[color:var(--tc-ink-2)]";
const INK3 = "text-[color:var(--tc-ink-3)]";

/* ------------------------------------------------------------------ atoms */

/** A group heading: uppercase, letter-spaced, quiet. */
export function Label({ children }: { children: ReactNode }) {
  return <span className={`text-[10px] uppercase tracking-[0.09em] ${INK3}`}>{children}</span>;
}

/** The circled question mark the reference puts after a label that needs one. */
export function Help({ children }: { children: string }) {
  return (
    <span
      title={children}
      className={`inline-grid place-items-center size-[13px] shrink-0 rounded-full border border-[color:var(--tc-ink-3)] text-[8px] leading-none ${INK3} cursor-help`}
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
      className={`tc-field ${
        on ? "tc-field-on" : ""
      } h-[var(--tc-h)] px-3 text-[12.5px] inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
        wide ? "flex-1 min-w-0" : "shrink-0"
      }`}
    >
      {children}
    </button>
  );
}

/** The one button you press at the end. Lives in the panel's footer. */
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
      className="tc-field tc-field-on w-full h-10 text-[13px] inline-flex items-center justify-center gap-2"
    >
      {children}
    </button>
  );
}

/** An icon in a square hit area. `bare` drops the ground, for a toolbar. */
export function IconBtn({
  onClick,
  children,
  title,
  on = false,
  disabled = false,
  bare = false,
  small = false,
}: {
  onClick: () => void;
  children: ReactNode;
  title: string;
  on?: boolean;
  disabled?: boolean;
  bare?: boolean;
  /** For a row of them beside a name that needs the room more than they do. */
  small?: boolean;
}) {
  const size = small ? "size-6 text-[11px]" : "size-8 text-[13px]";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={
        bare
          ? `${size} shrink-0 grid place-items-center rounded-[var(--tc-r-sm)] transition-colors disabled:opacity-30 ${
              on
                ? `${INK} bg-[color:var(--tc-field-on)]`
                : `${INK3} hover:text-[color:var(--tc-ink)] hover:bg-[color:var(--tc-field)]`
            }`
          : `tc-field ${on ? "tc-field-on" : ""} ${size} shrink-0 grid place-items-center`
      }
    >
      {children}
    </button>
  );
}

export function Buttons({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-1.5">{children}</div>;
}

/* ------------------------------------------------------------------ panel */

/**
 * The floating card. One column of groups, read downwards, with the way out
 * pinned to its foot — the reference is emphatic about that, and it is right:
 * a tool's export is not one more group of settings.
 */
export function Panel({
  title,
  children,
  footer,
  onReset,
  right,
  menu,
  className = "",
  width = 320,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onReset?: () => void;
  /** Anything that belongs beside the title. */
  right?: ReactNode;
  /** The `⋯` menu. This chrome has no menu bar, so this is where one goes. */
  menu?: ReactNode;
  className?: string;
  width?: number;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section
      /* Full width on a phone, its own width once there's room to float. */
      className={`tc-float rounded-[var(--tc-r-lg)] flex flex-col min-h-0 w-full ${className}`}
      style={{ maxWidth: width }}
    >
      <header
        className={`h-11 shrink-0 flex items-center gap-1 pl-4 pr-2 ${
          open ? "border-b border-[color:var(--tc-rule)]" : ""
        }`}
      >
        <span className={`text-[13px] font-medium flex-1 truncate ${INK}`}>{title}</span>
        {right}
        {menu}
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
          <div className="tc-scroll flex-1 min-h-0 overflow-y-auto">{children}</div>
          {footer && (
            <div className="shrink-0 border-t border-[color:var(--tc-rule)] p-3">{footer}</div>
          )}
        </>
      )}
    </section>
  );
}

/**
 * A named group: an uppercase heading, its own reset, its own fold, and a
 * summary while it's folded so a closed group still says something.
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
     opens itself the moment it holds something. Your own fold then wins. On a
     phone every group starts folded regardless — a tall stack of open groups
     is the thing this fixes — until you tap one open yourself. */
  const compact = useCompact();
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? (compact ? false : initial);
  return (
    <div className="border-b border-[color:var(--tc-rule)] last:border-b-0">
      <div className="h-9 flex items-center gap-1 pl-4 pr-2">
        <button
          onClick={() => setOverride(!open)}
          className="flex-1 flex items-center gap-2 text-left h-full min-w-0"
        >
          <Label>{title}</Label>
          {!open && summary && (
            <span className={`ml-auto text-[11px] truncate ${INK3}`}>{summary}</span>
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
        <div className="px-4 pb-4 space-y-3.5">
          {note && <p className={`text-[11px] leading-relaxed ${INK3}`}>{note}</p>}
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
  const [text, setText] = useState<string | null>(null);
  const drag = useRef<{ x: number; from: number } | null>(null);
  const dp = step < 1 ? (String(step).split(".")[1]?.length ?? 2) : 0;
  const shown = text ?? (dp ? value.toFixed(dp) : String(Math.round(value)));

  const commit = (raw: string) => {
    const n = Number(raw);
    setText(null);
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
  };

  return (
    <span
      className="inline-flex items-center cursor-ew-resize select-none touch-none"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, from: value };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const span = max - min;
        const next = d.from + ((e.clientX - d.x) / 180) * span;
        const snapped = Math.round(next / step) * step;
        onChange(Math.min(max, Math.max(min, Number(snapped.toFixed(4)))));
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <input
        value={shown}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && commit((e.target as HTMLInputElement).value)}
        onPointerDown={(e) => e.stopPropagation()}
        className={`w-11 bg-transparent text-right text-[12.5px] tabular-nums focus:outline-none ${INK}`}
      />
      {suffix && <span className={`text-[11px] ${INK3}`}>{suffix}</span>}
    </span>
  );
}

/** Label left, value right, track full width underneath. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
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
  suffix?: string;
  /** A word where the number would be — "off", "none", "as written". */
  display?: string;
  help?: string;
  /** Anything that belongs after the value — the loop dot, for instance. */
  right?: ReactNode;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-[12.5px] truncate ${INK2}`}>{label}</span>
        {help && <Help>{help}</Help>}
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          {display ? (
            <span className={`text-[12.5px] ${INK3}`}>{display}</span>
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
      <div className="relative h-3">
        <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] rounded-sm bg-[color:var(--tc-track)]" />
        <span className="tc-fill" style={{ left: 0, width: `${pct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          className="tc-range absolute inset-0"
        />
      </div>
    </div>
  );
}

/** A label and a control on one line, for a choice rather than a number. */
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
    <div className="flex items-center gap-2 min-w-0">
      {label && (
        <span
          className={`text-[12.5px] shrink-0 w-[84px] truncate flex items-center gap-1.5 ${INK2}`}
        >
          {label}
          {help && <Help>{help}</Help>}
        </span>
      )}
      {children}
    </div>
  );
}

/** Two controls on one line. */
export function Cols({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">{children}</div>;
}

/**
 * Two handles on one track. A number that travels is drawn with this rather
 * than as two sliders: where it rests and where it goes are one journey, and
 * `cross` lets the handles pass each other so a number can travel downwards.
 */
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
  cross?: boolean;
  /** Anything that belongs after the two numbers. */
  right?: ReactNode;
}) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const show = (v: number) => (step < 1 ? v.toFixed(2) : String(Math.round(v)));
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-[12.5px] truncate ${INK2}`}>{label}</span>
        <span className={`ml-auto text-[12.5px] tabular-nums shrink-0 ${INK}`}>
          {show(from)}
          {suffix} {cross ? "→" : "–"} {show(to)}
          {suffix}
        </span>
        {right}
      </div>
      <div className="relative h-3">
        <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] rounded-sm bg-[color:var(--tc-track)]" />
        <span
          className="tc-fill"
          style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }}
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
          className="tc-range absolute inset-0"
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
          className="tc-range absolute inset-0"
        />
      </div>
    </div>
  );
}

/** A control that wants the whole width, with its name above it. */
export function Stack({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5 min-w-0">
      {label && <div className={`text-[12.5px] ${INK2}`}>{label}</div>}
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- switches */

/** One yes/no. On is the single place a colour appears in this chrome. */
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
    <div className="flex items-center gap-2.5 min-w-0">
      <button
        onClick={onChange}
        role="switch"
        aria-checked={on}
        aria-label={label ?? "toggle"}
        className="relative w-[30px] h-[18px] shrink-0 rounded-full transition-colors"
        style={{ background: on ? "var(--tc-live)" : "var(--tc-track)" }}
      >
        <span
          className="absolute top-[2px] size-[14px] rounded-full bg-[color:var(--tc-glass-solid)] transition-all"
          style={{ left: on ? 14 : 2 }}
        />
      </button>
      {label && <span className={`text-[12.5px] truncate ${INK2}`}>{label}</span>}
      {help && <Help>{help}</Help>}
    </div>
  );
}

/** Two to four choices, side by side. Past four, use a Select. */
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
    <div
      className="flex items-center p-[2px] gap-[2px] rounded-[var(--tc-r)] border border-[color:var(--tc-edge)]"
      style={{ background: "var(--tc-field)" }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          title={o.title}
          className={`flex-1 min-w-0 h-[28px] rounded-[var(--tc-r-sm)] text-[12.5px] truncate px-2 transition-colors ${
            value === o.value
              ? `bg-[color:var(--tc-field-on)] ${INK}`
              : `${INK3} hover:bg-[color:var(--tc-field)]`
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type Option = { value: string; label: string; group?: string; title?: string };

/** More than four choices. Grouped when the options say so. */
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
  const groups = [...new Set(options.map((o) => o.group ?? ""))];
  return (
    <div className={`relative ${flex ? "flex-1 min-w-0" : "shrink-0"}`}>
      <select
        value={value}
        title={title}
        onChange={(e) => onChange(e.target.value)}
        className="tc-field w-full h-[var(--tc-h)] pl-3 pr-7 text-[13px] appearance-none focus:outline-none cursor-pointer"
      >
        {groups.length > 1
          ? groups.map((g) => (
              <optgroup key={g} label={g || "—"}>
                {options
                  .filter((o) => (o.group ?? "") === g)
                  .map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
              </optgroup>
            ))
          : options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
      </select>
      <span
        className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] ${INK3}`}
      >
        ▾
      </span>
    </div>
  );
}

/** Words. One line or several. */
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
  const shared = `tc-field w-full px-3 text-[13px] focus:outline-none focus:border-[color:var(--tc-edge-on)] placeholder:text-[color:var(--tc-ink-3)] ${
    mono ? "font-mono text-[11.5px]" : ""
  }`;
  return rows > 1 ? (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${shared} py-2 leading-snug resize-y`}
    />
  ) : (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${shared} h-[var(--tc-h)]`}
    />
  );
}

/* ----------------------------------------------------------------- colour */

/** A swatch, its hex, the picker behind both, and what it's worth. */
export function ColorRow({
  label = "Colour",
  value,
  onChange,
  onClear,
  onRemove,
  amount,
}: {
  label?: string;
  value: string;
  onChange: (hex: string) => void;
  /** Back to the theme's own, when there is such a thing. */
  onClear?: () => void;
  /** Take this colour out of the list it belongs to. */
  onRemove?: () => void;
  /** The reference's right-hand percentage. */
  amount?: string;
}) {
  return (
    <Stack label={label}>
      <div className="tc-field h-[var(--tc-h)] flex items-center overflow-hidden">
        {/* Its own right-hand rule, so a white swatch still reads as a swatch
            and not as a gap in the row. */}
        <label
          className="w-8 h-full shrink-0 cursor-pointer border-r border-[color:var(--tc-edge)]"
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
          className={`flex-1 min-w-0 h-full bg-transparent px-2.5 text-[12.5px] tabular-nums focus:outline-none ${INK}`}
        />
        {amount && <span className={`px-2 text-[11.5px] tabular-nums ${INK3}`}>{amount}</span>}
        {onClear && (
          <button
            onClick={onClear}
            title="Back to the theme's own"
            className={`h-full px-2.5 text-[11px] border-l border-[color:var(--tc-edge)] ${INK3} hover:text-[color:var(--tc-ink)]`}
          >
            auto
          </button>
        )}
        {onRemove && (
          <button
            onClick={onRemove}
            title="Take this colour out"
            className={`h-full px-2.5 text-[11px] border-l border-[color:var(--tc-edge)] ${INK3} hover:text-[color:var(--tc-ink)]`}
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
    <div className="flex items-center gap-2 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`tc-field ${
            value === o.value ? "tc-field-on" : ""
          } h-7 px-2.5 text-[11.5px] shrink-0`}
        >
          {o.label}
        </button>
      ))}
      {colors.map((hex) => (
        <button
          key={hex}
          onClick={() => onChange(hex)}
          title={labels?.[hex] ?? hex}
          style={{ background: hex }}
          className={`size-[26px] shrink-0 rounded-full transition-transform ${
            value === hex
              ? "ring-2 ring-[color:var(--tc-sel)] ring-offset-2 ring-offset-[color:var(--tc-glass-solid)]"
              : "border border-[color:var(--tc-edge)] hover:scale-110"
          }`}
        />
      ))}
    </div>
  );
}

/** Two numbers that are really one place. */
export function XYPad({
  label,
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
  const box = useRef<HTMLDivElement>(null);
  const put = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const nx = min + ((e.clientX - r.left) / r.width) * (max - min);
    const ny = min + ((e.clientY - r.top) / r.height) * (max - min);
    onChange(
      Math.min(max, Math.max(min, Number(nx.toFixed(3)))),
      Math.min(max, Math.max(min, Number(ny.toFixed(3)))),
    );
  };
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center">
        <span className={`text-[12.5px] ${INK2}`}>{label ?? "Position"}</span>
        <span className={`ml-auto text-[12.5px] tabular-nums ${INK}`}>
          {x.toFixed(2)}, {y.toFixed(2)}
        </span>
      </div>
      <div
        ref={box}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          put(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && put(e)}
        className="tc-field relative h-[104px] cursor-crosshair touch-none"
      >
        <span className="absolute left-0 right-0 top-1/2 h-px bg-[color:var(--tc-rule)]" />
        <span className="absolute top-0 bottom-0 left-1/2 w-px bg-[color:var(--tc-rule)]" />
        <span
          className="absolute size-[10px] rounded-full bg-[color:var(--tc-sel)] -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pct(x)}%`, top: `${pct(y)}%` }}
        />
      </div>
    </div>
  );
}

/** A file, dragged onto it or clicked for. */
export function Dropzone({
  onFile,
  hint = "Click to upload a file",
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
      className={`tc-field ${
        over ? "tc-field-on" : ""
      } h-[112px] flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center px-4`}
    >
      <span className={`text-[18px] leading-none ${INK3}`}>⤒</span>
      <span className={`text-[12.5px] ${INK2}`}>{hint}</span>
      <span className={`text-[11px] ${INK3}`}>or drag it onto the canvas</span>
      <input
        type="file"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
        className="sr-only"
      />
    </label>
  );
}

/**
 * What was picked, and the way to drop it — the reference's source thumbnail.
 * `children` draws instead of an `<img>`, which is how a clip shows a frame.
 */
export function Thumb({
  src,
  onRemove,
  caption,
  children,
}: {
  src?: string;
  onRemove: () => void;
  caption?: string;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="tc-field relative overflow-hidden">
        {children ??
          (src ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={src} alt="" className="w-full block max-h-[160px] object-cover" />
          ) : null)}
        <button
          onClick={onRemove}
          title="Take this out"
          className="absolute top-1.5 right-1.5 size-[20px] grid place-items-center rounded-full bg-black/55 text-white text-[11px] hover:bg-black/80"
        >
          ×
        </button>
      </div>
      {caption && <p className={`text-[11px] leading-relaxed ${INK3}`}>{caption}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ stack */

/**
 * One row of a list you *pick from* — a layer, a slide, a take. Where `Block`
 * holds a thing's controls, `ListRow` only says which thing it is: a switch, a
 * name, a quiet second line, and whatever buttons belong to it. Selection is
 * the whole row, because in a stack of six the name is not the target.
 */
export function ListRow({
  name,
  meta,
  selected = false,
  on = true,
  onSelect,
  onToggle,
  right,
  children,
}: {
  name: string;
  /** The quiet line under the name — what it draws, how many frames. */
  meta?: string;
  selected?: boolean;
  on?: boolean;
  onSelect: () => void;
  onToggle?: () => void;
  /** Buttons that belong to this row: solo, reorder, remove. */
  right?: ReactNode;
  /** A thumbnail, drawn at the head of the row. */
  children?: ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 pl-1.5 pr-1 h-12 rounded-[var(--tc-r)] border transition-colors ${
        selected
          ? "border-[color:var(--tc-edge-on)] bg-[color:var(--tc-field-on)]"
          : "border-transparent hover:bg-[color:var(--tc-field)]"
      }`}
    >
      {onToggle && (
        <button
          onClick={onToggle}
          title={on ? "Hide this one" : "Show this one"}
          className={`w-4 shrink-0 text-[10px] ${on ? INK : INK3}`}
        >
          {on ? "◉" : "○"}
        </button>
      )}
      {children}
      <button onClick={onSelect} className="flex-1 min-w-0 text-left overflow-hidden">
        <span className={`block text-[12.5px] truncate ${on ? INK : `${INK3} line-through`}`}>
          {name}
        </span>
        {meta && <span className={`block text-[10.5px] truncate ${INK3}`}>{meta}</span>}
      </button>
      <span className="flex items-center shrink-0">{right}</span>
    </div>
  );
}

/** One thing in a stack: a switch, a name, reorder, remove, its numbers. */
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
  const compact = useCompact();
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? (compact ? false : initial);
  return (
    <div className="rounded-[var(--tc-r)] border border-[color:var(--tc-edge)]">
      <div
        className={`h-9 flex items-center gap-1 pl-2 pr-0.5 ${
          open ? "border-b border-[color:var(--tc-rule)]" : ""
        }`}
      >
        {onToggle && (
          <button
            onClick={onToggle}
            title={on ? "Switch this off" : "Switch this on"}
            className={`w-3.5 shrink-0 text-[9px] ${on ? INK : INK3}`}
          >
            {on ? "◉" : "○"}
          </button>
        )}
        <button
          onClick={() => setOverride(!open)}
          className={`flex-1 flex items-center gap-1.5 text-[12.5px] text-left truncate ${
            on ? INK2 : `${INK3} line-through`
          }`}
        >
          <span className={`text-[8px] ${INK3}`}>{open ? "⌃" : "⌄"}</span>
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
      {open && <div className="p-2.5 space-y-3">{children}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- toolbar */

/** The floating pill under the canvas. */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="tc-float rounded-[var(--tc-r-pill)] h-11 px-2 flex items-center gap-0.5 text-[12.5px]">
      {children}
    </div>
  );
}

export function Sep() {
  return <span className="w-px h-5 mx-1.5 shrink-0 bg-[color:var(--tc-edge)]" />;
}

/* ------------------------------------------------------------------- menu */

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, close]);
  return ref;
}

const MenuClose = createContext<() => void>(() => {});

/**
 * The things you *do*. This chrome has no menu bar — the reference doesn't have
 * one, and a bar of six menus over the canvas is six things floating where the
 * work is — so a menu hangs off the panel's header or the toolbar instead.
 */
export function Menu({
  label,
  children,
  align = "left",
  up = false,
  width = 236,
  title = "Everything you can do",
}: {
  label: string;
  children: ReactNode;
  align?: "left" | "right";
  up?: boolean;
  width?: number;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative shrink-0">
      <IconBtn onClick={() => setOpen((o) => !o)} title={title} on={open} bare>
        {label}
      </IconBtn>
      {open && (
        <MenuClose.Provider value={() => setOpen(false)}>
          <div
            className={`tc-float tc-scroll rounded-[var(--tc-r)] absolute z-50 py-1 max-h-[72vh] overflow-y-auto ${
              align === "right" ? "right-0" : "left-0"
            } ${up ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]"}`}
            style={{ width }}
          >
            {children}
          </div>
        </MenuClose.Provider>
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
  const close = useContext(MenuClose);
  return (
    <button
      onClick={() => {
        onClick();
        close();
      }}
      disabled={disabled}
      className={`w-full text-left px-3 h-8 flex items-center gap-2 text-[12.5px] disabled:opacity-30 hover:bg-[color:var(--tc-field)] ${INK2}`}
    >
      {on !== undefined && (
        <span className={`w-3 text-[9px] ${on ? INK : INK3}`}>{on ? "◉" : "○"}</span>
      )}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className={`text-[10.5px] tabular-nums ${INK3}`}>{hint}</span>}
    </button>
  );
}

export function MenuRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-3 py-2 space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

export function MenuSep() {
  return <div className="my-1 h-px bg-[color:var(--tc-rule)]" />;
}

/* ----------------------------------------------------------------- drawer */

/** A grid of pictures over the canvas. A moment, not a place. */
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
    <div className="absolute inset-3 z-40 flex items-start justify-center pointer-events-none">
      <div
        ref={ref}
        className="tc-float rounded-[var(--tc-r-lg)] w-full max-h-full flex flex-col pointer-events-auto"
      >
        <header className="h-11 shrink-0 flex items-center gap-2 pl-4 pr-2 border-b border-[color:var(--tc-rule)]">
          <Label>{title}</Label>
          <span className="ml-auto flex items-center gap-1.5">
            {right}
            <IconBtn onClick={onClose} title="Close" bare>
              ×
            </IconBtn>
          </span>
        </header>
        <div className="tc-scroll flex-1 min-h-0 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
