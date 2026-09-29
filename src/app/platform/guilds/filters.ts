import type { Faction, Region, Ruleset } from "@/lib/game";
import { DEFAULT_GUILD_VERSION, type SupportedGuildVersion } from "@/lib/game-versions";

export interface DirectoryFilter {
  /** Absent means WoW: Forever, the default view. */
  version?: SupportedGuildVersion;
  /** Only for versions with realms. */
  realm?: string;
  region?: Region;
  faction?: Faction;
  ruleset?: Ruleset;
}

/** The shareable directory URL for a set of filters. */
export function directoryHref(filter: DirectoryFilter): string {
  const params = new URLSearchParams();
  if (filter.version && filter.version !== DEFAULT_GUILD_VERSION) params.set("version", filter.version);
  if (filter.realm) params.set("realm", filter.realm);
  if (filter.region) params.set("region", filter.region);
  if (filter.faction) params.set("faction", filter.faction);
  if (filter.ruleset) params.set("ruleset", filter.ruleset);
  const query = params.toString();
  return query ? `/guilds?${query}` : "/guilds";
}
