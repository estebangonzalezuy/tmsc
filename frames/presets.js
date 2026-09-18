// Starters. Each is written as a real function so it is checked as JavaScript
// when this file loads; the editor gets its body via toString().
//
// Two faces only, Archivo and Lora. Seven background systems, each one a
// seamless loop, and boxed type over them. Every starter declares its
// options (colours, copy, an entrance, a shake) so the Options panel can
// change it without touching the code.
(function () {
  const F = window.FRAMES;

  /* ----------------------------------------------------------- shared -- */

  const SHARED = function () {
    // Shared runs before every slide, so anything declared here is in scope
    // there. The two faces — the only two — and the club's colours.
    const sans = "Archivo, system-ui, sans-serif";
    const serif = "Lora, Georgia, serif";

    const P = {
      periwinkle: "#adb4f5",
      green: "#2e7d46",
      black: "#000000",
      white: "#ffffff",
      red: "#ee4b2b",
      indigo: "#3d3deb",
      cream: "#fffdf0",
      paper: "#f4f3ef",
      maroon: "#4b1a10", // the confetti's dark disc, the polygons' corner blocks
      olive: "#8a8a5a", // the tape's dull dot
      amber: "#f4a71d", // the rays, the polygons' ground
      pink: "#f2a1c4", // a disc in the network
      grey: "#9a9a9a", // a wedge in the burst
    };
    const paper = P.cream;
    const ink = P.black;

    // Named ink sets, for a "Discs" or "Marks" option.
    const SETS = {
      club: [P.white, P.red, P.maroon, P.periwinkle, P.white, P.red, P.green, P.white],
      warm: [P.red, P.maroon, P.white, P.cream, P.red],
      cool: [P.indigo, P.periwinkle, P.white, P.green, P.periwinkle],
      mono: [P.black, P.white, P.paper, P.black],
      festival: [P.indigo, P.periwinkle, P.cream, P.red, P.green, P.black, P.maroon, P.white, P.grey],
      garden: [P.indigo, P.red, P.green, P.periwinkle, P.amber, P.black, P.pink, P.maroon, P.olive, P.grey],
    };
    const SET_NAMES = Object.keys(SETS);

    /* ---- boxed type --------------------------------------------------- */

    // A hairline box. The type inside is meant to overhang it a little.
    function box(ctx, x, y, w, h, fill, stroke) {
      ctx.save();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeStyle = stroke || ink;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }

    // One line of type in a pill, centred on (0, 0). Rich text: *italic*,
    // **bold**. Use inside s.place() to animate it.
    function pillAt(ctx, s, text, o) {
      const size = o.size;
      const h = size * 1.3;
      const f = { size, family: o.family || serif, weight: o.weight || 700 };
      const w = s.measure(text, f) + size;
      ctx.fillStyle = o.fill || P.white;
      s.roundRect(-w / 2, -h / 2, w, h, h / 2);
      ctx.fill();
      if (o.stroke) {
        ctx.strokeStyle = o.stroke;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = o.color || P.indigo;
      ctx.textBaseline = "middle";
      s.rich(text, 0, size * 0.08, { ...f, align: "center" });
    }

    // The same pill placed at (cx, cy) under an entrance `fx`.
    function pill(ctx, s, text, cx, cy, o) {
      s.place(cx, cy, o.fx || s.enter("none", 1), () => pillAt(ctx, s, text, o));
    }

    // "the Motion Social Club", Lora, boxed, near the bottom.
    function footer(ctx, s, o) {
      o = o || {};
      const text = o.text || "the Motion Social Club";
      const size = Math.round(s.w * 0.03);
      const f = { size, family: serif, weight: 400 };
      const w = s.measure(text, f);
      const x = s.w / 2;
      const y = s.h - s.w * 0.075;
      ctx.save();
      ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
      if (o.fill) {
        ctx.fillStyle = o.fill;
        ctx.fillRect(x - w * 0.47, y - size * 0.55, w * 0.94, size * 0.9);
      }
      if (o.box !== false) {
        ctx.strokeStyle = o.color || ink;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - w * 0.47, y - size * 0.55, w * 0.94, size * 0.9);
      }
      ctx.fillStyle = o.color || ink;
      ctx.textBaseline = "alphabetic";
      s.rich(text, x, y + size * 0.1, { ...f, align: "center" });
      ctx.restore();
    }

    // A small numbered box, like a page number.
    function tag(ctx, s, text, cx, cy, color) {
      const size = Math.round(s.w * 0.035);
      ctx.save();
      ctx.fillStyle = color || ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = s.font({ size, weight: 400, family: sans });
      box(ctx, cx - size * 0.42, cy - size * 0.86, size * 0.84, size * 1.12, null, color);
      ctx.fillText(text, cx, cy);
      ctx.restore();
    }

    // Type with hard offset copies behind it, like a misregistered print.
    // Offsets are in em: { dx, dy, color }.
    function echo(ctx, s, text, x, y, o) {
      const offs = o.offsets || [{ dx: -0.035, dy: 0.035, color: P.black }];
      const f = { size: o.size, family: o.family || sans, weight: o.weight || 700, align: o.align || "center", italic: o.italic };
      offs.forEach((e) => {
        ctx.fillStyle = e.color;
        s.rich(text, x + e.dx * o.size, y + e.dy * o.size, f);
      });
      ctx.fillStyle = o.color || P.white;
      s.rich(text, x, y, f);
    }

    // The grit knobs, declared as options in one go. Returns what s.grit takes.
    function gritOptions(s, t, d) {
      d = d || {};
      const rough = s.range("Rough", d.rough == null ? 0.3 : d.rough, 0, 1);
      const grain = s.range("Grain", d.grain == null ? 0.6 : d.grain, 0, 1.5);
      const chunk = s.range("Chunk", d.chunk == null ? 3 : d.chunk, 1, 10, 1);
      const bleed = s.range("Bleed", d.bleed == null ? 0 : d.bleed, -1, 1);
      const chroma = s.range("Chroma", d.chroma == null ? 0 : d.chroma, 0, 1);
      const boil = s.range("Boil", d.boil == null ? 8 : d.boil, 0, 24, 1);
      return { rough: rough * s.w * 0.012, grain, chunk, bleed: bleed * s.w * 0.008, chroma: chroma * s.w * 0.012, boil, t };
    }

    /* ---- backgrounds -------------------------------------------------- */

    // 1 — confetti: a packed field of discs, each one circling its home once
    //     per loop, so the field jostles and never jumps.
    function confetti(ctx, s, t, o) {
      o = o || {};
      const inks = o.inks || SETS.club;
      const m = o.margin == null ? s.w * 0.05 : o.margin;
      const r = o.radius || s.w * 0.019;
      ctx.fillStyle = o.ground || P.green;
      ctx.fillRect(0, 0, s.w, s.h);
      const pitch = r * 1.5;
      const cols = Math.floor((s.w - 2 * m) / pitch);
      const rows = Math.floor((s.h - 2 * m) / pitch);
      const x0 = (s.w - cols * pitch) / 2 + pitch / 2;
      const y0 = (s.h - rows * pitch) / 2 + pitch / 2;
      const rnd = s.rand(o.seed || 11);
      const swing = o.swing == null ? 1 : o.swing;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const a = rnd(), b = rnd(), c = rnd(), d = rnd();
          const ang = s.TAU * (t * (d < 0.5 ? 1 : -1) + a); // one revolution per loop
          const orbit = r * (0.2 + 0.4 * b) * swing;
          const x = x0 + i * pitch + (a - 0.5) * pitch * 0.7 + Math.cos(ang) * orbit;
          const y = y0 + j * pitch + (b - 0.5) * pitch * 0.7 + Math.sin(ang) * orbit;
          ctx.fillStyle = inks[Math.floor(c * inks.length)];
          s.circle(x, y, r * (0.8 + 0.35 * d));
          ctx.fill();
        }
      }
    }

    // 2 — tape: columns of dots and stacked bars, scrolling like punched
    //     tape. A column repeats every `period` units and moves a whole
    //     number of periods per loop, so the scroll is seamless.
    function tape(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.cream;
      ctx.fillRect(0, 0, s.w, s.h);
      const cols = o.columns || 11;
      const unit = s.w * 0.018;
      const period = 32;
      const sets = o.inks || [
        [P.indigo, P.periwinkle, P.white],
        [P.green, P.olive, P.white],
        [P.red],
        [P.black],
        [P.olive],
        [P.periwinkle, P.indigo],
        [P.maroon],
      ];
      const speed = o.speed || 1;
      const rnd = s.rand(o.seed || 5);
      const gutter = s.w * 0.06;
      const pitch = (s.w - 2 * gutter) / (cols - 1);
      const H = period * unit;
      for (let c = 0; c < cols; c++) {
        const x = gutter + c * pitch;
        const items = [];
        let u = 0;
        while (u < period) {
          const kind = rnd();
          const set = sets[Math.floor(rnd() * sets.length)];
          if (kind < 0.5) {
            items.push({ u, dot: true, color: set[0] });
            u += 1;
          } else if (kind < 0.75) {
            u += 1; // a gap
          } else {
            const n = 2 + Math.floor(rnd() * 4);
            items.push({ u, bar: n, set });
            u += n + 1;
          }
        }
        const dir = c % 2 ? 1 : -1;
        const off = s.wrap(t * speed * (1 + (c % 2))) * H * dir;
        for (let rep = -2; rep <= Math.ceil(s.h / H); rep++) {
          const base = rep * H + off;
          items.forEach((it) => {
            const y = base + it.u * unit;
            if (it.dot) {
              ctx.fillStyle = it.color;
              s.circle(x, y + unit / 2, unit * 0.27);
              ctx.fill();
            } else {
              const w = unit * 0.72;
              for (let k = 0; k < it.bar; k++) {
                ctx.fillStyle = it.set[k % it.set.length];
                ctx.fillRect(x - w / 2, y + k * unit, w, unit);
              }
            }
          });
        }
      }
    }

    // 3 — stripes: faint pale rules drifting one pitch per loop, with small
    //     dots between them that breathe on their own phase.
    function stripes(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.cream;
      ctx.fillRect(0, 0, s.w, s.h);
      const n = o.count || 9;
      const pitch = s.w / n;
      const off = s.wrap(t) * pitch * (o.dir || 1);
      ctx.save();
      for (let i = -1; i <= n; i++) {
        const x = i * pitch + off;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = o.rule || P.white;
        ctx.fillRect(x - pitch * 0.09, 0, pitch * 0.18, s.h);
      }
      const rows = Math.round(s.h / pitch);
      ctx.fillStyle = o.ink || ink;
      for (let i = -1; i <= n; i++) {
        for (let j = 0; j <= rows; j++) {
          const ph = s.hash((i + 2) * 131 + j, 3);
          ctx.globalAlpha = 0.05 + 0.1 * s.wave(t - ph);
          s.circle(i * pitch + off + pitch / 2, (j + 0.5) * pitch, s.w * 0.004);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 4 — checker: coarse cells in two tints. A wave crosses the board on
    //     the diagonal and flips it, one full flip and back per loop.
    function checker(ctx, s, t, o) {
      o = o || {};
      const n = o.cells || 8;
      const cell = s.w / n;
      const rows = Math.ceil(s.h / cell);
      ctx.fillStyle = o.a || P.cream;
      ctx.fillRect(0, 0, s.w, s.h);
      ctx.fillStyle = o.b || P.periwinkle;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < n; i++) {
          const d = (i + j) / (n + rows);
          const k = s.wave(t - d * 0.6); // 0 → 1 → 0, delayed along the diagonal
          const size = cell * ((i + j) % 2 ? k : 1 - k);
          const cx = (i + 0.5) * cell;
          const cy = (j + 0.5) * cell;
          ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
        }
      }
    }

    // 5 — crosses: a grid of small registration marks drifting one cell per
    //     loop on the diagonal, each blinking on its own phase.
    function crosses(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.cream;
      ctx.fillRect(0, 0, s.w, s.h);
      const n = o.cols || 12;
      const cell = s.w / n;
      const rows = Math.ceil(s.h / cell);
      const off = s.wrap(t) * cell;
      const arm = cell * (o.size || 0.16);
      ctx.save();
      ctx.strokeStyle = o.ink || ink;
      ctx.lineWidth = Math.max(1.5, s.w * 0.002);
      for (let j = -1; j <= rows; j++) {
        for (let i = -1; i <= n; i++) {
          const x = i * cell + off;
          const y = j * cell + off;
          ctx.globalAlpha = 0.15 + 0.85 * s.wave(t - s.hash(i * 97 + j, 8));
          ctx.beginPath();
          ctx.moveTo(x - arm, y);
          ctx.lineTo(x + arm, y);
          ctx.moveTo(x, y - arm);
          ctx.lineTo(x, y + arm);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 6 — rings: concentric hairlines growing out from the centre, one ring
    //     pitch per loop, fading as they reach the edge, with a bead on each.
    function rings(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.cream;
      ctx.fillRect(0, 0, s.w, s.h);
      const n = o.count || 14;
      const cx = s.w / 2;
      const cy = s.h / 2;
      const R = Math.hypot(s.w, s.h) / 2;
      const pitch = R / n;
      ctx.save();
      ctx.strokeStyle = o.ink || ink;
      ctx.fillStyle = o.bead || o.ink || ink;
      ctx.lineWidth = Math.max(1.5, s.w * 0.0015);
      for (let i = 0; i <= n; i++) {
        const r = (i + s.wrap(t)) * pitch;
        const fade = 1 - r / R;
        ctx.globalAlpha = 0.15 + 0.6 * fade;
        s.circle(cx, cy, r);
        ctx.stroke();
        const a = s.TAU * (t * (i % 2 ? 1 : -1) + s.hash(i, 4));
        s.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, s.w * 0.006);
        ctx.fill();
      }
      ctx.restore();
    }

    // 7 — dashes: short slanted strokes falling, each a whole number of
    //     heights per loop, so the rain is seamless.
    function dashes(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.cream;
      ctx.fillRect(0, 0, s.w, s.h);
      const inks = o.inks || SETS.cool;
      const n = o.count || 90;
      const rnd = s.rand(o.seed || 17);
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineWidth = s.w * 0.007;
      const tilt = o.tilt == null ? -0.35 : o.tilt;
      for (let i = 0; i < n; i++) {
        const x = rnd() * s.w;
        const y0 = rnd();
        const len = s.w * (0.02 + 0.06 * rnd());
        const speed = 1 + Math.floor(rnd() * 2);
        ctx.strokeStyle = inks[Math.floor(rnd() * inks.length)];
        const y = s.wrap(y0 + t * speed) * (s.h + len * 2) - len;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.sin(tilt) * len, y + Math.cos(tilt) * len);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 8 — rays: wedges fanning up from below the bottom edge, the fan
    //     rocking once per loop, each wedge breathing on its own phase.
    function rays(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.periwinkle;
      ctx.fillRect(0, 0, s.w, s.h);
      const n = o.count || 5;
      const ox = s.w / 2;
      const oy = s.h * 1.12;
      const R = Math.hypot(s.w, s.h) * 1.3;
      const spread = Math.PI * 0.8;
      const sway = (o.sway == null ? 1 : o.sway) * 0.05 * Math.sin(s.TAU * t);
      ctx.fillStyle = o.color || P.amber;
      for (let i = 0; i < n; i++) {
        const c = -Math.PI / 2 - spread / 2 + (spread * (i + 0.5)) / n + sway;
        const half = (spread / n) * 0.26 * (0.85 + 0.3 * s.wave(t - i / n));
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(c - half) * R, oy + Math.sin(c - half) * R);
        ctx.lineTo(ox + Math.cos(c + half) * R, oy + Math.sin(c + half) * R);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 9 — burst: a pinwheel of wedges from the centre, turning a whole
    //     number of times per loop.
    function burst(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.cream;
      ctx.fillRect(0, 0, s.w, s.h);
      const inks = o.inks || SETS.festival;
      const n = o.count || 30;
      const cx = o.cx == null ? s.w / 2 : o.cx;
      const cy = o.cy == null ? s.h / 2 : o.cy;
      const R = Math.hypot(s.w, s.h);
      const rnd = s.rand(o.seed || 21);
      const widths = [];
      let total = 0;
      for (let i = 0; i < n; i++) {
        const w = 0.4 + rnd();
        widths.push(w);
        total += w;
      }
      let a = s.TAU * t * Math.round(o.spin == null ? 1 : o.spin);
      let last = -1;
      for (let i = 0; i < n; i++) {
        const da = (s.TAU * widths[i]) / total;
        let k = Math.floor(rnd() * inks.length);
        if (k === last) k = (k + 1) % inks.length;
        last = k;
        ctx.fillStyle = inks[k];
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.lineTo(cx + Math.cos(a + da) * R, cy + Math.sin(a + da) * R);
        ctx.closePath();
        ctx.fill();
        a += da;
      }
    }

    // 10 — ribbons: a diagonal band of stripes, each one a wave travelling
    //      along it once per loop.
    function ribbons(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.amber;
      ctx.fillRect(0, 0, s.w, s.h);
      const inks = o.inks || [P.indigo, P.red, P.green, P.black, P.cream, P.periwinkle];
      const n = o.count || 18;
      const angle = o.angle == null ? -1.15 : o.angle;
      const width = s.w * (o.width || 0.026);
      const L = Math.hypot(s.w, s.h) * 1.5;
      const amp = s.w * 0.05 * (o.wave == null ? 1 : o.wave);
      ctx.save();
      ctx.translate(s.w / 2, s.h / 2);
      ctx.rotate(angle);
      ctx.lineWidth = width;
      ctx.lineCap = "butt";
      const pitch = width * 1.2;
      const bandW = n * pitch;
      for (let i = 0; i < n; i++) {
        const y0 = -bandW / 2 + i * pitch + pitch / 2;
        ctx.strokeStyle = inks[i % inks.length];
        ctx.beginPath();
        for (let k = 0; k <= 48; k++) {
          const u = k / 48;
          const x = -L / 2 + L * u;
          const y = y0 + amp * Math.sin(s.TAU * (u * 2 - t + i * 0.03));
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // 11 — polygons: rings of a regular polygon growing out from the centre
    //      one after another, on a ground with dark blocks in the corners.
    function polygons(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.amber;
      ctx.fillRect(0, 0, s.w, s.h);
      if (o.blocks !== false) {
        ctx.fillStyle = o.block || P.maroon;
        const b = s.w * 0.32;
        const corner = (x, y, rot, w, h, ox, oy) => {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rot);
          ctx.fillRect(ox, oy, w, h);
          ctx.restore();
        };
        corner(0, 0, -0.18, b * 1.5, b * 0.9, -b * 0.7, -b * 0.45);
        corner(s.w, s.h, -0.18, b * 1.5, b * 0.9, -b * 0.8, -b * 0.45);
        corner(s.w, 0, 0.22, b * 1.1, b * 0.9, -b * 0.55, -b * 0.6);
        corner(0, s.h, 0.22, b * 1.1, b * 0.9, -b * 0.55, -b * 0.3);
      }
      const inks = o.inks || [P.green, P.red, P.cream, P.maroon];
      const sides = Math.max(3, Math.round(o.sides || 8));
      const n = o.count || 4;
      const cx = s.w / 2;
      const cy = s.h / 2;
      const Rmax = Math.hypot(s.w, s.h) * 0.6;
      const items = [];
      for (let i = 0; i < n; i++) items.push({ p: s.wrap(t + i / n), i });
      items.sort((a, b) => b.p - a.p);
      ctx.save();
      items.forEach(({ p, i }) => {
        const r = s.ease.quadIn(p) * Rmax;
        if (r < 1) return;
        const rot = -Math.PI / sides + 0.15 * Math.sin(s.TAU * t);
        ctx.beginPath();
        for (let k = 0; k < sides; k++) {
          const a = rot + (s.TAU * k) / sides;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          if (k) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.globalAlpha = 1 - s.span(p, 0.8, 1);
        ctx.strokeStyle = inks[i % inks.length];
        ctx.lineWidth = r * 0.22;
        ctx.lineJoin = "miter";
        ctx.stroke();
      });
      ctx.restore();
    }

    // 12 — strings: thin spokes from a centre with a leaf at the end of
    //      each, the whole turning once per loop while the spokes breathe.
    function strings(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.cream;
      ctx.fillRect(0, 0, s.w, s.h);
      const inks = o.inks || [P.indigo, P.red, P.green, P.periwinkle, P.amber, P.black, P.pink];
      const n = o.count || 40;
      const cx = o.cx == null ? s.w / 2 : o.cx;
      const cy = o.cy == null ? s.h / 2 : o.cy;
      const R = Math.min(s.w, s.h) * (o.radius || 0.48);
      const rnd = s.rand(o.seed || 29);
      ctx.save();
      ctx.lineWidth = Math.max(1.5, s.w * 0.0025);
      ctx.strokeStyle = o.line || P.black;
      const spin = s.TAU * t * Math.round(o.spin == null ? 1 : o.spin);
      for (let i = 0; i < n; i++) {
        const a = spin + (s.TAU * i) / n + (rnd() - 0.5) * 0.12;
        const ph = rnd();
        const len = R * (0.35 + 0.65 * rnd()) * (0.85 + 0.15 * s.wave(t - ph));
        const color = inks[Math.floor(rnd() * inks.length)];
        const leaf = s.w * (0.012 + 0.022 * rnd());
        const ex = cx + Math.cos(a) * len;
        const ey = cy + Math.sin(a) * len;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(a);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, leaf * 2.2, leaf, 0, 0, s.TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // 13 — bricks: rows of bands in a running bond, every other row sliding
    //      the other way. A row's colours repeat every two or three bricks
    //      and it slides that many per loop, so the bond is seamless.
    function bricks(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.cream;
      ctx.fillRect(0, 0, s.w, s.h);
      const inks = o.inks || [P.periwinkle, P.indigo, P.white, P.green, P.black];
      const rowH = s.h / (o.rows || 30);
      const brickW = s.w / (o.cols || 6);
      const rows = Math.ceil(s.h / rowH);
      const rnd = s.rand(o.seed || 33);
      for (let j = 0; j < rows; j++) {
        const per = 2 + (j % 2);
        const dir = j % 2 ? 1 : -1;
        const off = ((j % 2) * brickW) / 2 + s.wrap(t) * brickW * per * dir;
        const rowInks = [];
        for (let k = 0; k < per; k++) {
          let c = inks[Math.floor(rnd() * inks.length)];
          if (k && c === rowInks[k - 1]) c = inks[(inks.indexOf(c) + 1) % inks.length];
          rowInks.push(c);
        }
        for (let i = -4; i <= Math.ceil(s.w / brickW) + 3; i++) {
          ctx.fillStyle = rowInks[((i % per) + per) % per];
          ctx.fillRect(i * brickW + off, j * rowH, brickW - s.w * 0.004, rowH * 0.78);
        }
      }
    }

    // 14 — network: discs joined to a centre by thin lines, each disc
    //      drifting round its home once per loop.
    function network(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.white;
      ctx.fillRect(0, 0, s.w, s.h);
      const inks = o.inks || SETS.garden;
      const n = o.count || 26;
      const cx = o.cx == null ? s.w / 2 : o.cx;
      const cy = o.cy == null ? s.h / 2 : o.cy;
      const R = Math.min(s.w, s.h) * (o.radius || 0.3);
      const rnd = s.rand(o.seed || 37);
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = rnd() * s.TAU;
        const d = Math.sqrt(rnd()) * R;
        const ph = rnd();
        const orbit = s.w * 0.012 * (0.5 + rnd());
        const ang = s.TAU * (t * (i % 2 ? 1 : -1) + ph);
        pts.push({
          x: cx + Math.cos(a) * d + Math.cos(ang) * orbit,
          y: cy + Math.sin(a) * d + Math.sin(ang) * orbit,
          r: s.w * (0.02 + 0.022 * rnd()),
          color: inks[Math.floor(rnd() * inks.length)],
        });
      }
      ctx.save();
      ctx.strokeStyle = o.line || P.black;
      ctx.lineWidth = Math.max(1.5, s.w * 0.002);
      pts.forEach((p) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      });
      pts.forEach((p) => {
        ctx.fillStyle = p.color;
        s.circle(p.x, p.y, p.r);
        ctx.fill();
        ctx.stroke();
      });
      ctx.restore();
    }

    // 15 — blobs: thin outlines of soft shapes drifting over the ground,
    //      each one wobbling a whole cycle per loop.
    function blobs(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.indigo;
      ctx.fillRect(0, 0, s.w, s.h);
      const n = o.count || 7;
      const rnd = s.rand(o.seed || 41);
      ctx.save();
      ctx.strokeStyle = o.line || P.red;
      ctx.lineWidth = Math.max(1.5, s.w * 0.0025);
      for (let i = 0; i < n; i++) {
        const bx = rnd() * s.w;
        const by = rnd() * s.h;
        const br = s.w * (0.12 + 0.2 * rnd());
        const h1 = 2 + Math.floor(rnd() * 2);
        const h2 = 3 + Math.floor(rnd() * 3);
        const a1 = rnd() * s.TAU;
        const a2 = rnd() * s.TAU;
        const ph = rnd();
        const drift = s.TAU * (t * (i % 2 ? 1 : -1) + ph);
        const x = bx + Math.cos(drift) * s.w * 0.02;
        const y = by + Math.sin(drift) * s.w * 0.02;
        ctx.beginPath();
        for (let k = 0; k <= 72; k++) {
          const a = (s.TAU * k) / 72;
          const r = br * (1 + 0.18 * Math.sin(h1 * a + a1 + s.TAU * t) + 0.1 * Math.sin(h2 * a + a2 - s.TAU * t));
          const px = x + Math.cos(a) * r;
          const py = y + Math.sin(a) * r;
          if (k) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  /* --------------------------------------------------------- starters -- */

  const SLIDES = {
    confetti: {
      label: "Confetti — pills of Lora on a jostling field",
      name: "Confetti",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.green);
        const discs = s.pick("Discs", "club", SET_NAMES);
        const swing = s.range("Jostle", 1, 0, 2, 0.1);
        const color = s.color("Type", P.indigo);
        const fill = s.color("Pill", P.white);
        const copy = s.text("Lines", "Stop\ncomparing\nyour chapter\none\nto someone\nelse's *chapter*\ntwenty.");
        const entrance = s.pick("Entrance", "pop", s.ENTRANCES);
        const shake = s.range("Shake", 0.2, 0, 1);

        confetti(ctx, s, t, { ground, inks: SETS[discs], swing });

        const lines = copy.split("\n").filter(Boolean);
        const size = Math.round(s.w * 0.075);
        const step = size * 1.3; // pills touch, like the reference
        const y0 = s.h / 2 - ((lines.length - 1) * step) / 2;
        const leave = s.span(t, 0.9, 1, s.ease.in);

        lines.forEach((line, i) => {
          const p = s.stagger(t, i, lines.length, { from: 0.03, to: 0.5, overlap: 0.65, ease: s.ease.backOut });
          const fx = s.enter(entrance, p, size);
          fx.alpha *= 1 - leave;
          fx.scale *= 1 - leave;
          const sh = s.shake(t, i, 5);
          pill(ctx, s, line, s.w / 2 + sh.x * shake * size * 0.2, y0 + i * step + sh.y * shake * size * 0.2, {
            size,
            color,
            fill,
            stroke: P.periwinkle,
            fx,
          });
        });
      },
    },

    tape: {
      label: "Tape — a warped Archivo headline over punched tape",
      name: "Tape",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.cream);
        const inkC = s.color("Ink", P.black);
        const kick = s.text("Kicker", "A  place  to");
        const head = s.text("Headline", "Question\nourselves");
        const warpAmt = s.range("Warp", 1, 0, 2, 0.1);
        const speed = s.pick("Tape speed", "1", ["1", "2"]);
        const columns = s.range("Columns", 11, 5, 17, 1);
        const showFooter = s.toggle("Footer", true);
        const gritOn = s.toggle("Grit", true);
        const go = gritOptions(s, t, { rough: 0.25, grain: 0.5, chunk: 4, bleed: 0, chroma: 0, boil: 6 });

        tape(ctx, s, t, { ground, columns, speed: Number(speed) });
        const cx = s.w / 2;

        // the kicker: Lora, spaced, in a box that opens
        const kSize = Math.round(s.w * 0.075);
        const kf = { size: kSize, family: serif, weight: 400 };
        const kw = s.measure(kick, kf) + kSize * 0.3;
        const ky = s.h * 0.23;
        const open = s.span(t, 0.02, 0.35, s.ease.expoOut);
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - kw / 2, 0, kw * open, s.h);
        ctx.clip();
        box(ctx, cx - kw / 2, ky - kSize * 0.72, kw, kSize * 0.95, ground, inkC);
        ctx.fillStyle = inkC;
        ctx.textBaseline = "alphabetic";
        s.rich(kick, cx, ky, { ...kf, align: "center" });
        ctx.restore();

        // the headline: Archivo black on a layer, then warped in slices
        const hLines = head.split("\n").filter(Boolean);
        const hSize = Math.round(s.w * 0.15);
        const hy = s.h * 0.52;
        const L = s.layer("head");
        L.ctx.fillStyle = inkC;
        L.ctx.textAlign = "center";
        L.ctx.font = s.font({ size: hSize, weight: 900, family: sans });
        hLines.forEach((line, i) => L.ctx.fillText(line, cx, hy + i * hSize * 0.92));
        const bw = s.w * 0.9;
        box(ctx, cx - bw / 2, hy - hSize * 0.9, bw, hSize * (0.92 * (hLines.length - 1) + 1.13), ground, inkC);
        const amp = s.w * 0.018 * warpAmt * s.span(t, 0.1, 0.5, s.ease.inOut);
        let src = L.canvas;
        if (gritOn) {
          const G = s.layer("gritted");
          s.on(G.ctx).grit(L.canvas, go);
          src = G.canvas;
        }
        s.warp(src, {
          slice: 9,
          dx: (v) => amp * Math.sin(s.TAU * (v * 2.5 - t)),
          sx: (v) => 1 + 0.05 * warpAmt * Math.sin(s.TAU * (v * 4 + t)),
        });

        if (showFooter) footer(ctx, s, { fill: ground, color: inkC });
      },
    },

    stripes: {
      label: "Stripes — a justified Archivo headline over faint stripes",
      name: "Stripes",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.cream);
        const rule = s.color("Stripe", P.white);
        const inkC = s.color("Ink", P.black);
        const number = s.text("Number", "1");
        const copy = s.text("Headline", "Check the time available you have in your week");
        const jitterAmt = s.range("Jitter", 0.15, 0, 1);
        const showFooter = s.toggle("Footer", true);

        stripes(ctx, s, t, { ground, rule, ink: inkC });
        const cx = s.w / 2;

        tag(ctx, s, number, cx, s.h * 0.2, inkC);

        // the headline, its words spreading to fill the box
        ctx.fillStyle = inkC;
        ctx.textBaseline = "alphabetic";
        const size = Math.round(s.w * 0.1);
        ctx.font = s.font({ size, weight: 400, family: sans });
        const bw = s.w * 0.68;
        const lines = s.lines(copy, bw);
        const lh = size * 0.84; // tight, like the reference
        const spread = s.span(t, 0.05, 0.5, s.ease.expoOut) * (1 - s.span(t, 0.88, 1, s.ease.inOut));
        const y0 = s.h * 0.5 - ((lines.length - 1) * lh) / 2 + size * 0.3;
        const j = s.jitter(t, 0, 24);
        const jx = j.x * jitterAmt * size * 0.06;
        const jy = j.y * jitterAmt * size * 0.06;
        box(ctx, cx - bw / 2, y0 - size * 0.74, bw, (lines.length - 1) * lh + size, null, inkC);
        lines.forEach((line, i) => s.justify(line, cx - bw / 2 + jx, y0 + i * lh + jy, bw, spread));

        if (showFooter) footer(ctx, s, { color: inkC });
      },
    },

    checker: {
      label: "Checker — outlined Archivo, letters shaking in",
      name: "Checker",
      fn: function (ctx, t, s) {
        const a = s.color("Cell A", P.cream);
        const b = s.color("Cell B", P.periwinkle);
        const cells = s.range("Cells", 8, 4, 16, 1);
        const inkC = s.color("Ink", P.black);
        const head = s.text("Headline", "Make it\nmove");
        const shake = s.range("Shake", 0.5, 0, 1);
        const entrance = s.pick("Entrance", "drop", s.ENTRANCES);
        const showFooter = s.toggle("Footer", true);

        checker(ctx, s, t, { a, b, cells });

        const lines = head.split("\n").filter(Boolean);
        const size = Math.round(s.w * 0.2);
        const lh = size * 0.92;
        const y0 = s.h / 2 - ((lines.length - 1) * lh) / 2 + size * 0.35;
        ctx.font = s.font({ size, weight: 900, family: sans });
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
        ctx.lineJoin = "round";
        const leave = s.span(t, 0.9, 1, s.ease.in);

        let n = 0;
        lines.forEach((line, li) => {
          const letters = line.split("");
          const lw = ctx.measureText(line).width;
          let x = s.w / 2 - lw / 2;
          letters.forEach((ch) => {
            const w = ctx.measureText(ch).width;
            const p = s.stagger(t, n, 12, { from: 0.02, to: 0.5, overlap: 0.75, ease: s.ease.backOut });
            const fx = s.enter(entrance, p, size * 0.6);
            fx.alpha *= 1 - leave;
            const filled = s.span(t, 0.55 + n * 0.015, 0.56 + n * 0.015); // outline first, then each letter fills, one after another
            const j = s.jitter(t, n, 10);
            const amt = shake * size * 0.04 * (1 - filled);
            s.place(x + w / 2 + j.x * amt, y0 + li * lh + j.y * amt, fx, () => {
              ctx.strokeStyle = inkC;
              ctx.fillStyle = inkC;
              ctx.lineWidth = Math.max(2, size * 0.02);
              if (filled >= 1) ctx.fillText(ch, -w / 2, 0);
              else ctx.strokeText(ch, -w / 2, 0);
            });
            x += w;
            n++;
          });
        });

        if (showFooter) footer(ctx, s, { color: inkC, fill: a });
      },
    },

    crosses: {
      label: "Crosses — Lora italic lines sliding in over a plus grid",
      name: "Crosses",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.cream);
        const inkC = s.color("Ink", P.black);
        const accent = s.color("Accent", P.red);
        const cols = s.range("Grid", 12, 6, 24, 1);
        const copy = s.text("Lines", "Nothing moves\n*until* it has\na reason to.");
        const entrance = s.pick("Entrance", "slide", s.ENTRANCES);
        const showFooter = s.toggle("Footer", true);

        crosses(ctx, s, t, { ground, ink: inkC, cols });

        const lines = copy.split("\n").filter(Boolean);
        const size = Math.round(s.w * 0.105);
        const lh = size * 1.12;
        const y0 = s.h / 2 - ((lines.length - 1) * lh) / 2 + size * 0.35;
        const leave = s.span(t, 0.9, 1, s.ease.in);
        ctx.textBaseline = "alphabetic";

        lines.forEach((line, i) => {
          const p = s.stagger(t, i, lines.length, { from: 0.03, to: 0.5, overlap: 0.6, ease: s.ease.expoOut });
          const fx = s.enter(entrance, p, size);
          if (entrance === "slide" && i % 2) fx.dx = -fx.dx; // alternate sides
          fx.alpha *= 1 - leave;
          const f = { size, family: serif, weight: 400 };
          const w = s.measure(line, f);
          s.place(s.w / 2, y0 + i * lh, fx, () => {
            box(ctx, -w / 2 - size * 0.12, -size * 0.78, w + size * 0.24, size * 1.02, ground, inkC);
            ctx.fillStyle = i === lines.length - 1 ? accent : inkC;
            s.rich(line, 0, 0, { ...f, align: "center" });
          });
        });

        if (showFooter) footer(ctx, s, { color: inkC, fill: ground });
      },
    },

    rings: {
      label: "Rings — a big number pulsing with the rings",
      name: "Rings",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.cream);
        const inkC = s.color("Ink", P.black);
        const bead = s.color("Beads", P.indigo);
        const count = s.range("Rings", 14, 6, 30, 1);
        const number = s.text("Number", "744");
        const caption = s.text("Caption", "entries in the *Directory*");
        const pulse = s.range("Pulse", 0.5, 0, 1);
        const showFooter = s.toggle("Footer", true);

        rings(ctx, s, t, { ground, ink: inkC, bead, count });
        const cx = s.w / 2;
        const cy = s.h / 2;

        // the number, on its own cream disc, breathing once per loop
        const size = Math.round(s.w * 0.3);
        const k = 1 + 0.06 * pulse * s.wave(t);
        const inP = s.span(t, 0.02, 0.4, s.ease.backOut);
        s.place(cx, cy, { dx: 0, dy: 0, scale: inP * k, rot: 0, alpha: 1 }, () => {
          ctx.fillStyle = ground;
          s.circle(0, 0, size * 0.78);
          ctx.fill();
          ctx.strokeStyle = inkC;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = inkC;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = s.font({ size, weight: 900, family: sans });
          ctx.fillText(number, 0, size * 0.04);
        });

        ctx.globalAlpha = s.span(t, 0.4, 0.6) * (1 - s.span(t, 0.9, 1));
        ctx.fillStyle = inkC;
        ctx.textBaseline = "alphabetic";
        s.rich(caption, cx, cy + size * 1.05, { size: Math.round(s.w * 0.04), family: serif, weight: 400, align: "center" });
        ctx.globalAlpha = 1;

        if (showFooter) footer(ctx, s, { color: inkC, fill: ground });
      },
    },

    dashes: {
      label: "Dashes — a list of Lora rows over falling dashes",
      name: "Dashes",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.cream);
        const inkC = s.color("Ink", P.black);
        const accent = s.color("Bullet", P.red);
        const marks = s.pick("Dashes", "cool", SET_NAMES);
        const title = s.text("Title", "Before you export");
        const copy = s.text("Items", "Loop on a whole cycle\nEase out, never in\nStagger by a few frames\nHold long enough to read");
        const entrance = s.pick("Entrance", "rise", s.ENTRANCES);
        const shake = s.range("Shake", 0.3, 0, 1);
        const showFooter = s.toggle("Footer", true);

        dashes(ctx, s, t, { ground, inks: SETS[marks] });
        const m = s.w * 0.1;
        const items = copy.split("\n").filter(Boolean);
        const leave = s.span(t, 0.9, 1, s.ease.in);
        ctx.textBaseline = "alphabetic";

        // the title, Archivo, boxed
        const tSize = Math.round(s.w * 0.07);
        const tf = { size: tSize, family: sans, weight: 700 };
        const tw = s.measure(title, tf);
        const ty = s.h * 0.26;
        const tp = s.span(t, 0.02, 0.35, s.ease.expoOut);
        s.place(m, ty, { dx: 0, dy: 0, scale: 1, rot: 0, alpha: tp * (1 - leave) }, () => {
          box(ctx, -tSize * 0.15, -tSize * 0.76, tw + tSize * 0.3, tSize, ground, inkC);
          ctx.fillStyle = inkC;
          s.rich(title, 0, 0, tf);
        });

        // the rows: a bullet and a line of Lora, each on its own cream strip
        const size = Math.round(s.w * 0.048);
        const rowH = size * 1.9;
        const y0 = ty + tSize * 1.4;
        items.forEach((item, i) => {
          const p = s.stagger(t, i, items.length, { from: 0.15, to: 0.6, overlap: 0.65, ease: s.ease.expoOut });
          const fx = s.enter(entrance, p, size * 1.2);
          fx.alpha *= 1 - leave;
          const sh = s.shake(t, i + 3, 4);
          const f = { size, family: serif, weight: 400 };
          const w = s.measure(item, f);
          s.place(m + sh.x * shake * size * 0.15, y0 + i * rowH + sh.y * shake * size * 0.15, fx, () => {
            ctx.fillStyle = ground;
            ctx.fillRect(-size * 0.2, -size * 0.85, w + size * 1.6, size * 1.25);
            ctx.fillStyle = accent;
            s.circle(size * 0.3, -size * 0.3, size * 0.22);
            ctx.fill();
            ctx.fillStyle = inkC;
            s.rich(item, size * 0.95, 0, f);
          });
        });

        if (showFooter) footer(ctx, s, { color: inkC, fill: ground });
      },
    },


    rays: {
      label: "Rays — Lora over a fan of wedges",
      name: "Rays",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.periwinkle);
        const color = s.color("Rays", P.amber);
        const inkC = s.color("Ink", P.black);
        const count = s.range("Wedges", 5, 2, 12, 1);
        const sway = s.range("Sway", 1, 0, 2, 0.1);
        const kicker = s.text("Kicker", "Starting in motion series.");
        const head = s.text("Headline", "3 exercises\n*to finish*\n__this week.__");
        const entrance = s.pick("Entrance", "rise", s.ENTRANCES);
        const showFooter = s.toggle("Footer", true);

        rays(ctx, s, t, { ground, color, count, sway });
        const cx = s.w / 2;
        ctx.fillStyle = inkC;
        ctx.textBaseline = "alphabetic";

        ctx.globalAlpha = s.span(t, 0.02, 0.25);
        s.rich(kicker, cx, s.h * 0.1, { size: Math.round(s.w * 0.036), family: serif, weight: 400, align: "center" });
        ctx.globalAlpha = 1;

        const lines = head.split("\n").filter(Boolean);
        const size = Math.round(s.w * 0.115);
        const lh = size * 1.05;
        const y0 = s.h / 2 - ((lines.length - 1) * lh) / 2 + size * 0.35;
        const leave = s.span(t, 0.9, 1, s.ease.in);
        lines.forEach((line, i) => {
          const p = s.stagger(t, i, lines.length, { from: 0.05, to: 0.5, overlap: 0.6, ease: s.ease.expoOut });
          const fx = s.enter(entrance, p, size * 0.6);
          fx.alpha *= 1 - leave;
          s.place(cx, y0 + i * lh, fx, () => {
            ctx.fillStyle = inkC;
            s.rich(line, 0, 0, { size, family: serif, weight: 700, align: "center" });
          });
        });

        if (showFooter) footer(ctx, s, { color: inkC, box: false });
      },
    },

    burst: {
      label: "Burst — a pinwheel turning behind Lora",
      name: "Burst",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.cream);
        const wedges = s.pick("Wedges", "festival", SET_NAMES);
        const count = s.range("Count", 30, 8, 60, 1);
        const spin = s.range("Turns per loop", 1, 0, 3, 1);
        const inkC = s.color("Ink", P.black);
        const knock = s.color("Knockout", P.cream);
        const head = s.text("Headline", "Build\nyour path.");
        const showFooter = s.toggle("Footer", false);

        burst(ctx, s, t, { ground, inks: SETS[wedges], count, spin });
        const cx = s.w / 2;

        const lines = head.split("\n").filter(Boolean);
        const size = Math.round(s.w * 0.17);
        const lh = size * 1.0;
        const y0 = s.h / 2 - ((lines.length - 1) * lh) / 2 + size * 0.35;
        const leave = s.span(t, 0.9, 1, s.ease.in);
        ctx.textBaseline = "alphabetic";
        ctx.lineJoin = "round";
        lines.forEach((line, i) => {
          const p = s.stagger(t, i, lines.length, { from: 0.05, to: 0.45, overlap: 0.5, ease: s.ease.backOut });
          const fx = s.enter("pop", p, size);
          fx.alpha *= 1 - leave;
          const f = { size, family: serif, weight: 700, align: "center" };
          s.place(cx, y0 + i * lh, fx, () => {
            // a knockout stroke behind the type keeps it legible on any wedge
            ctx.strokeStyle = knock;
            ctx.lineWidth = size * 0.12;
            ctx.font = s.font({ size, weight: 700, family: serif });
            ctx.textAlign = "center";
            ctx.strokeText(line.replace(/[*_]/g, ""), 0, 0);
            ctx.fillStyle = inkC;
            s.rich(line, 0, 0, f);
          });
        });

        if (showFooter) footer(ctx, s, { color: inkC, fill: knock });
      },
    },

    ribbons: {
      label: "Ribbons — Archivo with a print echo over flowing stripes",
      name: "Ribbons",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.amber);
        const bands = s.pick("Stripes", "festival", SET_NAMES);
        const count = s.range("Stripes count", 18, 6, 36, 1);
        const wave = s.range("Wave", 1, 0, 2, 0.1);
        const type = s.color("Type", P.white);
        const echoA = s.color("Echo", P.black);
        const echoB = s.color("Echo 2", P.red);
        const head = s.text("Headline", "Taller para\nempezar\nen *Motion*\nhoy");
        const kicker = s.text("Kicker", "Con *Superlocal.uy*");
        const shake = s.range("Shake", 0.4, 0, 1);
        const gritOn = s.toggle("Grit", true);
        const go = gritOptions(s, t, { rough: 0.2, grain: 0.4, chunk: 3, bleed: 0, chroma: 0.1, boil: 8 });

        ribbons(ctx, s, t, { ground, inks: SETS[bands], count, wave });
        const cx = s.w / 2;

        const L = s.layer("type");
        const g = s.on(L.ctx);
        const lines = head.split("\n").filter(Boolean);
        const size = Math.round(s.w * 0.16);
        const lh = size * 0.98;
        const y0 = s.h / 2 - ((lines.length - 1) * lh) / 2 + size * 0.3;
        const leave = s.span(t, 0.9, 1, s.ease.in);
        L.ctx.textBaseline = "alphabetic";
        lines.forEach((line, i) => {
          const p = s.stagger(t, i, lines.length, { from: 0.03, to: 0.45, overlap: 0.6, ease: s.ease.expoOut });
          const fx = s.enter("rise", p, size * 0.5);
          fx.alpha *= 1 - leave;
          const sh = s.shake(t, i, 4);
          g.place(cx + sh.x * shake * size * 0.06, y0 + i * lh + sh.y * shake * size * 0.06, fx, () => {
            echo(L.ctx, g, line, 0, 0, {
              size,
              family: sans,
              weight: 700,
              color: type,
              offsets: [
                { dx: -0.05, dy: 0.05, color: echoB },
                { dx: -0.025, dy: 0.025, color: echoA },
              ],
            });
          });
        });
        if (gritOn) s.grit(L.canvas, go);
        else ctx.drawImage(L.canvas, 0, 0);

        ctx.globalAlpha = s.span(t, 0.45, 0.65) * (1 - leave);
        ctx.fillStyle = type;
        s.rich(kicker, cx, s.h - s.w * 0.09, { size: Math.round(s.w * 0.04), family: serif, weight: 400, align: "center" });
        ctx.globalAlpha = 1;
      },
    },

    polygons: {
      label: "Polygons — a sticker of Lora inside growing rings",
      name: "Polygons",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.amber);
        const block = s.color("Blocks", P.maroon);
        const ringA = s.color("Ring A", P.green);
        const ringB = s.color("Ring B", P.red);
        const sides = s.range("Sides", 8, 3, 12, 1);
        const count = s.range("Rings", 4, 1, 8, 1);
        const paperC = s.color("Sticker", P.white);
        const inkC = s.color("Ink", P.black);
        const head = s.text("Headline", "You don't need\nmore options.\nYou need *fewer.*");
        const shake = s.range("Wobble", 0.5, 0, 1);
        const gritOn = s.toggle("Grit", true);
        const go = gritOptions(s, t, { rough: 0.2, grain: 0.5, chunk: 3, bleed: 0.15, chroma: 0, boil: 6 });

        polygons(ctx, s, t, { ground, block, inks: [ringA, ringB, paperC, block], sides, count });
        const cx = s.w / 2;
        const cy = s.h / 2;

        const lines = head.split("\n").filter(Boolean);
        const size = Math.round(s.w * 0.07);
        const lh = size * 1.15;
        const f = { size, family: serif, weight: 700, italic: true, align: "center" };
        let widest = 0;
        lines.forEach((line) => (widest = Math.max(widest, s.measure(line, f))));
        const bw = widest + size * 1.2;
        const bh = lines.length * lh + size * 0.6;
        const inP = s.span(t, 0.05, 0.4, s.ease.backOut);
        const leave = s.span(t, 0.9, 1, s.ease.in);
        const rot = 0.04 * shake * Math.sin(s.TAU * 2 * t);
        // the type is drawn on a layer at the post's centre, gritted, then
        // carried into the sticker's transform
        const L = s.layer("type");
        const g = s.on(L.ctx);
        L.ctx.fillStyle = inkC;
        L.ctx.textBaseline = "alphabetic";
        const y0 = cy - ((lines.length - 1) * lh) / 2 + size * 0.35;
        lines.forEach((line, i) => g.rich(line, cx, y0 + i * lh, f));
        s.place(cx, cy, { dx: 0, dy: 0, scale: inP * (1 - leave), rot, alpha: 1 }, () => {
          ctx.fillStyle = paperC;
          s.roundRect(-bw / 2, -bh / 2, bw, bh, size * 0.9);
          ctx.fill();
          ctx.translate(-cx, -cy);
          if (gritOn) s.grit(L.canvas, go);
          else ctx.drawImage(L.canvas, 0, 0);
        });
      },
    },

    strings: {
      label: "Strings — boxed Lora over a turning starburst of lines",
      name: "Strings",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.cream);
        const line = s.color("Lines", P.black);
        const leaves = s.pick("Leaves", "garden", SET_NAMES);
        const count = s.range("Spokes", 40, 8, 80, 1);
        const inkC = s.color("Ink", P.black);
        const head = s.text("Headline", "Don't just follow\nthe tutorial.\n*Modify it* and\nmake it yours.");
        const entrance = s.pick("Entrance", "pop", s.ENTRANCES);
        const showFooter = s.toggle("Footer", true);

        strings(ctx, s, t, { ground, line, inks: SETS[leaves], count });
        const cx = s.w / 2;

        const lines = head.split("\n").filter(Boolean);
        const size = Math.round(s.w * 0.08);
        const lh = size * 1.12;
        const y0 = s.h / 2 - ((lines.length - 1) * lh) / 2 + size * 0.35;
        const leave = s.span(t, 0.9, 1, s.ease.in);
        ctx.textBaseline = "alphabetic";
        lines.forEach((ln, i) => {
          const p = s.stagger(t, i, lines.length, { from: 0.04, to: 0.5, overlap: 0.6, ease: s.ease.backOut });
          const fx = s.enter(entrance, p, size);
          fx.alpha *= 1 - leave;
          const f = { size, family: serif, weight: 700, align: "center" };
          const w = s.measure(ln, f);
          s.place(cx, y0 + i * lh, fx, () => {
            box(ctx, -w / 2 - size * 0.15, -size * 0.8, w + size * 0.3, size * 1.05, ground, inkC);
            ctx.fillStyle = inkC;
            s.rich(ln, 0, 0, f);
          });
        });

        if (showFooter) footer(ctx, s, { color: inkC, fill: ground });
      },
    },

    bricks: {
      label: "Bricks — justified Archivo over a sliding bond",
      name: "Bricks",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.cream);
        const bond = s.pick("Bricks", "cool", SET_NAMES);
        const rows = s.range("Rows", 30, 10, 60, 1);
        const paperC = s.color("Box", P.white);
        const inkC = s.color("Ink", P.black);
        const copy = s.text("Headline", "You don't learn motion design by (only) watching. You learn by doing.");
        const jitterAmt = s.range("Jitter", 0.15, 0, 1);

        bricks(ctx, s, t, { ground, inks: SETS[bond], rows });
        const cx = s.w / 2;

        ctx.fillStyle = inkC;
        ctx.textBaseline = "alphabetic";
        const size = Math.round(s.w * 0.085);
        ctx.font = s.font({ size, weight: 400, family: sans });
        const bw = s.w * 0.56;
        const lines = s.lines(copy, bw);
        const lh = size * 0.86;
        const spread = s.span(t, 0.05, 0.5, s.ease.expoOut) * (1 - s.span(t, 0.88, 1, s.ease.inOut));
        const y0 = s.h / 2 - ((lines.length - 1) * lh) / 2 + size * 0.3;
        const inP = s.span(t, 0.02, 0.3, s.ease.expoOut);
        const bh = (lines.length - 1) * lh + size * 1.1;
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - bw / 2 - size * 0.3, s.h / 2 - (bh / 2) * inP, bw + size * 0.6, bh * inP);
        ctx.clip();
        box(ctx, cx - bw / 2 - size * 0.3, y0 - size * 0.8, bw + size * 0.6, bh, paperC, inkC);
        const j = s.jitter(t, 0, 24);
        ctx.fillStyle = inkC;
        lines.forEach((line, i) => s.justify(line, cx - bw / 2 + j.x * jitterAmt * size * 0.05, y0 + i * lh + j.y * jitterAmt * size * 0.05, bw, spread));
        ctx.restore();
      },
    },

    network: {
      label: "Network — Lora around a cluster of joined discs",
      name: "Network",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.white);
        const discs = s.pick("Discs", "garden", SET_NAMES);
        const count = s.range("Discs count", 26, 6, 60, 1);
        const line = s.color("Lines", P.black);
        const inkC = s.color("Ink", P.black);
        const top = s.text("Top", "Make");
        const bottom = s.text("Bottom", "Genuine\nConnections");
        const entrance = s.pick("Entrance", "fade", s.ENTRANCES);

        network(ctx, s, t, { ground, inks: SETS[discs], count, line, cy: s.h * 0.47 });
        const cx = s.w / 2;
        const size = Math.round(s.w * 0.11);
        const leave = s.span(t, 0.9, 1, s.ease.in);
        ctx.textBaseline = "alphabetic";
        const f = { size, family: serif, weight: 700, align: "center" };

        const draw = (text, y, i) => {
          const lines = text.split("\n").filter(Boolean);
          lines.forEach((ln, k) => {
            const p = s.stagger(t, i + k, 3, { from: 0.05, to: 0.5, overlap: 0.5, ease: s.ease.expoOut });
            const fx = s.enter(entrance, p, size * 0.5);
            fx.alpha *= 1 - leave;
            s.place(cx, y + k * size * 1.05, fx, () => {
              ctx.fillStyle = inkC;
              s.rich(ln, 0, 0, f);
            });
          });
        };
        draw(top, s.h * 0.17, 0);
        draw(bottom, s.h * 0.78, 1);
      },
    },

    blobs: {
      label: "Blobs — chunky Lora scrambling in over outlined shapes",
      name: "Blobs",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.indigo);
        const line = s.color("Outlines", P.red);
        const count = s.range("Shapes", 7, 2, 16, 1);
        const type = s.color("Type", P.red);
        const echoC = s.color("Echo", P.amber);
        const head = s.text("Headline", "You need\nmore\npractice");
        const scrambleOn = s.toggle("Scramble", true);
        const shake = s.range("Shake", 0.3, 0, 1);
        const gritOn = s.toggle("Grit", true);
        const go = gritOptions(s, t, { rough: 0.35, grain: 0.7, chunk: 3, bleed: 0.1, chroma: 0.15, boil: 8 });

        blobs(ctx, s, t, { ground, line, count });
        const cx = s.w / 2;

        // the type goes on a layer, so the shader can tear it
        const L = s.layer("type");
        const g = s.on(L.ctx);
        const lines = head.split("\n").filter(Boolean);
        const size = Math.round(s.w * 0.16);
        const lh = size * 0.95;
        const y0 = s.h / 2 - ((lines.length - 1) * lh) / 2 + size * 0.32;
        const leave = s.span(t, 0.9, 1, s.ease.in);
        L.ctx.textBaseline = "alphabetic";
        lines.forEach((ln, i) => {
          const p = s.stagger(t, i, lines.length, { from: 0.02, to: 0.55, overlap: 0.4 });
          const text = scrambleOn ? s.scramble(ln, p, t, i) : ln;
          const sh = s.jitter(t, i, 12);
          const amt = shake * size * 0.03 * (1 - s.span(p, 0.95, 1));
          L.ctx.globalAlpha = s.span(p, 0, 0.1) * (1 - leave);
          echo(L.ctx, g, text, cx + sh.x * amt, y0 + i * lh + sh.y * amt, {
            size,
            family: serif,
            weight: 700,
            italic: true,
            color: type,
            offsets: [{ dx: 0.05, dy: 0.05, color: echoC }],
          });
        });
        if (gritOn) s.grit(L.canvas, go);
        else ctx.drawImage(L.canvas, 0, 0);
      },
    },

    torn: {
      label: "Torn — gritty Lora, every knob of the shader",
      name: "Torn",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.cream);
        const inkC = s.color("Ink", P.black);
        const echoC = s.color("Echo", P.red);
        const head = s.text("Headline", "Rough\nis a\n*choice.*");
        const go = gritOptions(s, t, { rough: 0.5, grain: 0.9, chunk: 4, bleed: 0.2, chroma: 0.25, boil: 10 });
        const shake = s.range("Shake", 0.3, 0, 1);
        const entrance = s.pick("Entrance", "pop", s.ENTRANCES);
        const showFooter = s.toggle("Footer", true);

        ctx.fillStyle = ground;
        ctx.fillRect(0, 0, s.w, s.h);
        // a paper tooth on the ground, from the same shader: a faint wide
        // rectangle with heavy grain reads as fibre
        const tooth = s.range("Tooth", 0.3, 0, 1);
        if (tooth > 0) {
          const T = s.layer("tooth");
          T.ctx.fillStyle = inkC;
          T.ctx.globalAlpha = 0.04;
          T.ctx.fillRect(0, 0, s.w, s.h);
          ctx.globalAlpha = tooth * 0.5;
          s.grit(T.canvas, { rough: 0, grain: 1.5, chunk: 2, bleed: 0, chroma: 0, boil: go.boil, t, hard: false });
          ctx.globalAlpha = 1;
        }

        const cx = s.w / 2;
        const L = s.layer("type");
        const g = s.on(L.ctx);
        const lines = head.split("\n").filter(Boolean);
        const size = Math.round(s.w * 0.22);
        const lh = size * 0.92;
        const y0 = s.h / 2 - ((lines.length - 1) * lh) / 2 + size * 0.33;
        const leave = s.span(t, 0.9, 1, s.ease.in);
        L.ctx.textBaseline = "alphabetic";
        lines.forEach((ln, i) => {
          const p = s.stagger(t, i, lines.length, { from: 0.03, to: 0.5, overlap: 0.6, ease: s.ease.backOut });
          const fx = s.enter(entrance, p, size * 0.5);
          fx.alpha *= 1 - leave;
          const sh = s.jitter(t, i, go.boil || 8);
          g.place(cx + sh.x * shake * size * 0.03, y0 + i * lh + sh.y * shake * size * 0.03, fx, () => {
            echo(L.ctx, g, ln, 0, 0, {
              size,
              family: serif,
              weight: 700,
              color: inkC,
              offsets: [{ dx: -0.04, dy: 0.04, color: echoC }],
            });
          });
        });
        s.grit(L.canvas, go);

        if (showFooter) footer(ctx, s, { color: inkC, box: false });
      },
    },

    headline: {
      label: "Headline — Lora words rise in",
      name: "Headline",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.cream);
        const inkC = s.color("Ink", P.black);
        const copy = s.text("Headline", "Motion is a decision, not a garnish.");
        const showFooter = s.toggle("Footer", true);

        ctx.fillStyle = ground;
        ctx.fillRect(0, 0, s.w, s.h);

        const m = s.w * 0.09;
        const size = Math.round(s.w * 0.11);
        ctx.fillStyle = inkC;
        ctx.font = s.font({ size, weight: 700, family: serif });
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        const lines = s.lines(copy, s.w - 2 * m);
        const lh = size * 1.04;
        const y0 = s.h / 2 - (lines.length * lh) / 2 + size * 0.78;
        const total = copy.split(" ").length;
        const leave = s.span(t, 0.86, 1, s.ease.inOut); // fade out so the loop is clean

        let i = 0;
        lines.forEach((line, li) => {
          const y = y0 + li * lh;
          let x = m;
          line.split(" ").forEach((word) => {
            const p = s.stagger(t, i, total, { from: 0.04, to: 0.55, overlap: 0.72, ease: s.ease.expoOut });
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, y - size * 0.95, s.w, lh * 1.15); // mask: each word rises into its line
            ctx.clip();
            ctx.globalAlpha = 1 - leave;
            ctx.fillText(word, x, y + (1 - p) * size * 1.1);
            ctx.restore();
            x += ctx.measureText(word + " ").width;
            i++;
          });
        });

        if (showFooter) footer(ctx, s, { color: inkC, alpha: s.span(t, 0.5, 0.7) * (1 - leave) });
      },
    },

    counter: {
      label: "Counter — a number counts up",
      name: "Counter",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.black);
        const inkC = s.color("Ink", P.cream);
        const target = s.range("Count to", 744, 1, 9999, 1);
        const caption = s.text("Caption", "entries in the Directory");

        ctx.fillStyle = ground;
        ctx.fillRect(0, 0, s.w, s.h);

        const p = s.span(t, 0.05, 0.7, s.ease.expoOut);
        const n = Math.round(p * target);
        const cx = s.w / 2;
        const cy = s.h / 2;

        ctx.fillStyle = inkC;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = s.font({ size: Math.round(s.w * 0.28), weight: 900, family: sans });
        ctx.fillText(String(n), cx, cy - s.w * 0.02);

        ctx.globalAlpha = s.span(t, 0.4, 0.6);
        ctx.font = s.font({ size: Math.round(s.w * 0.038), weight: 400, family: serif, italic: true });
        ctx.fillText(caption, cx, cy + s.w * 0.17);

        // a ring closes with the count
        ctx.globalAlpha = 1;
        ctx.strokeStyle = inkC;
        ctx.lineWidth = s.w * 0.006;
        ctx.beginPath();
        ctx.arc(cx, cy, s.w * 0.37, -Math.PI / 2, -Math.PI / 2 + s.TAU * p);
        ctx.stroke();
      },
    },

    marquee: {
      label: "Marquee — bands of Archivo",
      name: "Marquee",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.cream);
        const inkC = s.color("Ink", P.black);
        const text = s.text("Text", "MOTION SOCIAL CLUB  ·  ");
        const speed = s.range("Speed", 1, 1, 3, 1);

        ctx.fillStyle = ground;
        ctx.fillRect(0, 0, s.w, s.h);

        const rows = Math.max(3, Math.round(s.h / (s.w * 0.19)));
        const size = Math.round((s.h / rows) * 0.66);
        ctx.fillStyle = inkC;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = s.font({ size, weight: 900, family: sans });
        const unit = ctx.measureText(text).width;
        const reps = Math.ceil(s.w / unit) + 2;

        for (let r = 0; r < rows; r++) {
          const y = ((r + 0.5) * s.h) / rows;
          const dir = r % 2 ? 1 : -1;
          // a whole number of units per loop keeps the band seamless
          const off = s.wrap(t * speed * (1 + (r % 3))) * unit * dir;
          for (let k = -2; k < reps; k++) ctx.fillText(text, k * unit + off, y);
        }
      },
    },

    grid: {
      label: "Grid — a ripple of dots",
      name: "Grid",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.black);
        const dot = s.color("Dots", P.cream);
        const cols = s.range("Columns", 12, 4, 30, 1);

        ctx.fillStyle = ground;
        ctx.fillRect(0, 0, s.w, s.h);

        const cell = s.w / cols;
        const rows = Math.ceil(s.h / cell);
        const far = Math.hypot(s.w / 2, s.h / 2);
        ctx.fillStyle = dot;

        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const cx = (x + 0.5) * cell;
            const cy = (y + 0.5) * cell;
            const d = Math.hypot(cx - s.w / 2, cy - s.h / 2) / far;
            const r = cell * 0.42 * s.wave(t - d * 0.5); // one cycle per loop, delayed by distance
            s.circle(cx, cy, r);
            ctx.fill();
          }
        }
      },
    },

    blank: {
      label: "Blank",
      name: "Blank",
      fn: function (ctx, t, s) {
        // t runs 0 → 1 over the loop, then wraps. Draw the whole frame every call.
        const ground = s.color("Ground", P.cream);
        const inkC = s.color("Ink", P.black);
        const word = s.text("Word", "hello");

        ctx.fillStyle = ground;
        ctx.fillRect(0, 0, s.w, s.h);

        ctx.fillStyle = inkC;
        ctx.font = s.font({ size: Math.round(s.w * 0.07), weight: 600, family: sans });
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(word, s.w / 2, s.h / 2 + Math.sin(t * s.TAU) * s.w * 0.02);
      },
    },
  };

  /* --------------------------------------------------------- carousel -- */

  // A point slide: the same code on every point, with its copy in options.
  const POINT = function (ctx, t, s) {
    const ground = s.color("Ground", P.cream);
    const inkC = s.color("Ink", P.black);
    const number = s.text("Number", "1");
    const title = s.text("Headline", "Ease out on entry");
    const body = s.text("Body", "An element arriving is settling, not starting. It decelerates.");
    const jitterAmt = s.range("Jitter", 0.1, 0, 1);
    const showFooter = s.toggle("Footer", true);

    stripes(ctx, s, t, { ground, ink: inkC, dir: Number(number) % 2 ? 1 : -1 });
    const cx = s.w / 2;
    tag(ctx, s, number, cx, s.h * 0.16, inkC);

    // the headline, its words spreading to fill the box
    ctx.fillStyle = inkC;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "center";
    const size = Math.round(s.w * 0.1);
    ctx.font = s.font({ size, weight: 400, family: sans });
    const bw = s.w * 0.7;
    const lines = s.lines(title, bw);
    const lh = size * 0.84;
    const spread = s.span(t, 0.05, 0.5, s.ease.expoOut) * (1 - s.span(t, 0.88, 1, s.ease.inOut));
    const y0 = s.h * 0.4 - ((lines.length - 1) * lh) / 2 + size * 0.3;
    const j = s.jitter(t, 0, 24);
    box(ctx, cx - bw / 2, y0 - size * 0.74, bw, (lines.length - 1) * lh + size, null, inkC);
    lines.forEach((line, i) =>
      s.justify(line, cx - bw / 2 + j.x * jitterAmt * size * 0.06, y0 + i * lh + j.y * jitterAmt * size * 0.06, bw, spread),
    );

    // the body, Lora, a line at a time
    const bSize = Math.round(s.w * 0.036);
    ctx.font = s.font({ size: bSize, weight: 400, family: serif });
    const bLines = s.lines(body, s.w * 0.64);
    let y = y0 + (lines.length - 1) * lh + size * 1.1;
    bLines.forEach((line, i) => {
      const p = s.stagger(t, i, bLines.length, { from: 0.3, to: 0.7, overlap: 0.7, ease: s.ease.out });
      ctx.globalAlpha = p * (1 - s.span(t, 0.9, 1));
      ctx.fillText(line, cx, y + (1 - p) * bSize * 0.5);
      y += bSize * 1.45;
    });
    ctx.globalAlpha = 1;

    if (showFooter) footer(ctx, s, { color: inkC });
  };

  const CAROUSEL = [
    {
      name: "Cover",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.green);
        const discs = s.pick("Discs", "club", SET_NAMES);
        const color = s.color("Type", P.indigo);
        const copy = s.text("Lines", "Three\neasing rules\nworth\n*keeping*");
        const entrance = s.pick("Entrance", "pop", s.ENTRANCES);
        const swipe = s.text("Swipe", "Swipe →");

        confetti(ctx, s, t, { ground, inks: SETS[discs], seed: 3 });

        const lines = copy.split("\n").filter(Boolean);
        const size = Math.round(s.w * 0.085);
        const step = size * 1.3;
        const y0 = s.h / 2 - ((lines.length - 1) * step) / 2;
        const leave = s.span(t, 0.9, 1, s.ease.in);

        lines.forEach((line, i) => {
          const p = s.stagger(t, i, lines.length, { from: 0.03, to: 0.45, overlap: 0.6, ease: s.ease.backOut });
          const fx = s.enter(entrance, p, size);
          fx.alpha *= 1 - leave;
          fx.scale *= 1 - leave;
          pill(ctx, s, line, s.w / 2, y0 + i * step, { size, color, stroke: P.periwinkle, fx });
        });

        footer(ctx, s, { text: swipe, color: P.white, alpha: s.span(t, 0.5, 0.7) * (1 - leave) });
      },
    },
    {
      name: "Point 1",
      fn: POINT,
      opts: {
        Number: "1",
        Headline: "Ease out on entry",
        Body: "An element arriving is settling, not starting. It decelerates. Easing in on entry reads as hesitation.",
      },
    },
    {
      name: "Point 2",
      fn: POINT,
      opts: {
        Number: "2",
        Headline: "Stagger, don't sync",
        Body: "Things that arrive together read as one thing. Offset them by a few frames and the eye counts them.",
      },
    },
    {
      name: "Point 3",
      fn: POINT,
      opts: {
        Number: "3",
        Headline: "Loop on a whole cycle",
        Body: "If it repeats, make the last frame land on the first. Anything that spins should do so a whole number of times.",
      },
    },
    {
      name: "End",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.cream);
        const inkC = s.color("Ink", P.black);
        const head = s.text("Headline", "Save\nthis one.");
        const warpAmt = s.range("Warp", 1, 0, 2, 0.1);

        tape(ctx, s, t, { ground, seed: 9 });
        const cx = s.w / 2;

        const hLines = head.split("\n").filter(Boolean);
        const hSize = Math.round(s.w * 0.14);
        const hy = s.h * 0.5 - (hLines.length - 1) * hSize * 0.475;
        const L = s.layer("end");
        L.ctx.fillStyle = inkC;
        L.ctx.textAlign = "center";
        L.ctx.font = s.font({ size: hSize, weight: 900, family: sans });
        hLines.forEach((line, i) => L.ctx.fillText(line, cx, hy + i * hSize * 0.95));
        const bw = s.w * 0.84;
        box(ctx, cx - bw / 2, hy - hSize * 0.9, bw, hSize * (0.95 * (hLines.length - 1) + 1.15), ground, inkC);
        const amp = s.w * 0.015 * warpAmt;
        s.warp(L.canvas, {
          slice: 9,
          dx: (v) => amp * Math.sin(s.TAU * (v * 2 + t)),
          sx: (v) => 1 + 0.04 * warpAmt * Math.sin(s.TAU * (v * 3 - t)),
        });

        footer(ctx, s, { fill: ground, color: inkC });
      },
    },
  ];

  /* ------------------------------------------------------------ utils -- */

  // The body of a function's source, dedented.
  function body(fn) {
    const src = fn.toString();
    const text = src.slice(src.indexOf("{") + 1, src.lastIndexOf("}"));
    const lines = text.replace(/^\n/, "").replace(/\s+$/, "").split("\n");
    const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)[0].length));
    return lines.map((l) => l.slice(Math.min(indent, l.length))).join("\n");
  }

  F.SHARED_DEFAULT = body(SHARED);
  F.SWATCHES = ["#000000", "#ffffff", "#fffdf0", "#f4f3ef", "#adb4f5", "#3d3deb", "#2e7d46", "#ee4b2b", "#f4a71d", "#4b1a10", "#f2a1c4", "#8a8a5a", "#9a9a9a"];
  F.STARTERS = Object.keys(SLIDES).map((id) => ({
    id,
    label: SLIDES[id].label,
    name: SLIDES[id].name,
    code: body(SLIDES[id].fn),
  }));
  F.CAROUSEL = CAROUSEL.map((slide) => ({ name: slide.name, code: body(slide.fn), opts: slide.opts || {} }));
})();
