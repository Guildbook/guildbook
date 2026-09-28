import { type BorderStyle, BORDER_STYLE_IDS, DEFAULT_TABARD, type TabardConfig } from "@/lib/tabard/config";
import { isCrestEmblem } from "@/lib/tabard/crest";
import type { ThemeBase, ThemeOverrides } from "@/lib/tabard/theme";

/** The guild columns that describe its tabard and theme. */
export interface LookColumns {
  tabardBackground: number;
  tabardBorder: number;
  tabardBorderStyle: string;
  tabardEmblemColor: number;
  /** Blizzard's emblem id: set for every guild but the Order, whose locked crest doesn't use it. */
  tabardEmblemId?: number | null;
  /** The in-game border shape from the last import: stored, never drawn. */
  tabardBorderId?: number | null;
  themeBase: ThemeBase;
  themeOverrides?: ThemeOverrides | null;
}

export interface GuildLook {
  tabard: TabardConfig;
  base: ThemeBase;
  overrides: ThemeOverrides;
}

/**
 * A guild row's tabard and theme. An unknown trim style, or an emblem id that's missing or not in the bundled set,
 * falls back to the default.
 */
export function guildLook(g: LookColumns): GuildLook {
  return {
    tabard: {
      background: g.tabardBackground,
      border: g.tabardBorder,
      borderStyle: (BORDER_STYLE_IDS as string[]).includes(g.tabardBorderStyle) ? (g.tabardBorderStyle as BorderStyle) : "plain",
      emblemColor: g.tabardEmblemColor,
      emblemId: isCrestEmblem(g.tabardEmblemId) ? g.tabardEmblemId : DEFAULT_TABARD.emblemId,
      ...(g.tabardBorderId != null ? { borderId: g.tabardBorderId } : {}),
    },
    base: g.themeBase,
    overrides: g.themeOverrides ?? {},
  };
}

/** Whether a guild shows the Order of Saint Michael's locked crest and theme. */
export const isOrderLook = (g: { themeBase: ThemeBase }) => g.themeBase === "order";
