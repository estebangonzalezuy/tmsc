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
      amber: "#f8ab00", // the rays, the polygons' ground
      orange: "#f6881a", // the "Taller" ground, a warmer amber
      violet: "#5c48fe", // the "You need more practice" ground
      sky: "#95aeff", // the rays' periwinkle, lighter than the site's
      forest: "#20512f", // the polygon ring, the bricks' dark row
      brown: "#34210f", // the polygons' corner blocks
      pink: "#f6c0dc", // a plate behind the practice type
      hotpink: "#ff4fa3", // a disc in the network
      grey: "#d9d9d9", // a wedge in the burst
      olive: "#8a8a5a",
    };
    const paper = P.cream;
    const ink = P.black;

    // Named ink sets, for a "Discs" or "Marks" option.
    const SETS = {
      club: [P.white, P.red, P.maroon, P.periwinkle, P.white, P.red, P.green, P.white],
      warm: [P.red, P.maroon, P.white, P.cream, P.red],
      cool: [P.indigo, P.periwinkle, P.white, P.green, P.periwinkle],
      mono: [P.black, P.white, P.paper, P.black],
      festival: [P.white, P.grey, P.red, P.indigo, P.sky, P.cream, P.black, P.forest, P.brown, P.cream, P.indigo, P.grey, P.red, P.sky],
      garden: [P.forest, P.white, P.amber, P.hotpink, P.brown, P.black, P.red, P.cream, P.sky, P.indigo, P.olive, P.grey],
      taller: [P.indigo, P.red, P.forest, P.black, P.white, P.sky, P.red, P.indigo, P.white, P.forest, P.indigo, P.black],
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
      const f = { size: o.size, family: o.family || sans, weight: o.weight || 700, align: o.align || "center", italic: o.italic, stretch: o.stretch };
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
      const texture = s.range("Texture", d.texture == null ? 0.8 : d.texture, 0, 1.5);
      const grain = s.range("Grain", d.grain == null ? 0.5 : d.grain, 0, 1);
      const chunk = s.range("Chunk", d.chunk == null ? 3 : d.chunk, 1, 10, 1);
      const rough = s.range("Wobble", d.rough == null ? 0.15 : d.rough, 0, 1);
      const bleed = s.range("Bleed", d.bleed == null ? 0 : d.bleed, -1, 1);
      const chroma = s.range("Chroma", d.chroma == null ? 0 : d.chroma, 0, 1);
      const boil = s.range("Boil", d.boil == null ? 8 : d.boil, 0, 24, 1);
      return { texture, grain, chunk, rough: rough * s.w * 0.012, bleed: bleed * s.w * 0.008, chroma: chroma * s.w * 0.012, boil, t };
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

    // 8 — rays: a fan of amber wedges from a point far below the frame, so
    //     the middle one reads as a near-vertical band and only its
    //     neighbours' tips show in the lower corners. Rocks once per loop.
    function rays(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.sky;
      ctx.fillRect(0, 0, s.w, s.h);
      const n = o.count || 5;
      const ox = s.w / 2;
      const oy = s.h * (o.origin == null ? 1.55 : o.origin);
      const R = s.h * 5;
      const spread = o.spread || 2.4;
      const sway = (o.sway == null ? 1 : o.sway) * 0.025 * Math.sin(s.TAU * t);
      ctx.fillStyle = o.color || P.amber;
      for (let i = 0; i < n; i++) {
        const c = -Math.PI / 2 - spread / 2 + (spread * (i + 0.5)) / n + sway;
        const half = (spread / n) * (o.width || 0.13) * (0.92 + 0.16 * s.wave(t - i / n));
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(c - half) * R, oy + Math.sin(c - half) * R);
        ctx.lineTo(ox + Math.cos(c + half) * R, oy + Math.sin(c + half) * R);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 9 — burst: two fans of wedges, up and down from the centre, each
    //     wedge outlined by a hairline, cream left and right. The fans rock
    //     once per loop and the wedges breathe on their own phase.
    function burst(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.cream;
      ctx.fillRect(0, 0, s.w, s.h);
      const inks = o.inks || SETS.festival;
      const n = o.count || 15;
      const cx = o.cx == null ? s.w / 2 : o.cx;
      const cy = o.cy == null ? s.h * 0.42 : o.cy;
      const R = Math.hypot(s.w, s.h) * 1.2;
      const span = o.span || 1.7;
      const rnd = s.rand(o.seed || 21);
      const rock = (o.spin == null ? 1 : o.spin) * 0.1 * Math.sin(s.TAU * t);
      ctx.save();
      ctx.lineWidth = Math.max(1.5, s.w * 0.0015);
      ctx.strokeStyle = o.line || P.black;
      ctx.lineJoin = "miter";
      [-Math.PI / 2, Math.PI / 2].forEach((centre, f) => {
        const widths = [];
        let total = 0;
        for (let i = 0; i < n; i++) {
          const w = 0.5 + rnd() * (0.6 + 0.5 * s.wave(t - rnd()));
          widths.push(w);
          total += w;
        }
        let a = centre - span / 2 + rock;
        for (let i = 0; i < n; i++) {
          const da = (span * widths[i]) / total;
          ctx.fillStyle = inks[(i + f * 5) % inks.length];
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
          ctx.lineTo(cx + Math.cos(a + da) * R, cy + Math.sin(a + da) * R);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          a += da;
        }
      });
      ctx.restore();
    }

    // 10 — ribbons: a bundle of straight stripes standing nearly upright,
    //      fanning slightly so they cross near the bottom, each swaying on
    //      its own phase. The bundle leans in and back once per loop.
    function ribbons(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.orange;
      ctx.fillRect(0, 0, s.w, s.h);
      const inks = o.inks || SETS.taller;
      const n = o.count || 18;
      const width = s.w * (o.width || 0.048);
      const lean = (o.angle == null ? -0.12 : o.angle) + 0.08 * Math.sin(s.TAU * t);
      const fan = o.fan == null ? -0.012 : o.fan;
      const sway = s.w * 0.02 * (o.wave == null ? 1 : o.wave);
      const rnd = s.rand(o.seed || 19);
      const L = s.h * 2.8;
      const bundle = (count, ox, oy, base, spacing) => {
        ctx.save();
        ctx.translate(ox, oy);
        ctx.lineWidth = width;
        ctx.lineCap = "butt";
        for (let i = 0; i < count; i++) {
          const x = (i - (count - 1) / 2) * width * spacing + (rnd() - 0.5) * width * 0.4;
          const ph = rnd();
          const a = base + (i - (count - 1) / 2) * fan + Math.sin(s.TAU * (t + ph)) * 0.025;
          ctx.save();
          ctx.rotate(a);
          ctx.strokeStyle = inks[i % inks.length];
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + Math.sin(s.TAU * (t + ph)) * sway, -L);
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
      };
      // a few stripes crossing low from the right, then the main bundle over them
      if (o.cross) bundle(6, s.w * 1.15, s.h * 0.78, lean - 1.15, 1.05);
      bundle(n, s.w * 0.5, s.h * 1.25, lean, 1.02);
    }

    // 11 — polygons: thick polygon rings growing out of the centre one
    //      after another, on amber with dark slabs in the corners.
    function polygons(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.amber;
      ctx.fillRect(0, 0, s.w, s.h);
      if (o.blocks !== false) {
        ctx.fillStyle = o.block || P.brown;
        const slab = (x, y, rot, w, h) => {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rot);
          ctx.fillRect(-w / 2, -h / 2, w, h);
          ctx.restore();
        };
        // a wide wedge hanging from the top edge, and smaller slabs at the
        // other corners
        ctx.beginPath();
        ctx.moveTo(s.w * 0.1, -s.h * 0.05);
        ctx.lineTo(s.w * 0.92, -s.h * 0.05);
        ctx.lineTo(s.w * 0.68, s.h * 0.2);
        ctx.lineTo(s.w * 0.36, s.h * 0.22);
        ctx.closePath();
        ctx.fill();
        slab(s.w * 1.04, s.h * 0.56, 0.18, s.w * 0.22, s.w * 0.4);
        slab(-s.w * 0.04, s.h * 0.98, 0.14, s.w * 0.44, s.w * 0.24);
        slab(s.w * 0.9, s.h * 1.03, -0.2, s.w * 0.4, s.w * 0.2);
      }
      const inks = o.inks || [P.forest, P.red, P.forest, P.brown];
      const sides = Math.max(3, Math.round(o.sides || 8));
      const n = o.count || 3;
      const cx = s.w / 2;
      const cy = s.h / 2;
      const Rmax = Math.hypot(s.w, s.h) * 0.7;
      const items = [];
      for (let i = 0; i < n; i++) items.push({ p: s.wrap(t + i / n), i });
      items.sort((a, b) => b.p - a.p);
      ctx.save();
      items.forEach(({ p, i }) => {
        const r = s.ease.quadIn(p) * Rmax;
        if (r < 1) return;
        const rot = 0.12 + 0.08 * Math.sin(s.TAU * t);
        ctx.beginPath();
        for (let k = 0; k < sides; k++) {
          const a = rot + (s.TAU * k) / sides;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          if (k) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = inks[i % inks.length];
        ctx.lineWidth = r * 0.3;
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
      const inks = o.inks || [P.indigo, P.red, P.forest, P.sky, P.amber, P.black, P.hotpink];
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

    // 13 — bricks: a running bond of wide bands, each row two colours
    //      alternating, every other row sliding the other way. A row slides
    //      two bricks per loop, so the bond is seamless.
    function bricks(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.cream;
      ctx.fillRect(0, 0, s.w, s.h);
      const pairs = o.pairs || [
        [P.white, P.sky],
        [P.indigo, P.white],
        [P.forest, P.sky],
        [P.white, P.indigo],
        [P.sky, P.forest],
        [P.indigo, P.cream],
      ];
      const inset = s.w * (o.inset == null ? 0.14 : o.inset);
      const span = s.w - 2 * inset;
      const rowH = s.h / (o.rows || 36);
      const brickW = span / (o.cols || 7);
      const rows = Math.ceil(s.h / rowH);
      const rnd = s.rand(o.seed || 33);
      ctx.save();
      ctx.beginPath();
      ctx.rect(inset, 0, span, s.h);
      ctx.clip();
      for (let j = 0; j < rows; j++) {
        const dir = j % 2 ? 1 : -1;
        const off = inset + ((j % 2) * brickW) / 2 + s.wrap(t) * brickW * 2 * dir;
        const pair = pairs[Math.floor(rnd() * pairs.length)];
        for (let i = -4; i <= Math.ceil(span / brickW) + 3; i++) {
          ctx.fillStyle = pair[((i % 2) + 2) % 2];
          ctx.fillRect(i * brickW + off, j * rowH + rowH * 0.12, brickW - s.w * 0.005, rowH * 0.76);
        }
      }
      ctx.restore();
    }

    // 14 — network: a cluster of overlapping discs, each hanging on a thin
    //      pin, sliding a little along it once per loop.
    function network(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.white;
      ctx.fillRect(0, 0, s.w, s.h);
      const inks = o.inks || SETS.garden;
      const n = o.count || 40;
      const cx = o.cx == null ? s.w / 2 : o.cx;
      const cy = o.cy == null ? s.h / 2 : o.cy;
      const R = Math.min(s.w, s.h) * (o.radius || 0.33);
      const rnd = s.rand(o.seed || 37);
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = rnd() * s.TAU;
        const d = Math.pow(rnd(), 0.6) * R;
        const ph = rnd();
        const up = rnd() < 0.5;
        const slide = Math.sin(s.TAU * (t + ph)) * s.w * 0.012;
        pts.push({
          x: cx + Math.cos(a) * d * 1.05,
          y: cy + Math.sin(a) * d * 0.95 + slide,
          r: s.w * (0.04 + 0.018 * rnd()),
          pin: s.w * (0.06 + 0.12 * rnd()) * (up ? -1 : 1),
          color: inks[i % inks.length],
        });
      }
      ctx.save();
      ctx.strokeStyle = o.line || P.black;
      ctx.lineWidth = Math.max(1.5, s.w * 0.0018);
      pts.forEach((p) => {
        ctx.beginPath();
        ctx.moveTo(p.x + p.r * 0.2, p.y);
        ctx.lineTo(p.x + p.r * 0.2, p.y + p.pin);
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
      ctx.fillStyle = o.ground || P.violet;
      ctx.fillRect(0, 0, s.w, s.h);
      const n = o.count || 7;
      const rnd = s.rand(o.seed || 41);
      ctx.save();
      ctx.strokeStyle = o.line || P.red;
      ctx.lineWidth = Math.max(1.5, s.w * 0.002);
      for (let i = 0; i < n; i++) {
        const bx = rnd() * s.w;
        const by = rnd() * s.h;
        const br = s.w * (0.14 + 0.24 * rnd());
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

    // 16 — sweep: a thick black band curving up through the frame with a
    //      pale one beside it, and striped tape along the left and right
    //      edges. The band swings once per loop.
    function sweep(ctx, s, t, o) {
      o = o || {};
      ctx.fillStyle = o.ground || P.indigo;
      ctx.fillRect(0, 0, s.w, s.h);
      const k = Math.sin(s.TAU * t) * s.h * 0.08 * (o.swing == null ? 1 : o.swing);
      const band = (color, width, dy) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = "butt";
        ctx.beginPath();
        ctx.moveTo(-s.w * 0.1, s.h * 1.0 + dy + k);
        ctx.bezierCurveTo(s.w * 0.55, s.h * 0.98 + dy + k, s.w * 0.85, s.h * 0.78 + dy - k, s.w * 1.08, s.h * 0.22 + dy - k);
        ctx.stroke();
      };
      band(o.pale || P.sky, s.w * 0.1, s.w * 0.15);
      band(o.band || P.black, s.w * 0.16, 0);
      // striped tape on the two edges, sliding one stripe per loop
      const tw = s.w * (o.tape == null ? 0.028 : o.tape);
      if (tw > 0) {
        const step = tw * 1.1;
        const off = s.wrap(t) * step * 2;
        [0, s.w - tw].forEach((x, side) => {
          ctx.fillStyle = P.white;
          ctx.fillRect(x, 0, tw, s.h);
          ctx.fillStyle = o.stripe || P.red;
          for (let y = -step * 2; y < s.h + step * 2; y += step * 2) ctx.fillRect(x, y + off * (side ? -1 : 1), tw, step);
        });
      }
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
        const go = gritOptions(s, t, { texture: 0.7, grain: 0.4, chunk: 4, rough: 0.15, bleed: 0, chroma: 0, boil: 6 });

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
      label: "Rays — Lora over a fan of amber bands",
      name: "Rays",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.sky);
        const color = s.color("Rays", P.amber);
        const inkC = s.color("Ink", P.black);
        const count = s.range("Wedges", 5, 2, 12, 1);
        const sway = s.range("Sway", 1, 0, 2, 0.1);
        const kicker = s.text("Kicker", "Starting in motion series.");
        const head = s.text("Headline", "**3 exercises**\nto *finish*\n**__this week.__**");
        const width = s.range("Band width", 0.16, 0.05, 0.3);
        const entrance = s.pick("Entrance", "rise", s.ENTRANCES);
        const showFooter = s.toggle("Footer", true);

        rays(ctx, s, t, { ground, color, count, sway, width });
        const cx = s.w / 2;
        ctx.fillStyle = inkC;
        ctx.textBaseline = "alphabetic";

        ctx.globalAlpha = s.span(t, 0.02, 0.25);
        s.rich(kicker, cx, s.h * 0.085, { size: Math.round(s.w * 0.05), family: serif, weight: 400, align: "center" });
        ctx.globalAlpha = 1;

        const lines = head.split("\n").filter(Boolean);
        const size = Math.round(s.w * 0.168);
        const lh = size * 0.93;
        const y0 = s.h * 0.5 - ((lines.length - 1) * lh) / 2 + size * 0.3;
        const leave = s.span(t, 0.9, 1, s.ease.in);
        lines.forEach((line, i) => {
          const p = s.stagger(t, i, lines.length, { from: 0.05, to: 0.5, overlap: 0.6, ease: s.ease.expoOut });
          const fx = s.enter(entrance, p, size * 0.6);
          fx.alpha *= 1 - leave;
          s.place(cx, y0 + i * lh, fx, () => {
            ctx.fillStyle = inkC;
            s.rich(line, 0, 0, { size, family: serif, weight: 400, align: "center" });
          });
        });

        if (showFooter) footer(ctx, s, { color: inkC, box: false });
      },
    },

    burst: {
      label: "Burst — two fans of outlined wedges behind Lora",
      name: "Burst",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.cream);
        const wedges = s.pick("Wedges", "festival", SET_NAMES);
        const count = s.range("Per fan", 15, 6, 30, 1);
        const rock = s.range("Rock", 1, 0, 3, 0.1);
        const inkC = s.color("Ink", P.black);
        const left = s.text("Left", "Build");
        const right = s.text("Right", "your path.");
        const showFooter = s.toggle("Footer", false);

        burst(ctx, s, t, { ground, inks: SETS[wedges], count, spin: rock });
        const cx = s.w / 2;
        const cy = s.h * 0.42;

        // the two halves converge on the vanishing point: each is skewed
        // toward it, the near end tall and the far end small
        ctx.fillStyle = inkC;
        ctx.textBaseline = "alphabetic";
        const leave = s.span(t, 0.9, 1, s.ease.in);
        const pL = s.span(t, 0.05, 0.4, s.ease.expoOut);
        const pR = s.span(t, 0.15, 0.5, s.ease.expoOut);
        const size = Math.round(s.w * 0.15);
        ctx.save();
        ctx.globalAlpha = pL * (1 - leave);
        ctx.translate(s.w * 0.06 - (1 - pL) * s.w * 0.2, cy + s.h * 0.26);
        ctx.transform(1, -0.2, 0, 1, 0, 0);
        s.rich(left, 0, 0, { size, family: serif, weight: 700, align: "left" });
        ctx.restore();
        // the right half: its first word small, the rest at size, both
        // skewed the other way toward the vanishing point
        const words = right.split(" ");
        const first = words.length > 1 ? words[0] : "";
        const rest = words.length > 1 ? words.slice(1).join(" ") : right;
        const fRest = { size: Math.round(size * 0.85), family: serif, weight: 700, align: "right" };
        const fFirst = { size: Math.round(size * 0.48), family: serif, weight: 700, align: "right" };
        ctx.save();
        ctx.globalAlpha = pR * (1 - leave);
        ctx.translate(s.w * 0.94 + (1 - pR) * s.w * 0.2, cy + s.h * 0.2);
        ctx.transform(1, 0.22, 0, 1, 0, 0);
        const restW = s.measure(rest, fRest);
        s.rich(rest, 0, 0, fRest);
        if (first) s.rich(first, -restW - size * 0.12, -size * 0.06, fFirst);
        ctx.restore();

        if (showFooter) footer(ctx, s, { color: inkC, fill: ground });
      },
    },

    ribbons: {
      label: "Ribbons — condensed Archivo with a print echo over a bundle of stripes",
      name: "Ribbons",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.orange);
        const bands = s.pick("Stripes", "taller", SET_NAMES);
        const count = s.range("Stripes count", 18, 6, 40, 1);
        const wave = s.range("Sway", 1, 0, 2, 0.1);
        const type = s.color("Type", P.white);
        const echoA = s.color("Echo", P.black);
        const echoB = s.color("Echo 2", P.red);
        const head = s.text("Headline", "Taller para\nempezar\nen *Motion*\nhoy");
        const kicker = s.text("Kicker", "Con *Superlocal.uy*");
        const shake = s.range("Shake", 0.3, 0, 1);
        const gritOn = s.toggle("Grit", true);
        const go = gritOptions(s, t, { texture: 0.25, grain: 0.9, chunk: 2, rough: 0.12, bleed: 0, chroma: 0, boil: 8 });

        ribbons(ctx, s, t, { ground, inks: SETS[bands], count, wave });
        const cx = s.w / 2;

        const L = s.layer("type");
        const g = s.on(L.ctx);
        const lines = head.split("\n").filter(Boolean);
        const size = Math.round(s.w * 0.215);
        const lh = size * 0.8;
        const y0 = s.h * 0.45 - ((lines.length - 1) * lh) / 2 + size * 0.3;
        const leave = s.span(t, 0.9, 1, s.ease.in);
        L.ctx.textBaseline = "alphabetic";
        if ("letterSpacing" in L.ctx) L.ctx.letterSpacing = `${-size * 0.045}px`; // tight, like the poster
        lines.forEach((line, i) => {
          const p = s.stagger(t, i, lines.length, { from: 0.03, to: 0.45, overlap: 0.6, ease: s.ease.expoOut });
          const fx = s.enter("rise", p, size * 0.5);
          fx.alpha *= 1 - leave;
          const sh = s.shake(t, i, 4);
          g.place(cx + sh.x * shake * size * 0.05, y0 + i * lh + sh.y * shake * size * 0.05, fx, () => {
            echo(L.ctx, g, line, 0, 0, {
              size,
              family: sans,
              weight: 700,
              stretch: "condensed",
              color: type,
              offsets: [
                { dx: 0.075, dy: 0.06, color: echoB },
                { dx: 0.04, dy: 0.035, color: echoA },
              ],
            });
          });
        });
        if (gritOn) s.grit(L.canvas, go);
        else ctx.drawImage(L.canvas, 0, 0);

        ctx.globalAlpha = s.span(t, 0.45, 0.65) * (1 - leave);
        ctx.fillStyle = type;
        s.rich(kicker, cx, s.h - s.w * 0.08, { size: Math.round(s.w * 0.045), family: serif, weight: 400, italic: true, align: "center" });
        ctx.globalAlpha = 1;
      },
    },

    polygons: {
      label: "Polygons — a hand-cut sticker of Lora inside growing rings",
      name: "Polygons",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.amber);
        const block = s.color("Blocks", P.brown);
        const ringA = s.color("Ring A", P.forest);
        const ringB = s.color("Ring B", P.red);
        const sides = s.range("Sides", 8, 3, 12, 1);
        const count = s.range("Rings", 3, 1, 8, 1);
        const paperC = s.color("Sticker", P.white);
        const inkC = s.color("Ink", P.black);
        const head = s.text("Headline", "You don't need\nmore options.\nYou need fewer.");
        const shake = s.range("Wobble", 0.5, 0, 1);
        const gritOn = s.toggle("Grit", true);
        const go = gritOptions(s, t, { texture: 0.5, grain: 0.7, chunk: 3, rough: 0.2, bleed: 0.25, chroma: 0, boil: 6 });

        polygons(ctx, s, t, { ground, block, inks: [ringA, ringA, ringB, block], sides, count });
        const cx = s.w / 2;
        const cy = s.h / 2;

        const lines = head.split("\n").filter(Boolean);
        const size = Math.round(s.w * 0.088);
        const lh = size * 1.02;
        const f = { size, family: serif, weight: 700, italic: true, align: "center" };
        let widest = 0;
        lines.forEach((line) => (widest = Math.max(widest, s.measure(line, f))));
        const inP = s.span(t, 0.05, 0.4, s.ease.backOut);
        const leave = s.span(t, 0.9, 1, s.ease.in);
        const rot = 0.03 * shake * Math.sin(s.TAU * 2 * t);
        // sticker and type on one layer, so the sticker's edge is hand-cut
        // by the same pass that roughens the letters
        const L = s.layer("sticker");
        const g = s.on(L.ctx);
        const y0 = cy - ((lines.length - 1) * lh) / 2 + size * 0.35;
        L.ctx.fillStyle = paperC;
        lines.forEach((line, i) => {
          const w = s.measure(line, f);
          g.roundRect(cx - w / 2 - size * 0.3, y0 + i * lh - size * 0.92, w + size * 0.6, size * 1.22, size * 0.5);
          L.ctx.fill();
        });
        L.ctx.fillStyle = inkC;
        L.ctx.textBaseline = "alphabetic";
        lines.forEach((line, i) => g.rich(line, cx, y0 + i * lh, f));
        s.place(cx, cy, { dx: 0, dy: 0, scale: inP * (1 - leave), rot, alpha: 1 }, () => {
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
      label: "Bricks — justified Archivo in a box over a sliding bond",
      name: "Bricks",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.cream);
        const rows = s.range("Rows", 36, 10, 60, 1);
        const cols = s.range("Bricks across", 7, 2, 12, 1);
        const inset = s.range("Inset", 0.14, 0, 0.3);
        const paperC = s.color("Box", P.white);
        const inkC = s.color("Ink", P.black);
        const copy = s.text("Headline", "You don't learn motion design by (only) watching. You learn by doing.");
        const jitterAmt = s.range("Jitter", 0.15, 0, 1);
        const gritOn = s.toggle("Grit", true);
        const go = gritOptions(s, t, { texture: 0.1, grain: 0.8, chunk: 2, rough: 0.3, bleed: 0, chroma: 0, boil: 8 });

        bricks(ctx, s, t, { ground, rows, cols, inset });
        const cx = s.w / 2;

        const L = s.layer("type");
        const g = s.on(L.ctx);
        L.ctx.fillStyle = inkC;
        L.ctx.textBaseline = "alphabetic";
        const size = Math.round(s.w * 0.088);
        L.ctx.font = s.font({ size, weight: 400, family: sans });
        if ("fontStretch" in L.ctx) L.ctx.fontStretch = "normal";
        const bw = s.w * 0.42;
        const lines = g.lines(copy, bw);
        const lh = size * 0.86;
        const spread = s.span(t, 0.05, 0.5, s.ease.expoOut) * (1 - s.span(t, 0.88, 1, s.ease.inOut));
        const bh = (lines.length - 1) * lh + size * 1.15;
        const y0 = s.h * 0.55 - bh / 2 + size * 0.85;
        const inP = s.span(t, 0.02, 0.3, s.ease.expoOut);
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - bw / 2 - size * 0.7, s.h * 0.55 - (bh / 2) * inP, bw + size * 1.4, bh * inP);
        ctx.clip();
        box(ctx, cx - bw / 2 - size * 0.7, y0 - size * 0.85, bw + size * 1.4, bh, paperC, inkC);
        const j = s.jitter(t, 0, 24);
        lines.forEach((line, i) => g.justify(line, cx - bw / 2 + j.x * jitterAmt * size * 0.05, y0 + i * lh + j.y * jitterAmt * size * 0.05, bw, spread));
        if (gritOn) s.grit(L.canvas, go);
        else ctx.drawImage(L.canvas, 0, 0);
        ctx.restore();
      },
    },

    network: {
      label: "Network — Lora above and below a cluster of pinned discs",
      name: "Network",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.white);
        const discs = s.pick("Discs", "garden", SET_NAMES);
        const count = s.range("Discs count", 40, 6, 60, 1);
        const line = s.color("Pins", P.black);
        const inkC = s.color("Ink", P.black);
        const top = s.text("Top", "Make");
        const bottom = s.text("Bottom", "Genuine\nConnections");
        const entrance = s.pick("Entrance", "fade", s.ENTRANCES);

        const cx = s.w / 2;
        const longest = [top, bottom].join("\n").split("\n").reduce((a, b) => (b.length > a.length ? b : a), "");
        const size = Math.min(Math.round(s.w * 0.19), s.fit(longest, s.w * 0.92, { max: 400, min: 40, weight: 700, family: serif }));
        const leave = s.span(t, 0.9, 1, s.ease.in);
        ctx.fillStyle = ground;
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.textBaseline = "alphabetic";
        const f = { size, family: serif, weight: 700, align: "center" };
        const draw = (text, y, i) => {
          text.split("\n").filter(Boolean).forEach((ln, k) => {
            const p = s.stagger(t, i + k, 3, { from: 0.05, to: 0.5, overlap: 0.5, ease: s.ease.expoOut });
            const fx = s.enter(entrance, p, size * 0.5);
            fx.alpha *= 1 - leave;
            s.place(cx, y + k * size * 1.0, fx, () => {
              ctx.fillStyle = inkC;
              s.rich(ln, 0, 0, f);
            });
          });
        };
        // the words sit behind the cluster, which is drawn over them
        draw(top, s.h * 0.26, 0);
        draw(bottom, s.h * 0.82, 1);
        ctx.save();
        ctx.globalAlpha = s.span(t, 0.1, 0.35) * (1 - leave);
        const N = s.layer("cluster");
        const gn = s.on(N.ctx);
        network(N.ctx, gn, t, { ground: "rgba(0,0,0,0)", inks: SETS[discs], count, line, cy: s.h * 0.53 });
        ctx.drawImage(N.canvas, 0, 0);
        ctx.restore();
      },
    },

    blobs: {
      label: "Blobs — chunky Lora with converging plates over outlined shapes",
      name: "Blobs",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.violet);
        const line = s.color("Outlines", P.red);
        const count = s.range("Shapes", 7, 2, 16, 1);
        const type = s.color("Type", P.red);
        const plateA = s.color("Plate A", P.amber);
        const plateB = s.color("Plate B", P.pink);
        const head = s.text("Headline", "You need\nmore\npractice");
        const other = s.text("Mixes with", "You don't\nneed more\ntutorials");
        const offset = s.range("Plate offset", 0.3, 0, 1);
        const fatten = s.range("Fatten", 0.5, 0, 1);
        const shake = s.range("Shake", 0.3, 0, 1);
        const gritOn = s.toggle("Grit", true);
        const go = gritOptions(s, t, { texture: 0.4, grain: 0.9, chunk: 2, rough: 0.15, bleed: 0.05, chroma: 0, boil: 8 });

        blobs(ctx, s, t, { ground, line, count });
        const cx = s.w / 2;

        // the type: three plates that start apart and converge, the letters
        // of the other phrase showing through until each settles
        const L = s.layer("type");
        const lines = head.split("\n").filter(Boolean);
        const alt = other.split("\n");
        const size = Math.round(s.w * 0.21);
        const lh = size * 0.8;
        const y0 = s.h / 2 - ((lines.length - 1) * lh) / 2 + size * 0.32;
        const leave = s.span(t, 0.9, 1, s.ease.in);
        L.ctx.textBaseline = "alphabetic";
        L.ctx.textAlign = "center";
        L.ctx.font = s.font({ size, weight: 700, family: serif });
        L.ctx.lineJoin = "round";
        L.ctx.lineWidth = size * 0.05 * fatten;
        // a stroke of the same colour fattens the face toward the poster's
        const plate = (text, x, y, color) => {
          L.ctx.fillStyle = color;
          L.ctx.strokeStyle = color;
          if (fatten > 0) L.ctx.strokeText(text, x, y);
          L.ctx.fillText(text, x, y);
        };
        lines.forEach((ln, i) => {
          const p = s.stagger(t, i, lines.length, { from: 0.02, to: 0.55, overlap: 0.5, ease: s.ease.out });
          const b = (alt[i] || "").padEnd(ln.length, " ");
          const text = ln
            .split("")
            .map((ch, k) => (s.hash(k * 7 + i * 31, 5) < p * 1.15 || ch === " " ? ch : b[k] === " " ? ch : b[k]))
            .join("");
          const sh = s.jitter(t, i, 12);
          const amt = shake * size * 0.02 * (1 - s.span(p, 0.9, 1));
          const apart = (1 - p) * offset * size;
          const x = cx + sh.x * amt;
          const y = y0 + i * lh + sh.y * amt;
          L.ctx.globalAlpha = s.span(p, 0, 0.1) * (1 - leave);
          plate(text, x - apart * 0.9, y - apart * 0.5, plateB);
          plate(text, x + apart * 0.7, y + apart * 0.35, plateA);
          plate(text, x, y, type);
        });
        if (gritOn) s.grit(L.canvas, go);
        else ctx.drawImage(L.canvas, 0, 0);
      },
    },

    sweep: {
      label: "Sweep — three colours of Lora over a curving black band",
      name: "Sweep",
      fn: function (ctx, t, s) {
        const ground = s.color("Ground", P.indigo);
        const band = s.color("Band", P.black);
        const pale = s.color("Beside it", P.sky);
        const stripe = s.color("Tape", P.red);
        const swing = s.range("Swing", 1, 0, 2, 0.1);
        const a = s.color("Line 1", P.red);
        const b = s.color("Line 2", P.white);
        const c = s.color("Line 3", P.amber);
        const head = s.text("Headline", "Job titles\nare getting\nabstract.");
        const entrance = s.pick("Entrance", "rise", s.ENTRANCES);

        sweep(ctx, s, t, { ground, band, pale, stripe, swing });
        const cx = s.w / 2;
        const lines = head.split("\n").filter(Boolean);
        const colors = [a, b, c];
        const size = Math.round(s.w * 0.145);
        const lh = size * 0.88;
        const y0 = s.h * 0.5 - ((lines.length - 1) * lh) / 2 + size * 0.35;
        const leave = s.span(t, 0.9, 1, s.ease.in);
        ctx.textBaseline = "alphabetic";
        lines.forEach((ln, i) => {
          const p = s.stagger(t, i, lines.length, { from: 0.05, to: 0.5, overlap: 0.6, ease: s.ease.expoOut });
          const fx = s.enter(entrance, p, size * 0.5);
          fx.alpha *= 1 - leave;
          s.place(cx, y0 + i * lh, fx, () => {
            ctx.fillStyle = colors[i % colors.length];
            s.rich(ln, 0, 0, { size, family: serif, weight: 700, align: "center" });
          });
        });
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
        const go = gritOptions(s, t, { texture: 1.0, grain: 0.6, chunk: 4, rough: 0.2, bleed: 0.2, chroma: 0.3, boil: 10 });
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
          T.ctx.globalAlpha = 0.3;
          T.ctx.fillRect(0, 0, s.w, s.h);
          ctx.globalAlpha = tooth * 0.5;
          s.grit(T.canvas, { texture: 1.3, grain: 1, chunk: 2, rough: 0, bleed: 0, chroma: 0, boil: go.boil, t, hard: false });
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
  F.SWATCHES = ["#000000", "#ffffff", "#fffdf0", "#f4f3ef", "#adb4f5", "#95aeff", "#3d3deb", "#5c48fe", "#2e7d46", "#20512f", "#ee4b2b", "#f8ab00", "#f6881a", "#4b1a10", "#34210f", "#f6c0dc", "#ff4fa3", "#8a8a5a", "#d9d9d9"];
  F.STARTERS = Object.keys(SLIDES).map((id) => ({
    id,
    label: SLIDES[id].label,
    name: SLIDES[id].name,
    code: body(SLIDES[id].fn),
  }));
  F.CAROUSEL = CAROUSEL.map((slide) => ({ name: slide.name, code: body(slide.fn), opts: slide.opts || {} }));
})();
