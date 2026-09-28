import type { TabardConfig } from "@/lib/tabard/config";
import { isCrestEmblem } from "@/lib/tabard/crest";
import { PALETTES, type PaletteKind } from "@/lib/tabard/palette";

/** A guild crest as Blizzard's guild endpoint describes it (see `parseGuildCrest`). */
export interface CrestInput {
  emblem: { id: number; color: CrestColorInput };
  border: { id: number; color: CrestColorInput };
  background: { color: CrestColorInput };
}

interface CrestColorInput {
  id: number;
  rgb: [number, number, number] | null;
}

const rawRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * The palette id for a crest colour. Palette ids are the game's colour ids, but an RGB that exactly matches another
 * entry wins (in case a namespace numbers its palette differently); an unknown id takes the nearest colour.
 */
export function paletteIdFor(kind: PaletteKind, color: CrestColorInput): number {
  const list = PALETTES[kind];
  if (color.rgb) {
    const [r, g, b] = color.rgb;
    const exact = list.find((s) => rawRgb(s.raw).every((v, i) => v === color.rgb![i]));
    if (exact) return exact.id;
    if (list[color.id]) return color.id;
    let best = list[0]!;
    let bestDistance = Infinity;
    for (const s of list) {
      const [sr, sg, sb] = rawRgb(s.raw);
      const d = (sr - r) ** 2 + (sg - g) ** 2 + (sb - b) ** 2;
      if (d < bestDistance) [best, bestDistance] = [s, d];
    }
    return best.id;
  }
  return list[color.id] ? color.id : 0;
}

export type CrestImport = { ok: true; tabard: TabardConfig } | { ok: false; reason: "unknown_emblem"; id: number };

/**
 * An in-game crest as a tabard: its emblem and three colours, keeping the trim style from `current`. The border
 * shape is stored as `borderId` but never drawn, so any id that fits the column is accepted.
 */
export function tabardFromCrest(crest: CrestInput, current: TabardConfig): CrestImport {
  if (!isCrestEmblem(crest.emblem.id)) return { ok: false, reason: "unknown_emblem", id: crest.emblem.id };
  return {
    ok: true,
    tabard: {
      ...current,
      background: paletteIdFor("background", crest.background.color),
      border: paletteIdFor("border", crest.border.color),
      emblemColor: paletteIdFor("emblem", crest.emblem.color),
      emblemId: crest.emblem.id,
      borderId: Number.isInteger(crest.border.id) && crest.border.id >= 0 && crest.border.id <= 32767 ? crest.border.id : null,
    },
  };
}
