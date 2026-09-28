/**
 * How Blizzard's emblem masks take a colour. The bundled masks are levels-stretched by `pnpm emblems:fetch` (each
 * image's darkest body pixels at 0, brightest at 255), so a mask's gray is pure relative shading. A pixel's colour is
 * the chosen colour scaled from `floor` (deepest shadow) to full at the brightest pixels, plus a white `gloss` on the
 * highlights that grows for dark colours. White reads white, gold reads gold, and black keeps visible relief, as on
 * the in-game tabard.
 *
 * The same curve runs everywhere: as `feComponentTransfer` tables in the browser (a mask's R, G and B are equal, so
 * each output channel is a function of the gray alone) and as a lookup table when the server pre-tints images.
 */
const TONE = { floor: 0.8, curve: 0.7, gloss: 0.08, darkGloss: 0.3 };

/**
 * Bump when the curve, the bundled masks or how crests are drawn change, so icons and link previews drawn the old way
 * are refetched (it is part of every tabard key).
 */
export const CREST_ART_VERSION = 3;

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [number, number, number];
};

/** The 0 to 1 channel values for mask gray `v` (0 to 1) tinted with `hex`. */
export function crestTone(hex: string, v: number): [number, number, number] {
  const { floor, curve, gloss, darkGloss } = TONE;
  const color = rgb(hex);
  const luma = 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];
  const shade = floor + (1 - floor) * v ** curve;
  const shine = (gloss + darkGloss * (1 - luma) ** 2) * v ** 3;
  return color.map((c) => Math.min(1, c * shade + shine * (1 - c * shade))) as [number, number, number];
}

/** 256-entry lookup tables (0 to 255) per channel, for tinting mask pixels. */
export function crestToneLut(hex: string): [Uint8Array, Uint8Array, Uint8Array] {
  const out: [Uint8Array, Uint8Array, Uint8Array] = [new Uint8Array(256), new Uint8Array(256), new Uint8Array(256)];
  for (let g = 0; g < 256; g++) {
    const t = crestTone(hex, g / 255);
    for (let c = 0; c < 3; c++) out[c]![g] = Math.round(t[c]! * 255);
  }
  return out;
}

const TABLE_STEPS = 16;

/** `feFuncR`, `feFuncG` and `feFuncB` `tableValues` for the curve (piecewise linear, close to the lookup tables). */
export function crestToneTables(hex: string): [string, string, string] {
  const rows: [string[], string[], string[]] = [[], [], []];
  for (let i = 0; i <= TABLE_STEPS; i++) {
    const t = crestTone(hex, i / TABLE_STEPS);
    for (let c = 0; c < 3; c++) rows[c]!.push(String(Math.round(t[c]! * 1000) / 1000));
  }
  return rows.map((r) => r.join(" ")) as [string, string, string];
}
