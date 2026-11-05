import { useEffect, useRef } from "react";

/**
 * Calls draw(nowMs) every animation frame while mounted. Drawing never goes
 * through React state: a re-render per frame is the mistake to avoid.
 */
export function useFrame(draw) {
  const ref = useRef(draw);
  ref.current = draw;
  useEffect(() => {
    let id;
    const tick = (now) => {
      ref.current(now);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
}

/** Size a canvas's backing store for crisp drawing; returns the 2D context. */
export function fitCanvas(canvas, w, h, dpr = Math.min(2, window.devicePixelRatio || 1)) {
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
