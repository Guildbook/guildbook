/**
 * The in-game tabard designer's fixed palettes, from the client's GuildColorBackground, GuildColorBorder and
 * GuildColorEmblem tables (51, 17 and 17 entries; indexes are the game's colour IDs).
 *
 * Background colours are used as the game stores them. Border and emblem colours are tint multipliers the game
 * applies to bright metallic textures, so the raw values are dark (a white emblem is stored as 177, 184, 177).
 * Each `hex` here is the tuned swatch as it reads on a tabard: the raw colour scaled up, hue preserved, until its
 * brightest channel is near full (at most doubled). `raw` keeps the game's value for reference.
 */
export interface Swatch {
  id: number;
  name: string;
  hex: string;
  raw: string;
}

const swatch = (id: number, name: string, hex: string, raw = hex): Swatch => ({ id, name, hex, raw });

export const BACKGROUND_COLORS: readonly Swatch[] = [
  swatch(0, "Rose", "#ff2088"),
  swatch(1, "Raspberry", "#bd005b"),
  swatch(2, "Crimson", "#9e0036"),
  swatch(3, "Tangerine", "#ff891b"),
  swatch(4, "Vermilion", "#e14500"),
  swatch(5, "Blood red", "#b1002e"),
  swatch(6, "Marigold", "#ffb317"),
  swatch(7, "Orange", "#f68700"),
  swatch(8, "Rust", "#ae4b00"),
  swatch(9, "Lemon", "#fffc14"),
  swatch(10, "Goldenrod", "#f3ca00"),
  swatch(11, "Old gold", "#c49b00"),
  swatch(12, "Canary", "#ffff14"),
  swatch(13, "Citron", "#d8dd00"),
  swatch(14, "Olive", "#a6ac00"),
  swatch(15, "Lime", "#e3f618"),
  swatch(16, "Pear", "#b7c003"),
  swatch(17, "Moss", "#8e9700"),
  swatch(18, "Chartreuse", "#bcf61b"),
  swatch(19, "Leaf", "#88ba03"),
  swatch(20, "Fern", "#588000"),
  swatch(21, "Spring green", "#1eff68"),
  swatch(22, "Emerald", "#04c347"),
  swatch(23, "Forest", "#00820f"),
  swatch(24, "Aquamarine", "#1ef7c1"),
  swatch(25, "Jade", "#04b78f"),
  swatch(26, "Pine", "#009061"),
  swatch(27, "Sky", "#21dcff"),
  swatch(28, "Cerulean", "#009dc5"),
  swatch(29, "Deep sea", "#006391"),
  swatch(30, "Cornflower", "#4d8eda"),
  swatch(31, "Azure", "#2c6aae"),
  swatch(32, "Navy", "#003582"),
  swatch(33, "Orchid", "#d34ac8"),
  swatch(34, "Violet", "#ad29ac"),
  swatch(35, "Royal purple", "#860f9a"),
  swatch(36, "Fuchsia", "#ff38fa"),
  swatch(37, "Magenta", "#c900c3"),
  swatch(38, "Plum", "#9b00a6"),
  swatch(39, "Hot pink", "#ff1fbf"),
  swatch(40, "Cerise", "#d30087"),
  swatch(41, "Mulberry", "#a30068"),
  swatch(42, "Tan", "#c58132"),
  swatch(43, "Umber", "#875513"),
  swatch(44, "Dark brown", "#4f2300"),
  swatch(45, "Charcoal", "#232323"),
  swatch(46, "Slate", "#646464"),
  swatch(47, "Ash", "#b4bba8"),
  swatch(48, "Bone", "#d7ddcb"),
  swatch(49, "White", "#ffffff"),
  swatch(50, "Salmon", "#fc6891"),
];

export const BORDER_COLORS: readonly Swatch[] = [
  swatch(0, "Crimson", "#ce0042", "#670021"),
  swatch(1, "Copper", "#ce4600", "#672300"),
  swatch(2, "Amber", "#ce8a00", "#674500"),
  swatch(3, "Gold", "#ceac00", "#675600"),
  swatch(4, "Chartreuse", "#abff00", "#639400"),
  swatch(5, "Lime", "#9bff00", "#63a300"),
  swatch(6, "Green", "#8dff00", "#63b300"),
  swatch(7, "Emerald", "#00ce3e", "#00671f"),
  swatch(8, "Cyan", "#00fbff", "#008e90"),
  swatch(9, "Sky", "#00b3ff", "#006793"),
  swatch(10, "Royal blue", "#0062f8", "#00317c"),
  swatch(11, "Violet", "#da00ee", "#6d0077"),
  swatch(12, "Magenta", "#f600ce", "#7b0067"),
  swatch(13, "Bronze", "#a86e14", "#54370a"),
  swatch(14, "Silver", "#ffffff"),
  swatch(15, "Iron", "#1e282a", "#0f1415"),
  swatch(16, "Bright gold", "#f9cc30"),
];

export const EMBLEM_COLORS: readonly Swatch[] = [
  swatch(0, "Crimson", "#ce0042", "#670021"),
  swatch(1, "Copper", "#ce4600", "#672300"),
  swatch(2, "Amber", "#ce8a00", "#674500"),
  swatch(3, "Gold", "#ceac00", "#675600"),
  swatch(4, "Citron", "#c6ce00", "#636700"),
  swatch(5, "Lime", "#a2ce00", "#516700"),
  swatch(6, "Green", "#6ece00", "#376700"),
  swatch(7, "Emerald", "#00ce3e", "#00671f"),
  swatch(8, "Teal", "#00ceae", "#006757"),
  swatch(9, "Sky", "#0090ce", "#004867"),
  swatch(10, "Royal blue", "#1254ba", "#092a5d"),
  swatch(11, "Purple", "#ac12ba", "#56095d"),
  swatch(12, "Magenta", "#ba129e", "#5d094f"),
  swatch(13, "Bronze", "#a86e14", "#54370a"),
  swatch(14, "White", "#f5fff5", "#b1b8b1"),
  swatch(15, "Black", "#202a2e", "#101517"),
  swatch(16, "Tan", "#dfa55a"),
];

export type PaletteKind = "background" | "border" | "emblem";

export const PALETTES: Record<PaletteKind, readonly Swatch[]> = {
  background: BACKGROUND_COLORS,
  border: BORDER_COLORS,
  emblem: EMBLEM_COLORS,
};

/** The swatch at `id`, or the palette's first entry for an unknown id. */
export function swatchOf(kind: PaletteKind, id: number): Swatch {
  const list = PALETTES[kind];
  return list[id] ?? list[0]!;
}
