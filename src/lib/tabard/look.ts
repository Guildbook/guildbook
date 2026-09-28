import { type BorderStyle, BORDER_STYLE_IDS, DEFAULT_TABARD, type TabardConfig } from "@/lib/tabard/config";
import { emblemById } from "@/lib/tabard/emblems";
import type { ThemeBase, ThemeOverrides } from "@/lib/tabard/theme";

/** The guild columns that describe its tabard and theme. */
export interface LookColumns {
  tabardBackground: number;
  tabardBorder: number;
  tabardBorderStyle: string;
  tabardEmblem: string;
  tabardEmblemColor: number;
  themeBase: ThemeBase;
  themeOverrides?: ThemeOverrides | null;
}

export interface GuildLook {
  tabard: TabardConfig;
  base: ThemeBase;
  overrides: ThemeOverrides;
}

/** A guild row's tabard and theme. Unknown border styles or emblems (say, from a retired id) fall back to defaults. */
export function guildLook(g: LookColumns): GuildLook {
  return {
    tabard: {
      background: g.tabardBackground,
      border: g.tabardBorder,
      borderStyle: (BORDER_STYLE_IDS as string[]).includes(g.tabardBorderStyle) ? (g.tabardBorderStyle as BorderStyle) : "plain",
      emblem: emblemById(g.tabardEmblem) ? g.tabardEmblem : DEFAULT_TABARD.emblem,
      emblemColor: g.tabardEmblemColor,
    },
    base: g.themeBase,
    overrides: g.themeOverrides ?? {},
  };
}

/** Whether a guild shows the Order of Saint Michael's locked crest and theme. */
export const isOrderLook = (g: { themeBase: ThemeBase }) => g.themeBase === "order";
