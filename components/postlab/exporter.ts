// Export pipeline: composites the slide's layer stack (shader / generative
// canvases with their blend modes and opacities) plus the overlay canvas
// into a full-resolution frame, then saves stills (PNG) or records the
// animation (MP4 where the browser supports it, WebM otherwise).

import {
  FORMATS,
  PALETTE,
  shaderDef,
  slideTones,
  type BlendMode,
  type PostSpec,
  type SlideSpec,
} from "@/lib/postlab";
import { drawOverlay, type Fonts } from "./overlay";
import { drawGenerative } from "./generative";
import { GifEncoder } from "./gif";

// CSS mix-blend-mode → canvas globalCompositeOperation (same names except
// "normal").
const compositeOp = (blend: BlendMode): GlobalCompositeOperation =>
  blend === "normal" ? "source-over" : blend;

/**
 * True when every layer is one the exporter can draw itself, at any moment
 * we name. That means the club's own forms renderer (and "plain", which
 * draws nothing) — the WebGL shader animates on its own clock inside its
 * own canvas, and the only way to record it is to watch it go past.
 *
 * When this holds, a recording is a function of the frame number rather
 * than of how busy the machine was: exactly `duration` seconds of frames,
 * starting at the top of the loop, at full export resolution. That is what
 * makes an exported reel loop instead of nearly looping.
 */
export const canRenderDirectly = (spec: PostSpec, index: number) =>
  spec.slides[index]?.layers.every(
    (l) => l.type === "none" || shaderDef(l.type).kind === "generative",
  ) ?? false;

/* One scratch canvas, reused: layers are composited one after another. */
let scratch: HTMLCanvasElement | null = null;
function scratchAt(w: number, h: number) {
  if (!scratch) scratch = document.createElement("canvas");
  if (scratch.width !== w) scratch.width = w;
  if (scratch.height !== h) scratch.height = h;
  return scratch;
}

/**
 * Composite the slide's stack. Pass `t` to draw the generative layers at
 * that exact second, at the target size, instead of copying whatever the
 * on-screen canvases happen to be showing.
 */
function drawLayers(
  ctx: CanvasRenderingContext2D,
  spec: PostSpec,
  index: number,
  layerCanvases: (HTMLCanvasElement | null)[],
  w: number,
  h: number,
  t?: number,
) {
  const slide = spec.slides[index];
  /* The layer canvases render at the base size; scaling them up must stay
     nearest-neighbour, or a dithered post exports as blurred mush instead
     of bigger, harder-edged blocks. */
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = slideTones(slide).bg;
  ctx.fillRect(0, 0, w, h);
  slide.layers.forEach((layer, i) => {
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = compositeOp(layer.blend);
    if (t !== undefined && shaderDef(layer.type).kind === "generative") {
      /* Drawn here at the full export size rather than blown up from the
         preview: the dither cell scales with the canvas, so the composition
         is identical and the edges are genuinely sharper. */
      const off = scratchAt(w, h);
      drawGenerative(off.getContext("2d")!, layer, slide.theme, t, spec.duration, w, h, {
        ink: layer.ink,
        seed: slide.colorSeed,
        palette: slide.palette,
        inks: layer.inks,
        mixMode: layer.mixMode,
        mixScale: layer.mixScale,
        mixSpeed: layer.mixSpeed,
      });
      ctx.drawImage(off, 0, 0);
      return;
    }
    const canvas = layerCanvases[i];
    if (canvas) {
      ctx.drawImage(canvas, 0, 0, w, h);
    } else {
      /* "plain" adds nothing — the background is already painted. */
    }
  });
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

/* Every colour a slide can actually put on screen: the palette it follows,
   its background, and whatever each layer was inked with. The GIF table is
   built from this, so a layer using three hand-picked colours — or a
   background outside the palette — still encodes as itself instead of being
   quantised to the nearest gray. */
function slideColours(slide: SlideSpec | undefined): string[] {
  if (!slide) return [];
  const seen = new Set<string>(slide.palette?.length ? slide.palette : PALETTE);
  if (slide.background) seen.add(slide.background);
  for (const layer of slide.layers) {
    if (layer.ink && layer.ink !== "mix") seen.add(layer.ink);
    for (const hex of layer.inks ?? []) seen.add(hex);
  }
  /* The table has room for 128 grays and three entries per colour. */
  return [...seen].slice(0, 40);
}

/**
 * Paint a slide's background stack at one instant, with nothing on screen
 * to copy from. Used for the sheets of generated candidates: each thumbnail
 * is a real render of the real spec, not an approximation of one.
 */
export const paintSlide = (
  ctx: CanvasRenderingContext2D,
  spec: PostSpec,
  index: number,
  w: number,
  h: number,
  t = 0,
) => drawLayers(ctx, spec, index, [], w, h, t);

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const slideName = (spec: PostSpec, index: number, base: string, ext: string) =>
  spec.slides.length > 1
    ? `${base}-${String(index + 1).padStart(2, "0")}.${ext}`
    : `${base}.${ext}`;

export function exportPng(
  spec: PostSpec,
  index: number,
  layerCanvases: (HTMLCanvasElement | null)[],
  overlay: HTMLCanvasElement,
  fonts: Fonts | null = null,
  scale = 1,
) {
  const base = FORMATS[spec.format];
  const w = Math.round(base.w * scale);
  const h = Math.round(base.h * scale);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  drawLayers(ctx, spec, index, layerCanvases, w, h);
  /* Redraw the type at the target size when we can; the preview overlay is
     only 1080 wide and would arrive soft. */
  if (fonts && scale !== 1) {
    const big = document.createElement("canvas");
    big.width = w;
    big.height = h;
    drawOverlay(big.getContext("2d")!, spec, index, fonts, 0, scale);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(big, 0, 0, w, h);
  } else {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(overlay, 0, 0, w, h);
  }
  out.toBlob((blob) => {
    if (blob) download(blob, slideName(spec, index, "tmsc-post", "png"));
  }, "image/png");
}

function pickMime(): { mime: string; ext: string } {
  const candidates: [string, string][] = [
    ["video/mp4;codecs=avc1", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [mime, ext] of candidates)
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime))
      return { mime, ext };
  return { mime: "", ext: "webm" };
}

/**
 * Record `spec.duration` seconds of the animated slide. The layer canvases
 * keep animating on their own; each frame we re-composite them (with blends)
 * under a freshly drawn overlay (so the orbit ring spins too).
 */
export function recordVideo(
  spec: PostSpec,
  index: number,
  layerCanvases: (HTMLCanvasElement | null)[],
  fonts: Fonts,
  onProgress: (fraction: number) => void,
  scale = 1,
): Promise<void> {
  const base = FORMATS[spec.format];
  const w = Math.round(base.w * scale);
  const h = Math.round(base.h * scale);
  const fps = 30;
  const durationMs = spec.duration * 1000;

  const overlay = document.createElement("canvas");
  overlay.width = w;
  overlay.height = h;
  const overlayCtx = overlay.getContext("2d")!;

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;

  const { mime, ext } = pickMime();
  // captureStream(0) + requestFrame(): frames are pushed explicitly after
  // each draw, which records reliably even when the canvas is off-DOM.
  const stream = out.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const recorder = new MediaRecorder(stream, {
    ...(mime ? { mimeType: mime } : {}),
    videoBitsPerSecond: 12_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  /* When we can draw the frames ourselves, the clip's content comes from
     the frame number, not from the clock: frame f is second f/fps of the
     loop, whatever the machine was doing. The pacing stays real-time
     because the muxer timestamps by wall clock, but a late frame no longer
     drags the animation with it — it just arrives late holding the right
     picture, and the last frame still lands one step short of the first. */
  const direct = canRenderDirectly(spec, index);
  const totalFrames = Math.max(1, Math.round(spec.duration * fps));

  return new Promise((resolve, reject) => {
    let raf = 0;
    let lastPush = -Infinity;
    let pushed = 0;
    const start = performance.now();

    recorder.onstop = () => {
      cancelAnimationFrame(raf);
      onProgress(0);
      const blob = new Blob(chunks, { type: mime || "video/webm" });
      if (!blob.size) {
        reject(new Error("Recorder produced no data"));
        return;
      }
      download(blob, slideName(spec, index, "tmsc-reel", ext));
      resolve();
    };
    recorder.onerror = () => reject(new Error("Recording failed"));

    // Frames are wall-clock timestamped by the muxer, so the clip length is
    // governed by elapsed time; pacing pushes to ≤30fps keeps the encoder
    // from being flooded (which silently drops frames).
    const frame = (now: number) => {
      const elapsed = now - start;
      if (now - lastPush >= 1000 / fps - 1) {
        lastPush = now;
        /* Frame time when we're drawing, wall-clock when we're only able to
           photograph a shader that runs itself. */
        const t = direct ? (pushed / totalFrames) * spec.duration : elapsed / 1000;
        drawOverlay(overlayCtx, spec, index, fonts, t, scale);
        drawLayers(ctx, spec, index, layerCanvases, w, h, direct ? t : undefined);
        ctx.drawImage(overlay, 0, 0, w, h);
        track.requestFrame();
        pushed++;
        onProgress(Math.min(1, direct ? pushed / totalFrames : elapsed / durationMs));
      }
      if (direct ? pushed >= totalFrames : elapsed >= durationMs) {
        recorder.stop();
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    // 1s timeslice makes the encoder flush as it goes instead of only at stop.
    recorder.start(1000);
    raf = requestAnimationFrame(frame);
  });
}

/**
 * Record `spec.duration` seconds as an animated GIF (grayscale palette,
 * half resolution, 12.5fps) — captured live like the video path, encoded
 * in-page with no external tooling.
 */
export function recordGif(
  spec: PostSpec,
  index: number,
  layerCanvases: (HTMLCanvasElement | null)[],
  fonts: Fonts,
  onProgress: (fraction: number) => void,
  scale = 1,
): Promise<void> {
  const base = FORMATS[spec.format];
  /* GIF weight grows with the square of the size and there is no
     inter-frame compression worth the name here, so the ceiling is 2x —
     past that a six-second loop runs to hundreds of megabytes. */
  const gifScale = Math.min(2, scale);
  const w = Math.round(base.w * gifScale);
  const h = Math.round(base.h * gifScale);
  const gw = Math.round(w / 2);
  const gh = Math.round(h / 2);
  const delay = 8; // hundredths of a second → 12.5fps
  const durationMs = spec.duration * 1000;

  const overlay = document.createElement("canvas");
  overlay.width = w;
  overlay.height = h;
  const overlayCtx = overlay.getContext("2d")!;

  const full = document.createElement("canvas");
  full.width = w;
  full.height = h;
  const fullCtx = full.getContext("2d")!;

  const small = document.createElement("canvas");
  small.width = gw;
  small.height = gh;
  const smallCtx = small.getContext("2d", { willReadFrequently: true })!;

  const gif = new GifEncoder(gw, gh, delay, slideColours(spec.slides[index]));

  /* A GIF carries its own frame delay, so nothing here has to happen in
     real time. When the exporter can draw the frames itself it renders them
     as fast as the machine allows, at exactly the right instants — which
     both loops properly and finishes a six-second post in well under six
     seconds. */
  const direct = canRenderDirectly(spec, index);
  const totalFrames = Math.max(1, Math.round((spec.duration * 100) / delay));

  if (direct) {
    return (async () => {
      for (let i = 0; i < totalFrames; i++) {
        const t = (i / totalFrames) * spec.duration;
        drawOverlay(overlayCtx, spec, index, fonts, t, gifScale);
        drawLayers(fullCtx, spec, index, layerCanvases, w, h, t);
        fullCtx.drawImage(overlay, 0, 0, w, h);
        smallCtx.drawImage(full, 0, 0, gw, gh);
        gif.addFrame(smallCtx.getImageData(0, 0, gw, gh).data);
        onProgress((i + 1) / totalFrames);
        // Let the page breathe so the progress line actually moves.
        if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
      }
      download(gif.toBlob(), slideName(spec, index, "tmsc-post", "gif"));
      onProgress(0);
    })();
  }

  return new Promise((resolve) => {
    let raf = 0;
    let lastPush = -Infinity;
    const start = performance.now();

    const frame = (now: number) => {
      const elapsed = now - start;
      if (now - lastPush >= delay * 10 - 1) {
        lastPush = now;
        drawOverlay(overlayCtx, spec, index, fonts, elapsed / 1000, gifScale);
        drawLayers(fullCtx, spec, index, layerCanvases, w, h);
        fullCtx.drawImage(overlay, 0, 0, w, h);
        smallCtx.drawImage(full, 0, 0, gw, gh);
        gif.addFrame(smallCtx.getImageData(0, 0, gw, gh).data);
        onProgress(Math.min(1, elapsed / durationMs));
      }
      if (elapsed >= durationMs) {
        download(gif.toBlob(), slideName(spec, index, "tmsc-post", "gif"));
        onProgress(0);
        resolve();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    void raf;
  });
}
