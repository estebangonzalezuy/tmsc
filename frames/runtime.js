// The runtime: compiles a slide's code into a function and renders one frame.
//
// A slide is the body of `function (ctx, t, s)`:
//   ctx  a CanvasRenderingContext2D, already scaled so 0..s.w × 0..s.h is the post
//   t    loop progress, 0 → 1, then it wraps — draw the whole frame every call
//   s    the stage: sizes, timing and a small helper kit (see makeStage below)
//
// The contract: a frame is a pure function of (t, s). No state between calls,
// no Math.random (use s.rand / s.hash), no wall clock. That is what lets the
// preview, the thumbnails and every exported frame come out of one function,
// and two exports of the same post be identical.
(function () {
  const F = window.FRAMES;
  const TAU = Math.PI * 2;

  /* ----------------------------------------------------------- easing -- */

  const EASE = {
    linear: (t) => t,
    in: (t) => t * t * t,
    out: (t) => 1 - Math.pow(1 - t, 3),
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    quadIn: (t) => t * t,
    quadOut: (t) => 1 - (1 - t) * (1 - t),
    expoOut: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    expoIn: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
    backOut: (t) => {
      const c = 1.70158;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    },
    backIn: (t) => {
      const c = 1.70158;
      return (c + 1) * t * t * t - c * t * t;
    },
    elasticOut: (t) =>
      t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1,
    bounceOut: (t) => {
      const n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
      if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
      return n * (t -= 2.625 / d) * t + 0.984375;
    },
  };

  /* ---------------------------------------------------------- numbers -- */

  function clamp(v, a = 0, b = 1) {
    return v < a ? a : v > b ? b : v;
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function map(v, a, b, c, d, clampIt = true) {
    const u = (v - a) / (b - a);
    return c + (d - c) * (clampIt ? clamp(u) : u);
  }
  function wrap(t) {
    return t - Math.floor(t);
  }
  // Progress through a window of the loop: 0 before `from`, 1 after `to`.
  function span(t, from = 0, to = 1, ease) {
    const u = clamp((t - from) / (to - from));
    return ease ? ease(u) : u;
  }
  // Progress of item i of n, each item's window overlapping the next.
  function stagger(t, i, n, opts = {}) {
    const { from = 0, to = 1, overlap = 0.6, ease } = opts;
    const len = (to - from) / (1 + Math.max(0, n - 1) * (1 - overlap));
    const start = from + i * len * (1 - overlap);
    return span(t, start, start + len, ease);
  }
  // 0 → 1 → 0 across the loop, a triangle.
  function ping(t) {
    return 1 - Math.abs(2 * wrap(t) - 1);
  }
  // 0 → 1 → 0, smooth, `cycles` whole times per loop — always seamless.
  function wave(t, cycles = 1) {
    return (1 - Math.cos(TAU * Math.round(cycles) * t)) / 2;
  }
  // Seeded random: `const r = s.rand(7); r(), r(), …` — the same every frame.
  function rand(seed) {
    let a = (Math.floor(seed) >>> 0) || 1;
    return function () {
      a += 0x6d2b79f5;
      let x = Math.imul(a ^ (a >>> 15), 1 | a);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  // One stable number in 0..1 for an index.
  function hash(i, seed = 0) {
    return rand(i * 7919 + seed * 104729 + 1)();
  }

  /* ------------------------------------------------------------- text -- */

  // Greedy word wrap using the current ctx.font. A "\n" forces a break.
  function wrapText(ctx, text, maxWidth) {
    const out = [];
    String(text)
      .split("\n")
      .forEach((para) => {
        const words = para.split(/\s+/).filter(Boolean);
        let line = "";
        words.forEach((word) => {
          const next = line ? line + " " + word : word;
          if (line && ctx.measureText(next).width > maxWidth) {
            out.push(line);
            line = word;
          } else {
            line = next;
          }
        });
        out.push(line);
      });
    return out;
  }

  // Largest font size (≤ max, ≥ min) at which `text` fits `maxWidth` on one
  // line. Sets ctx.font to it and returns the size.
  function fitFont(ctx, text, maxWidth, opts = {}) {
    const { max = 200, min = 12, weight = 700, family = "sans-serif" } = opts;
    let lo = min, hi = max;
    const fontAt = (size) => `${weight} ${size}px ${family}`;
    ctx.font = fontAt(hi);
    if (ctx.measureText(text).width <= maxWidth) return hi;
    while (hi - lo > 0.5) {
      const mid = (lo + hi) / 2;
      ctx.font = fontAt(mid);
      if (ctx.measureText(text).width <= maxWidth) lo = mid;
      else hi = mid;
    }
    const size = Math.floor(lo);
    ctx.font = fontAt(size);
    return size;
  }

  /* ------------------------------------------------------------ paths -- */

  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, TAU);
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }



  /* ----------------------------------------------------------- motion -- */

  // Stepped time: n steps per loop, so a value can change in jumps.
  function step(t, n) {
    return Math.floor(wrap(t) * n) / n;
  }
  // A smooth seeded shake: two whole-cycle sines per axis, in about -1..1.
  function shake(t, seed = 0, cycles = 6) {
    const r = rand(seed * 31 + 7);
    const a = r(), b = r(), c = r(), d = r();
    const k = Math.max(1, Math.round(cycles));
    return {
      x: (Math.sin(TAU * (k * t + a)) + 0.5 * Math.sin(TAU * (2 * k * t + b))) / 1.5,
      y: (Math.sin(TAU * (k * t + c)) + 0.5 * Math.sin(TAU * (2 * k * t + d))) / 1.5,
    };
  }
  // A stepped random jitter per item: a new offset every 1/steps of the
  // loop, in -1..1, stable for the same t.
  function jitter(t, i = 0, steps = 12, seed = 0) {
    const k = Math.floor(wrap(t) * steps);
    return { x: hash(k * 977 + i, seed) * 2 - 1, y: hash(k * 977 + i, seed + 1) * 2 - 1 };
  }
  // Named entrances. p is 0..1 (ease it first); size sets the travel.
  // Returns { dx, dy, scale, rot, alpha } for place().
  const ENTRANCES = ["rise", "drop", "pop", "slide", "spin", "fade", "none"];
  function enter(name, p, size = 100) {
    const q = clamp(p);
    const fx = { dx: 0, dy: 0, scale: 1, rot: 0, alpha: 1 };
    switch (name) {
      case "rise":
        fx.dy = (1 - q) * size;
        fx.alpha = q;
        break;
      case "drop":
        fx.dy = -(1 - q) * size;
        fx.alpha = q;
        break;
      case "pop":
        fx.scale = p; // unclamped: a backOut overshoot shows
        fx.alpha = q;
        break;
      case "slide":
        fx.dx = (1 - q) * size * 2;
        fx.alpha = q;
        break;
      case "spin":
        fx.rot = (1 - q) * 0.6;
        fx.scale = 0.6 + 0.4 * q;
        fx.alpha = q;
        break;
      case "fade":
        fx.alpha = q;
        break;
      default:
        break;
    }
    return fx;
  }
  // Draws `fn` at (x, y) under an entrance's transform.
  function place(ctx, x, y, fx, fn) {
    if (fx.scale <= 0 || fx.alpha <= 0) return;
    ctx.save();
    ctx.translate(x + fx.dx, y + fx.dy);
    if (fx.rot) ctx.rotate(fx.rot);
    if (fx.scale !== 1) ctx.scale(fx.scale, fx.scale);
    ctx.globalAlpha *= clamp(fx.alpha);
    fn();
    ctx.restore();
  }

  /* ---------------------------------------------------------- options -- */

  // A slide declares what can be changed from the Options panel by calling
  // these as it draws: s.color("Ink", "#000"), s.range("Shake", 0.3, 0, 1),
  // s.pick("Entrance", "rise", s.ENTRANCES), s.toggle("Footer", true),
  // s.text("Headline", "…"). The call returns the current value; the first
  // render after a compile also records the declaration for the panel.
  function optionsFor(s, info) {
    const values = info.opts || {};
    const declare = info.declare;
    const read = (key, kind, fallback, meta) => {
      if (declare && !declare.some((d) => d.key === key)) declare.push(Object.assign({ key, kind, def: fallback }, meta));
      const v = values[key];
      return v == null ? fallback : v;
    };
    s.color = (key, fb) => {
      const v = read(key, "color", fb);
      return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : fb;
    };
    s.range = (key, fb, min = 0, max = 1, stp) => {
      const v = Number(read(key, "range", fb, { min, max, step: stp || (max - min) / 100 }));
      return Number.isFinite(v) ? clamp(v, min, max) : fb;
    };
    s.pick = (key, fb, choices) => {
      const v = read(key, "pick", fb, { choices });
      return choices.includes(v) ? v : fb;
    };
    s.toggle = (key, fb) => !!read(key, "toggle", !!fb);
    s.text = (key, fb) => {
      const v = read(key, "text", fb, { multi: /\n/.test(fb) });
      return typeof v === "string" ? v : fb;
    };
  }

  /* ------------------------------------------------------------- rich -- */

  // "*word*" marks an italic span; "**word**" a bold one.
  function richSpans(text) {
    const spans = [];
    const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|([^*]+)/g;
    let m;
    while ((m = re.exec(String(text)))) {
      if (m[1] != null) spans.push({ text: m[1], bold: true });
      else if (m[2] != null) spans.push({ text: m[2], italic: true });
      else spans.push({ text: m[3] });
    }
    return spans;
  }

  function fontString(o) {
    const italic = o.italic ? "italic " : "";
    return `${italic}${o.weight || 400} ${o.size}px ${o.family || "sans-serif"}`;
  }

  function measureRich(ctx, text, o) {
    let w = 0;
    richSpans(text).forEach((sp) => {
      ctx.font = fontString({ ...o, italic: sp.italic || o.italic, weight: sp.bold ? o.boldWeight || 700 : o.weight });
      w += ctx.measureText(sp.text).width;
    });
    return w;
  }

  // Draws one line of rich text. `align` is left | center | right around x.
  // Uses the current fillStyle and textBaseline. Returns the line's width.
  function fillRich(ctx, text, x, y, o) {
    const w = measureRich(ctx, text, o);
    let cx = o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x;
    const wasAlign = ctx.textAlign;
    ctx.textAlign = "left";
    richSpans(text).forEach((sp) => {
      ctx.font = fontString({ ...o, italic: sp.italic || o.italic, weight: sp.bold ? o.boldWeight || 700 : o.weight });
      ctx.fillText(sp.text, cx, y);
      cx += ctx.measureText(sp.text).width;
    });
    ctx.textAlign = wasAlign;
    return w;
  }

  // Draws a line's words spread to fill `width` (a single word is centred).
  // `spread` 0..1 scales the gaps, so 0 packs the words and 1 justifies.
  function fillJustified(ctx, text, x, y, width, spread = 1) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const widths = words.map((wd) => ctx.measureText(wd).width);
    const total = widths.reduce((a, b) => a + b, 0);
    const space = ctx.measureText(" ").width;
    const wasAlign = ctx.textAlign;
    ctx.textAlign = "left";
    if (words.length === 1) {
      ctx.fillText(words[0], x + (width - total) / 2, y);
    } else {
      const gapMax = (width - total) / (words.length - 1);
      const gap = space + (gapMax - space) * spread;
      const lineW = total + gap * (words.length - 1);
      let cx = x + (width - lineW) / 2;
      words.forEach((wd, i) => {
        ctx.fillText(wd, cx, y);
        cx += widths[i] + gap;
      });
    }
    ctx.textAlign = wasAlign;
  }

  /* ----------------------------------------------------------- layers -- */

  // Offscreen canvases the size of the post, reused between frames and
  // cleared on each request, for drawing something you will warp, mask or
  // composite. Deterministic: a layer never carries anything over.
  const layers = new Map();
  function layer(name, w, h) {
    const key = `${name}:${w}x${h}`;
    let l = layers.get(key);
    if (!l) {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      l = { canvas, ctx: canvas.getContext("2d") };
      layers.set(key, l);
    }
    l.ctx.setTransform(1, 0, 0, 1, 0, 0);
    l.ctx.clearRect(0, 0, w, h);
    l.ctx.globalAlpha = 1;
    l.ctx.textAlign = "left";
    l.ctx.textBaseline = "alphabetic";
    return l;
  }

  // Draws a post-sized canvas onto ctx in horizontal slices, each shifted
  // by dx(v) and stretched by sx(v) about the centre, v = y / h in 0..1.
  function warp(ctx, source, w, h, o = {}) {
    const slice = Math.max(1, o.slice || 12);
    const dx = o.dx || (() => 0);
    const sx = o.sx || (() => 1);
    for (let y = 0; y < h; y += slice) {
      const sh = Math.min(slice, h - y);
      const v = (y + sh / 2) / h;
      const k = sx(v);
      ctx.drawImage(source, 0, y, w, sh, (w - w * k) / 2 + dx(v), y, w * k, sh);
    }
  }

  /* ------------------------------------------------------------ stage -- */

  // `info` carries w, h, seconds, fps, frame, index, count.
  function makeStage(ctx, info) {
    const s = Object.assign(
      { TAU, ease: EASE, clamp, lerp, map, wrap, span, stagger, ping, wave, rand, hash, step, shake, jitter, enter, ENTRANCES },
      info,
    );
    delete s.opts;
    delete s.declare;
    optionsFor(s, info);
    s.place = (x, y, fx, fn) => place(ctx, x, y, fx, fn);
    s.lines = (text, maxWidth) => wrapText(ctx, text, maxWidth);
    s.fit = (text, maxWidth, opts) => fitFont(ctx, text, maxWidth, opts);
    s.circle = (x, y, r) => circle(ctx, x, y, r);
    s.roundRect = (x, y, w, h, r) => roundRect(ctx, x, y, w, h, r);
    s.font = fontString;
    s.rich = (text, x, y, o) => fillRich(ctx, text, x, y, o);
    s.measure = (text, o) => measureRich(ctx, text, o);
    s.justify = (text, x, y, width, spread) => fillJustified(ctx, text, x, y, width, spread);
    s.layer = (name) => layer(name, info.w, info.h);
    s.warp = (source, o) => warp(ctx, source, info.w, info.h, o);
    return s;
  }

  /* ---------------------------------------------------------- compile -- */

  // Shared code is prepended to the slide body so its declarations are in
  // scope. Returns { fn } or { error }.
  function compile(shared, code) {
    const source = (shared || "") + "\n" + (code || "");
    try {
      const fn = new Function("ctx", "t", "s", source);
      return { fn, sharedLines: (shared || "").split("\n").length };
    } catch (e) {
      return { error: describeError(e, (shared || "").split("\n").length) };
    }
  }

  // Turn an Error into { message, where }, mapping a stack line back to the
  // slide or the shared block. `new Function` wraps the body in two lines.
  function describeError(e, sharedLines) {
    const out = { message: (e && e.message) || String(e), where: "" };
    const m = /<anonymous>:(\d+):(\d+)/.exec((e && e.stack) || "");
    if (m) {
      const bodyLine = Number(m[1]) - 2;
      const codeLine = bodyLine - sharedLines;
      out.where = codeLine >= 1 ? `line ${codeLine}` : `shared, line ${bodyLine}`;
      out.line = codeLine >= 1 ? codeLine : null;
    }
    return out;
  }

  /* ----------------------------------------------------------- render -- */

  // Draw one frame of `fn` at loop progress `t` into ctx, scaled by `scale`
  // (so the post's w×h fills scale·w × scale·h device pixels). The context
  // is reset to a known state first and restored after. Returns an error
  // description or null.
  function render(ctx, compiled, t, info, scale = 1) {
    const { w, h } = info;
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    ctx.fillStyle = "#000000";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.filter = "none";
    let error = null;
    if (compiled.error) {
      error = compiled.error;
    } else {
      try {
        compiled.fn(ctx, wrap(t), makeStage(ctx, info));
      } catch (e) {
        error = describeError(e, compiled.sharedLines);
      }
    }
    ctx.restore();
    if (error) drawErrorBadge(ctx, w, h, scale);
    return error;
  }

  function drawErrorBadge(ctx, w, h, scale) {
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = Math.max(4, w * 0.01);
    ctx.setLineDash([w * 0.03, w * 0.03]);
    ctx.strokeRect(w * 0.05, w * 0.05, w * 0.9, h - w * 0.1);
    ctx.restore();
  }

  F.EASE = EASE;
  F.ENTRANCES = ENTRANCES;
  F.compile = compile;
  F.render = render;
  F.makeStage = makeStage;
})();
