// Canvas 2D procedural animators — the club's Cavalry-style generative
// layer: staggered repeaters, radial arrays, oscillating fields. Everything
// is drawn from (type, params, theme, time) so the same function powers the
// live preview and every exported frame.
//
// Loop contract: every animation is periodic in `duration` seconds (speeds
// resolve to whole cycles per loop), so a recorded reel of that length
// loops seamlessly.
//
// Grit comes from geometry, not filters: a smooth flow field (also periodic
// in the loop) displaces and deforms the shapes themselves — blobby grid
// dots, bent crosses, wobbly rings, warped lattice lines — controlled by
// each type's `warp` parameter.

import { tones, type ShaderSpec, type Theme } from "@/lib/postlab";

const TAU = Math.PI * 2;

const num = (v: number | string | undefined, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : def;

/* Smooth pseudo-noise flow field in ~[-1,1]². `ph` is the loop phase times
   whole cycles, so time only ever enters as sin/cos of TAU·ph — the field
   at ph=0 and ph=cycles is identical, keeping exports seamless. */
function flow(nx: number, ny: number, ph: number): { fx: number; fy: number } {
  const t = TAU * ph;
  const fx =
    (Math.sin(nx * 3.1 + Math.cos(ny * 2.3 + t) + t) +
      0.5 * Math.sin(ny * 5.7 - t + 1.3)) /
    1.5;
  const fy =
    (Math.cos(ny * 2.9 + Math.sin(nx * 3.7 - t) - t) +
      0.5 * Math.cos(nx * 4.9 + t + 2.1)) /
    1.5;
  return { fx, fy };
}

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
  const warp = Math.max(0, Math.min(1, num(spec.warp, 0)));

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Layer transform (drag / wheel / shift-drag on the canvas).
  const cx = w / 2;
  const cy = h / 2;
  ctx.translate(cx + num(spec.offsetX, 0) * w, cy + num(spec.offsetY, 0) * h);
  ctx.rotate((num(spec.rotation, 0) * Math.PI) / 180);
  const sc = Math.max(0.1, num(spec.scale, 1));
  ctx.scale(sc, sc);
  ctx.translate(-cx, -cy);

  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const maxR = Math.hypot(w, h) / 2;
  const m = Math.min(w, h);
  /* Displace a point through the flow field; amp in px. */
  const displace = (x: number, y: number, amp: number) => {
    if (!amp) return { x, y };
    const { fx, fy } = flow((x / m) * 2, (y / m) * 2, ph);
    return { x: x + fx * amp, y: y + fy * amp };
  };

  switch (spec.type) {
    case "grid": {
      const cols = Math.round(num(spec.density, 9));
      const size = num(spec.size, 0.8);
      const spread = num(spec.spread, 1.2);
      const shape = String(spec.shape ?? "circle");
      const cell = w / cols;
      const rows = Math.ceil(h / cell);
      const amp = warp * cell * 0.9;
      ctx.lineWidth = 3 * u;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const p = displace((c + 0.5) * cell, (r + 0.5) * cell, amp);
          const dn = Math.hypot(p.x - cx, p.y - cy) / maxR;
          const s01 = 0.5 + 0.5 * Math.sin(TAU * (ph - dn * spread));
          const rad = cell * 0.42 * size * (0.15 + 0.85 * s01);
          const cellPh = r * 1.7 + c * 2.3;
          if (shape === "square") {
            // deform the square by displacing each corner separately
            ctx.beginPath();
            [
              [-1, -1],
              [1, -1],
              [1, 1],
              [-1, 1],
            ].forEach(([sx, sy], i) => {
              const q = displace(p.x + sx * rad, p.y + sy * rad, amp * 0.6);
              if (i === 0) ctx.moveTo(q.x, q.y);
              else ctx.lineTo(q.x, q.y);
            });
            ctx.closePath();
            ctx.fill();
          } else if (shape === "cross") {
            // bent cross: each arm passes through a displaced midpoint
            ctx.beginPath();
            for (const [ax, ay, bx, by] of [
              [-rad, 0, rad, 0],
              [0, -rad, 0, rad],
            ]) {
              const a = displace(p.x + ax, p.y + ay, amp * 0.5);
              const mid = displace(p.x, p.y, amp * 0.7);
              const b = displace(p.x + bx, p.y + by, amp * 0.5);
              ctx.moveTo(a.x, a.y);
              ctx.quadraticCurveTo(mid.x, mid.y, b.x, b.y);
            }
            ctx.stroke();
          } else if (warp > 0) {
            // blobby dot: radius modulated around the circle
            ctx.beginPath();
            const steps = 14;
            for (let i = 0; i <= steps; i++) {
              const a = (i / steps) * TAU;
              const rr =
                rad *
                (1 +
                  warp *
                    0.45 *
                    Math.sin(3 * a + cellPh + TAU * ph) *
                    Math.cos(2 * a - cellPh));
              const px = p.x + Math.cos(a) * rr;
              const py = p.y + Math.sin(a) * rr;
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, rad, 0, TAU);
            ctx.fill();
          }
        }
      }
      break;
    }

    case "lattice": {
      // warped graph paper: grid lines pushed through the flow field
      const cells = Math.round(num(spec.cells, 12));
      const sp = w / cells;
      const amp = warp * sp * 0.9;
      const step = 22 * u;
      ctx.lineWidth = num(spec.weight, 1.5) * u;
      for (let x = 0; x <= w + 1; x += sp) {
        ctx.beginPath();
        for (let y = -amp; y <= h + amp; y += step) {
          const p = displace(x, y, amp);
          if (y <= -amp + step / 2) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      for (let y = 0; y <= h + 1; y += sp) {
        ctx.beginPath();
        for (let x = -amp; x <= w + amp; x += step) {
          const p = displace(x, y, amp);
          if (x <= -amp + step / 2) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      break;
    }

    case "rays": {
      const count = Math.round(num(spec.count, 36));
      const inner = num(spec.inner, 0.15) * maxR;
      const amp = warp * 60 * u;
      ctx.lineWidth = num(spec.weight, 2) * u;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU + TAU * ph;
        const pulse = 0.5 + 0.5 * Math.sin(TAU * ph + (i / count) * TAU * 3);
        const len = (maxR - inner) * (0.3 + 0.7 * pulse);
        // bend the ray: sample along it, push each point sideways
        ctx.beginPath();
        const steps = warp > 0 ? 8 : 1;
        for (let s2 = 0; s2 <= steps; s2++) {
          const d = inner + (len * s2) / steps;
          const bx = cx + Math.cos(a) * d;
          const by = cy + Math.sin(a) * d;
          const p = displace(bx, by, amp * (s2 / steps));
          if (s2 === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      break;
    }

    case "tunnel": {
      const count = Math.round(num(spec.count, 10));
      const shape = String(spec.shape ?? "circle");
      ctx.lineWidth = num(spec.weight, 2) * u;
      for (let i = 0; i < count; i++) {
        const p = ((((i + ph * count) % count) + count) % count) / count;
        const r = maxR * 1.05 * Math.pow(p, 1.6);
        ctx.globalAlpha = Math.sin(p * Math.PI);
        ctx.beginPath();
        if (shape === "square" && warp === 0) {
          ctx.rect(cx - r, cy - r, r * 2, r * 2);
        } else if (warp === 0) {
          ctx.arc(cx, cy, r, 0, TAU);
        } else {
          // wobbly ring: radius modulated around the circumference
          const steps = 64;
          for (let s2 = 0; s2 <= steps; s2++) {
            const a = (s2 / steps) * TAU;
            const sq =
              shape === "square"
                ? 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)))
                : 1;
            const rr =
              r *
              sq *
              (1 +
                warp *
                  0.25 *
                  (Math.sin(3 * a + TAU * ph + i * 1.7) * 0.6 +
                    Math.sin(5 * a - TAU * ph) * 0.4));
            const px = cx + Math.cos(a) * rr;
            const py = cy + Math.sin(a) * rr;
            if (s2 === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
        }
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
      const amp = warp * rowH * 0.6;
      for (let r = 0; r < rows; r++) {
        const bw = w * (0.5 + 0.48 * Math.sin(TAU * (ph + r * phase)));
        const y = r * rowH + (rowH * (1 - fill)) / 2;
        const barH = rowH * fill;
        const x0 = r % 2 ? w - bw : 0;
        if (warp === 0) {
          ctx.fillRect(x0, y, bw, barH);
        } else {
          // gritty bar: top and bottom edges ripple through the field
          ctx.beginPath();
          const step = 36 * u;
          for (let x = x0; x <= x0 + bw; x += step) {
            const p = displace(x, y, amp);
            if (x === x0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
          for (let x = x0 + bw; x >= x0; x -= step) {
            const p = displace(x, y + barH, amp);
            ctx.lineTo(p.x, p.y);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
      break;
    }

    case "orbits": {
      const rings = Math.round(num(spec.rings, 4));
      const dots = Math.round(num(spec.dots, 5));
      const dotSize = num(spec.dotSize, 1);
      const R0 = m / 2 - 40 * u;
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
        for (let mi = 0; mi < dots; mi++) {
          const a = TAU * (mi / dots + dir * ph * laps);
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
      const R0 = m / 2 - 30 * u;
      const amp = warp * 30 * u;
      for (let n = 0; n < count; n++) {
        const a = n * golden + TAU * ph;
        const r = R0 * Math.sqrt(n / count);
        const pulse = 0.5 + 0.5 * Math.sin(TAU * ph - (n / count) * TAU * 2);
        const rad =
          u * size * (1.5 + 7 * Math.sqrt(n / count)) * (0.4 + 0.6 * pulse);
        const p = displace(
          cx + Math.cos(a) * r,
          cy + Math.sin(a) * r,
          amp * Math.sqrt(n / count),
        );
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, TAU);
        ctx.fill();
      }
      break;
    }

    case "field": {
      const rows = Math.round(num(spec.rows, 12));
      const amp = num(spec.amplitude, 0.5);
      const freq = num(spec.frequency, 1.5);
      const rowH = h / rows;
      const wAmp = warp * rowH * 1.4;
      ctx.lineWidth = 2.5 * u;
      for (let r = 0; r < rows; r++) {
        const baseY = (r + 0.5) * rowH;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 8 * u) {
          const y =
            baseY +
            amp * rowH * 0.9 *
              Math.sin((x / w) * TAU * freq + TAU * ph + r * 0.7);
          const p = displace(x, y, wAmp);
          if (x === 0) ctx.moveTo(x, p.y);
          else ctx.lineTo(x, p.y);
        }
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}
