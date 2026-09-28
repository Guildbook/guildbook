import { crc32, deflateSync, inflateSync } from "node:zlib";
import { crestToneLut } from "@/lib/tabard/crest-tone";

/**
 * Tints Blizzard's grayscale emblem masks (public/tabard, 8-bit grayscale plus alpha PNGs from `pnpm emblems:fetch`)
 * into RGBA PNGs on the same tone curve as the browser (lib/tabard/crest-tone.ts), for images drawn on the server or
 * by scripts: satori and resvg can't apply CSS filters or load external images, so they embed a tinted data URI.
 */

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export interface GrayAlpha {
  width: number;
  height: number;
  /** Two bytes per pixel: gray, alpha. */
  pixels: Uint8Array;
}

function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Decodes a non-interlaced 8-bit grayscale plus alpha PNG (the only kind the fetch script writes). */
export function decodeGrayAlpha(png: Buffer): GrayAlpha {
  if (!png.subarray(0, 8).equals(SIGNATURE)) throw new Error("Not a PNG");
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    const type = png.toString("latin1", at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const [depth, colorType, , , interlace] = data.subarray(8, 13);
      if (depth !== 8 || colorType !== 4 || interlace !== 0) throw new Error("Expected an 8-bit grayscale plus alpha PNG");
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 2;
  const stride = width * bpp;
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? pixels[row + x - bpp]! : 0;
      const b = y > 0 ? pixels[row - stride + x]! : 0;
      const c = x >= bpp && y > 0 ? pixels[row - stride + x - bpp]! : 0;
      const v = raw[src + x]!;
      const predicted = filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : filter === 4 ? paeth(a, b, c) : 0;
      pixels[row + x] = (v + predicted) & 255;
    }
  }
  return { width, height, pixels };
}

function chunk(type: string, data: Buffer) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** Encodes RGBA pixels as a PNG (no row filters; the masks are small). */
export function encodeRgba(width: number, height: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  return Buffer.concat([SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** Tints a grayscale plus alpha mask with `hex` on the shared tone curve (as the browser filter does), as RGBA. */
export function tintPixels(mask: GrayAlpha, hex: string): Uint8Array {
  const [r, g, b] = crestToneLut(hex);
  const out = new Uint8Array(mask.width * mask.height * 4);
  for (let i = 0, j = 0; i < mask.pixels.length; i += 2, j += 4) {
    const v = mask.pixels[i]!;
    out[j] = r[v]!;
    out[j + 1] = g[v]!;
    out[j + 2] = b[v]!;
    out[j + 3] = mask.pixels[i + 1]!;
  }
  return out;
}

/** A mask PNG tinted with `hex`, as a PNG data URI. */
export const tintedDataUri = (png: Buffer, hex: string) => {
  const mask = decodeGrayAlpha(png);
  return `data:image/png;base64,${encodeRgba(mask.width, mask.height, tintPixels(mask, hex)).toString("base64")}`;
};
