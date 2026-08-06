// Minimal animated GIF89a encoder. Posts are two-tone or drawn from a small
// palette, so a table of grays plus the colours actually in play encodes
// frames with no real quantization step — no ffmpeg payload needed for a
// format this simple.

import { PALETTE } from "@/lib/postlab";

class BitWriter {
  bytes: number[] = [];
  private cur = 0;
  private bits = 0;

  write(code: number, size: number) {
    this.cur |= code << this.bits;
    this.bits += size;
    while (this.bits >= 8) {
      this.bytes.push(this.cur & 0xff);
      this.cur >>= 8;
      this.bits -= 8;
    }
  }

  finish() {
    if (this.bits > 0) this.bytes.push(this.cur & 0xff);
  }
}

/* Standard GIF LZW with a 12-bit code limit and table reset. */
function lzwEncode(indices: Uint8Array): number[] {
  const minCodeSize = 8;
  const clear = 1 << minCodeSize; // 256
  const eoi = clear + 1; // 257
  const out = new BitWriter();

  let dict = new Map<number, number>();
  let next = eoi + 1;
  let codeSize = minCodeSize + 1;
  const reset = () => {
    dict = new Map();
    next = eoi + 1;
    codeSize = minCodeSize + 1;
  };

  out.write(clear, codeSize);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const c = indices[i];
    const key = (prefix << 8) | c;
    const hit = dict.get(key);
    if (hit !== undefined) {
      prefix = hit;
      continue;
    }
    out.write(prefix, codeSize);
    if (next < 4096) {
      dict.set(key, next);
      if (next === 1 << codeSize && codeSize < 12) codeSize++;
      next++;
    } else {
      out.write(clear, codeSize);
      reset();
    }
    prefix = c;
  }
  out.write(prefix, codeSize);
  out.write(eoi, codeSize);
  out.finish();
  return out.bytes;
}

/* 128 grays — the monochrome case stays effectively lossless — then the
   colours actually in play plus each mixed halfway to black and to white, so
   anti-aliased edges have somewhere to land. Built per encode, because a
   slide may override the club palette. */
function buildTable(palette: readonly string[]): [number, number, number][] {
  const table: [number, number, number][] = [];
  for (let i = 0; i < 128; i++) {
    const v = Math.round((i * 255) / 127);
    table.push([v, v, v]);
  }
  const mix = (c: number, t: number, k: number) => Math.round(c + (t - c) * k);
  for (const hex of palette.length ? palette : PALETTE) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    for (const [target, k] of [
      [0, 0],
      [0, 0.5],
      [255, 0.5],
    ] as const) {
      table.push([mix(r, target, k), mix(g, target, k), mix(b, target, k)]);
    }
  }
  while (table.length < 256) table.push([0, 0, 0]);
  return table.slice(0, 256);
}

export class GifEncoder {
  private parts: number[] = [];

  private table: [number, number, number][];
  /* The source only ever holds a handful of distinct colours, so caching the
     nearest-entry lookup makes it cheap across every pixel of every frame. */
  private cache = new Map<number, number>();

  constructor(
    private w: number,
    private h: number,
    /** Frame delay in hundredths of a second. */
    private delay: number,
    /** Colours in play; empty means the club palette. */
    palette: readonly string[] = PALETTE,
  ) {
    this.table = buildTable(palette);
    const p = this.parts;
    // header + logical screen descriptor with a global 256-color table
    for (const ch of "GIF89a") p.push(ch.charCodeAt(0));
    p.push(w & 0xff, w >> 8, h & 0xff, h >> 8, 0xf7, 0, 0);
    for (const [r, g, b] of this.table) p.push(r, g, b);
    // NETSCAPE2.0 loop-forever extension
    p.push(0x21, 0xff, 11);
    for (const ch of "NETSCAPE2.0") p.push(ch.charCodeAt(0));
    p.push(3, 1, 0, 0, 0);
  }

  private nearest(r: number, g: number, b: number): number {
    const key = (r << 16) | (g << 8) | b;
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < this.table.length; i++) {
      const [tr, tg, tb] = this.table[i];
      const d = (tr - r) ** 2 + (tg - g) ** 2 + (tb - b) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    this.cache.set(key, best);
    return best;
  }

  /** Add a frame from RGBA pixels, mapped to the nearest table entry. */
  addFrame(rgba: Uint8ClampedArray) {
    const { w, h, delay, parts: p } = this;
    const indices = new Uint8Array(w * h);
    for (let i = 0; i < indices.length; i++) {
      const o = i * 4;
      indices[i] = this.nearest(rgba[o], rgba[o + 1], rgba[o + 2]);
    }
    // graphic control extension
    p.push(0x21, 0xf9, 4, 0, delay & 0xff, delay >> 8, 0, 0);
    // image descriptor (no local color table)
    p.push(0x2c, 0, 0, 0, 0, w & 0xff, w >> 8, h & 0xff, h >> 8, 0);
    // LZW data in ≤255-byte sub-blocks
    p.push(8);
    const data = lzwEncode(indices);
    for (let i = 0; i < data.length; i += 255) {
      const n = Math.min(255, data.length - i);
      p.push(n);
      for (let j = 0; j < n; j++) p.push(data[i + j]);
    }
    p.push(0);
  }

  toBlob(): Blob {
    this.parts.push(0x3b); // trailer
    return new Blob([new Uint8Array(this.parts)], { type: "image/gif" });
  }
}
