"use client";

import { useState } from "react";
import Figure from "./Figure";
import { Chips, Switch } from "./controls";
import { num, bool, type Params } from "./params";

/* A baseline grid. Two columns of real type over a ruled ground. With snap
   on, every line-height and every margin is a whole number of units, so the
   second column's lines fall in step with the first's, heading or no heading.
   With snap off the type keeps its "natural" leading and the columns drift
   apart within a few lines. */

const UNITS = [8, 12, 16] as const;
type Unit = (typeof UNITS)[number];

const BODY = 15;
const HEAD = 26;

const snapTo = (px: number, unit: number) => Math.ceil(px / unit) * unit;

const PARA_ONE =
  "A grid is a promise you make before the first element lands. Columns decide where things may start and stop; the baseline decides where lines of type may sit. Keep both and two columns of unrelated text still read as one page.";
const PARA_TWO =
  "Break the baseline and nothing looks wrong in any single column. It is only when two sit side by side that the lines start to slip past each other, a pixel or two at a time, until the page looks tired without anyone being able to say why.";

export default function GridBaseline({ params, caption }: { params: Params; caption?: string }) {
  const start = num(params, "unit", 12, 8, 16);
  const [unit, setUnit] = useState<Unit>((UNITS as readonly number[]).includes(start) ? (start as Unit) : 12);
  const [snap, setSnap] = useState(bool(params, "snap", true));

  const bodyLh = snap ? snapTo(BODY * 1.5, unit) : BODY * 1.5;
  const headLh = snap ? snapTo(HEAD * 1.15, unit) : HEAD * 1.15;
  const headGap = snap ? unit : 10;
  const pad = snap ? unit * 2 : 20;

  return (
    <Figure
      aspect={null}
      caption={caption}
      readout={
        snap
          ? `body ${bodyLh}px = ${bodyLh / unit} × ${unit} · heading ${headLh}px = ${headLh / unit} × ${unit}`
          : `body ${bodyLh}px · heading ${headLh.toFixed(1)}px · nothing shared`
      }
      stage={
        <div
          className="relative"
          style={{
            padding: pad,
            backgroundImage: `repeating-linear-gradient(to bottom, color-mix(in srgb, var(--foreground) 14%, transparent) 0 1px, transparent 1px ${unit}px)`,
            backgroundPosition: `0 ${pad - 1}px`,
          }}
        >
          <div className="grid gap-x-6 md:grid-cols-2" style={{ rowGap: snap ? unit * 2 : 24 }}>
            <div>
              <h4
                className="font-serif"
                style={{ fontSize: HEAD, lineHeight: `${headLh}px`, marginBottom: headGap }}
              >
                Lines that agree
              </h4>
              <p style={{ fontSize: BODY, lineHeight: `${bodyLh}px` }}>{PARA_ONE}</p>
            </div>
            <div>
              <p style={{ fontSize: BODY, lineHeight: `${bodyLh}px` }}>{PARA_TWO}</p>
            </div>
          </div>
        </div>
      }
      controls={
        <>
          <Chips
            label="Unit"
            value={String(unit)}
            options={UNITS.map((u) => ({ value: String(u), label: `${u}px` }))}
            onChange={(v) => setUnit(Number(v) as Unit)}
          />
          <Switch label="Leading" on={snap} onChange={setSnap} labels={["Snapped", "Natural"]} />
        </>
      }
    />
  );
}
