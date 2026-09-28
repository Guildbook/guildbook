import type { BattlenetCharacterSnapshot } from "@/db/schema";
import type { Faction, Ruleset } from "@/lib/game";

/**
 * Characters a guild accepts: its faction, its ruleset (when the realm's ruleset is known) and, when configured,
 * its realms.
 */
export function charactersForGuild(
  characters: readonly BattlenetCharacterSnapshot[],
  guild: { faction: Faction; ruleset?: Ruleset; realmSlugs: readonly string[] },
): BattlenetCharacterSnapshot[] {
  return characters
    .filter((c) => c.faction === guild.faction)
    .filter((c) => !guild.ruleset || !c.ruleset || c.ruleset === guild.ruleset)
    .filter((c) => guild.realmSlugs.length === 0 || guild.realmSlugs.includes(c.realmSlug.toLowerCase()))
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
}
