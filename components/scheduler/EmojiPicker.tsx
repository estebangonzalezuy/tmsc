"use client";

import { useEffect, useRef, useState } from "react";
import { EMOJI, searchEmoji } from "@/lib/emoji";

// The emoji picker: a search box over a curated few hundred, grouped, no
// dependency. The composer opens it beside the words and it hands back one
// glyph, which the composer drops at the caret.

export default function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (glyph: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  const q = query.trim();
  const groups = q
    ? [{ label: "Matches", rows: searchEmoji(q) }]
    : EMOJI;

  return (
    <div
      ref={box}
      role="dialog"
      aria-label="Emoji"
      className="card card-sm absolute z-20 mt-2 w-[20rem] max-w-[calc(100vw-2.5rem)] p-3 space-y-2"
    >
      <input
        ref={input}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search — fire, rocket, clap…"
        className="w-full inset px-3 py-1.5 text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground"
      />
      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="text-[11px] uppercase tracking-wide text-muted px-1 pb-1">
              {g.label}
            </p>
            {g.rows.length === 0 ? (
              <p className="px-1 text-sm text-muted">Nothing called that.</p>
            ) : (
              <div className="grid grid-cols-8 gap-0.5">
                {g.rows.map((row) => (
                  <button
                    key={row[0] + row[1]}
                    type="button"
                    title={row[1]}
                    onClick={() => onPick(row[0])}
                    className="aspect-square rounded-md text-xl leading-none hover:bg-foreground/8 transition-colors"
                  >
                    {row[0]}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
