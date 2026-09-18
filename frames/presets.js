// Starters. Each is written as a real function so it is checked as JavaScript
// when this file loads; the editor gets its body via toString().
//
// Two faces only, Archivo and Lora. Three background systems, each one a
// seamless loop: a packed confetti field, punched-tape columns, and faint
// drifting stripes. Boxed type over them.
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

    // A hairline box. The type inside is meant to overhang it a little.
    function box(ctx, x, y, w, h, fill) {
      ctx.save();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }

    // One line of type in a white pill, centred on (cx, cy). Rich text:
    // *italic*, **bold**. `scale` pops it in.
    function pill(ctx, s, text, cx, cy, o) {
      const size = o.size;
      const h = size * 1.3;
      const w = s.measure(text, o) + size;
      const k = o.scale == null ? 1 : o.scale;
      if (k <= 0) return;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(k, k);
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
      s.rich(text, 0, size * 0.08, { size, family: o.family || serif, weight: o.weight || 700, align: "center" });
      ctx.restore();
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

    // Background 1 — confetti: a packed field of discs on green, each one
    // circling its home once per loop, so the field jostles and never jumps.
    function confetti(ctx, s, t, o) {
      o = o || {};
      const inks = o.inks || [P.white, P.red, P.maroon, P.periwinkle, P.white, P.red, P.green, P.white];
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
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const a = rnd(), b = rnd(), c = rnd(), d = rnd();
          const ang = s.TAU * (t * (d < 0.5 ? 1 : -1) + a); // one revolution per loop
          const orbit = r * (0.2 + 0.4 * b);
          const x = x0 + i * pitch + (a - 0.5) * pitch * 0.7 + Math.cos(ang) * orbit;
          const y = y0 + j * pitch + (b - 0.5) * pitch * 0.7 + Math.sin(ang) * orbit;
          ctx.fillStyle = inks[Math.floor(c * inks.length)];
          s.circle(x, y, r * (0.8 + 0.35 * d));
          ctx.fill();
        }
      }
    }

    // Background 2 — tape: columns of dots and stacked bars, scrolling like
    // punched tape. A column repeats every `period` units and moves a whole
    // number of periods per loop, so the scroll is seamless.
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
        const speed = 1 + (c % 2);
        const off = s.wrap(t * speed) * H * dir;
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

    // Background 3 — stripes: faint pale rules drifting one pitch per loop,
    // with small dots between them that breathe on their own phase.
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
        ctx.fillStyle = P.white;
        ctx.fillRect(x - pitch * 0.09, 0, pitch * 0.18, s.h);
      }
      const rows = Math.round(s.h / pitch);
      ctx.fillStyle = ink;
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
  };

  /* --------------------------------------------------------- starters -- */

  const SLIDES = {
    confetti: {
      label: "Confetti — pills of Lora on a jostling field",
      name: "Confetti",
      fn: function (ctx, t, s) {
        confetti(ctx, s, t);

        const lines = ["Stop", "comparing", "your chapter", "one", "to someone", "else's *chapter*", "twenty."];
        const size = Math.round(s.w * 0.075);
        const step = size * 1.3; // pills touch, like the reference
        const y0 = s.h / 2 - ((lines.length - 1) * step) / 2;
        const leave = s.span(t, 0.9, 1, s.ease.in);

        lines.forEach((line, i) => {
          const p = s.stagger(t, i, lines.length, { from: 0.03, to: 0.5, overlap: 0.65, ease: s.ease.backOut });
          pill(ctx, s, line, s.w / 2, y0 + i * step, {
            size,
            family: serif,
            weight: 700,
            color: P.indigo,
            stroke: P.periwinkle,
            scale: p * (1 - leave),
          });
        });
      },
    },

    tape: {
      label: "Tape — a warped Archivo headline over punched tape",
      name: "Tape",
      fn: function (ctx, t, s) {
        tape(ctx, s, t);
        const cx = s.w / 2;

        // the kicker: Lora, spaced, in a box that opens
        const kSize = Math.round(s.w * 0.075);
        const kf = { size: kSize, family: serif, weight: 400 };
        const kick = "A  place  to";
        const kw = s.measure(kick, kf) + kSize * 0.3;
        const ky = s.h * 0.23;
        const open = s.span(t, 0.02, 0.35, s.ease.expoOut);
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - kw / 2, 0, kw * open, s.h);
        ctx.clip();
        box(ctx, cx - kw / 2, ky - kSize * 0.72, kw, kSize * 0.95, P.cream);
        ctx.fillStyle = ink;
        ctx.textBaseline = "alphabetic";
        s.rich(kick, cx, ky, { ...kf, align: "center" });
        ctx.restore();

        // the headline: Archivo black on a layer, then warped in slices
        const hSize = Math.round(s.w * 0.15);
        const hy = s.h * 0.52;
        const L = s.layer("head");
        L.ctx.fillStyle = ink;
        L.ctx.textAlign = "center";
        L.ctx.font = s.font({ size: hSize, weight: 900, family: sans });
        L.ctx.fillText("Question", cx, hy);
        L.ctx.fillText("ourselves", cx, hy + hSize * 0.92);
        const bw = s.w * 0.9;
        box(ctx, cx - bw / 2, hy - hSize * 0.9, bw, hSize * 2.05, P.cream);
        const amp = s.w * 0.018 * s.span(t, 0.1, 0.5, s.ease.inOut);
        s.warp(L.canvas, {
          slice: 9,
          dx: (v) => amp * Math.sin(s.TAU * (v * 2.5 - t)),
          sx: (v) => 1 + 0.05 * Math.sin(s.TAU * (v * 4 + t)),
        });

        footer(ctx, s, { fill: P.cream });
      },
    },

    stripes: {
      label: "Stripes — a justified Archivo headline over faint stripes",
      name: "Stripes",
      fn: function (ctx, t, s) {
        stripes(ctx, s, t);
        const cx = s.w / 2;
        ctx.fillStyle = ink;
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "center";

        // the number, in a small box
        const nSize = Math.round(s.w * 0.035);
        const ny = s.h * 0.2;
        ctx.font = s.font({ size: nSize, weight: 400, family: sans });
        box(ctx, cx - nSize * 0.42, ny - nSize * 0.86, nSize * 0.84, nSize * 1.12);
        ctx.fillText(String(s.index + 1), cx, ny);

        // the headline, its words spreading to fill the box
        const copy = "Check the time available you have in your week";
        const size = Math.round(s.w * 0.1);
        ctx.font = s.font({ size, weight: 400, family: sans });
        const bw = s.w * 0.68;
        const lines = s.lines(copy, bw);
        const lh = size * 0.84; // tight, like the reference
        const spread = s.span(t, 0.05, 0.5, s.ease.expoOut) * (1 - s.span(t, 0.88, 1, s.ease.inOut));
        const y0 = s.h * 0.5 - ((lines.length - 1) * lh) / 2 + size * 0.3;
        box(ctx, cx - bw / 2, y0 - size * 0.74, bw, (lines.length - 1) * lh + size * 1.0);
        lines.forEach((line, i) => s.justify(line, cx - bw / 2, y0 + i * lh, bw, spread));

        footer(ctx, s);
      },
    },

    headline: {
      label: "Headline — Lora words rise in",
      name: "Headline",
      fn: function (ctx, t, s) {
        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, s.w, s.h);

        const copy = "Motion is a decision, not a garnish.";
        const m = s.w * 0.09;
        const size = Math.round(s.w * 0.11);
        ctx.fillStyle = ink;
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

        footer(ctx, s, { alpha: s.span(t, 0.5, 0.7) * (1 - leave) });
      },
    },

    counter: {
      label: "Counter — a number counts up",
      name: "Counter",
      fn: function (ctx, t, s) {
        ctx.fillStyle = ink;
        ctx.fillRect(0, 0, s.w, s.h);

        const p = s.span(t, 0.05, 0.7, s.ease.expoOut);
        const n = Math.round(p * 744);
        const cx = s.w / 2;
        const cy = s.h / 2;

        ctx.fillStyle = paper;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = s.font({ size: Math.round(s.w * 0.28), weight: 900, family: sans });
        ctx.fillText(String(n), cx, cy - s.w * 0.02);

        ctx.globalAlpha = s.span(t, 0.4, 0.6);
        ctx.font = s.font({ size: Math.round(s.w * 0.038), weight: 400, family: serif, italic: true });
        ctx.fillText("entries in the Directory", cx, cy + s.w * 0.17);

        // a ring closes with the count
        ctx.globalAlpha = 1;
        ctx.strokeStyle = paper;
        ctx.lineWidth = s.w * 0.006;
        ctx.beginPath();
        ctx.arc(cx, cy, s.w * 0.37, -Math.PI / 2, -Math.PI / 2 + s.TAU * p);
        ctx.stroke();
      },
    },

    rings: {
      label: "Rings — orbits, seamless loop",
      name: "Rings",
      fn: function (ctx, t, s) {
        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, s.w, s.h);

        const cx = s.w / 2;
        const cy = s.h / 2;
        const R = Math.min(s.w, s.h) * 0.4;
        ctx.strokeStyle = ink;
        ctx.fillStyle = ink;
        ctx.lineWidth = s.w * 0.003;

        for (let i = 0; i < 6; i++) {
          const r = (R * (i + 1)) / 6;
          ctx.globalAlpha = 0.25 + 0.75 * (i / 5);
          s.circle(cx, cy, r);
          ctx.stroke();
          // whole revolutions per loop, so t = 1 lands exactly on t = 0
          const a = s.TAU * t * (i + 1) * (i % 2 ? -1 : 1);
          s.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, s.w * 0.01 + i * s.w * 0.003);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
    },

    marquee: {
      label: "Marquee — bands of Archivo",
      name: "Marquee",
      fn: function (ctx, t, s) {
        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, s.w, s.h);

        const text = "MOTION SOCIAL CLUB  ·  ";
        const rows = Math.max(3, Math.round(s.h / (s.w * 0.19)));
        const size = Math.round((s.h / rows) * 0.66);
        ctx.fillStyle = ink;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = s.font({ size, weight: 900, family: sans });
        const unit = ctx.measureText(text).width;
        const reps = Math.ceil(s.w / unit) + 2;

        for (let r = 0; r < rows; r++) {
          const y = ((r + 0.5) * s.h) / rows;
          const dir = r % 2 ? 1 : -1;
          // a whole number of units per loop keeps the band seamless
          const off = s.wrap(t * (1 + (r % 3))) * unit * dir;
          for (let k = -2; k < reps; k++) ctx.fillText(text, k * unit + off, y);
        }
      },
    },

    grid: {
      label: "Grid — a ripple of dots",
      name: "Grid",
      fn: function (ctx, t, s) {
        ctx.fillStyle = ink;
        ctx.fillRect(0, 0, s.w, s.h);

        const cols = 12;
        const cell = s.w / cols;
        const rows = Math.ceil(s.h / cell);
        const far = Math.hypot(s.w / 2, s.h / 2);
        ctx.fillStyle = paper;

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
        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, s.w, s.h);

        ctx.fillStyle = ink;
        ctx.font = s.font({ size: Math.round(s.w * 0.07), weight: 600, family: sans });
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("hello", s.w / 2, s.h / 2 + Math.sin(t * s.TAU) * s.w * 0.02);
      },
    },
  };

  /* --------------------------------------------------------- carousel -- */

  function pointSlide(number, title, body) {
    return function (ctx, t, s) {
      stripes(ctx, s, t, { dir: number % 2 ? 1 : -1 });
      const cx = s.w / 2;
      ctx.fillStyle = ink;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "center";

      // the number, in a small box
      const nSize = Math.round(s.w * 0.035);
      const ny = s.h * 0.16;
      ctx.font = s.font({ size: nSize, weight: 400, family: sans });
      box(ctx, cx - nSize * 0.42, ny - nSize * 0.86, nSize * 0.84, nSize * 1.12);
      ctx.fillText(String(number), cx, ny);

      // the headline, its words spreading to fill the box
      const size = Math.round(s.w * 0.1);
      ctx.font = s.font({ size, weight: 400, family: sans });
      const bw = s.w * 0.7;
      const lines = s.lines(title, bw);
      const lh = size * 0.84;
      const spread = s.span(t, 0.05, 0.5, s.ease.expoOut) * (1 - s.span(t, 0.88, 1, s.ease.inOut));
      const y0 = s.h * 0.4 - ((lines.length - 1) * lh) / 2 + size * 0.3;
      box(ctx, cx - bw / 2, y0 - size * 0.74, bw, (lines.length - 1) * lh + size);
      lines.forEach((line, i) => s.justify(line, cx - bw / 2, y0 + i * lh, bw, spread));

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

      footer(ctx, s);
    };
  }

  const CAROUSEL = [
    {
      name: "Cover",
      fn: function (ctx, t, s) {
        confetti(ctx, s, t, { seed: 3 });

        const lines = ["Three", "easing rules", "worth", "*keeping*"];
        const size = Math.round(s.w * 0.085);
        const step = size * 1.3;
        const y0 = s.h / 2 - ((lines.length - 1) * step) / 2;
        const leave = s.span(t, 0.9, 1, s.ease.in);

        lines.forEach((line, i) => {
          const p = s.stagger(t, i, lines.length, { from: 0.03, to: 0.45, overlap: 0.6, ease: s.ease.backOut });
          pill(ctx, s, line, s.w / 2, y0 + i * step, {
            size,
            family: serif,
            weight: 700,
            color: P.indigo,
            stroke: P.periwinkle,
            scale: p * (1 - leave),
          });
        });

        footer(ctx, s, { text: "Swipe →", color: P.white, alpha: s.span(t, 0.5, 0.7) * (1 - leave) });
      },
    },
    {
      name: "Point 1",
      args: [1, "Ease out on entry", "An element arriving is settling, not starting. It decelerates. Easing in on entry reads as hesitation."],
    },
    {
      name: "Point 2",
      args: [2, "Stagger, don't sync", "Things that arrive together read as one thing. Offset them by a few frames and the eye counts them."],
    },
    {
      name: "Point 3",
      args: [3, "Loop on a whole cycle", "If it repeats, make the last frame land on the first. Anything that spins should do so a whole number of times."],
    },
    {
      name: "End",
      fn: function (ctx, t, s) {
        tape(ctx, s, t, { seed: 9 });
        const cx = s.w / 2;

        const hSize = Math.round(s.w * 0.14);
        const hy = s.h * 0.5;
        const L = s.layer("end");
        L.ctx.fillStyle = ink;
        L.ctx.textAlign = "center";
        L.ctx.font = s.font({ size: hSize, weight: 900, family: sans });
        L.ctx.fillText("Save", cx, hy - hSize * 0.5);
        L.ctx.fillText("this one.", cx, hy + hSize * 0.45);
        const bw = s.w * 0.84;
        box(ctx, cx - bw / 2, hy - hSize * 1.4, bw, hSize * 2.1, P.cream);
        const amp = s.w * 0.015;
        s.warp(L.canvas, {
          slice: 9,
          dx: (v) => amp * Math.sin(s.TAU * (v * 2 + t)),
          sx: (v) => 1 + 0.04 * Math.sin(s.TAU * (v * 3 - t)),
        });

        footer(ctx, s, { fill: P.cream });
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

  // A carousel slide made by pointSlide() is a closure; its source is the
  // template's, so it is written out with its arguments substituted.
  function pointSource(number, title, body_) {
    const src = body(pointSlide(0, "", ""));
    return src
      .replace("String(number)", JSON.stringify(String(number)))
      .replace("{ dir: number % 2 ? 1 : -1 }", `{ dir: ${number % 2 ? 1 : -1} }`)
      .replace("s.lines(title, bw)", `s.lines(${JSON.stringify(title)}, bw)`)
      .replace("s.lines(body, s.w * 0.64)", `s.lines(${JSON.stringify(body_)}, s.w * 0.64)`);
  }

  F.SHARED_DEFAULT = body(SHARED);
  F.STARTERS = Object.keys(SLIDES).map((id) => ({
    id,
    label: SLIDES[id].label,
    name: SLIDES[id].name,
    code: body(SLIDES[id].fn),
  }));
  F.CAROUSEL = CAROUSEL.map((slide) => ({
    name: slide.name,
    code: slide.args ? pointSource(...slide.args) : body(slide.fn),
  }));
})();
