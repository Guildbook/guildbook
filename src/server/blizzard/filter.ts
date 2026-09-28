import type { BattlenetCharacterSnapshot } from "@/db/schema";
import type { Faction } from "@/lib/game";

/** Characters a guild accepts: its faction (if it has one) and, when configured, its realms. */
export function charactersForGuild(
  characters: readonly BattlenetCharacterSnapshot[],
  guild: { faction: Faction | null; realmSlugs: readonly string[] },
): BattlenetCharacterSnapshot[] {
  return characters
    .filter((c) => !guild.faction || c.faction === guild.faction)
    .filter((c) => guild.realmSlugs.length === 0 || guild.realmSlugs.includes(c.realmSlug.toLowerCase()))
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
}
