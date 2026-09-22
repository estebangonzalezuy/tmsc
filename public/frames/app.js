// The app: state, the slide rail, the stage and transport, the editor, files
// and links, and the export buttons. Plain DOM; no framework.
(function () {
  const F = window.FRAMES;
  const STORAGE_KEY = "frames.post";
  const $ = (id) => document.getElementById(id);

  /* ------------------------------------------------------------ state -- */

  let state = null; // { v, name, format, seconds, fps, shared, slides: [{ id, name, code }] }
  let current = 0; // index of the selected slide
  let tab = "options"; // "options" | "code" | "shared"
  let declared = []; // the current slide's declared options, from its last stage draw
  let declaredSig = ""; // so the panel is rebuilt only when the declarations change
  let playing = false;
  let head = 0; // loop progress 0..1
  let lastNow = 0;
  let lastThumbs = 0;
  let exporting = null; // AbortController while an export runs
  const compiled = new Map(); // slide id → { key, result }

  const uid = () => Math.random().toString(36).slice(2, 9);

  function freshPost() {
    const starter = F.STARTERS.find((s) => s.id === "headline");
    return {
      v: 1,
      name: "untitled",
      format: F.DEFAULT_FORMAT,
      seconds: 6,
      fps: 30,
      shared: F.SHARED_DEFAULT,
      slides: [{ id: uid(), name: starter.name, code: starter.code, opts: {} }],
    };
  }

  function carouselPost() {
    return {
      v: 1,
      name: "carousel",
      format: "portrait",
      seconds: 6,
      fps: 30,
      shared: F.SHARED_DEFAULT,
      slides: F.CAROUSEL.map((s) => ({ id: uid(), name: s.name, code: s.code, opts: Object.assign({}, s.opts || {}) })),
    };
  }

  // Accepts anything and returns a valid post, so a bad link or file can't
  // wedge the app.
  function normalize(raw) {
    const p = raw && typeof raw === "object" ? raw : {};
    const format = F.FORMATS[p.format] ? p.format : F.DEFAULT_FORMAT;
    const seconds = Number(p.seconds) > 0 ? Math.min(60, Number(p.seconds)) : 6;
    const fps = [24, 30, 60].includes(Number(p.fps)) ? Number(p.fps) : 30;
    const slides = Array.isArray(p.slides)
      ? p.slides
          .filter((s) => s && typeof s === "object")
          .map((s, i) => ({
            id: typeof s.id === "string" ? s.id : uid(),
            name: typeof s.name === "string" ? s.name : `Slide ${i + 1}`,
            code: typeof s.code === "string" ? s.code : "",
            opts: s.opts && typeof s.opts === "object" ? Object.assign({}, s.opts) : {},
          }))
      : [];
    if (!slides.length) slides.push({ id: uid(), name: "Slide 1", code: "", opts: {} });
    return {
      v: 1,
      name: typeof p.name === "string" && p.name.trim() ? p.name : "untitled",
      format,
      seconds,
      fps,
      shared: typeof p.shared === "string" ? p.shared : F.SHARED_DEFAULT,
      slides,
    };
  }

  const fmt = () => F.FORMATS[state.format];
  const slide = () => state.slides[current];
  const slug = (s) =>
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "post";
  const pad2 = (n) => String(n).padStart(2, "0");

  /* ---------------------------------------------------------- persist -- */

  function encode(post) {
    const json = JSON.stringify(post);
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  function decode(str) {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  }
  const hashPost = () => /[#&]p=([A-Za-z0-9_-]+)/.exec(location.hash);

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* private mode, full, or blocked: the session still works */
    }
  }

  function load() {
    const m = hashPost();
    if (m) {
      try {
        return normalize(decode(m[1]));
      } catch (e) {
        console.warn("Bad link, ignoring", e);
      }
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) {
      /* fall through */
    }
    return freshPost();
  }

  /* ---------------------------------------------------------- compile -- */

  function compiledFor(s) {
    const key = JSON.stringify([state.shared, s.code]);
    const hit = compiled.get(s.id);
    if (hit && hit.key === key) return hit.result;
    const result = F.compile(state.shared, s.code);
    compiled.set(s.id, { key, result });
    return result;
  }

  // Draw slide `index` at loop progress `t` into ctx at `scale`. With
  // `declare`, the slide's option declarations are collected into it.
  function drawSlide(ctx, index, t, scale, frame, declare) {
    const s = state.slides[index];
    const { w, h } = fmt();
    const info = {
      w,
      h,
      seconds: state.seconds,
      fps: state.fps,
      frame: frame == null ? Math.floor(t * state.seconds * state.fps) : frame,
      index,
      count: state.slides.length,
      opts: s.opts || {},
      declare,
    };
    return F.render(ctx, compiledFor(s), t, info, scale);
  }

  /* ------------------------------------------------------------ stage -- */

  const stage = $("stage");
  const stageCtx = stage.getContext("2d");
  const stageWrap = $("stage-wrap");
  let stageScale = 1;

  function fitStage() {
    const { w, h } = fmt();
    const box = stageWrap.getBoundingClientRect();
    const pad = 32;
    const css = Math.max(0.05, Math.min((box.width - pad) / w, (box.height - pad) / h));
    const dpr = window.devicePixelRatio || 1;
    stage.style.width = Math.round(w * css) + "px";
    stage.style.height = Math.round(h * css) + "px";
    stage.width = Math.round(w * css * dpr);
    stage.height = Math.round(h * css * dpr);
    stageScale = stage.width / w;
    drawStage();
  }

  function drawStage() {
    const declare = [];
    const error = drawSlide(stageCtx, current, head, stageScale, null, declare);
    showError(error);
    updateReadout();
    declared = declare;
    syncOptions();
  }

  function updateReadout() {
    const frame = Math.floor(head * state.seconds * state.fps);
    $("readout").textContent = `${(head * state.seconds).toFixed(2)}s · t ${head.toFixed(3)} · f ${frame}`;
    if (document.activeElement !== $("scrub")) $("scrub").value = Math.round(head * 1000);
  }

  function tick(now) {
    if (playing) {
      const dt = Math.min(0.1, (now - lastNow) / 1000);
      head = (head + dt / state.seconds) % 1;
      drawStage();
      if (now - lastThumbs > 250) {
        drawThumbs();
        lastThumbs = now;
      }
    }
    lastNow = now;
    requestAnimationFrame(tick);
  }

  function setPlaying(on) {
    playing = on;
    $("btn-play").textContent = on ? "Pause" : "Play";
    if (on) lastNow = performance.now();
  }

  /* ------------------------------------------------------------- rail -- */

  const rail = $("slides");

  function renderRail() {
    rail.innerHTML = "";
    state.slides.forEach((s, i) => {
      const li = document.createElement("li");
      li.className = "slide" + (i === current ? " on" : "");
      li.dataset.index = i;
      const canvas = document.createElement("canvas");
      const { w, h } = fmt();
      const tw = 150;
      canvas.width = tw;
      canvas.height = Math.round((h / w) * tw);
      li.appendChild(canvas);
      const name = document.createElement("div");
      name.className = "slide-name";
      const label = document.createElement("span");
      label.textContent = s.name || `Slide ${i + 1}`;
      const num = document.createElement("span");
      num.className = "muted";
      num.textContent = String(i + 1);
      name.append(label, num);
      li.appendChild(name);
      li.addEventListener("click", () => select(i));
      rail.appendChild(li);
    });
    drawThumbs();
  }

  function drawThumbs() {
    const { w } = fmt();
    rail.querySelectorAll("li").forEach((li) => {
      const i = Number(li.dataset.index);
      const canvas = li.querySelector("canvas");
      const error = drawSlide(canvas.getContext("2d"), i, head, canvas.width / w);
      li.classList.toggle("bad", !!error);
    });
  }

  function select(i) {
    applyEditor();
    current = Math.max(0, Math.min(state.slides.length - 1, i));
    rail.querySelectorAll("li").forEach((li) => li.classList.toggle("on", Number(li.dataset.index) === current));
    loadEditor();
    drawStage();
  }

  /* ----------------------------------------------------------- editor -- */

  const code = $("code");
  const slideName = $("slide-name");

  function loadEditor() {
    const opts = $("options");
    opts.hidden = tab !== "options";
    code.hidden = tab === "options";
    $("btn-reset").hidden = tab !== "options";
    if (tab === "shared") {
      code.value = state.shared;
      slideName.value = "";
      slideName.disabled = true;
      $("signature").textContent = "// shared — runs before every slide";
      $("closer").textContent = "";
    } else {
      code.value = slide().code;
      slideName.value = slide().name;
      slideName.disabled = false;
      $("signature").textContent = tab === "code" ? "function (ctx, t, s) {" : "what this slide lets you change";
      $("closer").textContent = tab === "code" ? "}" : "";
    }
    if (tab === "options") {
      declaredSig = "";
      syncOptions();
    }
    showError(null);
  }

  /* ---------------------------------------------------------- options -- */

  // Rebuilds the Options panel from the current slide's declarations, only
  // when the set of declarations changes, so a control keeps focus while
  // it is being used.
  function syncOptions() {
    if (tab !== "options") return;
    const sig = JSON.stringify(declared.map((d) => [d.key, d.kind, d.choices, d.min, d.max, d.multi])) + "|" + slide().id;
    if (sig === declaredSig) {
      refreshOptionValues();
      return;
    }
    declaredSig = sig;
    const panel = $("options");
    panel.innerHTML = "";
    if (!declared.length) {
      const p = document.createElement("div");
      p.className = "opt-empty";
      p.innerHTML =
        "This slide declares no options yet. In its code, ask for a value with " +
        "<code>s.color(\"Ink\", \"#000000\")</code>, <code>s.text(\"Headline\", \"…\")</code>, " +
        "<code>s.range(\"Shake\", 0.3, 0, 1)</code>, <code>s.pick(\"Entrance\", \"rise\", s.ENTRANCES)</code> " +
        "or <code>s.toggle(\"Footer\", true)</code> and a control appears here.";
      panel.appendChild(p);
      return;
    }
    declared.forEach((d) => {
      const label = document.createElement("div");
      label.className = "opt-label";
      label.textContent = d.key;
      label.title = d.key;
      const cell = document.createElement("div");
      cell.className = "opt";
      cell.dataset.key = d.key;
      cell.appendChild(controlFor(d));
      panel.append(label, cell);
    });
  }

  const valueOf = (d) => (slide().opts && slide().opts[d.key] != null ? slide().opts[d.key] : d.def);

  function setOption(key, value) {
    if (!slide().opts) slide().opts = {};
    slide().opts[key] = value;
    save();
    drawStage();
    drawThumbs();
  }

  function controlFor(d) {
    const frag = document.createDocumentFragment();
    const v = valueOf(d);
    if (d.kind === "color") {
      const input = document.createElement("input");
      input.type = "color";
      input.value = /^#[0-9a-f]{6}$/i.test(v) ? v : "#000000";
      input.addEventListener("input", () => setOption(d.key, input.value));
      frag.appendChild(input);
      const row = document.createElement("div");
      row.className = "swatches";
      (F.SWATCHES || []).forEach((hex) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "swatch" + (hex.toLowerCase() === String(v).toLowerCase() ? " on" : "");
        b.style.background = hex;
        b.title = hex;
        b.addEventListener("click", () => setOption(d.key, hex));
        row.appendChild(b);
      });
      frag.appendChild(row);
    } else if (d.kind === "range") {
      const input = document.createElement("input");
      input.type = "range";
      input.min = d.min;
      input.max = d.max;
      input.step = d.step;
      input.value = v;
      const val = document.createElement("span");
      val.className = "val";
      val.textContent = Number(v).toFixed(2).replace(/\.?0+$/, "");
      input.addEventListener("input", () => setOption(d.key, Number(input.value)));
      frag.append(input, val);
    } else if (d.kind === "pick") {
      const sel = document.createElement("select");
      d.choices.forEach((c) => {
        const o = document.createElement("option");
        o.value = c;
        o.textContent = c;
        sel.appendChild(o);
      });
      sel.value = v;
      sel.addEventListener("change", () => setOption(d.key, sel.value));
      frag.appendChild(sel);
    } else if (d.kind === "toggle") {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!v;
      input.addEventListener("change", () => setOption(d.key, input.checked));
      frag.appendChild(input);
    } else {
      const input = document.createElement(d.multi ? "textarea" : "input");
      if (!d.multi) input.type = "text";
      input.value = v;
      input.spellcheck = false;
      input.addEventListener("input", () => setOption(d.key, input.value));
      frag.appendChild(input);
    }
    return frag;
  }

  // Updates control values in place (after Reset, or when the slide's own
  // defaults changed), without rebuilding.
  function refreshOptionValues() {
    declared.forEach((d) => {
      const cell = $("options").querySelector(`.opt[data-key="${CSS.escape(d.key)}"]`);
      if (!cell) return;
      const v = valueOf(d);
      if (d.kind === "color") {
        const input = cell.querySelector("input[type=color]");
        if (input && document.activeElement !== input && /^#[0-9a-f]{6}$/i.test(v)) input.value = v;
        cell.querySelectorAll(".swatch").forEach((b) => b.classList.toggle("on", b.title.toLowerCase() === String(v).toLowerCase()));
      } else if (d.kind === "range") {
        const input = cell.querySelector("input[type=range]");
        if (input && document.activeElement !== input) input.value = v;
        const val = cell.querySelector(".val");
        if (val) val.textContent = Number(v).toFixed(2).replace(/\.?0+$/, "");
      } else if (d.kind === "pick") {
        const sel = cell.querySelector("select");
        if (sel && document.activeElement !== sel) sel.value = v;
      } else if (d.kind === "toggle") {
        const input = cell.querySelector("input[type=checkbox]");
        if (input) input.checked = !!v;
      } else {
        const input = cell.querySelector("textarea, input");
        if (input && document.activeElement !== input) input.value = v;
      }
    });
  }

  $("btn-reset").addEventListener("click", () => {
    slide().opts = {};
    save();
    drawStage();
    drawThumbs();
  });

  function showError(err) {
    const el = $("error");
    el.textContent = err ? (err.where ? err.where + ": " : "") + err.message : "";
  }

  let applyTimer = 0;
  let dirty = false;
  function applyEditor() {
    clearTimeout(applyTimer);
    if (!dirty) return;
    dirty = false;
    if (tab === "code") slide().code = code.value;
    else if (tab === "shared") state.shared = code.value;
    save();
    drawStage();
    drawThumbs();
  }

  code.addEventListener("input", () => {
    dirty = true;
    clearTimeout(applyTimer);
    applyTimer = setTimeout(applyEditor, 250);
  });

  code.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      dirty = true;
      applyEditor();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const start = code.selectionStart;
      const end = code.selectionEnd;
      if (e.shiftKey) {
        const lineStart = code.value.lastIndexOf("\n", start - 1) + 1;
        if (code.value.slice(lineStart, lineStart + 2) === "  ") {
          code.setRangeText("", lineStart, lineStart + 2, "end");
          code.selectionStart = Math.max(lineStart, start - 2);
          code.selectionEnd = Math.max(lineStart, end - 2);
        }
      } else {
        code.setRangeText("  ", start, end, "end");
      }
      code.dispatchEvent(new Event("input"));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const start = code.selectionStart;
      const lineStart = code.value.lastIndexOf("\n", start - 1) + 1;
      const indent = /^[ \t]*/.exec(code.value.slice(lineStart, start))[0];
      const before = code.value.slice(0, start).trimEnd();
      const extra = /[{([]$/.test(before) ? "  " : "";
      code.setRangeText("\n" + indent + extra, start, code.selectionEnd, "end");
      code.dispatchEvent(new Event("input"));
    }
  });

  slideName.addEventListener("input", () => {
    slide().name = slideName.value;
    const label = rail.querySelector(`li[data-index="${current}"] .slide-name span`);
    if (label) label.textContent = slideName.value || `Slide ${current + 1}`;
    save();
  });

  const tabButtons = Array.from(document.querySelectorAll(".tabs [data-tab]"));
  function setTab(name) {
    applyEditor();
    tab = name;
    tabButtons.forEach((x) => x.classList.toggle("on", x.dataset.tab === name));
    loadEditor();
  }
  tabButtons.forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));

  /* ----------------------------------------------------------- header -- */

  const formatSel = $("format");
  Object.keys(F.FORMATS).forEach((id) => {
    const f = F.FORMATS[id];
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = `${f.label} · ${f.w}×${f.h} · ${f.hint}`;
    formatSel.appendChild(opt);
  });

  function loadHeader() {
    $("post-name").value = state.name;
    formatSel.value = state.format;
    $("seconds").value = state.seconds;
    $("fps").value = String(state.fps);
  }

  $("post-name").addEventListener("input", () => {
    state.name = $("post-name").value;
    save();
  });
  formatSel.addEventListener("change", () => {
    state.format = formatSel.value;
    save();
    renderRail();
    fitStage();
  });
  $("seconds").addEventListener("change", () => {
    const v = Number($("seconds").value);
    state.seconds = v > 0 ? Math.min(60, v) : 6;
    $("seconds").value = state.seconds;
    save();
    drawStage();
  });
  $("fps").addEventListener("change", () => {
    state.fps = Number($("fps").value);
    save();
    drawStage();
  });

  function replacePost(post) {
    dirty = false;
    state = normalize(post);
    compiled.clear();
    current = 0;
    head = 0;
    tab = "options";
    tabButtons.forEach((x) => x.classList.toggle("on", x.dataset.tab === "options"));
    save();
    loadHeader();
    renderRail();
    loadEditor();
    fitStage();
  }

  $("btn-new").addEventListener("click", () => {
    if (confirm("Start a fresh post? The current one stays only if you saved it or copied its link.")) {
      replacePost(freshPost());
    }
  });
  $("btn-carousel").addEventListener("click", () => {
    if (confirm("Replace this post with the carousel starter (five slides)?")) replacePost(carouselPost());
  });

  $("btn-save").addEventListener("click", () => {
    applyEditor();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    F.download(blob, `${slug(state.name)}.frames.json`);
  });
  $("btn-open").addEventListener("click", () => $("file").click());
  $("file").addEventListener("change", async () => {
    const file = $("file").files[0];
    $("file").value = "";
    if (!file) return;
    try {
      replacePost(JSON.parse(await file.text()));
    } catch (e) {
      alert("That file is not a Frames post: " + e.message);
    }
  });

  $("btn-link").addEventListener("click", async () => {
    applyEditor();
    const url = location.href.split("#")[0] + "#p=" + encode(state);
    history.replaceState(null, "", url);
    try {
      await navigator.clipboard.writeText(url);
      flash($("btn-link"), "Copied");
    } catch (e) {
      flash($("btn-link"), "In the URL bar");
    }
  });

  function flash(button, text) {
    const was = button.textContent;
    button.textContent = text;
    setTimeout(() => (button.textContent = was), 1200);
  }

  /* -------------------------------------------------------- slide ops -- */

  const starterSel = $("starter");
  F.STARTERS.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.label;
    starterSel.appendChild(opt);
  });
  starterSel.addEventListener("change", () => {
    const st = F.STARTERS.find((s) => s.id === starterSel.value);
    starterSel.value = "";
    if (!st) return;
    applyEditor();
    state.slides.splice(current + 1, 0, { id: uid(), name: st.name, code: st.code, opts: {} });
    save();
    renderRail();
    select(current + 1);
  });

  $("btn-dup").addEventListener("click", () => {
    applyEditor();
    const s = slide();
    state.slides.splice(current + 1, 0, { id: uid(), name: s.name + " copy", code: s.code, opts: Object.assign({}, s.opts || {}) });
    save();
    renderRail();
    select(current + 1);
  });
  $("btn-del").addEventListener("click", () => {
    if (state.slides.length === 1) {
      alert("A post needs at least one slide.");
      return;
    }
    if (!confirm(`Delete "${slide().name || "this slide"}"?`)) return;
    dirty = false;
    state.slides.splice(current, 1);
    save();
    renderRail();
    select(Math.min(current, state.slides.length - 1));
  });
  function move(delta) {
    const to = current + delta;
    if (to < 0 || to >= state.slides.length) return;
    applyEditor();
    const [s] = state.slides.splice(current, 1);
    state.slides.splice(to, 0, s);
    save();
    renderRail();
    select(to);
  }
  $("btn-up").addEventListener("click", () => move(-1));
  $("btn-down").addEventListener("click", () => move(1));

  /* -------------------------------------------------------- transport -- */

  $("btn-play").addEventListener("click", () => setPlaying(!playing));
  $("scrub").addEventListener("input", () => {
    setPlaying(false);
    head = Number($("scrub").value) / 1000;
    drawStage();
    drawThumbs();
  });

  document.addEventListener("keydown", (e) => {
    const el = document.activeElement;
    const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
    if (typing || $("help").open) return;
    if (e.key === " ") {
      e.preventDefault();
      setPlaying(!playing);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setPlaying(false);
      const step = 1 / (state.seconds * state.fps);
      head = (head + (e.key === "ArrowRight" ? step : -step) + 1) % 1;
      drawStage();
      drawThumbs();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      select(current + (e.key === "ArrowDown" ? 1 : -1));
    }
  });

  /* ----------------------------------------------------------- export -- */

  const status = $("export-status");
  const exportButtons = ["btn-png", "btn-png-all", "btn-video", "btn-reel"].map($);

  function setExporting(on) {
    exportButtons.forEach((b) => (b.disabled = on));
    $("btn-cancel").hidden = !on;
  }

  const fullDraw = (ctx, index, t, frame) => drawSlide(ctx, index, t, 1, frame);
  const fontsReady = () => (document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => null) : Promise.resolve());
  const frameOfHead = () => Math.floor(head * state.seconds * state.fps);

  $("btn-png").addEventListener("click", async () => {
    applyEditor();
    await fontsReady();
    const { w, h } = fmt();
    const blob = await F.renderPng({ w, h, draw: fullDraw, slideIndex: current, t: head, frame: frameOfHead() });
    F.download(blob, `${slug(state.name)}-${pad2(current + 1)}.png`);
    status.textContent = `PNG · ${w}×${h}`;
  });

  $("btn-png-all").addEventListener("click", async () => {
    applyEditor();
    await fontsReady();
    const { w, h } = fmt();
    setExporting(true);
    for (let i = 0; i < state.slides.length; i++) {
      status.textContent = `PNG ${i + 1} / ${state.slides.length}`;
      const blob = await F.renderPng({ w, h, draw: fullDraw, slideIndex: i, t: head, frame: frameOfHead() });
      F.download(blob, `${slug(state.name)}-${pad2(i + 1)}.png`);
      await new Promise((r) => setTimeout(r, 400)); // browsers throttle back-to-back downloads
    }
    status.textContent = `${state.slides.length} PNGs · ${w}×${h}`;
    setExporting(false);
  });

  async function record(indices, filename) {
    applyEditor();
    if (!F.pickMime()) {
      alert("This browser cannot record video. Chrome or Edge can.");
      return;
    }
    await fontsReady();
    const wasPlaying = playing;
    setPlaying(false);
    setExporting(true);
    exporting = new AbortController();
    const { w, h } = fmt();
    try {
      const { blob, mime } = await F.recordVideo({
        w,
        h,
        fps: state.fps,
        seconds: state.seconds,
        slides: indices,
        draw: fullDraw,
        signal: exporting.signal,
        onProgress: (p) => (status.textContent = `Recording ${Math.round(p * 100)}%`),
      });
      if (exporting.signal.aborted) {
        status.textContent = "Cancelled";
      } else {
        const ext = F.extensionFor(mime);
        F.download(blob, `${filename}.${ext}`);
        const total = (state.seconds * indices.length).toFixed(1);
        status.textContent = `${ext.toUpperCase()} · ${w}×${h} · ${state.fps} fps · ${total}s`;
      }
    } catch (e) {
      status.textContent = "Export failed: " + e.message;
    } finally {
      exporting = null;
      setExporting(false);
      setPlaying(wasPlaying);
    }
  }

  $("btn-video").addEventListener("click", () => record([current], `${slug(state.name)}-${pad2(current + 1)}`));
  $("btn-reel").addEventListener("click", () =>
    record(
      state.slides.map((_, i) => i),
      `${slug(state.name)}-reel`,
    ),
  );
  $("btn-cancel").addEventListener("click", () => exporting && exporting.abort());

  /* ------------------------------------------------------------- help -- */

  $("btn-help").addEventListener("click", () => $("help").showModal());
  $("btn-help-close").addEventListener("click", () => $("help").close());

  /* ------------------------------------------------------------- boot -- */

  state = load();
  loadHeader();
  renderRail();
  loadEditor();
  fitStage();
  new ResizeObserver(fitStage).observe(stageWrap);
  window.addEventListener("hashchange", () => {
    const m = hashPost();
    if (!m) return;
    try {
      replacePost(decode(m[1]));
    } catch (e) {
      /* ignore a bad hash */
    }
  });
  setPlaying(true);
  requestAnimationFrame(tick);

  // Canvas text does not trigger a web font's download by itself, so ask
  // for every face the starters use, then redraw once they are in.
  if (document.fonts && document.fonts.load) {
    const faces = [];
    ["Archivo", "Lora"].forEach((family) =>
      ["400", "700", "900", "italic 400", "italic 700", "condensed 700", "condensed 900"].forEach((face) => faces.push(`${face} 16px ${family}`)),
    );
    Promise.all(faces.map((f) => document.fonts.load(f).catch(() => null))).then(() => {
      drawStage();
      drawThumbs();
    });
  }

  // For a script driving the page (tests), not for slides.
  F.app = {
    get state() {
      return state;
    },
    get head() {
      return head;
    },
    set head(v) {
      head = v;
      drawStage();
      drawThumbs();
    },
    replacePost,
    select,
    setPlaying,
    setTab,
  };
})();
