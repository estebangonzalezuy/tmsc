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
      maroon: "#4b1a10", // the confetti's dark disc
      olive: "#8a8a5a", // the tape's dull dot
    };
    const paper = P.cream;
    const ink = P.black;

    // Named ink sets, for a "Discs" or "Marks" option.
    const SETS = {
      club: [P.white, P.red, P.maroon, P.periwinkle, P.white, P.red, P.green, P.white],
      warm: [P.red, P.maroon, P.white, P.cream, P.red],
      cool: [P.indigo, P.periwinkle, P.white, P.green, P.periwinkle],
      mono: [P.black, P.white, P.paper, P.black],
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
      ctx.strokeStyle = o.color || ink;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - w * 0.47, y - size * 0.55, w * 0.94, size * 0.9);
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
        s.warp(L.canvas, {
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
  F.SWATCHES = ["#000000", "#ffffff", "#fffdf0", "#f4f3ef", "#adb4f5", "#3d3deb", "#2e7d46", "#ee4b2b", "#4b1a10", "#8a8a5a"];
  F.STARTERS = Object.keys(SLIDES).map((id) => ({
    id,
    label: SLIDES[id].label,
    name: SLIDES[id].name,
    code: body(SLIDES[id].fn),
  }));
  F.CAROUSEL = CAROUSEL.map((slide) => ({ name: slide.name, code: body(slide.fn), opts: slide.opts || {} }));
})();
