// Canvas 2D procedural animators — the club's Cavalry-style generative
// layer: staggered repeaters, radial arrays, oscillating fields. Everything
// is drawn from (type, params, theme, time) so the same function powers the
// live preview and every exported frame.
//
// Loop contract: every animation is periodic in `duration` seconds (speeds
// resolve to whole cycles per loop), so a recorded reel of that length
// loops seamlessly.

import { tones, type ShaderSpec, type Theme } from "@/lib/postlab";

const TAU = Math.PI * 2;

const num = (v: number | string | undefined, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : def;

export function drawGenerative(
  ctx: CanvasRenderingContext2D,
  spec: ShaderSpec,
  theme: Theme,
  t: number,
  duration: number,
  w: number,
  h: number,
) {
  const { ink, bg } = tones(theme);
  const u = w / 1080;
  const D = Math.max(2, duration);
  const tt = (((t % D) + D) % D) / D; // 0..1 loop phase
  // Whole cycles per loop keeps t=0 and t=duration identical frames.
  const cycles = Math.max(1, Math.round(num(spec.speed, 0.5) * 3));
  const ph = tt * cycles; // grows by an integer over one loop

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineCap = "round";

  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.hypot(w, h) / 2;

  switch (spec.type) {
    case "grid": {
      const cols = Math.round(num(spec.density, 9));
      const size = num(spec.size, 0.8);
      const spread = num(spec.spread, 1.2);
      const shape = String(spec.shape ?? "circle");
      const cell = w / cols;
      const rows = Math.ceil(h / cell);
      ctx.lineWidth = 3 * u;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = (c + 0.5) * cell;
          const y = (r + 0.5) * cell;
          const dn = Math.hypot(x - cx, y - cy) / maxR;
          const s01 = 0.5 + 0.5 * Math.sin(TAU * (ph - dn * spread));
          const rad = cell * 0.42 * size * (0.15 + 0.85 * s01);
          if (shape === "square") {
            ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
          } else if (shape === "cross") {
            ctx.beginPath();
            ctx.moveTo(x - rad, y);
            ctx.lineTo(x + rad, y);
            ctx.moveTo(x, y - rad);
            ctx.lineTo(x, y + rad);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(x, y, rad, 0, TAU);
            ctx.fill();
          }
        }
      }
      break;
    }

    case "rays": {
      const count = Math.round(num(spec.count, 36));
      const inner = num(spec.inner, 0.15) * maxR;
      ctx.lineWidth = num(spec.weight, 2) * u;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU + TAU * ph;
        const pulse = 0.5 + 0.5 * Math.sin(TAU * ph + (i / count) * TAU * 3);
        const len = (maxR - inner) * (0.3 + 0.7 * pulse);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
        ctx.lineTo(cx + Math.cos(a) * (inner + len), cy + Math.sin(a) * (inner + len));
        ctx.stroke();
      }
      break;
    }

    case "tunnel": {
      const count = Math.round(num(spec.count, 10));
      const shape = String(spec.shape ?? "circle");
      ctx.lineWidth = num(spec.weight, 2) * u;
      for (let i = 0; i < count; i++) {
        const p = (((i + ph * count) % count) + count) % count / count;
        const r = maxR * 1.05 * Math.pow(p, 1.6);
        ctx.globalAlpha = Math.sin(p * Math.PI);
        ctx.beginPath();
        if (shape === "square") ctx.rect(cx - r, cy - r, r * 2, r * 2);
        else ctx.arc(cx, cy, r, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }

    case "bars": {
      const rows = Math.round(num(spec.rows, 14));
      const phase = num(spec.phase, 0.12);
      const fill = num(spec.fill, 0.7);
      const rowH = h / rows;
      for (let r = 0; r < rows; r++) {
        const bw = w * (0.5 + 0.48 * Math.sin(TAU * (ph + r * phase)));
        const y = r * rowH + (rowH * (1 - fill)) / 2;
        if (r % 2) ctx.fillRect(w - bw, y, bw, rowH * fill);
        else ctx.fillRect(0, y, bw, rowH * fill);
      }
      break;
    }

    case "orbits": {
      const rings = Math.round(num(spec.rings, 4));
      const dots = Math.round(num(spec.dots, 5));
      const dotSize = num(spec.dotSize, 1);
      const R0 = Math.min(w, h) / 2 - 40 * u;
      ctx.lineWidth = 2 * u;
      for (let k = 0; k < rings; k++) {
        const R = (R0 * (k + 1)) / rings;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, TAU);
        ctx.stroke();
        ctx.restore();
        const dir = k % 2 ? -1 : 1;
        const laps = (k % 3) + 1; // inner rings lap more often, all loop
        for (let m = 0; m < dots; m++) {
          const a = TAU * (m / dots + dir * ph * laps);
          const rad = (6 + 8 * (k / Math.max(1, rings - 1))) * u * dotSize;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, rad, 0, TAU);
          ctx.fill();
        }
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 6 * u * dotSize, 0, TAU);
      ctx.fill();
      break;
    }

    case "bloom": {
      const count = Math.round(num(spec.count, 220));
      const size = num(spec.size, 1);
      const golden = Math.PI * (3 - Math.sqrt(5));
      const R0 = Math.min(w, h) / 2 - 30 * u;
      for (let n = 0; n < count; n++) {
        const a = n * golden + TAU * ph;
        const r = R0 * Math.sqrt(n / count);
        const pulse = 0.5 + 0.5 * Math.sin(TAU * ph - (n / count) * TAU * 2);
        const rad = u * size * (1.5 + 7 * Math.sqrt(n / count)) * (0.4 + 0.6 * pulse);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, rad, 0, TAU);
        ctx.fill();
      }
      break;
    }

    case "field": {
      const rows = Math.round(num(spec.rows, 12));
      const amp = num(spec.amplitude, 0.5);
      const freq = num(spec.frequency, 1.5);
      const rowH = h / rows;
      ctx.lineWidth = 2.5 * u;
      for (let r = 0; r < rows; r++) {
        const baseY = (r + 0.5) * rowH;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 8 * u) {
          const y =
            baseY +
            amp * rowH * 0.9 *
              Math.sin((x / w) * TAU * freq + TAU * ph + r * 0.7);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
  }
}
