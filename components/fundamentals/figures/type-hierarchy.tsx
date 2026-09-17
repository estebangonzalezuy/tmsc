"use client";

import { useState } from "react";
import Figure from "./Figure";
import { Chips } from "./controls";
import { pick, type Params } from "./params";

/* Hierarchy, one lever at a time. The same three pieces of text — a
   kicker, a title, a paragraph — and a single thing changed. Each lever on
   its own is enough to tell the reader what to read first. Real pages pull
   two, maybe three. Pulling all five is the beginner's tell. */

const LEVERS = [
  { value: "none", label: "None", note: "everything set the same, so nothing is first" },
  { value: "size", label: "Size", note: "the title is bigger, and that is all" },
  { value: "weight", label: "Weight", note: "the title is heavier at the same size" },
  { value: "case", label: "Case", note: "the kicker is capitals with air between the letters" },
  { value: "space", label: "Space", note: "the same type, with room around the title" },
  { value: "face", label: "Face", note: "the title changes typeface, in italic" },
] as const;
type Lever = (typeof LEVERS)[number]["value"];
const LEVER_KEYS = LEVERS.map((l) => l.value);

export default function TypeHierarchy({ params, caption }: { params: Params; caption?: string }) {
  const [lever, setLever] = useState<Lever>(pick(params, "lever", LEVER_KEYS, "size"));
  const note = LEVERS.find((l) => l.value === lever)!.note;

  const is = (l: Lever) => lever === l;

  return (
    <Figure
      aspect={null}
      caption={caption}
      readout={note}
      stage={
        <div className="px-6 py-6 max-w-lg" style={{ fontSize: 16, lineHeight: 1.5 }}>
          <p
            className={is("case") ? "uppercase" : ""}
            style={{
              fontSize: is("case") ? 12 : undefined,
              letterSpacing: is("case") ? "0.12em" : undefined,
              marginBottom: is("space") ? 28 : 0,
            }}
          >
            the Motion Social Club
          </p>
          <p
            className={is("face") ? "font-serif italic" : ""}
            style={{
              fontSize: is("size") ? 40 : undefined,
              lineHeight: is("size") ? 1.1 : undefined,
              fontWeight: is("weight") ? 600 : undefined,
              marginBottom: is("space") ? 28 : 0,
            }}
          >
            Start in motion today, from the base.
          </p>
          <p>
            You don&apos;t need more tutorials. You need an order to do things in, a constraint,
            and a reason to finish.
          </p>
        </div>
      }
      controls={
        <Chips label="Lever" value={lever} options={LEVERS.map((l) => ({ value: l.value, label: l.label }))} onChange={setLever} />
      }
    />
  );
}
