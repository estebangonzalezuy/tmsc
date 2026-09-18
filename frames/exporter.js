// Export: a PNG of one frame, or a video recorded frame by frame.
//
// A recording is produced by drawing every frame ourselves and asking the
// capture track for it — never by screen-capturing the preview — so the
// export is the same function as the preview, at full size, at exact
// instants. MediaRecorder stamps frames by the wall clock, so the draw
// loop paces itself to real time; exporting six seconds takes six seconds.
(function () {
  const F = window.FRAMES;

  function pickMime() {
    if (typeof MediaRecorder === "undefined") return null;
    const candidates = [
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || null;
  }

  function extensionFor(mime) {
    return /mp4/.test(mime || "") ? "mp4" : "webm";
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function fullCanvas(w, h) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }

  // `draw(ctx, slideIndex, t, frame)` is supplied by the app.
  function renderPng({ w, h, draw, slideIndex, t, frame }) {
    const canvas = fullCanvas(w, h);
    const ctx = canvas.getContext("2d");
    draw(ctx, slideIndex, t, frame);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Records `slides` (an array of slide indices) back to back, each for
  // `seconds` at `fps`. Resolves to { blob, mime }.
  async function recordVideo({ w, h, fps, seconds, slides, draw, onProgress, signal }) {
    const mime = pickMime();
    if (!mime) throw new Error("This browser cannot record video (no MediaRecorder).");

    const canvas = fullCanvas(w, h);
    const ctx = canvas.getContext("2d");
    const stream = canvas.captureStream(0);
    const track = stream.getVideoTracks()[0];
    const recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: Math.round(w * h * fps * 0.12),
    });
    const chunks = [];
    recorder.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
    const stopped = new Promise((resolve) => (recorder.onstop = resolve));

    const perSlide = Math.round(seconds * fps);
    const total = perSlide * slides.length;
    const frameMs = 1000 / fps;

    // First frame before start so the recording opens on a real picture.
    draw(ctx, slides[0], 0, 0);
    recorder.start();
    const started = performance.now();

    for (let i = 0; i < total; i++) {
      if (signal && signal.aborted) break;
      const slide = slides[Math.floor(i / perSlide)];
      const f = i % perSlide;
      draw(ctx, slide, f / perSlide, f);
      if (track.requestFrame) track.requestFrame();
      if (onProgress) onProgress((i + 1) / total);
      const due = started + (i + 1) * frameMs;
      await sleep(Math.max(0, due - performance.now()));
    }

    // Let the last frame land, then stop.
    await sleep(frameMs * 2);
    recorder.stop();
    await stopped;
    track.stop();
    return { blob: new Blob(chunks, { type: mime }), mime };
  }

  F.pickMime = pickMime;
  F.extensionFor = extensionFor;
  F.download = download;
  F.renderPng = renderPng;
  F.recordVideo = recordVideo;
})();
