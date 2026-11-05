// Progress over time for one unit's enter: spring+anticipation vs the
// reference bezier, on the same millisecond axis. The playhead is moved
// imperatively each frame, never through React state.

import { useMemo, useRef, type MutableRefObject } from "react";
import { progressAt, phaseMs } from "@core/phase.ts";
import type { Mode, Phase } from "@core/types.ts";
import { useFrame } from "../useFrame.ts";

const W = 800, H = 190, PAD = { l: 34, r: 10, t: 12, b: 22 };
const Y0 = -0.35, Y1 = 1.45;

export default function CurvePlot({ spring, reference, clock }: { spring: Phase; reference: Phase; clock: MutableRefObject<{ t: number }> }) {
  const head = useRef<SVGLineElement>(null);
  const { springPath, refPath, domain, ticks } = useMemo(() => {
    const sMs = phaseMs(spring, "spring");
    const rMs = phaseMs(reference, "bezier");
    const domain = Math.max(sMs, rMs) * 1.05;
    const x = (ms: number) => PAD.l + (ms / domain) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + ((Y1 - v) / (Y1 - Y0)) * (H - PAD.t - PAD.b);
    const path = (phase: Phase, mode: Mode) => {
      const pts: string[] = [];
      for (let i = 0; i <= 240; i++) {
        const ms = (i / 240) * domain;
        pts.push(`${x(ms).toFixed(1)},${y(progressAt(phase, ms, mode)).toFixed(1)}`);
      }
      return "M" + pts.join("L");
    };
    const step = domain > 1500 ? 500 : domain > 600 ? 200 : 100;
    const ticks: { ms: number; x: number }[] = [];
    for (let ms = 0; ms <= domain; ms += step) ticks.push({ ms, x: x(ms) });
    return { springPath: path(spring, "spring"), refPath: path(reference, "bezier"), domain, ticks };
  }, [spring, reference]);

  const yOf = (v: number) => PAD.t + ((Y1 - v) / (Y1 - Y0)) * (H - PAD.t - PAD.b);

  useFrame(() => {
    const el = head.current;
    if (!el) return;
    const t = clock.current.t;
    const visible = t <= domain;
    const x = PAD.l + (Math.min(t, domain) / domain) * (W - PAD.l - PAD.r);
    el.setAttribute("x1", String(x));
    el.setAttribute("x2", String(x));
    el.style.opacity = visible ? "1" : "0";
  });

  return (
    <div className="plot">
      <div className="legend">
        <span><span className="swatch" style={{ background: "var(--indigo)" }} />spring + anticipation</span>
        <span><span className="swatch" style={{ background: "var(--ink)", opacity: 0.5 }} />bezier reference</span>
        <span style={{ marginLeft: "auto" }}>first unit · progress (0 = from, 1 = to) over ms</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Progress curves">
        {[0, 1].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yOf(v)} y2={yOf(v)} stroke="rgba(12,12,12,.18)" strokeDasharray={v === 0 ? "none" : "3 3"} />
            <text x={PAD.l - 6} y={yOf(v) + 4} fontSize="11" textAnchor="end" fill="#6b6b6b">{v}</text>
          </g>
        ))}
        {ticks.map((t) => (
          <text key={t.ms} x={t.x} y={H - 6} fontSize="11" textAnchor="middle" fill="#9a9a96">{t.ms}</text>
        ))}
        <path d={refPath} fill="none" stroke="#0c0c0c" strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
        <path d={springPath} fill="none" stroke="#3d3deb" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        <line ref={head} y1={PAD.t} y2={H - PAD.b} stroke="#0c0c0c" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
