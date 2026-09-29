import type { BattlenetCharacterSnapshot } from "@/db/schema";
import type { Faction, Region, Ruleset } from "@/lib/game";
import type { GuildVersion } from "@/lib/game-versions";

/** A snapshot character's region; snapshots taken before regions only read US profiles. */
export function snapshotRegion(character: Pick<BattlenetCharacterSnapshot, "region">): Region {
  return character.region ?? "us";
}

/** A snapshot character's game version; snapshots taken before versions only kept WoW: Forever characters. */
export function snapshotVersion(character: Pick<BattlenetCharacterSnapshot, "gameVersion">): GuildVersion {
  return character.gameVersion ?? "forever";
}

/**
 * Characters a guild accepts: its game version (and realm, for versions with realms), its region, its faction, its
 * ruleset (when the realm's ruleset is known) and, when configured, its realms.
 */
export function charactersForGuild(
  characters: readonly BattlenetCharacterSnapshot[],
  guild: {
    gameVersion?: GuildVersion;
    realmSlug?: string | null;
    region?: Region;
    faction: Faction;
    ruleset?: Ruleset;
    realmSlugs: readonly string[];
  },
): BattlenetCharacterSnapshot[] {
  return characters
    .filter((c) => snapshotVersion(c) === (guild.gameVersion ?? "forever"))
    .filter((c) => !guild.realmSlug || c.realmSlug.toLowerCase() === guild.realmSlug)
    .filter((c) => !guild.region || snapshotRegion(c) === guild.region)
    .filter((c) => c.faction === guild.faction)
    .filter((c) => !guild.ruleset || !c.ruleset || c.ruleset === guild.ruleset)
    .filter((c) => guild.realmSlugs.length === 0 || guild.realmSlugs.includes(c.realmSlug.toLowerCase()))
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
}
