// Starters. Each is written as a real function so it is checked as JavaScript
// when this file loads; the editor gets its body via toString().
(function () {
  const F = window.FRAMES;

  const SHARED = `// Shared runs before every slide, so anything declared here is in scope there.
const paper = "#f3f1ec";
const ink = "#141414";
const font = "system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";

// A helper any slide can call: a small line in the bottom-right corner.
function corner(ctx, s, text) {
  ctx.save();
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.55;
  ctx.font = "500 " + Math.round(s.w * 0.028) + "px " + font;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, s.w - s.w * 0.08, s.h - s.w * 0.08);
  ctx.restore();
}`;

  const SLIDES = {
    blank: {
      label: "Blank",
      name: "Blank",
      fn: function (ctx, t, s) {
        // t runs 0 → 1 over the loop, then wraps. Draw the whole frame every call.
        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, s.w, s.h);

        ctx.fillStyle = ink;
        ctx.font = "600 " + Math.round(s.w * 0.07) + "px " + font;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("hello", s.w / 2, s.h / 2 + Math.sin(t * s.TAU) * s.w * 0.02);
      },
    },

    headline: {
      label: "Headline — words rise in",
      name: "Headline",
      fn: function (ctx, t, s) {
        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, s.w, s.h);

        const copy = "Motion is a decision, not a garnish.";
        const m = s.w * 0.09;
        const size = Math.round(s.w * 0.11);
        ctx.fillStyle = ink;
        ctx.font = "700 " + size + "px " + font;
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

        ctx.globalAlpha = s.span(t, 0.5, 0.7) * (1 - leave);
        ctx.font = "500 " + Math.round(s.w * 0.03) + "px " + font;
        ctx.fillText("the Motion Social Club", m, s.h - m);
        ctx.globalAlpha = 1;
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
        const cx = s.w / 2, cy = s.h / 2;

        ctx.fillStyle = paper;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "800 " + Math.round(s.w * 0.28) + "px " + font;
        ctx.fillText(String(n), cx, cy - s.w * 0.02);

        ctx.globalAlpha = s.span(t, 0.4, 0.6);
        ctx.font = "500 " + Math.round(s.w * 0.038) + "px " + font;
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

        const cx = s.w / 2, cy = s.h / 2;
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
      label: "Marquee — bands of type",
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
        ctx.font = "800 " + size + "px " + font;
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
            const cx = (x + 0.5) * cell, cy = (y + 0.5) * cell;
            const d = Math.hypot(cx - s.w / 2, cy - s.h / 2) / far;
            const r = cell * 0.42 * s.wave(t - d * 0.5); // one cycle per loop, delayed by distance
            s.circle(cx, cy, r);
            ctx.fill();
          }
        }
      },
    },
  };

  /* --------------------------------------------------------- carousel -- */

  const CAROUSEL = [
    {
      name: "Cover",
      fn: function (ctx, t, s) {
        ctx.fillStyle = ink;
        ctx.fillRect(0, 0, s.w, s.h);

        const m = s.w * 0.09;
        const size = Math.round(s.w * 0.12);
        ctx.fillStyle = paper;
        ctx.font = "700 " + size + "px " + font;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        const lines = s.lines("Three easing rules worth keeping", s.w - 2 * m);
        const lh = size * 1.02;
        const y0 = s.h / 2 - (lines.length * lh) / 2 + size * 0.78;
        lines.forEach((line, i) => {
          const p = s.stagger(t, i, lines.length, { from: 0.05, to: 0.5, overlap: 0.6, ease: s.ease.expoOut });
          ctx.globalAlpha = p;
          ctx.fillText(line, m, y0 + i * lh + (1 - p) * size * 0.4);
        });

        ctx.globalAlpha = s.span(t, 0.45, 0.65);
        ctx.font = "500 " + Math.round(s.w * 0.03) + "px " + font;
        ctx.fillText("Swipe →", m, s.h - m);
        ctx.globalAlpha = 1;
      },
    },
    {
      name: "Point 1",
      fn: function (ctx, t, s) {
        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, s.w, s.h);

        const m = s.w * 0.09;
        const title = "Ease out on entry";
        const body =
          "An element arriving is settling, not starting. It decelerates. Easing in on entry reads as hesitation.";

        // the big number, faint
        ctx.fillStyle = ink;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.font = "800 " + Math.round(s.w * 0.34) + "px " + font;
        ctx.globalAlpha = 0.09 * s.span(t, 0, 0.3);
        ctx.fillText("1", m - s.w * 0.015, m + s.w * 0.3);

        // title
        ctx.globalAlpha = 1;
        const size = Math.round(s.w * 0.085);
        ctx.font = "700 " + size + "px " + font;
        let y = m + s.w * 0.42;
        s.lines(title, s.w - 2 * m).forEach((line, i) => {
          const p = s.stagger(t, i, 2, { from: 0.05, to: 0.4, ease: s.ease.expoOut });
          ctx.globalAlpha = p;
          ctx.fillText(line, m, y + (1 - p) * size * 0.4);
          y += size * 1.04;
        });

        // body
        const bsize = Math.round(s.w * 0.04);
        ctx.font = "400 " + bsize + "px " + font;
        y += bsize * 1.2;
        s.lines(body, s.w - 2 * m).forEach((line, i) => {
          const p = s.stagger(t, i, 5, { from: 0.25, to: 0.7, overlap: 0.7, ease: s.ease.out });
          ctx.globalAlpha = p;
          ctx.fillText(line, m, y + (1 - p) * bsize * 0.6);
          y += bsize * 1.4;
        });

        // the rule, drawn: a dot that eases out along a line
        ctx.globalAlpha = 1;
        const ly = s.h - m - s.w * 0.12;
        ctx.strokeStyle = ink;
        ctx.lineWidth = s.w * 0.003;
        ctx.beginPath();
        ctx.moveTo(m, ly);
        ctx.lineTo(s.w - m, ly);
        ctx.stroke();
        const px = s.lerp(m, s.w - m, s.ease.expoOut(s.ping(t)));
        s.circle(px, ly, s.w * 0.018);
        ctx.fill();

        corner(ctx, s, s.index + " / " + (s.count - 1));
      },
    },
    {
      name: "Point 2",
      fn: function (ctx, t, s) {
        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, s.w, s.h);

        const m = s.w * 0.09;
        const title = "Stagger, don't sync";
        const body =
          "Things that arrive together read as one thing. Offset them by a few frames and the eye counts them.";

        ctx.fillStyle = ink;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.font = "800 " + Math.round(s.w * 0.34) + "px " + font;
        ctx.globalAlpha = 0.09 * s.span(t, 0, 0.3);
        ctx.fillText("2", m - s.w * 0.015, m + s.w * 0.3);

        ctx.globalAlpha = 1;
        const size = Math.round(s.w * 0.085);
        ctx.font = "700 " + size + "px " + font;
        let y = m + s.w * 0.42;
        s.lines(title, s.w - 2 * m).forEach((line, i) => {
          const p = s.stagger(t, i, 2, { from: 0.05, to: 0.4, ease: s.ease.expoOut });
          ctx.globalAlpha = p;
          ctx.fillText(line, m, y + (1 - p) * size * 0.4);
          y += size * 1.04;
        });

        const bsize = Math.round(s.w * 0.04);
        ctx.font = "400 " + bsize + "px " + font;
        y += bsize * 1.2;
        s.lines(body, s.w - 2 * m).forEach((line, i) => {
          const p = s.stagger(t, i, 5, { from: 0.25, to: 0.7, overlap: 0.7, ease: s.ease.out });
          ctx.globalAlpha = p;
          ctx.fillText(line, m, y + (1 - p) * bsize * 0.6);
          y += bsize * 1.4;
        });

        // five bars, staggered
        ctx.globalAlpha = 1;
        const by = s.h - m - s.w * 0.06;
        const n = 5, gap = s.w * 0.02;
        const bw = (s.w - 2 * m - gap * (n - 1)) / n;
        for (let i = 0; i < n; i++) {
          const p = s.stagger(s.ping(t), i, n, { from: 0.1, to: 0.9, overlap: 0.6, ease: s.ease.backOut });
          const hgt = s.w * 0.14 * p;
          ctx.fillRect(m + i * (bw + gap), by - hgt, bw, hgt);
        }

        corner(ctx, s, s.index + " / " + (s.count - 1));
      },
    },
    {
      name: "Point 3",
      fn: function (ctx, t, s) {
        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, s.w, s.h);

        const m = s.w * 0.09;
        const title = "Loop on a whole cycle";
        const body =
          "If it repeats, make the last frame land on the first. Anything that spins or ripples should do so a whole number of times.";

        ctx.fillStyle = ink;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.font = "800 " + Math.round(s.w * 0.34) + "px " + font;
        ctx.globalAlpha = 0.09 * s.span(t, 0, 0.3);
        ctx.fillText("3", m - s.w * 0.015, m + s.w * 0.3);

        ctx.globalAlpha = 1;
        const size = Math.round(s.w * 0.085);
        ctx.font = "700 " + size + "px " + font;
        let y = m + s.w * 0.42;
        s.lines(title, s.w - 2 * m).forEach((line, i) => {
          const p = s.stagger(t, i, 2, { from: 0.05, to: 0.4, ease: s.ease.expoOut });
          ctx.globalAlpha = p;
          ctx.fillText(line, m, y + (1 - p) * size * 0.4);
          y += size * 1.04;
        });

        const bsize = Math.round(s.w * 0.04);
        ctx.font = "400 " + bsize + "px " + font;
        y += bsize * 1.2;
        s.lines(body, s.w - 2 * m).forEach((line, i) => {
          const p = s.stagger(t, i, 6, { from: 0.25, to: 0.7, overlap: 0.7, ease: s.ease.out });
          ctx.globalAlpha = p;
          ctx.fillText(line, m, y + (1 - p) * bsize * 0.6);
          y += bsize * 1.4;
        });

        // a ring with a dot going round exactly once
        ctx.globalAlpha = 1;
        const cx = s.w - m - s.w * 0.1, cy = s.h - m - s.w * 0.1, r = s.w * 0.08;
        ctx.strokeStyle = ink;
        ctx.lineWidth = s.w * 0.003;
        s.circle(cx, cy, r);
        ctx.stroke();
        const a = s.TAU * t - Math.PI / 2;
        s.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, s.w * 0.016);
        ctx.fill();

        corner(ctx, s, s.index + " / " + (s.count - 1));
      },
    },
    {
      name: "End",
      fn: function (ctx, t, s) {
        ctx.fillStyle = ink;
        ctx.fillRect(0, 0, s.w, s.h);

        const m = s.w * 0.09;
        ctx.fillStyle = paper;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        const size = Math.round(s.w * 0.1);
        ctx.font = "700 " + size + "px " + font;
        const p = s.span(t, 0.05, 0.4, s.ease.expoOut);
        ctx.globalAlpha = p;
        ctx.fillText("Save this one.", m, s.h / 2 + (1 - p) * size * 0.4);

        ctx.globalAlpha = s.span(t, 0.35, 0.6);
        ctx.font = "500 " + Math.round(s.w * 0.034) + "px " + font;
        ctx.fillText("the Motion Social Club", m, s.h / 2 + size * 0.9);

        // a small pulse, one cycle per loop
        ctx.globalAlpha = 1;
        s.circle(s.w - m - s.w * 0.04, m + s.w * 0.04, s.w * 0.02 + s.w * 0.015 * s.wave(t));
        ctx.fill();
      },
    },
  ];

  /* ------------------------------------------------------------ utils -- */

  // The body of a function's source, dedented.
  function body(fn) {
    const src = fn.toString();
    let text = src.slice(src.indexOf("{") + 1, src.lastIndexOf("}"));
    const lines = text.replace(/^\n/, "").replace(/\s+$/, "").split("\n");
    const indent = Math.min(
      ...lines.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)[0].length),
    );
    return lines.map((l) => l.slice(Math.min(indent, l.length))).join("\n");
  }

  F.SHARED_DEFAULT = SHARED;
  F.STARTERS = Object.keys(SLIDES).map((id) => ({
    id,
    label: SLIDES[id].label,
    name: SLIDES[id].name,
    code: body(SLIDES[id].fn),
  }));
  F.CAROUSEL = CAROUSEL.map((slide) => ({ name: slide.name, code: body(slide.fn) }));
})();
