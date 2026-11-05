import { useEffect, useRef } from "react";

/** Calls draw(now) every animation frame. Drawing never goes through React state. */
export function useFrame(draw: (now: number) => void): void {
  const ref = useRef(draw);
  ref.current = draw;
  useEffect(() => {
    let id = 0;
    const tick = (now: number) => {
      ref.current(now);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
}

/** Size a canvas's backing store for crisp drawing; returns its 2D context. */
export function fitCanvas(canvas: HTMLCanvasElement, w: number, h: number, dpr = Math.min(2, window.devicePixelRatio || 1)) {
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
