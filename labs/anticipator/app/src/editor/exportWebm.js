// In-browser WebM export, frame by frame. Every frame is rendered by
// renderProject at an exact time (t = i / fps), pushed with requestFrame()
// on a captureStream(0) track, and paced at the frame interval so
// MediaRecorder's wall-clock timestamps line up. Nothing is screen-captured.
//
// For byte-exact frames use the CLI (npm run export), which renders PNGs
// through the same renderProject and encodes with ffmpeg.

import { renderProject, projectDuration } from "@core/render.js";

function pickMime() {
  for (const m of ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

export async function exportWebm(project, specs, { onProgress } = {}) {
  const mime = pickMime();
  if (!mime) throw new Error("MediaRecorder WebM isn't supported in this browser. Use npm run export.");
  const canvas = document.createElement("canvas");
  canvas.width = project.width;
  canvas.height = project.height;
  const ctx = canvas.getContext("2d");
  const fps = project.fps || 30;
  const total = projectDuration(project);
  const frames = Math.ceil((total / 1000) * fps);
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  renderProject(ctx, project, specs, 0);
  rec.start();
  const frameMs = 1000 / fps;
  const t0 = performance.now();
  for (let i = 0; i <= frames; i++) {
    renderProject(ctx, project, specs, Math.min(total, i * frameMs));
    track.requestFrame();
    onProgress?.(i / frames);
    const wait = t0 + (i + 1) * frameMs - performance.now();
    await new Promise((r) => setTimeout(r, Math.max(0, wait)));
  }
  rec.stop();
  await done;
  return new Blob(chunks, { type: "video/webm" });
}
