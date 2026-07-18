// Minimal animated GIF89a encoder. The Post Lab is strictly grayscale, so a
// fixed 256-gray global palette encodes frames losslessly with no
// quantization step — no ffmpeg payload needed for a format this simple.

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

export class GifEncoder {
  private parts: number[] = [];

  constructor(
    private w: number,
    private h: number,
    /** Frame delay in hundredths of a second. */
    private delay: number,
  ) {
    const p = this.parts;
    // header + logical screen descriptor with a global 256-color table
    for (const ch of "GIF89a") p.push(ch.charCodeAt(0));
    p.push(w & 0xff, w >> 8, h & 0xff, h >> 8, 0xf7, 0, 0);
    // global color table: 256 grays
    for (let i = 0; i < 256; i++) p.push(i, i, i);
    // NETSCAPE2.0 loop-forever extension
    p.push(0x21, 0xff, 11);
    for (const ch of "NETSCAPE2.0") p.push(ch.charCodeAt(0));
    p.push(3, 1, 0, 0, 0);
  }

  /** Add a frame from RGBA pixels (converted to gray via luminance). */
  addFrame(rgba: Uint8ClampedArray) {
    const { w, h, delay, parts: p } = this;
    const indices = new Uint8Array(w * h);
    for (let i = 0; i < indices.length; i++) {
      const o = i * 4;
      indices[i] =
        (rgba[o] * 299 + rgba[o + 1] * 587 + rgba[o + 2] * 114) / 1000;
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
