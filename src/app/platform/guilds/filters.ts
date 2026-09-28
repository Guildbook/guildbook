import type { Faction, Region, Ruleset } from "@/lib/game";

export interface DirectoryFilter {
  region?: Region;
  faction?: Faction;
  ruleset?: Ruleset;
}

/** The shareable directory URL for a set of filters. */
export function directoryHref(filter: DirectoryFilter): string {
  const params = new URLSearchParams();
  if (filter.region) params.set("region", filter.region);
  if (filter.faction) params.set("faction", filter.faction);
  if (filter.ruleset) params.set("ruleset", filter.ruleset);
  const query = params.toString();
  return query ? `/guilds?${query}` : "/guilds";
}
