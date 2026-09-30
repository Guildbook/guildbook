import type { BattlenetExcludedGroup, BattlenetScan } from "@/db/schema";
import { FACTION_LABELS, type Faction, REGION_LABELS, type Region } from "@/lib/game";
import { type GuildVersion, VERSION_INFO } from "@/lib/game-versions";
import { hasLaunched } from "@/lib/showcase";
import { GAME_VERSION_LABELS } from "@/lib/wow-versions";

export interface EmptySnapshotInput {
  battletag: string;
  status: string;
  scan: BattlenetScan | null;
  /** The link's characters in the guild's game version, before the guild's region, faction and realm filter. */
  foreverCharacters: readonly { faction: Faction; region?: Region }[];
  /** The guild's game version (default WoW: Forever). */
  version?: GuildVersion;
  guildFaction: Faction | null;
  /** The guild's region; characters without a region (snapshots from before regions) are US. */
  guildRegion?: Region | null;
  now: Date;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function describeGroup(g: BattlenetExcludedGroup): string {
  const faction = g.faction ? `${FACTION_LABELS[g.faction]} ` : "";
  const where = g.version === "unknown" ? "on other realms" : `in ${GAME_VERSION_LABELS[g.version]}`;
  const names = g.examples.map((e) => `${e.name} on ${e.realmName}`);
  const more = g.count > names.length ? `, and ${g.count - names.length} more` : "";
  return `${plural(g.count, `${faction}character`)} ${where}${names.length > 0 ? ` (${names.join(", ")}${more})` : ""}`;
}

function launchNote(now: Date, version: GuildVersion): string {
  if (version !== "forever") return "";
  return hasLaunched(now)
    ? "If you've just made your WoW: Forever character, Battle.net can take a while to list it: refresh your characters later."
    : "World of Warcraft: Forever launches on Nov 4, 2026. Once you've made your character there, refresh your characters or reconnect.";
}

/**
 * The status line after refreshing Battle.net characters. `eligible` is how many the guild accepts (the same list the
 * page offers for import), never the whole snapshot, which also holds other games' characters.
 */
export function refreshSummary(eligible: number, version: GuildVersion = "forever"): string {
  const label = VERSION_INFO[version].label;
  if (eligible === 0) return `Characters refreshed: no ${label} characters can join this guild.`;
  return `Found ${plural(eligible, `${label} character`)} for this guild.`;
}

/** Why a linked account offers this guild no characters, saying what the account does have. */
export function emptySnapshotMessage(input: EmptySnapshotInput): string {
  const { battletag, status, scan, guildFaction, guildRegion, now } = input;
  const version = input.version ?? "forever";
  const label = VERSION_INFO[version].label;
  const inRegion = (region: Region | undefined) => !guildRegion || (region ?? "us") === guildRegion;
  const foreverCharacters = input.foreverCharacters.filter((c) => inRegion(c.region));
  const elsewhere = input.foreverCharacters.filter((c) => !inRegion(c.region));
  const regionLabel = guildRegion ? REGION_LABELS[guildRegion] : null;
  const where = regionLabel ? ` in the ${regionLabel} region` : "";
  if (status === "forbidden") {
    return "Battle.net didn't share your character list. Reconnect and allow access to your World of Warcraft profile.";
  }
  if (status === "error") {
    return "Battle.net didn't respond when we read your characters. Try refreshing or reconnecting later.";
  }

  if (foreverCharacters.length === 0 && elsewhere.length > 0 && regionLabel) {
    const other = listJoin([...new Set(elsewhere.map((c) => (c.region ?? "us") === "us" ? "the Americas" : REGION_LABELS[c.region!]))]);
    return `Your ${label} characters on ${battletag} are in ${other}, but this guild is in the ${regionLabel} region. Regions are separate worlds, so only ${regionLabel} characters can join it.`;
  }

  if (foreverCharacters.length > 0) {
    if (guildFaction && foreverCharacters.every((c) => c.faction !== guildFaction)) {
      const other = FACTION_LABELS[guildFaction === "alliance" ? "horde" : "alliance"];
      return `Your ${label} characters on ${battletag} are ${other}; this guild only accepts ${FACTION_LABELS[guildFaction]} characters.`;
    }
    return `None of your ${label} characters on ${battletag} are on this guild's realm${VERSION_INFO[version].realms ? "" : "s"}.`;
  }

  if (!scan) {
    return `We found no ${label} characters${where} on ${battletag}. Refresh your characters or reconnect Battle.net to see what else is on the account.`;
  }
  const readBefore = scan.excluded.filter((g) => g.version === version);
  if (readBefore.length > 0) {
    return `Your characters on ${battletag} were read before Guildbook could import ${label} characters. We saw ${listJoin(readBefore.map(describeGroup))}: refresh your characters (or reconnect Battle.net) to import them.`;
  }

  const failed = scan.namespaces.filter((n) => n.status === "error");
  const failedRegions = [...new Set(failed.flatMap((n) => (n.region ? [REGION_LABELS[n.region]] : [])))];
  const incomplete =
    failed.length === 0
      ? ""
      : failedRegions.length > 0
        ? ` Battle.net didn't answer for every game in ${listJoin(failedRegions)}, so this may be incomplete.`
        : " Battle.net didn't answer for every game, so this may be incomplete.";
  if (scan.excluded.length === 0) {
    return `Battle.net listed no World of Warcraft characters on ${battletag}.${incomplete} ${launchNote(now, version)}`.trimEnd();
  }
  const found = listJoin(scan.excluded.map(describeGroup));
  return `We found no ${label} characters${where} on ${battletag}. We did find ${found}, but only ${label} characters can join this guild.${incomplete} ${launchNote(now, version)}`.trimEnd();
}
