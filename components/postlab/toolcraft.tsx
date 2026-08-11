"use client";

// Toolcraft — the club's chrome for its own tools.
//
// The site is editorial: generous type, hairlines, white space. A tool is not,
// and pretending otherwise is what made the studio feel scattered — every
// control the same size as every other, in a column you scrolled. Toolcraft is
// the other register: small type, tight rows, one line between things, menus
// that hold what you use twice a day and panels that hold what you set once.
//
// It stays the club's design system, not a borrowed one: monochrome, hairline
// borders, no shadows, no gradients, no rounded corners. What makes it read as
// an application rather than a page is density and structure — a menu bar, a
// canvas with its own chrome, an inspector of collapsible groups, and numbers
// you drag.
//
// The rules, so a new control looks like the old ones:
//   · 11px type in the chrome, 10px uppercase tracked labels for groups
//   · 28px controls, 1px `border-line`, `bg-foreground text-background` when on
//   · a hover is a wash (`bg-foreground/5`), never a colour — colour on this
//     site only ever answers a pointer, and a tool full of accents is a mess
//   · one control per row, its label on the left, at a fixed width so a column
//     of them lines up

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* ------------------------------------------------------------------ atoms */

export const HAIR = "border-line";

export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] uppercase tracking-widest text-muted">{children}</span>
  );
}

/** A row: what it's called on the left, the control on the right. */
export function Row({
  label,
  children,
  title,
}: {
  label?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <label className="flex items-center gap-2 min-h-7" title={title}>
      {label !== undefined && (
        <span className="w-[68px] shrink-0 text-[11px] text-muted truncate">{label}</span>
      )}
      <span className="flex-1 min-w-0 flex items-center gap-1.5">{children}</span>
    </label>
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
  /** Pressed / active — the inverted state. */
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
      className={`h-7 px-2.5 border ${HAIR} text-[11px] whitespace-nowrap transition-colors disabled:opacity-40 disabled:pointer-events-none ${
        wide ? "flex-1" : ""
      } ${on ? "bg-foreground text-background" : "hover:bg-foreground/5"}`}
    >
      {children}
    </button>
  );
}

/** A square button for a glyph — the transport, a nudge, a delete. */
export function IconBtn({
  onClick,
  children,
  title,
  on = false,
  disabled = false,
}: {
  onClick: () => void;
  children: ReactNode;
  title: string;
  on?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`size-7 shrink-0 grid place-items-center border ${HAIR} text-[11px] transition-colors disabled:opacity-40 disabled:pointer-events-none ${
        on ? "bg-foreground text-background" : "hover:bg-foreground/5"
      }`}
    >
      {children}
    </button>
  );
}

/** A switch that says what it switches. */
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
      className={`h-7 inline-flex items-center gap-1.5 px-1.5 text-[11px] transition-colors ${
        on ? "text-foreground" : "text-muted hover:text-foreground"
      }`}
    >
      <span className="text-[9px]">{on ? "◉" : "○"}</span>
      {label}
    </button>
  );
}

/* --------------------------------------------------------------- dropdown */

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

const MenuCtx = createContext<() => void>(() => {});

/**
 * A menu in the bar. Everything you do more than twice a day lives in one of
 * these rather than in a panel — that is the difference between an application
 * and a page of controls, and it is what stopped the studio sprawling.
 */
export function Menu({
  label,
  children,
  align = "left",
  width = 248,
}: {
  label: string;
  children: ReactNode;
  align?: "left" | "right";
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`h-7 px-2.5 text-[11px] border ${HAIR} transition-colors ${
          open ? "bg-foreground text-background" : "hover:bg-foreground/5"
        }`}
      >
        {label} <span className="opacity-50 text-[9px]">▾</span>
      </button>
      {open && (
        <div
          className={`absolute z-40 top-[calc(100%+1px)] ${
            align === "right" ? "right-0" : "left-0"
          } bg-background border ${HAIR}`}
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
  /** A shortcut, or a number — anything the right edge should say. */
  hint?: string;
  disabled?: boolean;
  /** Present makes this a checkable item. */
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
      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-left hover:bg-foreground/5 disabled:opacity-40 disabled:pointer-events-none"
    >
      {on !== undefined && (
        <span className="w-2.5 text-[9px] shrink-0">{on ? "◉" : "○"}</span>
      )}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="text-muted text-[10px] shrink-0">{hint}</span>}
    </button>
  );
}

/** A row of controls inside a menu — a format picker, a count, a quality. */
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

/** The bar itself: one line of menus, and whatever sits at its right edge. */
export function MenuBar({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <header
      className={`border-b ${HAIR} px-2 h-11 flex items-center justify-between gap-3 shrink-0`}
    >
      <div className="flex items-center gap-1.5 min-w-0">{left}</div>
      <div className="flex items-center gap-1.5 shrink-0">{right}</div>
    </header>
  );
}

/* ---------------------------------------------------------------- selects */

export type Option = { value: string; label: string; group?: string };

/**
 * A dropdown. Native on purpose: it inherits the keyboard, the type-ahead and
 * the way a phone shows a picker, none of which a hand-rolled popover gets
 * right for free. Only the chrome is ours.
 */
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
        className={`w-full h-7 appearance-none border ${HAIR} bg-transparent pl-2 pr-6 text-[11px] truncate hover:bg-foreground/5 focus:outline-none focus:border-foreground`}
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
        ▾
      </span>
    </span>
  );
}

/** Two to four choices, side by side — quicker than a dropdown, and it shows
    what the alternatives are. Past four, use a Select. */
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
          className={`flex-1 h-7 text-[11px] transition-colors ${
            value === o.value ? "bg-foreground text-background" : "hover:bg-foreground/5"
          }`}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

/* ---------------------------------------------------------------- numbers */

/**
 * A number you drag or type. Dragging is how every motion tool lets you find a
 * value without a slider eating the row; typing is how you say one exactly.
 * The whole range crosses in about 240px, and shift makes that a quarter as
 * fast for the last decimal.
 */
export function Num({
  value,
  min,
  max,
  step,
  onChange,
  width = "w-[52px]",
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
  const snap = (v: number) => {
    const stepped = Math.round(v / step) * step;
    return Math.min(max, Math.max(min, Math.round(stepped * 1e4) / 1e4));
  };
  return (
    <input
      value={draft ?? (step < 1 ? value.toFixed(2) : String(Math.round(value)))}
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
      className={`${width} shrink-0 h-7 border ${HAIR} bg-transparent px-1.5 text-[11px] text-right tabular-nums cursor-ew-resize touch-none focus:outline-none focus:border-foreground focus:cursor-text`}
    />
  );
}

/** Label, slider, box. The pair is the point: drag to find it, type to say it. */
export function Dial({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
  children,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  /** Shown instead of the box when the number isn't worth typing. */
  suffix?: string;
  /** Anything that belongs at the end of the row — the motion dot. */
  children?: ReactNode;
}) {
  return (
    <Row label={label}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 min-w-0 accent-foreground"
      />
      {suffix ? (
        <span className="w-[52px] shrink-0 text-[11px] text-muted text-right">{suffix}</span>
      ) : (
        <Num value={value} min={min} max={max} step={step} onChange={onChange} />
      )}
      {children}
    </Row>
  );
}

/* ------------------------------------------------------------------- text */

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
  const cls = `w-full border ${HAIR} bg-transparent px-2 py-1.5 text-xs leading-relaxed focus:outline-none focus:border-foreground ${
    mono ? "font-mono text-[11px]" : ""
  }`;
  return rows > 1 ? (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${cls} resize-none`}
    />
  ) : (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${cls} h-7 py-0`}
    />
  );
}

/* ----------------------------------------------------------------- panels */

/**
 * A group in the inspector: a name, a fold, and — when it's folded — a word
 * about what's inside it, so a closed group still tells you something.
 */
export function Group({
  title,
  children,
  summary,
  open: initial = true,
  note,
}: {
  title: string;
  children: ReactNode;
  summary?: string;
  open?: boolean;
  /** One line under the title, for a group whose name isn't enough. */
  note?: string;
}) {
  /* `open` is a hint, not a value: a group that holds nothing starts folded and
     opens itself the moment it holds something — add an effect from the menu and
     its group is already open when you look. Once you've folded or unfolded it
     by hand, your choice sticks. Kept as an override rather than an effect that
     writes state, which would cascade a render on every hint change. */
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? initial;
  const setOpen = (next: boolean | ((o: boolean) => boolean)) =>
    setOverride(typeof next === "function" ? next(open) : next);
  return (
    <section className={`border-b ${HAIR}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 h-9 hover:bg-foreground/5 transition-colors"
      >
        <span className="text-[9px] w-2 opacity-60">{open ? "▾" : "▸"}</span>
        <Label>{title}</Label>
        {!open && summary && (
          <span className="ml-auto text-[10px] text-muted truncate max-w-[55%]">
            {summary}
          </span>
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          {note && <p className="text-[11px] text-muted leading-relaxed pb-1">{note}</p>}
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * One thing in a stack: an effect, a mark. The header carries its name, its
 * switch and the buttons that move or remove it; the body carries its numbers.
 * This is the shape every effect panel in every motion tool has, and it is what
 * makes a stack of five effects readable instead of a wall of sliders.
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
      <div className={`h-7 flex items-center gap-1 pl-1 pr-0.5 ${open ? `border-b ${HAIR}` : ""}`}>
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
          <span className="text-[9px] opacity-60">{open ? "▾" : "▸"}</span>
          {title}
        </button>
        {onUp && (
          <button
            onClick={onUp}
            title="Earlier in the stack"
            className="size-6 grid place-items-center text-[10px] text-muted hover:text-foreground"
          >
            ↑
          </button>
        )}
        {onDown && (
          <button
            onClick={onDown}
            title="Later in the stack"
            className="size-6 grid place-items-center text-[10px] text-muted hover:text-foreground"
          >
            ↓
          </button>
        )}
        {onRemove && (
          <button
            onClick={onRemove}
            title="Remove"
            className="size-6 grid place-items-center text-[11px] text-muted hover:text-foreground"
          >
            ×
          </button>
        )}
      </div>
      {open && <div className="p-2 space-y-1">{children}</div>}
    </div>
  );
}

/** A bar over or under the canvas: view options, transport, status. */
export function Toolbar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`h-9 px-2 flex items-center gap-1.5 text-[11px] shrink-0 ${className}`}
    >
      {children}
    </div>
  );
}

export function Sep() {
  return <span className={`w-px h-4 bg-line/40 mx-1 shrink-0`} />;
}

/** A panel over the canvas — the recipe shelf, a sheet of rolled looks. Big
    grids of pictures don't belong in a 320px column. */
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
    <div className="absolute inset-0 z-30 bg-background/80 flex items-stretch justify-center p-4 md:p-8">
      <div
        ref={ref}
        className={`w-full max-w-4xl bg-background border ${HAIR} flex flex-col min-h-0`}
      >
        <div className={`border-b ${HAIR} h-9 px-3 flex items-center gap-3 shrink-0`}>
          <Label>{title}</Label>
          <span className="ml-auto flex items-center gap-1.5">{right}</span>
          <IconBtn onClick={onClose} title="Close (esc)">
            ×
          </IconBtn>
        </div>
        <div className="overflow-y-auto p-3">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- swatches */

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
  labels?: Record<string, string>;
}) {
  return (
    <span className="flex items-center gap-1 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`h-7 px-2 border text-[11px] transition-colors ${
            value === o.value
              ? "border-foreground bg-foreground text-background"
              : `${HAIR} text-muted hover:text-foreground`
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
            value === hex ? "border-foreground scale-110" : `${HAIR} hover:scale-110`
          }`}
        />
      ))}
    </span>
  );
}
