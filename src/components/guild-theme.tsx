import { guildLook, isOrderLook, type LookColumns } from "@/lib/tabard/look";
import { computeTheme, type SelectableBase, themeCss } from "@/lib/tabard/theme";

/**
 * The guild's theme as CSS variables on `:root`. The Order renders nothing: its look is globals.css as written.
 * Every value is a computed hex or a font stack (overrides are validated hex), so the markup is safe to inline.
 */
export function GuildThemeStyle({ guild }: { guild: LookColumns }) {
  if (isOrderLook(guild)) return null;
  const look = guildLook(guild);
  const theme = computeTheme(look.tabard, look.base as SelectableBase, look.overrides);
  return <style data-guild-theme={look.base} dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />;
}
