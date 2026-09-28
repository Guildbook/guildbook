/**
 * Colour maths for tabard theming: sRGB hex, OKLab/OKLCH (Björn Ottosson's perceptual space) and WCAG 2 contrast.
 * Lightness adjustments happen in OKLCH so a colour keeps its hue while it is darkened or lightened.
 */
export type Rgb = [number, number, number];
export interface Oklch {
  l: number;
  c: number;
  h: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function parseHex(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a hex colour: ${hex}`);
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(clamp01(c) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export function isHex(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function rgbToOklab([r, g, b]: Rgb): [number, number, number] {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab to sRGB, unclamped (components may fall outside 0 to 1 when the colour is out of gamut). */
export function oklabToRgb([L, a, b]: [number, number, number]): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export function toOklch(hex: string): Oklch {
  const [l, a, b] = rgbToOklab(parseHex(hex));
  const c = Math.hypot(a, b);
  const h = c < 1e-4 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { l, c, h };
}

const inGamut = (rgb: Rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** OKLCH to hex, reducing chroma (keeping lightness and hue) until the colour fits in sRGB. */
export function fromOklch({ l, c, h }: Oklch): string {
  const L = clamp01(l);
  const rad = (h * Math.PI) / 180;
  const at = (chroma: number) => oklabToRgb([L, chroma * Math.cos(rad), chroma * Math.sin(rad)]);
  let rgb = at(c);
  if (!inGamut(rgb)) {
    let [lo, hi] = [0, c];
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(at(mid))) lo = mid;
      else hi = mid;
    }
    rgb = at(lo);
  }
  return toHex(rgb);
}

/** The colour with its OKLCH lightness moved by `dl` (and chroma scaled by `chroma`). */
export function shiftLightness(hex: string, dl: number, chroma = 1): string {
  const c = toOklch(hex);
  return fromOklch({ l: c.l + dl, c: c.c * chroma, h: c.h });
}

/** WCAG 2 relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(toLinear) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Perceptual distance in OKLab (0 is identical; about 0.02 is barely noticeable; white to black is 1). */
export function deltaE(a: string, b: string): number {
  const [x, y] = [rgbToOklab(parseHex(a)), rgbToOklab(parseHex(b))];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

export interface ContrastRule {
  against: string;
  min: number;
}

/** The smallest contrast margin across `rules` (positive when every rule passes). */
const worstMargin = (hex: string, rules: ContrastRule[]) => Math.min(...rules.map((r) => contrast(hex, r.against) / r.min));

/**
 * Moves `hex` along OKLCH lightness (hue kept, chroma reduced only to stay in gamut) to the nearest lightness
 * that meets every contrast rule. `prefer` breaks ties and limits the search to one direction when set.
 * When no lightness satisfies every rule, returns the one with the best worst-case margin.
 */
export function clampToContrast(
  hex: string,
  rules: ContrastRule[],
  prefer?: "lighter" | "darker",
): { hex: string; ok: boolean; shift: number } {
  if (rules.length === 0 || worstMargin(hex, rules) >= 1) return { hex, ok: true, shift: 0 };
  const base = toOklch(hex);
  let best = { hex, margin: worstMargin(hex, rules), shift: 0 };
  const directions = prefer === "lighter" ? [1] : prefer === "darker" ? [-1] : [1, -1];
  for (let step = 1; step <= 200; step++) {
    const d = step * 0.005;
    for (const sign of directions) {
      const l = base.l + sign * d;
      if (l < 0 || l > 1) continue;
      const candidate = fromOklch({ l, c: base.c, h: base.h });
      const margin = worstMargin(candidate, rules);
      if (margin >= 1) return { hex: candidate, ok: true, shift: sign * d };
      if (margin > best.margin) best = { hex: candidate, margin, shift: sign * d };
    }
  }
  return { hex: best.hex, ok: false, shift: best.shift };
}
