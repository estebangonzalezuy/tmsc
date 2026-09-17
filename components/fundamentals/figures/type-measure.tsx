"use client";

import { useEffect, useRef, useState } from "react";
import Figure from "./Figure";
import { Slider } from "./controls";
import { num, type Params } from "./params";

/* Measure and leading. The measure is how many characters a line holds
   before the eye has to travel back; the leading is how far down it lands.
   They are one decision: a long line needs more leading to find its way
   home, a short one needs less or the paragraph turns into a ladder. */

const TEXT =
  "Most people arrive at motion design through a piece of software. They see something move, they find out what it was made in, and the first question becomes how to learn that tool. I think that is the wrong first question, and it costs people about a year. The timing is the design. Everything else is typing.";

function verdict(chars: number) {
  if (chars < 45) return "short: the eye is always turning back";
  if (chars <= 75) return "comfortable";
  return "long: easy to lose the next line";
}

export default function TypeMeasure({ params, caption }: { params: Params; caption?: string }) {
  const [measure, setMeasure] = useState(num(params, "measure", 66, 30, 95));
  const [leading, setLeading] = useState(num(params, "leading", 1.5, 1, 1.9));
  const box = useRef<HTMLParagraphElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  /* What the line actually holds once the column has had its say — on a
     phone the stage is narrower than a 95ch line. */
  const [actual, setActual] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    const ch = probe.current;
    if (!el || !ch) return;
    const read = () => {
      const w = ch.getBoundingClientRect().width / 10;
      if (w > 0) setActual(Math.round(el.getBoundingClientRect().width / w));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const chars = actual ?? measure;

  return (
    <Figure
      aspect={null}
      caption={caption}
      readout={`≈ ${chars} characters per line · ${verdict(chars)}`}
      stage={
        <div className="px-6 py-5">
          <span ref={probe} aria-hidden className="absolute invisible text-[15px]">
            0000000000
          </span>
          <p ref={box} className="text-[15px] max-w-full" style={{ width: `${measure}ch`, lineHeight: leading }}>
            {TEXT}
          </p>
        </div>
      }
      controls={
        <>
          <Slider label="Measure" value={measure} min={30} max={95} onChange={setMeasure} format={(v) => `${v}ch`} />
          <Slider label="Leading" value={leading} min={1} max={1.9} step={0.05} onChange={setLeading} format={(v) => v.toFixed(2)} />
        </>
      }
    />
  );
}
